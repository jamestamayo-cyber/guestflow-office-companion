import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOvms } from "@/lib/ovms/store";

export function DataState({ children, empty = false, chart = false }: { children: ReactNode; empty?: boolean; chart?: boolean }) {
  const { loading, error, retry } = useOvms();
  if (loading) return <div aria-busy="true" aria-label="Loading records" className="space-y-3 p-5">{Array.from({ length: chart ? 3 : 5 }, (_, i) => <Skeleton key={i} className={chart ? "h-16 w-full" : "h-10 w-full"} />)}</div>;
  if (error) return <LoadError />;
  if (empty) return <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center"><p className="text-sm text-muted-foreground">No visits in this period. Choose another date range.</p><Button variant="outline" onClick={retry}><RefreshCw /> Refresh records</Button></div>;
  return children;
}
export function LoadError() {
  const { error, retry } = useOvms();
  return <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center"><AlertCircle className="size-6 text-destructive" /><h2 className="font-semibold">Records couldn't be loaded</h2><p className="max-w-lg text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={retry}><RefreshCw /> Retry</Button></div>;
}