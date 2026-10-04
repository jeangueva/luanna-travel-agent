import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BarraCrossSelling from "@/components/eventos/BarraCrossSelling";
import HeroEvento from "@/components/eventos/HeroEvento";
import JsonLdEvento from "@/components/eventos/JsonLdEvento";
import LeyendaTramos from "@/components/eventos/LeyendaTramos";
import LienzoLogistico from "@/components/eventos/LienzoLogistico";
import MapaEvento from "@/components/eventos/MapaEvento";
import ModuloVuelos from "@/components/eventos/ModuloVuelos";
import PanelAlojamiento from "@/components/eventos/PanelAlojamiento";
import TarjetaEvento from "@/components/eventos/TarjetaEvento";
import { listarPublicados, obtenerEvento, relacionados } from "@/lib/eventos";
import { ETIQUETA_CATEGORIA, esCategoria } from "@/lib/eventos-types";
import { tramosDelEvento } from "@/lib/tramos";
import { MAPBOX_TOKEN, SITE_URL } from "@/lib/config";
import { diasFaltantes, fechaLarga } from "@/lib/fechas";

export const revalidate = 3600;

/**
 * `dynamicParams` queda en true a propósito: un evento aprobado el martes debe
 * poder servirse antes del siguiente build, aunque no estuviera en la lista
 * del último despliegue.
 */
export async function generateStaticParams() {
  const eventos = await listarPublicados(500);
  return eventos.map((e) => ({ categoria: e.categoria, slug: e.slug }));
}

async function cargar(params: Promise<{ categoria: string; slug: string }>) {
  const { categoria, slug } = await params;
  if (!esCategoria(categoria)) return null;
  return obtenerEvento(categoria, slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string; slug: string }>;
}): Promise<Metadata> {
  const evento = await cargar(params);
  if (!evento) return { title: "Evento no encontrado — Luanna" };

  const lugar = [evento.ciudad_sede, evento.pais].filter(Boolean).join(", ");
  // Solo se promete lo que la página ofrece: sin IATA verificado no hay módulo
  // de vuelos, y un título que lo anuncia sería publicidad engañosa para Google.
  const conVuelos = Boolean(evento.aeropuerto_iata && evento.ciudad_sede);
  const titulo = `${evento.nombre_oficial} ${evento.fecha_inicio.slice(0, 4)} — ${conVuelos ? "vuelos, hoteles y cómo llegar" : "dónde dormir cerca de la partida"}`;
  const descripcion =
    evento.descripcion ??
    `${evento.nombre_oficial}: ${fechaLarga(evento.fecha_inicio)}${lugar ? ` en ${lugar}` : ""}. ${conVuelos ? "Vuelos a la sede, recorrido" : "Recorrido"} en el mapa y alojamiento a distancia caminable de la línea de partida.`;

  return {
    title: { absolute: titulo },
    description: descripcion,
    alternates: {
      canonical: `${SITE_URL}/eventos/${evento.categoria}/${evento.slug}`,
    },
    openGraph: {
      title: titulo,
      description: descripcion,
      type: "article",
      url: `${SITE_URL}/eventos/${evento.categoria}/${evento.slug}`,
    },
  };
}

export default async function EventoPage({
  params,
}: {
  params: Promise<{ categoria: string; slug: string }>;
}) {
  const evento = await cargar(params);
  if (!evento) notFound();

  const tramos = tramosDelEvento(evento);
  const otros = await relacionados(evento);
  // Vuelos solo con un destino verificado y un evento que todavía no pasó: sin
  // IATA el módulo no tiene a dónde buscar, y a un evento pasado no se vuela.
  const ofreceVuelos =
    Boolean(evento.aeropuerto_iata && evento.ciudad_sede) &&
    diasFaltantes(evento.fecha_inicio) >= 1;

  return (
    <main>
      <JsonLdEvento evento={evento} />
      <div className="mx-auto max-w-6xl">
        <HeroEvento evento={evento} />
      </div>

      {ofreceVuelos && (
        <ModuloVuelos
          slug={evento.slug}
          ciudad={evento.ciudad_sede!}
          destinoIata={evento.aeropuerto_iata!}
          fechaEvento={evento.fecha_inicio}
        />
      )}

      <LienzoLogistico
        leyenda={<LeyendaTramos tramos={tramos} />}
        alojamiento={<PanelAlojamiento evento={evento} />}
        mapa={
          MAPBOX_TOKEN ? (
            <MapaEvento
              lat={evento.latitud_partida}
              lng={evento.longitud_partida}
              nombre={evento.nombre_oficial}
              tramos={tramos}
              token={MAPBOX_TOKEN}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-luanna-muted">
              El mapa del recorrido se activa al configurar{" "}
              <code className="mx-1 rounded bg-black/5 px-1">
                NEXT_PUBLIC_MAPBOX_TOKEN
              </code>
              .
            </div>
          )
        }
      />

      <div className="mx-auto max-w-6xl">
        <BarraCrossSelling evento={evento} conModuloVuelos={ofreceVuelos} />

        {evento.descripcion && (
          <section className="px-4 pb-8 md:px-6">
            <h2 className="font-display text-2xl">Sobre el evento</h2>
            <p className="mt-2 max-w-3xl text-luanna-muted">{evento.descripcion}</p>
            {evento.fuente_url && (
              <p className="mt-3 text-xs text-luanna-muted">
                Datos verificados contra{" "}
                <a
                  href={evento.fuente_url}
                  target="_blank"
                  rel="noopener nofollow"
                  className="underline"
                >
                  la fuente oficial
                </a>
                .
              </p>
            )}
          </section>
        )}

        {otros.length > 0 && (
          <section className="px-4 pb-14 md:px-6">
            <h2 className="font-display text-2xl">
              Más {ETIQUETA_CATEGORIA[evento.categoria].toLowerCase()}
            </h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otros.map((e) => (
                <TarjetaEvento key={e.id} evento={e} />
              ))}
            </ul>
            <Link
              href={`/eventos/${evento.categoria}`}
              className="mt-6 inline-block text-sm underline"
            >
              Ver todo el calendario
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
