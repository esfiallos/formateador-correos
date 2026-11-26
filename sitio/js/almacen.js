// localStorage con tolerancia a fallos (modo privado, almacenamiento lleno o bloqueado).

export function leer(clave, defecto) {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo == null ? defecto : JSON.parse(crudo);
  } catch {
    return defecto;
  }
}

export function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}
