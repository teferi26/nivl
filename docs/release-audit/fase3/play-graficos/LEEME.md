# Gráficos de Google Play

| Archivo | Medida | Estado |
|---|---|---|
| `play-grafico-destacado-1024x500.png` | 1024 × 500, PNG de 24 bits sin transparencia | **Listo.** Escudo nuevo, NIVL en Cinzel y el lema de la pantalla de acceso, «UN 1 % MEJOR CADA DÍA». Todo cabe en la zona central, porque Play puede recortar los bordes |
| Icono de la ficha | 512 × 512 | **Es el del coordinador:** `coordinacion-winter-arc/logo-propuestas/final/nivl-icono-play-512.png`. No se duplica aquí, para que solo haya una versión |

El icono del launcher de Android (adaptativo, con el escudo) ya está en `winter2/integracion`, en @a9e93e5. El icono de iOS no cambia hasta la 1.0.9.

**Cómo regenerar el gráfico destacado:**

```bash
node gen.js
```

Después, abrir `_play-grafico-destacado-1024x500.html` con Chrome sin interfaz, a 1024 × 500 y escala 1, y quitar el canal alfa. Los HTML intermedios no se versionan.
