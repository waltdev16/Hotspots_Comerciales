"""K-Means y KNN sobre los concesionarios de OpenStreetMap."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from pyproj import Transformer
from shapely.geometry import MultiPoint, Point, mapping
import shapely
from sklearn.cluster import KMeans
from sklearn.metrics import accuracy_score, silhouette_score
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.neighbors import KNeighborsClassifier, NearestNeighbors

import config
from config import logger

A_METROS = Transformer.from_crs(config.CRS_GRADOS, config.CRS_METROS, always_xy=True)
A_GRADOS = Transformer.from_crs(config.CRS_METROS, config.CRS_GRADOS, always_xy=True)

SEMILLA = 42
UMBRAL_NUCLEO_M = 5000
MARGEN_AREA_ESTUDIO_M = 1500
RADIOS_M = (500, 1000, 2000)
ARCHIVO_MODELO = "modelo_knn.joblib"

# Exclusión verificada por el equipo en Google Maps: es solo taller mecánico.
EXCLUSIONES_CONFIRMADAS = {
    "way/396970466": ("Total Auto Service",
                      "Taller de mantenimiento y reparación, no concesionario",
                      "Verificación manual del equipo en Google Maps"),
}
# Registros que podrían no vender automóviles; quedan fuera hasta verificarlos.
REVISION_PENDIENTE = {
    "way/140081410": "Maquinaria CAT: verificar venta de automóviles",
    "way/379809036": "CrediQ: verificar que esta sede venda vehículos y no solo financie",
    "way/398429634": "Taller Excel Automotriz: posible taller",
    "node/1535514013": "ASESUISA: posible aseguradora",
    "node/4272635495": "Yamaha Roosevelt: verificar si vende automóviles o motocicletas",
    "node/4594501891": "TNT EXPRESS: posible servicio de logística",
}


def leer_concesionarios() -> tuple[pd.DataFrame, dict]:
    crudo = json.loads(config.CONCESIONARIOS.read_text(encoding="utf-8"))
    filas = []
    sin_geometria = 0
    for i, f in enumerate(crudo.get("features", [])):
        geo = f.get("geometry") or {}
        props = f.get("properties") or {}
        coords = geo.get("coordinates") or []
        if geo.get("type") != "Point" or len(coords) < 2:
            sin_geometria += 1
            continue
        oid = str(f.get("id") or props.get("@id") or f"feature_{i}")
        nombre = props.get("name")
        motivo, evidencia = "", ""
        if oid in EXCLUSIONES_CONFIRMADAS:
            nombre, motivo, evidencia = EXCLUSIONES_CONFIRMADAS[oid]
            estado = "excluido_confirmado"
        elif oid in REVISION_PENDIENTE:
            motivo = REVISION_PENDIENTE[oid]
            estado = "pendiente_revision"
        else:
            estado = "sin_alerta"  # No significa verificado externamente.
        filas.append({
            "osm_id": oid, "name": nombre, "category": props.get("shop"),
            "brand": props.get("brand"), "street": props.get("addr:street"),
            "latitude": coords[1], "longitude": coords[0],
            "municipality": props.get("addr:city"), "estado": estado,
            "motivo": motivo, "fuente_verificacion": evidencia,
        })
    df = pd.DataFrame(filas)
    leidos = len(df)
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df.dropna(subset=["latitude", "longitude"])
    df = df[df.latitude.between(-90, 90) & df.longitude.between(-180, 180)]
    df = df.drop_duplicates(subset=["osm_id"])
    df = df.drop_duplicates(subset=["latitude", "longitude"]).reset_index(drop=True)
    if len(df) < 8:
        raise ValueError("No hay suficientes puntos válidos para analizar.")
    # Proyectamos una sola vez a metros (UTM 16N).
    x, y = A_METROS.transform(df.longitude.to_numpy(), df.latitude.to_numpy())
    df["x_m"], df["y_m"] = x, y
    meta = {
        "fuente": "OpenStreetMap vía Overpass Turbo",
        "fecha_extraccion": crudo.get("timestamp"),
        "registros_geojson": len(crudo.get("features", [])),
        "registros_leidos": leidos,
        "sin_geometria": sin_geometria,
        "registros_validos": int(len(df)),
        "invalidos_o_duplicados": int(leidos - len(df)),
    }
    return df, meta


def _evaluar_k(X: np.ndarray) -> list[dict]:
    opciones = []
    for k in range(2, min(6, len(X) - 1) + 1):
        km = KMeans(n_clusters=k, random_state=SEMILLA, n_init=20).fit(X)
        tam = np.bincount(km.labels_, minlength=k)
        opciones.append({"k": k, "silhouette": float(silhouette_score(X, km.labels_)),
                         "inercia": float(km.inertia_), "min_cluster_size": int(tam.min())})
    return opciones


def _evaluar_knn(X: np.ndarray, etiquetas: np.ndarray) -> list[dict]:
    # Acuerdo leave-one-out entre KNN y las etiquetas de K-Means para varios k.
    filas = []
    for k in range(1, min(9, len(X) - 1) + 1, 2):
        pred = cross_val_predict(KNeighborsClassifier(n_neighbors=k), X, etiquetas, cv=LeaveOneOut())
        filas.append({"k": k, "acuerdo_loo": float(accuracy_score(etiquetas, pred))})
    return filas


def entrenar(df: pd.DataFrame, incluir_revision: bool = False) -> dict:
    mascara = df.estado.ne("excluido_confirmado")
    if not incluir_revision:
        mascara &= df.estado.ne("pendiente_revision")
    elegibles = df[mascara].copy()
    # Filtro geométrico exploratorio: 5 km desde la mediana (no es un límite administrativo).
    XY = elegibles[["x_m", "y_m"]].to_numpy(dtype=float)
    mediana = np.median(XY, axis=0)
    elegibles["distance_to_median_m"] = np.linalg.norm(XY - mediana, axis=1)
    elegibles["in_nucleo"] = elegibles.distance_to_median_m <= UMBRAL_NUCLEO_M
    nucleo = elegibles[elegibles.in_nucleo].copy()
    if len(nucleo) < 7:
        raise ValueError("Muy pocos puntos en el núcleo para K-Means y KNN.")
    X = nucleo[["x_m", "y_m"]].to_numpy(dtype=float)

    opciones = _evaluar_k(X)
    validas = [o for o in opciones if o["min_cluster_size"] >= 3] or \
              [o for o in opciones if o["min_cluster_size"] >= 2]
    if not validas:
        raise ValueError("No hay suficientes puntos por cluster.")
    elegido = max(validas, key=lambda o: o["silhouette"])
    K = elegido["k"]
    km = KMeans(n_clusters=K, random_state=SEMILLA, n_init=20).fit(X)

    # Numeramos las zonas de oeste a este para que sean estables.
    orden = sorted(range(K), key=lambda j: km.cluster_centers_[j][0])
    renumerar = {viejo: i + 1 for i, viejo in enumerate(orden)}
    nucleo["zona_num"] = [renumerar[int(e)] for e in km.labels_]
    nucleo["zona"] = "Zona " + nucleo.zona_num.astype(str)
    etiquetas = nucleo.zona.to_numpy()

    knn_k = min(3, len(nucleo) - 1)
    knn = KNeighborsClassifier(n_neighbors=knn_k).fit(X, etiquetas)
    evaluacion_knn = _evaluar_knn(X, etiquetas)
    acuerdo = next(e["acuerdo_loo"] for e in evaluacion_knn if e["k"] == knn_k)

    centroides = []
    for viejo in orden:
        cx, cy = km.cluster_centers_[viejo]
        lon, lat = A_GRADOS.transform(cx, cy)
        miembros = X[km.labels_ == viejo]
        dist = np.linalg.norm(miembros - km.cluster_centers_[viejo], axis=1)
        centroides.append({
            "zona": f"Zona {renumerar[viejo]}", "latitude": float(lat), "longitude": float(lon),
            "count": int(len(miembros)), "radio_medio_m": round(float(dist.mean()), 1),
            "radio_max_m": round(float(dist.max()), 1),
        })

    # Área de estudio: envolvente de los puntos de entrenamiento más un margen.
    area_m = MultiPoint([tuple(p) for p in X]).convex_hull.buffer(MARGEN_AREA_ESTUDIO_M)
    area = shapely.transform(area_m, lambda c: np.column_stack(A_GRADOS.transform(c[:, 0], c[:, 1])))

    return {
        "nucleo": nucleo, "elegibles": elegibles, "knn": knn, "knn_k": knn_k, "X": X,
        "kmeans_k": K, "silhouette": elegido["silhouette"], "evaluacion_kmeans": opciones,
        "evaluacion_knn": evaluacion_knn, "acuerdo_loo": acuerdo, "centroides": centroides,
        "area_estudio_m": area_m, "area_estudio": area, "incluir_revision": incluir_revision,
    }


# Clasificamos un punto con KNN y medimos la competencia en línea recta.
def clasificar_punto(lat: float, lon: float, modelo: dict) -> dict:
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError(f"Coordenadas fuera de rango: {lat}, {lon}")
    nucleo, X, knn = modelo["nucleo"], modelo["X"], modelo["knn"]
    ex, ny = A_METROS.transform(lon, lat)
    punto = np.array([[ex, ny]])
    dist_todos = np.linalg.norm(X - punto, axis=1)
    orden = np.argsort(dist_todos)
    knn_dist, knn_idx = knn.kneighbors(punto, n_neighbors=modelo["knn_k"])
    zona = str(knn.predict(punto)[0])
    probas = dict(zip(knn.classes_, knn.predict_proba(punto)[0]))
    vecinos = []
    for d, ix in zip(knn_dist[0], knn_idx[0]):
        p = nucleo.iloc[int(ix)]
        vecinos.append({"osm_id": p.osm_id, "name": p["name"], "zona": p.zona,
                        "distance_m": round(float(d), 1),
                        "latitude": float(p.latitude), "longitude": float(p.longitude)})
    cercanos = []
    for ix in orden[:5]:
        p = nucleo.iloc[int(ix)]
        cercanos.append({"osm_id": p.osm_id, "name": p["name"], "zona": p.zona,
                         "distance_m": round(float(dist_todos[ix]), 1)})
    dentro = bool(modelo["area_estudio_m"].contains(Point(ex, ny)))
    mas_cercano = nucleo.iloc[int(orden[0])]
    return {
        "latitude": lat, "longitude": lon, "zona_knn": zona,
        "proporcion_vecinos_zona": round(float(probas[zona]), 3),
        "dentro_area_estudio": dentro,
        "concesionarios_500m": int((dist_todos <= 500).sum()),
        "concesionarios_1km": int((dist_todos <= 1000).sum()),
        "concesionarios_2km": int((dist_todos <= 2000).sum()),
        "distancia_mas_cercano_m": round(float(dist_todos[orden[0]]), 1),
        "distancia_tercer_vecino_m": round(float(knn_dist[0][-1]), 1),
        "establecimiento_mas_cercano": mas_cercano["name"],
        "vecinos_knn": vecinos, "cercanos": cercanos,
    }


def leer_ubicaciones(ruta=None) -> pd.DataFrame:
    ubic = pd.read_csv(ruta or config.UBICACIONES, encoding="utf-8-sig")
    necesarias = {"id", "nombre", "latitude", "longitude"}
    if not necesarias.issubset(ubic.columns):
        raise ValueError(f"El CSV de ubicaciones debe contener: {sorted(necesarias)}")
    ubic["id"] = ubic["id"].astype(str)
    if ubic.id.duplicated().any() or ubic.nombre.duplicated().any():
        raise ValueError("Los identificadores y nombres de ubicaciones deben ser únicos.")
    ubic["latitude"] = pd.to_numeric(ubic.latitude, errors="raise")
    ubic["longitude"] = pd.to_numeric(ubic.longitude, errors="raise")
    return ubic


# Clasificamos las ubicaciones propuestas.
def analizar_ubicaciones(ubic: pd.DataFrame, modelo: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    filas, vecinos = [], []
    for u in ubic.itertuples(index=False):
        r = clasificar_punto(float(u.latitude), float(u.longitude), modelo)
        for v in r.pop("vecinos_knn"):
            vecinos.append({"id": u.id, "candidato": u.nombre, **v})
        r.pop("cercanos")
        filas.append({"id": u.id, "nombre": u.nombre, **r,
                      "observacion": "Distancias en línea recta; conteos OSM, no demanda ni vialidad"})
    return pd.DataFrame(filas), pd.DataFrame(vecinos)


# Comprobamos si la zona de cada ubicación cambia al usar otro número de vecinos.
def estabilidad_knn(ubic: pd.DataFrame, modelo: dict) -> dict:
    X, etiquetas = modelo["X"], modelo["nucleo"].zona.to_numpy()
    puntos = np.column_stack(A_METROS.transform(ubic.longitude.to_numpy(), ubic.latitude.to_numpy()))
    resultado = {str(i): {} for i in ubic.id}
    for fila in modelo["evaluacion_knn"]:
        k = fila["k"]
        pred = KNeighborsClassifier(n_neighbors=k).fit(X, etiquetas).predict(puntos)
        for i, z in zip(ubic.id, pred):
            resultado[str(i)][str(k)] = str(z)
    return resultado


def resumen_modelo(df: pd.DataFrame, meta: dict, modelo: dict) -> dict:
    return {
        **meta,
        "fecha_calculo": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "excluidos_confirmados": df[df.estado == "excluido_confirmado"][["osm_id", "name", "motivo"]].to_dict("records"),
        "pendientes_revision": int((df.estado == "pendiente_revision").sum()),
        "incluye_registros_dudosos": bool(modelo["incluir_revision"]),
        "registros_entrenamiento": int(len(modelo["nucleo"])),
        "perifericos_elegibles": int(len(modelo["elegibles"]) - len(modelo["nucleo"])),
        "umbral_nucleo_m": UMBRAL_NUCLEO_M,
        "semilla": SEMILLA,
        "kmeans_k": modelo["kmeans_k"],
        "silhouette_elegido": modelo["silhouette"],
        "criterio_k": "Mayor silhouette entre k con al menos 3 establecimientos por grupo",
        "evaluacion_kmeans": modelo["evaluacion_kmeans"],
        "centroides": modelo["centroides"],
        "knn_k": modelo["knn_k"],
        "evaluacion_knn": modelo["evaluacion_knn"],
        "acuerdo_loo_con_etiquetas_kmeans": modelo["acuerdo_loo"],
        "estabilidad_knn": modelo.get("estabilidad_knn", {}),
        "advertencias": [
            "KNN aprende etiquetas derivadas de K-Means; no predice ventas ni idoneidad comercial.",
            "El acuerdo leave-one-out mide coherencia con K-Means, no precisión comercial.",
            "Las etiquetas sin_alerta no significan negocios verificados.",
            "Fuera del área de estudio KNN extrapola; el resultado se marca como no confiable.",
            "Las distancias UTM son en línea recta; no son tiempos de desplazamiento.",
            "El filtro de 5 km es exploratorio, no el límite administrativo de San Salvador.",
        ],
    }


# Guardamos los resultados del modelo.
def guardar(df, meta, modelo, comparacion, vecinos) -> dict:
    out = config.asegurar_resultados()
    nucleo = modelo["nucleo"]
    auditoria = df.merge(nucleo[["osm_id", "zona"]], on="osm_id", how="left")
    auditoria["usado_entrenamiento"] = auditoria.osm_id.isin(nucleo.osm_id)
    auditoria["detalle_dataset"] = np.select(
        [auditoria.estado == "excluido_confirmado", auditoria.estado == "pendiente_revision",
         auditoria.usado_entrenamiento],
        ["Excluido por actividad verificada", "Revisión comercial pendiente", "Incluido"],
        default="Fuera de núcleo 5 km")
    auditoria.to_csv(out / "auditoria_osm.csv", index=False, encoding="utf-8-sig")
    nucleo.to_csv(out / "concesionarios_entrenamiento.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(modelo["centroides"]).to_csv(out / "centroides.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(modelo["evaluacion_kmeans"]).to_csv(out / "evaluacion_kmeans.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(modelo["evaluacion_knn"]).to_csv(out / "evaluacion_knn.csv", index=False, encoding="utf-8-sig")
    comparacion.to_csv(out / "comparacion_ubicaciones.csv", index=False, encoding="utf-8-sig")
    vecinos.to_csv(out / "vecinos_knn.csv", index=False, encoding="utf-8-sig")
    (out / "area_estudio.geojson").write_text(json.dumps({
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "properties": {"nombre": "Área de estudio KNN",
                      "margen_m": MARGEN_AREA_ESTUDIO_M}, "geometry": mapping(modelo["area_estudio"])}],
    }), encoding="utf-8")
    # El modelo entrenado se reutiliza en la API sin recalcular K-Means.
    joblib.dump({k: modelo[k] for k in ("nucleo", "knn", "knn_k", "X", "kmeans_k", "centroides",
                                        "area_estudio_m", "acuerdo_loo", "incluir_revision")},
                out / ARCHIVO_MODELO)
    resumen = resumen_modelo(df, meta, modelo)
    (out / "resumen.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
    return resumen


def cargar_modelo() -> dict:
    ruta = config.RESULTADOS / ARCHIVO_MODELO
    if not ruta.exists():
        raise FileNotFoundError("No existe el modelo entrenado; ejecuta python ejecutar.py")
    return joblib.load(ruta)


def ejecutar(incluir_revision: bool = False, punto: tuple[float, float] | None = None) -> dict:
    df, meta = leer_concesionarios()
    logger.info(f"Datos cargados ({meta['registros_validos']} establecimientos OSM)")
    modelo = entrenar(df, incluir_revision)
    logger.info(f"Limpieza completada ({len(modelo['nucleo'])} para entrenamiento, "
                f"{int((df.estado == 'excluido_confirmado').sum())} excluido, "
                f"{int((df.estado == 'pendiente_revision').sum())} pendientes de revisión)")
    logger.info(f"K-Means ejecutado (k = {modelo['kmeans_k']}, silhouette = {modelo['silhouette']:.3f})")
    ubic = leer_ubicaciones()
    if punto is not None:
        ubic = pd.concat([ubic, pd.DataFrame([{"id": "P", "nombre": "Punto ingresado por consola",
                                               "latitude": punto[0], "longitude": punto[1]}])],
                         ignore_index=True)
    comparacion, vecinos = analizar_ubicaciones(ubic, modelo)
    modelo["estabilidad_knn"] = estabilidad_knn(ubic, modelo)
    resumen = guardar(df, meta, modelo, comparacion, vecinos)
    logger.info(f"KNN ejecutado (k = {modelo['knn_k']}, acuerdo LOO con K-Means = {modelo['acuerdo_loo']:.3f})")
    return {"df": df, "meta": meta, "modelo": modelo, "comparacion": comparacion,
            "vecinos": vecinos, "resumen": resumen}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="K-Means y KNN de concesionarios")
    parser.add_argument("--incluir-revision", action="store_true",
                        help="Incluir registros dudosos (análisis de sensibilidad)")
    parser.add_argument("--lat", type=float, help="Latitud de un punto adicional")
    parser.add_argument("--lon", type=float, help="Longitud de un punto adicional")
    parser.add_argument("--detalle", action="store_true", help="Mostrar mensajes adicionales")
    args = parser.parse_args()
    if (args.lat is None) != (args.lon is None):
        parser.error("--lat y --lon van juntos")
    config.configurar_consola(args.detalle)
    r = ejecutar(args.incluir_revision, (args.lat, args.lon) if args.lat is not None else None)
    columnas = ["id", "zona_knn", "dentro_area_estudio", "concesionarios_1km",
                "concesionarios_2km", "distancia_mas_cercano_m"]
    print()
    print(r["comparacion"][columnas].to_string(index=False))
