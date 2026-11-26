// Construye el correo final: HTML con tablas y estilos en línea (lo que Outlook respeta al pegar)
// y una versión en texto plano. Sin DOM: se puede probar aislado.

import {
  analizarBloques,
  detectarVariables,
  escaparHtml,
  formatoEnLinea,
  sustituirVariables,
  textoPlanoEnLinea,
  urlDeImagen,
  urlSegura,
  valorDeVariable,
} from './formato.js';

export const FUENTES = {
  segoe: { nombre: 'Segoe UI', pila: "'Segoe UI', Calibri, Arial, sans-serif" },
  calibri: { nombre: 'Calibri', pila: 'Calibri, Carlito, Arial, sans-serif' },
  aptos: { nombre: 'Aptos', pila: "Aptos, 'Segoe UI', Calibri, Arial, sans-serif" },
  arial: { nombre: 'Arial', pila: 'Arial, Helvetica, sans-serif' },
  verdana: { nombre: 'Verdana', pila: 'Verdana, Geneva, sans-serif' },
  tahoma: { nombre: 'Tahoma', pila: 'Tahoma, Verdana, sans-serif' },
  trebuchet: { nombre: 'Trebuchet MS', pila: "'Trebuchet MS', Arial, sans-serif" },
  georgia: { nombre: 'Georgia', pila: "Georgia, 'Times New Roman', serif" },
};

export const DISENOS = {
  corporativo: { nombre: 'Corporativo', descripcion: 'Banda de color con el título' },
  moderno: { nombre: 'Moderno', descripcion: 'Barra fina y título grande' },
  minimal: { nombre: 'Minimal', descripcion: 'Limpio, sin banda de color' },
  elegante: { nombre: 'Elegante', descripcion: 'Encabezado oscuro y serifa' },
};

export const PALETA = [
  { nombre: 'Azul marino', color: '#1e3a5f' },
  { nombre: 'Medianoche', color: '#172a4d' },
  { nombre: 'Terracota', color: '#b4532a' },
  { nombre: 'Cobre', color: '#a8632c' },
  { nombre: 'Ámbar', color: '#b7791f' },
  { nombre: 'Vino', color: '#8c2f39' },
  { nombre: 'Oliva', color: '#5b6b2f' },
  { nombre: 'Grafito', color: '#3f3a36' },
];

export function estadoPredeterminado() {
  return {
    texto: '',
    encabezado: { mostrar: true, titulo: '', subtitulo: '' },
    ajustes: { diseno: 'corporativo', color: '#1e3a5f', fuente: 'segoe', tamano: 15, ancho: 640, fondo: true, logo: '' },
    firma: { mostrar: true, despedida: 'Saludos cordiales,', nombre: '', cargo: '', empresa: '', telefono: '', correo: '', web: '' },
    pie: { mostrar: false, texto: 'Este mensaje y sus anexos son confidenciales y para uso exclusivo de sus destinatarios.' },
    valores: {},
  };
}

// ───────────────────────── Color ─────────────────────────

function hexARgb(hex) {
  const h = hex.replace('#', '');
  const completo = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = parseInt(completo, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbAHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function colorValido(color) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(color ?? '').trim()) ? String(color).trim().toLowerCase() : null;
}

/** Mezcla `a` con `b`; `t` = cuánto de `b` (0–1). */
export function mezclar(a, b, t) {
  const [x, y] = [hexARgb(a), hexARgb(b)];
  return rgbAHex(x.map((v, i) => v + (y[i] - v) * t));
}

function luminancia(hex) {
  const canal = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexARgb(hex).map(canal);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Color de texto legible sobre un fondo. */
export const textoSobre = (fondo) => (luminancia(fondo) > 0.42 ? '#111827' : '#ffffff');

const limitar = (n, min, max, defecto) => (Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : defecto);

function crearTema(ajustes) {
  const diseno = DISENOS[ajustes.diseno] ? ajustes.diseno : 'corporativo';
  const acento = colorValido(ajustes.color) ?? '#1e3a5f';
  const fuente = (FUENTES[ajustes.fuente] ?? FUENTES.segoe).pila;
  const tam = limitar(ajustes.tamano, 12, 18, 15);
  const claro = luminancia(acento) > 0.4;
  const t = {
    diseno,
    acento,
    sobreAcento: textoSobre(acento),
    acentoTexto: claro ? mezclar(acento, '#000000', 0.5) : acento,
    suave: mezclar(acento, '#ffffff', 0.9),
    borde: mezclar(acento, '#ffffff', 0.72),
    oscuro: mezclar(acento, '#0b1120', 0.62),
    texto: '#1c2b45',
    tenue: '#6b6459',
    linea: '#e9e2d7',
    cebra: '#fbf8f3',
    fondoExterior: ajustes.fondo ? (diseno === 'minimal' ? '#faf7f2' : '#f4efe7') : '',
    fuente,
    fuenteTitulos: diseno === 'elegante' ? FUENTES.georgia.pila : fuente,
    tam,
    ancho: limitar(ajustes.ancho, 480, 800, 640),
    radio: diseno === 'minimal' ? 0 : 10,
  };
  t.base = `font-family:${t.fuente};font-size:${tam}px;line-height:1.6;color:${t.texto};`;
  t.chica = `font-family:${t.fuente};font-size:${tam - 2}px;line-height:1.5;color:${t.tenue};`;
  t.relleno = '30px 36px';
  return t;
}

// ───────────────────────── Bloques ─────────────────────────

const espacio = (px) => `<div style="height:${px}px;line-height:${px}px;font-size:1px;">&nbsp;</div>`;
const presentacion = (contenido, extra = '') =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;${extra}">${contenido}</table>`;

function tituloHtml(b, t, primero) {
  const fmt = (s) => formatoEnLinea(s, { colorEnlace: t.acentoTexto });
  const arriba = primero ? 0 : b.nivel === 1 ? 26 : 22;
  const comun = `font-family:${t.fuenteTitulos};margin:${arriba}px 0 10px 0;font-weight:bold;`;
  if (b.nivel === 1) {
    return `<h1 style="${comun}font-size:${t.tam + 7}px;line-height:1.3;color:${t.texto};">${fmt(b.texto)}</h1>`;
  }
  if (b.nivel === 2) {
    const linea = t.diseno === 'moderno' || t.diseno === 'elegante' ? `border-bottom:1px solid ${t.borde};padding-bottom:6px;` : '';
    return `<h2 style="${comun}font-size:${t.tam + 3}px;line-height:1.35;color:${t.acentoTexto};${linea}">${fmt(b.texto)}</h2>`;
  }
  return `<h3 style="${comun}font-family:${t.fuente};font-size:${t.tam - 2}px;line-height:1.4;color:${t.tenue};text-transform:uppercase;letter-spacing:0.06em;">${fmt(b.texto)}</h3>`;
}

function notaHtml(b, t) {
  const fmt = (s) => formatoEnLinea(s, { colorEnlace: t.acentoTexto });
  const c =
    {
      aviso: { fondo: '#fff7e6', borde: '#e8890c', texto: '#5c3b00' },
      critico: { fondo: '#fdeeee', borde: '#c62828', texto: '#5f1414' },
      exito: { fondo: '#ecf7f0', borde: '#2e8b57', texto: '#1d4d32' },
    }[b.variante] ?? { fondo: t.suave, borde: t.acento, texto: t.texto };
  return (
    presentacion(
      `<tr><td bgcolor="${c.fondo}" style="background-color:${c.fondo};border-left:4px solid ${c.borde};padding:12px 16px;border-radius:0 6px 6px 0;">` +
        `<p style="margin:0;${t.base}color:${c.texto};">${b.lineas.map(fmt).join('<br>')}</p></td></tr>`,
    ) + espacio(16)
  );
}

function tablaHtml(b, t) {
  const fmt = (s) => formatoEnLinea(s, { colorEnlace: t.acentoTexto });
  const fuerte = t.diseno === 'corporativo' || t.diseno === 'elegante';
  const cabFondo = fuerte ? t.acento : t.suave;
  const cabTexto = fuerte ? t.sobreAcento : t.acentoTexto;
  const cabBorde = fuerte ? t.acento : t.borde;
  const celda = `font-family:${t.fuente};font-size:${t.tam - 1}px;line-height:1.45;padding:9px 12px;text-align:left;vertical-align:top;`;
  const cabecera = b.cabecera
    ? `<tr>${b.cabecera
        .map(
          (c) =>
            `<th align="left" bgcolor="${cabFondo}" style="${celda}background-color:${cabFondo};color:${cabTexto};font-weight:bold;border:1px solid ${cabBorde};">${fmt(c)}</th>`,
        )
        .join('')}</tr>`
    : '';
  const filas = b.filas
    .map((fila, i) => {
      const fondo = i % 2 === 1 ? t.cebra : '#ffffff';
      return `<tr>${fila
        .map(
          (c) =>
            `<td bgcolor="${fondo}" style="${celda}background-color:${fondo};color:${t.texto};border:1px solid ${t.linea};">${fmt(c) || '&nbsp;'}</td>`,
        )
        .join('')}</tr>`;
    })
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${cabecera}${filas}</table>${espacio(16)}`;
}

function botonHtml(b, t) {
  const url = urlSegura(escaparHtml(b.url));
  const rotulo = formatoEnLinea(b.texto, { colorEnlace: t.sobreAcento });
  const estilo = `display:inline-block;padding:12px 26px;font-family:${t.fuente};font-size:${t.tam}px;line-height:1.2;font-weight:bold;color:${t.sobreAcento};text-decoration:none;border-radius:6px;`;
  const contenido = url
    ? `<a href="${url}" target="_blank" style="${estilo}">${rotulo}</a>`
    : `<span style="${estilo}">${rotulo}</span>`;
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>` +
    `<td align="center" bgcolor="${t.acento}" style="background-color:${t.acento};border-radius:6px;">${contenido}</td></tr></table>${espacio(18)}`
  );
}

const RE_DATOS_IMAGEN = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i;

/** Resuelve img:ID (imagen pegada) o una URL https; devuelve {src, ancho} o null. */
export function fuenteDeImagen(src, imagenes) {
  if (src.startsWith('img:')) {
    const img = imagenes?.[src.slice(4)];
    return img && RE_DATOS_IMAGEN.test(img.src) ? { src: img.src, ancho: Number(img.ancho) || null } : null;
  }
  const url = urlDeImagen(src);
  return url ? { src: url, ancho: null } : null;
}

function imagenHtml(b, t, imagenes) {
  const fuente = fuenteDeImagen(b.src, imagenes);
  const contenido = t.ancho - 72;
  if (!fuente) {
    return `<p style="margin:0 0 14px 0;${t.chica}font-style:italic;">[Imagen no disponible${b.alt ? `: ${escaparHtml(b.alt)}` : ''}]</p>`;
  }
  let ancho = Math.min(fuente.ancho ?? contenido, contenido);
  if (b.ancho) ancho = Math.min(contenido, b.ancho.porcentaje ? Math.round((contenido * b.ancho.valor) / 100) : b.ancho.valor);
  const pie = b.alt && !/^imagen\s*\d*$/i.test(b.alt) ? b.alt : '';
  return (
    `<img src="${fuente.src}" alt="${escaparHtml(b.alt || 'Imagen')}" width="${ancho}" ` +
    `style="display:block;width:${ancho}px;max-width:100%;height:auto;border:0;outline:none;border-radius:6px;">` +
    (pie ? `<p style="margin:6px 0 0 0;${t.chica}font-size:${t.tam - 3}px;">${formatoEnLinea(pie, { colorEnlace: t.acentoTexto })}</p>` : '') +
    espacio(16)
  );
}

function bloqueHtml(b, t, indice, imagenes) {
  const fmt = (s) => formatoEnLinea(s, { colorEnlace: t.acentoTexto });
  switch (b.tipo) {
    case 'titulo':
      return tituloHtml(b, t, indice === 0);
    case 'parrafo':
      return `<p style="margin:0 0 14px 0;${t.base}">${b.lineas.map(fmt).join('<br>')}</p>`;
    case 'lista': {
      const etiqueta = b.ordenada ? 'ol' : 'ul';
      const inicio = b.ordenada && b.inicio !== 1 ? ` start="${b.inicio}"` : '';
      const items = b.items.map((it) => `<li style="margin:0 0 6px 0;${t.base}">${it.map(fmt).join('<br>')}</li>`).join('');
      return `<${etiqueta}${inicio} style="margin:0 0 14px 0;padding:0 0 0 26px;${t.base}">${items}</${etiqueta}>`;
    }
    case 'nota':
      return notaHtml(b, t);
    case 'tabla':
      return tablaHtml(b, t);
    case 'boton':
      return botonHtml(b, t);
    case 'imagen':
      return imagenHtml(b, t, imagenes);
    case 'separador':
      return presentacion(`<tr><td style="padding:8px 0 22px 0;"><div style="border-top:1px solid ${t.linea};height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>`);
    default:
      return '';
  }
}

// ───────────────────────── Encabezado, firma y pie ─────────────────────────

function logoHtml(url, alt, centrado) {
  const src = urlDeImagen(url);
  if (!src) return '';
  const margen = centrado ? '0 auto 16px auto' : '0 0 16px 0';
  return `<img src="${src}" alt="${escaparHtml(alt || 'Logo')}" height="36" style="display:block;height:36px;width:auto;max-width:220px;border:0;outline:none;margin:${margen};">`;
}

function encabezadoHtml({ titulo, subtitulo, logo, empresa }, t) {
  const fmt = (s, color) => formatoEnLinea(s, { colorEnlace: color });
  const arriba = `border-radius:${t.radio}px ${t.radio}px 0 0;`;

  if (t.diseno === 'corporativo') {
    const sub = mezclar(t.sobreAcento, t.acento, 0.22);
    return (
      `<tr><td bgcolor="${t.acento}" style="background-color:${t.acento};padding:28px 36px;${arriba}">` +
      logoHtml(logo, empresa, false) +
      (titulo ? `<h1 style="margin:0;font-family:${t.fuenteTitulos};font-size:${t.tam + 9}px;line-height:1.25;font-weight:bold;color:${t.sobreAcento};">${fmt(titulo, t.sobreAcento)}</h1>` : '') +
      (subtitulo ? `<p style="margin:${titulo ? 6 : 0}px 0 0 0;font-family:${t.fuente};font-size:${t.tam}px;line-height:1.5;color:${sub};">${fmt(subtitulo, sub)}</p>` : '') +
      `</td></tr>`
    );
  }

  if (t.diseno === 'moderno') {
    return (
      `<tr><td style="padding:30px 36px 4px 36px;">` +
      logoHtml(logo, empresa, false) +
      (subtitulo ? `<p style="margin:0 0 6px 0;font-family:${t.fuente};font-size:${t.tam - 3}px;line-height:1.4;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:${t.acentoTexto};">${fmt(subtitulo, t.acentoTexto)}</p>` : '') +
      (titulo ? `<h1 style="margin:0;font-family:${t.fuenteTitulos};font-size:${t.tam + 11}px;line-height:1.2;font-weight:bold;color:${t.texto};">${fmt(titulo, t.acentoTexto)}</h1>` : '') +
      `</td></tr>`
    );
  }

  if (t.diseno === 'elegante') {
    const sub = mezclar('#ffffff', t.oscuro, 0.3);
    return (
      `<tr><td align="center" bgcolor="${t.oscuro}" style="background-color:${t.oscuro};padding:32px 36px 28px 36px;text-align:center;${arriba}">` +
      logoHtml(logo, empresa, true) +
      (titulo ? `<h1 style="margin:0;font-family:${t.fuenteTitulos};font-size:${t.tam + 10}px;line-height:1.25;font-weight:normal;color:#ffffff;">${fmt(titulo, '#ffffff')}</h1>` : '') +
      `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:14px auto ${subtitulo ? 12 : 0}px auto;"><tr><td width="48" height="2" bgcolor="${mezclar(t.acento, '#ffffff', 0.35)}" style="width:48px;height:2px;line-height:2px;font-size:1px;background-color:${mezclar(t.acento, '#ffffff', 0.35)};">&nbsp;</td></tr></table>` +
      (subtitulo ? `<p style="margin:0;font-family:${t.fuente};font-size:${t.tam - 3}px;line-height:1.4;letter-spacing:0.12em;text-transform:uppercase;color:${sub};">${fmt(subtitulo, sub)}</p>` : '') +
      `</td></tr>`
    );
  }

  // minimal
  return (
    `<tr><td style="padding:30px 36px 0 36px;">` +
    logoHtml(logo, empresa, false) +
    (titulo ? `<h1 style="margin:0;font-family:${t.fuenteTitulos};font-size:${t.tam + 8}px;line-height:1.25;font-weight:bold;color:${t.texto};">${fmt(titulo, t.acentoTexto)}</h1>` : '') +
    (subtitulo ? `<p style="margin:6px 0 0 0;${t.chica}font-size:${t.tam}px;">${fmt(subtitulo, t.acentoTexto)}</p>` : '') +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0 0;"><tr><td width="40" height="3" bgcolor="${t.acento}" style="width:40px;height:3px;line-height:3px;font-size:1px;background-color:${t.acento};">&nbsp;</td></tr></table>` +
    `</td></tr>`
  );
}

function hayFirma(f) {
  return f.mostrar && [f.despedida, f.nombre, f.cargo, f.empresa, f.telefono, f.correo, f.web].some((v) => String(v ?? '').trim());
}

function firmaHtml(f, t) {
  const fmt = (s) => formatoEnLinea(s, { colorEnlace: t.acentoTexto });
  const lineas = [];
  if (f.nombre?.trim()) lineas.push(`<p style="margin:0;font-family:${t.fuenteTitulos};font-size:${t.tam + 1}px;line-height:1.4;font-weight:bold;color:${t.texto};">${fmt(f.nombre)}</p>`);
  if (f.cargo?.trim()) lineas.push(`<p style="margin:0;${t.chica}">${fmt(f.cargo)}</p>`);
  if (f.empresa?.trim()) lineas.push(`<p style="margin:0;${t.chica}font-weight:bold;color:${t.acentoTexto};">${fmt(f.empresa)}</p>`);
  const contacto = [];
  const enlace = (href, texto) => `<a href="${href}" target="_blank" style="color:${t.acentoTexto};text-decoration:none;">${escaparHtml(texto)}</a>`;
  if (f.telefono?.trim()) {
    const tel = f.telefono.trim();
    contacto.push(enlace(`tel:${escaparHtml(tel.replace(/[^\d+]/g, ''))}`, tel));
  }
  if (f.correo?.trim()) {
    const correo = f.correo.trim();
    const seguro = urlSegura(escaparHtml(correo));
    contacto.push(seguro ? enlace(seguro, correo) : escaparHtml(correo));
  }
  if (f.web?.trim()) {
    const web = f.web.trim();
    const seguro = urlSegura(escaparHtml(/^(https?:|www\.)/i.test(web) ? web : `https://${web}`));
    contacto.push(seguro ? enlace(seguro, web.replace(/^https?:\/\//i, '')) : escaparHtml(web));
  }
  if (contacto.length) {
    lineas.push(`<p style="margin:6px 0 0 0;${t.chica}font-size:${t.tam - 3}px;">${contacto.join(` <span style="color:${t.borde};">&nbsp;|&nbsp;</span> `)}</p>`);
  }

  const despedida = f.despedida?.trim() ? `<p style="margin:8px 0 14px 0;${t.base}">${f.despedida.split('\n').map(fmt).join('<br>')}</p>` : '';
  const bloque = lineas.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>` +
      `<td style="border-left:3px solid ${t.acento};padding:2px 0 2px 14px;">${lineas.join('')}</td></tr></table>`
    : '';
  return despedida + bloque;
}

// ───────────────────────── Texto plano ─────────────────────────

function bloquePlano(b) {
  const p = textoPlanoEnLinea;
  switch (b.tipo) {
    case 'titulo':
      return b.nivel <= 2 ? p(b.texto).toUpperCase() : p(b.texto);
    case 'parrafo':
      return b.lineas.map(p).join('\n');
    case 'lista':
      return b.items.map((it, i) => (b.ordenada ? `${b.inicio + i}. ` : '• ') + it.map(p).join('\n   ')).join('\n');
    case 'nota':
      return b.lineas.map((l) => `| ${p(l)}`).join('\n');
    case 'tabla':
      return [b.cabecera, ...b.filas].filter(Boolean).map((f) => f.map(p).join('\t')).join('\n');
    case 'boton':
      return `${p(b.texto)}: ${b.url}`;
    case 'imagen':
      return `[Imagen${b.alt ? `: ${b.alt}` : ''}]`;
    case 'separador':
      return '────────────────────';
    default:
      return '';
  }
}

// ───────────────────────── Correo ─────────────────────────

/**
 * @param datos {texto, encabezado, ajustes, firma, pie, valores}
 * @returns {{html: string, texto: string, faltantes: string[], fondo: string}}
 */
export function construirCorreo(datos, { ahora = new Date() } = {}) {
  const base = estadoPredeterminado();
  const encabezado = { ...base.encabezado, ...datos.encabezado };
  const ajustes = { ...base.ajustes, ...datos.ajustes };
  const firma = { ...base.firma, ...datos.firma };
  const pie = { ...base.pie, ...datos.pie };
  const valores = datos.valores ?? {};
  const texto = datos.texto ?? '';
  const t = crearTema(ajustes);

  const sustituir = (s) => sustituirVariables(s ?? '', valores, { ahora });
  const titulo = encabezado.mostrar ? sustituir(encabezado.titulo).trim() : '';
  const subtitulo = encabezado.mostrar ? sustituir(encabezado.subtitulo).trim() : '';
  const logo = encabezado.mostrar ? ajustes.logo : '';
  const bloques = analizarBloques(sustituir(texto));

  const variables = detectarVariables(texto, encabezado.mostrar ? encabezado.titulo : '', encabezado.mostrar ? encabezado.subtitulo : '');
  const faltantes = variables.filter((v) => !v.opcional && !valorDeVariable(v, valores).trim()).map((v) => v.nombre);

  // ── HTML ──
  const filas = [];
  const conEncabezado = Boolean(titulo || subtitulo || urlDeImagen(logo));
  if (conEncabezado) filas.push(encabezadoHtml({ titulo, subtitulo, logo, empresa: firma.empresa }, t));
  else if (t.diseno === 'moderno' || t.diseno === 'elegante') {
    // Sin encabezado, conserva una barra de color para que el diseño se reconozca.
    filas.push(`<tr><td height="6" bgcolor="${t.diseno === 'elegante' ? t.oscuro : t.acento}" style="height:6px;line-height:6px;font-size:1px;background-color:${t.diseno === 'elegante' ? t.oscuro : t.acento};border-radius:${t.radio}px ${t.radio}px 0 0;">&nbsp;</td></tr>`);
  }
  if (conEncabezado && t.diseno === 'moderno') {
    filas.unshift(`<tr><td height="6" bgcolor="${t.acento}" style="height:6px;line-height:6px;font-size:1px;background-color:${t.acento};border-radius:${t.radio}px ${t.radio}px 0 0;">&nbsp;</td></tr>`);
  }

  const cuerpo = bloques.map((b, i) => bloqueHtml(b, t, i, datos.imagenes)).join('');
  const firmaFinal = hayFirma(firma) ? firmaHtml(firma, t) : '';
  const rellenoCuerpo = conEncabezado && t.diseno !== 'corporativo' && t.diseno !== 'elegante' ? '24px 36px 32px 36px' : t.relleno;
  if (cuerpo || firmaFinal) filas.push(`<tr><td style="padding:${rellenoCuerpo};${t.base}">${cuerpo}${firmaFinal}</td></tr>`);

  const textoPie = pie.mostrar ? sustituir(pie.texto).trim() : '';
  if (textoPie) {
    filas.push(
      `<tr><td bgcolor="#faf7f2" style="background-color:#faf7f2;border-top:1px solid ${t.linea};padding:16px 36px;border-radius:0 0 ${t.radio}px ${t.radio}px;">` +
        `<p style="margin:0;${t.chica}font-size:${t.tam - 4}px;">${textoPie.split('\n').map((l) => formatoEnLinea(l, { colorEnlace: t.tenue })).join('<br>')}</p></td></tr>`,
    );
  }

  const borde = t.diseno === 'minimal' ? '' : `border:1px solid ${t.linea};`;
  const tarjeta =
    `<table role="presentation" width="${t.ancho}" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" ` +
    `style="width:100%;max-width:${t.ancho}px;background-color:#ffffff;${borde}border-collapse:separate;border-radius:${t.radio}px;">${filas.join('')}</table>`;

  const html = t.fondoExterior
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.fondoExterior}" style="width:100%;background-color:${t.fondoExterior};border-collapse:collapse;"><tr><td align="center" style="padding:28px 12px;">${tarjeta}</td></tr></table>`
    : tarjeta;

  // ── Texto plano ──
  const partes = [];
  if (titulo) partes.push(textoPlanoEnLinea(titulo));
  if (subtitulo) partes.push(textoPlanoEnLinea(subtitulo));
  if (partes.length) partes.push('');
  partes.push(bloques.map(bloquePlano).join('\n\n'));
  if (hayFirma(firma)) {
    const lineasFirma = [firma.despedida, '', firma.nombre, firma.cargo, firma.empresa, [firma.telefono, firma.correo, firma.web].filter((v) => v?.trim()).join(' | ')];
    partes.push('', ...lineasFirma.filter((v, i) => i === 1 || v?.trim()).map((v) => textoPlanoEnLinea(v.trim())));
  }
  if (textoPie) partes.push('', '—', textoPlanoEnLinea(textoPie));
  const plano = partes.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return { html, texto: plano, faltantes, fondo: t.fondoExterior || '#ffffff' };
}

/** Documento HTML completo (para descargar o abrir en el navegador). */
export function documentoCompleto(html, titulo = 'Correo', fondo = '#ffffff') {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background-color:${fondo};">
${html}
</body>
</html>
`;
}
