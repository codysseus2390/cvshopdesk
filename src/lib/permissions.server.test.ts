import { expect, it } from "vitest";
import { readShopPermissions } from "./permissions.server";

function client(data: unknown, error: unknown = null) {
  return { from: () => ({ select: () => ({ eq: async () => ({ data, error }) }) }) };
}
it("honors explicit manager denial on the server", async () => {
  const allowed = await readShopPermissions(
    client([{ role: "manager", permission: "edit_dashboard_numbers", allowed: false }]),
    "shop-a",
    "manager",
  );
  expect(allowed("edit_dashboard_numbers")).toBe(false);
  expect(allowed("view_dashboard")).toBe(true);
});
it("fails closed even for an owner when the override query fails", async () => {
  await expect(
    readShopPermissions(client(null, { message: "offline" }), "shop-a", "owner"),
  ).rejects.toThrow("Unable to verify");
});
it("does not grant productivity to display accounts by default", async () => {
  const allowed = await readShopPermissions(client([]), "shop-a", "display");
  expect(allowed("view_productivity")).toBe(false);
});
