/** Autoflow: Checkin → upcoming; Inspecting through Servicing → in shop; Ready → done. */
export type TvStatus = "upcoming" | "in_shop" | "done";

export const TV_STATUS_LABEL: Record<TvStatus, string> = {
  upcoming: "UPCOMING",
  in_shop: "IN SHOP",
  done: "DONE",
};
