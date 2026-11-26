import { useEffect, useState } from "react";
import { Check, RefreshCw, WifiOff } from "lucide-react";
import { officeService } from "@/services/ovms";

export function OfflineStatus() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [pending, setPending] = useState(() => officeService.getPendingSyncCount());
  const [syncing, setSyncing] = useState(false);
  const [allSynced, setAllSynced] = useState(false);

  useEffect(() => {
    let syncedTimer = 0;
    const update = () => {
      setOffline(!navigator.onLine);
      setPending(officeService.getPendingSyncCount());
    };
    const syncState = (event: Event) => {
      const status = (event as CustomEvent<"syncing" | "synced" | "error">).detail;
      setSyncing(status === "syncing");
      if (status === "synced") {
        setAllSynced(true);
        window.clearTimeout(syncedTimer);
        syncedTimer = window.setTimeout(() => setAllSynced(false), 2500);
      } else {
        setAllSynced(false);
      }
      update();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("guestflow:offline-queue-change", update);
    window.addEventListener("storage", update);
    window.addEventListener("guestflow:sync-state", syncState);
    return () => {
      window.clearTimeout(syncedTimer);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("guestflow:offline-queue-change", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("guestflow:sync-state", syncState);
    };
  }, []);

  if (!offline && pending === 0 && !allSynced) return null;
  const statusText = offline
    ? pending > 0
      ? `Offline — ${pending} pending sync`
      : "Offline Mode"
    : syncing
      ? "Syncing..."
      : allSynced
        ? "All synced"
        : `${pending} pending sync`;
  const StatusIcon = offline ? WifiOff : syncing ? RefreshCw : Check;
  return (
    <div
      role="status"
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        offline
          ? "bg-warning-soft text-warning-foreground"
          : "bg-success-soft text-success"
      }`}
    >
      <StatusIcon className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
      {statusText}
    </div>
  );
}
