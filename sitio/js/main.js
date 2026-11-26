// Interfaz: enlaza los campos con el estado, dibuja la vista previa y copia el correo.

import { construirCorreo, documentoCompleto, DISENOS, estadoPredeterminado, FUENTES, PALETA, colorValido } from './correo.js';
import { detectarVariables } from './formato.js';
import { EJEMPLO_INICIAL, PLANTILLAS } from './plantillas.js';
import { guardar, leer } from './almacen.js';
import { copiarConFormato, copiarTexto } from './portapapeles.js';
import { aviso } from './aviso.js';

const CLAVE_ESTADO = 'redacta:estado:v1';
const CLAVE_PLANTILLAS = 'redacta:plantillas:v1';
const CLAVE_PESTANA = 'redacta:pestana';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// ───────────────────────── Estado ─────────────────────────

function cargarEstado() {
  const base = estadoPredeterminado();
  const guardado = leer(CLAVE_ESTADO, null);
  if (!guardado || typeof guardado !== 'object') {
    base.texto = EJEMPLO_INICIAL.texto;
    base.encabezado.titulo = EJEMPLO_INICIAL.titulo;
    base.encabezado.subtitulo = EJEMPLO_INICIAL.subtitulo;
    return base;
  }
  for (const clave of Object.keys(base)) {
    const valor = guardado[clave];
    if (valor == null) continue;
    if (typeof base[clave] === 'object') base[clave] = { ...base[clave], ...valor };
    else if (typeof valor === typeof base[clave]) base[clave] = valor;
  }
  return base;
}

const estado = cargarEstado();
let plantillasPropias = (leer(CLAVE_PLANTILLAS, []) || []).filter(esPlantillaValida);

function esPlantillaValida(p) {
  return p && typeof p === 'object' && typeof p.nombre === 'string' && p.nombre.trim() && typeof p.cuerpo === 'string';
}

let guardarPendiente;
function guardarEstado() {
  clearTimeout(guardarPendiente);
  guardarPendiente = setTimeout(() => guardar(CLAVE_ESTADO, estado), 250);
}

const obtener = (ruta) => ruta.split('.').reduce((o, k) => o?.[k], estado);
function asignar(ruta, valor) {
  const partes = ruta.split('.');
  const ultima = partes.pop();
  partes.reduce((o, k) => o[k], estado)[ultima] = valor;
}

// ───────────────────────── Campos ─────────────────────────

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
    else el.value = valor ?? '';
  }
  actualizarDependientes();
  actualizarAncho();
  marcarPaleta();
}

function actualizarDependientes() {
  for (const el of $$('[data-depende]')) el.classList.toggle('apagado', !obtener(el.dataset.depende));
}

function actualizarAncho() {
  $('#anchoValor').textContent = `${estado.ajustes.ancho} px`;
}

function alCambiarCampo(evento) {
  const el = evento.target.closest('[data-campo]');
  if (!el || (el.type === 'radio' && !el.checked)) return;
  const ruta = el.dataset.campo;
  asignar(ruta, valorDe(el));
  if (ruta === 'ajustes.color') marcarPaleta();
  if (ruta === 'ajustes.ancho') actualizarAncho();
  if (ruta.endsWith('.mostrar')) actualizarDependientes();
  if (ruta === 'texto' || ruta.startsWith('encabezado.')) actualizarVariables();
  guardarEstado();
  programarVista();
}

// ───────────────────────── Diseño ─────────────────────────

function construirOpcionesDeDiseno() {
  const disenos = $('#disenos');
  for (const [id, d] of Object.entries(DISENOS)) {
    const etiqueta = document.createElement('label');
    etiqueta.className = `tarjeta-diseno diseno-${id}`;
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'diseno';
    radio.value = id;
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
    etiqueta.title = nombre;
    etiqueta.style.setProperty('--muestra', color);
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'color';
    radio.value = color;
    radio.dataset.campo = 'ajustes.color';
    radio.setAttribute('aria-label', nombre);
    etiqueta.append(radio);
    paleta.append(etiqueta);
  }
  const propio = document.createElement('label');
  propio.className = 'muestra muestra-propia';
  propio.title = 'Color personalizado';
  const selector = document.createElement('input');
  selector.type = 'color';
  selector.dataset.campo = 'ajustes.color';
  selector.setAttribute('aria-label', 'Color personalizado');
  propio.append(selector);
  paleta.append(propio);

  const fuente = $('#fuente');
  for (const [id, f] of Object.entries(FUENTES)) {
    const opcion = document.createElement('option');
    opcion.value = id;
    opcion.textContent = f.nombre;
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
  // Solo una variable sola en una línea del mensaje pide campo grande; en el título o subtítulo no.
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

function actualizarVariables() {
  const variables = variablesActuales();
  const firma = variables.map((v) => [v.clave, v.predeterminado, v.opcional, v.bloque].join('\u0000')).join('\n');
  $('#grupoVariables').hidden = variables.length === 0;

  if (firma !== firmaVariables) {
    firmaVariables = firma;
    const contenedor = $('#variables');
    const conFoco = document.activeElement?.dataset?.variable;
    contenedor.replaceChildren(
      ...variables.map((v) => {
        const etiqueta = document.createElement('label');
        etiqueta.className = `campo campo-variable${v.bloque ? ' campo-bloque' : ''}`;
        const nombre = document.createElement('span');
        const texto = document.createElement('span');
        texto.textContent = v.nombre;
        nombre.append(texto);
        if (v.opcional) {
          const chip = document.createElement('em');
          chip.className = 'chip-opcional';
          chip.textContent = 'opcional';
          nombre.append(chip);
        }
        const area = document.createElement('textarea');
        area.rows = v.bloque ? 4 : 1;
        area.dataset.variable = v.clave;
        area.value = estado.valores[v.clave] ?? '';
        area.placeholder =
          v.predeterminado ||
          (v.bloque
            ? 'Escribe o pega aquí (una tabla copiada de Excel se convierte en tabla)'
            : v.opcional
              ? 'Déjalo vacío para no incluirlo'
              : `Escribe ${v.nombre.toLowerCase()}`);
        etiqueta.append(nombre, area);
        return etiqueta;
      }),
    );
    for (const area of $$('textarea', contenedor)) autoCrecer(area);
    if (conFoco) $(`[data-variable="${CSS.escape(conFoco)}"]`, contenedor)?.focus();
  }
  pintarConteoDeVariables(variables);
}

function pintarConteoDeVariables(variables = variablesActuales()) {
  const obligatorias = variables.filter((v) => !v.opcional);
  const completas = obligatorias.filter((v) => (estado.valores[v.clave] ?? '').trim() || v.predeterminado).length;
  const conteo = $('#conteoVariables');
  conteo.textContent = obligatorias.length ? `${completas}/${obligatorias.length} obligatorias` : 'todas opcionales';
  conteo.classList.toggle('completa', completas === obligatorias.length);
  for (const area of $$('#variables textarea')) {
    const v = variables.find((x) => x.clave === area.dataset.variable);
    area.classList.toggle('pendiente', Boolean(v && !v.opcional && !area.value.trim() && !v.predeterminado));
  }
}

function alEscribirVariable(evento) {
  const area = evento.target.closest('[data-variable]');
  if (!area) return;
  estado.valores[area.dataset.variable] = area.value;
  autoCrecer(area);
  pintarConteoDeVariables();
  guardarEstado();
  programarVista();
}

// ───────────────────────── Vista previa ─────────────────────────

const vista = $('#vistaPrevia');
const vistaLista = new Promise((resolver) => {
  vista.addEventListener('load', resolver, { once: true });
  vista.srcdoc =
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><base target="_blank">' +
    '<style>html,body{margin:0;padding:0;}body{min-height:100vh;}</style></head><body></body></html>';
});

let ultimoResultado = null;
let vistaPendiente;

function generar() {
  ultimoResultado = construirCorreo(estado, { ahora: new Date() });
  return ultimoResultado;
}

function programarVista() {
  clearTimeout(vistaPendiente);
  vistaPendiente = setTimeout(dibujarVista, 90);
}

async function dibujarVista() {
  const resultado = generar();
  await vistaLista;
  const doc = vista.contentDocument;
  if (doc?.body) {
    doc.body.style.backgroundColor = resultado.fondo;
    // El HTML lo arma construirCorreo y escapa todo el texto de la persona.
    doc.body.innerHTML = resultado.html;
  }
  const faltan = resultado.faltantes.length;
  const avisoVar = $('#avisoVariables');
  avisoVar.hidden = faltan === 0;
  avisoVar.textContent = faltan === 1 ? 'Falta 1 variable' : `Faltan ${faltan} variables`;
  avisoVar.title = resultado.faltantes.join(', ');
}

// ───────────────────────── Acciones ─────────────────────────

async function copiarCorreo() {
  const { html, texto, faltantes } = generar();
  const ok = await copiarConFormato(html, texto);
  if (!ok) return aviso('No se pudo copiar. Prueba con «Descargar» o desde otro navegador.', { tipo: 'error' });
  if (faltantes.length) {
    aviso(`Copiado, pero ${faltantes.length === 1 ? 'falta 1 variable' : `faltan ${faltantes.length} variables`} (resaltadas en amarillo).`, {
      tipo: 'alerta',
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
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function descargarCorreo() {
  const { html, fondo } = generar();
  const titulo = estado.encabezado.titulo || 'Correo';
  descargarArchivo(`${nombreDeArchivo(titulo)}.html`, documentoCompleto(html, titulo, fondo), 'text/html;charset=utf-8');
}

function aplicarContenido({ texto, titulo, subtitulo }) {
  estado.texto = texto;
  estado.encabezado.titulo = titulo;
  estado.encabezado.subtitulo = subtitulo;
  poblarCampos();
  actualizarVariables();
  guardarEstado();
  programarVista();
}

const contenidoActual = () => ({ texto: estado.texto, titulo: estado.encabezado.titulo, subtitulo: estado.encabezado.subtitulo });

async function pegarDelPortapapeles() {
  try {
    const texto = await navigator.clipboard.readText();
    if (!texto) return aviso('El portapapeles está vacío.');
    insertarEnCursor($('#texto'), texto);
  } catch {
    $('#texto').focus();
    aviso('Tu navegador no permite leer el portapapeles: pega con Ctrl+V.');
  }
}

function limpiarTexto() {
  const previo = contenidoActual();
  aplicarContenido({ texto: '', titulo: '', subtitulo: '' });
  $('#texto').focus();
  aviso('Contenido borrado.', { accion: 'Deshacer', alHacer: () => aplicarContenido(previo) });
}

function vaciarVariables() {
  const previos = { ...estado.valores };
  for (const v of variablesActuales()) delete estado.valores[v.clave];
  firmaVariables = null;
  actualizarVariables();
  guardarEstado();
  programarVista();
  aviso('Variables vaciadas.', {
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

// ───────────────────────── Barra de formato ─────────────────────────

function reemplazar(area, inicio, fin, texto, selInicio = texto.length, selFin = selInicio) {
  area.focus();
  area.setSelectionRange(inicio, fin);
  let hecho = false;
  try {
    hecho = document.execCommand('insertText', false, texto); // conserva Ctrl+Z
  } catch {
    hecho = false;
  }
  if (!hecho || area.value.slice(inicio, inicio + texto.length) !== texto) {
    area.setRangeText(texto, inicio, fin, 'end');
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }
  area.setSelectionRange(inicio + selInicio, inicio + selFin);
}

function insertarEnCursor(area, texto) {
  reemplazar(area, area.selectionStart, area.selectionEnd, texto);
}

function envolver(area, antes, despues, relleno) {
  const { selectionStart: a, selectionEnd: b, value } = area;
  const seleccion = value.slice(a, b);
  // Si ya está envuelto, lo quita.
  if (seleccion && value.slice(a - antes.length, a) === antes && value.slice(b, b + despues.length) === despues) {
    reemplazar(area, a - antes.length, b + despues.length, seleccion, 0, seleccion.length);
    return;
  }
  const contenido = seleccion || relleno;
  reemplazar(area, a, b, antes + contenido + despues, antes.length, antes.length + contenido.length);
}

function prefijarLineas(area, prefijo, reconocer) {
  const { value } = area;
  const inicio = value.lastIndexOf('\n', area.selectionStart - 1) + 1;
  let fin = value.indexOf('\n', area.selectionEnd - (area.selectionEnd > area.selectionStart && value[area.selectionEnd - 1] === '\n' ? 1 : 0));
  if (fin === -1) fin = value.length;
  const lineas = value.slice(inicio, fin).split('\n');
  const conTexto = lineas.filter((l) => l.trim());
  const quitar = conTexto.length > 0 && conTexto.every((l) => reconocer.test(l));
  let n = 0;
  const nuevas = lineas.map((l) => {
    if (!l.trim()) return l;
    if (quitar) return l.replace(reconocer, '');
    n++;
    return (typeof prefijo === 'function' ? prefijo(n) : prefijo) + l.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+|>\s?|!\s+|#{1,3}\s+)/, '');
  });
  const texto = nuevas.join('\n');
  reemplazar(area, inicio, fin, texto, 0, texto.length);
}

function insertarBloque(area, bloque) {
  const { selectionStart: a, selectionEnd: b, value } = area;
  const antes = value.slice(0, a);
  const despues = value.slice(b);
  const pre = !antes ? '' : antes.endsWith('\n\n') ? '' : antes.endsWith('\n') ? '\n' : '\n\n';
  const post = !despues ? '\n' : despues.startsWith('\n\n') ? '' : despues.startsWith('\n') ? '\n' : '\n\n';
  const texto = pre + bloque + post;
  reemplazar(area, a, b, texto, pre.length, pre.length + bloque.length);
}

const FORMATOS = {
  negrita: (a) => envolver(a, '**', '**', 'texto en negrita'),
  cursiva: (a) => envolver(a, '*', '*', 'texto en cursiva'),
  subrayado: (a) => envolver(a, '++', '++', 'texto subrayado'),
  resaltado: (a) => envolver(a, '==', '==', 'texto resaltado'),
  enlace: (a) => {
    const seleccion = a.value.slice(a.selectionStart, a.selectionEnd);
    if (/^(https?:\/\/|www\.)\S+$/i.test(seleccion)) return envolver(a, '[texto del enlace](', ')', seleccion);
    const inicio = a.selectionStart;
    const rotulo = seleccion || 'texto del enlace';
    const texto = `[${rotulo}](https://)`;
    reemplazar(a, inicio, a.selectionEnd, texto, rotulo.length + 3, rotulo.length + 11);
  },
  titulo: (a) => prefijarLineas(a, '## ', /^##\s+/),
  lista: (a) => prefijarLineas(a, '- ', /^[-*•]\s+/),
  numerada: (a) => prefijarLineas(a, (n) => `${n}. `, /^\d+[.)]\s+/),
  nota: (a) => prefijarLineas(a, '> ', /^>\s?/),
  aviso: (a) => prefijarLineas(a, '! ', /^!\s+/),
  tabla: (a) => insertarBloque(a, '| Columna 1 | Columna 2 | Columna 3 |\n|---|---|---|\n| Dato | Dato | Dato |\n| Dato | Dato | Dato |'),
  boton: (a) => insertarBloque(a, '[[Ver detalle|https://]]'),
  separador: (a) => insertarBloque(a, '---'),
  variable: (a) => envolver(a, '{{', '}}', 'Nombre'),
};

// ───────────────────────── Plantillas ─────────────────────────

const todasLasPlantillas = () => [...plantillasPropias.map((p) => ({ ...p, propia: true })), ...PLANTILLAS];

function pintarPlantillas() {
  const filtro = $('#buscarPlantilla').value.trim().toLowerCase();
  const molde = $('#tplPlantilla');
  const tarjetas = todasLasPlantillas()
    .filter((p) => !filtro || [p.nombre, p.categoria, p.descripcion, p.cuerpo].join(' ').toLowerCase().includes(filtro))
    .map((p) => {
      const nodo = molde.content.firstElementChild.cloneNode(true);
      $('.tp-nombre', nodo).textContent = p.nombre;
      $('.tp-categoria', nodo).textContent = p.propia ? `Mía${p.categoria ? ` · ${p.categoria}` : ''}` : p.categoria;
      $('.tp-categoria', nodo).classList.toggle('propia', Boolean(p.propia));
      const descripcion = p.descripcion || p.cuerpo.split('\n').find((l) => l.trim()) || '';
      $('.tp-descripcion', nodo).textContent = descripcion.length > 140 ? `${descripcion.slice(0, 137)}…` : descripcion;
      const n = detectarVariables(p.cuerpo, p.titulo, p.subtitulo).length;
      $('.tp-variables', nodo).textContent = n === 0 ? 'Sin variables' : n === 1 ? '1 variable' : `${n} variables`;
      $('.tp-usar', nodo).addEventListener('click', () => usarPlantilla(p));
      if (p.propia) {
        const eliminar = $('.tp-eliminar', nodo);
        eliminar.hidden = false;
        eliminar.addEventListener('click', () => eliminarPlantilla(p.id));
      }
      return nodo;
    });
  const lista = $('#listaPlantillas');
  if (tarjetas.length) lista.replaceChildren(...tarjetas);
  else {
    const vacio = document.createElement('p');
    vacio.className = 'vacio';
    vacio.textContent = 'No hay plantillas que coincidan.';
    lista.replaceChildren(vacio);
  }
}

function usarPlantilla(p) {
  const previo = contenidoActual();
  aplicarContenido({ texto: p.cuerpo, titulo: p.titulo ?? '', subtitulo: p.subtitulo ?? '' });
  if ((p.titulo || p.subtitulo) && !estado.encabezado.mostrar) {
    estado.encabezado.mostrar = true;
    poblarCampos();
  }
  activarPestana('contenido');
  aviso(`Plantilla «${p.nombre}» cargada.`, { accion: 'Deshacer', alHacer: () => aplicarContenido(previo) });
  $('#variables textarea.pendiente, #variables textarea')?.focus();
}

function guardarPlantillas() {
  if (!guardar(CLAVE_PLANTILLAS, plantillasPropias)) aviso('No se pudieron guardar las plantillas en este navegador.', { tipo: 'error' });
  pintarPlantillas();
}

function abrirDialogoPlantilla() {
  if (!estado.texto.trim()) return aviso('Escribe un mensaje antes de guardarlo como plantilla.', { tipo: 'alerta' });
  const dialogo = $('#dialogoPlantilla');
  const formulario = $('form', dialogo);
  formulario.reset();
  formulario.nombre.value = estado.encabezado.titulo.replace(/\{\{[^}]*\}\}/g, '').trim().slice(0, 80);
  dialogo.showModal();
  formulario.nombre.select();
}

function alCerrarDialogo() {
  const dialogo = $('#dialogoPlantilla');
  if (dialogo.returnValue !== 'guardar') return;
  const formulario = $('form', dialogo);
  const nombre = formulario.nombre.value.trim();
  if (!nombre) return;
  const nueva = {
    id: `propia-${Date.now().toString(36)}`,
    nombre,
    categoria: formulario.categoria.value.trim(),
    titulo: estado.encabezado.titulo,
    subtitulo: estado.encabezado.subtitulo,
    cuerpo: estado.texto,
  };
  const existente = plantillasPropias.findIndex((p) => p.nombre.toLowerCase() === nombre.toLowerCase());
  if (existente >= 0) plantillasPropias[existente] = { ...nueva, id: plantillasPropias[existente].id };
  else plantillasPropias.unshift(nueva);
  guardarPlantillas();
  aviso(existente >= 0 ? `Plantilla «${nombre}» actualizada.` : `Plantilla «${nombre}» guardada.`, { tipo: 'exito' });
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

// ───────────────────────── Pestañas y vista ─────────────────────────

function activarPestana(nombre) {
  if (!$(`[data-panel="${nombre}"]`)) nombre = 'contenido';
  for (const tab of $$('[data-pestana]')) tab.setAttribute('aria-selected', String(tab.dataset.pestana === nombre));
  for (const panel of $$('[data-panel]')) panel.hidden = panel.dataset.panel !== nombre;
  guardar(CLAVE_PESTANA, nombre);
}

function cambiarVista(tipo) {
  for (const b of $$('[data-vista]')) b.setAttribute('aria-pressed', String(b.dataset.vista === tipo));
  $('#marco').classList.toggle('movil', tipo === 'movil');
}

// ───────────────────────── Eventos ─────────────────────────

const ACCIONES = {
  copiar: copiarCorreo,
  'copiar-texto': copiarSoloTexto,
  'copiar-html': copiarCodigo,
  descargar: descargarCorreo,
  pegar: pegarDelPortapapeles,
  limpiar: limpiarTexto,
  'vaciar-variables': vaciarVariables,
  'guardar-plantilla': abrirDialogoPlantilla,
  exportar: exportarPlantillas,
  importar: () => $('#archivoPlantillas').click(),
};

function enlazarEventos() {
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
    const pestana = e.target.closest('[data-pestana]');
    if (pestana) activarPestana(pestana.dataset.pestana);
    const formato = e.target.closest('[data-formato]');
    if (formato) FORMATOS[formato.dataset.formato]?.($('#texto'));
    const tipoVista = e.target.closest('[data-vista]');
    if (tipoVista) cambiarVista(tipoVista.dataset.vista);
  });

  // Flechas entre pestañas (patrón de tablist accesible).
  $('.pestanas').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = $$('[data-pestana]');
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const siguiente = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    siguiente.focus();
    activarPestana(siguiente.dataset.pestana);
  });

  $('#avisoVariables').addEventListener('click', () => {
    activarPestana('contenido');
    const pendiente = $('#variables textarea.pendiente');
    pendiente?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    pendiente?.focus({ preventScroll: true });
  });

  $('#texto').addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const atajo = { b: 'negrita', i: 'cursiva', u: 'subrayado', k: 'enlace' }[e.key.toLowerCase()];
    if (atajo) {
      e.preventDefault();
      FORMATOS[atajo](e.currentTarget);
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      copiarCorreo();
    }
  });

  $('#buscarPlantilla').addEventListener('input', pintarPlantillas);
  $('#dialogoPlantilla').addEventListener('close', alCerrarDialogo);
  $('#archivoPlantillas').addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (archivo) importarPlantillas(archivo);
    e.target.value = '';
  });

  // Refresca {{hoy}} / {{hora}} cada minuto.
  setInterval(programarVista, 60_000);
}

// ───────────────────────── Inicio ─────────────────────────

construirOpcionesDeDiseno();
poblarCampos();
actualizarVariables();
pintarPlantillas();
enlazarEventos();
activarPestana(leer(CLAVE_PESTANA, 'contenido'));
dibujarVista();
