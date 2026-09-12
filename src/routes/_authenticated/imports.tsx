import { createFileRoute, redirect } from "@tanstack/react-router";

/** Uploads and report imports now live on the Tools page. Old links keep working. */
export const Route = createFileRoute("/_authenticated/imports")({
  beforeLoad: () => {
    throw redirect({ to: "/tools", replace: true });
  },
});
