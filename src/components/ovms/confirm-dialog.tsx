import { useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = "default",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  tone?: "default" | "danger";
  children?: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: tone === "danger" ? "destructive" : "default" })}
            disabled={saving}
            onClick={async (event) => {
              event.preventDefault();
              setSaving(true);
              try { await onConfirm(); } catch { /* Service reports the error; leave confirmation open for retry. */ }
              finally { setSaving(false); }
            }}
          >
            {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}{saving ? "Saving…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
