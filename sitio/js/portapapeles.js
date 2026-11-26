// Copiar con formato: text/html + text/plain para que Outlook, Gmail o Word peguen el diseño.

function copiarConEvento(datos) {
  let copiado = false;
  const alCopiar = (evento) => {
    for (const [tipo, valor] of Object.entries(datos)) evento.clipboardData.setData(tipo, valor);
    evento.preventDefault();
    copiado = true;
  };
  document.addEventListener('copy', alCopiar);
  try {
    document.execCommand('copy');
  } catch {
    copiado = false;
  } finally {
    document.removeEventListener('copy', alCopiar);
  }
  return copiado;
}

export async function copiarConFormato(html, texto) {
  const fragmento = `<meta charset="utf-8">${html}`;
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([fragmento], { type: 'text/html' }),
          'text/plain': new Blob([texto], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch {
    // Sigue con el método clásico.
  }
  return copiarConEvento({ 'text/html': fragmento, 'text/plain': texto });
}

export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Sigue con el método clásico.
  }
  return copiarConEvento({ 'text/plain': texto });
}
