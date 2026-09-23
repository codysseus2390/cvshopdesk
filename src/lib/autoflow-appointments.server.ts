import { readAutoflow } from "./autoflow.server";
import { parseAutoflowAppointments } from "./autoflow-appointments";

/** Called only after approved membership is established by listBoard. */
export async function loadAutoflowAppointments(
  shopId: string,
  timezone: string,
  today: string,
  env: Record<string, string | undefined> = process.env,
  read: typeof readAutoflow = readAutoflow,
) {
  if (env["AUTOFLOW_APPOINTMENTS_ENABLED"] !== "true") return null;
  // A credential is bound to exactly one ShopDesk shop per deployment.
  if (shopId !== env["AUTOFLOW_SHOPDESK_SHOP_ID"]) return null;
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 30);
  const payload = await read(
    {
      resource: "appointments",
      start: `${today}T00:00:00`,
      end: `${end.toISOString().slice(0, 10)}T23:59:59`,
    },
    env,
  );
  return parseAutoflowAppointments(payload, timezone, new Date().toISOString());
}
