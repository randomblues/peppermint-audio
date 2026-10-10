"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Dialog.Root open={Boolean(message)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md" />
        <Dialog.Popup
          role="alertdialog"
          onKeyDown={(event) => { if (event.key === "Escape") event.preventDefault(); }}
          className="fixed top-1/2 left-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-destructive/30 bg-popover p-6 text-popover-foreground shadow-2xl"
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" className="size-6" />
          </div>
          <Dialog.Title className="text-xl font-semibold">Action couldn&apos;t be completed</Dialog.Title>
          <Dialog.Description className="mt-3 max-h-[50svh] overflow-y-auto break-words text-sm leading-6 text-muted-foreground">{message}</Dialog.Description>
          <Button variant="destructive" className="mt-6 min-h-11 w-full border border-destructive/25" onClick={onClose}>Close</Button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
