"""Pruebas de los módulos de análisis sin la API."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import mercado  # noqa: E402
import modelo  # noqa: E402


@pytest.fixture(scope="module")
def datos():
    df, meta = modelo.leer_concesionarios()
    return df, meta, modelo.entrenar(df)


def test_lectura_y_limpieza(datos):
    df, meta, _ = datos
    assert meta["registros_validos"] == 30
    assert (df.estado == "excluido_confirmado").sum() == 1
    assert df.osm_id.is_unique


def test_kmeans_reproducible(datos):
    df, _, m1 = datos
    m2 = modelo.entrenar(df)
    assert m1["kmeans_k"] == m2["kmeans_k"] == 2
    assert (m1["nucleo"].zona.to_numpy() == m2["nucleo"].zona.to_numpy()).all()
    assert [c["count"] for c in m1["centroides"]] == [9, 12]


def test_entrenamiento_sin_excluidos_ni_pendientes(datos):
    df, _, m = datos
    estados = df.set_index("osm_id").loc[m["nucleo"].osm_id, "estado"]
    assert set(estados) == {"sin_alerta"}


def test_sensibilidad_con_revision(datos):
    df, _, _ = datos
    m = modelo.entrenar(df, incluir_revision=True)
    assert len(m["nucleo"]) > 21


def test_knn_y_coordenadas_invalidas(datos):
    _, _, m = datos
    r = modelo.clasificar_punto(13.713, -89.225, m)
    assert r["zona_knn"] == "Zona 1" and r["establecimiento_mas_cercano"] == "HS Import's"
    with pytest.raises(ValueError):
        modelo.clasificar_punto(200, 0, m)


def test_proyeccion_utm():
    # 0.01 grados de latitud son ~1.1 km en San Salvador.
    x1, y1 = modelo.A_METROS.transform(-89.22, 13.70)
    x2, y2 = modelo.A_METROS.transform(-89.22, 13.71)
    assert 1100 < np.hypot(x2 - x1, y2 - y1) < 1110


def test_distrito_por_union_espacial():
    censo = mercado.cargar_censo()
    distritos = mercado.cargar_distritos()
    pts = pd.DataFrame([{"nombre": "x", "latitude": 13.70, "longitude": -89.22},
                        {"nombre": "y", "latitude": 13.50, "longitude": -88.90}])
    r = mercado.asignar_distrito(pts, distritos, censo)
    assert r.iloc[0].distrito == "San Salvador" and r.iloc[0].poblacion_2024 == 330543
    assert r.iloc[1].distrito is None


def test_distrito_sin_poligonos_usa_verificados():
    censo = mercado.cargar_censo()
    ubic = modelo.leer_ubicaciones()
    r = mercado.asignar_distrito(ubic, None, censo)
    assert (r.distrito == "San Salvador").all()
    movido = ubic.copy()
    movido.loc[0, "latitude"] += 0.01
    r = mercado.asignar_distrito(movido, None, censo)
    assert r.iloc[0].distrito is None


def test_red_no_se_descarga_si_falta(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "RED_VIAL", tmp_path / "no_existe.graphml")
    assert mercado.cargar_red(descargar=False) is None
