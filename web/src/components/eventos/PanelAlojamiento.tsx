import { urlHotelesFallback, urlStay22, ventanaEstadia } from "@/lib/afiliados";
import { STAY22_AID, TP_MARKER } from "@/lib/config";
import { fechaCorta } from "@/lib/fechas";
import type { Evento } from "@/lib/eventos-types";

/**
 * Stay22 se embebe como iframe con su propio mapa: no existe forma soportada
 * de pintar sus pines sobre el lienzo de Mapbox. Por eso el §5.1 se resuelve
 * con la variante que el propio PRD contempla — split 60/40 en desktop — con
 * ambos mapas anclados a la MISMA coordenada de partida. El atleta compara
 * recorrido y hoteles lado a lado, sin que un pin tape el circuito.
 */
export default function PanelAlojamiento({ evento }: { evento: Evento }) {
  const { checkin, checkout } = ventanaEstadia(evento.fecha_inicio);

  if (STAY22_AID) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex items-baseline justify-between border-b border-black/10 px-4 py-2">
          <h2 className="text-sm font-semibold">Dónde dormir</h2>
          <span className="text-xs text-luanna-muted">
            {fechaCorta(checkin)} → {fechaCorta(checkout)}
          </span>
        </div>
        <iframe
          title={`Alojamiento cerca de la partida de ${evento.nombre_oficial}`}
          src={urlStay22({
            aid: STAY22_AID,
            lat: evento.latitud_partida,
            lng: evento.longitud_partida,
            checkin,
            checkout,
            titulo: evento.nombre_oficial,
          })}
          className="min-h-[320px] flex-1 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  const ciudad = evento.ciudad_sede ?? evento.pais ?? "";
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-6">
      <h2 className="font-display text-2xl">Dónde dormir</h2>
      <p className="text-sm text-luanna-muted">
        Noches del {fechaCorta(checkin)} al {fechaCorta(checkout)}, la ventana que
        cubre la víspera y la recuperación.
      </p>
      {TP_MARKER && ciudad ? (
        <a
          href={urlHotelesFallback({ marker: TP_MARKER, ciudad, checkin, checkout })}
          target="_blank"
          rel="nofollow sponsored noopener"
          className="inline-flex w-fit items-center rounded-full bg-luanna-prompt px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Ver hoteles en {ciudad}
        </a>
      ) : (
        <p className="text-sm text-luanna-muted">
          El mapa de alojamiento se activa al configurar{" "}
          <code className="rounded bg-black/5 px-1">NEXT_PUBLIC_STAY22_AID</code>.
        </p>
      )}
    </div>
  );
}
