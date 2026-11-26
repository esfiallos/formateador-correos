# Redacta · Formateador de correos

Convierte texto en un correo con **formato profesional** (HTML con estilos en línea, apto para Outlook) y lo copia con un botón.

- **Pegar y listo:** pega tu texto en *Mensaje*; la vista previa se actualiza al instante.
- **Plantillas del NOC:** inicio de caso, caso escalado, solicitud de accesos, falta de recursos, actualización, validación del servicio y seguimiento. Cada una pide solo lo que cambia en su contexto; el resto es texto profesional fijo. Puedes crear las tuyas (*Guardar actual como plantilla*), exportarlas e importarlas (JSON).
- **Variables:** `{{Campo}}` obligatoria (se resalta si falta) · `{{Campo?}}` opcional (vacía, se quita su línea) · `{{Campo|valor}}` con valor predeterminado · una variable sola en su línea pide un campo grande (listados, avances, payload; acepta tablas copiadas de Excel) · `{{hoy}}`, `{{fecha}}`, `{{hora}}` automáticas.
- **Personalización con vista previa:** 4 estilos (Corporativo, Moderno, Minimal, Elegante), color, fuente, tamaño, ancho, fondo, logo, firma y pie. Vista de escritorio y móvil.
- **Copiar:** *Copiar correo* (o `Ctrl+Enter`) pone en el portapapeles HTML + texto plano; pégalo en Outlook, Gmail o Word con `Ctrl+V`. También: copiar texto, copiar HTML y descargar `.html`.

Todo funciona en el navegador; nada se envía a ningún servidor. Ajustes y plantillas propias se guardan en `localStorage`.

## Formato del texto

| Escribe | Resultado |
| --- | --- |
| `# Título`, `## Sección`, `### Rótulo` | Títulos |
| `**negrita**`, `*cursiva*`, `++subrayado++`, `==resaltado==`, `~~tachado~~` | Énfasis |
| `- punto`, `1. paso` | Listas (sangría para continuar un punto) |
| `> nota`, `! aviso` | Recuadros destacados |
| `[texto](https://…)` | Enlace (URLs y correos sueltos también se enlazan) |
| `[[Texto del botón\|https://…]]` | Botón |
| `\| A \| B \|` + `\|---\|---\|` | Tabla (o pégala desde Excel) |
| `---` | Separador |

## Desarrollo

Sitio estático sin compilación (HTML + CSS + módulos JS) en `sitio/`.

```bash
npm test        # pruebas de la lógica (node:test, sin dependencias)
npm run dev     # sirve sitio/ en http://localhost:3000
```

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub (rama `main`).
2. En **Settings → Pages → Build and deployment → Source**, elige **GitHub Actions**.
3. Cada push a `main` ejecuta las pruebas y publica `sitio/` (`.github/workflows/pages.yml`). La URL queda en `https://<usuario>.github.io/<repositorio>/`.
