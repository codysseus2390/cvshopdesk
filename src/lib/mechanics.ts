export const MECHANICS = ["Dale", "Josh", "Teagen"] as const;

export type MechanicName = (typeof MECHANICS)[number];

