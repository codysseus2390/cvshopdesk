import { expect, it } from "vitest";
import { advanceSessionEpoch, requireCurrentSession, sessionEpoch } from "./session-epoch";
it("rejects a late result from an earlier account, including an A-B-A switch", () => {
  const started = sessionEpoch();
  expect(() => requireCurrentSession(started)).not.toThrow();
  advanceSessionEpoch();
  advanceSessionEpoch();
  expect(() => requireCurrentSession(started)).toThrow("account changed");
  expect(() => requireCurrentSession(sessionEpoch())).not.toThrow();
});
