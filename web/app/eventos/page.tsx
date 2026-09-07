import type { Metadata } from "next";
import Link from "next/link";
import TarjetaEvento from "@/components/eventos/TarjetaEvento";
import { listarPublicados } from "@/lib/eventos";
import {
  CATEGORIAS,
  DESCRIPCION_CATEGORIA,
  ETIQUETA_CATEGORIA,
} from "@/lib/eventos-types";
import { SITE_URL } from "@/lib/config";

// Una hora: el calendario cambia por aprobaciones manuales, no por minuto.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Calendario de eventos deportivos — Luanna" },
  description:
    "Triatlones, maratones, travesías de aguas abiertas y granfondos, cada uno con el mapa del recorrido y el alojamiento a distancia caminable de la partida.",
  alternates: { canonical: `${SITE_URL}/eventos` },
};

export default async function EventosPage() {
  const eventos = await listarPublicados(60);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <h1 className="font-display text-4xl md:text-5xl">Calendario deportivo</h1>
      <p className="mt-3 max-w-2xl text-luanna-muted">
        Cada evento con su recorrido en el mapa y los hoteles que quedan
        caminando desde la línea de partida o el box de transición.
      </p>

      <nav aria-label="Categorías" className="mt-8 grid gap-4 sm:grid-cols-2">
        {CATEGORIAS.map((c) => (
          <Link
            key={c}
            href={`/eventos/${c}`}
            className="rounded-lg border border-black/10 p-5 transition hover:border-luanna-prompt/50"
          >
            <h2 className="font-display text-xl">{ETIQUETA_CATEGORIA[c]}</h2>
            <p className="mt-1 text-sm text-luanna-muted">
              {DESCRIPCION_CATEGORIA[c]}
            </p>
          </Link>
        ))}
      </nav>

      <h2 className="mt-14 font-display text-2xl">Próximos eventos</h2>
      {eventos.length === 0 ? (
        <p className="mt-3 text-luanna-muted">
          Todavía no hay eventos publicados. El pipeline de ingesta corre los
          domingos y deja cada evento en revisión antes de publicarlo.
        </p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map((e) => (
            <TarjetaEvento key={e.id} evento={e} />
          ))}
        </ul>
      )}
    </main>
  );
}
