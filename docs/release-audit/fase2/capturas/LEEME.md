# Capturas de la App Store 1.0.8 (iPhone 6,9" e iPad 13") — PROPUESTA

Encargo del coordinador (02/10/2026): automatizar las capturas en un runner de macOS de GitHub Actions, con simulador y Maestro, y la cuenta demo de capturas en los secretos del repo. Se lanzan **al final**, con el diseño v2 completo (L3–L6). Nada de esto se ha ejecutado todavía.

| Archivo de la propuesta | Destino | Dueño |
|---|---|---|
| `screenshots.yml.propuesta` | `.github/workflows/screenshots.yml` | Coordinador |
| `simruntime.py.propuesta`, `simdevicetype.py.propuesta` | `scripts/ci/` | Coordinador |
| `capturas-108.yaml.propuesta` | `e2e/maestro/capturas-108.yaml` (usa `login.yaml`) | Chat 5 |
| Perfil `screenshots` (abajo) | `eas.json` | Coordinador |

## Perfil de EAS para simulador (diff de `eas.json`)

```diff
     "preview": {
       ...
     },
+    "screenshots": {
+      "extends": "base",
+      "distribution": "internal",
+      "channel": "production",
+      "environment": "production",
+      "ios": { "simulator": true, "buildConfiguration": "Release" }
+    },
     "production": {
```

- Usa `channel: production` y `environment: production`, así que lleva el mismo JS y las mismas variables públicas que la 1.0.8 de TestFlight. Al ser un build de simulador, no consume certificados ni perfiles de distribución.
- `eas.json` no admite comentarios: validar con `npx eas-cli config --platform ios --profile screenshots` (AGENTS.md).

## Tamaños que exige Apple, y que el workflow comprueba

| Dispositivo | Simulador | Píxeles | Obligatoria |
|---|---|---|---|
| iPhone 6,9" | iPhone 16 Pro Max | 1320 × 2868 | Sí |
| iPad 13" | iPad Pro 13-inch (M4) | 2064 × 2752 | Sí (`supportsTablet: true` en 1.0.8) |

Fuente: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/) (consultada el 02/10/2026; detalle en `../dominio-y-cumplimiento-108.md` B.3).

## Escenas (las mismas 7 en iPhone e iPad)

1. **Hoy:** misiones y progreso.
2. **Coach.**
3. **Perfil:** rango y nivel.
4. **Amigos:** competición y liga, con denuncia y bloqueo visibles.
5. **Campañas.**
6. **Agenda.**
7. **NIVL Pro:** planes con título, periodo y precio.

La 7 depende de StoreKit. En simulador sin configuración de StoreKit los precios pueden no cargar. En ese caso esa captura se repite a mano en TestFlight sobre un iPhone: nunca se maquilla un precio.

## Requisitos previos

- **Cuenta demo de capturas** distinta de la revisora de Apple, con datos ficticios: nivel y rango altos, racha de 30 o más, misiones de hoy, amigos y una liga, y alias sin nombre real. Con la salud y la IA aceptadas en esa cuenta. La siembra la definen el Chat 5 (datos de juego) y el coordinador (alta), sin credenciales en el repo.
- **Secretos del repo** (los pone el usuario): `NIVL_SHOTS_EMAIL`, `NIVL_SHOTS_PASSWORD`. Ya existe `EXPO_TOKEN`.
- **Repo público:** el artefacto con las capturas lo puede descargar cualquiera durante 3 días. Por eso solo se usan datos ficticios.
- **Antes de subir a ASC:** revisar a ojo cada captura. No debe haber textos cortados, datos personales ni pantallas a medio cargar, y en iPad no deben verse barras vacías, porque Apple las rechaza si muestran «la app ampliada».

## Riesgos

- Los nombres de simulador cambian con cada Xcode («iPhone 16 Pro Max», «iPad Pro 13-inch (M4)»). Si el runner no los tiene, el script falla con un mensaje claro y se ajusta el nombre.
- Maestro se instala desde el `maestro.zip` oficial de la release `cli-2.10.0`, verificado por SHA-256 (`29b675e1…cd991`, digest que GitHub publica para ese asset, leído el 02/10/2026). No se usa `curl | bash`. NO PROBADO: la ruta interna del zip (`maestro/bin`) se confirma en la primera ejecución.
- El modo oscuro del simulador no influye, porque la app ya es negra, pero se fuerza para que los diálogos del sistema coincidan.
