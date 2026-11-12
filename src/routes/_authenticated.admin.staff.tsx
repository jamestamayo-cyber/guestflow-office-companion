import { createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, Pencil, Power, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Panel } from "@/components/ovms/page-header";
import { AccountStatusBadge, RoleBadge } from "@/components/ovms/badges";
import { ConfirmDialog } from "@/components/ovms/confirm-dialog";
import { AuditNotice, FieldError, PasswordRulesHint } from "@/components/ovms/notices";
import { useCurrentUser, useOvms } from "@/lib/ovms/store";
import { initials } from "@/lib/ovms/format";
import { pageHead } from "@/lib/ovms/head";
import { isStrongPassword, isValidUsername } from "@/lib/ovms/validation";
import type { Role, StaffUser } from "@/lib/ovms/types";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => pageHead("Manage Staff Accounts", "Add, edit, deactivate and reset passwords for staff accounts."),
  component: StaffAccounts,
});

type FormMode = { kind: "add" } | { kind: "edit"; user: StaffUser } | null;

function StaffAccounts() {
  const me = useCurrentUser();
  const { state, setStaffStatus, resetPassword } = useOvms();
  const [form, setForm] = useState<FormMode>(null);
  const [toggle, setToggle] = useState<StaffUser | null>(null);
  const [resetFor, setResetFor] = useState<StaffUser | null>(null);
  const [issued, setIssued] = useState<{ user: StaffUser; password: string } | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Manage Staff Accounts"
        description={`${state.users.filter((u) => u.status === "active").length} active of ${state.users.length} accounts.`}
        actions={<Button onClick={() => setForm({ kind: "add" })}><UserPlus /> Add Staff</Button>}
      />
      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{initials(u.name)}</div>
                      <div>
                        <p className="font-semibold">{u.name} {u.id === me.id && <span className="text-xs font-normal text-muted-foreground">(you)</span>}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{u.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">@{u.username}</TableCell>
                  <TableCell><RoleBadge role={u.role} /></TableCell>
                  <TableCell><AccountStatusBadge status={u.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastLoginAt ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true }) : "Never"}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setForm({ kind: "edit", user: u })}><Pencil /> Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setResetFor(u)}><KeyRound /> Reset</Button>
                      <Button
                        size="sm"
                        variant={u.status === "active" ? "destructive-soft" : "soft"}
                        disabled={u.id === me.id}
                        title={u.id === me.id ? "You can't deactivate your own account" : undefined}
                        onClick={() => setToggle(u)}
                      >
                        <Power /> {u.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <StaffFormDialog mode={form} onClose={() => setForm(null)} />

      <ConfirmDialog
        open={!!toggle}
        onOpenChange={(o) => !o && setToggle(null)}
        tone={toggle?.status === "active" ? "danger" : "default"}
        title={toggle?.status === "active" ? `Deactivate ${toggle?.name}?` : `Reactivate ${toggle?.name}?`}
        description={toggle?.status === "active" ? "They will be signed out and can no longer log in. Their past records and logs are kept." : "They will be able to sign in again with their existing password."}
        confirmLabel={toggle?.status === "active" ? "Deactivate" : "Activate"}
        onConfirm={() => {
          if (!toggle) return;
          setStaffStatus(toggle.id, toggle.status === "active" ? "inactive" : "active");
          toast.success(`${toggle.name} ${toggle.status === "active" ? "deactivated" : "reactivated"}`);
          setToggle(null);
        }}
      />

      <ConfirmDialog
        open={!!resetFor}
        onOpenChange={(o) => !o && setResetFor(null)}
        tone="danger"
        title={`Reset password for ${resetFor?.name}?`}
        description="A temporary password will be generated. Their current password stops working immediately."
        confirmLabel="Reset password"
        onConfirm={() => {
          if (!resetFor) return;
          const pwd = resetPassword(resetFor.id);
          setIssued({ user: resetFor, password: pwd });
          setResetFor(null);
        }}
      />

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Temporary password issued</DialogTitle>
            <DialogDescription>Share this with {issued?.user.name} in person. It is shown only once.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-primary bg-secondary px-4 py-3">
            <span className="font-mono text-lg font-semibold tracking-wide">{issued?.password}</span>
            <Button size="icon" variant="ghost" aria-label="Copy" onClick={() => { navigator.clipboard?.writeText(issued?.password ?? ""); toast.success("Copied"); }}><Copy /></Button>
          </div>
          <DialogFooter><Button onClick={() => setIssued(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StaffFormDialog({ mode, onClose }: { mode: FormMode; onClose: () => void }) {
  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        {mode && <StaffForm key={mode.kind === "edit" ? mode.user.id : "add"} mode={mode} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function StaffForm({ mode, onClose }: { mode: NonNullable<FormMode>; onClose: () => void }) {
  const { addStaff, updateStaff } = useOvms();
  const editing = mode.kind === "edit" ? mode.user : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [username, setUsername] = useState(editing?.username ?? "");
  const [role, setRole] = useState<Role>(editing?.role ?? "receptionist");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string>();

  const errors = {
    name: !name.trim() ? "Full name is required." : undefined,
    username: !username.trim() ? "Username is required." : !isValidUsername(username.trim().toLowerCase()) ? "3–20 lowercase letters, numbers, dots or underscores; start with a letter." : undefined,
    password: !editing && !isStrongPassword(password) ? "Password doesn't meet all the rules below." : undefined,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    setServerError(undefined);
    if (errors.name || errors.username || errors.password) return;
    const res = editing ? updateStaff(editing.id, { name, username, role }) : addStaff({ name, username, role, password });
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    toast.success(editing ? `${name} updated` : `${name} added`, { description: editing ? undefined : "They can now sign in with the temporary password." });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit staff account" : "Add staff account"}</DialogTitle>
        <DialogDescription>{editing ? "Update account details and role." : "Create login credentials for a new staff member."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="s-name" className="mb-1.5 block">Full name</Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Carla Domingo" className="h-11 rounded-lg" />
          <FieldError message={show("name")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="s-user" className="mb-1.5 block">Username</Label>
            <Input id="s-user" value={username} onChange={(e) => { setUsername(e.target.value); setServerError(undefined); }} placeholder="cdomingo" className="h-11 rounded-lg font-mono" autoComplete="off" />
            <FieldError message={show("username") ?? serverError} />
          </div>
          <div>
            <Label className="mb-1.5 block">Role</Label>
            <Select value={role} onValueChange={(r) => setRole(r as Role)}>
              <SelectTrigger className="h-11 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receptionist">Office Staff / Receptionist</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {!editing && (
          <div>
            <Label htmlFor="s-pass" className="mb-1.5 block">Temporary password</Label>
            <Input id="s-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-lg font-mono" autoComplete="new-password" />
            <FieldError message={show("password")} />
            <div className="mt-2"><PasswordRulesHint password={password} /></div>
          </div>
        )}
        <AuditNotice>Account changes are recorded in Activity Logs. Passwords are never shown in logs.</AuditNotice>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>{editing ? "Save changes" : "Add Staff"}</Button>
      </DialogFooter>
    </>
  );
}
