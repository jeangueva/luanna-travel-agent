import { ETIQUETA_CATEGORIA, type Evento } from "@/lib/eventos-types";
import { SITE_URL } from "@/lib/config";

/**
 * Schema.org SportsEvent es lo que convierte una página en un resultado
 * enriquecido con fecha y lugar. En una plataforma de SEO programático es
 * infraestructura, no decoración: sin él las mil páginas compiten solo por
 * texto plano.
 */
export default function JsonLdEvento({ evento }: { evento: Evento }) {
  const url = `${SITE_URL}/eventos/${evento.categoria}/${evento.slug}`;
  const datos = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: evento.nombre_oficial,
    startDate: evento.fecha_inicio,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: ETIQUETA_CATEGORIA[evento.categoria],
    url,
    description: evento.descripcion ?? undefined,
    location: {
      "@type": "Place",
      name: [evento.ciudad_sede, evento.pais].filter(Boolean).join(", ") || evento.nombre_oficial,
      geo: {
        "@type": "GeoCoordinates",
        latitude: evento.latitud_partida,
        longitude: evento.longitud_partida,
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: evento.ciudad_sede ?? undefined,
        addressCountry: evento.pais ?? undefined,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }}
    />
  );
}
