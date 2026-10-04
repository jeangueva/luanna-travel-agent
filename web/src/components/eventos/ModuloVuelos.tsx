"use client";

import { useEffect, useState } from "react";
import { urlBusquedaVuelos } from "@/lib/afiliados";
import { TP_MARKER } from "@/lib/config";
import { fechaCorta, sumarDias } from "@/lib/fechas";
import {
  ORIGENES,
  esOrigenValido,
  nombreOrigen,
  type RespuestaVuelos,
} from "@/lib/vuelos";

const CLAVE_ORIGEN = "luanna:origen";

interface Props {
  slug: string;
  ciudad: string;
  destinoIata: string;
  fechaEvento: string;
}

type Estado = "sin_origen" | "cargando" | "listo" | "error";

/**
 * Lo único de la página que depende del visitante es de dónde sale, así que
 * la página sigue siendo HTML estático y esta isla pide el precio al cargar.
 * Mientras llega el precio —o si falla— el botón ya funciona: el ingreso está
 * en el enlace de búsqueda, no en el número.
 */
export default function ModuloVuelos({ slug, ciudad, destinoIata, fechaEvento }: Props) {
  const [origen, setOrigen] = useState("");
  const [estado, setEstado] = useState<Estado>("sin_origen");
  const [datos, setDatos] = useState<RespuestaVuelos | null>(null);

  // 1. Origen inicial: lo que el visitante eligió la última vez, o el que
  // sugiere su país. El almacenamiento puede estar bloqueado o vacío.
  useEffect(() => {
    let cancelado = false;
    try {
      const guardado = localStorage.getItem(CLAVE_ORIGEN);
      if (guardado && esOrigenValido(guardado)) {
        setOrigen(guardado);
        return;
      }
    } catch {
      /* sin almacenamiento: se cae a la sugerencia por país */
    }
    fetch("/api/origen")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { origen?: string | null } | null) => {
        if (!cancelado && d?.origen && esOrigenValido(d.origen)) setOrigen(d.origen);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  // 2. Precio para ese origen. Cada cambio cancela la consulta anterior para que
  // una respuesta lenta no pise la del origen que el usuario eligió después.
  useEffect(() => {
    setDatos(null);
    if (!origen || origen === destinoIata) {
      setEstado("sin_origen");
      return;
    }
    setEstado("cargando");
    const control = new AbortController();
    fetch(`/api/vuelos?evento=${encodeURIComponent(slug)}&origen=${origen}`, {
      signal: control.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<RespuestaVuelos>) : Promise.reject(r.status)))
      .then((d) => {
        setDatos(d);
        setEstado("listo");
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setEstado("error");
      });
    return () => control.abort();
  }, [origen, slug, destinoIata]);

  function elegir(valor: string) {
    setOrigen(valor);
    try {
      localStorage.setItem(CLAVE_ORIGEN, valor);
    } catch {
      /* preferencia opcional */
    }
  }

  if (!TP_MARKER) return null;

  const puedeBuscar = Boolean(origen) && origen !== destinoIata;
  // Respaldo armado en el cliente: si la API de precios no responde, el enlace
  // de afiliado sigue ahí.
  const respaldo = puedeBuscar
    ? urlBusquedaVuelos({
        origen,
        destino: destinoIata,
        salida: sumarDias(fechaEvento, -2),
        regreso: sumarDias(fechaEvento, 1),
        marker: TP_MARKER,
        subId: `ev-${slug}`,
      })
    : null;
  const href = datos?.url ?? respaldo;
  const precio = datos?.precio ?? null;

  return (
    <section aria-label={`Vuelos a ${ciudad}`} className="mx-auto max-w-6xl px-4 pb-6 md:px-6">
      <div className="gap-6 rounded-lg border border-black/10 p-4 md:flex md:items-center md:justify-between md:p-5">
        <div>
          <h2 className="font-display text-xl">Vuelos a {ciudad}</h2>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-luanna-muted">Salgo desde</span>
            <select
              value={origen}
              onChange={(e) => elegir(e.target.value)}
              className="rounded-md border border-black/15 bg-white px-2 py-1.5"
            >
              <option value="" disabled>
                Elige tu ciudad
              </option>
              {ORIGENES.filter((o) => o.iata !== destinoIata).map((o) => (
                <option key={o.iata} value={o.iata}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div aria-live="polite" className="mt-4 min-h-[76px] md:mt-0 md:text-right">
          {estado === "cargando" && (
            <span className="inline-block h-5 w-44 animate-pulse rounded bg-black/10" />
          )}
          {estado === "sin_origen" && (
            <p className="text-sm text-luanna-muted">
              {origen === destinoIata && origen
                ? `Ya estás en ${ciudad}: elige otra ciudad de salida.`
                : "Elige tu ciudad de salida para ver precios."}
            </p>
          )}
          {estado === "listo" && precio && (
            <>
              <p>
                Desde <strong className="text-xl text-luanna-prompt">US$ {precio.usd}</strong>{" "}
                <span className="text-sm text-luanna-muted">ida y vuelta</span>
              </p>
              <p className="text-xs text-luanna-muted">
                {nombreOrigen(origen)} · {fechaCorta(precio.salida)} → {fechaCorta(precio.regreso)}
                {precio.escalas === 0 ? " · directo" : ""}
                {precio.aproximado ? " · fechas cercanas a la carrera" : ""}
              </p>
            </>
          )}
          {(estado === "error" || (estado === "listo" && !precio)) && (
            <p className="text-sm text-luanna-muted">
              Sin precios recientes para esta ruta. Busca las fechas exactas.
            </p>
          )}
          {href && estado !== "sin_origen" && (
            <a
              href={href}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="mt-2 inline-flex items-center rounded-full bg-luanna-prompt px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              Buscar vuelos {nombreOrigen(origen)} → {ciudad}
            </a>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-luanna-muted">
        Precios recientes de Aviasales; pueden haber cambiado. Luanna recibe una comisión si
        compras desde estos enlaces, sin costo extra para ti.
      </p>
    </section>
  );
}
