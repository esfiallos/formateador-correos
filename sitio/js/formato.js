// Reglas puras (sin DOM): variables, bloques del texto y formato en línea.
// Todo el texto de la persona se escapa antes de convertirse en HTML.

/** Marca invisible que rodea una variable sin valor (se pinta resaltada). */
export const MARCA_VARIABLE = '\u0001';
const FICHA = '\u0002';

export function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ───────────────────────── Variables ─────────────────────────

const RE_VARIABLE = /\{\{\s*([^{}|]+?)\s*(?:\|\s*([^{}]*?)\s*)?\}\}/g;

const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Variables que se completan solas: no piden campo. */
export const VARIABLES_AUTOMATICAS = {
  hoy: (ahora) =>
    capitalizar(
      new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(ahora),
    ),
  fecha: (ahora) => new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(ahora),
  hora: (ahora) => new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: false }).format(ahora),
};

/** «Nombre?» → { nombre: 'Nombre', opcional: true }. */
function leerNombre(crudo) {
  const limpio = String(crudo).trim();
  const opcional = limpio.endsWith('?');
  return { nombre: opcional ? limpio.slice(0, -1).trim() : limpio, opcional };
}

/**
 * Lo que va después de «|»: un valor predeterminado, o una lista de opciones separadas por «;»
 * ({{Área|CORE IP;CORE CS;TX}}), que se eligen con un clic y no dan valor por defecto.
 */
function leerPredeterminado(crudo) {
  const texto = String(crudo ?? '').trim();
  if (texto.includes(';')) {
    const opciones = [...new Set(texto.split(';').map((o) => o.trim()).filter(Boolean))];
    return { predeterminado: '', opciones };
  }
  return { predeterminado: texto, opciones: [] };
}

export function claveDeVariable(nombre) {
  return leerNombre(nombre).nombre.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Lista ordenada y sin repetir de las variables que aparecen en los textos.
 * - opcional: todas sus apariciones llevan «?» ({{Campo?}}); vacía, se quita su línea.
 * - bloque: ocupa una línea entera (listados, avances, payload): pide un campo grande.
 */
export function detectarVariables(...textos) {
  const vistas = new Map();
  for (const texto of textos) {
    if (!texto) continue;
    for (const linea of String(texto).split(/\r?\n/)) {
      for (const m of linea.matchAll(RE_VARIABLE)) {
        const { nombre, opcional } = leerNombre(m[1]);
        const clave = claveDeVariable(nombre);
        if (!clave || clave in VARIABLES_AUTOMATICAS) continue;
        const { predeterminado, opciones } = leerPredeterminado(m[2]);
        const bloque = linea.trim() === m[0];
        const previa = vistas.get(clave);
        if (!previa) vistas.set(clave, { clave, nombre, predeterminado, opciones, opcional, bloque });
        else {
          if (!previa.predeterminado && predeterminado) previa.predeterminado = predeterminado;
          if (!previa.opciones.length && opciones.length) previa.opciones = opciones;
          previa.opcional &&= opcional;
          previa.bloque ||= bloque;
        }
      }
    }
  }
  return [...vistas.values()];
}

export function valorDeVariable(variable, valores) {
  const propio = valores?.[variable.clave];
  if (propio != null && String(propio).trim()) return String(propio);
  return variable.predeterminado ?? '';
}

/**
 * Reemplaza {{variable}} y {{variable|predeterminado}} por su valor.
 * Una variable obligatoria sin valor queda marcada para resaltarla en el correo.
 * Una línea cuyas variables opcionales ({{Campo?}}) están todas vacías se quita entera
 * (también la fila de una tabla o el punto de una lista).
 */
export function sustituirVariables(texto, valores = {}, { ahora = new Date(), marcarFaltantes = true } = {}) {
  const resolver = (crudo, predeterminado) => {
    const { nombre, opcional } = leerNombre(crudo);
    const clave = claveDeVariable(nombre);
    const automatica = VARIABLES_AUTOMATICAS[clave];
    if (automatica) return { valor: automatica(ahora), opcional: false, nombre };
    return { valor: valorDeVariable({ clave, predeterminado: leerPredeterminado(predeterminado).predeterminado }, valores), opcional, nombre };
  };

  const items = String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linea) => {
      const opcionales = [...linea.matchAll(RE_VARIABLE)].map((m) => resolver(m[1], m[2])).filter((r) => r.opcional);
      if (opcionales.length && opcionales.every((r) => !r.valor.trim())) return { texto: linea, quitada: true };
      const nueva = linea.replace(RE_VARIABLE, (_, crudo, predeterminado) => {
        const { valor, opcional, nombre } = resolver(crudo, predeterminado);
        if (valor.trim()) return valor;
        return marcarFaltantes && !opcional ? MARCA_VARIABLE + nombre + MARCA_VARIABLE : '';
      });
      return { texto: nueva, quitada: false };
    });

  limpiarSeccionesVacias(items);
  return items
    .filter((i) => !i.quitada)
    .map((i) => i.texto)
    .join('\n');
}

/**
 * Tras quitar líneas opcionales: una tabla que quedó sin filas y un título cuya sección quedó
 * vacía también se quitan (solo si se vaciaron por eso; un título vacío a propósito se respeta).
 */
function limpiarSeccionesVacias(items) {
  const esTabla = (t) => /^\|.*\|$/.test(t.trim());
  const esTitulo = (t) => /^#{1,3}\s+\S/.test(t.trim());
  const esCorte = (t) => esTitulo(t) || /^(?:-{3,}|_{3,}|\*{3,}|─{3,})$/.test(t.trim());

  for (let i = 0; i < items.length; ) {
    if (!esTabla(items[i].texto)) {
      i++;
      continue;
    }
    let fin = i;
    while (fin < items.length && esTabla(items[fin].texto)) fin++;
    const grupo = items.slice(i, fin);
    const quedan = grupo.filter((g) => !g.quitada);
    const separadora = quedan[1] && /^\|?\s*:?-{2,}/.test(quedan[1].texto.trim());
    if (grupo.some((g) => g.quitada) && (quedan.length === 0 || (quedan.length <= 2 && separadora))) {
      for (const g of grupo) g.quitada = true;
    }
    i = fin;
  }

  for (let i = 0; i < items.length; i++) {
    if (items[i].quitada || !esTitulo(items[i].texto)) continue;
    // La sección es el bloque que sigue al título: hasta la primera línea en blanco tras el contenido.
    let fin = i + 1;
    let visto = false;
    while (fin < items.length) {
      const item = items[fin];
      if (!item.quitada && esCorte(item.texto)) break;
      if (!item.quitada && !item.texto.trim()) {
        if (visto) break;
      } else visto = true;
      fin++;
    }
    const seccion = items.slice(i + 1, fin);
    if (seccion.some((s) => s.quitada) && !seccion.some((s) => !s.quitada && s.texto.trim())) items[i].quitada = true;
  }
}

// ───────────────────────── Bloques ─────────────────────────

const RE_TITULO = /^(#{1,3})\s+(.+)$/;
const RE_VINETA = /^[-*•·▪◦‣–]\s+(.*)$/;
const RE_NUMERO = /^(\d{1,3})[.)]\s+(.*)$/;
const RE_BOTON = /^\[\[\s*(.+?)\s*\|\s*(.+?)\s*\]\]$/;
const RE_SEPARADOR = /^(?:-{3,}|_{3,}|\*{3,}|─{3,})$/;
const RE_IMAGEN = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
/** Recuadros: > nota · ! aviso · !! crítico · ✓ éxito. */
const RECUADROS = [
  { tipo: 'critico', re: /^!!\s+(.*)$/ },
  { tipo: 'exito', re: /^✓\s+(.*)$/ },
  { tipo: 'nota', re: /^>\s?(.*)$/ },
  { tipo: 'aviso', re: /^!\s+(.*)$/ },
];
const VARIANTE = { nota: 'info', aviso: 'aviso', critico: 'critico', exito: 'exito' };
const esFilaConBarras = (l) => /^\|.*\|$/.test(l.trim());
const esFilaConTabs = (l) => l.includes('\t') && l.trim() !== '';

function tipoDeLinea(linea, siguiente) {
  const t = linea.trim();
  if (!t) return 'vacia';
  if (esFilaConTabs(linea) && siguiente != null && esFilaConTabs(siguiente)) return 'tabla-tabs';
  if (esFilaConBarras(t)) return 'tabla';
  if (RE_SEPARADOR.test(t)) return 'separador';
  if (RE_TITULO.test(t)) return 'titulo';
  if (RE_BOTON.test(t)) return 'boton';
  if (RE_IMAGEN.test(t)) return 'imagen';
  for (const r of RECUADROS) if (r.re.test(t)) return r.tipo;
  if (RE_VINETA.test(t)) return 'vineta';
  if (RE_NUMERO.test(t)) return 'numero';
  return 'texto';
}

function celdasConBarras(linea) {
  return linea
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, '|').trim());
}

const esFilaSeparadora = (celdas) => celdas.length > 0 && celdas.every((c) => /^:?-{2,}:?$/.test(c));

function completarColumnas(filas) {
  const columnas = Math.max(...filas.map((f) => f.length));
  return filas.map((f) => [...f, ...Array(columnas - f.length).fill('')]);
}

/**
 * Convierte el texto en bloques:
 * titulo · parrafo · lista · nota (info/aviso) · tabla · boton · separador.
 */
export function analizarBloques(texto) {
  const lineas = String(texto ?? '').replace(/\r\n?/g, '\n').split('\n');
  const bloques = [];
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];
    const tipo = tipoDeLinea(linea, lineas[i + 1]);
    const t = linea.trim();

    if (tipo === 'vacia') {
      i++;
      continue;
    }

    if (tipo === 'tabla-tabs') {
      const filas = [];
      while (i < lineas.length && esFilaConTabs(lineas[i])) filas.push(lineas[i++].split('\t').map((c) => c.trim()));
      const [cabecera, ...resto] = completarColumnas(filas);
      bloques.push({ tipo: 'tabla', cabecera, filas: resto });
      continue;
    }

    if (tipo === 'tabla') {
      const filas = [];
      while (i < lineas.length && esFilaConBarras(lineas[i])) filas.push(celdasConBarras(lineas[i++]));
      let cabecera = null;
      if (filas.length > 1 && esFilaSeparadora(filas[1])) {
        cabecera = filas[0];
        filas.splice(0, 2);
      } else {
        for (let k = filas.length - 1; k >= 0; k--) if (esFilaSeparadora(filas[k])) filas.splice(k, 1);
      }
      const todas = completarColumnas(cabecera ? [cabecera, ...filas] : filas);
      bloques.push(cabecera ? { tipo: 'tabla', cabecera: todas[0], filas: todas.slice(1) } : { tipo: 'tabla', cabecera: null, filas: todas });
      continue;
    }

    if (tipo === 'separador') {
      bloques.push({ tipo: 'separador' });
      i++;
      continue;
    }

    if (tipo === 'titulo') {
      const [, almohadillas, contenido] = t.match(RE_TITULO);
      bloques.push({ tipo: 'titulo', nivel: almohadillas.length, texto: contenido.trim() });
      i++;
      continue;
    }

    if (tipo === 'boton') {
      const [, rotulo, url] = t.match(RE_BOTON);
      bloques.push({ tipo: 'boton', texto: rotulo, url });
      i++;
      continue;
    }

    if (tipo === 'imagen') {
      const [, alt, src] = t.match(RE_IMAGEN);
      const [texto, ancho] = alt.split('|').map((s) => s.trim());
      const medida = /^(\d{1,4})(%?)$/.exec(ancho ?? '');
      bloques.push({
        tipo: 'imagen',
        alt: texto ?? '',
        src,
        ancho: medida ? { valor: Number(medida[1]), porcentaje: medida[2] === '%' } : null,
      });
      i++;
      continue;
    }

    if (tipo in VARIANTE) {
      const { re } = RECUADROS.find((r) => r.tipo === tipo);
      const contenido = [];
      // Un recuadro sigue mientras las líneas empiecen con su marca (o con sangría).
      while (i < lineas.length) {
        const actual = lineas[i].trim();
        const tipoActual = tipoDeLinea(lineas[i], lineas[i + 1]);
        if (tipoActual === tipo) contenido.push(actual.match(re)[1]);
        else if (tipoActual === 'texto' && contenido.length && /^\s+/.test(lineas[i])) contenido.push(actual);
        else break;
        i++;
      }
      bloques.push({ tipo: 'nota', variante: VARIANTE[tipo], lineas: contenido });
      continue;
    }

    if (tipo === 'vineta' || tipo === 'numero') {
      const ordenada = tipo === 'numero';
      const re = ordenada ? RE_NUMERO : RE_VINETA;
      const items = [];
      const inicio = ordenada ? Number(t.match(RE_NUMERO)[1]) : 1;
      while (i < lineas.length) {
        const actual = lineas[i];
        const tipoActual = tipoDeLinea(actual, lineas[i + 1]);
        if (tipoActual === tipo) {
          const m = actual.trim().match(re);
          items.push([m[ordenada ? 2 : 1]]);
        } else if (tipoActual === 'texto' && /^\s+/.test(actual) && items.length) {
          // Línea con sangría: continúa el punto anterior.
          items[items.length - 1].push(actual.trim());
        } else break;
        i++;
      }
      bloques.push({ tipo: 'lista', ordenada, inicio, items });
      continue;
    }

    // Párrafo: hasta una línea vacía o el inicio de otro bloque.
    const contenido = [];
    while (i < lineas.length && tipoDeLinea(lineas[i], lineas[i + 1]) === 'texto') contenido.push(lineas[i++].trim());
    bloques.push({ tipo: 'parrafo', lineas: contenido });
  }

  return bloques;
}

// ───────────────────────── Formato en línea ─────────────────────────

/** Devuelve una URL segura (ya escapada) o null. Acepta http(s), mailto, tel y www. */
export function urlSegura(urlEscapada) {
  const u = String(urlEscapada ?? '').trim();
  if (!u || u.includes(MARCA_VARIABLE)) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  if (/^www\./i.test(u)) return `https://${u}`;
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(u)) return `mailto:${u}`;
  return null;
}

/** Solo http(s): para imágenes. */
export function urlDeImagen(url) {
  const u = escaparHtml(String(url ?? '').trim());
  return /^https?:\/\//i.test(u) ? u : null;
}

function enfasis(s) {
  return s
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong style="font-weight:bold;">$1</strong>')
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, '<strong style="font-weight:bold;">$1</strong>')
    .replace(/\+\+(?=\S)(.+?)(?<=\S)\+\+/g, '<u style="text-decoration:underline;">$1</u>')
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '<s style="text-decoration:line-through;">$1</s>')
    .replace(/==(?=\S)(.+?)(?<=\S)==/g, '<span style="background-color:#fff1a8;padding:0 2px;">$1</span>')
    .replace(/(^|[^*\w])\*(?=\S)(.+?)(?<=\S)\*(?!\*)/g, '$1<em style="font-style:italic;">$2</em>')
    .replace(/(^|[^_\w])_(?=\S)(.+?)(?<=\S)_(?![_\w])/g, '$1<em style="font-style:italic;">$2</em>');
}

const ESTILO_FALTANTE =
  'background-color:#fff3bf;color:#7a5600;border:1px dashed #e0b400;border-radius:3px;padding:0 4px;font-weight:normal;';

/**
 * Texto de una línea → HTML con estilos en línea (apto para Outlook).
 * Soporta **negrita**, *cursiva*, ++subrayado++, ~~tachado~~, ==resaltado==,
 * [texto](url), URLs y correos sueltos.
 */
export function formatoEnLinea(texto, { colorEnlace = '#1d4ed8' } = {}) {
  const fichas = [];
  const guardar = (html) => `${FICHA}${fichas.push(html) - 1}${FICHA}`;
  const enlace = (url, contenido) =>
    guardar(`<a href="${url}" target="_blank" style="color:${colorEnlace};text-decoration:underline;">${contenido}</a>`);

  let s = escaparHtml(texto);

  s = s.replace(new RegExp(`${MARCA_VARIABLE}([^${MARCA_VARIABLE}]+)${MARCA_VARIABLE}`, 'g'), (_, nombre) =>
    guardar(`<span style="${ESTILO_FALTANTE}">[${nombre}]</span>`),
  );

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (todo, rotulo, url) => {
    const segura = urlSegura(url);
    return segura ? enlace(segura, enfasis(rotulo)) : todo;
  });

  s = s.replace(/\b(?:https?:\/\/|www\.)[^\s\u0002]+/gi, (encontrada) => {
    let url = encontrada;
    let resto = '';
    const corte = url.search(/&(?:lt|gt|quot|#39);/);
    if (corte >= 0) {
      resto = url.slice(corte);
      url = url.slice(0, corte);
    }
    const final = url.match(/[.,;:!?)\]]+$/);
    if (final) {
      resto = final[0] + resto;
      url = url.slice(0, -final[0].length);
    }
    const segura = urlSegura(url);
    return segura ? enlace(segura, url) + resto : encontrada;
  });

  s = s.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (correo) => enlace(`mailto:${correo}`, correo));

  s = enfasis(s);

  const restaurar = (t) => t.replace(new RegExp(`${FICHA}(\\d+)${FICHA}`, 'g'), (_, n) => fichas[Number(n)]);
  return restaurar(restaurar(s));
}

/** Misma línea, sin marcas: para la versión en texto plano. */
export function textoPlanoEnLinea(texto) {
  return String(texto ?? '')
    .replace(new RegExp(`${MARCA_VARIABLE}([^${MARCA_VARIABLE}]+)${MARCA_VARIABLE}`, 'g'), '[$1]')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, rotulo, url) => (rotulo === url ? url : `${rotulo} (${url})`))
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '$1')
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, '$1')
    .replace(/\+\+(?=\S)(.+?)(?<=\S)\+\+/g, '$1')
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '$1')
    .replace(/==(?=\S)(.+?)(?<=\S)==/g, '$1')
    .replace(/(^|[^*\w])\*(?=\S)(.+?)(?<=\S)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^_\w])_(?=\S)(.+?)(?<=\S)_(?![_\w])/g, '$1$2');
}

// ───────────────────────── Variables para el editor visual ─────────────────────────

/** Patrón nuevo (con estado propio) para recorrer variables. */
export const patronVariable = () => new RegExp(RE_VARIABLE.source, 'g');

/** Desarma una variable: {{Nombre?|a;b}} → { nombre, clave, opcional, predeterminado, opciones, automatica }. */
export function describirVariable(crudo, predeterminadoCrudo) {
  const { nombre, opcional } = leerNombre(crudo);
  const clave = claveDeVariable(nombre);
  const { predeterminado, opciones } = leerPredeterminado(predeterminadoCrudo);
  return { nombre, clave, opcional, predeterminado, opciones, automatica: clave in VARIABLES_AUTOMATICAS };
}

/** Arma el texto {{…}} de una variable a partir de sus datos (lo inverso de describirVariable). */
export function tokenDeVariable({ nombre, opcional = false, predeterminado = '', opciones = [] }) {
  const limpio = String(nombre ?? '').replace(/[{}|?;]/g, '').replace(/\s+/g, ' ').trim();
  const lista = opciones.map((o) => String(o).replace(/[{}|;]/g, '').trim()).filter(Boolean);
  const extra = lista.length ? `|${lista.join(';')}` : String(predeterminado ?? '').trim() ? `|${String(predeterminado).replace(/[{}|;]/g, '').trim()}` : '';
  return `{{${limpio}${opcional ? '?' : ''}${extra}}}`;
}
