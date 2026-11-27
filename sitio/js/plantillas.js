// Plantillas del NOC. Cada una pide solo lo que cambia en su contexto; el resto es texto fijo.
// {{Campo}}           obligatoria (si falta, se resalta)
// {{Campo?}}          opcional (vacía, se quita su línea, y su tabla o sección si quedan vacías)
// {{Campo|valor}}     con valor predeterminado
// {{Campo|a;b;c}}     lista de opciones
// Una variable sola en su línea pide un campo grande (listados, avances, payload; admite tablas de Excel).
// {{hoy}}, {{fecha}} y {{hora}} se completan solas.
//
// Tono: formal de soporte. Trato de usted/ustedes, oraciones completas y claras, sin tecnicismos
// innecesarios para el cliente. Cada correo indica qué se recibió o se hizo, en qué estado está la
// atención, qué sigue y qué se espera de quien lo recibe.

export const PLANTILLAS = [
  {
    id: 'inicio-caso',
    nombre: 'Inicio de caso',
    categoria: 'Casos',
    descripcion: 'Confirma la recepción del caso, el técnico asignado y el inicio de las revisiones.',
    titulo: 'Confirmación de recepción de su caso',
    subtitulo: 'Ticket {{Ticket}} · {{Cliente}}',
    cuerpo: `Estimado(a) {{Contacto|cliente}}:

Reciba un cordial saludo. Por medio del presente le confirmamos que su reporte fue recibido y registrado en nuestro sistema de atención. El caso fue asignado a **{{Técnico asignado}}**, quien ya se encuentra realizando las revisiones iniciales correspondientes.

| Detalle | Información |
|---|---|
| Cliente | {{Cliente}} |
| Número de ticket | **{{Ticket}}** |
| ID | {{ID}} |
| Técnico asignado | {{Técnico asignado}} |
| Estado | En revisión |

Durante la atención le mantendremos informado(a) sobre los avances del caso a través de este medio. Le agradecemos conservar el número de ticket **{{Ticket}}** como referencia para cualquier consulta o información adicional que desee compartirnos.

Quedamos a su disposición.`,
  },
  {
    id: 'actualizacion',
    nombre: 'Actualización del caso',
    categoria: 'Casos',
    descripcion: 'Comparte el estado actual, los avances realizados y las próximas acciones.',
    titulo: 'Actualización de su caso',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Estimado(a) {{Contacto|cliente}}:

Reciba un cordial saludo. Le compartimos la actualización correspondiente a la atención de su caso, con el detalle de las acciones realizadas hasta el momento.

**Estado actual:** {{Estado actual|En revisión}}

## Avances realizados
{{Avances}}

## Próximas acciones
{{Próximos pasos?}}

Nuestro equipo continúa trabajando en la atención del caso. Le compartiremos una nueva actualización {{Próxima actualización|tan pronto contemos con novedades}}.

Si tiene alguna consulta adicional, puede responder a este correo y con gusto le atenderemos.`,
  },
  {
    id: 'validacion',
    nombre: 'Validación del servicio',
    categoria: 'Casos',
    descripcion: 'Informa causa, solución y pruebas, y solicita validar el servicio antes del cierre.',
    titulo: 'Servicio restablecido · Solicitud de validación',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Estimado(a) {{Contacto|cliente}}:

Reciba un cordial saludo. Le informamos que concluyeron los trabajos de atención de su caso y que, de acuerdo con las verificaciones realizadas por nuestro equipo, el servicio se encuentra operando con normalidad.

✓ Servicio restablecido y operativo según nuestro monitoreo.

## Causa identificada
{{Causa}}

## Solución aplicada
{{Resolución}}

## Pruebas realizadas
{{Pruebas realizadas}}

> Le solicitamos amablemente validar el funcionamiento del servicio desde sus instalaciones y confirmarnos por este medio. Una vez recibida su confirmación, procederemos con el cierre del caso.

En caso de presentar cualquier inconveniente, le agradeceremos informarnos para retomar la revisión de inmediato.`,
  },
  {
    id: 'seguimiento',
    nombre: 'Seguimiento del caso',
    categoria: 'Casos',
    descripcion: 'Solicita verificar pruebas y confirmar la operación normal, o reportar fallas.',
    titulo: 'Seguimiento de su caso',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Estimado(a) {{Contacto|cliente}}:

Reciba un cordial saludo. Como parte de nuestro proceso de atención, damos seguimiento al caso atendido recientemente, con el fin de asegurar que el servicio continúe operando correctamente.

{{Comentario adicional?}}

## Validación solicitada
Le solicitamos amablemente su apoyo con lo siguiente:
1. Verificar que las pruebas del servicio se completen de forma satisfactoria.
2. Confirmar que el servicio se encuentra operativo y sin inconvenientes.
3. En caso de identificar alguna falla o comportamiento irregular, reportarlo por este medio, indicando el detalle y la hora en que se presentó.

> De no presentarse inconvenientes, agradeceremos su confirmación para proceder con el cierre del caso.

Quedamos atentos a sus comentarios.`,
  },
  {
    id: 'revision-interna',
    nombre: 'Escalamiento a área interna',
    categoria: 'Escalamientos',
    descripcion: 'Solicita a CORE IP, CORE CS, TX o Soporte Digital la revisión del caso. Solo el área es obligatoria.',
    titulo: 'Solicitud de revisión · {{Área|CORE IP;CORE CS;TX;Soporte Digital}}',
    subtitulo: '{{Cliente?}}',
    cuerpo: `Estimado equipo de {{Área|CORE IP;CORE CS;TX;Soporte Digital}}:

Reciban un cordial saludo. Solicitamos su apoyo para la revisión del caso que se detalla a continuación. Desde el NOC se realizaron las validaciones de primer nivel y se requiere la intervención de su área para continuar con la atención.

| Detalle | Información |
|---|---|
| Cliente | {{Cliente?}} |
| ID de cliente | {{ID de cliente?}} |
| ID de enlace | {{ID de enlace?}} |
| Ticket | {{Ticket?}} |

## Comentarios del cliente
{{Comentarios del cliente?}}

## Revisiones realizadas por el NOC
{{Revisiones realizadas?}}

Agradecemos su pronta revisión y les solicitamos confirmar la recepción de este caso. Quedamos atentos para brindar el apoyo que requieran, ya sea con pruebas adicionales o información complementaria.`,
  },
  {
    id: 'escalado-partner',
    nombre: 'Caso escalado al partner',
    categoria: 'Escalamientos',
    descripcion: 'Informa al cliente que su caso fue escalado al partner y que el seguimiento continúa.',
    titulo: 'Escalamiento de su caso',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Estimado(a) {{Cliente|cliente}}:

Reciba un cordial saludo. Le informamos que, con el objetivo de agilizar la resolución de su caso, este fue escalado a **{{Partner|nuestro proveedor}}**, que cuenta con el equipo especializado para realizar una revisión a mayor profundidad.

| Detalle | Información |
|---|---|
| Ticket | {{Ticket?}} |
| Referencia del proveedor | {{Referencia del partner?}} |
| Fecha de escalamiento | {{fecha}} · {{hora}} |

{{Comentario adicional?}}

> Nuestro equipo continuará siendo su punto de contacto durante todo el proceso. Daremos seguimiento constante con el proveedor y le mantendremos informado(a) por este medio hasta la resolución del caso.

Agradecemos su comprensión y quedamos a su disposición.`,
  },
  {
    id: 'entrega-partner',
    nombre: 'Entrega de información al partner',
    categoria: 'Escalamientos',
    descripcion: 'Envía al partner la información solicitada (texto, tablas o capturas).',
    titulo: 'Información solicitada para la revisión del caso',
    subtitulo: 'Referencia {{Referencia del partner?}}',
    cuerpo: `Estimado equipo de {{Partner}}:

Reciban un cordial saludo. En atención a su solicitud, les compartimos la información requerida para dar continuidad a la revisión del caso.

| Detalle | Información |
|---|---|
| Ticket interno | {{Ticket?}} |
| Referencia del partner | {{Referencia del partner?}} |
| Cliente | {{Cliente?}} |
| ID de enlace | {{ID de enlace?}} |

## Información solicitada
{{Información solicitada}}

Quedamos atentos a cualquier dato adicional que necesiten, así como a coordinar pruebas en conjunto si lo consideran necesario.`,
  },
  {
    id: 'caso-escalado',
    nombre: 'Caso escalado (informativo)',
    categoria: 'Escalamientos',
    descripcion: 'Informativo: introducción formal y el detalle que pegues tal cual.',
    titulo: 'Notificación de caso escalado',
    subtitulo: '{{hoy}}',
    cuerpo: `Estimados:

Reciban un cordial saludo. Por este medio se notifica el escalamiento del siguiente caso, para su conocimiento y gestión correspondiente. A continuación se comparte el detalle tal como fue reportado:

---

{{Payload}}

---

Continuaremos dando seguimiento a la atención y compartiremos cualquier novedad por este medio.`,
  },
  {
    id: 'accesos',
    nombre: 'Solicitud de accesos',
    categoria: 'Accesos',
    descripcion: 'Solicita acceso para el personal técnico; el listado se puede pegar desde Excel.',
    titulo: 'Solicitud de acceso para personal técnico',
    subtitulo: '{{Sitio o sistema?}}',
    cuerpo: `Estimados:

Reciban un cordial saludo. Por medio del presente solicitamos su apoyo para autorizar el acceso del personal técnico que se detalla a continuación, quienes requieren ingresar para realizar labores operativas.

Sitio o sistema: **{{Sitio o sistema?}}**
Fecha y horario: **{{Fecha y horario?}}**
Motivo: **{{Motivo?}}**

## Personal técnico
{{Listado de técnicos}}

Agradecemos de antemano su gestión y les solicitamos confirmar por este medio una vez que el acceso haya sido autorizado. En caso de requerir información adicional del personal, con gusto la proporcionaremos.`,
  },
  {
    id: 'falta-recursos',
    nombre: 'Falta de recursos',
    categoria: 'Gestión',
    descripcion: 'Informa que la atención está detenida y los recursos necesarios para continuar.',
    titulo: 'Atención detenida por falta de recursos',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Estimados:

Reciban un cordial saludo. Les informamos que la atención del caso se encuentra detenida, debido a que actualmente no contamos con los recursos necesarios para continuar. A continuación se detallan los recursos requeridos:

{{Recursos faltantes}}

! {{Impacto?}}

Solicitamos su apoyo para gestionar la disponibilidad de estos recursos a la brevedad posible. Una vez que se encuentren disponibles, retomaremos la atención de inmediato y les mantendremos informados.`,
  },
];

/** Texto de ejemplo para la primera visita: muestra lo que se puede hacer. */
export const EJEMPLO_INICIAL = {
  titulo: 'Bienvenido a Redacta',
  subtitulo: 'Formateador de correos del NOC',
  texto: `Estimado(a) {{Nombre|usuario}}:

Escriba o pegue aquí su texto. Lo que ve en el editor es como quedará el correo, listo para copiar y pegar en Outlook.

## Funciones disponibles
- Dar formato con la barra: títulos, listas, **negritas**, ==resaltados== y enlaces
- Insertar recuadros, tablas, botones y capturas (puede pegarlas con Ctrl+V)
- Usar datos como {{Nombre|usuario}}, que aparecen como campos en el panel derecho

> Seleccione una plantilla en el panel izquierdo para comenzar más rápido, o guarde la suya cuando la tenga lista.

| Atajo | Función |
|---|---|
| Ctrl+Enter | Copia el correo |
| Ctrl+S | Guarda los cambios en la plantilla |
| Alt+2 | Muestra el diseño y la vista previa |

Al terminar, pulse **Copiar correo** y péguelo en su mensaje.`,
};
