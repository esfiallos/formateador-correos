// Imágenes pegadas o soltadas en el editor: se reducen y se guardan como data URL.

const ANCHO_MAXIMO = 1200;
const PESO_MAXIMO_PNG = 900_000;

function cargarImagen(url) {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
    img.src = url;
  });
}

export const esImagen = (archivo) => /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(archivo?.type ?? '');

/** Archivo de imagen → { id, nombre, src (data URL), ancho, alto }. */
export async function procesarImagen(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await cargarImagen(url);
    const escala = Math.min(1, ANCHO_MAXIMO / img.naturalWidth);
    const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
    const alto = Math.max(1, Math.round(img.naturalHeight * escala));
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingQuality = 'high';

    let src;
    if (/jpe?g/i.test(archivo.type)) {
      ctx.drawImage(img, 0, 0, ancho, alto);
      src = lienzo.toDataURL('image/jpeg', 0.88);
    } else {
      ctx.drawImage(img, 0, 0, ancho, alto);
      src = lienzo.toDataURL('image/png');
      if (src.length > PESO_MAXIMO_PNG) {
        // Captura grande: JPEG sobre blanco pesa mucho menos y se ve igual.
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ancho, alto);
        src = lienzo.toDataURL('image/jpeg', 0.88);
      }
    }
    return {
      id: Math.random().toString(36).slice(2, 9),
      nombre: archivo.name && !/^image\.\w+$/i.test(archivo.name) ? archivo.name.replace(/\.[^.]+$/, '') : '',
      src,
      ancho,
      alto,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const pesoLegible = (src) => {
  const bytes = Math.round((src.length * 3) / 4);
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
};

/** Ids de imagen usados en el texto (![...](img:ID)). */
export function imagenesUsadas(texto) {
  return [...String(texto ?? '').matchAll(/\]\(img:([a-z0-9]+)\)/gi)].map((m) => m[1]);
}
