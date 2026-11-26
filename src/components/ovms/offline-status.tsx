import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { officeService } from "@/services/ovms";

export function OfflineStatus() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [pending, setPending] = useState(() => officeService.getPendingSyncCount());

  useEffect(() => {
    const update = () => {
      setOffline(!navigator.onLine);
      setPending(officeService.getPendingSyncCount());
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("guestflow:offline-queue-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("guestflow:offline-queue-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (!offline && pending === 0) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-medium text-warning-foreground"
    >
      <WifiOff className="size-3.5" />
      {offline
        ? pending > 0
          ? `Offline Mode — ${pending} changes pending sync`
          : "Offline Mode — Changes will sync when reconnected"
        : `${pending} changes pending sync`}
    </div>
  );
}
