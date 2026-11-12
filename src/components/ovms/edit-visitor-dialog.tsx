import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuditNotice, FieldError } from "./notices";
import { VisitorFields, resolvePurpose, toVisitorInput } from "./visitor-fields";
import { useOvms } from "@/lib/ovms/store";
import { validateVisitor, type VisitorInput } from "@/lib/ovms/validation";
import type { Visitor } from "@/lib/ovms/types";

export function EditVisitorDialog({ visitor, onClose }: { visitor: Visitor | null; onClose: () => void }) {
  const { editVisitor } = useOvms();
  const [values, setValues] = useState<VisitorInput | null>(null);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visitor) {
      setValues(toVisitorInput(visitor));
      setReason("");
      setSubmitted(false);
    }
  }, [visitor]);

  if (!visitor || !values) return null;
  const errors = submitted ? validateVisitor(values) : {};
  const reasonError = submitted && reason.trim().length < 10 ? "Give a reason of at least 10 characters." : undefined;

  const save = () => {
    setSubmitted(true);
    if (Object.keys(validateVisitor(values)).length || reason.trim().length < 10) return;
    editVisitor(visitor.id, { fullName: values.fullName, contact: values.contact, purpose: resolvePurpose(values), host: values.host }, reason);
    toast.success(`Record ${visitor.id} updated`, { description: "The change was written to Activity Logs." });
    onClose();
  };

  return (
    <Dialog open={!!visitor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit visitor record</DialogTitle>
          <DialogDescription className="font-mono text-xs">{visitor.id}</DialogDescription>
        </DialogHeader>
        <AuditNotice>
          <strong>Changes are logged.</strong> Your name, the time, every field you change and your reason will be
          recorded in Activity Logs and cannot be removed.
        </AuditNotice>
        <VisitorFields idPrefix="edit" values={values} errors={errors} onChange={(p) => setValues((v) => (v ? { ...v, ...p } : v))} />
        <div>
          <Label htmlFor="reason" className="mb-1.5 block">
            Reason for edit <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Visitor corrected the spelling of their name."
            className={reasonError ? "border-destructive" : ""}
            rows={3}
          />
          <FieldError message={reasonError} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
