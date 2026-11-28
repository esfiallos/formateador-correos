// Interfaz: dos vistas (Redactar · Diseñar), campos enlazados al estado, vista previa y copia.

import { construirCorreo, documentoCompleto, DISENOS, estadoPredeterminado, FUENTES, PALETA, colorValido } from './correo.js';
import { analizarBloques, COLORES_PILDORA, describirVariable, leerPildora, detectarVariables, patronVariable, textoPlanoEnLinea, tokenDeVariable } from './formato.js';
import { EJEMPLO_INICIAL, PLANTILLAS } from './plantillas.js';
import { guardar, leer } from './almacen.js';
import { copiarConFormato, copiarTexto } from './portapapeles.js';
import { aviso } from './aviso.js';
import { enlazarMenus, estiloDeLinea, FORMATOS, insertarBloque } from './editor.js';
import { esImagen, imagenesUsadas, procesarImagen } from './imagenes.js';
import { aplicarComandoVisual, cambiarLenguaje, celdaActual, chipHtml, crearEditorVisual, estadoDeLaBarra, mdAEditable, operarTabla, pildoraEditableHtml, rangoDentro } from './visual.js';
import { pedirDatos } from './dialogos.js';

const CLAVES = {
  estado: 'redacta:estado:v1',
  plantillas: 'redacta:plantillas:v1',
  imagenes: 'redacta:imagenes:v1',
  vista: 'redacta:vista',
  lateral: 'redacta:lateral-plantillas',
  modo: 'redacta:modo-editor',
  ediciones: 'redacta:plantillas-editadas:v1',
  ocultas: 'redacta:plantillas-ocultas:v1',
};

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const textoArea = $('#texto');
try {
  document.execCommand('defaultParagraphSeparator', false, 'p');
} catch {
  // Navegadores sin el comando: usan <div>, que también se entiende.
}

// ───────────────────────── Estado ─────────────────────────

function cargarEstado() {
  const base = { ...estadoPredeterminado(), plantilla: null };
  const guardado = leer(CLAVES.estado, null);
  if (!guardado || typeof guardado !== 'object') {
    base.texto = EJEMPLO_INICIAL.texto;
    base.encabezado.titulo = EJEMPLO_INICIAL.titulo;
    base.encabezado.subtitulo = EJEMPLO_INICIAL.subtitulo;
    return base;
  }
  for (const clave of Object.keys(base)) {
    const valor = guardado[clave];
    if (valor == null) continue;
    if (base[clave] && typeof base[clave] === 'object') base[clave] = { ...base[clave], ...valor };
    else base[clave] = valor;
  }
  return base;
}

const estado = cargarEstado();
const esPlantillaValida = (p) =>
  p && typeof p === 'object' && typeof p.nombre === 'string' && p.nombre.trim() && typeof p.cuerpo === 'string';
let plantillasPropias = (leer(CLAVES.plantillas, []) || []).filter(esPlantillaValida);

// Imágenes: se conservan solo las que el texto usa al abrir la app.
let imagenes = leer(CLAVES.imagenes, {}) || {};
{
  const usadas = new Set(imagenesUsadas(estado.texto));
  imagenes = Object.fromEntries(Object.entries(imagenes).filter(([id]) => usadas.has(id)));
}

let guardadoPendiente;
function guardarEstado() {
  if (typeof pintarEstadoPlantilla === 'function') pintarEstadoPlantilla();
  clearTimeout(guardadoPendiente);
  guardadoPendiente = setTimeout(() => guardar(CLAVES.estado, estado), 250);
}

function guardarImagenes() {
  if (!guardar(CLAVES.imagenes, imagenes)) {
    aviso('Las imágenes no caben en el almacenamiento del navegador: se usarán ahora, pero no se recordarán al cerrar.', {
      tipo: 'alerta',
      duracion: 6000,
    });
  }
}

const obtener = (ruta) => ruta.split('.').reduce((o, k) => o?.[k], estado);
function asignar(ruta, valor) {
  const partes = ruta.split('.');
  const ultima = partes.pop();
  partes.reduce((o, k) => o[k], estado)[ultima] = valor;
}

// ───────────────────────── Campos enlazados ─────────────────────────

function valorDe(el) {
  if (el.type === 'checkbox') return el.checked;
  if ('numero' in el.dataset || el.type === 'range') return Number(el.value);
  return el.value;
}

function poblarCampos() {
  for (const el of $$('[data-campo]')) {
    const valor = obtener(el.dataset.campo);
    if (el.type === 'checkbox') el.checked = Boolean(valor);
    else if (el.type === 'radio') el.checked = String(el.value).toLowerCase() === String(valor).toLowerCase();
    else if (el.type === 'color') el.value = colorValido(valor) ?? '#1e3a5f';
    else if (el.value !== String(valor ?? '')) el.value = valor ?? '';
  }
  actualizarDependientes();
  aplicarEstiloDocumento();
  $('#anchoValor').textContent = `${estado.ajustes.ancho} px`;
  marcarPaleta();
}

/** El editor usa la fuente y el tamaño elegidos para el correo: se ve como quedará. */
function aplicarEstiloDocumento() {
  const raiz = document.documentElement.style;
  raiz.setProperty('--doc-fuente', (FUENTES[estado.ajustes.fuente] ?? FUENTES.segoe).pila);
  raiz.setProperty('--doc-tam', `${estado.ajustes.tamano || 15}px`);
  raiz.setProperty('--doc-titulos', estado.ajustes.diseno === 'elegante' ? FUENTES.georgia.pila : 'var(--doc-fuente)');
}

function actualizarDependientes() {
  for (const el of $$('[data-depende]')) el.classList.toggle('apagado', !obtener(el.dataset.depende));
}

function alCambiarCampo(evento) {
  const el = evento.target.closest?.('[data-campo]');
  if (!el || (el.type === 'radio' && !el.checked)) return;
  const ruta = el.dataset.campo;
  asignar(ruta, valorDe(el));
  // El mismo dato puede estar en las dos vistas (p. ej. «Mostrar encabezado»).
  for (const otro of $$(`[data-campo="${ruta}"]`)) {
    if (otro === el || otro.type === 'radio') continue;
    if (otro.type === 'checkbox') otro.checked = el.checked;
    else if (otro.type !== 'color') otro.value = el.value;
  }
  if (ruta === 'ajustes.color') marcarPaleta();
  if (ruta.startsWith('ajustes.')) aplicarEstiloDocumento();
  if (ruta === 'ajustes.ancho') $('#anchoValor').textContent = `${estado.ajustes.ancho} px`;
  if (ruta.endsWith('.mostrar')) actualizarDependientes();
  if (ruta === 'texto') alCambiarTexto();
  if (ruta === 'texto' || ruta.startsWith('encabezado.')) actualizarVariables();
  guardarEstado();
  programarVista();
}

// ───────────────────────── Diseño ─────────────────────────

function construirControlesDeDiseno() {
  const disenos = $('#disenos');
  for (const [id, d] of Object.entries(DISENOS)) {
    const etiqueta = document.createElement('label');
    etiqueta.className = `tarjeta-diseno diseno-${id}`;
    const radio = Object.assign(document.createElement('input'), { type: 'radio', name: 'diseno', value: id });
    radio.dataset.campo = 'ajustes.diseno';
    const miniatura = document.createElement('span');
    miniatura.className = 'miniatura';
    miniatura.setAttribute('aria-hidden', 'true');
    for (const parte of ['m-banda', 'm-titulo', 'm-linea', 'm-linea corta', 'm-linea']) {
      const s = document.createElement('i');
      s.className = parte;
      miniatura.append(s);
    }
    const nombre = document.createElement('strong');
    nombre.textContent = d.nombre;
    const descripcion = document.createElement('small');
    descripcion.textContent = d.descripcion;
    etiqueta.append(radio, miniatura, nombre, descripcion);
    disenos.append(etiqueta);
  }

  const paleta = $('#paleta');
  for (const { nombre, color } of PALETA) {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'muestra';
    etiqueta.dataset.tip = nombre;
    etiqueta.style.setProperty('--muestra', color);
    const radio = Object.assign(document.createElement('input'), { type: 'radio', name: 'color', value: color });
    radio.dataset.campo = 'ajustes.color';
    radio.setAttribute('aria-label', nombre);
    etiqueta.append(radio);
    paleta.append(etiqueta);
  }
  const propio = document.createElement('label');
  propio.className = 'muestra muestra-propia';
  propio.dataset.tip = 'Color personalizado';
  const selector = Object.assign(document.createElement('input'), { type: 'color' });
  selector.dataset.campo = 'ajustes.color';
  selector.setAttribute('aria-label', 'Color personalizado');
  propio.append(selector);
  paleta.append(propio);

  const fuente = $('#fuente');
  for (const [id, f] of Object.entries(FUENTES)) {
    const opcion = Object.assign(document.createElement('option'), { value: id, textContent: f.nombre });
    opcion.style.fontFamily = f.pila;
    fuente.append(opcion);
  }
}

function marcarPaleta() {
  const color = (colorValido(estado.ajustes.color) ?? '#1e3a5f').toLowerCase();
  let encontrado = false;
  for (const radio of $$('#paleta input[type="radio"]')) {
    radio.checked = radio.value.toLowerCase() === color;
    encontrado ||= radio.checked;
  }
  const propio = $('#paleta .muestra-propia');
  propio.classList.toggle('activa', !encontrado);
  propio.style.setProperty('--muestra', color);
  $('#paleta input[type="color"]').value = color;
  document.documentElement.style.setProperty('--color-correo', color);
}

// ───────────────────────── Variables ─────────────────────────

let firmaVariables = null;

function variablesActuales() {
  const { titulo, subtitulo, mostrar } = estado.encabezado;
  // Solo una variable sola en una línea del mensaje pide campo grande; en el título no.
  const enCuerpo = new Map(detectarVariables(estado.texto).map((v) => [v.clave, v.bloque]));
  return detectarVariables(estado.texto, mostrar ? titulo : '', mostrar ? subtitulo : '').map((v) => ({
    ...v,
    bloque: Boolean(enCuerpo.get(v.clave)) && !v.opciones.length,
  }));
}

/** Recalcula el alto de los campos cuando ya hay diseño (fuentes cargadas, panel con su ancho). */
function reajustarCampos() {
  const todos = () => $$('#variables textarea').forEach(autoCrecer);
  todos();
  requestAnimationFrame(todos);
}

function autoCrecer(area) {
  area.style.height = 'auto';
  area.style.height = `${area.scrollHeight + 2}px`;
}

function campoDeVariable(v) {
  const caja = document.createElement('div');
  caja.className = `campo-variable${v.bloque ? ' campo-bloque' : ''}${v.opcional ? ' es-opcional' : ''}`;
  caja.dataset.clave = v.clave;

  const etiqueta = document.createElement('label');
  const id = `var-${v.clave.replace(/[^\w]+/g, '-')}`;
  etiqueta.htmlFor = id;
  etiqueta.className = 'variable-etiqueta';
  const nombre = document.createElement('span');
  nombre.textContent = v.nombre;
  etiqueta.append(nombre);
  const marca = document.createElement('span');
  marca.className = v.opcional ? 'marca-opcional' : 'marca-requerida';
  marca.textContent = v.opcional ? 'opcional' : '';
  if (!v.opcional) marca.setAttribute('aria-label', 'obligatoria');
  etiqueta.append(marca);

  const area = document.createElement('textarea');
  area.id = id;
  area.rows = v.bloque ? 4 : 1;
  area.dataset.variable = v.clave;
  area.value = estado.valores[v.clave] ?? '';
  area.placeholder =
    v.predeterminado ||
    (v.opciones.length
      ? 'Elige arriba o escribe otro'
      : v.bloque
        ? 'Escribe o pega aquí · una tabla de Excel se convierte en tabla'
        : v.opcional
          ? 'Vacío = no se incluye'
          : `Escribe ${v.nombre.toLowerCase()}`);
  caja.append(etiqueta);

  if (v.opciones.length) {
    const opciones = document.createElement('div');
    opciones.className = 'opciones-variable';
    opciones.setAttribute('role', 'group');
    opciones.setAttribute('aria-label', v.nombre);
    for (const opcion of v.opciones) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'chip-opcion';
      boton.textContent = opcion;
      boton.dataset.opcion = opcion;
      boton.dataset.para = v.clave;
      opciones.append(boton);
    }
    caja.append(opciones);
  }
  caja.append(area);
  return caja;
}

function actualizarVariables() {
  const variables = variablesActuales();
  const firma = variables.map((v) => [v.clave, v.predeterminado, v.opcional, v.bloque, v.opciones.join(';')].join('\u0000')).join('\n');

  if (firma !== firmaVariables) {
    firmaVariables = firma;
    const contenedor = $('#variables');
    const conFoco = document.activeElement?.dataset?.variable;
    // Obligatorias primero; dentro de cada grupo, en el orden del texto.
    const ordenadas = [...variables.filter((v) => !v.opcional), ...variables.filter((v) => v.opcional)];
    const nodos = [];
    ordenadas.forEach((v, i) => {
      if (v.opcional && (i === 0 || !ordenadas[i - 1].opcional)) {
        const titulo = document.createElement('p');
        titulo.className = 'separador-variables';
        titulo.textContent = 'Opcionales · si se dejan vacías no aparecen';
        nodos.push(titulo);
      }
      nodos.push(campoDeVariable(v));
    });
    contenedor.replaceChildren(...nodos);
    reajustarCampos();
    if (conFoco) $(`[data-variable="${CSS.escape(conFoco)}"]`, contenedor)?.focus();
    $('#sinVariables').hidden = variables.length > 0;
    $('#vaciarVariables').hidden = variables.length === 0;
    $('#progresoVariables').hidden = variables.length === 0;
  }
  pintarProgreso(variables);
}

function pintarProgreso(variables = variablesActuales()) {
  const obligatorias = variables.filter((v) => !v.opcional);
  const llenas = obligatorias.filter((v) => (estado.valores[v.clave] ?? '').trim() || v.predeterminado).length;
  const total = obligatorias.length;
  $('#conteoVariables').textContent = total ? `${llenas} de ${total} obligatorias` : 'Todas son opcionales';
  $('#progresoRelleno').style.width = `${total ? (llenas / total) * 100 : 100}%`;
  $('#progresoVariables').classList.toggle('completo', llenas === total);

  for (const caja of $$('#variables .campo-variable')) {
    const v = variables.find((x) => x.clave === caja.dataset.clave);
    const valor = (estado.valores[caja.dataset.clave] ?? '').trim();
    caja.classList.toggle('pendiente', Boolean(v && !v.opcional && !valor && !v.predeterminado));
    caja.classList.toggle('lleno', Boolean(valor));
    for (const chip of $$('.chip-opcion', caja)) chip.setAttribute('aria-pressed', String(chip.dataset.opcion === valor));
  }
}

function asignarVariable(clave, valor) {
  estado.valores[clave] = valor;
  pintarProgreso();
  refrescarChips();
  guardarEstado();
  programarVista();
}

function alEscribirVariable(evento) {
  const area = evento.target.closest?.('[data-variable]');
  if (!area) return;
  autoCrecer(area);
  asignarVariable(area.dataset.variable, area.value);
}

function elegirOpcion(chip) {
  const clave = chip.dataset.para;
  const area = $(`[data-variable="${CSS.escape(clave)}"]`);
  const valor = chip.getAttribute('aria-pressed') === 'true' ? '' : chip.dataset.opcion;
  if (area) {
    area.value = valor;
    autoCrecer(area);
  }
  asignarVariable(clave, valor);
}

function enfocarVariable(clave) {
  const area = $(`[data-variable="${CSS.escape(clave)}"]`);
  if (!area) return;
  area.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  area.focus({ preventScroll: true });
  const caja = area.closest('.campo-variable');
  caja.classList.remove('destello');
  void caja.offsetWidth;
  caja.classList.add('destello');
}

// ───────────────────────── Editores ─────────────────────────

let modoEditor = leer(CLAVES.modo, 'visual') === 'codigo' ? 'codigo' : 'visual';
const contextoEditor = () => ({ valores: estado.valores, imagenes, ahora: new Date() });

function alCambiarDesdeEditor(asignar) {
  return (texto) => {
    asignar(texto);
    pintarEstadoDelTexto();
    actualizarVariables();
    guardarEstado();
    programarVista();
  };
}

const editorCuerpo = crearEditorVisual($('#documento'), {
  contexto: contextoEditor,
  alCambiar: alCambiarDesdeEditor((t) => {
    estado.texto = t;
    textoArea.value = t;
  }),
  alPegarImagenes: (archivos) => insertarImagenes(archivos),
});
const editorTitulo = crearEditorVisual($('#editorTitulo'), {
  contexto: contextoEditor,
  unaLinea: true,
  alCambiar: alCambiarDesdeEditor((t) => (estado.encabezado.titulo = t)),
});
const editorSubtitulo = crearEditorVisual($('#editorSubtitulo'), {
  contexto: contextoEditor,
  unaLinea: true,
  alCambiar: alCambiarDesdeEditor((t) => (estado.encabezado.subtitulo = t)),
});
const editores = [editorCuerpo, editorTitulo, editorSubtitulo];
let editorActivo = editorCuerpo;
for (const editor of editores) editor.el.addEventListener('focus', () => (editorActivo = editor));

function sincronizarEditores() {
  for (const editor of editores) editor.sincronizar();
}

function cargarEditores() {
  editorCuerpo.establecer(estado.texto);
  editorTitulo.establecer(estado.encabezado.titulo);
  editorSubtitulo.establecer(estado.encabezado.subtitulo);
  textoArea.value = estado.texto;
}

function refrescarChips() {
  for (const editor of editores) editor.refrescarChips();
}

function cambiarModoEditor(modo) {
  sincronizarEditores();
  modoEditor = modo;
  const codigo = modo === 'codigo';
  if (codigo) textoArea.value = estado.texto;
  else editorCuerpo.establecer(estado.texto);
  $('#documento').hidden = codigo;
  textoArea.hidden = !codigo;
  $('[data-accion="alternar-codigo"]').setAttribute('aria-pressed', String(codigo));
  document.body.classList.toggle('modo-codigo', codigo);
  guardar(CLAVES.modo, modo);
  editorActivo = editorCuerpo;
  (codigo ? textoArea : editorCuerpo.el).focus();
}

function alCambiarTexto() {
  pintarEstadoDelTexto();
}

function pintarEstadoDelTexto() {
  const palabras = textoPlanoEnLinea(estado.texto.replace(/\{\{[^}]*\}\}/g, 'x')).match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const n = imagenesUsadas(estado.texto).length;
  $('#estadoTexto').textContent = `${palabras} ${palabras === 1 ? 'palabra' : 'palabras'}${n ? ` · ${n} ${n === 1 ? 'imagen' : 'imágenes'}` : ''}`;
}

function pintarEstiloActual() {
  if (modoEditor === 'codigo') {
    $('#estiloActual').textContent = estiloDeLinea(textoArea);
    return;
  }
  const barra = estadoDeLaBarra(editorActivo);
  $('#estiloActual').textContent = editorActivo.unaLinea ? 'Texto' : barra.estilo;
  for (const nombre of ['negrita', 'cursiva', 'subrayado', 'tachado', 'lista', 'numerada']) {
    $(`.herramientas [data-formato="${nombre}"]`)?.setAttribute('aria-pressed', String(Boolean(barra[nombre])));
  }
}

/** Guarda la selección del editor antes de abrir un diálogo y la devuelve después. */
async function conSeleccion(editor, pedir) {
  const rango = rangoDentro(editor.el)?.cloneRange() ?? null;
  const seleccionado = rango?.toString() ?? '';
  const datos = await pedir(seleccionado);
  editor.el.focus();
  if (rango) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(rango);
  }
  return datos;
}

const nombresDeVariables = () => [...new Set(variablesActuales().map((v) => v.nombre))];

async function pedirVariable({ tipo = 'obligatoria', nombre = '', predeterminado = '', opciones = [] } = {}) {
  const datos = await pedirDatos({
    titulo: nombre ? 'Editar dato' : 'Insertar dato',
    descripcion: 'Un dato es lo que cambia en cada correo (ticket, cliente, área…). Aparece como campo en «Datos del correo».',
    aceptar: nombre ? 'Guardar' : 'Insertar',
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre del dato', valor: nombre, requerido: true, placeholder: 'Ej. Ticket', sugerencias: nombresDeVariables() },
      {
        nombre: 'tipo',
        etiqueta: 'Tipo',
        tipo: 'elegir',
        valor: tipo,
        opciones: [
          { valor: 'obligatoria', etiqueta: 'Obligatorio', ayuda: 'Se resalta si falta' },
          { valor: 'opcional', etiqueta: 'Opcional', ayuda: 'Si queda vacío, su línea no aparece' },
          { valor: 'opciones', etiqueta: 'Lista de opciones', ayuda: 'Se elige con un clic' },
        ],
      },
      {
        nombre: 'opciones',
        etiqueta: 'Opciones (separadas por coma)',
        valor: opciones.join(', '),
        placeholder: 'CORE IP, CORE CS, TX, Soporte Digital',
        requerido: true,
        visibleSi: (v) => v.tipo === 'opciones',
      },
      {
        nombre: 'predeterminado',
        etiqueta: 'Valor por defecto (opcional)',
        valor: predeterminado,
        placeholder: 'Ej. En revisión',
        visibleSi: (v) => v.tipo === 'obligatoria',
      },
    ],
  });
  if (!datos?.nombre) return null;
  return tokenDeVariable({
    nombre: datos.nombre,
    opcional: datos.tipo === 'opcional',
    predeterminado: datos.tipo === 'obligatoria' ? datos.predeterminado : '',
    opciones: datos.tipo === 'opciones' ? datos.opciones.split(/[,;]/) : [],
  });
}

async function insertarVariable(editor, tipo) {
  const token = await conSeleccion(editor, (seleccion) => pedirVariable({ tipo, nombre: seleccion.trim().slice(0, 40) }));
  if (token) editor.insertarHtml(`${chipHtml(token, contextoEditor())}&nbsp;`);
}

async function editarChip(chip) {
  const m = patronVariable().exec(chip.dataset.md ?? '');
  if (!m) return;
  const v = describirVariable(m[1], m[2]);
  if (v.automatica) return;
  const editor = editores.find((e) => e.el.contains(chip));
  const token = await pedirVariable({
    tipo: v.opciones.length ? 'opciones' : v.opcional ? 'opcional' : 'obligatoria',
    nombre: v.nombre,
    predeterminado: v.predeterminado,
    opciones: v.opciones,
  });
  if (token && editor) editor.reemplazarNodo(chip, chipHtml(token, contextoEditor()));
}

async function insertarEnlace(editor) {
  const datos = await conSeleccion(editor, (seleccion) =>
    pedirDatos({
      titulo: 'Insertar enlace',
      aceptar: 'Insertar',
      campos: [
        { nombre: 'texto', etiqueta: 'Texto', valor: seleccion, placeholder: 'Ej. Ver el informe' },
        { nombre: 'url', etiqueta: 'Dirección', tipo: 'url', valor: /^https?:\/\//.test(seleccion) ? seleccion : '', requerido: true, placeholder: 'https://…' },
      ],
    }),
  );
  if (!datos?.url) return;
  const url = /^(https?:|mailto:|tel:)/i.test(datos.url) ? datos.url : `https://${datos.url}`;
  const a = document.createElement('a');
  a.href = url;
  a.textContent = datos.texto || url;
  editor.insertarHtml(a.outerHTML);
}

async function insertarBoton(editor, nodo = null) {
  const previo = nodo ? /^\[\[\s*(.+?)\s*\|\s*(.+?)\s*\]\]$/.exec(nodo.dataset.md) : null;
  const datos = await conSeleccion(editor, (seleccion) =>
    pedirDatos({
      titulo: nodo ? 'Editar botón' : 'Insertar botón',
      aceptar: nodo ? 'Guardar' : 'Insertar',
      campos: [
        { nombre: 'texto', etiqueta: 'Texto del botón', valor: previo?.[1] ?? (seleccion || 'Ver detalle'), requerido: true },
        { nombre: 'url', etiqueta: 'Enlace', tipo: 'url', valor: previo?.[2] ?? '', requerido: true, placeholder: 'https://…' },
      ],
    }),
  );
  if (!datos) return;
  const md = `[[${datos.texto.replace(/[|\]]/g, ' ')}|${/^(https?:|mailto:)/i.test(datos.url) ? datos.url : `https://${datos.url}`}]]`;
  const html = mdAEditable(md, contextoEditor());
  if (nodo) editor.reemplazarNodo(nodo, html);
  else editor.insertarHtml(`${html}<p><br></p>`);
}

async function accionDeBloque(boton) {
  if (boton.dataset.bloque === 'lenguaje') return elegirLenguaje(boton.closest('pre'));
  const nodo = boton.closest('.bloque-fijo');
  const editor = editores.find((e) => e.el.contains(nodo));
  if (!nodo || !editor) return;
  const accion = boton.dataset.bloque;
  if (accion === 'quitar') return editor.quitarNodo(nodo);
  if (accion === 'editar-boton') return insertarBoton(editor, nodo);
  if (accion === 'editar-progreso') {
    const md = await pedirProgreso(nodo.dataset.md);
    if (md) editor.reemplazarNodo(nodo, mdAEditable(md, contextoEditor()));
    return;
  }
  const m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(nodo.dataset.md ?? '');
  if (!m) return;
  let [pie, ancho] = m[1].split('|');
  if (accion === 'ancho') ancho = boton.dataset.valor === '100' ? '' : `${boton.dataset.valor}%`;
  if (accion === 'pie') {
    const datos = await pedirDatos({
      titulo: 'Pie de foto',
      aceptar: 'Guardar',
      campos: [{ nombre: 'pie', etiqueta: 'Texto bajo la imagen', valor: /^imagen\s*\d*$/i.test(pie ?? '') ? '' : pie, placeholder: 'Ej. Topología del enlace' }],
    });
    if (!datos) return;
    pie = datos.pie.replace(/[[\]|]/g, ' ') || 'Imagen';
  }
  editor.reemplazarNodo(nodo, mdAEditable(`![${pie ?? ''}${ancho ? `|${ancho}` : ''}](${m[2]})`, contextoEditor()));
}

async function insertarImagenes(archivos) {
  const validos = [...archivos].filter(esImagen);
  if (!validos.length) return false;
  let n = Object.keys(imagenes).length;
  const tokens = [];
  for (const archivo of validos) {
    try {
      const img = await procesarImagen(archivo);
      imagenes[img.id] = img;
      n++;
      tokens.push(`![${img.nombre || `Imagen ${n}`}](img:${img.id})`);
    } catch {
      aviso('No se pudo leer una de las imágenes.', { tipo: 'error' });
    }
  }
  if (!tokens.length) return true;
  guardarImagenes();
  const md = tokens.join('\n\n');
  if (modoEditor === 'codigo') insertarBloque(textoArea, md);
  else editorCuerpo.insertarHtml(`${mdAEditable(md, contextoEditor())}<p><br></p>`);
  aviso(tokens.length === 1 ? 'Imagen insertada.' : `${tokens.length} imágenes insertadas.`, { tipo: 'exito' });
  return true;
}

// ───────────────────────── Píldoras, progreso y comandos ─────────────────────────

const OPCIONES_COLOR_PILDORA = [
  { valor: '', etiqueta: 'Automático', ayuda: 'Según el texto: Resuelto → verde, Caído → rojo, En revisión → ámbar' },
  ...Object.entries(COLORES_PILDORA).map(([valor, c]) => ({ valor, etiqueta: c.nombre })),
];

async function pedirPildora(editor, previo = null) {
  const actual = previo ? leerPildora(previo.replace(/^\(\(|\)\)$/g, '')) : null;
  const datos = await conSeleccion(editor, (seleccion) =>
    pedirDatos({
      titulo: previo ? 'Editar etiqueta de estado' : 'Insertar etiqueta de estado',
      descripcion: 'Una etiqueta destaca un estado dentro del texto o de una tabla (Resuelto, En revisión, Crítico…).',
      aceptar: previo ? 'Guardar' : 'Insertar',
      campos: [
        { nombre: 'texto', etiqueta: 'Texto', valor: actual?.texto ?? seleccion.trim(), requerido: true, placeholder: 'Ej. Resuelto', sugerencias: ['Resuelto', 'En revisión', 'Pendiente', 'Escalado', 'Crítico', 'Operativo', 'Informativo'] },
        { nombre: 'color', etiqueta: 'Color', tipo: 'elegir', valor: actual?.explicito ? actual.color : '', opciones: OPCIONES_COLOR_PILDORA },
      ],
    }),
  );
  if (!datos?.texto) return null;
  const texto = datos.texto.replace(/[()]/g, '').trim();
  return `((${datos.color ? `${datos.color}:` : ''}${texto}))`;
}

async function insertarPildora(editor) {
  const md = await pedirPildora(editor);
  if (md) editor.insertarHtml(`${pildoraEditableHtml(md, contextoEditor())}&nbsp;`);
}

async function editarPildora(pildora) {
  const editor = editores.find((e) => e.el.contains(pildora));
  if (!editor) return;
  const md = await pedirPildora(editor, pildora.dataset.md ?? '');
  if (md) editor.reemplazarNodo(pildora, pildoraEditableHtml(md, contextoEditor()));
}

async function pedirProgreso(previo = null) {
  const m = previo ? /^%%\s*(\d{1,3})\s*%?\s*(?:\|\s*(.*))?$/.exec(previo) : null;
  const datos = await pedirDatos({
    titulo: previo ? 'Editar barra de progreso' : 'Insertar barra de progreso',
    descripcion: 'Muestra el avance de una tarea (migración, mantenimiento, despliegue…).',
    aceptar: previo ? 'Guardar' : 'Insertar',
    campos: [
      { nombre: 'texto', etiqueta: 'Descripción', valor: m?.[2] ?? '', placeholder: 'Ej. Avance de la migración' },
      { nombre: 'valor', etiqueta: 'Porcentaje (0 a 100)', valor: m?.[1] ?? '50', requerido: true, placeholder: '50' },
    ],
  });
  if (!datos) return null;
  const valor = Math.min(100, Math.max(0, Math.round(Number(String(datos.valor).replace(/[^\d.]/g, '')) || 0)));
  return `%% ${valor}${datos.texto ? ` | ${datos.texto.replace(/\n/g, ' ')}` : ''}`;
}

async function insertarProgreso(editor) {
  const md = await conSeleccion(editor, () => pedirProgreso());
  if (md) editor.insertarHtml(`${mdAEditable(md, contextoEditor())}<p><br></p>`);
}

async function elegirLenguaje(pre) {
  const editor = editores.find((e) => e.el.contains(pre));
  if (!editor) return;
  const datos = await pedirDatos({
    titulo: 'Equipo de los comandos',
    descripcion: 'Define cómo se resalta el prompt y la etiqueta del bloque.',
    aceptar: 'Aplicar',
    campos: [
      {
        nombre: 'lenguaje',
        etiqueta: 'Equipo',
        tipo: 'elegir',
        valor: pre.dataset.lenguaje ?? '',
        opciones: [
          { valor: 'cisco', etiqueta: 'Cisco IOS', ayuda: 'Router#  ·  Switch(config-if)#' },
          { valor: 'huawei', etiqueta: 'Huawei VRP', ayuda: '<HUAWEI>  ·  [HUAWEI-GigabitEthernet0/0/1]' },
          { valor: 'mikrotik', etiqueta: 'MikroTik RouterOS', ayuda: '[admin@MikroTik] /ip address>' },
          { valor: 'linux', etiqueta: 'Linux', ayuda: 'usuario@servidor:~$  ·  #' },
          { valor: '', etiqueta: 'Genérico', ayuda: 'Sin resaltado de prompt' },
        ],
      },
    ],
  });
  if (datos) cambiarLenguaje(editor, pre, datos.lenguaje);
}

async function aplicarFormato(nombre) {
  if (modoEditor === 'codigo' && editorActivo === editorCuerpo) {
    FORMATOS[nombre]?.(textoArea);
    return;
  }
  const editor = editorActivo;
  if (aplicarComandoVisual(editor, nombre)) return;
  if (nombre === 'enlace') return insertarEnlace(editor);
  if (nombre === 'pildora') return insertarPildora(editor);
  if (nombre === 'progreso' && !editor.unaLinea) return insertarProgreso(editor);
  if (nombre === 'boton' && !editor.unaLinea) return insertarBoton(editor);
  const automaticas = { 'variable-hoy': '{{hoy}}', 'variable-fecha': '{{fecha}}', 'variable-hora': '{{hora}}' };
  if (automaticas[nombre]) return editor.insertarHtml(`${chipHtml(automaticas[nombre], contextoEditor())}&nbsp;`);
  const tipos = { variable: 'obligatoria', 'variable-opcional': 'opcional', 'variable-opciones': 'opciones' };
  if (tipos[nombre]) return insertarVariable(editor, tipos[nombre]);
  if (editor.unaLinea) aviso('Eso solo se puede usar en el mensaje, no en el título.', { duracion: 2500 });
}

// ───────────────────────── Vista previa ─────────────────────────

const vista = $('#vistaPrevia');
const vistaLista = new Promise((resolver) => {
  vista.addEventListener('load', resolver, { once: true });
  vista.srcdoc =
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><base target="_blank">' +
    '<style>html,body{margin:0;padding:0;overflow:hidden;}</style></head><body></body></html>';
});

let vistaPendiente;
const generar = () => (sincronizarEditores(), construirCorreo({ ...estado, imagenes }, { ahora: new Date() }));

function programarVista() {
  clearTimeout(vistaPendiente);
  vistaPendiente = setTimeout(dibujarVista, 90);
}

/** La vista previa crece con el correo: un solo scroll (el de la página). */
function ajustarAlturaDeVista() {
  const doc = vista.contentDocument;
  if (!doc?.body) return;
  vista.style.height = '0px';
  vista.style.height = `${Math.max(doc.documentElement.scrollHeight, 240)}px`;
}

async function dibujarVista() {
  const resultado = generar();
  const faltan = resultado.faltantes.length;
  const nav = $('#faltanNav');
  nav.hidden = faltan === 0;
  nav.textContent = String(faltan);
  nav.title = faltan ? `Faltan: ${resultado.faltantes.join(', ')}` : '';
  const avisoVar = $('#avisoVariables');
  avisoVar.hidden = faltan === 0;
  avisoVar.textContent = faltan === 1 ? 'Falta 1 dato obligatorio' : `Faltan ${faltan} datos obligatorios`;
  avisoVar.title = resultado.faltantes.join(', ');
  $('#marcoAsunto').textContent = textoPlanoEnLinea(resultado.texto.split('\n')[0] || 'Sin título');

  if (estadoVista !== 'disenar') return;
  await vistaLista;
  const doc = vista.contentDocument;
  if (doc?.body) {
    doc.body.style.backgroundColor = resultado.fondo;
    // El HTML lo arma construirCorreo y escapa todo el texto de la persona.
    doc.body.innerHTML = resultado.html;
    for (const img of doc.images) if (!img.complete) img.addEventListener('load', ajustarAlturaDeVista, { once: true });
    ajustarAlturaDeVista();
  }
}

// ───────────────────────── Copiar y exportar ─────────────────────────

let temporizadorCopiado;
function marcarCopiado() {
  for (const b of $$('.boton-copiar')) b.classList.add('copiado');
  clearTimeout(temporizadorCopiado);
  temporizadorCopiado = setTimeout(() => $$('.boton-copiar').forEach((b) => b.classList.remove('copiado')), 1800);
}

async function copiarCorreo() {
  sincronizarEditores();
  const { html, texto, faltantes } = generar();
  const ok = await copiarConFormato(html, texto);
  if (!ok) return aviso('No se pudo copiar. Prueba con «Exportar → Descargar .html».', { tipo: 'error' });
  marcarCopiado();
  if (faltantes.length) {
    aviso(`Copiado, pero ${faltantes.length === 1 ? 'falta 1 dato' : `faltan ${faltantes.length} datos`}: ${faltantes.join(', ')}.`, {
      tipo: 'alerta',
      accion: 'Completar',
      alHacer: irAFaltante,
    });
  } else aviso('Correo copiado. Pégalo en Outlook con Ctrl+V.', { tipo: 'exito' });
}

async function copiarSoloTexto() {
  const ok = await copiarTexto(generar().texto);
  aviso(ok ? 'Texto sin formato copiado.' : 'No se pudo copiar.', { tipo: ok ? 'exito' : 'error' });
}

async function copiarCodigo() {
  const ok = await copiarTexto(generar().html);
  aviso(ok ? 'Código HTML copiado.' : 'No se pudo copiar.', { tipo: ok ? 'exito' : 'error' });
}

function nombreDeArchivo(base) {
  const limpio = String(base || 'correo')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return limpio || 'correo';
}

function descargarArchivo(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function descargarCorreo() {
  const { html, fondo, texto } = generar();
  const titulo = texto.split('\n')[0] || 'Correo';
  descargarArchivo(`${nombreDeArchivo(titulo)}.html`, documentoCompleto(html, titulo, fondo), 'text/html;charset=utf-8');
}

// ───────────────────────── Contenido y plantillas ─────────────────────────

const contenidoActual = () => (sincronizarEditores(), {
  texto: estado.texto,
  titulo: estado.encabezado.titulo,
  subtitulo: estado.encabezado.subtitulo,
  plantilla: estado.plantilla,
  valores: { ...estado.valores },
});

/**
 * Pone un contenido en el editor. Con `valores`, reemplaza también los datos (ticket, cliente…):
 * al cargar una plantilla se pasan vacíos para que no se cuelen datos de un caso anterior.
 * La firma, el diseño y el pie no se tocan.
 */
function aplicarContenido({ texto, titulo, subtitulo, plantilla = null, valores }) {
  estado.texto = texto;
  estado.encabezado.titulo = titulo;
  estado.encabezado.subtitulo = subtitulo;
  estado.plantilla = plantilla;
  if (valores) {
    estado.valores = { ...valores };
    firmaVariables = null;
  }
  poblarCampos();
  cargarEditores();
  alCambiarTexto();
  actualizarVariables();
  pintarPlantillaActiva();
  guardarEstado();
  if (valores) refrescarChips();
  programarVista();
}

function limpiarTexto() {
  const previo = contenidoActual();
  aplicarContenido({ texto: '', titulo: '', subtitulo: '', valores: {} });
  editorCuerpo.el.focus();
  aviso('Contenido borrado.', { accion: 'Deshacer', alHacer: () => aplicarContenido(previo) });
}

function vaciarVariables() {
  const previos = { ...estado.valores };
  for (const v of variablesActuales()) delete estado.valores[v.clave];
  firmaVariables = null;
  actualizarVariables();
  refrescarChips();
  guardarEstado();
  programarVista();
  aviso('Datos vaciados.', {
    accion: 'Deshacer',
    alHacer: () => {
      estado.valores = previos;
      firmaVariables = null;
      actualizarVariables();
      refrescarChips();
      guardarEstado();
      programarVista();
    },
  });
}

// Plantillas incluidas que la persona editó: id → { titulo, subtitulo, cuerpo, editadaEn }.
let ediciones = leer(CLAVES.ediciones, {}) || {};
// Plantillas incluidas que la persona eliminó (se pueden recuperar).
let ocultas = new Set((leer(CLAVES.ocultas, []) || []).filter((id) => typeof id === 'string'));

const todasLasPlantillas = () => [
  ...PLANTILLAS.filter((p) => !ocultas.has(p.id)).map((p) => (ediciones[p.id] ? { ...p, ...ediciones[p.id], editada: true } : p)),
  ...plantillasPropias.map((p) => ({ ...p, propia: true })),
];
const plantillaActiva = () => todasLasPlantillas().find((p) => p.id === estado.plantilla) ?? null;

/** Compara por bloques: el editor puede reordenar espacios sin que cambie el contenido. */
const mismoContenido = (a, b) => JSON.stringify(analizarBloques(a ?? '')) === JSON.stringify(analizarBloques(b ?? ''));

function hayCambiosEnPlantilla() {
  const p = plantillaActiva();
  if (!p) return false;
  return (
    !mismoContenido(p.cuerpo, estado.texto) ||
    (p.titulo ?? '').trim() !== estado.encabezado.titulo.trim() ||
    (p.subtitulo ?? '').trim() !== estado.encabezado.subtitulo.trim()
  );
}

function pintarEstadoPlantilla() {
  const p = plantillaActiva();
  const cambios = hayCambiosEnPlantilla();
  $('#cambiosPlantilla').hidden = !cambios;
  $('#plantillaActiva').textContent = p ? p.nombre : 'Mensaje libre';
  $('#plantillaActiva').title = p?.editada ? 'Plantilla incluida, con tus cambios guardados' : '';
}

function guardarEdiciones() {
  if (!guardar(CLAVES.ediciones, ediciones)) aviso('No se pudieron guardar los cambios en este navegador.', { tipo: 'error' });
  pintarPlantillas();
  pintarEstadoPlantilla();
}

/** Guarda el contenido actual en la plantilla que se está usando (incluida o propia). */
function guardarEnPlantilla() {
  sincronizarEditores();
  const p = plantillaActiva();
  if (!p) return abrirDialogoPlantilla();
  const datos = { titulo: estado.encabezado.titulo, subtitulo: estado.encabezado.subtitulo, cuerpo: estado.texto };
  if (p.propia) {
    const i = plantillasPropias.findIndex((x) => x.id === p.id);
    plantillasPropias[i] = { ...plantillasPropias[i], ...datos };
    guardarPlantillas();
  } else {
    ediciones[p.id] = { ...ediciones[p.id], ...datos, editadaEn: new Date().toISOString() };
    guardarEdiciones();
  }
  if (imagenesUsadas(datos.cuerpo).length) aviso('Nota: las imágenes pegadas no se guardan dentro de la plantilla.', { duracion: 5000 });
  aviso(`Cambios guardados en «${p.nombre}».`, { tipo: 'exito' });
  pintarEstadoPlantilla();
}

function restaurarPlantilla(id) {
  const previa = ediciones[id];
  if (!previa) return;
  delete ediciones[id];
  guardarEdiciones();
  const original = PLANTILLAS.find((p) => p.id === id);
  // Si es la plantilla abierta, el editor también vuelve al texto original.
  const contenidoPrevio = estado.plantilla === id ? contenidoActual() : null;
  if (contenidoPrevio && original) {
    aplicarContenido({ texto: original.cuerpo, titulo: original.titulo ?? '', subtitulo: original.subtitulo ?? '', plantilla: id });
  }
  aviso(`«${original?.nombre ?? 'Plantilla'}» volvió a su versión original.`, {
    accion: 'Deshacer',
    alHacer: () => {
      ediciones[id] = previa;
      guardarEdiciones();
      if (contenidoPrevio) aplicarContenido(contenidoPrevio);
    },
  });
}

function pintarPlantillas() {
  const filtro = $('#buscarPlantilla').value.trim().toLowerCase();
  const molde = $('#tplPlantilla');
  const visibles = todasLasPlantillas().filter(
    (p) => !filtro || [p.nombre, p.categoria, p.descripcion, p.cuerpo].join(' ').toLowerCase().includes(filtro),
  );

  const grupos = new Map();
  for (const p of visibles) {
    const grupo = p.propia ? 'Mis plantillas' : p.categoria || 'Otras';
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push(p);
  }

  const nodos = [];
  const libre = { id: '', nombre: 'Mensaje libre', descripcion: 'Empieza en blanco y pega tu propio contenido.', cuerpo: '', libre: true };
  if (!filtro) grupos.set('Empezar', [libre, ...(grupos.get('Empezar') ?? [])]);
  const orden = ['Empezar', 'Casos', 'Escalamientos', 'Accesos', 'Gestión', 'Mis plantillas'];
  const nombres = [...grupos.keys()].sort((a, b) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99));

  for (const nombre of nombres) {
    const titulo = document.createElement('h3');
    titulo.className = 'grupo-plantillas';
    titulo.textContent = nombre;
    nodos.push(titulo);
    for (const p of grupos.get(nombre)) {
      const nodo = molde.content.firstElementChild.cloneNode(true);
      nodo.dataset.id = p.libre ? '' : p.id;
      $('.ip-nombre', nodo).textContent = p.nombre;
      $('.ip-descripcion', nodo).textContent = p.descripcion || p.cuerpo.split('\n').find((l) => l.trim()) || '';
      if (!p.libre) {
        const vars = detectarVariables(p.cuerpo, p.titulo, p.subtitulo);
        const obligatorias = vars.filter((v) => !v.opcional && !v.predeterminado).length;
        const meta = $('.ip-meta', nodo);
        meta.textContent =
          vars.length === 0
            ? 'Sin datos que completar'
            : `${obligatorias} obligatorio${obligatorias === 1 ? '' : 's'} · ${vars.length - obligatorias} opcional${vars.length - obligatorias === 1 ? '' : 'es'}`;
        if (p.editada) {
          const marca = document.createElement('span');
          marca.className = 'ip-editada';
          marca.textContent = 'Editada';
          meta.append(marca);
        }
      } else $('.ip-meta', nodo).remove();
      $('.ip-usar', nodo).addEventListener('click', () => (p.libre ? usarMensajeLibre() : usarPlantilla(p)));
      if (p.libre) {
        $('.ip-editar', nodo).remove();
        $('.ip-eliminar', nodo).remove();
      } else {
        $('.ip-editar', nodo).addEventListener('click', () => abrirDialogoPlantilla({ modo: 'editar', id: p.id }));
        $('.ip-eliminar', nodo).addEventListener('click', () => eliminarPlantilla(p.id));
      }
      if (p.editada) {
        const restaurar = $('.ip-restaurar', nodo);
        restaurar.hidden = false;
        restaurar.addEventListener('click', () => restaurarPlantilla(p.id));
      }
      nodos.push(nodo);
    }
  }
  if (!visibles.length) {
    const vacio = document.createElement('p');
    vacio.className = 'vacio';
    vacio.textContent = 'No hay plantillas que coincidan.';
    nodos.push(vacio);
  }
  if (ocultas.size && !filtro) {
    const fila = document.createElement('div');
    fila.className = 'recuperar-plantillas';
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton-texto';
    boton.textContent = `Recuperar incluidas eliminadas (${ocultas.size})`;
    boton.addEventListener('click', recuperarIncluidas);
    fila.append(boton);
    nodos.push(fila);
  }
  $('#listaPlantillas').replaceChildren(...nodos);
  pintarPlantillaActiva();
  $('#categoriasPlantilla').replaceChildren(
    ...[...new Set(todasLasPlantillas().map((p) => p.categoria).filter(Boolean))].map((c) => Object.assign(document.createElement('option'), { value: c })),
  );
}

function pintarPlantillaActiva() {
  const activa = plantillaActiva();
  for (const item of $$('.item-plantilla')) item.classList.toggle('activa', item.dataset.id === (activa?.id ?? ''));
  pintarEstadoPlantilla();
}

function cerrarCajonEnPantallaChica() {
  if (window.matchMedia('(max-width: 1180px)').matches) alternarPlantillas(false);
}

function usarPlantilla(p) {
  const previo = contenidoActual();
  // Cada carga empieza con los datos vacíos: un correo nuevo no debe arrastrar el ticket o el cliente anterior.
  aplicarContenido({ texto: p.cuerpo, titulo: p.titulo ?? '', subtitulo: p.subtitulo ?? '', plantilla: p.id, valores: {} });
  if ((p.titulo || p.subtitulo) && !estado.encabezado.mostrar) {
    estado.encabezado.mostrar = true;
    poblarCampos();
    actualizarVariables();
  }
  cerrarCajonEnPantallaChica();
  aviso(`Plantilla «${p.nombre}» cargada con los datos en blanco.`, { accion: 'Deshacer', alHacer: () => aplicarContenido(previo) });
  ($('#variables .pendiente textarea') ?? editorCuerpo.el).focus();
}

function usarMensajeLibre() {
  const previo = contenidoActual();
  aplicarContenido({ texto: '', titulo: '', subtitulo: '', valores: {} });
  cerrarCajonEnPantallaChica();
  editorCuerpo.el.focus();
  if (previo.texto.trim()) aviso('Listo para un mensaje nuevo.', { accion: 'Deshacer', alHacer: () => aplicarContenido(previo) });
}

function guardarPlantillas() {
  if (!guardar(CLAVES.plantillas, plantillasPropias)) aviso('No se pudieron guardar las plantillas en este navegador.', { tipo: 'error' });
  pintarPlantillas();
}

const TEXTOS_DIALOGO = {
  guardar: {
    titulo: 'Guardar como plantilla',
    ayuda: 'Se guardan el título, el subtítulo y el mensaje actuales, con sus variables (no los datos que completaste). Si usas un nombre existente, se actualiza.',
    boton: 'Guardar',
  },
  nueva: {
    titulo: 'Nueva plantilla',
    ayuda: 'Se abre en blanco para que escribas el título, el subtítulo y el mensaje. Inserta lo que cambia en cada caso con el botón «Dato» y guarda con «Guardar en la plantilla» (Ctrl+S).',
    boton: 'Crear y escribir',
  },
  editar: {
    titulo: 'Editar plantilla',
    ayuda: 'Cambia el nombre, la categoría o la descripción. Para cambiar el texto, usa «Guardar y editar el contenido»: se abre en el editor y guardas con Ctrl+S.',
    boton: 'Guardar',
  },
};

let dialogoPlantilla = { modo: 'guardar', id: null };

function abrirDialogoPlantilla({ modo = 'guardar', id = null } = {}) {
  sincronizarEditores();
  if (modo === 'guardar' && !estado.texto.trim()) return aviso('Escribe un mensaje antes de guardarlo como plantilla.', { tipo: 'alerta' });
  const p = modo === 'editar' ? todasLasPlantillas().find((x) => x.id === id) : null;
  if (modo === 'editar' && !p) return;
  dialogoPlantilla = { modo, id };
  const dialogo = $('#dialogoPlantilla');
  const formulario = $('form', dialogo);
  formulario.reset();
  const textos = TEXTOS_DIALOGO[modo];
  $('#plantillaTitulo').textContent = textos.titulo;
  $('#plantillaAyuda').textContent = textos.ayuda;
  $('#plantillaGuardar').textContent = textos.boton;
  $('#plantillaEditarContenido').hidden = modo !== 'editar';
  if (modo === 'editar') {
    formulario.nombre.value = p.nombre;
    formulario.categoria.value = p.categoria ?? '';
    formulario.descripcion.value = p.descripcion ?? '';
  } else if (modo === 'guardar') {
    const propia = plantillasPropias.find((x) => x.id === estado.plantilla);
    formulario.nombre.value = propia?.nombre ?? estado.encabezado.titulo.replace(/\{\{[^}]*\}\}/g, '').replace(/[·\s]+$/, '').trim().slice(0, 80);
    formulario.categoria.value = propia?.categoria ?? plantillaActiva()?.categoria ?? '';
    formulario.descripcion.value = propia?.descripcion ?? '';
  }
  dialogo.showModal();
  formulario.nombre.select();
}

/** Nombre que no choca con otra plantilla propia (salvo la que se edita). */
function nombreLibre(nombre, salvoId = null) {
  const usados = new Set(plantillasPropias.filter((p) => p.id !== salvoId).map((p) => p.nombre.toLowerCase()));
  let candidato = nombre;
  for (let n = 2; usados.has(candidato.toLowerCase()); n++) candidato = `${nombre} (${n})`;
  return candidato;
}

function alCerrarDialogoPlantilla() {
  const dialogo = $('#dialogoPlantilla');
  const accion = dialogo.returnValue;
  if (accion !== 'guardar' && accion !== 'contenido') return;
  const formulario = $('form', dialogo);
  const nombre = formulario.nombre.value.trim();
  if (!nombre) return;
  const meta = {
    nombre,
    categoria: formulario.categoria.value.trim(),
    descripcion: formulario.descripcion.value.trim(),
  };
  const { modo, id } = dialogoPlantilla;

  if (modo === 'editar') return editarDatosPlantilla(id, meta, accion === 'contenido');
  if (modo === 'nueva') return crearPlantillaEnBlanco(meta);

  // guardar: el contenido actual como plantilla propia (si el nombre existe, se actualiza).
  const nueva = {
    id: `propia-${Date.now().toString(36)}`,
    ...meta,
    titulo: estado.encabezado.titulo,
    subtitulo: estado.encabezado.subtitulo,
    cuerpo: estado.texto,
  };
  const existente = plantillasPropias.findIndex((p) => p.nombre.toLowerCase() === nombre.toLowerCase());
  if (existente >= 0) {
    nueva.id = plantillasPropias[existente].id;
    plantillasPropias[existente] = nueva;
  } else plantillasPropias.unshift(nueva);
  estado.plantilla = nueva.id;
  guardarEstado();
  guardarPlantillas();
  if (imagenesUsadas(nueva.cuerpo).length) aviso('Nota: las imágenes pegadas no se guardan dentro de la plantilla.', { duracion: 5000 });
  aviso(existente >= 0 ? `Plantilla «${nombre}» actualizada.` : `Plantilla «${nombre}» guardada en «Mis plantillas».`, { tipo: 'exito' });
}

/** Crea una plantilla vacía y la abre en el editor para escribirla desde cero. */
function crearPlantillaEnBlanco(meta) {
  const nueva = { id: `propia-${Date.now().toString(36)}`, ...meta, nombre: nombreLibre(meta.nombre), titulo: '', subtitulo: '', cuerpo: '' };
  plantillasPropias.unshift(nueva);
  guardarPlantillas();
  const previo = contenidoActual();
  aplicarContenido({ texto: '', titulo: '', subtitulo: '', plantilla: nueva.id, valores: {} });
  if (!estado.encabezado.mostrar) {
    estado.encabezado.mostrar = true;
    poblarCampos();
  }
  cerrarCajonEnPantallaChica();
  editorCuerpo.el.focus();
  aviso(`«${nueva.nombre}» creada. Escribe el mensaje y guárdalo con Ctrl+S.`, {
    tipo: 'exito',
    duracion: 6000,
    accion: 'Deshacer',
    alHacer: () => {
      plantillasPropias = plantillasPropias.filter((p) => p.id !== nueva.id);
      guardarPlantillas();
      aplicarContenido(previo);
    },
  });
}

/** Cambia nombre, categoría y descripción; con `abrir`, la carga en el editor para cambiar el texto. */
function editarDatosPlantilla(id, meta, abrir) {
  const propia = plantillasPropias.findIndex((p) => p.id === id);
  if (propia >= 0) {
    plantillasPropias[propia] = { ...plantillasPropias[propia], ...meta, nombre: nombreLibre(meta.nombre, id) };
    guardarPlantillas();
  } else {
    const original = PLANTILLAS.find((p) => p.id === id);
    if (!original) return;
    // En las incluidas se guarda solo lo que difiere del original, para que «Restaurar» siga teniendo sentido.
    const cambios = Object.fromEntries(Object.entries(meta).filter(([k, v]) => v !== (original[k] ?? '')));
    const resto = Object.fromEntries(Object.entries(ediciones[id] ?? {}).filter(([k]) => !(k in meta) && k !== 'editadaEn'));
    const nueva = { ...resto, ...cambios };
    if (Object.keys(nueva).length) ediciones[id] = { ...nueva, editadaEn: new Date().toISOString() };
    else delete ediciones[id];
    guardarEdiciones();
  }
  const p = todasLasPlantillas().find((x) => x.id === id);
  if (abrir && p) {
    usarPlantilla(p);
    aviso(`Editando «${p.nombre}». Cambia el texto y guarda con Ctrl+S.`, { duracion: 6000 });
  } else aviso('Plantilla actualizada.', { tipo: 'exito' });
}

function eliminarPlantilla(id) {
  const indice = plantillasPropias.findIndex((p) => p.id === id);
  if (indice >= 0) {
    const [quitada] = plantillasPropias.splice(indice, 1);
    guardarPlantillas();
    aviso(`Plantilla «${quitada.nombre}» eliminada.`, {
      accion: 'Deshacer',
      duracion: 8000,
      alHacer: () => {
        plantillasPropias.splice(indice, 0, quitada);
        guardarPlantillas();
      },
    });
    return;
  }
  const incluida = todasLasPlantillas().find((p) => p.id === id && !p.propia);
  if (!incluida) return;
  ocultas.add(id);
  guardarOcultas();
  aviso(`Plantilla «${incluida.nombre}» eliminada. Puedes recuperarla al final de la lista.`, {
    accion: 'Deshacer',
    duracion: 8000,
    alHacer: () => {
      ocultas.delete(id);
      guardarOcultas();
    },
  });
}

function guardarOcultas() {
  if (!guardar(CLAVES.ocultas, [...ocultas])) aviso('No se pudo guardar el cambio en este navegador.', { tipo: 'error' });
  pintarPlantillas();
}

function recuperarIncluidas() {
  const total = ocultas.size;
  ocultas = new Set();
  guardarOcultas();
  aviso(total === 1 ? '1 plantilla recuperada.' : `${total} plantillas recuperadas.`, { tipo: 'exito' });
}

/** Exporta las plantillas propias y las incluidas que editaste (para compartir con el equipo). */
function exportarPlantillas() {
  const editadas = Object.keys(ediciones)
    .map((id) => todasLasPlantillas().find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => ({ base: p.id, nombre: p.nombre, categoria: p.categoria ?? '', descripcion: p.descripcion ?? '', titulo: p.titulo ?? '', subtitulo: p.subtitulo ?? '', cuerpo: p.cuerpo }));
  const lista = [...plantillasPropias, ...editadas];
  if (!lista.length) return aviso('Aún no tienes plantillas propias ni editadas para exportar.');
  descargarArchivo('plantillas-redacta.json', JSON.stringify(lista, null, 2), 'application/json');
}

async function importarPlantillas(archivo) {
  try {
    const datos = JSON.parse(await archivo.text());
    const validas = (Array.isArray(datos) ? datos : [datos]).filter(esPlantillaValida);
    let editadas = 0;
    const propias = [];
    for (const p of validas) {
      const limpia = {
        titulo: String(p.titulo ?? ''),
        subtitulo: String(p.subtitulo ?? ''),
        cuerpo: String(p.cuerpo),
      };
      if (p.base && PLANTILLAS.some((x) => x.id === p.base)) {
        ediciones[p.base] = { ...limpia, editadaEn: new Date().toISOString() };
        editadas++;
      } else {
        propias.push({
          id: `propia-${Math.random().toString(36).slice(2, 10)}`,
          nombre: String(p.nombre).slice(0, 80),
          categoria: String(p.categoria ?? '').slice(0, 40),
          descripcion: String(p.descripcion ?? '').slice(0, 200),
          ...limpia,
        });
      }
    }
    if (!propias.length && !editadas) return aviso('El archivo no tiene plantillas válidas.', { tipo: 'error' });
    const nombres = new Set(propias.map((p) => p.nombre.toLowerCase()));
    plantillasPropias = [...propias, ...plantillasPropias.filter((p) => !nombres.has(p.nombre.toLowerCase()))];
    guardar(CLAVES.ediciones, ediciones);
    guardarPlantillas();
    const total = propias.length + editadas;
    aviso(total === 1 ? '1 plantilla importada.' : `${total} plantillas importadas.`, { tipo: 'exito' });
  } catch {
    aviso('No se pudo leer el archivo. Debe ser un .json exportado desde Redacta.', { tipo: 'error' });
  }
}

// ───────────────────────── Vistas y paneles ─────────────────────────

let estadoVista = 'redactar';

function cambiarVista(nombre) {
  if (!['redactar', 'disenar'].includes(nombre)) nombre = 'redactar';
  estadoVista = nombre;
  for (const tab of $$('[role="tab"][data-vista-app]')) tab.setAttribute('aria-selected', String(tab.dataset.vistaApp === nombre));
  for (const panel of $$('.vista[data-vista]')) panel.hidden = panel.dataset.vista !== nombre;
  document.body.dataset.vistaActual = nombre;
  guardar(CLAVES.vista, nombre);
  if (nombre === 'disenar') dibujarVista();
  else reajustarCampos();
}

function alternarPlantillas(abrir) {
  const lateral = $('#lateralPlantillas');
  const cajon = window.matchMedia('(max-width: 1180px)').matches;
  const clase = cajon ? 'cajon-abierto' : 'plegado';
  const abierta = cajon ? lateral.classList.contains('cajon-abierto') : !lateral.classList.contains('plegado');
  const nuevo = abrir ?? !abierta;
  if (cajon) {
    lateral.classList.toggle('cajon-abierto', nuevo);
    $('.velo').hidden = !nuevo;
    if (nuevo) $('#buscarPlantilla').focus();
  } else {
    lateral.classList.toggle(clase, !nuevo);
    guardar(CLAVES.lateral, nuevo);
  }
}

function cambiarDispositivo(tipo) {
  for (const b of $$('[data-dispositivo]')) b.setAttribute('aria-pressed', String(b.dataset.dispositivo === tipo));
  $('#marco').classList.toggle('movil', tipo === 'movil');
  ajustarAlturaDeVista();
  setTimeout(ajustarAlturaDeVista, 360);
}

function irAFaltante() {
  cambiarVista('redactar');
  const pendiente = $('#variables .pendiente textarea');
  if (!pendiente) return;
  pendiente.scrollIntoView({ block: 'center', behavior: 'smooth' });
  pendiente.focus({ preventScroll: true });
}

// ───────────────────────── Eventos ─────────────────────────

const ACCIONES = {
  copiar: copiarCorreo,
  'copiar-texto': copiarSoloTexto,
  'copiar-html': copiarCodigo,
  descargar: descargarCorreo,
  limpiar: limpiarTexto,
  'vaciar-variables': vaciarVariables,
  'guardar-plantilla': () => abrirDialogoPlantilla({ modo: 'guardar' }),
  'nueva-plantilla': () => abrirDialogoPlantilla({ modo: 'nueva' }),
  exportar: exportarPlantillas,
  importar: () => $('#archivoPlantillas').click(),
  'elegir-imagen': () => $('#archivoImagen').click(),
  'alternar-plantillas': () => alternarPlantillas(),
  'cerrar-plantillas': () => alternarPlantillas(false),
  guia: () => $('#dialogoGuia').showModal(),
  'alternar-codigo': () => cambiarModoEditor(modoEditor === 'codigo' ? 'visual' : 'codigo'),
  'guardar-en-plantilla': guardarEnPlantilla,
};

// ───────────────────────── Barra de tabla ─────────────────────────

let celdaDeLaBarra = null;

function pintarBarraDeTabla() {
  const barra = $('#barraTabla');
  const celda = modoEditor === 'visual' ? celdaActual(editorCuerpo.el) : null;
  celdaDeLaBarra = celda;
  if (!celda) {
    barra.hidden = true;
    return;
  }
  const tabla = celda.closest('table');
  barra.hidden = false;
  // En la línea de tiempo solo se agregan o quitan filas (siempre son dos columnas).
  barra.classList.toggle('solo-filas', tabla.classList.contains('linea-tiempo'));
  const documento = editorCuerpo.el;
  const arriba = documento.offsetTop + tabla.offsetTop - barra.offsetHeight - 8;
  barra.style.top = `${Math.max(4, arriba)}px`;
  barra.style.left = `${documento.offsetLeft + tabla.offsetLeft}px`;
}

function enlazarEventos() {
  enlazarMenus(document);

  document.addEventListener('input', (e) => {
    alCambiarCampo(e);
    alEscribirVariable(e);
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('input[type="radio"], input[type="checkbox"], select, input[type="color"]')) alCambiarCampo(e);
  });

  document.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-accion]');
    if (accion) ACCIONES[accion.dataset.accion]?.();
    const formato = e.target.closest('[data-formato]');
    if (formato) {
      aplicarFormato(formato.dataset.formato);
      pintarEstiloActual();
    }
    const vistaApp = e.target.closest('[data-vista-app]');
    if (vistaApp) {
      e.preventDefault();
      cambiarVista(vistaApp.dataset.vistaApp);
    }
    const dispositivo = e.target.closest('[data-dispositivo]');
    if (dispositivo) cambiarDispositivo(dispositivo.dataset.dispositivo);
    const chip = e.target.closest('.chip-opcion');
    if (chip) elegirOpcion(chip);
    const botonDeBloque = e.target.closest('[data-bloque]');
    if (botonDeBloque) {
      e.preventDefault();
      accionDeBloque(botonDeBloque);
    }
    const chipVar = e.target.closest('.chip-var');
    if (chipVar && chipVar.dataset.clave && e.detail === 1) enfocarVariable(chipVar.dataset.clave);
  });

  document.addEventListener('dblclick', (e) => {
    const chipVar = e.target.closest('.chip-var');
    if (chipVar) {
      e.preventDefault();
      editarChip(chipVar);
      return;
    }
    const pildora = e.target.closest('.pildora');
    if (pildora && editores.some((ed) => ed.el.contains(pildora))) {
      e.preventDefault();
      editarPildora(pildora);
    }
  });

  // Estado de la barra (negrita activa, estilo del párrafo) según el cursor.
  document.addEventListener('selectionchange', () => {
    if (editores.some((ed) => ed.el.contains(document.activeElement))) pintarEstiloActual();
    if (document.activeElement === editorCuerpo.el) pintarBarraDeTabla();
  });
  editorCuerpo.el.addEventListener('blur', () => {
    // Deja la barra visible mientras se usa (sus botones no roban el foco).
    setTimeout(() => !editorCuerpo.el.contains(document.activeElement) && !$('#barraTabla').matches(':hover') && ($('#barraTabla').hidden = true), 150);
  });
  $('#barraTabla').addEventListener('mousedown', (e) => e.preventDefault());
  $('#barraTabla').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-tabla]');
    if (!boton || !celdaDeLaBarra?.isConnected) return;
    operarTabla(editorCuerpo, boton.dataset.tabla, celdaDeLaBarra);
    editorCuerpo.el.focus();
    pintarBarraDeTabla();
  });

  // Atajo Ctrl+K (enlace) en el editor visual.
  for (const editor of editores) {
    editor.el.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        insertarEnlace(editor);
      }
    });
  }

  // En un campo de una línea, Enter pasa al siguiente dato (Shift+Enter hace salto de línea).
  $('#variables').addEventListener('keydown', (e) => {
    const area = e.target.closest('[data-variable]');
    if (!area || e.key !== 'Enter' || e.shiftKey || area.closest('.campo-bloque')) return;
    e.preventDefault();
    const campos = $$('#variables [data-variable]');
    const siguiente = campos[campos.indexOf(area) + 1];
    if (siguiente) siguiente.focus();
    else editorCuerpo.el.focus();
  });

  $('.vistas').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = $$('.vistas [role="tab"]');
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const siguiente = tabs[(i + 1) % tabs.length];
    siguiente.focus();
    cambiarVista(siguiente.dataset.vistaApp);
  });

  $('#avisoVariables').addEventListener('click', irAFaltante);

  // Editor: atajos, estilo de la línea, imágenes pegadas o soltadas.
  textoArea.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const atajo = e.shiftKey ? null : { b: 'negrita', i: 'cursiva', u: 'subrayado', k: 'enlace' }[e.key.toLowerCase()];
    if (atajo) {
      e.preventDefault();
      FORMATOS[atajo](textoArea);
    }
  });
  for (const evento of ['keyup', 'click', 'select']) textoArea.addEventListener(evento, pintarEstiloActual);

  textoArea.addEventListener('paste', (e) => {
    const archivos = [...(e.clipboardData?.files ?? [])].filter(esImagen);
    if (!archivos.length) return;
    // Si además hay texto (p. ej. una celda de Excel), gana el texto.
    if (e.clipboardData.getData('text/plain').trim()) return;
    e.preventDefault();
    insertarImagenes(archivos);
  });

  const cuerpo = $('#hojaCuerpo');
  const conArchivos = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
  cuerpo.addEventListener('dragover', (e) => {
    if (!conArchivos(e)) return;
    e.preventDefault();
    cuerpo.classList.add('soltando');
  });
  cuerpo.addEventListener('dragleave', (e) => {
    if (!cuerpo.contains(e.relatedTarget)) cuerpo.classList.remove('soltando');
  });
  cuerpo.addEventListener('drop', (e) => {
    cuerpo.classList.remove('soltando');
    if (!conArchivos(e)) return;
    e.preventDefault();
    insertarImagenes(e.dataTransfer.files).then((ok) => ok || aviso('Solo se pueden insertar imágenes.', { tipo: 'alerta' }));
  });
  $('#archivoImagen').addEventListener('change', (e) => {
    insertarImagenes(e.target.files);
    e.target.value = '';
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      copiarCorreo();
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      guardarEnPlantilla();
    }
    if (e.altKey && !e.ctrlKey && (e.key === '1' || e.key === '2')) {
      e.preventDefault();
      cambiarVista(e.key === '1' ? 'redactar' : 'disenar');
    }
    if (e.key === 'Escape' && $('#lateralPlantillas').classList.contains('cajon-abierto')) alternarPlantillas(false);
  });

  $('#buscarPlantilla').addEventListener('input', pintarPlantillas);
  $('#dialogoPlantilla').addEventListener('close', alCerrarDialogoPlantilla);
  for (const dialogo of $$('dialog')) {
    dialogo.addEventListener('click', (e) => e.target === dialogo && dialogo.close());
  }
  $('#archivoPlantillas').addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (archivo) importarPlantillas(archivo);
    e.target.value = '';
  });

  window.matchMedia('(max-width: 1180px)').addEventListener('change', () => {
    $('#lateralPlantillas').classList.remove('cajon-abierto');
    $('.velo').hidden = true;
  });

  window.addEventListener('resize', () => {
    if (estadoVista === 'disenar') ajustarAlturaDeVista();
    else reajustarCampos();
  });
  document.fonts?.ready.then(reajustarCampos);

  // Refresca {{hoy}} / {{hora}} cada minuto.
  setInterval(programarVista, 60_000);
}

// ───────────────────────── Inicio ─────────────────────────

construirControlesDeDiseno();
poblarCampos();
cargarEditores();
if (modoEditor === 'codigo') cambiarModoEditor('codigo');
actualizarVariables();
alCambiarTexto();
pintarPlantillas();
enlazarEventos();
if (leer(CLAVES.lateral, true) === false) $('#lateralPlantillas').classList.add('plegado');
cambiarVista(leer(CLAVES.vista, 'redactar'));
dibujarVista();
