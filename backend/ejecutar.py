"""Ejecuta todo el análisis del backend sin necesidad del frontend."""
from __future__ import annotations

import argparse
import sys

import config
import mercado
import modelo
from config import logger


def main() -> int:
    parser = argparse.ArgumentParser(description="Hotspots Comerciales: análisis completo")
    parser.add_argument("--sin-red", action="store_true", help="Omitir la red vial")
    parser.add_argument("--descargar-red", action="store_true",
                        help="Descargar la red vial si no existe la copia local")
    parser.add_argument("--incluir-revision", action="store_true",
                        help="Incluir registros pendientes de revisión (sensibilidad)")
    parser.add_argument("--detalle", action="store_true", help="Mostrar mensajes adicionales")
    args = parser.parse_args()

    config.configurar_consola(args.detalle)
    print("\nHOTSPOTS COMERCIALES\n====================\n")
    try:
        modelo.ejecutar(args.incluir_revision)
        r = mercado.ejecutar(args.sin_red, args.descargar_red)
    except Exception as exc:
        logger.error(f"{type(exc).__name__}: {exc}")
        print("\nEl proceso se detuvo. Revise el mensaje anterior.")
        if args.detalle:
            raise
        return 1
    final = "Proceso finalizado correctamente." if r["red_ok"] or args.sin_red else \
        "Proceso finalizado con avisos (red vial no disponible)."
    print(f"\n{final}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
