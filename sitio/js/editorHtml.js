// Texto interno (marcas tipo Markdown) → HTML del editor visual. Puro (sin DOM): se prueba aislado.
// Lo inverso (HTML del editor → texto) vive en visual.js porque necesita el DOM.
// Todo texto de la persona se escapa; las variables se vuelven «chips» no editables.

import { fuenteDeImagen } from './correo.js';
import { analizarBloques, describirVariable, escaparHtml, patronVariable, urlSegura, VARIABLES_AUTOMATICAS } from './formato.js';

const FICHA = '\u0002';

/** Lo que muestra un chip: el valor si ya está, si no el nombre. */
export function textoDeChip(md, { valores = {}, ahora = new Date() } = {}) {
  const m = patronVariable().exec(md);
  if (!m) return { texto: md, estado: 'vacio', variable: null };
  const v = describirVariable(m[1], m[2]);
  if (v.automatica) return { texto: VARIABLES_AUTOMATICAS[v.clave](ahora), estado: 'auto', variable: v };
  const propio = String(valores[v.clave] ?? '').trim();
  const valor = propio || v.predeterminado;
  if (!valor) return { texto: v.nombre, estado: v.opcional ? 'opcional' : 'vacio', variable: v };
  const lineas = valor.split('\n');
  const corto = lineas[0].length > 90 ? `${lineas[0].slice(0, 87)}…` : lineas[0];
  return { texto: lineas.length > 1 ? `${corto} … (+${lineas.length - 1} líneas)` : corto, estado: propio ? 'lleno' : 'predeterminado', variable: v };
}

export function chipHtml(md, ctx) {
  const { texto, estado, variable } = textoDeChip(md, ctx);
  const titulo = variable
    ? `${variable.nombre}${variable.opcional ? ' (opcional)' : ''}${variable.automatica ? ' (automática)' : ''} · clic para completar, doble clic para editar`
    : '';
  return (
    `<span class="chip-var chip-${estado}" contenteditable="false" data-md="${escaparHtml(md)}"` +
    ` data-clave="${escaparHtml(variable?.clave ?? '')}" title="${escaparHtml(titulo)}">${escaparHtml(texto)}</span>`
  );
}

function enfasisSemantico(s) {
  return s
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, '<strong>$1</strong>')
    .replace(/\+\+(?=\S)(.+?)(?<=\S)\+\+/g, '<u>$1</u>')
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '<s>$1</s>')
    .replace(/==(?=\S)(.+?)(?<=\S)==/g, '<mark>$1</mark>')
    .replace(/(^|[^*\w])\*(?=\S)(.+?)(?<=\S)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?=\S)(.+?)(?<=\S)_(?![_\w])/g, '$1<em>$2</em>');
}

/** Una línea con marcas → HTML del editor (negritas, enlaces, chips). */
export function enLineaEditable(texto, ctx = {}) {
  const fichas = [];
  const guardar = (html) => `${FICHA}${fichas.push(html) - 1}${FICHA}`;
  let s = String(texto ?? '').replace(patronVariable(), (m) => guardar(chipHtml(m, ctx)));
  s = escaparHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (todo, rotulo, url) => {
    const segura = urlSegura(url);
    return segura ? `${guardar(`<a href="${segura}">`)}${rotulo}${guardar('</a>')}` : todo;
  });
  s = enfasisSemantico(s);
  return s.replace(new RegExp(`${FICHA}(\\d+)${FICHA}`, 'g'), (_, n) => fichas[Number(n)]);
}

const MARCAS_RECUADRO = { info: '> ', aviso: '! ', critico: '!! ', exito: '✓ ' };
export const marcaDeRecuadro = (variante) => MARCAS_RECUADRO[variante] ?? '> ';

const atributo = (s) => escaparHtml(s);

function imagenEditable(b, ctx) {
  const alt = b.ancho ? `${b.alt}|${b.ancho.valor}${b.ancho.porcentaje ? '%' : ''}` : b.alt;
  const md = `![${alt}](${b.src})`;
  const fuente = fuenteDeImagen(b.src, ctx.imagenes);
  const ancho = b.ancho?.porcentaje ? b.ancho.valor : 100;
  const imagen = fuente
    ? `<img src="${fuente.src}" alt="" style="width:${ancho}%">`
    : `<span class="imagen-falta">Imagen no disponible</span>`;
  return (
    `<figure class="bloque-fijo bloque-imagen" contenteditable="false" data-md="${atributo(md)}">` +
    `${imagen}<figcaption>${escaparHtml(b.alt && !/^imagen\s*\d*$/i.test(b.alt) ? b.alt : '')}</figcaption>` +
    `<span class="controles-bloque"><button type="button" data-bloque="ancho" data-valor="100">100%</button>` +
    `<button type="button" data-bloque="ancho" data-valor="75">75%</button><button type="button" data-bloque="ancho" data-valor="50">50%</button>` +
    `<button type="button" data-bloque="pie">Pie de foto</button><button type="button" data-bloque="quitar" aria-label="Quitar">✕</button></span></figure>`
  );
}

function botonEditable(b) {
  const md = `[[${b.texto}|${b.url}]]`;
  return (
    `<div class="bloque-fijo bloque-boton" contenteditable="false" data-md="${atributo(md)}">` +
    `<span class="boton-falso">${escaparHtml(b.texto)}</span><small>${escaparHtml(b.url)}</small>` +
    `<span class="controles-bloque"><button type="button" data-bloque="editar-boton">Editar</button>` +
    `<button type="button" data-bloque="quitar" aria-label="Quitar">✕</button></span></div>`
  );
}

/** Texto completo → HTML del editor visual. */
export function mdAEditable(texto, ctx = {}) {
  const il = (s) => enLineaEditable(s, ctx);
  const html = analizarBloques(texto)
    .map((b) => {
      switch (b.tipo) {
        case 'titulo':
          return `<h${b.nivel}>${il(b.texto)}</h${b.nivel}>`;
        case 'parrafo':
          return `<p>${b.lineas.map(il).join('<br>')}</p>`;
        case 'lista': {
          const etiqueta = b.ordenada ? 'ol' : 'ul';
          const inicio = b.ordenada && b.inicio !== 1 ? ` start="${b.inicio}"` : '';
          return `<${etiqueta}${inicio}>${b.items.map((it) => `<li>${it.map(il).join('<br>')}</li>`).join('')}</${etiqueta}>`;
        }
        case 'nota':
          return `<aside data-recuadro="${b.variante}">${b.lineas.map(il).join('<br>')}</aside>`;
        case 'tabla': {
          const fila = (celdas, etiqueta) => `<tr>${celdas.map((c) => `<${etiqueta}>${il(c) || '<br>'}</${etiqueta}>`).join('')}</tr>`;
          const cabecera = b.cabecera ? `<thead>${fila(b.cabecera, 'th')}</thead>` : '';
          return `<table>${cabecera}<tbody>${b.filas.map((f) => fila(f, 'td')).join('')}</tbody></table>`;
        }
        case 'boton':
          return botonEditable(b);
        case 'imagen':
          return imagenEditable(b, ctx);
        case 'separador':
          return '<hr>';
        default:
          return '';
      }
    })
    .join('');
  return html || '<p><br></p>';
}
