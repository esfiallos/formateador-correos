// Plantillas del NOC. Cada una pide solo lo que cambia en su contexto; el resto es texto profesional fijo.
// {{Campo}}           obligatoria (si falta, se resalta en amarillo)
// {{Campo?}}          opcional (vacía, se quita su línea completa)
// {{Campo|valor}}     con valor predeterminado
// Una variable sola en su línea pide un campo grande (listados, avances, payload; admite tablas de Excel).
// {{hoy}}, {{fecha}} y {{hora}} se completan solas.

export const PLANTILLAS = [
  {
    id: 'inicio-caso',
    nombre: 'Inicio de caso',
    categoria: 'Casos',
    descripcion: 'Confirma que el equipo técnico recibió el caso y comenzó las revisiones.',
    titulo: 'Caso recibido · Ticket {{Ticket}}',
    subtitulo: '{{Cliente}} · ID {{ID}}',
    cuerpo: `Estimados,

Les confirmamos que el caso reportado por **{{Cliente}}** fue recibido y asignado a nuestro equipo técnico, que ya inició las revisiones correspondientes.

| Detalle | Información |
|---|---|
| Cliente | {{Cliente}} |
| Ticket | **{{Ticket}}** |
| ID | {{ID}} |
| Técnico asignado | {{Técnico asignado}} |
| Estado | En revisión |

Durante la atención les compartiremos las actualizaciones por este medio. Agradecemos conservar el número de ticket como referencia para cualquier consulta.`,
  },
  {
    id: 'caso-escalado',
    nombre: 'Caso escalado',
    categoria: 'Casos',
    descripcion: 'Informativo: texto formal de escalamiento y el payload que pegues.',
    titulo: 'Notificación de escalamiento',
    subtitulo: '{{hoy}}',
    cuerpo: `Estimados,

Por medio del presente se notifica el escalamiento del siguiente caso para su conocimiento y gestión. A continuación se comparte el detalle reportado:

---

{{Payload}}

---

Quedamos atentos a cualquier requerimiento adicional y continuaremos dando seguimiento hasta su resolución.`,
  },
  {
    id: 'accesos',
    nombre: 'Solicitud de accesos',
    categoria: 'Accesos',
    descripcion: 'Texto formal de solicitud y el listado de técnicos (pégalo desde Excel).',
    titulo: 'Solicitud de accesos',
    subtitulo: '{{Sitio o sistema?}}',
    cuerpo: `Estimados,

Por medio del presente solicitamos su apoyo para gestionar el acceso del personal técnico detallado a continuación, con el fin de realizar las labores operativas asignadas.

Sitio o sistema: **{{Sitio o sistema?}}**
Fecha y horario: **{{Fecha y horario?}}**

## Personal técnico
{{Listado de técnicos}}

Agradecemos de antemano su gestión y quedamos atentos a la confirmación de los accesos.`,
  },
  {
    id: 'falta-recursos',
    nombre: 'Falta de recursos',
    categoria: 'Gestión',
    descripcion: 'Informa los recursos que faltan para continuar con la atención.',
    titulo: 'Falta de recursos para la atención',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Estimados,

Les informamos que, para continuar con la atención del caso, actualmente no contamos con los recursos detallados a continuación:

{{Recursos faltantes}}

! {{Impacto?}}

Solicitamos su apoyo para gestionar la disponibilidad de estos recursos a la brevedad. Retomaremos la atención en cuanto estén disponibles.`,
  },
  {
    id: 'actualizacion',
    nombre: 'Actualización del caso',
    categoria: 'Casos',
    descripcion: 'Comparte los avances presentados y el estado actual.',
    titulo: 'Actualización del caso',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Estimados,

Compartimos la actualización del caso con los avances realizados a la fecha.

Estado actual: **{{Estado actual|En revisión}}**

## Avances
{{Avances}}

Continuaremos trabajando en el caso y les mantendremos informados sobre cualquier novedad.`,
  },
  {
    id: 'validacion',
    nombre: 'Validación del servicio',
    categoria: 'Casos',
    descripcion: 'Causa, resolución y pruebas realizadas; pide validar para cerrar.',
    titulo: 'Validación del servicio',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Estimados,

Les informamos que el caso fue atendido y, de acuerdo con nuestras validaciones, el servicio se encuentra operativo. A continuación se detalla la atención realizada:

## Causa
{{Causa}}

## Resolución
{{Resolución}}

## Pruebas realizadas
{{Pruebas realizadas}}

> Les solicitamos validar el servicio de su lado y confirmarnos que opera con normalidad para proceder con el cierre del caso.`,
  },
  {
    id: 'seguimiento',
    nombre: 'Seguimiento del caso',
    categoria: 'Casos',
    descripcion: 'Pide verificar pruebas y confirmar que todo opera sin problemas, o reportarlos.',
    titulo: 'Seguimiento del caso',
    subtitulo: 'Ticket {{Ticket?}}',
    cuerpo: `Estimados,

Damos seguimiento al caso atendido recientemente con el fin de confirmar que el servicio continúa operando con normalidad.

{{Comentario adicional?}}

## Validación solicitada
1. Verificar que las pruebas del servicio se completen de forma satisfactoria.
2. Confirmar que el servicio se encuentra operativo y sin inconvenientes.
3. En caso de presentar alguna falla o comportamiento irregular, reportarlo por este medio indicando el detalle y la hora en que se presentó.

> Si no se presentan inconvenientes, agradeceremos su confirmación para proceder con el cierre del caso.`,
  },
];

/** Texto de ejemplo para la primera visita: muestra lo que se puede hacer. */
export const EJEMPLO_INICIAL = {
  titulo: 'Te damos la bienvenida a Redacta',
  subtitulo: 'Formateador de correos del NOC',
  texto: `Hola {{Nombre|equipo}},

Pega aquí tu texto y obtén un correo con **formato profesional**, listo para *copiar y pegar* en Outlook.

## Qué puedes usar
- Títulos con # y ##
- Listas con guiones o números
- Enlaces como [este](https://outlook.com) y ==texto resaltado==
- Notas con > y avisos con !

> Las palabras entre llaves son variables: {{Nombre|equipo}} pide un campo y {{Dato opcional?}} desaparece si lo dejas vacío.

| Formato | Cómo se escribe |
|---|---|
| Negrita | dos asteriscos a cada lado |
| Botón | [[Texto\\|enlace]] en su propia línea |
| Tabla | filas con barras, o pegada desde Excel |

Usa la pestaña **Plantillas** para los correos del NOC o para guardar los tuyos. Cuando termines, pulsa **Copiar correo**.`,
};
