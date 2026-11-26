import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirCorreo, DISENOS, estadoPredeterminado, mezclar, textoSobre } from '../sitio/js/correo.js';
import { PLANTILLAS, EJEMPLO_INICIAL } from '../sitio/js/plantillas.js';
import { detectarVariables } from '../sitio/js/formato.js';

const ahora = new Date(2026, 10, 25, 10, 0);

function datos(cambios = {}) {
  const base = estadoPredeterminado();
  return {
    ...base,
    ...cambios,
    encabezado: { ...base.encabezado, ...cambios.encabezado },
    ajustes: { ...base.ajustes, ...cambios.ajustes },
    firma: { ...base.firma, ...cambios.firma },
    pie: { ...base.pie, ...cambios.pie },
  };
}

test('arma el correo con encabezado, cuerpo, firma y texto plano', () => {
  const r = construirCorreo(
    datos({
      texto: 'Hola {{Nombre}},\n\n- uno\n- dos\n\n| A | B |\n|---|---|\n| 1 | 2 |',
      encabezado: { titulo: 'Informe <b>semanal</b>', subtitulo: 'Equipo' },
      firma: { nombre: 'Ana Pérez', cargo: 'Analista', correo: 'ana@empresa.com', telefono: '+504 9999-0000' },
      valores: { nombre: 'Luis' },
    }),
    { ahora },
  );
  assert.match(r.html, /Informe &lt;b&gt;semanal&lt;\/b&gt;/);
  assert.match(r.html, /Hola Luis,/);
  assert.match(r.html, /<ul/);
  assert.match(r.html, /<th[^>]*>A<\/th>/);
  assert.match(r.html, /Ana Pérez/);
  assert.match(r.html, /href="mailto:ana@empresa\.com"/);
  assert.match(r.html, /href="tel:\+50499990000"/);
  assert.deepEqual(r.faltantes, []);
  assert.match(r.texto, /^Informe <b>semanal<\/b>\nEquipo\n\nHola Luis,/);
  assert.match(r.texto, /• uno\n• dos/);
  assert.match(r.texto, /A\tB\n1\t2/);
  assert.match(r.texto, /Saludos cordiales,\n\nAna Pérez\nAnalista\n\+504 9999-0000 \| ana@empresa\.com/);
});

test('informa las variables sin valor', () => {
  const r = construirCorreo(datos({ texto: '{{Uno}} {{Dos|ok}} {{Tres}}', valores: { tres: '  ' } }), { ahora });
  assert.deepEqual(r.faltantes, ['Uno', 'Tres']);
  assert.match(r.html, /\[Uno\]/);
});

test('ocultar el encabezado ignora sus variables', () => {
  const r = construirCorreo(datos({ texto: 'Hola', encabezado: { mostrar: false, titulo: '{{Título}}' } }), { ahora });
  assert.deepEqual(r.faltantes, []);
  assert.ok(!r.html.includes('<h1'));
});

test('cada diseño produce HTML con el color elegido y sin fondo si se pide', () => {
  for (const diseno of Object.keys(DISENOS)) {
    const r = construirCorreo(datos({ texto: 'Hola', encabezado: { titulo: 'T' }, ajustes: { diseno, color: '#9f1239' } }), { ahora });
    const esperado = diseno === 'elegante' ? mezclar('#9f1239', '#ffffff', 0.35) : '#9f1239';
    assert.ok(r.html.includes(esperado), diseno);
  }
  const sinFondo = construirCorreo(datos({ texto: 'Hola', ajustes: { fondo: false } }), { ahora });
  assert.ok(!sinFondo.html.includes('#f4efe7'));
  assert.equal(sinFondo.fondo, '#ffffff');
});

test('un color inválido o un logo no http no se inyectan', () => {
  const r = construirCorreo(
    datos({ texto: 'x', encabezado: { titulo: 'T' }, ajustes: { color: 'red;background:url(x)', logo: 'javascript:alert(1)' } }),
    { ahora },
  );
  assert.ok(!r.html.includes('url(x)'));
  assert.ok(!r.html.includes('<img'));
  const conLogo = construirCorreo(datos({ texto: 'x', encabezado: { titulo: 'T' }, ajustes: { logo: 'https://e.com/l.png' } }), { ahora });
  assert.match(conLogo.html, /<img src="https:\/\/e\.com\/l\.png"/);
});

test('el pie solo aparece si está activo', () => {
  const sin = construirCorreo(datos({ texto: 'x' }), { ahora });
  const con = construirCorreo(datos({ texto: 'x', pie: { mostrar: true, texto: 'Confidencial' } }), { ahora });
  assert.ok(!sin.html.includes('Confidencial'));
  assert.match(con.html, /Confidencial/);
  assert.match(con.texto, /—\nConfidencial$/);
});

test('colores derivados', () => {
  assert.equal(mezclar('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(textoSobre('#1d4ed8'), '#ffffff');
  assert.equal(textoSobre('#fde047'), '#111827');
});

test('todas las plantillas tienen id único y se construyen', () => {
  const ids = new Set(PLANTILLAS.map((p) => p.id));
  assert.equal(ids.size, PLANTILLAS.length);
  for (const p of [...PLANTILLAS, { ...EJEMPLO_INICIAL, cuerpo: EJEMPLO_INICIAL.texto }]) {
    const r = construirCorreo(datos({ texto: p.cuerpo, encabezado: { titulo: p.titulo, subtitulo: p.subtitulo } }), { ahora });
    assert.ok(r.html.length > 500, p.nombre ?? 'ejemplo');
    assert.ok(!r.html.includes('{{'), `${p.nombre ?? 'ejemplo'} deja llaves sin procesar`);
  }
});

test('las opcionales no cuentan como faltantes y un subtítulo opcional vacío desaparece', () => {
  const r = construirCorreo(datos({ texto: 'Hola\n{{Comentario?}}', encabezado: { titulo: 'T', subtitulo: 'Ticket {{Ticket?}}' } }), { ahora });
  assert.deepEqual(r.faltantes, []);
  assert.ok(!r.html.includes('Ticket'));
});

test('cada plantilla pide solo las variables de su contexto', () => {
  const pide = (id) => {
    const p = PLANTILLAS.find((x) => x.id === id);
    return detectarVariables(p.cuerpo, p.titulo, p.subtitulo).filter((v) => !v.opcional && !v.predeterminado).map((v) => v.nombre);
  };
  assert.deepEqual(pide('inicio-caso').sort(), ['Cliente', 'ID', 'Ticket', 'Técnico asignado']);
  assert.deepEqual(pide('caso-escalado'), ['Payload']);
  assert.deepEqual(pide('accesos'), ['Listado de técnicos']);
  assert.deepEqual(pide('actualizacion'), ['Avances']);
  assert.deepEqual(pide('validacion').sort(), ['Causa', 'Pruebas realizadas', 'Resolución']);
  assert.deepEqual(pide('seguimiento'), []);
});

test('imágenes pegadas: solo data:image válidas, con ancho limitado al contenido', () => {
  const imagenes = { a: { src: 'data:image/png;base64,iVBORw0KGgo=', ancho: 2000 }, b: { src: 'javascript:alert(1)', ancho: 10 } };
  const r = construirCorreo(datos({ texto: '![Imagen 1](img:a)\n\n![x](img:b)\n\n![Logo](https://e.com/l.png)', imagenes }), { ahora });
  assert.match(r.html, /<img src="data:image\/png;base64,iVBORw0KGgo=" alt="Imagen 1" width="568"/);
  assert.match(r.html, /Imagen no disponible: x/);
  assert.match(r.html, /<img src="https:\/\/e\.com\/l\.png"/);
  assert.ok(!r.html.includes('javascript:'));
  assert.match(r.texto, /\[Imagen: Imagen 1\]/);
});
