import { FileText, X } from "lucide-react";

export interface DraftAttachment {
  id: string;
  name: string;
  mimeType: string;
  /** data:<mime>;base64,... — sent to the secure server function, never to OpenAI from the browser. */
  dataUrl: string;
  size: number;
}

export const ACCEPTED_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENTS = 4;

/** Reads a pasted, dropped or chosen file into a data URL. */
export function readAttachment(file: File): Promise<DraftAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name || "That file"} could not be read.`));
    reader.onload = () =>
      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name && file.name.trim().length > 0 ? file.name : "screenshot.png",
        mimeType: file.type,
        dataUrl: String(reader.result),
        size: file.size,
      });
    reader.readAsDataURL(file);
  });
}

/** Returns an error message when a file cannot be attached. */
export function validateAttachment(file: File, current: number): string | null {
  if (current >= MAX_ATTACHMENTS) return `Hank takes up to ${MAX_ATTACHMENTS} attachments per message.`;
  if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
    return `${file.name || "That file"} is not supported. Attach a PNG, JPG, WEBP image or a PDF.`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name || "That file"} is larger than 8 MB.`;
  return null;
}

/** Thumbnail row shown inside the composer before sending. */
export function AttachmentStrip({
  items,
  onRemove,
  disabled,
}: {
  items: DraftAttachment[];
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative flex items-center gap-2 rounded-xl border border-border bg-muted/60 p-1.5 pr-2"
        >
          {item.mimeType.startsWith("image/") ? (
            <img
              src={item.dataUrl}
              alt={item.name}
              className="h-12 w-12 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background text-muted-foreground">
              <FileText className="h-5 w-5" />
            </span>
          )}
          <span className="max-w-[9rem] truncate text-[11px] font-medium text-foreground">{item.name}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              aria-label={`Remove ${item.name}`}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
