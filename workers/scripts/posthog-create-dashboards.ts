// Create the Engagement / Intent Funnel / Operacional dashboards in PostHog.
//
// Usage:
//   POSTHOG_PERSONAL_API_KEY=phx_xxxxxx npm run posthog:dashboards
//
// Optional:
//   POSTHOG_HOST=https://eu.posthog.com   # only if your org is on EU
//
// Idempotent-ish: dashboards are looked up by name and reused if present;
// insights inside an existing dashboard are NOT deduped — running twice
// creates duplicate tiles. Easy fix: delete the dashboards in the UI and rerun.

const HOST = (process.env.POSTHOG_HOST ?? "https://us.posthog.com").replace(
  /\/+$/,
  "",
);
const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
if (!KEY) {
  console.error("POSTHOG_PERSONAL_API_KEY env var is required");
  console.error("Create one at: PostHog → Settings → Personal API Keys");
  console.error("Required scopes: insight:write, dashboard:write");
  process.exit(1);
}

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${HOST}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${body.slice(0, 600)}`);
  }
  return body ? JSON.parse(body) : null;
}

async function currentProject(): Promise<{ id: number; name: string }> {
  const me = await api("/api/users/@me/");
  const projectId = me.team?.id ?? me.organization?.teams?.[0]?.id;
  if (!projectId) {
    throw new Error("could not infer current project_id from /api/users/@me/");
  }
  return { id: projectId, name: me.team?.name ?? "unknown" };
}

async function findDashboardByName(
  projectId: number,
  name: string,
): Promise<number | null> {
  const res = await api(
    `/api/projects/${projectId}/dashboards/?search=${encodeURIComponent(name)}`,
  );
  const hit = (res.results ?? []).find((d: any) => d.name === name);
  return hit?.id ?? null;
}

async function ensureDashboard(
  projectId: number,
  name: string,
  description: string,
): Promise<number> {
  const existing = await findDashboardByName(projectId, name);
  if (existing) {
    console.log(`  dashboard "${name}" already exists (id=${existing}) — reusing`);
    return existing;
  }
  const created = await api(`/api/projects/${projectId}/dashboards/`, {
    method: "POST",
    body: JSON.stringify({ name, description, pinned: true }),
  });
  console.log(`  created dashboard "${name}" (id=${created.id})`);
  return created.id;
}

async function createInsight(
  projectId: number,
  dashboardId: number,
  name: string,
  filters: Record<string, unknown>,
): Promise<void> {
  await api(`/api/projects/${projectId}/insights/`, {
    method: "POST",
    body: JSON.stringify({
      name,
      filters,
      dashboards: [dashboardId],
    }),
  });
  console.log(`    + ${name}`);
}

async function main() {
  console.log(`PostHog host: ${HOST}`);
  const project = await currentProject();
  console.log(`Project: ${project.name} (id=${project.id})`);
  console.log("");

  // ─── 1. Engagement ───────────────────────────────────────────────
  console.log("Engagement");
  const engagement = await ensureDashboard(
    project.id,
    "Engagement",
    "DAU, retention, source split, name capture rate",
  );

  await createInsight(project.id, engagement, "Daily Active Users", {
    insight: "TRENDS",
    events: [{ id: "message_received", type: "events", math: "dau", order: 0 }],
    date_from: "-30d",
    interval: "day",
    display: "ActionsLineGraph",
  });

  await createInsight(project.id, engagement, "Mensajes — WhatsApp vs Web", {
    insight: "TRENDS",
    events: [{ id: "message_received", type: "events", math: "total", order: 0 }],
    breakdown: "source",
    breakdown_type: "event",
    date_from: "-30d",
    display: "ActionsPie",
  });

  await createInsight(project.id, engagement, "Nuevos usuarios por día", {
    insight: "TRENDS",
    events: [{ id: "user_signed_up", type: "events", math: "total", order: 0 }],
    breakdown: "source",
    breakdown_type: "event",
    date_from: "-30d",
    interval: "day",
    display: "ActionsBar",
  });

  await createInsight(project.id, engagement, "Retention — D1 / D7 / D30", {
    insight: "RETENTION",
    target_entity: { id: "user_signed_up", type: "events" },
    returning_entity: { id: "message_received", type: "events" },
    period: "Day",
    retention_type: "retention_first_time",
    total_intervals: 30,
  });

  await createInsight(project.id, engagement, "% usuarios que dieron su nombre", {
    insight: "TRENDS",
    events: [
      {
        id: "tool_called",
        type: "events",
        math: "dau",
        order: 0,
        properties: [
          {
            key: "tool_name",
            value: ["save_user_name"],
            operator: "exact",
            type: "event",
          },
        ],
      },
      { id: "user_signed_up", type: "events", math: "dau", order: 1 },
    ],
    formula: "A/B",
    date_from: "-30d",
    interval: "week",
    display: "ActionsLineGraph",
  });

  // ─── 2. Intent Funnel ─────────────────────────────────────────────
  console.log("");
  console.log("Intent Funnel");
  const funnel = await ensureDashboard(
    project.id,
    "Intent Funnel",
    "Signup → Message → Search funnel and tool usage",
  );

  await createInsight(project.id, funnel, "Signup → Mensaje → Búsqueda", {
    insight: "FUNNELS",
    events: [
      { id: "user_signed_up", type: "events", order: 0 },
      { id: "message_received", type: "events", order: 1 },
      { id: "tool_called", type: "events", order: 2 },
    ],
    funnel_window_interval: 1,
    funnel_window_interval_unit: "day",
    breakdown: "source",
    breakdown_type: "event",
    date_from: "-30d",
    display: "FunnelViz",
  });

  await createInsight(project.id, funnel, "Distribución de tools", {
    insight: "TRENDS",
    events: [{ id: "tool_called", type: "events", math: "total", order: 0 }],
    breakdown: "tool_name",
    breakdown_type: "event",
    date_from: "-30d",
    display: "ActionsPie",
  });

  await createInsight(project.id, funnel, "Top destinos buscados (vuelos)", {
    insight: "TRENDS",
    events: [
      {
        id: "tool_called",
        type: "events",
        math: "total",
        order: 0,
        properties: [
          {
            key: "tool_name",
            value: ["search_flights"],
            operator: "exact",
            type: "event",
          },
        ],
      },
    ],
    breakdown: "destination",
    breakdown_type: "event",
    breakdown_limit: 10,
    date_from: "-30d",
    display: "ActionsBarValue",
  });

  await createInsight(project.id, funnel, "Búsquedas por usuario activo", {
    insight: "TRENDS",
    events: [
      {
        id: "tool_called",
        type: "events",
        math: "total",
        order: 0,
        properties: [
          {
            key: "tool_name",
            value: ["search_flights", "search_hotels", "get_package_link"],
            operator: "exact",
            type: "event",
          },
        ],
      },
      { id: "message_received", type: "events", math: "dau", order: 1 },
    ],
    formula: "A/B",
    date_from: "-30d",
    interval: "week",
    display: "ActionsLineGraph",
  });

  // ─── 3. Operacional ───────────────────────────────────────────────
  console.log("");
  console.log("Operacional");
  const ops = await ensureDashboard(
    project.id,
    "Operacional",
    "Daily offers, preferences saved, watchlist creations",
  );

  await createInsight(project.id, ops, "Ofertas diarias enviadas", {
    insight: "TRENDS",
    events: [{ id: "daily_offer_sent", type: "events", math: "total", order: 0 }],
    date_from: "-30d",
    interval: "day",
    display: "ActionsLineGraph",
  });

  await createInsight(project.id, ops, "Destinos de ofertas diarias", {
    insight: "TRENDS",
    events: [{ id: "daily_offer_sent", type: "events", math: "total", order: 0 }],
    breakdown: "destination_pretty",
    breakdown_type: "event",
    breakdown_limit: 10,
    date_from: "-30d",
    display: "ActionsBarValue",
  });

  await createInsight(project.id, ops, "Preferencias guardadas (Web vs WA Flow)", {
    insight: "TRENDS",
    events: [{ id: "preferences_saved", type: "events", math: "dau", order: 0 }],
    breakdown: "source",
    breakdown_type: "event",
    date_from: "-30d",
    display: "ActionsBar",
  });

  await createInsight(project.id, ops, "Alertas de precio creadas", {
    insight: "TRENDS",
    events: [
      {
        id: "tool_called",
        type: "events",
        math: "total",
        order: 0,
        properties: [
          {
            key: "tool_name",
            value: ["add_watchlist"],
            operator: "exact",
            type: "event",
          },
        ],
      },
    ],
    date_from: "-30d",
    interval: "day",
    display: "ActionsLineGraph",
  });

  await createInsight(project.id, ops, "Signup → Completó preferencias", {
    insight: "FUNNELS",
    events: [
      { id: "user_signed_up", type: "events", order: 0 },
      { id: "preferences_saved", type: "events", order: 1 },
    ],
    funnel_window_interval: 7,
    funnel_window_interval_unit: "day",
    breakdown: "source",
    breakdown_type: "event",
    date_from: "-30d",
    display: "FunnelViz",
  });

  console.log("");
  console.log("✅ done. Open them at:");
  console.log(`   ${HOST}/dashboards`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
