import Link from "next/link";
import CuentaRegresiva from "./CuentaRegresiva";
import { ETIQUETA_PRECISION, formatoCosto } from "@/lib/costo";
import { ETIQUETA_CATEGORIA, nombreEtiqueta, type Evento } from "@/lib/eventos-types";
import { fechaLarga } from "@/lib/fechas";

export default function HeroEvento({ evento }: { evento: Evento }) {
  const lugar = [evento.ciudad_sede, evento.pais].filter(Boolean).join(", ");
  const clima = evento.clima_proyectado;
  const costo = formatoCosto(evento.costo_min, evento.costo_max, evento.moneda);

  return (
    <header className="px-4 pb-5 pt-8 md:px-6 md:pb-6 md:pt-10">
      <nav aria-label="Ruta de navegación" className="mb-3 text-xs text-luanna-muted">
        <Link href="/eventos" className="hover:text-luanna-text">
          Eventos
        </Link>
        <span className="mx-1.5">/</span>
        <Link
          href={`/eventos/${evento.categoria}`}
          className="hover:text-luanna-text"
        >
          {ETIQUETA_CATEGORIA[evento.categoria]}
        </Link>
      </nav>

      <h1 className="font-display text-3xl leading-tight md:text-5xl">
        {evento.nombre_oficial}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
        <time dateTime={evento.fecha_inicio} className="font-medium">
          {fechaLarga(evento.fecha_inicio)}
        </time>
        {evento.fecha_precision !== "exacta" && (
          <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs">
            {ETIQUETA_PRECISION[evento.fecha_precision]}
          </span>
        )}
        {lugar && <span className="text-luanna-muted">{lugar}</span>}
        {costo && (
          <span className="text-luanna-muted">
            Inscripción ≈ {costo}
            {evento.inscripcion_url && (
              <>
                {" · "}
                <a
                  href={evento.inscripcion_url}
                  target="_blank"
                  rel="noopener nofollow"
                  className="underline"
                >
                  inscribirme
                </a>
              </>
            )}
          </span>
        )}
        <CuentaRegresiva fecha={evento.fecha_inicio} />
        {clima?.temp_min != null && clima?.temp_max != null && (
          <span className="text-luanna-muted">
            {clima.temp_min}–{clima.temp_max} °C
            {clima.condicion ? `, ${clima.condicion}` : ""}
          </span>
        )}
      </div>

      {(evento.etiquetas.length > 0 || evento.badges.length > 0) && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {evento.etiquetas.map((e) => (
            <li
              key={`t-${e}`}
              className="rounded-full bg-luanna-prompt/10 px-3 py-1 text-xs font-medium text-luanna-prompt"
            >
              {nombreEtiqueta(e)}
            </li>
          ))}
          {evento.badges.map((badge) => (
            <li
              key={badge}
              className="rounded-full border border-black/10 px-3 py-1 text-xs text-luanna-muted"
            >
              {badge}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
