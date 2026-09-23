import { expect, it, vi } from "vitest";
import { readAllRows } from "./read-all-rows";

it("retains rows beyond the backend's first page", async () => {
  const records = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const page = vi.fn(async (from: number, to: number) => ({
    data: records.slice(from, to + 1),
    error: null,
  }));
  expect((await readAllRows(page)).data).toEqual(records);
  expect(page).toHaveBeenCalledTimes(3);
});
it("rejects the entire report when a later page fails", async () => {
  await expect(
    readAllRows(async (from) =>
      from === 0
        ? { data: Array.from({ length: 500 }, (_, id) => id), error: null }
        : { data: null, error: { message: "network failure" } },
    ),
  ).rejects.toThrow("Unable to load all");
});
