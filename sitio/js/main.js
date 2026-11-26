// Interfaz: dos vistas (Redactar · Diseñar), campos enlazados al estado, vista previa y copia.

import { construirCorreo, documentoCompleto, DISENOS, estadoPredeterminado, FUENTES, PALETA, colorValido } from './correo.js';
import { detectarVariables, textoPlanoEnLinea } from './formato.js';
import { EJEMPLO_INICIAL, PLANTILLAS } from './plantillas.js';
import { guardar, leer } from './almacen.js';
import { copiarConFormato, copiarTexto } from './portapapeles.js';
import { aviso } from './aviso.js';
import { enlazarMenus, estiloDeLinea, FORMATOS, insertarBloque } from './editor.js';
import { esImagen, imagenesUsadas, pesoLegible, procesarImagen } from './imagenes.js';

const CLAVES = {
  estado: 'redacta:estado:v1',
  plantillas: 'redacta:plantillas:v1',
  imagenes: 'redacta:imagenes:v1',
  vista: 'redacta:vista',
  lateral: 'redacta:lateral-plantillas',
};

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const textoArea = $('#texto');

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
  $('#anchoValor').textContent = `${estado.ajustes.ancho} px`;
  marcarPaleta();
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
    bloque: enCuerpo.get(v.clave) ?? false,
  }));
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
    for (const area of $$('textarea', contenedor)) autoCrecer(area);
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

// ───────────────────────── Editor ─────────────────────────

function alCambiarTexto() {
  pintarEstadoDelTexto();
  pintarImagenes();
}

function pintarEstadoDelTexto() {
  const palabras = textoPlanoEnLinea(estado.texto.replace(/\{\{[^}]*\}\}/g, 'x')).match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const n = imagenesUsadas(estado.texto).length;
  $('#estadoTexto').textContent = `${palabras} ${palabras === 1 ? 'palabra' : 'palabras'}${n ? ` · ${n} ${n === 1 ? 'imagen' : 'imágenes'}` : ''}`;
}

function pintarEstiloActual() {
  $('#estiloActual').textContent = estiloDeLinea(textoArea);
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
  insertarBloque(textoArea, tokens.join('\n\n'), { seleccionar: [2, 2 + tokens[0].indexOf(']') - 2] });
  aviso(tokens.length === 1 ? 'Imagen insertada. Puedes escribirle un pie de foto.' : `${tokens.length} imágenes insertadas.`, { tipo: 'exito' });
  return true;
}

function pintarImagenes() {
  const tira = $('#tiraImagenes');
  const usadas = [...new Set(imagenesUsadas(estado.texto))].filter((id) => imagenes[id]);
  tira.hidden = usadas.length === 0;
  const actuales = $$('.miniatura-imagen', tira).map((n) => n.dataset.id).join();
  if (actuales === usadas.join()) return;
  tira.replaceChildren(
    ...usadas.map((id) => {
      const img = imagenes[id];
      const item = document.createElement('div');
      item.className = 'miniatura-imagen';
      item.dataset.id = id;
      const ir = document.createElement('button');
      ir.type = 'button';
      ir.className = 'mi-ir';
      ir.title = 'Ir a la imagen en el texto';
      const vista = Object.assign(document.createElement('img'), { src: img.src, alt: '' });
      const datos = document.createElement('span');
      datos.textContent = `${img.ancho}×${img.alto} · ${pesoLegible(img.src)}`;
      ir.append(vista, datos);
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'boton-icono mi-quitar';
      quitar.setAttribute('aria-label', 'Quitar imagen');
      quitar.innerHTML = '<svg class="ico"><use href="#i-cerrar"/></svg>';
      item.append(ir, quitar);
      return item;
    }),
  );
}

function rangoDeImagen(id) {
  const m = new RegExp(`!\\[[^\\]]*\\]\\(img:${id}\\)`).exec(textoArea.value);
  return m ? [m.index, m.index + m[0].length] : null;
}

function irAImagen(id) {
  const rango = rangoDeImagen(id);
  if (!rango) return;
  textoArea.focus();
  textoArea.setSelectionRange(...rango);
  const antes = textoArea.value.slice(0, rango[0]).split('\n').length;
  const alto = parseFloat(getComputedStyle(textoArea).lineHeight) || 22;
  textoArea.scrollTop = Math.max(0, (antes - 4) * alto);
}

function quitarImagen(id) {
  const rango = rangoDeImagen(id);
  if (!rango) return;
  let [a, b] = rango;
  const v = textoArea.value;
  while (v[b] === '\n' && b - a < 9999 && v[b + 1] === '\n') b++;
  textoArea.focus();
  textoArea.setSelectionRange(a, b);
  document.execCommand('delete') || textoArea.setRangeText('', a, b, 'end');
  textoArea.dispatchEvent(new Event('input', { bubbles: true }));
  aviso('Imagen quitada. Ctrl+Z la recupera.');
}

// ───────────────────────── Vista previa ─────────────────────────

const vista = $('#vistaPrevia');
const vistaLista = new Promise((resolver) => {
  vista.addEventListener('load', resolver, { once: true });
  vista.srcdoc =
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><base target="_blank">' +
    '<style>html,body{margin:0;padding:0;}body{min-height:100vh;}</style></head><body></body></html>';
});

let vistaPendiente;
const generar = () => construirCorreo({ ...estado, imagenes }, { ahora: new Date() });

function programarVista() {
  clearTimeout(vistaPendiente);
  vistaPendiente = setTimeout(dibujarVista, 90);
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

const contenidoActual = () => ({
  texto: estado.texto,
  titulo: estado.encabezado.titulo,
  subtitulo: estado.encabezado.subtitulo,
  plantilla: estado.plantilla,
});

function aplicarContenido({ texto, titulo, subtitulo, plantilla = null }) {
  estado.texto = texto;
  estado.encabezado.titulo = titulo;
  estado.encabezado.subtitulo = subtitulo;
  estado.plantilla = plantilla;
  poblarCampos();
  alCambiarTexto();
  actualizarVariables();
  pintarPlantillaActiva();
  guardarEstado();
  programarVista();
}

function limpiarTexto() {
  const previo = contenidoActual();
  aplicarContenido({ texto: '', titulo: '', subtitulo: '' });
  textoArea.focus();
  aviso('Contenido borrado.', { accion: 'Deshacer', alHacer: () => aplicarContenido(previo) });
}

function vaciarVariables() {
  const previos = { ...estado.valores };
  for (const v of variablesActuales()) delete estado.valores[v.clave];
  firmaVariables = null;
  actualizarVariables();
  guardarEstado();
  programarVista();
  aviso('Datos vaciados.', {
    accion: 'Deshacer',
    alHacer: () => {
      estado.valores = previos;
      firmaVariables = null;
      actualizarVariables();
      guardarEstado();
      programarVista();
    },
  });
}

const todasLasPlantillas = () => [...PLANTILLAS, ...plantillasPropias.map((p) => ({ ...p, propia: true }))];

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
        $('.ip-meta', nodo).textContent =
          vars.length === 0 ? 'Sin datos que completar' : `${obligatorias} obligatorio${obligatorias === 1 ? '' : 's'} · ${vars.length - obligatorias} opcional${vars.length - obligatorias === 1 ? '' : 'es'}`;
      } else $('.ip-meta', nodo).remove();
      $('.ip-usar', nodo).addEventListener('click', () => (p.libre ? usarMensajeLibre() : usarPlantilla(p)));
      if (p.propia) {
        const eliminar = $('.ip-eliminar', nodo);
        eliminar.hidden = false;
        eliminar.addEventListener('click', () => eliminarPlantilla(p.id));
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
  $('#listaPlantillas').replaceChildren(...nodos);
  pintarPlantillaActiva();
  $('#categoriasPlantilla').replaceChildren(
    ...[...new Set(todasLasPlantillas().map((p) => p.categoria).filter(Boolean))].map((c) => Object.assign(document.createElement('option'), { value: c })),
  );
}

function pintarPlantillaActiva() {
  const activa = todasLasPlantillas().find((p) => p.id === estado.plantilla);
  for (const item of $$('.item-plantilla')) item.classList.toggle('activa', item.dataset.id === (activa?.id ?? ''));
  $('#plantillaActiva').textContent = activa ? activa.nombre : 'Mensaje libre';
}

function cerrarCajonEnPantallaChica() {
  if (window.matchMedia('(max-width: 1180px)').matches) alternarPlantillas(false);
}

function usarPlantilla(p) {
  const previo = contenidoActual();
  aplicarContenido({ texto: p.cuerpo, titulo: p.titulo ?? '', subtitulo: p.subtitulo ?? '', plantilla: p.id });
  if ((p.titulo || p.subtitulo) && !estado.encabezado.mostrar) {
    estado.encabezado.mostrar = true;
    poblarCampos();
    actualizarVariables();
  }
  cerrarCajonEnPantallaChica();
  aviso(`Plantilla «${p.nombre}» cargada.`, { accion: 'Deshacer', alHacer: () => aplicarContenido(previo) });
  ($('#variables .pendiente textarea') ?? textoArea).focus();
}

function usarMensajeLibre() {
  const previo = contenidoActual();
  aplicarContenido({ texto: '', titulo: '', subtitulo: '' });
  cerrarCajonEnPantallaChica();
  textoArea.focus();
  if (previo.texto.trim()) aviso('Listo para un mensaje nuevo.', { accion: 'Deshacer', alHacer: () => aplicarContenido(previo) });
}

function guardarPlantillas() {
  if (!guardar(CLAVES.plantillas, plantillasPropias)) aviso('No se pudieron guardar las plantillas en este navegador.', { tipo: 'error' });
  pintarPlantillas();
}

function abrirDialogoPlantilla() {
  if (!estado.texto.trim()) return aviso('Escribe un mensaje antes de guardarlo como plantilla.', { tipo: 'alerta' });
  const dialogo = $('#dialogoPlantilla');
  const formulario = $('form', dialogo);
  formulario.reset();
  const propia = plantillasPropias.find((p) => p.id === estado.plantilla);
  formulario.nombre.value = propia?.nombre ?? estado.encabezado.titulo.replace(/\{\{[^}]*\}\}/g, '').replace(/[·\s]+$/, '').trim().slice(0, 80);
  formulario.categoria.value = propia?.categoria ?? '';
  dialogo.showModal();
  formulario.nombre.select();
}

function alCerrarDialogoPlantilla() {
  const dialogo = $('#dialogoPlantilla');
  if (dialogo.returnValue !== 'guardar') return;
  const formulario = $('form', dialogo);
  const nombre = formulario.nombre.value.trim();
  if (!nombre) return;
  const nueva = {
    id: `propia-${Date.now().toString(36)}`,
    nombre,
    categoria: formulario.categoria.value.trim(),
    descripcion: '',
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

function eliminarPlantilla(id) {
  const indice = plantillasPropias.findIndex((p) => p.id === id);
  if (indice < 0) return;
  const [quitada] = plantillasPropias.splice(indice, 1);
  guardarPlantillas();
  aviso(`Plantilla «${quitada.nombre}» eliminada.`, {
    accion: 'Deshacer',
    alHacer: () => {
      plantillasPropias.splice(indice, 0, quitada);
      guardarPlantillas();
    },
  });
}

function exportarPlantillas() {
  if (!plantillasPropias.length) return aviso('Aún no tienes plantillas propias para exportar.');
  descargarArchivo('plantillas-redacta.json', JSON.stringify(plantillasPropias, null, 2), 'application/json');
}

async function importarPlantillas(archivo) {
  try {
    const datos = JSON.parse(await archivo.text());
    const lista = (Array.isArray(datos) ? datos : [datos]).filter(esPlantillaValida).map((p) => ({
      id: `propia-${Math.random().toString(36).slice(2, 10)}`,
      nombre: String(p.nombre).slice(0, 80),
      categoria: String(p.categoria ?? '').slice(0, 40),
      descripcion: String(p.descripcion ?? '').slice(0, 200),
      titulo: String(p.titulo ?? ''),
      subtitulo: String(p.subtitulo ?? ''),
      cuerpo: String(p.cuerpo),
    }));
    if (!lista.length) return aviso('El archivo no tiene plantillas válidas.', { tipo: 'error' });
    const nombres = new Set(lista.map((p) => p.nombre.toLowerCase()));
    plantillasPropias = [...lista, ...plantillasPropias.filter((p) => !nombres.has(p.nombre.toLowerCase()))];
    guardarPlantillas();
    aviso(lista.length === 1 ? '1 plantilla importada.' : `${lista.length} plantillas importadas.`, { tipo: 'exito' });
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
  'guardar-plantilla': abrirDialogoPlantilla,
  exportar: exportarPlantillas,
  importar: () => $('#archivoPlantillas').click(),
  'elegir-imagen': () => $('#archivoImagen').click(),
  'alternar-plantillas': () => alternarPlantillas(),
  'cerrar-plantillas': () => alternarPlantillas(false),
  guia: () => $('#dialogoGuia').showModal(),
};

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
      FORMATOS[formato.dataset.formato]?.(textoArea);
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
    const ir = e.target.closest('.mi-ir');
    if (ir) irAImagen(ir.closest('.miniatura-imagen').dataset.id);
    const quitar = e.target.closest('.mi-quitar');
    if (quitar) quitarImagen(quitar.closest('.miniatura-imagen').dataset.id);
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

  // Refresca {{hoy}} / {{hora}} cada minuto.
  setInterval(programarVista, 60_000);
}

// ───────────────────────── Inicio ─────────────────────────

construirControlesDeDiseno();
poblarCampos();
actualizarVariables();
alCambiarTexto();
pintarPlantillas();
enlazarEventos();
if (leer(CLAVES.lateral, true) === false) $('#lateralPlantillas').classList.add('plegado');
cambiarVista(leer(CLAVES.vista, 'redactar'));
dibujarVista();
