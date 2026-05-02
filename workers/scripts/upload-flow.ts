import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDevVars(): Record<string, string> {
  const path = join(__dirname, "..", ".dev.vars");
  const content = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const KAPSO_BASE = "https://api.kapso.ai";

async function kapso(
  apiKey: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${KAPSO_BASE}${path}`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  const env = loadDevVars();
  const apiKey = env.KAPSO_API_KEY;
  const phoneNumberId = env.KAPSO_PHONE_NUMBER_ID;
  if (!apiKey)
    throw new Error("KAPSO_API_KEY missing in .dev.vars");
  if (!phoneNumberId)
    throw new Error(
      "KAPSO_PHONE_NUMBER_ID missing in .dev.vars (find it in Kapso dashboard or DB)",
    );

  const flowJsonPath = join(__dirname, "..", "flows", "preferences.json");
  const flowJson = JSON.parse(readFileSync(flowJsonPath, "utf8"));

  console.log("1/3 Creating flow shell...");
  const createdRaw = await kapso(apiKey, "/platform/v1/whatsapp/flows", {
    phone_number_id: phoneNumberId,
    name: "luanna_preferences",
  });
  console.log(JSON.stringify(createdRaw, null, 2));
  const created = createdRaw as {
    id?: string;
    meta_flow_id?: string;
    whatsapp_flow?: { id?: string; meta_flow_id?: string };
  };
  const flowId = created.id ?? created.whatsapp_flow?.id;
  const metaFlowId = created.meta_flow_id ?? created.whatsapp_flow?.meta_flow_id;
  if (!flowId) throw new Error("Could not extract flow id from response");
  console.log(`  flow id: ${flowId} (meta: ${metaFlowId})`);

  console.log("2/3 Uploading flow JSON as version...");
  await kapso(
    apiKey,
    `/platform/v1/whatsapp/flows/${flowId}/versions`,
    { flow_json: flowJson, phone_number_id: phoneNumberId },
  );
  console.log("  uploaded.");

  console.log("3/3 Publishing flow...");
  await kapso(
    apiKey,
    `/platform/v1/whatsapp/flows/${flowId}/publish`,
    { phone_number_id: phoneNumberId },
  );
  console.log("  published.");

  console.log("\nDone. Add this to .dev.vars and as a Wrangler secret:");
  console.log(`KAPSO_PREFS_FLOW_ID=${metaFlowId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
