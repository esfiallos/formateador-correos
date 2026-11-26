// Diálogo genérico para pedir datos (enlace, botón, variable, pie de foto…) sin escribir marcas.

/**
 * @param opciones {titulo, descripcion, aceptar, campos: [{nombre, etiqueta, tipo, valor, opciones, ayuda,
 *                  requerido, sugerencias, visibleSi(valores)}]}
 *   tipo: 'texto' | 'url' | 'area' | 'elegir' (botones de opción)
 * @returns Promise<objeto con los valores | null si se cancela>
 */
export function pedirDatos({ titulo, descripcion = '', aceptar = 'Aceptar', campos }) {
  return new Promise((resolver) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo dialogo-datos';
    const formulario = document.createElement('form');
    formulario.method = 'dialog';

    const h2 = document.createElement('h2');
    h2.textContent = titulo;
    formulario.append(h2);
    if (descripcion) {
      const p = document.createElement('p');
      p.className = 'ayuda';
      p.textContent = descripcion;
      formulario.append(p);
    }

    const filas = [];
    for (const campo of campos) {
      const fila = document.createElement('div');
      fila.className = 'campo';
      const etiqueta = document.createElement('label');
      etiqueta.textContent = campo.etiqueta;
      const id = `dato-${campo.nombre}-${Math.random().toString(36).slice(2, 6)}`;
      etiqueta.htmlFor = id;
      fila.append(etiqueta);

      if (campo.tipo === 'elegir') {
        const grupo = document.createElement('div');
        grupo.className = 'eleccion';
        grupo.setAttribute('role', 'radiogroup');
        for (const opcion of campo.opciones) {
          const caja = document.createElement('label');
          caja.className = 'eleccion-opcion';
          const radio = Object.assign(document.createElement('input'), { type: 'radio', name: campo.nombre, value: opcion.valor });
          if (opcion.valor === campo.valor) radio.checked = true;
          const textos = document.createElement('span');
          const fuerte = document.createElement('strong');
          fuerte.textContent = opcion.etiqueta;
          textos.append(fuerte);
          if (opcion.ayuda) {
            const chico = document.createElement('small');
            chico.textContent = opcion.ayuda;
            textos.append(chico);
          }
          caja.append(radio, textos);
          grupo.append(caja);
        }
        fila.append(grupo);
      } else {
        const entrada = document.createElement(campo.tipo === 'area' ? 'textarea' : 'input');
        if (campo.tipo !== 'area') entrada.type = campo.tipo === 'url' ? 'url' : 'text';
        else entrada.rows = 3;
        entrada.id = id;
        entrada.name = campo.nombre;
        entrada.value = campo.valor ?? '';
        entrada.placeholder = campo.placeholder ?? '';
        if (campo.requerido) entrada.required = true;
        if (campo.sugerencias?.length) {
          const lista = document.createElement('datalist');
          lista.id = `${id}-lista`;
          for (const s of campo.sugerencias) lista.append(Object.assign(document.createElement('option'), { value: s }));
          entrada.setAttribute('list', lista.id);
          fila.append(lista);
        }
        fila.append(entrada);
      }
      if (campo.ayuda) {
        const ayuda = document.createElement('p');
        ayuda.className = 'ayuda';
        ayuda.textContent = campo.ayuda;
        fila.append(ayuda);
      }
      filas.push({ campo, fila });
      formulario.append(fila);
    }

    const acciones = document.createElement('div');
    acciones.className = 'dialogo-acciones';
    const cancelar = Object.assign(document.createElement('button'), { type: 'submit', value: 'cancelar', className: 'boton boton-fantasma', textContent: 'Cancelar' });
    cancelar.formNoValidate = true;
    const ok = Object.assign(document.createElement('button'), { type: 'submit', value: 'ok', className: 'boton boton-primario', textContent: aceptar });
    acciones.append(cancelar, ok);
    formulario.append(acciones);
    dialogo.append(formulario);
    document.body.append(dialogo);

    const valores = () => {
      const datos = {};
      for (const { campo } of filas) {
        if (campo.tipo === 'elegir') datos[campo.nombre] = formulario.querySelector(`input[name="${campo.nombre}"]:checked`)?.value ?? '';
        else datos[campo.nombre] = formulario.elements[campo.nombre].value.trim();
      }
      return datos;
    };
    const actualizarVisibles = () => {
      const v = valores();
      for (const { campo, fila } of filas) {
        const visible = campo.visibleSi ? campo.visibleSi(v) : true;
        fila.hidden = !visible;
        const entrada = formulario.elements[campo.nombre];
        if (entrada && 'required' in entrada) entrada.required = Boolean(campo.requerido && visible);
      }
    };
    formulario.addEventListener('input', actualizarVisibles);
    formulario.addEventListener('change', actualizarVisibles);
    actualizarVisibles();

    dialogo.addEventListener('click', (e) => e.target === dialogo && dialogo.close('cancelar'));
    dialogo.addEventListener('close', () => {
      const resultado = dialogo.returnValue === 'ok' ? valores() : null;
      dialogo.remove();
      resolver(resultado);
    });
    dialogo.showModal();
    const primero = formulario.querySelector('input:not([type="radio"]), textarea');
    primero?.focus();
    primero?.select?.();
  });
}
