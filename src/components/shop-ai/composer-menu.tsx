/**
 * The "+" menu shared by Hank's main composer and the bottom Hank bar, so both
 * always offer the same things.
 */
import { useEffect, useState } from "react";
import { Camera, ImageIcon, Palette, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  disabled?: boolean;
  /** Opens the file chooser for a photo or PDF Hank should look at. */
  onAttach: () => void;
  /** Opens the phone/tablet camera to take a photo for Hank. */
  onTakePhoto?: () => void;
  /** Starts a picture request in the composer. */
  onCreateImage: () => void;
  /** Bigger control on the bottom bar. */
  size?: "sm" | "lg";
}

/** True on phones/tablets, where a camera capture actually opens the camera. */
function useHasCamera() {
  const [hasCamera, setHasCamera] = useState(false);
  useEffect(() => {
    setHasCamera(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  return hasCamera;
}

export function ComposerMenu({ disabled, onAttach, onTakePhoto, onCreateImage, size = "sm" }: Props) {
  const box = size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const hasCamera = useHasCamera();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label="More options: take a photo, attach a file, or create an image"
          title="Attach or create"
          className={`${box} shrink-0 rounded-full`}
        >
          {size === "lg" ? <Plus className="h-5 w-5" /> : <Plus className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        {hasCamera && onTakePhoto && (
          <DropdownMenuItem onSelect={() => onTakePhoto()}>
            <Camera className="mr-2 h-4 w-4" /> Take a photo
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onAttach()}>
          <ImageIcon className="mr-2 h-4 w-4" /> Upload photo or file
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreateImage()}>
          <Palette className="mr-2 h-4 w-4" /> Create image
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Prefix Hank recognises as a picture request. */
export const CREATE_IMAGE_PREFIX = "Create an image of ";
