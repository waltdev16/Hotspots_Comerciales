"""Pruebas de la API. Ejecutar desde backend/:  python -m pytest -q"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import api  # noqa: E402


@pytest.fixture(scope="module")
def cliente():
    with TestClient(api.app) as c:
        yield c


def test_estado(cliente):
    r = cliente.get("/api/estado")
    assert r.status_code == 200
    d = r.json()
    assert d["modelo_knn"] and d["red_vial"] and d["limites_opamss"]


def test_resumen(cliente):
    d = cliente.get("/api/resumen").json()
    assert d["establecimientos_analizados"] == 30
    assert d["establecimientos_entrenamiento"] == 21
    assert d["clusters"] == 2
    assert d["poblacion"]["distrito_san_salvador"] == 330543
    assert d["poblacion"]["municipio_san_salvador_centro"] == 673319


def test_concesionarios_filtro(cliente):
    d = cliente.get("/api/concesionarios", params={"estado": "pendiente_revision"}).json()
    assert d["total"] == 6
    assert cliente.get("/api/concesionarios", params={"estado": "otro"}).status_code == 422


def test_clusters_y_centroides(cliente):
    d = cliente.get("/api/clusters").json()
    assert d["k"] == 2 and len(d["grupos"]) == 2
    assert sum(len(g["miembros"]) for g in d["grupos"]) == 21
    assert set(d["estabilidad_knn"]["C"].values()) == {"Zona 1"}
    c = cliente.get("/api/centroides").json()
    assert {x["zona"] for x in c} == {"Zona 1", "Zona 2"}


def test_ubicaciones(cliente):
    d = cliente.get("/api/ubicaciones").json()
    assert [u["id"] for u in d] == ["A", "B", "C"]
    zonas = {u["id"]: u["zona_knn"] for u in d}
    assert zonas == {"A": "Zona 1", "B": "Zona 2", "C": "Zona 1"}
    b = cliente.get("/api/ubicaciones/b").json()
    assert b["distrito"] == "San Salvador"
    assert b["competidor_vial_mas_cercano_m"] == pytest.approx(172.0, abs=0.1)
    assert cliente.get("/api/ubicaciones/Z").status_code == 404


def test_punto_nuevo_igual_a_ubicacion_a(cliente):
    r = cliente.post("/api/analizar-ubicacion", json={"latitud": 13.70, "longitud": -89.22})
    assert r.status_code == 200
    d = r.json()
    assert d["zona_knn"] == "Zona 1" and d["concesionarios_1km"] == 5
    assert d["distrito"] == "San Salvador" and d["estado_red"] == "ok"
    assert d["competidor_vial_mas_cercano_m"] == pytest.approx(811.9, abs=0.1)


def test_punto_fuera_de_red_y_area(cliente):
    # Santa Tecla: dentro de OPAMSS, fuera de la red vial y del área de estudio.
    d = cliente.post("/api/analizar-ubicacion", json={"latitud": 13.675, "longitud": -89.29}).json()
    assert d["distrito"] == "Santa Tecla"
    assert d["dentro_area_estudio"] is False
    assert d["estado_red"] == "punto_lejos_de_red"
    assert len(d["avisos"]) >= 2


def test_punto_fuera_de_cobertura(cliente):
    r = cliente.post("/api/analizar-ubicacion", json={"latitud": 14.5, "longitud": -88.0})
    assert r.status_code == 422


def test_entradas_invalidas(cliente):
    assert cliente.post("/api/analizar-ubicacion", json={"latitud": 120, "longitud": -89}).status_code == 422
    assert cliente.post("/api/analizar-ubicacion", json={"latitud": "abc"}).status_code == 422
def test_fuentes_geo_descargas(cliente):
    d = cliente.get("/api/fuentes").json()
    assert len(d["fuentes"]) >= 8 and "centroides.csv" in d["descargas"]
    assert cliente.get("/api/geo/limites").status_code == 200
    assert cliente.get("/api/geo/red-vial").status_code == 200
    assert cliente.get("/api/geo/otra").status_code == 422
    assert cliente.get("/api/descargas/centroides.csv").status_code == 200
    assert cliente.get("/api/descargas/..%2Fapi.py").status_code == 404


def test_actualizar_desactivado(cliente):
    assert cliente.post("/api/modelo/actualizar").status_code == 403


def test_cors(cliente):
    r = cliente.options("/api/estado", headers={"Origin": "http://localhost:5173",
                                                "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
    r = cliente.options("/api/estado", headers={"Origin": "http://otro.com",
                                                "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers
