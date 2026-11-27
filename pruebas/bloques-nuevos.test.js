import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarBloques, colorDePildora, formatoEnLinea, leerPildora, textoPlanoEnLinea } from '../sitio/js/formato.js';
import { construirCorreo, estadoPredeterminado, resaltarLinea } from '../sitio/js/correo.js';
import { enLineaEditable, mdAEditable } from '../sitio/js/editorHtml.js';

const ahora = new Date(2026, 10, 26, 10, 0);
const correo = (texto) => construirCorreo({ ...estadoPredeterminado(), texto }, { ahora });

test('línea de tiempo: «@ hora | texto», consecutivas forman un bloque', () => {
  const [b] = analizarBloques('@ 08:15 | Se recibe el reporte\n@ 08:30 | Inicia la revisión\n@ Sin hora');
  assert.deepEqual(b, {
    tipo: 'linea',
    items: [
      { hora: '08:15', texto: 'Se recibe el reporte' },
      { hora: '08:30', texto: 'Inicia la revisión' },
      { hora: '', texto: 'Sin hora' },
    ],
  });
  const r = correo('@ 08:15 | Se recibe el **reporte**\n@ 08:30 | Inicia');
  assert.equal((r.html.match(/border-right:2px solid/g) ?? []).length, 2);
  assert.match(r.html, /<strong[^>]*>reporte<\/strong>/);
  assert.match(r.texto, /08:15\s+│ Se recibe el reporte/);
});

test('barra de progreso: valor limitado a 0–100, celdas con ancho en %', () => {
  assert.deepEqual(analizarBloques('%% 75 | Migración')[0], { tipo: 'progreso', valor: 75, texto: 'Migración' });
  assert.equal(analizarBloques('%% 140')[0].valor, 100);
  const r = correo('%% 75 | Migración');
  assert.match(r.html, /width="75%"/);
  assert.match(r.html, /width="25%"/);
  assert.match(r.html, />75%</);
  assert.match(r.texto, /Migración: 75% \[████████░░\]/);
  const completo = correo('%% 100');
  assert.ok(!completo.html.includes('width="0%"'));
  assert.match(completo.html, /#2e8b57/);
});

test('cita con «>>» y autor opcional; «>» sigue siendo nota', () => {
  const bloques = analizarBloques('>> El enlace se cae cada noche.\n>> — Cliente\n\n> nota');
  assert.deepEqual(bloques.map((b) => b.tipo), ['cita', 'nota']);
  const r = correo('>> El enlace se cae\n>> — Ana, NOC');
  assert.match(r.html, /font-style:italic/);
  assert.match(r.html, /— Ana, NOC/);
});

test('bloque de comandos: respeta espacios, escapa HTML y resalta el prompt', () => {
  const [b] = analizarBloques('```ios\nRouter# show ip int brief\n  Gi0/0   up\n\n```\n\nfin');
  assert.equal(b.tipo, 'codigo');
  assert.equal(b.lenguaje, 'cisco');
  assert.deepEqual(b.lineas, ['Router# show ip int brief', '  Gi0/0   up']);

  const r = correo('```linux\n$ echo "<script>alert(1)</script>"\n```');
  assert.ok(!r.html.includes('<script>'));
  assert.match(r.html, /&lt;script&gt;/);
  assert.match(r.html, />Linux</);
  assert.match(r.texto, /^ {4}\$ echo/m);

  assert.match(resaltarLinea('Router(config-if)# shutdown', 'cisco'), /color:#7ee2b8;">Router\(config-if\)#<\/span><span[^>]*>&nbsp;shutdown/);
  assert.match(resaltarLinea('<HUAWEI> display version', 'huawei'), /&lt;HUAWEI&gt;<\/span>/);
  assert.match(resaltarLinea('[admin@MikroTik] /ip address> print', 'mikrotik'), /\[admin@MikroTik\] \/ip address&gt;<\/span>/);
  assert.match(resaltarLinea('! comentario', 'cisco'), /font-style:italic/);
  assert.match(resaltarLinea('    interface Gi0/1', 'cisco'), /^&nbsp;&nbsp;&nbsp;&nbsp;interface/);
});

test('píldoras: color automático o explícito, y código en línea sin otro formato', () => {
  assert.equal(colorDePildora('Resuelto'), 'verde');
  assert.equal(colorDePildora('Caído'), 'rojo');
  assert.equal(colorDePildora('En revisión'), 'ambar');
  assert.deepEqual(leerPildora('rojo:Crítico'), { color: 'rojo', texto: 'Crítico', explicito: true });
  assert.deepEqual(leerPildora('Estado: activo'), { color: 'verde', texto: 'Estado: activo', explicito: false });

  const html = formatoEnLinea('Estado ((Resuelto)) y ((azul:Info)) con `show *run*`');
  assert.match(html, /background-color:#e6f4ea[^>]*>Resuelto<\/span>/);
  assert.match(html, /background-color:#e8f0fb[^>]*>Info<\/span>/);
  assert.match(html, /<code[^>]*>show \*run\*<\/code>/);
  assert.equal(textoPlanoEnLinea('((Resuelto)) `ping`'), '[Resuelto] ping');
});

test('editor visual: los bloques nuevos tienen su forma editable', () => {
  const html = mdAEditable('@ 08:15 | Reporte\n\n%% 40 | Avance\n\n>> Dice el cliente\n\n```cisco\nshow run\n```');
  assert.match(html, /<table class="linea-tiempo"><tbody><tr><td class="lt-hora">08:15<\/td><td class="lt-texto">Reporte<\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /bloque-progreso[^>]*data-md="%% 40 \| Avance"/);
  assert.match(html, /<blockquote>Dice el cliente<\/blockquote>/);
  assert.match(html, /<pre class="bloque-codigo" data-lenguaje="cisco">.*show run/s);
  const linea = enLineaEditable('Estado ((Resuelto)) `ping 8.8.8.8`');
  assert.match(linea, /class="pildora pildora-verde" contenteditable="false" data-md="\(\(Resuelto\)\)"/);
  assert.match(linea, /<code>ping 8\.8\.8\.8<\/code>/);
});
