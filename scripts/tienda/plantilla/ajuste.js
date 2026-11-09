// Se evalúa dentro de la página cuando ya ha cargado. Espera fuentes e imagen,
// encoge lo que no quepa y devuelve lo que siga mal. Nada de esto se adivina:
// si un titular no cabe, el compositor falla en vez de sacar un PNG roto.
(async () => {
  const problemas = [];
  // Los tipos vienen del tema: se leen de lo que la hoja ha resuelto.
  const fuentes = [".titulo", ".marca", ".sub"].map((sel) => {
    const c = getComputedStyle(document.querySelector(sel));
    return `${c.fontWeight} 40px ${c.fontFamily}`;
  });
  await Promise.all(fuentes.map((f) => document.fonts.load(f, "ÁÉáéNIVL")));
  await document.fonts.ready;
  for (const f of fuentes) {
    if (!document.fonts.check(f)) problemas.push(`fuente sin cargar: ${f}`);
  }
  const img = document.getElementById("cruda");
  try { await img.decode(); } catch { problemas.push("la captura cruda no se puede decodificar"); }
  if (!img.naturalWidth) problemas.push("captura cruda vacía");

  const cab = document.querySelector(".cabecera");
  const maxAncho = cab.clientWidth;
  const encajar = (bloque, minimo) => {
    const fs0 = parseFloat(getComputedStyle(bloque).fontSize);
    const lineas = [...bloque.querySelectorAll(".linea")];
    const mayor = Math.max(...lineas.map((l) => l.getBoundingClientRect().width));
    if (mayor <= maxAncho) return fs0;
    const fs = Math.floor((fs0 * maxAncho) / mayor);
    bloque.style.fontSize = fs + "px";
    if (fs < fs0 * minimo) problemas.push(`${bloque.className}: encogido a ${fs}px desde ${fs0}px`);
    return fs;
  };
  const tituloFs = encajar(document.querySelector(".titulo"), 0.7);
  const subFs = encajar(document.querySelector(".sub"), 0.8);

  const W = document.body.clientWidth;
  const H = document.body.clientHeight;
  const marco = document.querySelector(".marco").getBoundingClientRect();
  const dividida = document.body.classList.contains("dividida");
  const partes = [...document.querySelectorAll(".marca, .linea, .meandro, .hilo")];
  const rects = partes.map((p) => p.getBoundingClientRect());
  for (const r of rects) {
    if (r.left < 0 || r.right > W || r.top < 0 || r.bottom > H) problemas.push("texto fuera del lienzo");
  }
  const fin = Math.max(...rects.map((r) => r.bottom));
  const finX = Math.max(...rects.map((r) => r.right));
  if (dividida) {
    if (finX > marco.left - W * 0.012) problemas.push(`el texto toca el marco (x ${Math.round(finX)} y ${Math.round(marco.left)})`);
  } else if (fin > marco.top - W * 0.012) {
    problemas.push(`el texto toca el marco (y ${Math.round(fin)} y ${Math.round(marco.top)})`);
  }
  if (marco.bottom < H) problemas.push("el marco no sangra por abajo");
  return { problemas, tituloFs, subFs, finCabecera: Math.round(fin), marcoTop: Math.round(marco.top) };
})()
