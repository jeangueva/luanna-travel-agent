import { ETIQUETAS_VALIDAS, esCategoria, type EventoExtraido } from "./types.js";

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

const MONEDA_ISO = /^[A-Z]{3}$/;

/**
 * Un costo sin moneda no es un dato ("80" ¿soles, dólares, pesos?), y un rango
 * invertido es una lectura equivocada del texto. En ambos casos se descarta el
 * costo y se conserva el evento: perder el precio es barato, publicar uno
 * falso en una página que vende el viaje no lo es.
 */
export function normalizarCosto(
  min: number | null | undefined,
  max: number | null | undefined,
  moneda: string | null | undefined,
): { costo_min: number | null; costo_max: number | null; moneda: string | null } {
  const vacio = { costo_min: null, costo_max: null, moneda: null };
  const valido = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;

  const m = typeof moneda === "string" ? moneda.trim().toUpperCase() : "";
  if (!MONEDA_ISO.test(m)) return vacio;

  // Un valor presente pero inválido contamina el rango entero: quedarse con la
  // otra mitad convertiría "-5 a 20" en un precio puntual de 20 que nadie dio.
  const presente = (n: unknown) => n !== null && n !== undefined;
  if ((presente(min) && !valido(min)) || (presente(max) && !valido(max))) return vacio;

  const lo = valido(min) ? min : null;
  const hi = valido(max) ? max : null;
  if (lo === null && hi === null) return vacio;
  if (lo !== null && hi !== null && hi < lo) return vacio;
  // Una sola cifra es un precio puntual: min = max.
  return { costo_min: lo ?? hi, costo_max: hi ?? lo, moneda: m };
}

/** Solo etiquetas del catálogo, sin repetir y en el orden en que llegaron. */
export function normalizarEtiquetas(etiquetas: unknown): string[] {
  if (!Array.isArray(etiquetas)) return [];
  const validas = new Set<string>(ETIQUETAS_VALIDAS);
  return [...new Set(etiquetas.filter((e): e is string => typeof e === "string"))].filter(
    (e) => validas.has(e),
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
      etiquetas: normalizarEtiquetas(ev.etiquetas),
      badges: Array.isArray(ev.badges) ? ev.badges.slice(0, 8) : [],
      ...normalizarCosto(ev.costo_min, ev.costo_max, ev.moneda),
      confianza: Math.min(1, Math.max(0, ev.confianza)),
    },
  };
}
