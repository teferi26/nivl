# PROPUESTA: scripts/ci/simdevicetype.py
# Lee `xcrun simctl list devicetypes -j` por stdin e imprime el identificador del
# tipo de dispositivo cuyo nombre coincide EXACTAMENTE con argv[1]
# (p. ej. "iPhone 16 Pro Max" o "iPad Pro 13-inch (M4)").
import json
import sys

nombre = sys.argv[1]
tipos = [d["identifier"] for d in json.load(sys.stdin)["devicetypes"] if d["name"] == nombre]
if not tipos:
    sys.exit(f"El runner no tiene el simulador «{nombre}».")
print(tipos[0])
