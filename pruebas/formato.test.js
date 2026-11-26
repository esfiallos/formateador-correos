import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analizarBloques,
  detectarVariables,
  formatoEnLinea,
  MARCA_VARIABLE,
  sustituirVariables,
  textoPlanoEnLinea,
} from '../sitio/js/formato.js';

test('reconoce títulos, listas, notas, avisos, botones y separadores', () => {
  const bloques = analizarBloques(`# Título
## Sección

- uno
- dos
  sigue dos

3. tres
4. cuatro

> nota
> otra línea

! cuidado

[[Abrir|https://ejemplo.com]]

---

Párrafo
con dos líneas`);
  assert.deepEqual(
    bloques.map((b) => b.tipo),
    ['titulo', 'titulo', 'lista', 'lista', 'nota', 'nota', 'boton', 'separador', 'parrafo'],
  );
  assert.equal(bloques[0].nivel, 1);
  assert.deepEqual(bloques[2].items, [['uno'], ['dos', 'sigue dos']]);
  assert.equal(bloques[3].ordenada, true);
  assert.equal(bloques[3].inicio, 3);
  assert.deepEqual(bloques[4].lineas, ['nota', 'otra línea']);
  assert.equal(bloques[5].variante, 'aviso');
  assert.deepEqual(bloques[6], { tipo: 'boton', texto: 'Abrir', url: 'https://ejemplo.com' });
  assert.deepEqual(bloques[8].lineas, ['Párrafo', 'con dos líneas']);
});

test('tablas con barras (con y sin encabezado) y pegadas desde Excel', () => {
  const [conCabecera] = analizarBloques('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 |');
  assert.deepEqual(conCabecera, { tipo: 'tabla', cabecera: ['A', 'B'], filas: [['1', '2'], ['3', '']] });

  const [sinCabecera] = analizarBloques('| x | y |\n| z | w |');
  assert.equal(sinCabecera.cabecera, null);
  assert.equal(sinCabecera.filas.length, 2);

  const [excel] = analizarBloques('Caso\tEstado\nINC1\tAbierto\nINC2\tCerrado');
  assert.deepEqual(excel.cabecera, ['Caso', 'Estado']);
  assert.deepEqual(excel.filas[1], ['INC2', 'Cerrado']);

  const [escapada] = analizarBloques('| a \\| b | c |');
  assert.deepEqual(escapada.filas[0], ['a | b', 'c']);
});

test('una línea que empieza con ¡ o con **negrita** no es lista ni aviso', () => {
  const bloques = analizarBloques('¡Hola!\n**Importante:** revisar');
  assert.equal(bloques.length, 1);
  assert.equal(bloques[0].tipo, 'parrafo');
});

test('formato en línea escapa HTML y aplica énfasis', () => {
  const html = formatoEnLinea('<script>alert(1)</script> **negrita** *cursiva* ==marca== ++sub++ ~~no~~');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.match(html, /<strong[^>]*>negrita<\/strong>/);
  assert.match(html, /<em[^>]*>cursiva<\/em>/);
  assert.match(html, /<span[^>]*background-color:#fff1a8[^>]*>marca<\/span>/);
  assert.match(html, /<u[^>]*>sub<\/u>/);
  assert.match(html, /<s[^>]*>no<\/s>/);
});

test('enlaces: seguros sí, javascript: no; URLs y correos sueltos se enlazan', () => {
  assert.match(formatoEnLinea('[sitio](https://a.com/?x=1&y=2)'), /<a href="https:\/\/a\.com\/\?x=1&amp;y=2"[^>]*>sitio<\/a>/);
  const malo = formatoEnLinea('[clic](javascript:alert(1))');
  assert.ok(!malo.includes('href="javascript'));
  assert.match(formatoEnLinea('ver https://b.com/x.'), /<a href="https:\/\/b\.com\/x"[^>]*>https:\/\/b\.com\/x<\/a>\./);
  assert.match(formatoEnLinea('www.c.com'), /href="https:\/\/www\.c\.com"/);
  assert.match(formatoEnLinea('escribe a ana@empresa.com'), /href="mailto:ana@empresa\.com"/);
  const comillas = formatoEnLinea('[x](https://a.com/"onmouseover="alert(1))');
  assert.ok(!comillas.includes('"onmouseover="'));
});

test('snake_case no se vuelve cursiva', () => {
  assert.ok(!formatoEnLinea('mi_variable_larga').includes('<em'));
  assert.match(formatoEnLinea('_cursiva_'), /<em/);
});

test('variables: detección, valores, predeterminados y automáticas', () => {
  const vars = detectarVariables('Hola {{ Nombre }}, {{nombre}} {{Cargo|Analista}} {{hoy}}', '{{Fecha límite}}');
  assert.deepEqual(
    vars.map((v) => [v.clave, v.predeterminado]),
    [
      ['nombre', ''],
      ['cargo', 'Analista'],
      ['fecha límite', ''],
    ],
  );

  const ahora = new Date(2026, 10, 25, 9, 5);
  const texto = sustituirVariables('{{Nombre}} · {{Cargo|Analista}} · {{hoy}} · {{hora}} · {{Falta}}', { nombre: 'Ana' }, { ahora });
  assert.ok(texto.startsWith('Ana · Analista · '));
  assert.match(texto, /noviembre/);
  assert.match(texto, /09:05/);
  assert.ok(texto.endsWith(`${MARCA_VARIABLE}Falta${MARCA_VARIABLE}`));
  assert.match(formatoEnLinea(texto), /\[Falta\]<\/span>$/);
  assert.equal(textoPlanoEnLinea(`${MARCA_VARIABLE}X${MARCA_VARIABLE} **b**`), '[X] b');
});

test('variables opcionales: vacías quitan su línea (también filas de tabla) y no se marcan', () => {
  const texto = 'Sitio: **{{Sitio?}}**\nTurno: {{Turno?}}\n| Obs | {{Observaciones?}} |\nHola {{Nombre}}';
  assert.equal(sustituirVariables(texto, { turno: 'A' }), `Turno: A\nHola ${MARCA_VARIABLE}Nombre${MARCA_VARIABLE}`);
  const vars = detectarVariables('{{Ticket?}}\nTicket {{Ticket}}', '{{Listado}}');
  assert.deepEqual(
    vars.map((v) => [v.clave, v.opcional, v.bloque]),
    [
      ['ticket', false, true],
      ['listado', false, true],
    ],
  );
  assert.deepEqual(detectarVariables('Para {{Cliente?}} hoy').map((v) => [v.opcional, v.bloque]), [[true, false]]);
});

test('una variable de bloque con una tabla de Excel se vuelve tabla', () => {
  const texto = sustituirVariables('## Personal\n{{Listado}}\n\nGracias', { listado: 'Nombre\tID\nAna\t123' });
  const bloques = analizarBloques(texto);
  assert.deepEqual(bloques.map((b) => b.tipo), ['titulo', 'tabla', 'parrafo']);
});

test('imágenes, recuadros nuevos y variables con opciones', () => {
  const bloques = analizarBloques('![Topología|50%](img:abc)\n\n!! caído\n\n✓ operativo\n\n! revisar');
  assert.deepEqual(bloques[0], { tipo: 'imagen', alt: 'Topología', src: 'img:abc', ancho: { valor: 50, porcentaje: true } });
  assert.deepEqual(bloques.slice(1).map((b) => b.variante), ['critico', 'exito', 'aviso']);

  const [area] = detectarVariables('Equipo {{Área|CORE IP;CORE CS;TX}}');
  assert.deepEqual(area.opciones, ['CORE IP', 'CORE CS', 'TX']);
  assert.equal(area.predeterminado, '');
  assert.equal(sustituirVariables('{{Área|CORE IP;TX}}', { área: 'TX' }), 'TX');
});

test('una sección o tabla que queda vacía por variables opcionales desaparece', () => {
  const texto = 'Hola\n\n| A | B |\n|---|---|\n| X | {{X?}} |\n\n## Comentarios\n{{Comentarios?}}\n\n## Fijo\n\n## Revisiones\n{{Revisiones?}}\n\nFin';
  const resultado = sustituirVariables(texto, { revisiones: 'ping ok' }).replace(/\n{3,}/g, '\n\n');
  assert.equal(resultado, 'Hola\n\n## Fijo\n\n## Revisiones\nping ok\n\nFin');
});

test('un título con su bloque vacío se quita aunque después siga el cierre del correo', () => {
  const texto = '## Revisiones\n{{Revisiones?}}\n\nGracias por su apoyo.';
  assert.equal(sustituirVariables(texto, {}).trim(), 'Gracias por su apoyo.');
});
