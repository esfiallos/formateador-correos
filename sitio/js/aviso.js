// Avisos breves en la parte inferior, con acción opcional (p. ej. «Deshacer»).

let contenedor;

function obtenerContenedor() {
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.className = 'avisos';
    contenedor.setAttribute('role', 'status');
    contenedor.setAttribute('aria-live', 'polite');
    document.body.append(contenedor);
  }
  return contenedor;
}

export function aviso(mensaje, { tipo = 'info', accion, alHacer, duracion = 3800 } = {}) {
  const caja = document.createElement('div');
  caja.className = `aviso aviso-${tipo}`;
  const texto = document.createElement('span');
  texto.textContent = mensaje;
  caja.append(texto);

  let temporizador;
  const cerrar = () => {
    clearTimeout(temporizador);
    caja.classList.add('saliendo');
    setTimeout(() => caja.remove(), 200);
  };

  if (accion && alHacer) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = accion;
    boton.addEventListener('click', () => {
      alHacer();
      cerrar();
    });
    caja.append(boton);
  }

  obtenerContenedor().append(caja);
  temporizador = setTimeout(cerrar, accion ? duracion + 2500 : duracion);
  caja.addEventListener('mouseenter', () => clearTimeout(temporizador));
  caja.addEventListener('mouseleave', () => (temporizador = setTimeout(cerrar, 1800)));
}
