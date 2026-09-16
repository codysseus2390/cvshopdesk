/** Attachment limits shared by the composer, the server function and settings. */
export const SHOP_AI_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
] as const;
export const SHOP_AI_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const SHOP_AI_MAX_FILES = 4;
