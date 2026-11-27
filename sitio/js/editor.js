// Acciones de la barra del editor sobre el <textarea>: envolver, prefijar líneas e insertar bloques.
// Usan execCommand('insertText') cuando existe para que Ctrl+Z las deshaga.

function reemplazar(area, inicio, fin, texto, selInicio = texto.length, selFin = selInicio) {
  area.focus();
  area.setSelectionRange(inicio, fin);
  let hecho = false;
  try {
    hecho = document.execCommand('insertText', false, texto);
  } catch {
    hecho = false;
  }
  if (!hecho || area.value.slice(inicio, inicio + texto.length) !== texto) {
    area.setRangeText(texto, inicio, fin, 'end');
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }
  area.setSelectionRange(inicio + selInicio, inicio + selFin);
}

export function insertarEnCursor(area, texto) {
  reemplazar(area, area.selectionStart, area.selectionEnd, texto);
}

function envolver(area, antes, despues, relleno) {
  const { selectionStart: a, selectionEnd: b, value } = area;
  const seleccion = value.slice(a, b);
  if (seleccion && value.slice(a - antes.length, a) === antes && value.slice(b, b + despues.length) === despues) {
    reemplazar(area, a - antes.length, b + despues.length, seleccion, 0, seleccion.length);
    return;
  }
  if (seleccion.startsWith(antes) && seleccion.endsWith(despues) && seleccion.length > antes.length + despues.length) {
    const interior = seleccion.slice(antes.length, seleccion.length - despues.length);
    reemplazar(area, a, b, interior, 0, interior.length);
    return;
  }
  // Conserva los espacios de los bordes fuera de la marca («**hola** » y no «**hola **»).
  const [, inicio, centro, fin] = (seleccion || relleno).match(/^(\s*)([\s\S]*?)(\s*)$/);
  const contenido = centro || relleno;
  const texto = inicio + antes + contenido + despues + fin;
  reemplazar(area, a, b, texto, inicio.length + antes.length, inicio.length + antes.length + contenido.length);
}

const RE_PREFIJO = /^\s*(?:[-*•]\s+|\d+[.)]\s+|>\s?|!!\s+|!\s+|✓\s+|#{1,3}\s+)/;

function rangoDeLineas(area) {
  const { value } = area;
  const inicio = value.lastIndexOf('\n', area.selectionStart - 1) + 1;
  const ajuste = area.selectionEnd > area.selectionStart && value[area.selectionEnd - 1] === '\n' ? 1 : 0;
  let fin = value.indexOf('\n', area.selectionEnd - ajuste);
  if (fin === -1) fin = value.length;
  return { inicio, fin, lineas: value.slice(inicio, fin).split('\n') };
}

/** Pone (o quita, si todas ya lo tienen) un prefijo de línea: lista, título, recuadro… */
function prefijarLineas(area, prefijo, reconocer) {
  const { inicio, fin, lineas } = rangoDeLineas(area);
  const conTexto = lineas.filter((l) => l.trim());
  const quitar = reconocer && conTexto.length > 0 && conTexto.every((l) => reconocer.test(l));
  let n = 0;
  const nuevas = lineas.map((l) => {
    if (!l.trim()) return l;
    const limpia = l.replace(RE_PREFIJO, '');
    if (quitar || !prefijo) return limpia;
    n++;
    return (typeof prefijo === 'function' ? prefijo(n) : prefijo) + limpia;
  });
  const texto = nuevas.join('\n');
  reemplazar(area, inicio, fin, texto, 0, texto.length);
}

export function insertarBloque(area, bloque, { seleccionar = [0, bloque.length] } = {}) {
  const { selectionStart: a, selectionEnd: b, value } = area;
  const antes = value.slice(0, a);
  const despues = value.slice(b);
  const pre = !antes ? '' : antes.endsWith('\n\n') ? '' : antes.endsWith('\n') ? '\n' : '\n\n';
  const post = !despues ? '\n' : despues.startsWith('\n\n') ? '' : despues.startsWith('\n') ? '\n' : '\n\n';
  reemplazar(area, a, b, pre + bloque + post, pre.length + seleccionar[0], pre.length + seleccionar[1]);
}

function quitarFormato(area) {
  const { selectionStart: a, selectionEnd: b, value } = area;
  if (a === b) return prefijarLineas(area, '', null);
  const limpio = value
    .slice(a, b)
    .split('\n')
    .map((l) =>
      l
        .replace(RE_PREFIJO, '')
        .replace(/(\*\*|__|\+\+|~~|==)(.+?)\1/g, '$2')
        .replace(/(^|[^*\w])\*(\S.*?\S|\S)\*/g, '$1$2')
        .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1'),
    )
    .join('\n');
  reemplazar(area, a, b, limpio, 0, limpio.length);
}

function tabla(columnas, cabecera) {
  const cab = cabecera ?? Array.from({ length: columnas }, (_, i) => `Columna ${i + 1}`);
  const fila = Array(cab.length).fill('Dato');
  return [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, `| ${fila.join(' | ')} |`, `| ${fila.join(' | ')} |`].join('\n');
}

export const FORMATOS = {
  negrita: (a) => envolver(a, '**', '**', 'texto en negrita'),
  cursiva: (a) => envolver(a, '*', '*', 'texto en cursiva'),
  subrayado: (a) => envolver(a, '++', '++', 'texto subrayado'),
  tachado: (a) => envolver(a, '~~', '~~', 'texto tachado'),
  resaltado: (a) => envolver(a, '==', '==', 'texto resaltado'),
  'quitar-formato': quitarFormato,

  parrafo: (a) => prefijarLineas(a, '', null),
  titulo1: (a) => prefijarLineas(a, '# ', /^#\s+/),
  titulo2: (a) => prefijarLineas(a, '## ', /^##\s+/),
  titulo3: (a) => prefijarLineas(a, '### ', /^###\s+/),

  lista: (a) => prefijarLineas(a, '- ', /^[-*•]\s+/),
  numerada: (a) => prefijarLineas(a, (n) => `${n}. `, /^\d+[.)]\s+/),

  nota: (a) => prefijarLineas(a, '> ', /^>\s?/),
  aviso: (a) => prefijarLineas(a, '! ', /^!\s+/),
  critico: (a) => prefijarLineas(a, '!! ', /^!!\s+/),
  exito: (a) => prefijarLineas(a, '✓ ', /^✓\s+/),

  enlace: (a) => {
    const seleccion = a.value.slice(a.selectionStart, a.selectionEnd);
    if (/^(https?:\/\/|www\.)\S+$/i.test(seleccion)) return envolver(a, '[texto del enlace](', ')', seleccion);
    const rotulo = seleccion || 'texto del enlace';
    reemplazar(a, a.selectionStart, a.selectionEnd, `[${rotulo}](https://)`, rotulo.length + 3, rotulo.length + 11);
  },
  boton: (a) => insertarBloque(a, '[[Ver detalle|https://]]', { seleccionar: [2, 13] }),
  separador: (a) => insertarBloque(a, '---'),

  'tabla-detalle': (a) => insertarBloque(a, '| Detalle | Información |\n|---|---|\n| Ticket | |\n| Cliente | |\n| Estado | |'),
  'tabla-2': (a) => insertarBloque(a, tabla(2)),
  'tabla-3': (a) => insertarBloque(a, tabla(3)),
  'tabla-4': (a) => insertarBloque(a, tabla(4)),

  cita: (a) => prefijarLineas(a, '>> ', /^>>\s?/),
  'linea-tiempo': (a) => insertarBloque(a, '@ 08:00 | Recepción del reporte\n@ 08:15 | Inicio de la revisión\n@ 09:00 | Servicio restablecido'),
  progreso: (a) => insertarBloque(a, '%% 50 | Avance', { seleccionar: [3, 5] }),
  pildora: (a) => envolver(a, '((', '))', 'Resuelto'),
  'codigo-cisco': (a) => insertarBloque(a, '```cisco\nRouter# show ip interface brief\n```', { seleccionar: [9, 40] }),
  'codigo-huawei': (a) => insertarBloque(a, '```huawei\n<HUAWEI> display interface brief\n```', { seleccionar: [10, 41] }),
  'codigo-mikrotik': (a) => insertarBloque(a, '```mikrotik\n[admin@MikroTik] > /interface print\n```', { seleccionar: [12, 47] }),
  'codigo-linux': (a) => insertarBloque(a, '```linux\n$ ping -c 4 8.8.8.8\n```', { seleccionar: [9, 28] }),

  variable: (a) => envolver(a, '{{', '}}', 'Nombre'),
  'variable-opcional': (a) => envolver(a, '{{', '?}}', 'Dato opcional'),
  'variable-opciones': (a) => {
    const texto = '{{Área|Opción 1;Opción 2;Opción 3}}';
    reemplazar(a, a.selectionStart, a.selectionEnd, texto, 2, 6);
  },
  'variable-hoy': (a) => insertarEnCursor(a, '{{hoy}}'),
  'variable-fecha': (a) => insertarEnCursor(a, '{{fecha}}'),
  'variable-hora': (a) => insertarEnCursor(a, '{{hora}}'),

  deshacer: (a) => {
    a.focus();
    document.execCommand('undo');
  },
  rehacer: (a) => {
    a.focus();
    document.execCommand('redo');
  },
};

/** Estilo de la línea del cursor, para marcar el menú «Estilo». */
export function estiloDeLinea(area) {
  const { lineas } = rangoDeLineas(area);
  const l = lineas[0] ?? '';
  if (/^#\s/.test(l)) return 'Título';
  if (/^##\s/.test(l)) return 'Sección';
  if (/^###\s/.test(l)) return 'Rótulo';
  return 'Texto';
}

// ───────────────────────── Menús desplegables ─────────────────────────

/** Botones [data-menu="id"] abren el .menu#id; Esc, clic fuera o elegir una opción lo cierran. */
export function enlazarMenus(raiz = document) {
  let abierto = null;

  const cerrar = ({ devolverFoco = false } = {}) => {
    if (!abierto) return;
    const { menu, boton } = abierto;
    menu.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    if (devolverFoco) boton.focus();
    abierto = null;
  };

  const abrir = (boton) => {
    const menu = raiz.getElementById(boton.dataset.menu);
    if (!menu) return;
    cerrar();
    menu.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    // Si no cabe a la derecha, se alinea a la derecha del botón.
    menu.classList.remove('a-la-derecha');
    const caja = menu.getBoundingClientRect();
    if (caja.right > window.innerWidth - 8) menu.classList.add('a-la-derecha');
    abierto = { menu, boton };
    menu.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
  };

  raiz.addEventListener('mousedown', (e) => {
    // Evita que el textarea pierda la selección al usar la barra.
    if (e.target.closest('.herramientas button, .herramientas .menu')) e.preventDefault();
  });

  raiz.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-menu]');
    if (boton) {
      if (abierto?.boton === boton) cerrar();
      else abrir(boton);
      return;
    }
    if (abierto && (e.target.closest('[role="menuitem"]') || !e.target.closest('.menu'))) cerrar();
  });

  raiz.addEventListener('keydown', (e) => {
    if (!abierto) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrar({ devolverFoco: true });
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...abierto.menu.querySelectorAll('[role="menuitem"]')];
      const i = items.indexOf(document.activeElement);
      const siguiente = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      siguiente?.focus();
    }
  });

  window.addEventListener('resize', () => cerrar());
  return { cerrar };
}
