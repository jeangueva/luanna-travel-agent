import WidgetTravelpayouts from "./WidgetTravelpayouts";
import { TP_WIDGET_ESIM, TP_WIDGET_SEGUROS, TP_WIDGET_VUELOS } from "@/lib/config";
import { sumarDias } from "@/lib/fechas";
import type { Evento } from "@/lib/eventos-types";

/**
 * Los widgets se prellenan con la logística del evento: llegar dos días antes
 * (recojo de kit + charla técnica, que casi siempre son la víspera) y volver
 * al día siguiente. Las fechas se anexan a la URL que da el panel de TP, así
 * que si TP cambia el nombre de un parámetro solo hay que tocar esta función.
 */
function conContextoDelEvento(base: string, evento: Evento): string {
  if (!base) return "";
  try {
    const url = new URL(base);
    if (evento.ciudad_sede) url.searchParams.set("destination", evento.ciudad_sede);
    url.searchParams.set("depart_date", sumarDias(evento.fecha_inicio, -2));
    url.searchParams.set("return_date", sumarDias(evento.fecha_inicio, 1));
    return url.toString();
  } catch {
    return base;
  }
}

export default function BarraCrossSelling({ evento }: { evento: Evento }) {
  const modulos = [
    { src: conContextoDelEvento(TP_WIDGET_VUELOS, evento), titulo: "Vuelos a la sede" },
    { src: conContextoDelEvento(TP_WIDGET_SEGUROS, evento), titulo: "Seguro de viaje y equipo" },
    { src: conContextoDelEvento(TP_WIDGET_ESIM, evento), titulo: "eSIM para la carrera" },
  ].filter((m) => m.src);

  if (modulos.length === 0) return null;

  return (
    <section
      aria-label="Servicios para el viaje"
      className="grid gap-6 px-4 py-8 md:grid-cols-3 md:px-6"
    >
      {modulos.map((m) => (
        <WidgetTravelpayouts key={m.titulo} src={m.src} titulo={m.titulo} />
      ))}
    </section>
  );
}
