// Editor visual (contenteditable): lo que se escribe ya se ve con formato.
// Por dentro el correo sigue guardándose como texto con marcas (estado.texto), así funcionan
// plantillas, variables y vista previa; este módulo convierte HTML del editor ↔ texto.

import { chipHtml, codigoEditable, enLineaEditable, marcaDeRecuadro, mdAEditable, nombreDeLenguaje, pildoraEditableHtml, textoDeChip } from './editorHtml.js';
import { analizarBloques, urlSegura, escaparHtml } from './formato.js';

const BLOQUES = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'ASIDE', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY',
  'TR', 'HR', 'FIGURE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'PRE', 'CENTER',
]);
const IGNORAR = new Set(['SCRIPT', 'STYLE', 'IMG', 'BUTTON', 'META', 'LINK', 'TITLE', 'TEMPLATE', 'SVG', 'OBJECT', 'IFRAME']);

// ───────────────────────── HTML → texto ─────────────────────────

function envolver(marca, contenido) {
  return contenido
    .split('\n')
    .map((linea) => {
      const [, antes, centro, despues] = linea.match(/^(\s*)(.*?)(\s*)$/);
      if (!centro) return linea;
      if (centro.startsWith(marca) && centro.endsWith(marca) && centro.length > marca.length * 2) return linea;
      return antes + marca + centro + marca + despues;
    })
    .join('\n');
}

function fondoVisible(color) {
  const c = String(color ?? '').replace(/\s/g, '').toLowerCase();
  return Boolean(c) && !['transparent', 'inherit', 'initial', 'white', '#fff', '#ffffff', 'rgb(255,255,255)', 'rgba(0,0,0,0)', 'window'].includes(c);
}

const normalizarHref = (href) => href.trim().replace(/\s/g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');

/** Contenido en línea de un nodo → texto con marcas (\n = salto de línea). */
export function enLinea(nodo) {
  let s = '';
  for (const n of nodo.childNodes) {
    if (n.nodeType === 3) {
      s += n.textContent.replace(/ /g, ' ').replace(/[\r\n\t]+/g, ' ').replace(/​/g, '');
      continue;
    }
    if (n.nodeType !== 1) continue;
    if (n.classList.contains('chip-var') || n.classList.contains('pildora')) {
      s += n.dataset.md ?? '';
      continue;
    }
    if (n.classList.contains('controles-bloque') || n.classList.contains('etiqueta-codigo') || IGNORAR.has(n.tagName)) continue;
    if (n.tagName === 'CODE' && !n.closest('pre')) {
      const codigo = n.textContent.replace(/ /g, ' ').replace(/`/g, "'").trim();
      if (codigo) s += `\`${codigo}\``;
      continue;
    }
    if (n.tagName === 'BR') {
      s += '\n';
      continue;
    }
    if (n.classList.contains('bloque-fijo') && n.dataset.md) {
      s += `\n${n.dataset.md}\n`;
      continue;
    }

    const tag = n.tagName;
    const estilo = n.style ?? {};
    let interior = enLinea(n);
    const pesoNormal = /^(normal|[1-4]00)$/.test(estilo.fontWeight ?? '');

    if (tag === 'A') {
      const href = n.getAttribute('href') ?? '';
      const texto = interior.trim();
      if (texto && urlSegura(escaparHtml(href))) {
        interior = texto === href.trim() ? normalizarHref(href) : `[${texto.replace(/[[\]]/g, '')}](${normalizarHref(href)})`;
      }
    } else if ((tag === 'B' || tag === 'STRONG') && !pesoNormal) interior = envolver('**', interior);
    else if (tag === 'EM' || tag === 'I' || tag === 'CITE') interior = envolver('*', interior);
    else if (tag === 'U' || tag === 'INS') interior = envolver('++', interior);
    else if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') interior = envolver('~~', interior);
    else if (tag === 'MARK') interior = envolver('==', interior);
    else if (tag === 'SPAN' || tag === 'FONT') {
      const decoracion = `${estilo.textDecoration ?? ''} ${estilo.textDecorationLine ?? ''}`;
      if (/^(bold|[6-9]00)$/.test(estilo.fontWeight ?? '')) interior = envolver('**', interior);
      if (estilo.fontStyle === 'italic') interior = envolver('*', interior);
      if (/underline/.test(decoracion)) interior = envolver('++', interior);
      if (/line-through/.test(decoracion)) interior = envolver('~~', interior);
      if (fondoVisible(estilo.backgroundColor)) interior = envolver('==', interior);
    }

    const esBloque = BLOQUES.has(tag);
    if (esBloque && s && !s.endsWith('\n')) s += '\n';
    s += interior;
    if (esBloque && !s.endsWith('\n')) s += '\n';
  }
  return s;
}

const limpiarLineas = (s) =>
  s
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');

function lista(n, ordenada) {
  let numero = Number(n.getAttribute('start')) || 1;
  const salida = [];
  for (const hijo of n.children) {
    if (hijo.tagName === 'UL' || hijo.tagName === 'OL') {
      salida.push(lista(hijo, hijo.tagName === 'OL'));
      continue;
    }
    if (hijo.tagName !== 'LI') continue;
    const copia = hijo.cloneNode(true);
    const anidadas = [...copia.children].filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
    for (const a of anidadas) a.remove();
    const lineas = limpiarLineas(enLinea(copia)).split('\n').filter((l) => l.trim());
    if (lineas.length) salida.push((ordenada ? `${numero++}. ` : '- ') + lineas[0] + lineas.slice(1).map((l) => `\n  ${l}`).join(''));
    for (const a of anidadas) salida.push(lista(a, a.tagName === 'OL'));
  }
  return salida.filter(Boolean).join('\n');
}

function tabla(t) {
  const filas = [...t.rows];
  if (!filas.length) return '';
  const celdas = filas.map((r) => [...r.cells].map((c) => limpiarLineas(enLinea(c)).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim()));
  const columnas = Math.max(...celdas.map((f) => f.length));
  const completas = celdas.map((f) => [...f, ...Array(columnas - f.length).fill('')]);
  const conCabecera = filas[0].parentElement?.tagName === 'THEAD' || [...filas[0].cells].some((c) => c.tagName === 'TH');
  const lineas = completas.map((f) => `| ${f.join(' | ')} |`);
  if (conCabecera) lineas.splice(1, 0, `|${completas[0].map(() => '---').join('|')}|`);
  return lineas.join('\n');
}

/** Texto de un <pre> respetando saltos (<br>, bloques) y sin la etiqueta del equipo. */
function textoDePre(nodo) {
  let s = '';
  for (const n of nodo.childNodes) {
    if (n.nodeType === 3) s += n.data.replace(/ /g, ' ').replace(/​/g, '');
    else if (n.nodeType === 1) {
      if (n.classList.contains('etiqueta-codigo') || n.classList.contains('controles-bloque')) continue;
      if (n.tagName === 'BR') s += '\n';
      else if (BLOQUES.has(n.tagName)) s += `${s && !s.endsWith('\n') ? '\n' : ''}${textoDePre(n)}\n`;
      else s += textoDePre(n);
    }
  }
  return s;
}

const tieneHijosDeBloque = (n) => [...n.children].some((c) => BLOQUES.has(c.tagName) || c.classList.contains('bloque-fijo'));

function bloque(n) {
  if (n.classList.contains('bloque-fijo')) return { md: n.dataset.md ?? '' };
  switch (n.tagName) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const nivel = Math.min(3, Number(n.tagName[1]));
      const texto = limpiarLineas(enLinea(n)).replace(/\n+/g, ' ');
      return { md: texto ? `${'#'.repeat(nivel)} ${texto}` : '' };
    }
    case 'UL':
    case 'OL':
      return { md: lista(n, n.tagName === 'OL') };
    case 'ASIDE':
    case 'BLOCKQUOTE': {
      // <blockquote> es una cita (>>); <aside> es un recuadro de color (> ! !! ✓).
      const variante = n.tagName === 'BLOCKQUOTE' ? 'cita' : n.dataset.recuadro || 'info';
      const marca = variante === 'cita' ? '>> ' : marcaDeRecuadro(variante);
      const lineas = limpiarLineas(enLinea(n)).split('\n').filter((l) => l.trim());
      return { md: lineas.map((l) => marca + l).join('\n'), recuadro: variante };
    }
    case 'TABLE':
      if (n.classList.contains('linea-tiempo')) {
        const items = [...n.rows].map((r) => {
          const [hora, texto] = [...r.cells].map((c) => limpiarLineas(enLinea(c)).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim());
          return hora || texto ? `@ ${hora ? `${hora} | ` : ''}${texto ?? ''}` : '';
        });
        return { md: items.filter(Boolean).join('\n') };
      }
      return { md: tabla(n) };
    case 'HR':
      return { md: '---' };
    case 'PRE': {
      const contenido = textoDePre(n).replace(/\r\n?/g, '\n').replace(/^\n+|\s+$/g, '');
      return { md: `\`\`\`${n.dataset.lenguaje ?? ''}\n${contenido.replace(/^```/gm, "'''")}\n\`\`\`` };
    }
    default:
      if (tieneHijosDeBloque(n)) return { md: serializar(n) };
      return { md: limpiarLineas(enLinea(n)) };
  }
}

/** HTML del editor (o pegado) → texto con marcas. */
export function serializar(raiz) {
  const partes = [];
  let recuadroAnterior = null;
  let pendiente = '';

  const agregar = ({ md, recuadro = null }) => {
    if (!md || !md.trim()) {
      recuadroAnterior = null;
      return;
    }
    // Dos recuadros seguidos del mismo tipo son uno solo (Enter dentro de un recuadro).
    if (recuadro && recuadro === recuadroAnterior && partes.length) partes[partes.length - 1] += `\n${md}`;
    else partes.push(md);
    recuadroAnterior = recuadro;
  };
  const vaciar = () => {
    const texto = limpiarLineas(pendiente);
    if (texto) agregar({ md: texto });
    pendiente = '';
  };

  for (const n of raiz.childNodes) {
    const enLineaSuelto = n.nodeType === 3 || (n.nodeType === 1 && !BLOQUES.has(n.tagName) && !n.classList.contains('bloque-fijo'));
    if (enLineaSuelto) {
      pendiente += enLinea({ childNodes: [n] });
      continue;
    }
    if (n.nodeType !== 1) continue;
    vaciar();
    agregar(bloque(n));
  }
  vaciar();
  return partes.join('\n\n');
}

/** Quita lo que no aporta de un HTML pegado (Word, Outlook, Google Docs, páginas web). */
function limpiarPegado(cuerpo) {
  for (const n of cuerpo.querySelectorAll('style, script, meta, link, title, xml, template, svg, iframe, object, noscript')) n.remove();
  const recorrido = document.createTreeWalker(cuerpo, NodeFilter.SHOW_COMMENT);
  const comentarios = [];
  while (recorrido.nextNode()) comentarios.push(recorrido.currentNode);
  for (const c of comentarios) c.remove();
  for (const n of cuerpo.querySelectorAll('*')) if (n.tagName.includes(':')) n.replaceWith(...n.childNodes);
  return cuerpo;
}

const esTablaDeExcel = (texto) => {
  const lineas = texto.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  return lineas.length > 1 && lineas.every((l) => l.includes('\t'));
};

// ───────────────────────── Selección ─────────────────────────

function rangoDentro(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const rango = sel.getRangeAt(0);
  return el.contains(rango.commonAncestorContainer) ? rango : null;
}

function cursorAlFinal(nodo) {
  const rango = document.createRange();
  rango.selectNodeContents(nodo);
  rango.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(rango);
}

/** Bloque de primer nivel (hijo directo del editor) donde está el cursor. */
export function bloqueActual(el) {
  const rango = rangoDentro(el);
  let n = rango?.startContainer;
  while (n && n.parentNode !== el) n = n.parentNode;
  return n?.nodeType === 1 ? n : null;
}

const desdeHtml = (html) => {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = html; // HTML generado por editorHtml.js: todo el texto ya va escapado.
  return plantilla.content;
};

// ───────────────────────── Editor ─────────────────────────

/**
 * @param el          elemento contenteditable
 * @param contexto    () => { valores, imagenes, ahora }
 * @param alCambiar   (texto) => void, con el texto serializado
 * @param unaLinea    título/subtítulo: sin bloques ni saltos
 * @param alPegarImagenes (archivos) => void
 */
export function crearEditorVisual(el, { contexto, alCambiar, unaLinea = false, alPegarImagenes }) {
  el.contentEditable = 'true';
  el.spellcheck = true;
  let temporizador = null;
  let ultimo = null;

  const leer = () => (unaLinea ? limpiarLineas(enLinea(el)).replace(/\n+/g, ' ') : serializar(el));
  const marcarVacio = () => el.classList.toggle('vacio', !el.textContent.trim() && !el.querySelector('.chip-var, .bloque-fijo, hr, table'));

  const sincronizar = () => {
    clearTimeout(temporizador);
    temporizador = null;
    const texto = leer();
    marcarVacio();
    if (texto === ultimo) return;
    ultimo = texto;
    alCambiar(texto);
  };

  el.addEventListener('input', () => {
    marcarVacio();
    clearTimeout(temporizador);
    temporizador = setTimeout(sincronizar, 140);
  });
  el.addEventListener('blur', () => temporizador && sincronizar());

  /** Si el cursor quedó entre dos bloques (fuera de un párrafo), lo lleva al final del bloque anterior. */
  const acomodarCursor = () => {
    const rango = rangoDentro(el);
    if (!rango || !rango.collapsed || rango.startContainer !== el) return;
    const destino = el.childNodes[rango.startOffset - 1] ?? el.childNodes[rango.startOffset];
    if (destino?.nodeType === 1 && !destino.classList.contains('bloque-fijo') && !/^(TABLE|HR)$/.test(destino.tagName)) cursorAlFinal(destino);
  };

  const insertarHtml = (html) => {
    el.focus();
    acomodarCursor();
    document.execCommand('insertHTML', false, html);
  };

  function insertarTexto(md) {
    if (unaLinea) return insertarHtml(enLineaEditable(md.replace(/\s*\n\s*/g, ' '), contexto()));
    const bloques = analizarBloques(md);
    if (bloques.length === 1 && bloques[0].tipo === 'parrafo') {
      insertarHtml(bloques[0].lineas.map((l) => enLineaEditable(l, contexto())).join('<br>'));
    } else if (bloques.length) insertarHtml(mdAEditable(md, contexto()));
  }

  /** <pre> (bloque de comandos) donde está el cursor. */
  const preActual = () => {
    const n = rangoDentro(el)?.startContainer;
    const pre = (n?.nodeType === 3 ? n.parentElement : n)?.closest?.('pre');
    return pre && el.contains(pre) ? pre : null;
  };

  /** Dentro de un bloque de comandos todo es texto literal: saltos y espacios incluidos. */
  function insertarEnPre(pre, texto) {
    const rango = rangoDentro(el);
    if (!rango) return;
    rango.deleteContents();
    const nodo = document.createTextNode(texto);
    rango.insertNode(nodo);
    // Al final del bloque el navegador no muestra una línea vacía nueva: se deja un salto de reserva.
    const resto = document.createRange();
    resto.setStartAfter(nodo);
    resto.setEnd(pre, pre.childNodes.length);
    if (texto.endsWith('\n') && !resto.toString().length) nodo.after(document.createTextNode('\n'));
    const cursor = document.createRange();
    cursor.setStartAfter(nodo);
    cursor.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(cursor);
    pre.normalize();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  el.addEventListener('paste', (e) => {
    const datos = e.clipboardData;
    if (!datos) return;
    const archivos = [...datos.files].filter((f) => f.type.startsWith('image/'));
    const texto = datos.getData('text/plain');
    const html = datos.getData('text/html');
    e.preventDefault();
    const pre = preActual();
    if (pre) {
      insertarEnPre(pre, texto.replace(/\r\n?/g, '\n'));
      return;
    }
    if (archivos.length && !texto.trim()) {
      if (!unaLinea) alPegarImagenes?.(archivos);
      return;
    }
    let md;
    if (unaLinea || !html || esTablaDeExcel(texto)) md = texto.replace(/\r\n?/g, '\n');
    else md = serializar(limpiarPegado(new DOMParser().parseFromString(html, 'text/html').body));
    if (md.trim()) insertarTexto(md);
  });

  el.addEventListener('drop', (e) => {
    // Arrastrar texto/HTML desde fuera: lo tratamos como pegado limpio.
    if (e.dataTransfer?.files?.length) return;
    const texto = e.dataTransfer?.getData('text/plain');
    if (!texto) return;
    e.preventDefault();
    insertarTexto(texto);
  });

  el.addEventListener('keydown', (e) => {
    if (unaLinea && e.key === 'Enter') {
      e.preventDefault();
      return;
    }
    const pre = !unaLinea && preActual();
    if (pre && (e.key === 'Enter' || e.key === 'Tab') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      insertarEnPre(pre, e.key === 'Enter' ? '\n' : '    ');
      return;
    }
    // Tab en tablas: siguiente celda (y fila nueva al final).
    if (e.key === 'Tab' && !unaLinea) {
      const celda = celdaActual(el);
      if (!celda) return;
      e.preventDefault();
      const celdas = [...celda.closest('table').querySelectorAll('td, th')];
      let i = celdas.indexOf(celda) + (e.shiftKey ? -1 : 1);
      if (i >= celdas.length) {
        const fila = celda.closest('tr');
        const nueva = filaVacia(fila.cells.length, celda.closest('table'));
        celda.closest('table').querySelector('tbody, table').append(nueva);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        i = celdas.length;
      }
      const destino = celda.closest('table').querySelectorAll('td, th')[Math.max(0, i)];
      if (destino) cursorAlFinal(destino);
    }
  });

  return {
    el,
    unaLinea,
    leer,
    sincronizar,
    insertarHtml,
    insertarTexto,
    establecer(texto) {
      clearTimeout(temporizador);
      temporizador = null;
      ultimo = texto;
      el.replaceChildren(desdeHtml(unaLinea ? enLineaEditable(texto ?? '', contexto()) : mdAEditable(texto ?? '', contexto())));
      marcarVacio();
    },
    /** Actualiza lo que muestran los chips (valores de variables) sin redibujar el texto. */
    refrescarChips() {
      const ctx = contexto();
      for (const chip of el.querySelectorAll('.chip-var')) {
        const { texto, estado } = textoDeChip(chip.dataset.md, ctx);
        if (chip.textContent !== texto) chip.textContent = texto;
        chip.className = `chip-var chip-${estado}`;
      }
    },
    reemplazarNodo(nodo, html) {
      nodo.replaceWith(desdeHtml(html));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    quitarNodo(nodo) {
      const siguiente = nodo.nextElementSibling;
      nodo.remove();
      if (!el.firstChild) el.append(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
      if (siguiente) cursorAlFinal(siguiente);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
  };
}

// ───────────────────────── Comandos de la barra ─────────────────────────

/** Inserta un bloque de comandos (con lo seleccionado, si hay) y deja el cursor dentro. */
function insertarCodigo(editor, lenguaje) {
  const rango = rangoDentro(editor.el);
  const seleccion = rango?.toString() ?? '';
  editor.insertarHtml(`${codigoEditable({ lenguaje, lineas: seleccion ? seleccion.split('\n') : [''] })}<p><br></p>`);
  const pre = bloqueActual(editor.el)?.previousElementSibling;
  if (pre?.tagName !== 'PRE') return;
  const texto = [...pre.childNodes].reverse().find((n) => n.nodeType === 3);
  if (!texto) return;
  const cursor = document.createRange();
  cursor.setStart(texto, Math.max(0, texto.data.length - 1));
  cursor.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(cursor);
}

/** Cambia el equipo de un bloque de comandos (resaltado y etiqueta). */
export function cambiarLenguaje(editor, pre, lenguaje) {
  pre.dataset.lenguaje = lenguaje;
  const etiqueta = pre.querySelector('.etiqueta-codigo');
  if (etiqueta) etiqueta.textContent = nombreDeLenguaje(lenguaje);
  editor.el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Convierte el párrafo actual en recuadro (<aside>) o cita (<blockquote>), o lo devuelve a párrafo. */
function alternarRecuadro(editor, variante) {
  const el = editor.el;
  const etiqueta = variante === 'cita' ? 'BLOCKQUOTE' : 'ASIDE';
  const crear = () => {
    const nodo = document.createElement(etiqueta.toLowerCase());
    if (etiqueta === 'ASIDE') nodo.dataset.recuadro = variante;
    return nodo;
  };
  const b = bloqueActual(el);
  if (!b) {
    const nodo = crear();
    nodo.append(document.createElement('br'));
    editor.insertarHtml(nodo.outerHTML);
    return;
  }
  const esRecuadro = b.tagName === 'ASIDE' || b.tagName === 'BLOCKQUOTE';
  const mismo = b.tagName === etiqueta && (etiqueta === 'BLOCKQUOTE' || b.dataset.recuadro === variante);
  let destino;
  if (esRecuadro && mismo) destino = document.createElement('p');
  else if (esRecuadro || /^(P|DIV|H[1-6])$/.test(b.tagName)) destino = crear();
  else return;
  destino.append(...b.childNodes);
  if (!destino.firstChild) destino.append(document.createElement('br'));
  b.replaceWith(destino);
  cursorAlFinal(destino);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function alternarBloque(editor, etiqueta) {
  const actual = bloqueActual(editor.el)?.tagName?.toLowerCase();
  editor.el.focus();
  document.execCommand('formatBlock', false, actual === etiqueta ? 'p' : etiqueta);
}

function alternarResaltado(editor) {
  const rango = rangoDentro(editor.el);
  if (!rango || rango.collapsed) return;
  const marca = rango.startContainer.parentElement?.closest('mark, span[style*="background"]');
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('hiliteColor', false, marca ? 'transparent' : '#fff1a8');
  document.execCommand('styleWithCSS', false, false);
}

function tablaHtml(columnas, cabecera) {
  const cab = cabecera ?? Array.from({ length: columnas }, (_, i) => `Columna ${i + 1}`);
  const fila = `<tr>${cab.map(() => '<td><br></td>').join('')}</tr>`;
  return `<table><thead><tr>${cab.map((c) => `<th>${escaparHtml(c)}</th>`).join('')}</tr></thead><tbody>${fila}${fila}</tbody></table><p><br></p>`;
}

/** Comandos que no necesitan pedir datos. Devuelve true si lo manejó. */
export function aplicarComandoVisual(editor, nombre) {
  const ejecutar = (cmd, valor = null) => {
    editor.el.focus();
    document.execCommand(cmd, false, valor);
  };
  const enLinea = {
    negrita: () => ejecutar('bold'),
    cursiva: () => ejecutar('italic'),
    subrayado: () => ejecutar('underline'),
    tachado: () => ejecutar('strikeThrough'),
    resaltado: () => alternarResaltado(editor),
    'quitar-formato': () => {
      ejecutar('removeFormat');
      ejecutar('unlink');
    },
    deshacer: () => ejecutar('undo'),
    rehacer: () => ejecutar('redo'),
  };
  if (enLinea[nombre]) {
    enLinea[nombre]();
    return true;
  }
  if (editor.unaLinea) return false;
  const deBloque = {
    parrafo: () => ejecutar('formatBlock', 'p'),
    titulo1: () => alternarBloque(editor, 'h1'),
    titulo2: () => alternarBloque(editor, 'h2'),
    titulo3: () => alternarBloque(editor, 'h3'),
    lista: () => ejecutar('insertUnorderedList'),
    numerada: () => ejecutar('insertOrderedList'),
    nota: () => alternarRecuadro(editor, 'info'),
    aviso: () => alternarRecuadro(editor, 'aviso'),
    critico: () => alternarRecuadro(editor, 'critico'),
    exito: () => alternarRecuadro(editor, 'exito'),
    cita: () => alternarRecuadro(editor, 'cita'),
    'linea-tiempo': () =>
      editor.insertarHtml(
        `${mdAEditable('@ 08:00 | Recepción del reporte\n@ 08:15 | Inicio de la revisión\n@ 09:00 | Servicio restablecido', {})}<p><br></p>`,
      ),
    'codigo-cisco': () => insertarCodigo(editor, 'cisco'),
    'codigo-huawei': () => insertarCodigo(editor, 'huawei'),
    'codigo-mikrotik': () => insertarCodigo(editor, 'mikrotik'),
    'codigo-linux': () => insertarCodigo(editor, 'linux'),
    separador: () => editor.insertarHtml('<hr><p><br></p>'),
    'tabla-detalle': () => editor.insertarHtml(tablaHtml(2, ['Detalle', 'Información'])),
    'tabla-2': () => editor.insertarHtml(tablaHtml(2)),
    'tabla-3': () => editor.insertarHtml(tablaHtml(3)),
    'tabla-4': () => editor.insertarHtml(tablaHtml(4)),
  };
  if (deBloque[nombre]) {
    deBloque[nombre]();
    return true;
  }
  return false;
}

// ───────────────────────── Tablas ─────────────────────────

/** Celda (td/th) donde está el cursor, si está dentro del editor. */
export function celdaActual(el) {
  const rango = rangoDentro(el);
  let n = rango?.startContainer;
  if (n?.nodeType === 3) n = n.parentElement;
  const celda = n?.closest?.('td, th');
  return celda && el.contains(celda) ? celda : null;
}

function celdaVacia(etiqueta) {
  const celda = document.createElement(etiqueta);
  celda.append(document.createElement('br'));
  return celda;
}

function filaVacia(columnas, tabla = null) {
  const fila = document.createElement('tr');
  for (let i = 0; i < columnas; i++) fila.append(celdaVacia('td'));
  // En una línea de tiempo cada fila es «hora | texto».
  if (tabla?.classList.contains('linea-tiempo')) {
    fila.cells[0]?.classList.add('lt-hora');
    fila.cells[1]?.classList.add('lt-texto');
  }
  return fila;
}

/** Agrega o quita filas y columnas de la tabla donde está el cursor. */
export function operarTabla(editor, accion, celda = celdaActual(editor.el)) {
  if (!celda) return;
  const tabla = celda.closest('table');
  const fila = celda.closest('tr');
  const columna = celda.cellIndex;
  const enCabecera = fila.parentElement.tagName === 'THEAD';
  const columnas = Math.max(...[...tabla.rows].map((r) => r.cells.length));
  let destino = null;

  const cuerpo = () => {
    let tbody = tabla.tBodies[0];
    if (!tbody) {
      tbody = document.createElement('tbody');
      tabla.append(tbody);
    }
    return tbody;
  };

  switch (accion) {
    case 'fila-arriba':
    case 'fila-abajo': {
      const nueva = filaVacia(columnas, tabla);
      if (enCabecera) cuerpo().prepend(nueva);
      else if (accion === 'fila-arriba') fila.before(nueva);
      else fila.after(nueva);
      destino = nueva.cells[Math.min(columna, nueva.cells.length - 1)];
      break;
    }
    case 'quitar-fila': {
      const filas = [...tabla.rows];
      const i = filas.indexOf(fila);
      const vecina = filas[i + 1] ?? filas[i - 1];
      fila.parentElement.removeChild(fila);
      if (tabla.tHead && !tabla.tHead.rows.length) tabla.deleteTHead();
      if (!tabla.rows.length) return quitarTabla(editor, tabla);
      destino = vecina?.cells[Math.min(columna, vecina.cells.length - 1)];
      break;
    }
    case 'columna-izquierda':
    case 'columna-derecha':
      for (const r of tabla.rows) {
        const nueva = celdaVacia(r.parentElement.tagName === 'THEAD' ? 'th' : 'td');
        const referencia = r.cells[Math.min(columna, r.cells.length - 1)];
        if (!referencia) r.append(nueva);
        else if (accion === 'columna-izquierda') referencia.before(nueva);
        else referencia.after(nueva);
      }
      destino = fila.cells[accion === 'columna-izquierda' ? columna : columna + 1];
      break;
    case 'quitar-columna':
      if (columnas <= 1) return quitarTabla(editor, tabla);
      for (const r of tabla.rows) r.cells[columna]?.parentElement.removeChild(r.cells[columna]);
      destino = fila.cells[Math.min(columna, fila.cells.length - 1)];
      break;
    case 'cabecera': {
      // Convierte la primera fila en encabezado (o al revés).
      if (tabla.tHead) {
        const primera = tabla.tHead.rows[0];
        const nueva = document.createElement('tr');
        for (const c of [...primera.cells]) {
          const td = document.createElement('td');
          td.append(...c.childNodes);
          nueva.append(td);
        }
        tabla.deleteTHead();
        cuerpo().prepend(nueva);
      } else {
        const primera = tabla.rows[0];
        const thead = tabla.createTHead();
        const nueva = document.createElement('tr');
        for (const c of [...primera.cells]) {
          const th = document.createElement('th');
          th.append(...c.childNodes);
          nueva.append(th);
        }
        primera.parentElement.removeChild(primera);
        thead.append(nueva);
      }
      destino = tabla.rows[0]?.cells[0];
      break;
    }
    case 'quitar-tabla':
      return quitarTabla(editor, tabla);
    default:
      return;
  }
  if (destino) cursorAlFinal(destino);
  editor.el.dispatchEvent(new Event('input', { bubbles: true }));
}

function quitarTabla(editor, tabla) {
  if (!tabla?.isConnected) return true;
  const p = document.createElement('p');
  p.append(document.createElement('br'));
  tabla.replaceWith(p);
  cursorAlFinal(p);
  editor.el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/** Estado de la barra según el cursor: negrita activa, estilo del párrafo… */
export function estadoDeLaBarra(editor) {
  const consultar = (cmd) => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };
  const b = editor ? bloqueActual(editor.el) : null;
  const tag = b?.tagName;
  const estilo =
    { H1: 'Título', H2: 'Sección', H3: 'Rótulo', ASIDE: 'Recuadro', BLOCKQUOTE: 'Cita', PRE: 'Comandos', TABLE: 'Tabla' }[tag] ?? 'Texto';
  return {
    estilo,
    negrita: consultar('bold'),
    cursiva: consultar('italic'),
    subrayado: consultar('underline'),
    tachado: consultar('strikeThrough'),
    lista: consultar('insertUnorderedList'),
    numerada: consultar('insertOrderedList'),
  };
}

export { chipHtml, mdAEditable, pildoraEditableHtml, rangoDentro };
