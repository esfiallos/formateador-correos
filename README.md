# Redacta · Formateador de correos

Convierte texto en un correo con **formato profesional** (HTML con estilos en línea, apto para Outlook) y lo copia con un botón.

- **Dos vistas:** *Redactar* (plantillas, editor amplio y datos del correo) y *Diseñar y previsualizar* (vista previa de escritorio o móvil con los controles de estilo, color, tipografía, página, encabezado, firma y pie). `Alt+1` / `Alt+2` para cambiar.
- **Editor visual:** lo que escribes ya se ve con formato (títulos, listas, recuadros de nota/aviso/crítico/éxito, tablas, botones e imágenes). Pegar desde Outlook, Word o Excel conserva negritas, listas y tablas; las capturas se pegan con `Ctrl+V`. Los **datos** que cambian en cada correo (ticket, cliente, área…) se insertan desde el botón *Dato* y aparecen como chips que muestran su valor. El botón *Código* muestra el texto con marcas para quien lo prefiera.
- **Plantillas del NOC:** inicio de caso, actualización, validación del servicio, seguimiento, escalamiento a área interna (CORE IP, CORE CS, TX, Soporte Digital), caso escalado al partner, entrega de información al partner, caso escalado (informativo), solicitud de accesos y falta de recursos. Cada una pide solo lo que cambia; el resto es texto profesional fijo. **Cargar una plantilla deja todos los datos en blanco** (ticket, cliente, técnico…) para que no se cuelen datos de un caso anterior; la firma, el diseño y el pie se conservan. Cualquier plantilla (incluida o propia) se puede editar (nombre, categoría, descripción y contenido) y guardar con *Guardar en la plantilla* (`Ctrl+S`); las incluidas se pueden *restaurar* a su versión original. *Nueva* crea una plantilla en blanco para escribirla desde cero y *Guardar actual* convierte el mensaje abierto en plantilla. Cualquier plantilla se puede eliminar (con *Deshacer*); las incluidas eliminadas se recuperan al final de la lista. Puedes exportar o importar las tuyas (JSON) para compartirlas con el equipo.
- **Variables:** `{{Campo}}` obligatoria · `{{Campo?}}` opcional (vacía, se quita su línea, y su tabla o sección si quedan vacías) · `{{Campo|valor}}` predeterminado · `{{Área|CORE IP;TX}}` opciones con un clic · una variable sola en su línea pide un campo grande (acepta tablas de Excel) · `{{hoy}}`, `{{fecha}}`, `{{hora}}` automáticas.
- **Copiar:** *Copiar correo* (o `Ctrl+Enter`) pone HTML + texto plano en el portapapeles; pégalo en Outlook con `Ctrl+V`. *Exportar* copia el texto sin formato o el HTML, o descarga un `.html`.

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
| `@ 08:15 \| Texto` | Línea de tiempo |
| `%% 75 \| Texto` | Barra de progreso |
| `>> texto` | Cita (última línea `— Autor`, opcional) |
| ` ```cisco ` … ` ``` ` | Bloque de comandos: cisco, huawei, mikrotik o linux (prompt resaltado) |
| `((Resuelto))`, `((rojo:Caído))` | Etiqueta de estado (color automático o elegido) |
| `` `show run` `` | Comando dentro del texto |

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
