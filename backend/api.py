"""API REST de Hotspots Comerciales."""
from __future__ import annotations

import json
import math
import os
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Literal

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import config
import mercado
import modelo

ORIGENES = [o.strip() for o in os.getenv(
    "HOTSPOTS_CORS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
# Límite de cobertura: rectángulo de los polígonos OPAMSS disponibles.
DESCARGABLES = {
    "concesionarios.geojson": config.CONCESIONARIOS,
    "ubicaciones_propuestas.csv": config.UBICACIONES,
    "indicadores_mercado.csv": config.INDICADORES,
    "poblacion_2024.csv": config.CENSO,
    "fuentes_datos.csv": config.FUENTES,
    "auditoria_osm.csv": config.RESULTADOS / "auditoria_osm.csv",
    "concesionarios_entrenamiento.csv": config.RESULTADOS / "concesionarios_entrenamiento.csv",
    "centroides.csv": config.RESULTADOS / "centroides.csv",
    "evaluacion_kmeans.csv": config.RESULTADOS / "evaluacion_kmeans.csv",
    "evaluacion_knn.csv": config.RESULTADOS / "evaluacion_knn.csv",
    "comparacion_mercado_integrada.csv": config.RESULTADOS / "comparacion_mercado_integrada.csv",
    "accesibilidad_competencia.csv": config.RESULTADOS / "accesibilidad_competencia.csv",
    "resumen.json": config.RESULTADOS / "resumen.json",
    "mapa_mercado_integrado.html": config.RESULTADOS / "mapa_mercado_integrado.html",
}


def _limpio(valor: Any) -> Any:
    """Convierte NaN y tipos de numpy en valores JSON."""
    if isinstance(valor, dict):
        return {k: _limpio(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_limpio(v) for v in valor]
    if isinstance(valor, (np.integer,)):
        return int(valor)
    if isinstance(valor, (np.floating, float)):
        return None if math.isnan(valor) or math.isinf(valor) else float(valor)
    if isinstance(valor, np.bool_):
        return bool(valor)
    if valor is pd.NA or valor is pd.NaT:
        return None
    return valor


def _registros(df: pd.DataFrame) -> list[dict]:
    return _limpio(df.astype(object).where(df.notna(), None).to_dict("records"))


class Estado:
    """Resultados cargados en memoria. Se recargan solo cuando se pide."""

    def __init__(self):
        self.bloqueo = threading.Lock()
        self.cargar()

    def cargar(self) -> None:
        r = config.RESULTADOS
        self.errores: list[str] = []
        self.cargado = datetime.now(timezone.utc).isoformat(timespec="seconds")
        leer = lambda n: pd.read_csv(r / n, encoding="utf-8-sig", dtype={"id": str}) if (r / n).exists() else None
        self.resumen = json.loads((r / "resumen.json").read_text(encoding="utf-8")) \
            if (r / "resumen.json").exists() else None
        self.integracion = json.loads((r / "estado_integracion.json").read_text(encoding="utf-8")) \
            if (r / "estado_integracion.json").exists() else None
        self.auditoria = leer("auditoria_osm.csv")
        self.entrenamiento = leer("concesionarios_entrenamiento.csv")
        self.centroides = leer("centroides.csv")
        self.eval_kmeans = leer("evaluacion_kmeans.csv")
        self.eval_knn = leer("evaluacion_knn.csv")
        self.integrada = leer("comparacion_mercado_integrada.csv")
        self.vecinos = leer("vecinos_knn.csv")
        self.rutas = leer("accesibilidad_competencia.csv")
        self.censo = mercado.cargar_censo()
        self.indicadores = pd.read_csv(config.INDICADORES, encoding="utf-8-sig")
        self.fuentes = pd.read_csv(config.FUENTES, encoding="utf-8-sig") if config.FUENTES.exists() else None
        try:
            self.modelo = modelo.cargar_modelo()
        except FileNotFoundError as exc:
            self.modelo = None
            self.errores.append(str(exc))
        try:
            self.distritos = mercado.cargar_distritos()
        except Exception as exc:
            self.distritos = None
            self.errores.append(f"Límites OPAMSS: {exc}")
        self.cobertura = tuple(self.distritos.total_bounds) if self.distritos is not None else None
        self.red = None
        if self.entrenamiento is not None:
            try:
                G = mercado.cargar_red()
                self.red = mercado.RedVial(G, self.entrenamiento) if G is not None else None
                if G is None:
                    self.errores.append("Red vial no disponible (falta red_vial.graphml)")
            except Exception as exc:
                self.errores.append(f"Red vial: {exc}")


estado: Estado | None = None


@asynccontextmanager
async def ciclo_vida(_app: FastAPI):
    global estado
    config.configurar_consola()
    estado = Estado()
    yield


app = FastAPI(
    title="Hotspots Comerciales API",
    description=("Análisis de ubicaciones para Porsche Center San Salvador: K-Means, KNN, Censo 2024, "
                 "distritos y red vial."),
    version="1.0.0",
    lifespan=ciclo_vida,
)
app.add_middleware(CORSMiddleware, allow_origins=ORIGENES, allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"])


def _requiere(*nombres: str) -> Estado:
    if estado is None:
        raise HTTPException(503, "La API aún no terminó de cargar")
    faltan = [n for n in nombres if getattr(estado, n) is None]
    if faltan:
        raise HTTPException(503, f"Resultados no disponibles ({', '.join(faltan)}). Ejecute: python ejecutar.py")
    return estado



class PuntoEntrada(BaseModel):
    latitud: float = Field(..., ge=-90, le=90, examples=[13.700])
    longitud: float = Field(..., ge=-180, le=180, examples=[-89.220])
    nombre: str | None = Field(None, max_length=80, examples=["Punto de prueba"])


@app.get("/api/estado", tags=["General"], summary="Estado de datos y modelos")
def obtener_estado():
    e = _requiere()
    archivos = {n: p.exists() for n, p in DESCARGABLES.items()}
    return {
        "api": "ok",
        "cargado_en": e.cargado,
        "fecha_calculo_modelo": (e.resumen or {}).get("fecha_calculo"),
        "modelo_knn": e.modelo is not None,
        "limites_opamss": e.distritos is not None,
        "red_vial": e.red is not None,
        "archivos": archivos,
        "avisos": e.errores,
    }


@app.get("/api/resumen", tags=["General"], summary="Indicadores principales del panel")
def obtener_resumen():
    e = _requiere("resumen", "integrada")
    r = e.resumen
    ss = e.censo[e.censo.distrito == "San Salvador"].iloc[0]
    centro = int(e.censo[e.censo.municipio == "San Salvador Centro"].poblacion_2024.sum())
    depto = int(e.censo[e.censo.departamento == "San Salvador"].poblacion_2024.sum())
    return _limpio({
        "establecimientos_analizados": r["registros_validos"],
        "establecimientos_entrenamiento": r["registros_entrenamiento"],
        "excluidos_confirmados": len(r["excluidos_confirmados"]),
        "pendientes_revision": r["pendientes_revision"],
        "perifericos": r["perifericos_elegibles"],
        "clusters": r["kmeans_k"],
        "silhouette": r["silhouette_elegido"],
        "knn_k": r["knn_k"],
        "acuerdo_knn_kmeans": r["acuerdo_loo_con_etiquetas_kmeans"],
        "ubicaciones_propuestas": int(len(e.integrada)),
        "poblacion": {
            "distrito_san_salvador": int(ss.poblacion_2024),
            "municipio_san_salvador_centro": centro,
            "departamento_san_salvador": depto,
            "anio": 2024,
            "fuente": "BCR - Censo de Población y Vivienda 2024",
        },
        "fecha_extraccion_osm": r.get("fecha_extraccion"),
        "fecha_calculo": r.get("fecha_calculo"),
        "red_vial": e.integracion.get("accesibilidad") if e.integracion else None,
        "ubicaciones": _registros(e.integrada[["id", "nombre", "zona_knn", "distrito",
                                                "concesionarios_1km", "competidor_vial_mas_cercano_m"]]),
        "advertencias": r["advertencias"],
    })


@app.get("/api/concesionarios", tags=["Datos"], summary="Establecimientos OSM con su auditoría")
def obtener_concesionarios(
    estado_registro: Literal["sin_alerta", "pendiente_revision", "excluido_confirmado"] | None =
    Query(None, alias="estado"),
    solo_entrenamiento: bool = False,
):
    e = _requiere("auditoria")
    df = e.auditoria
    if estado_registro:
        df = df[df.estado == estado_registro]
    if solo_entrenamiento:
        df = df[df.usado_entrenamiento]
    columnas = ["osm_id", "name", "category", "brand", "street", "latitude", "longitude", "estado",
                "motivo", "fuente_verificacion", "zona", "usado_entrenamiento", "detalle_dataset"]
    return {"total": int(len(df)), "registros": _registros(df[[c for c in columnas if c in df.columns]])}


@app.get("/api/clusters", tags=["Machine Learning"], summary="Grupos K-Means y evaluación")
def obtener_clusters():
    e = _requiere("entrenamiento", "centroides", "eval_kmeans", "eval_knn", "resumen")
    grupos = []
    for c in e.centroides.itertuples():
        miembros = e.entrenamiento[e.entrenamiento.zona == c.zona]
        grupos.append({**_limpio({k: v for k, v in c._asdict().items() if k != "Index"}), "miembros": _registros(
            miembros[["osm_id", "name", "latitude", "longitude", "x_m", "y_m"]])})
    return _limpio({
        "k": e.resumen["kmeans_k"],
        "criterio": e.resumen.get("criterio_k"),
        "semilla": e.resumen.get("semilla"),
        "silhouette": e.resumen["silhouette_elegido"],
        "evaluacion_kmeans": _registros(e.eval_kmeans),
        "knn_k": e.resumen["knn_k"],
        "evaluacion_knn": _registros(e.eval_knn),
        "acuerdo_loo": e.resumen["acuerdo_loo_con_etiquetas_kmeans"],
        "estabilidad_knn": e.resumen.get("estabilidad_knn", {}),
        "grupos": grupos,
        "advertencias": e.resumen["advertencias"],
    })


@app.get("/api/centroides", tags=["Machine Learning"], summary="Centroides K-Means")
def obtener_centroides():
    e = _requiere("centroides")
    return _registros(e.centroides)


def _detalle_ubicacion(e: Estado, fila: pd.Series) -> dict:
    id_ = fila["id"]
    rutas = e.rutas[e.rutas.id == id_] if e.rutas is not None else pd.DataFrame()
    ok = rutas[rutas.estado_ruta == "ok"].sort_values("distancia_vial_m") if len(rutas) else rutas
    return _limpio({
        **{k: _limpio(v) for k, v in fila.to_dict().items()},
        "vecinos_knn": _registros(e.vecinos[e.vecinos.id == id_]) if e.vecinos is not None else [],
        "rutas_cercanas": _registros(ok.head(8)) if len(ok) else [],
    })


@app.get("/api/ubicaciones", tags=["Ubicaciones"], summary="Ubicaciones propuestas A, B y C")
def obtener_ubicaciones():
    e = _requiere("integrada")
    return [_detalle_ubicacion(e, f) for _, f in e.integrada.iterrows()]


@app.get("/api/ubicaciones/{id_ubicacion}", tags=["Ubicaciones"], summary="Detalle de una ubicación")
def obtener_ubicacion(id_ubicacion: str):
    e = _requiere("integrada")
    fila = e.integrada[e.integrada.id.str.upper() == id_ubicacion.upper()]
    if fila.empty:
        raise HTTPException(404, f"No existe la ubicación '{id_ubicacion}'")
    return _detalle_ubicacion(e, fila.iloc[0])


@app.post("/api/analizar-ubicacion", tags=["Ubicaciones"], summary="Evaluar un punto nuevo")
def analizar_ubicacion(p: PuntoEntrada):
    e = _requiere("modelo")
    if e.cobertura is not None:
        x0, y0, x1, y1 = e.cobertura
        if not (x0 <= p.longitud <= x1 and y0 <= p.latitud <= y1):
            raise HTTPException(422, "El punto está fuera de la cobertura geográfica disponible "
                                     "(polígonos OPAMSS de San Salvador y La Libertad).")
    r = modelo.clasificar_punto(p.latitud, p.longitud, e.modelo)
    puntos = pd.DataFrame([{"nombre": p.nombre or "Punto nuevo", "latitude": p.latitud, "longitude": p.longitud}])
    geo = mercado.asignar_distrito(puntos, e.distritos, e.censo).iloc[0]
    if e.red is not None:
        rutas = e.red.rutas_desde(p.latitud, p.longitud, "N", p.nombre or "Punto nuevo")
        accesibilidad = mercado.resumir_rutas(rutas)
        cercanas = rutas[rutas.estado_ruta == "ok"].sort_values("distancia_vial_m").head(8)
    else:
        accesibilidad = {"estado_red": "sin_red"}
        cercanas = pd.DataFrame()
    avisos = []
    if not r["dentro_area_estudio"]:
        avisos.append("El punto está fuera del área de estudio: KNN extrapola y la zona asignada no es confiable.")
    if geo["distrito"] is None:
        avisos.append("No hay información geográfica suficiente para asignar un distrito.")
    if accesibilidad.get("estado_red") != "ok":
        avisos.append("El punto está fuera de la red vial descargada; no se calcularon distancias por calle.")
    return _limpio({
        "nombre": p.nombre or "Punto nuevo",
        **r,
        "distrito": geo["distrito"], "municipio": geo["municipio"], "departamento": geo["departamento"],
        "poblacion_2024": geo["poblacion_2024"], "fuente_distrito": geo["fuente_distrito"],
        "nota_poblacion": geo["nota_poblacion"],
        **accesibilidad,
        "rutas_cercanas": _registros(cercanas) if len(cercanas) else [],
        "avisos": avisos,
        "tipo_resultado": "Clasificación geográfica; no es una predicción de ventas",
    })


@app.get("/api/fuentes", tags=["Datos"], summary="Fuentes, indicadores del área")
def obtener_fuentes():
    e = _requiere()
    return {
        "fuentes": _registros(e.fuentes) if e.fuentes is not None else [],
        "indicadores": _registros(e.indicadores),
        "censo": _registros(e.censo.drop(columns=["clave"])),
        "limitaciones": [
            "La población es residente por distrito; no equivale a compradores potenciales.",
            "Los establecimientos provienen de OpenStreetMap y no todos están verificados.",
            "No existe información pública de ventas de Porsche en El Salvador.",
            "Las distancias por calle no incluyen tráfico ni tiempos de viaje.",
            "El Porsche Center actual está en Antiguo Cuscatlán, fuera de la red vial descargada.",
            "Grupo Q, distribuidor de Porsche, también aparece como establecimiento en OSM.",
        ],
        "descargas": [n for n, p in DESCARGABLES.items() if p.exists()],
    }


@app.get("/api/geo/{capa}", tags=["Datos"], summary="Capas GeoJSON para el mapa")
def obtener_capa(capa: Literal["limites", "red-vial", "area-estudio"]):
    archivo = {"limites": "limites_distritos.geojson", "red-vial": "red_vial.geojson",
               "area-estudio": "area_estudio.geojson"}[capa]
    ruta = config.RESULTADOS / archivo
    if not ruta.exists():
        raise HTTPException(404, f"No existe {archivo}; ejecute python ejecutar.py")
    return FileResponse(ruta, media_type="application/geo+json")


@app.get("/api/descargas/{archivo}", tags=["Datos"], summary="Descargar un archivo del proyecto")
def descargar(archivo: str):
    ruta = DESCARGABLES.get(archivo)
    if ruta is None:
        raise HTTPException(404, "Archivo no disponible para descarga")
    if not ruta.exists():
        raise HTTPException(404, "El archivo aún no se ha generado")
    return FileResponse(ruta, filename=archivo)


@app.post("/api/modelo/actualizar", tags=["General"], summary="Recalcular el análisis de forma controlada")
def actualizar_modelo():
    """Vuelve a ejecutar K-Means, KNN, censo y red vial con los datos actuales.

    Está desactivado salvo que HOTSPOTS_PERMITIR_ACTUALIZAR=1.
    """
    if os.getenv("HOTSPOTS_PERMITIR_ACTUALIZAR") != "1":
        raise HTTPException(403, "Actualización desactivada. Defina HOTSPOTS_PERMITIR_ACTUALIZAR=1 para habilitarla.")
    e = _requiere()
    if not e.bloqueo.acquire(blocking=False):
        raise HTTPException(409, "Ya hay una actualización en curso")
    try:
        modelo.ejecutar()
        mercado.ejecutar()
        e.cargar()
    finally:
        e.bloqueo.release()
    return {"actualizado": True, "cargado_en": e.cargado}
