"""Une el modelo con el Censo 2024, los límites OPAMSS y la red vial."""
from __future__ import annotations

import base64
import argparse
import json
import math
import os
import unicodedata
from html import escape

import folium
import numpy as np
import pandas as pd
from pyproj import Transformer

import config
from config import logger

A_METROS = Transformer.from_crs(config.CRS_GRADOS, config.CRS_METROS, always_xy=True)
MAX_SNAP_M = 1000
RADIOS_VIALES_M = (1000, 2000)
COLUMNAS_RUTAS = ["id", "ubicacion", "osm_id", "competidor", "distancia_vial_m",
                  "distancia_recta_m", "distancia_snap_origen_m", "distancia_snap_destino_m", "estado_ruta"]
PALETA = ["#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#22d3ee", "#f472b6"]


def normalizar(valor) -> str:
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return ""
    texto = unicodedata.normalize("NFKD", str(valor).strip().upper())
    return "".join(c for c in texto if not unicodedata.combining(c))


# Leemos el Censo 2024 por distrito.
def cargar_censo() -> pd.DataFrame:
    censo = pd.read_csv(config.CENSO, encoding="utf-8-sig", dtype={"codigo_distrito": str})
    censo["clave"] = censo.distrito.map(normalizar)
    if censo.clave.duplicated().any():
        raise ValueError("Nombres de distrito duplicados en el censo")
    return censo


# Leemos los polígonos OPAMSS y los unimos por distrito.
def cargar_distritos():
    if not config.DISTRITOS.exists():
        return None
    import geopandas as gpd
    geo = gpd.read_file(config.DISTRITOS)
    if not {"distritos", "nom_dpto", "geometry"}.issubset(geo.columns):
        raise ValueError("El GeoJSON OPAMSS no contiene los campos esperados")
    geo = geo.dropna(subset=["geometry"])
    geo = geo.set_crs(config.CRS_GRADOS) if geo.crs is None else geo.to_crs(config.CRS_GRADOS)
    geo["clave"] = geo.distritos.map(normalizar)
    geo["departamento_geo"] = geo.nom_dpto.str.title()
    geo["municipio_geo"] = geo.mun_nuevos.str.title()
    # Apopa aparece en dos polígonos; se disuelven para evitar asignaciones dobles.
    return geo[["clave", "departamento_geo", "municipio_geo", "geometry"]].dissolve(by="clave", as_index=False,
                                                                                    aggfunc="first")


def asignar_distrito(puntos: pd.DataFrame, distritos, censo: pd.DataFrame) -> pd.DataFrame:
    """Añade distrito, municipio, departamento y población a cada punto."""
    out = puntos.copy()
    for col in ("distrito", "municipio", "departamento"):
        out[col] = None
    out["poblacion_2024"] = np.nan
    out["fuente_distrito"] = "Sin información geográfica suficiente"
    if distritos is not None:
        import geopandas as gpd
        pts = gpd.GeoDataFrame(out[["latitude", "longitude"]].copy(),
                               geometry=gpd.points_from_xy(out.longitude, out.latitude), crs=config.CRS_GRADOS)
        unido = gpd.sjoin(pts, distritos, how="left", predicate="within")
        for idx, grupo in unido.groupby(level=0):
            claves = grupo["clave"].dropna().unique()
            if len(claves) == 1:
                fila = censo[censo.clave == claves[0]]
                if len(fila):
                    out.loc[idx, ["distrito", "municipio", "departamento"]] = \
                        fila.iloc[0][["distrito", "municipio", "departamento"]].to_list()
                    out.loc[idx, "poblacion_2024"] = int(fila.iloc[0].poblacion_2024)
                    out.loc[idx, "fuente_distrito"] = "OPAMSS: unión espacial por coordenadas"
                else:
                    g = grupo.iloc[0]
                    out.loc[idx, ["distrito", "municipio", "departamento"]] = \
                        [claves[0].title(), g.municipio_geo, g.departamento_geo]
                    out.loc[idx, "fuente_distrito"] = "OPAMSS: distrito sin dato censal en el archivo"
            elif len(claves) > 1:
                out.loc[idx, "fuente_distrito"] = "Conflicto: polígonos superpuestos"
    elif config.DISTRITOS_VERIFICADOS.exists() and "nombre" in out.columns:
        # Sin polígonos se usan solo las asignaciones verificadas de A, B y C originales.
        manual = pd.read_csv(config.DISTRITOS_VERIFICADOS, encoding="utf-8-sig")
        originales = pd.read_csv(config.UBICACIONES, encoding="utf-8-sig")
        for r in manual.itertuples():
            o = originales[originales.nombre == r.nombre]
            m = out.nombre == r.nombre
            if len(o) == 1 and m.sum() == 1 and \
                    np.isclose(o.iloc[0].latitude, out.loc[m, "latitude"].iloc[0]) and \
                    np.isclose(o.iloc[0].longitude, out.loc[m, "longitude"].iloc[0]):
                fila = censo[censo.clave == normalizar(r.distrito)].iloc[0]
                out.loc[m, ["distrito", "municipio", "departamento"]] = \
                    fila[["distrito", "municipio", "departamento"]].to_list()
                out.loc[m, "poblacion_2024"] = int(fila.poblacion_2024)
                out.loc[m, "fuente_distrito"] = "Unión espacial aportada por el equipo (solo A, B y C)"
    out["poblacion_2024"] = out["poblacion_2024"].astype("Int64")
    out["nota_poblacion"] = "Población de todo el distrito; no son personas en un radio ni compradores"
    return out


# Leemos la red vial guardada; solo se descarga si se pide y no existe.
def cargar_red(descargar: bool = False, puntos: pd.DataFrame | None = None):
    import osmnx as ox
    ox.settings.log_console = False
    if config.RED_VIAL.exists():
        return ox.io.load_graphml(config.RED_VIAL)
    if not descargar or puntos is None:
        return None
    margen = 0.02
    bbox = (puntos.longitude.min() - margen, puntos.latitude.min() - margen,
            puntos.longitude.max() + margen, puntos.latitude.max() + margen)
    G = ox.graph.graph_from_bbox(bbox=bbox, network_type="drive", simplify=True)
    ox.io.save_graphml(G, filepath=config.RED_VIAL)
    return G


class RedVial:
    """Red vial en memoria con los nodos de los concesionarios ya calculados."""

    def __init__(self, G, entrenamiento: pd.DataFrame):
        import osmnx as ox
        self.G = G
        self.ox = ox
        xs = [d["x"] for _, d in G.nodes(data=True)]
        ys = [d["y"] for _, d in G.nodes(data=True)]
        self.limites = (min(xs), min(ys), max(xs), max(ys))
        self.destinos = []
        for r in entrenamiento.itertuples(index=False):
            nodo, snap = self.nodo_cercano(r.longitude, r.latitude)
            self.destinos.append((r, nodo, snap))

    def nodo_cercano(self, lon: float, lat: float) -> tuple[int, float]:
        nodo = self.ox.distance.nearest_nodes(self.G, X=float(lon), Y=float(lat))
        x1, y1 = A_METROS.transform(float(lon), float(lat))
        x2, y2 = A_METROS.transform(self.G.nodes[nodo]["x"], self.G.nodes[nodo]["y"])
        return nodo, float(math.hypot(x2 - x1, y2 - y1))

    def dentro(self, lon: float, lat: float) -> bool:
        x0, y0, x1, y1 = self.limites
        return x0 <= lon <= x1 and y0 <= lat <= y1

    def rutas_desde(self, lat: float, lon: float, id_: str = "", nombre: str = "") -> pd.DataFrame:
        import networkx as nx
        filas = []
        origen, snap = self.nodo_cercano(lon, lat)
        fuera = not self.dentro(lon, lat) or snap > MAX_SNAP_M
        largos = {} if fuera else nx.single_source_dijkstra_path_length(self.G, origen, weight="length")
        xo, yo = A_METROS.transform(lon, lat)
        for r, destino, dsnap in self.destinos:
            xd, yd = A_METROS.transform(r.longitude, r.latitude)
            d = largos.get(destino)
            if fuera or dsnap > MAX_SNAP_M:
                estado = "punto_lejos_de_red"
            else:
                estado = "ok" if d is not None else "sin_ruta"
            filas.append({"id": id_, "ubicacion": nombre, "osm_id": r.osm_id, "competidor": r.name,
                          "distancia_vial_m": round(float(d), 1) if d is not None and estado == "ok" else np.nan,
                          "distancia_recta_m": round(math.hypot(xd - xo, yd - yo), 1),
                          "distancia_snap_origen_m": round(snap, 1),
                          "distancia_snap_destino_m": round(dsnap, 1), "estado_ruta": estado})
        return pd.DataFrame(filas, columns=COLUMNAS_RUTAS)


def resumir_rutas(rutas: pd.DataFrame) -> dict:
    ok = rutas[rutas.estado_ruta == "ok"].sort_values("distancia_vial_m")
    if ok.empty:
        estado = rutas.estado_ruta.iloc[0] if len(rutas) else "sin_red"
        return {"estado_red": estado, "competidores_con_ruta": 0, "competidores_ruta_1km": None,
                "competidores_ruta_2km": None, "competidor_vial_mas_cercano": None,
                "competidor_vial_mas_cercano_m": None, "indice_rodeo_medio": None}
    rodeo = (ok.distancia_vial_m / ok.distancia_recta_m.clip(lower=1)).median()
    return {
        "estado_red": "ok",
        "competidores_con_ruta": int(len(ok)),
        "competidores_ruta_1km": int((ok.distancia_vial_m <= 1000).sum()),
        "competidores_ruta_2km": int((ok.distancia_vial_m <= 2000).sum()),
        "competidor_vial_mas_cercano": ok.iloc[0].competidor,
        "competidor_vial_mas_cercano_m": round(float(ok.iloc[0].distancia_vial_m), 1),
        # Cociente distancia por calle / línea recta (mediana); 1.0 sería un trayecto recto.
        "indice_rodeo_medio": round(float(rodeo), 2),
    }


def leer_base() -> tuple[pd.DataFrame, ...]:
    out = config.RESULTADOS
    requeridos = ["auditoria_osm.csv", "concesionarios_entrenamiento.csv",
                  "comparacion_ubicaciones.csv", "vecinos_knn.csv", "centroides.csv"]
    faltan = [x for x in requeridos if not (out / x).exists()]
    if faltan:
        raise FileNotFoundError("Faltan resultados del modelo: " + ", ".join(faltan))
    leer = lambda n: pd.read_csv(out / n, encoding="utf-8-sig", dtype={"id": str})
    auditoria, entrenamiento = leer("auditoria_osm.csv"), leer("concesionarios_entrenamiento.csv")
    if (auditoria.loc[auditoria.osm_id.isin(entrenamiento.osm_id), "estado"] == "excluido_confirmado").any():
        raise ValueError("El entrenamiento contiene un negocio excluido")
    return auditoria, entrenamiento, leer("comparacion_ubicaciones.csv"), leer("vecinos_knn.csv"), leer("centroides.csv")


# Exportamos los límites y la red para el frontend y el notebook.
def exportar_geojson(distritos, G) -> None:
    out = config.asegurar_resultados()
    if distritos is not None:
        limites = distritos.copy()
        limites["nombre"] = limites.clave.str.title()
        limites["es_san_salvador"] = limites.clave == "SAN SALVADOR"
        # Simplificamos a unos 5 m para aligerar el archivo del navegador.
        limites["geometry"] = limites.geometry.simplify(0.00005, preserve_topology=True)
        limites[["nombre", "departamento_geo", "municipio_geo", "es_san_salvador", "geometry"]] \
            .rename(columns={"departamento_geo": "departamento", "municipio_geo": "municipio"}) \
            .to_file(out / "limites_distritos.geojson", driver="GeoJSON")
    if G is not None:
        lineas = []
        for u, v, d in G.edges(data=True):
            geom = d.get("geometry")
            coords = [[round(x, 6), round(y, 6)] for x, y in geom.coords] if geom is not None else \
                [[round(G.nodes[u]["x"], 6), round(G.nodes[u]["y"], 6)],
                 [round(G.nodes[v]["x"], 6), round(G.nodes[v]["y"], 6)]]
            lineas.append(coords)
        (out / "red_vial.geojson").write_text(json.dumps({
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": {},
                          "geometry": {"type": "MultiLineString", "coordinates": lineas}}],
        }), encoding="utf-8")


# Dibujamos el mapa HTML independiente del frontend.
def exportar_mapa(auditoria, entrenamiento, comparacion, centroides, distritos, G) -> bool:
    clave = os.getenv("CARTO_BASEMAP_KEY", "").strip()
    M = folium.Map(location=[13.70, -89.222], zoom_start=13, tiles=None, control_scale=True)
    carpeta = config.BASE.parent / "frontend" / "public" / "cartografia"
    bases = [("region", [[13.40,-89.56],[14.14,-88.88]]), ("ciudad", [[13.59,-89.36],[13.82,-89.06]])]
    for orden, (nombre, limites) in enumerate(bases, 1):
        archivo = carpeta / f"{nombre}.webp"
        if archivo.exists():
            imagen = "data:image/webp;base64," + base64.b64encode(archivo.read_bytes()).decode("ascii")
            folium.raster_layers.ImageOverlay(imagen, bounds=limites, pane="tilePane", zindex=orden,
                control=False, attr="© OpenStreetMap contributors · Geofabrik").add_to(M)
    if clave:
        url = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=" + clave
        folium.TileLayer(tiles=url, attr="© OpenStreetMap contributors · CARTO", name="CARTO",
                         max_zoom=20, z_index=5).add_to(M)
    folium.TileLayer("OpenStreetMap", name="Calles en línea", overlay=True,
                     z_index=6, show=not (carpeta / "ciudad.webp").exists()).add_to(M)
    if distritos is not None:
        ss = distritos[distritos.clave == "SAN SALVADOR"]
        folium.GeoJson(ss.__geo_interface__, name="Distrito de San Salvador",
                       style_function=lambda _x: {"color": "#93c5fd", "weight": 2, "fillOpacity": 0.04},
                       tooltip="Distrito de San Salvador (OPAMSS)").add_to(M)
    if G is not None:
        vias = folium.FeatureGroup(name="Red vial OSM", show=False)
        for u, v, d in G.edges(data=True):
            geom = d.get("geometry")
            coords = [(y, x) for x, y in geom.coords] if geom is not None else \
                [(G.nodes[u]["y"], G.nodes[u]["x"]), (G.nodes[v]["y"], G.nodes[v]["x"])]
            folium.PolyLine(coords, color="#64748b", weight=1, opacity=0.6, interactive=False).add_to(vias)
        vias.add_to(M)
    for n, z in enumerate(sorted(entrenamiento.zona.dropna().unique())):
        capa = folium.FeatureGroup(name=f"Concesionarios {z}")
        for r in entrenamiento[entrenamiento.zona == z].itertuples():
            folium.CircleMarker([r.latitude, r.longitude], radius=6, color=PALETA[n % len(PALETA)], fill=True,
                                fill_opacity=0.85, tooltip=escape(str(r.name))).add_to(capa)
        capa.add_to(M)
    excl = folium.FeatureGroup(name="No incluidos en K-Means", show=False)
    for r in auditoria[~auditoria.osm_id.isin(entrenamiento.osm_id)].itertuples():
        folium.CircleMarker([r.latitude, r.longitude], radius=5, color="#94a3b8", fill=True,
                            tooltip=escape(f"{r.name} — {r.detalle_dataset}")).add_to(excl)
    excl.add_to(M)
    cent = folium.FeatureGroup(name="Centroides K-Means")
    for c in centroides.itertuples():
        folium.Marker([c.latitude, c.longitude], tooltip=f"Centroide {c.zona}",
                      icon=folium.Icon(color="blue", icon="star")).add_to(cent)
    cent.add_to(M)
    prop = folium.FeatureGroup(name="Ubicaciones propuestas")
    for c in comparacion.itertuples():
        pob = f"{int(c.poblacion_2024):,}" if pd.notna(c.poblacion_2024) else "No disponible"
        html = (f"<b>{escape(str(c.nombre))}</b><br><b>Distrito:</b> {escape(str(c.distrito or 'No disponible'))}"
                f"<br><b>Población distrital 2024:</b> {pob}<br><b>Zona KNN:</b> {escape(str(c.zona_knn))}"
                f"<br><b>Concesionarios a 1 km (recta):</b> {c.concesionarios_1km}"
                f"<br><b>Competidor más cercano por calle:</b> "
                f"{'No disponible' if pd.isna(c.competidor_vial_mas_cercano_m) else f'{c.competidor_vial_mas_cercano_m:.0f} m'}"
                f"<br><i>No constituye predicción de ventas.</i>")
        folium.Marker([c.latitude, c.longitude], tooltip=escape(str(c.nombre)),
                      popup=folium.Popup(html, max_width=320), icon=folium.Icon(color="red", icon="flag")).add_to(prop)
    prop.add_to(M)
    puntos = pd.concat([entrenamiento, comparacion])[["latitude","longitude"]]
    M.fit_bounds([puntos.min().tolist(), puntos.max().tolist()], padding=(30,30))
    folium.LayerControl(collapsed=True).add_to(M)
    M.save(str(config.asegurar_resultados() / "mapa_mercado_integrado.html"))
    return bool(clave)


def ejecutar(sin_red: bool = False, descargar_red: bool = False) -> dict:
    auditoria, entrenamiento, comparacion, vecinos, centroides = leer_base()
    censo = cargar_censo()
    distritos = cargar_distritos()
    if distritos is None:
        logger.warning("No se encontró distritos_opamss.geojson; se usan solo distritos verificados")
    integrada = asignar_distrito(comparacion, distritos, censo)
    con_distrito = int(integrada.distrito.notna().sum())
    logger.info(f"Censo 2024 integrado ({con_distrito} de {len(integrada)} ubicaciones con distrito)")

    rutas = pd.DataFrame(columns=COLUMNAS_RUTAS)
    estado_red = "Omitida por solicitud"
    G = None
    if not sin_red:
        try:
            G = cargar_red(descargar_red, pd.concat([integrada, entrenamiento])[["latitude", "longitude"]])
            if G is None:
                logger.warning("No existe red_vial.graphml; use --descargar-red con conexión a Internet")
                estado_red = "No disponible: falta red_vial.graphml"
            else:
                red = RedVial(G, entrenamiento)
                rutas = pd.concat([red.rutas_desde(r.latitude, r.longitude, r.id, r.nombre)
                                   for r in integrada.itertuples()], ignore_index=True)
                estado_red = "Red vial OSMnx: distancia por calles desde nodos cercanos, sin tráfico"
                validas = int((rutas.estado_ruta == "ok").sum())
                logger.info(f"Red vial procesada ({validas} de {len(rutas)} rutas válidas)")
        except Exception as exc:  # La red es opcional; se informa el motivo real.
            logger.warning(f"No fue posible procesar la red vial: {str(exc)[:200]}")
            estado_red = "No disponible: " + str(exc)[:120]
    else:
        logger.warning("Red vial omitida por solicitud (--sin-red)")

    resumenes = pd.DataFrame([{"id": i, **resumir_rutas(rutas[rutas.id == i])} for i in integrada.id])
    integrada = integrada.merge(resumenes, on="id", how="left")
    out = config.asegurar_resultados()
    integrada.to_csv(out / "comparacion_mercado_integrada.csv", index=False, encoding="utf-8-sig")
    rutas.to_csv(out / "accesibilidad_competencia.csv", index=False, encoding="utf-8-sig")
    if not rutas.empty:
        (rutas[rutas.estado_ruta == "ok"].sort_values(["id", "distancia_vial_m"]).groupby("id").head(5)
         .to_csv(out / "top5_competidores_viales.csv", index=False, encoding="utf-8-sig"))
    columnas = ["id", "nombre", "distrito", "poblacion_2024", "zona_knn", "concesionarios_500m",
                "concesionarios_1km", "concesionarios_2km", "distancia_mas_cercano_m", "competidores_ruta_2km",
                "competidor_vial_mas_cercano_m", "competidores_con_ruta"]
    integrada[columnas].to_csv(out / "resumen_comparativo.csv", index=False, encoding="utf-8-sig")
    exportar_geojson(distritos, G)
    exportar_mapa(auditoria, entrenamiento, integrada, centroides, distritos, G)
    logger.info("Mapa actualizado (resultados/mapa_mercado_integrado.html)")
    (out / "estado_integracion.json").write_text(json.dumps({
        "originales": int(len(auditoria)), "entrenamiento": int(len(entrenamiento)),
        "censo": "Censo BCR 2024 por distrito", "distritos_asignados": con_distrito,
        "accesibilidad": estado_red, "rutas_validas": int((rutas.estado_ruta == "ok").sum()),
        "competencia": "Establecimientos shop=car filtrados; no todos verificados ni del segmento de lujo",
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"integrada": integrada, "rutas": rutas, "red_ok": G is not None}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Censo, red vial y mapa")
    parser.add_argument("--sin-red", action="store_true", help="No calcular la red vial")
    parser.add_argument("--descargar-red", action="store_true",
                        help="Descargar la red con OSMnx si no existe una copia local")
    parser.add_argument("--detalle", action="store_true")
    args = parser.parse_args()
    config.configurar_consola(args.detalle)
    r = ejecutar(args.sin_red, args.descargar_red)
    print()
    print(r["integrada"][["id", "distrito", "poblacion_2024", "zona_knn", "competidores_ruta_2km",
                          "competidor_vial_mas_cercano_m"]].to_string(index=False))
