import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chipHtml, enLineaEditable, mdAEditable, textoDeChip } from '../sitio/js/editorHtml.js';
import { PLANTILLAS } from '../sitio/js/plantillas.js';

test('las variables se vuelven chips que muestran el valor o el nombre', () => {
  assert.deepEqual(
    [textoDeChip('{{Ticket}}').estado, textoDeChip('{{Ticket?}}').estado, textoDeChip('{{Ticket}}', { valores: { ticket: 'INC1' } }).texto],
    ['vacio', 'opcional', 'INC1'],
  );
  assert.equal(textoDeChip('{{Estado|En revisión}}').estado, 'predeterminado');
  assert.equal(textoDeChip('{{hoy}}', { ahora: new Date(2026, 10, 26) }).estado, 'auto');
  const chip = chipHtml('{{Área|CORE IP;TX}}', {});
  assert.match(chip, /contenteditable="false"/);
  assert.match(chip, /data-md="\{\{Área\|CORE IP;TX\}\}"/);
  assert.match(chip, /data-clave="área"/);
  const largo = textoDeChip('{{Payload}}', { valores: { payload: 'línea 1\nlínea 2\nlínea 3' } });
  assert.equal(largo.texto, 'línea 1 … (+2 líneas)');
});

test('el texto de la persona se escapa también dentro de los chips', () => {
  const html = enLineaEditable('<b>x</b> **negrita** {{A"<b>}}', { valores: { 'a"<b>': '<img src=x>' } });
  assert.ok(!html.includes('<b>x'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /<strong>negrita<\/strong>/);
  assert.match(html, /&lt;img src=x&gt;/);
});

test('bloques del editor: títulos, listas, recuadros, tablas, botones e imágenes', () => {
  const html = mdAEditable('## Sección\n\n- uno\n- dos\n\n!! caído\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n[[Abrir|https://a.com]]\n\n![Topología|50%](img:x)\n\n---', {
    imagenes: { x: { src: 'data:image/png;base64,AAAA', ancho: 100 } },
  });
  assert.match(html, /^<h2>Sección<\/h2><ul><li>uno<\/li><li>dos<\/li><\/ul><aside data-recuadro="critico">caído<\/aside>/);
  assert.match(html, /<table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /data-md="\[\[Abrir\|https:\/\/a\.com\]\]"/);
  assert.match(html, /data-md="!\[Topología\|50%\]\(img:x\)"/);
  assert.match(html, /<img src="data:image\/png;base64,AAAA" alt="" style="width:50%">/);
  assert.match(html, /<hr>$/);
  assert.equal(mdAEditable(''), '<p><br></p>');
});

test('todas las plantillas se convierten al editor sin dejar llaves sueltas', () => {
  for (const p of PLANTILLAS) {
    const sinChips = mdAEditable(p.cuerpo).replace(/<span class="chip-var[^>]*>.*?<\/span>/g, '');
    assert.ok(!/\{\{/.test(sinChips.replace(/data-md="[^"]*"/g, '')), p.nombre);
  }
});
