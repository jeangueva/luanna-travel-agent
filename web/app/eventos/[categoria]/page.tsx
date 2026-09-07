import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TarjetaEvento from "@/components/eventos/TarjetaEvento";
import { listarPorCategoria } from "@/lib/eventos";
import {
  CATEGORIAS,
  DESCRIPCION_CATEGORIA,
  ETIQUETA_CATEGORIA,
  esCategoria,
} from "@/lib/eventos-types";
import { SITE_URL } from "@/lib/config";

export const revalidate = 3600;

export function generateStaticParams() {
  return CATEGORIAS.map((categoria) => ({ categoria }));
}

// Las cuatro categorías son un conjunto cerrado: cualquier otra ruta es un 404,
// no una página generada bajo demanda.
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string }>;
}): Promise<Metadata> {
  const { categoria } = await params;
  if (!esCategoria(categoria)) return {};
  return {
    title: {
      absolute: `${ETIQUETA_CATEGORIA[categoria]} — calendario y alojamiento | Luanna`,
    },
    description: DESCRIPCION_CATEGORIA[categoria],
    alternates: { canonical: `${SITE_URL}/eventos/${categoria}` },
  };
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria } = await params;
  if (!esCategoria(categoria)) notFound();

  const eventos = await listarPorCategoria(categoria);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <h1 className="font-display text-4xl md:text-5xl">
        {ETIQUETA_CATEGORIA[categoria]}
      </h1>
      <p className="mt-3 max-w-2xl text-luanna-muted">
        {DESCRIPCION_CATEGORIA[categoria]}
      </p>

      {eventos.length === 0 ? (
        <p className="mt-10 text-luanna-muted">
          Sin eventos publicados en esta categoría por ahora.
        </p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map((e) => (
            <TarjetaEvento key={e.id} evento={e} />
          ))}
        </ul>
      )}
    </main>
  );
}
