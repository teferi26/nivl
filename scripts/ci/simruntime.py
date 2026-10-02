# PROPUESTA: scripts/ci/simruntime.py
# Lee `xcrun simctl list runtimes -j` por stdin e imprime el identificador del
# runtime de iOS disponible más reciente (p. ej. com.apple.CoreSimulator.SimRuntime.iOS-26-2).
import json
import sys

runtimes = [r for r in json.load(sys.stdin)["runtimes"] if r.get("platform") == "iOS" and r.get("isAvailable")]
if not runtimes:
    sys.exit("No hay ningún runtime de iOS disponible en este runner.")


def clave(r):
    return tuple(int(p) for p in r["version"].split("."))


print(sorted(runtimes, key=clave)[-1]["identifier"])
