import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AccessDenied } from "@/components/ovms/access-denied";
import { useCurrentUser } from "@/lib/ovms/store";
import { canAccessAdmin } from "@/lib/ovms/rules";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminGuard,
});

function AdminGuard() {
  const user = useCurrentUser();
  if (!canAccessAdmin(user.role)) return <AccessDenied user={user} />;
  return <Outlet />;
}
