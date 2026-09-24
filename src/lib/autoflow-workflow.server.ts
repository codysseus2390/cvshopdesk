import { projectAutoflowWorkflow, type InboxEvent, type WorkflowRow } from "./autoflow-workflow";
import { loadAutoflowDescriptions } from "./autoflow-descriptions.server";

/** The caller must first verify approved membership in shopId. */
export async function loadAutoflowWorkflow(
  shopId: string,
  timezone: string,
  seeds: WorkflowRow[],
  env: Record<string, string | undefined> = process.env,
) {
  if (env["AUTOFLOW_WEBHOOK_ENABLED"] !== "true" || shopId !== env["AUTOFLOW_SHOPDESK_SHOP_ID"])
    return null;
  const providerShopId = env["AUTOFLOW_SHOP_ID"];
  const subdomain = env["AUTOFLOW_SUBDOMAIN"];
  if (!providerShopId || !subdomain) throw new Error("Autoflow workflow is not configured.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const events: InboxEvent[] = [];
  // No date cutoff: an old, unfinished visit must remain visible. Page past the API row limit.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin
      .from("autoflow_webhook_events")
      .select("payload, received_at")
      .eq("shop_id", shopId)
      .eq("autoflow_shop_id", providerShopId)
      .eq("event_type", "status_update")
      .neq("processing_status", "rejected")
      .order("received_at")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Autoflow workflow could not be refreshed.");
    events.push(...data);
    if (data.length < 500) break;
  }
  const rows = projectAutoflowWorkflow(events, seeds, providerShopId, subdomain, timezone);
  return loadAutoflowDescriptions(rows, shopId, env);
}
