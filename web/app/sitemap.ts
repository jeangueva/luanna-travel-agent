import type { MetadataRoute } from "next";
import { listarPublicados } from "@/lib/eventos";
import { CATEGORIAS } from "@/lib/eventos-types";
import { SITE_URL } from "@/lib/config";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const eventos = await listarPublicados(5000);

  return [
    { url: `${SITE_URL}/eventos`, changeFrequency: "daily", priority: 0.9 },
    ...CATEGORIAS.map((c) => ({
      url: `${SITE_URL}/eventos/${c}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...eventos.map((e) => ({
      url: `${SITE_URL}/eventos/${e.categoria}/${e.slug}`,
      // La página deja de tener valor el día de la carrera, así que la
      // prioridad sube conforme se acerca en vez de ser fija.
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
