// Plantillas del NOC. Cada una pide solo lo que cambia en su contexto; el resto es texto fijo.
// {{Campo}}           obligatoria (si falta, se resalta)
// {{Campo?}}          opcional (vacía, se quita su línea, y su tabla o sección si quedan vacías)
// {{Campo|valor}}     con valor predeterminado
// {{Campo|a;b;c}}     lista de opciones
// Una variable sola en su línea pide un campo grande (listados, avances, payload; admite tablas de Excel).
// {{hoy}}, {{fecha}} y {{hora}} se completan solas.
//
// Tono: cercano y claro. Primera persona y voz activa, frases cortas, sin fórmulas como «por medio del
// presente». Cada correo dice qué sabemos, qué estamos haciendo y qué sigue (y cuándo), y cierra
// invitando a responder.

export const PLANTILLAS = [
  {
    id: 'inicio-caso',
    nombre: 'Inicio de caso',
    categoria: 'Casos',
    descripcion: 'Confirma que el caso ya está en manos de un técnico y que empezó la revisión.',
    titulo: 'Ya estamos trabajando en su caso',
    subtitulo: 'Ticket {{Ticket}} · {{Cliente}}',
    cuerpo: `Hola, {{Contacto|equipo}}:

Recibimos su reporte y ya está en manos de nuestro equipo técnico. **{{Técnico asignado}}** está a cargo y comenzó a revisarlo en este momento.

| Detalle | Información |
|---|---|
| Cliente | {{Cliente}} |
| Ticket | **{{Ticket}}** |
| ID | {{ID}} |
| Responsable | {{Técnico asignado}} |
| Estado | En revisión |

Les escribiremos con la primera actualización en cuanto tengamos novedades. Si quieren agregar algún detalle, basta con responder este correo.`,
  },
  {
    id: 'actualizacion',
    nombre: 'Actualización del caso',
    categoria: 'Casos',
    descripcion: 'Cuenta cómo va el caso: estado, avances y qué sigue.',
    titulo: 'Así va su caso',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Hola, {{Contacto|equipo}}:

Les comparto cómo avanza la atención de su caso.

**Estado actual:** {{Estado actual|En revisión}}

## Lo que hemos avanzado
{{Avances}}

## Lo que sigue
{{Próximos pasos?}}

Seguimos trabajando en ello y les vuelvo a escribir {{Próxima actualización|en cuanto tenga novedades}}. Cualquier duda, respondan este correo.`,
  },
  {
    id: 'validacion',
    nombre: 'Validación del servicio',
    categoria: 'Casos',
    descripcion: 'El servicio quedó operativo: qué pasó, qué hicimos y cómo lo comprobamos.',
    titulo: 'Su servicio ya está operativo',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Hola, {{Contacto|equipo}}:

Buenas noticias: resolvimos el problema y, según nuestro monitoreo, el servicio ya funciona con normalidad.

✓ Servicio operativo según nuestro monitoreo.

## Qué ocurrió
{{Causa}}

## Qué hicimos
{{Resolución}}

## Cómo lo comprobamos
{{Pruebas realizadas}}

> ¿Nos ayudan a confirmarlo de su lado? Con su visto bueno cerramos el caso. Si notan cualquier detalle, respondan este correo y lo revisamos de inmediato.`,
  },
  {
    id: 'seguimiento',
    nombre: 'Seguimiento del caso',
    categoria: 'Casos',
    descripcion: 'Pide verificar las pruebas y confirmar que todo opera bien, o reportar fallas.',
    titulo: '¿Todo sigue funcionando bien?',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Hola, {{Contacto|equipo}}:

Les escribo para confirmar que todo siga en orden después de la atención de su caso.

{{Comentario adicional?}}

## ¿Nos ayudan a validar?
1. Que las pruebas del servicio se completen sin errores.
2. Que el servicio opere con normalidad, sin cortes ni lentitud.
3. Si notan cualquier falla o comportamiento extraño, cuéntennos qué pasó y a qué hora, y lo revisamos enseguida.

> Si todo está bien, con una respuesta breve nos basta para cerrar el caso.`,
  },
  {
    id: 'revision-interna',
    nombre: 'Escalamiento a área interna',
    categoria: 'Escalamientos',
    descripcion: 'Pide a CORE IP, CORE CS, TX o Soporte Digital que revise el caso. Solo el área es obligatoria.',
    titulo: 'Necesitamos su apoyo · {{Área|CORE IP;CORE CS;TX;Soporte Digital}}',
    subtitulo: '{{Cliente?}}',
    cuerpo: `Hola, equipo de {{Área|CORE IP;CORE CS;TX;Soporte Digital}}:

Necesitamos su apoyo con este caso. Desde el NOC ya hicimos la revisión inicial y ahora requiere la validación de su área para avanzar.

| Detalle | Información |
|---|---|
| Cliente | {{Cliente?}} |
| ID de cliente | {{ID de cliente?}} |
| ID de enlace | {{ID de enlace?}} |
| Ticket | {{Ticket?}} |

## Lo que reporta el cliente
{{Comentarios del cliente?}}

## Lo que ya revisamos
{{Revisiones realizadas?}}

¿Nos avisan cuando lo tomen? Quedamos atentos para apoyar con pruebas o lo que necesiten.`,
  },
  {
    id: 'escalado-partner',
    nombre: 'Caso escalado al partner',
    categoria: 'Escalamientos',
    descripcion: 'Avisa al cliente que su caso pasó al partner, y que seguimos a cargo del seguimiento.',
    titulo: 'Escalamos su caso para resolverlo antes',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Hola, {{Cliente|equipo}}:

Para avanzar más rápido, escalamos su caso a **{{Partner|nuestro partner}}**, que cuenta con el equipo especializado para revisarlo a fondo.

| Detalle | Información |
|---|---|
| Ticket | {{Ticket?}} |
| Referencia del partner | {{Referencia del partner?}} |
| Fecha de escalamiento | {{fecha}} · {{hora}} |

{{Comentario adicional?}}

> Nosotros seguimos siendo su punto de contacto: damos seguimiento con el partner y les mantenemos al tanto por este medio hasta que quede resuelto.`,
  },
  {
    id: 'entrega-partner',
    nombre: 'Entrega de información al partner',
    categoria: 'Escalamientos',
    descripcion: 'Envía al partner lo que pidió (texto, tablas o capturas).',
    titulo: 'Información para continuar con el caso',
    subtitulo: 'Referencia {{Referencia del partner?}}',
    cuerpo: `Hola, equipo de {{Partner}}:

Gracias por la revisión. Les compartimos la información que nos pidieron para continuar con el caso.

| Detalle | Información |
|---|---|
| Ticket interno | {{Ticket?}} |
| Referencia del partner | {{Referencia del partner?}} |
| Cliente | {{Cliente?}} |
| ID de enlace | {{ID de enlace?}} |

## Información solicitada
{{Información solicitada}}

Si necesitan algún dato más o hacer pruebas en conjunto, nos avisan y lo coordinamos.`,
  },
  {
    id: 'caso-escalado',
    nombre: 'Caso escalado (informativo)',
    categoria: 'Escalamientos',
    descripcion: 'Informativo: una introducción breve y el detalle que pegues tal cual.',
    titulo: 'Caso escalado',
    subtitulo: '{{hoy}}',
    cuerpo: `Hola, equipo:

Les comparto este caso escalado para su conocimiento y gestión. Abajo va el detalle tal como se reportó.

---

{{Payload}}

---

Seguimos de cerca la atención y cualquier novedad la compartimos por este medio.`,
  },
  {
    id: 'accesos',
    nombre: 'Solicitud de accesos',
    categoria: 'Accesos',
    descripcion: 'Pide acceso para el personal técnico; pega el listado desde Excel.',
    titulo: 'Solicitud de acceso para personal técnico',
    subtitulo: '{{Sitio o sistema?}}',
    cuerpo: `Hola, {{Destinatario|equipo}}:

Les escribimos para solicitar acceso para el personal técnico que aparece abajo, que necesita ingresar para realizar labores operativas.

Sitio o sistema: **{{Sitio o sistema?}}**
Fecha y horario: **{{Fecha y horario?}}**

## Personal técnico
{{Listado de técnicos}}

¿Nos confirman cuando el acceso esté autorizado? Si falta algún dato de las personas, con gusto lo completamos.`,
  },
  {
    id: 'falta-recursos',
    nombre: 'Falta de recursos',
    categoria: 'Gestión',
    descripcion: 'Avisa que la atención está detenida y qué se necesita para continuar.',
    titulo: 'Necesitamos apoyo para continuar',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Hola, {{Destinatario|equipo}}:

Queremos avisarles que la atención de este caso está detenida: para continuar necesitamos los siguientes recursos, con los que hoy no contamos.

{{Recursos faltantes}}

! {{Impacto?}}

¿Nos ayudan a gestionarlos? En cuanto estén disponibles retomamos la atención y les avisamos.`,
  },
];

/** Texto de ejemplo para la primera visita: muestra lo que se puede hacer. */
export const EJEMPLO_INICIAL = {
  titulo: 'Te damos la bienvenida a Redacta',
  subtitulo: 'Formateador de correos del NOC',
  texto: `Hola, {{Nombre|equipo}}:

Escribe o pega aquí tu texto: lo que ves es como quedará el correo, listo para *copiar y pegar* en Outlook.

## Qué puedes hacer
- Dar formato con la barra: títulos, listas, **negritas**, ==resaltados== y enlaces
- Insertar recuadros, tablas, botones y capturas (pégalas con Ctrl+V)
- Usar datos como {{Nombre|equipo}}: aparecen como campos a la derecha

> Elige una plantilla a la izquierda para empezar más rápido, o guarda la tuya cuando la tengas lista.

| Atajo | Qué hace |
|---|---|
| Ctrl+Enter | Copia el correo |
| Ctrl+S | Guarda los cambios en la plantilla |
| Alt+2 | Ver el diseño y la vista previa |

Cuando termines, pulsa **Copiar correo** y pégalo en tu mensaje.`,
};
