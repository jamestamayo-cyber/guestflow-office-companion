import { toLocalPhone } from "./format";

/** Philippine mobile numbers: 09XXXXXXXXX or +639XXXXXXXXX (spaces/dashes allowed). */
export function isValidPhone(value: string) {
  const cleaned = value.replace(/[\s-]/g, "");
  if (!/^(\+?63|0)9\d{9}$/.test(cleaned)) return false;
  return toLocalPhone(cleaned).length === 11;
}

export interface VisitorInput {
  fullName: string;
  contact: string;
  purpose: string;
  purposeOther: string;
  host: string;
}

export type VisitorErrors = Partial<Record<keyof VisitorInput, string>>;

export function validateVisitor(input: VisitorInput): VisitorErrors {
  const errors: VisitorErrors = {};
  const name = input.fullName.trim();
  if (!name) errors.fullName = "Full name is required.";
  else if (name.length < 3) errors.fullName = "Enter the visitor's full name.";
  else if (!/^[\p{L} .'-]+$/u.test(name)) errors.fullName = "Use letters, spaces, periods or hyphens only.";

  if (!input.contact.trim()) errors.contact = "Contact number is required.";
  else if (!isValidPhone(input.contact))
    errors.contact = "Use a valid mobile number, e.g. 0917 123 4567 or +63 917 123 4567.";

  if (!input.purpose) errors.purpose = "Select the purpose of visit.";
  else if (input.purpose === "Other" && !input.purposeOther.trim())
    errors.purposeOther = "Please specify the purpose.";

  if (!input.host.trim()) errors.host = "Person or department to visit is required.";
  return errors;
}

export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "One number", test: (p: string) => /\d/.test(p) },
  { id: "symbol", label: "One symbol (e.g. ! @ # $)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export function isStrongPassword(p: string) {
  return PASSWORD_RULES.every((r) => r.test(p));
}

export function isValidUsername(u: string) {
  return /^[a-z][a-z0-9._]{2,19}$/.test(u);
}
