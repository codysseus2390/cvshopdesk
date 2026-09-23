import { createMiddleware } from "@tanstack/react-start";
import { requireCurrentSession, sessionEpoch } from "./session-epoch";

/** Reject late RPC results from an account that has since signed out or changed. */
export const sessionBoundaryMiddleware = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const started = sessionEpoch();
    const result = await next();
    requireCurrentSession(started);
    return result;
  },
);
