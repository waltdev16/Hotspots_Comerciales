"""Rutas del proyecto y configuración de la consola."""
from __future__ import annotations

import logging
import os
import sys
import warnings
from pathlib import Path

BASE = Path(__file__).resolve().parent
DATOS = BASE / "datos"
DATOS_CENSO = BASE / "datos_censo"
DATOS_GEO = BASE / "datos_geograficos"
RESULTADOS = Path(os.getenv("HOTSPOTS_RESULTADOS") or BASE / "resultados")
FUENTES = BASE.parent / "fuentes" / "fuentes_datos.csv"

CONCESIONARIOS = DATOS / "concesionarios.geojson"
UBICACIONES = DATOS / "ubicaciones_propuestas.csv"
INDICADORES = DATOS / "indicadores_mercado.csv"
DISTRITOS_VERIFICADOS = DATOS / "distritos_verificados.csv"
CENSO = DATOS_CENSO / "poblacion_2024.csv"
DISTRITOS = DATOS_GEO / "distritos_opamss.geojson"
RED_VIAL = DATOS_GEO / "red_vial.graphml"

# Sistemas de coordenadas: WGS84 para guardar y UTM 16N para medir en metros.
CRS_GRADOS = "EPSG:4326"
CRS_METROS = "EPSG:32616"

logger = logging.getLogger("hotspots")

_PREFIJOS = {
    logging.DEBUG: "  ·",
    logging.INFO: "[OK]",
    logging.WARNING: "[AVISO]",
    logging.ERROR: "[ERROR]",
    logging.CRITICAL: "[ERROR]",
}


class _Formato(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return f"{_PREFIJOS.get(record.levelno, '')} {record.getMessage()}"


def configurar_consola(detalle: bool = False) -> None:
    """Prepara una salida breve: [OK], [AVISO] y [ERROR]."""
    logger.handlers.clear()
    manejador = logging.StreamHandler(sys.stdout)
    manejador.setFormatter(_Formato())
    logger.addHandler(manejador)
    logger.setLevel(logging.DEBUG if detalle else logging.INFO)
    logger.propagate = False
    # Avisos internos de librerías que no afectan los resultados.
    warnings.filterwarnings("ignore", category=FutureWarning, module="osmnx")
    warnings.filterwarnings("ignore", category=UserWarning, module="osmnx")
    logging.getLogger("osmnx").setLevel(logging.WARNING)


def asegurar_resultados() -> Path:
    RESULTADOS.mkdir(parents=True, exist_ok=True)
    return RESULTADOS
