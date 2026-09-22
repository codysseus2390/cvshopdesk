/**
 * The data model only reliably distinguishes three states: a future
 * appointment, an arrived-but-unfinished job, and a finished job. There is no
 * field that separates "actively being worked on" from "arrived and
 * waiting", so that distinction is intentionally not invented here — see
 * PROJECT_CONTEXT / the TV mode redesign notes for why.
 */
export type TvStatus = "upcoming" | "in_shop" | "done";

export const TV_STATUS_LABEL: Record<TvStatus, string> = {
  upcoming: "UPCOMING",
  in_shop: "IN SHOP",
  done: "DONE",
};
