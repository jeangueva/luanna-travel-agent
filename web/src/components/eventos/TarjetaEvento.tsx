import Link from "next/link";
import { ETIQUETA_CATEGORIA, type Evento } from "@/lib/eventos-types";
import { fechaCorta } from "@/lib/fechas";

export default function TarjetaEvento({ evento }: { evento: Evento }) {
  const lugar = [evento.ciudad_sede, evento.pais].filter(Boolean).join(", ");

  return (
    <li>
      <Link
        href={`/eventos/${evento.categoria}/${evento.slug}`}
        className="group flex h-full flex-col justify-between gap-3 rounded-lg border border-black/10 p-5 transition hover:border-luanna-prompt/50 hover:shadow-sm"
      >
        <div>
          <span className="text-xs uppercase tracking-wide text-luanna-muted">
            {ETIQUETA_CATEGORIA[evento.categoria]}
          </span>
          <h3 className="mt-1.5 font-display text-xl leading-snug group-hover:text-luanna-prompt">
            {evento.nombre_oficial}
          </h3>
          {lugar && <p className="mt-1 text-sm text-luanna-muted">{lugar}</p>}
        </div>
        <time dateTime={evento.fecha_inicio} className="text-sm font-medium">
          {fechaCorta(evento.fecha_inicio)}
        </time>
      </Link>
    </li>
  );
}
