import type { MetadataRoute } from 'next'
import { listarPublicados } from '@/lib/eventos'
import { CATEGORIAS } from '@/lib/eventos-types'
import { SITE_URL } from '@/lib/config'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const eventos = await listarPublicados(5000)

  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/ayuda`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/integraciones`, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${SITE_URL}/eventos`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/terminos`, changeFrequency: 'monthly', priority: 0.4 },
    ...CATEGORIAS.map((c) => ({
      url: `${SITE_URL}/eventos/${c}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...eventos.map((e) => ({
      url: `${SITE_URL}/eventos/${e.categoria}/${e.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
