import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "./notices";
import { HOSTS, PURPOSES } from "@/lib/ovms/types";
import type { VisitorErrors, VisitorInput } from "@/lib/ovms/validation";
import { cn } from "@/lib/utils";

export const emptyVisitorInput: VisitorInput = { fullName: "", contact: "", purpose: "", purposeOther: "", host: "" };

/** Splits a stored purpose ("Other: Building inspection") back into form fields. */
export function toVisitorInput(v: { fullName: string; contact: string; purpose: string; host: string }): VisitorInput {
  const known = (PURPOSES as readonly string[]).includes(v.purpose);
  return {
    fullName: v.fullName,
    contact: v.contact,
    purpose: known ? v.purpose : "Other",
    purposeOther: known ? "" : v.purpose.replace(/^Other:\s*/, ""),
    host: v.host,
  };
}

export function resolvePurpose(input: VisitorInput) {
  return input.purpose === "Other" ? `Other: ${input.purposeOther.trim()}` : input.purpose;
}

export function VisitorFields({
  values,
  errors,
  onChange,
  onBlur,
  idPrefix = "v",
}: {
  values: VisitorInput;
  errors: VisitorErrors;
  onChange: (patch: Partial<VisitorInput>) => void;
  onBlur?: (field: keyof VisitorInput) => void;
  idPrefix?: string;
}) {
  const err = (k: keyof VisitorInput) => (errors[k] ? "border-destructive focus-visible:ring-destructive" : "");
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`} className="mb-1.5 block">
          Full name <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          onBlur={() => onBlur?.("fullName")}
          placeholder="e.g. Juan Dela Cruz"
          className={cn("h-11 rounded-lg", err("fullName"))}
          aria-invalid={!!errors.fullName}
        />
        <FieldError message={errors.fullName} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-contact`} className="mb-1.5 block">
          Contact number <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`${idPrefix}-contact`}
          inputMode="tel"
          maxLength={16}
          value={values.contact}
          onChange={(e) => onChange({ contact: e.target.value.replace(/[^\d+\s-]/g, "") })}
          onBlur={() => onBlur?.("contact")}
          placeholder="0917 123 4567"
          className={cn("h-11 rounded-lg font-mono", err("contact"))}
          aria-invalid={!!errors.contact}
        />
        {errors.contact ? (
          <FieldError message={errors.contact} />
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">Mobile number, 11 digits starting with 09.</p>
        )}
      </div>
      <div>
        <Label className="mb-1.5 block">
          Purpose of visit <span className="text-destructive">*</span>
        </Label>
        <Select
          value={values.purpose}
          onValueChange={(v) => {
            onChange({ purpose: v, purposeOther: v === "Other" ? values.purposeOther : "" });
            onBlur?.("purpose");
          }}
        >
          <SelectTrigger className={cn("h-11 rounded-lg", err("purpose"))} aria-invalid={!!errors.purpose}>
            <SelectValue placeholder="Select purpose" />
          </SelectTrigger>
          <SelectContent>
            {PURPOSES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
            <SelectItem value="Other">Other (please specify)</SelectItem>
          </SelectContent>
        </Select>
        <FieldError message={errors.purpose} />
      </div>
      {values.purpose === "Other" && (
        <div className="sm:col-span-2">
          <Label htmlFor={`${idPrefix}-other`} className="mb-1.5 block">
            Specify purpose <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${idPrefix}-other`}
            value={values.purposeOther}
            onChange={(e) => onChange({ purposeOther: e.target.value })}
            onBlur={() => onBlur?.("purposeOther")}
            placeholder="e.g. Building inspection"
            className={cn("h-11 rounded-lg", err("purposeOther"))}
          />
          <FieldError message={errors.purposeOther} />
        </div>
      )}
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-host`} className="mb-1.5 block">
          Person / department to visit <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`${idPrefix}-host`}
          list={`${idPrefix}-hosts`}
          value={values.host}
          onChange={(e) => onChange({ host: e.target.value })}
          onBlur={() => onBlur?.("host")}
          placeholder="e.g. Records Section or Atty. Ramos"
          className={cn("h-11 rounded-lg", err("host"))}
          aria-invalid={!!errors.host}
        />
        <datalist id={`${idPrefix}-hosts`}>
          {HOSTS.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <FieldError message={errors.host} />
      </div>
    </div>
  );
}
