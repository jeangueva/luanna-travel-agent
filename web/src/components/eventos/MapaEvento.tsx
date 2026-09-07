"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import togeojson from "@mapbox/togeojson";
import type { FeatureCollection } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { COLOR_TRAMO, type Tramo } from "@/lib/eventos-types";

interface Props {
  lat: number;
  lng: number;
  nombre: string;
  tramos: Tramo[];
  token: string;
}

async function cargarGpx(url: string): Promise<FeatureCollection | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), "text/xml");
    // Un XML mal formado no lanza: DOMParser devuelve un documento cuyo primer
    // hijo es <parsererror>. Sin este chequeo, togeojson devuelve una colección
    // vacía y el trazado desaparece sin explicación.
    if (doc.querySelector("parsererror")) return null;
    return togeojson.gpx(doc);
  } catch {
    return null;
  }
}

export default function MapaEvento({ lat, lng, nombre, tramos, token }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<mapboxgl.Map | null>(null);
  const [trazadosFallidos, setTrazadosFallidos] = useState<string[]>([]);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: contenedor.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [lng, lat],
      zoom: 13,
      attributionControl: true,
    });
    mapa.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    new mapboxgl.Marker({ color: "#FF4500" })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(`Partida — ${nombre}`))
      .addTo(map);

    let cancelado = false;

    map.on("load", async () => {
      const conRuta = tramos.filter((t) => t.gpx_url);
      if (conRuta.length === 0) return;

      // El encuadre se calcula sobre todos los tramos juntos: en un triatlón,
      // ajustar solo al primero deja el circuito de ciclismo fuera de cuadro.
      const limites = new mapboxgl.LngLatBounds([lng, lat], [lng, lat]);
      const fallidos: string[] = [];

      for (const tramo of conRuta) {
        const geojson = await cargarGpx(tramo.gpx_url!);
        if (cancelado || !map.getStyle()) return;
        if (!geojson || geojson.features.length === 0) {
          fallidos.push(tramo.nombre);
          continue;
        }

        const id = `tramo-${tramo.tipo}`;
        if (map.getSource(id)) continue;
        map.addSource(id, { type: "geojson", data: geojson });
        map.addLayer({
          id,
          type: "line",
          source: id,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": COLOR_TRAMO[tramo.tipo],
            "line-width": 4,
            "line-opacity": 0.9,
          },
        });

        for (const feature of geojson.features) {
          const geom = feature.geometry;
          if (geom.type === "LineString") {
            for (const c of geom.coordinates) limites.extend([c[0], c[1]]);
          } else if (geom.type === "MultiLineString") {
            for (const linea of geom.coordinates) {
              for (const c of linea) limites.extend([c[0], c[1]]);
            }
          }
        }
      }

      if (cancelado) return;
      if (fallidos.length > 0) setTrazadosFallidos(fallidos);
      if (!limites.isEmpty()) {
        map.fitBounds(limites, { padding: 60, maxZoom: 15, duration: 0 });
      }
    });

    return () => {
      cancelado = true;
      map.remove();
      mapa.current = null;
    };
  }, [lat, lng, nombre, tramos, token]);

  return (
    <div className="relative h-full w-full">
      <div ref={contenedor} className="h-full w-full" />
      {trazadosFallidos.length > 0 && (
        <p className="absolute bottom-3 left-3 right-3 rounded-md bg-white/95 px-3 py-2 text-xs text-luanna-muted shadow">
          No se pudo cargar el trazado de: {trazadosFallidos.join(", ")}. El punto
          de partida sí está confirmado.
        </p>
      )}
    </div>
  );
}
