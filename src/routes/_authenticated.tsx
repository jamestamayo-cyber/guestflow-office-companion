import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell, FullScreenLoader, SessionExpiredScreen } from "@/components/ovms/app-shell";
import { useOvms } from "@/lib/ovms/store";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { hydrated, currentUser, sessionExpired } = useOvms();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !currentUser && !sessionExpired) navigate({ to: "/" });
  }, [hydrated, currentUser, sessionExpired, navigate]);

  if (!hydrated) return <FullScreenLoader />;
  if (!currentUser) return sessionExpired ? <SessionExpiredScreen /> : <FullScreenLoader />;

  return (
    <AppShell user={currentUser}>
      <Outlet />
    </AppShell>
  );
}
