import { esCategoria, type EventoExtraido } from "./types.js";

export interface Rechazo {
  motivo: string;
  evento: string;
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `Date.parse("2026-02-30")` no falla: V8 lo corre a 2026-03-02 en silencio.
 * Un evento con fecha inventada por el modelo entraría al catálogo con la
 * fecha equivocada y con cuenta regresiva equivocada. Solo el round-trip por
 * componentes distingue una fecha real de una que el parser "arregló".
 */
function fechaCalendarioValida(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return (
    fecha.getUTCFullYear() === y &&
    fecha.getUTCMonth() === m - 1 &&
    fecha.getUTCDate() === d
  );
}

/**
 * Filtro previo a la geocodificación: descarta lo que ya se sabe inservible
 * sin gastar una llamada a Mapbox por fila. Las coordenadas NO se validan aquí
 * — a esta altura pueden ser null legítimamente, las resuelve geocode.ts.
 */
export function validarExtraido(
  ev: EventoExtraido,
  hoy: string,
): { ok: true; evento: EventoExtraido } | { ok: false; rechazo: Rechazo } {
  const nombre = (ev.nombre_oficial ?? "").trim();
  const rechazo = (motivo: string) => ({
    ok: false as const,
    rechazo: { motivo, evento: nombre || "(sin nombre)" },
  });

  if (nombre.length < 4) return rechazo("nombre vacío o demasiado corto");
  if (!esCategoria(ev.categoria)) return rechazo(`categoría inválida: ${ev.categoria}`);
  if (!FECHA_ISO.test(ev.fecha_inicio ?? "")) {
    return rechazo(`fecha no ISO: ${ev.fecha_inicio}`);
  }
  if (!fechaCalendarioValida(ev.fecha_inicio)) {
    return rechazo(`fecha inexistente: ${ev.fecha_inicio}`);
  }
  // Una edición pasada no se publica, pero tampoco es un error de extracción.
  if (ev.fecha_inicio < hoy) return rechazo(`fecha pasada: ${ev.fecha_inicio}`);
  if (typeof ev.confianza !== "number" || ev.confianza < 0.4) {
    return rechazo(`confianza baja: ${ev.confianza}`);
  }

  return {
    ok: true,
    evento: {
      ...ev,
      nombre_oficial: nombre,
      badges: Array.isArray(ev.badges) ? ev.badges.slice(0, 8) : [],
      confianza: Math.min(1, Math.max(0, ev.confianza)),
    },
  };
}
