import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRawMessages, fetchRawDetail } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function RawInspectorPage() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const limit = 50;

  const { data, isLoading, error } = useQuery({
    queryKey: ["raw", page],
    queryFn: () => fetchRawMessages({ page, limit }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["raw-detail", selectedId],
    queryFn: () => fetchRawDetail(selectedId!),
    enabled: !!selectedId,
  });

  const typeColors: Record<string, string> = {
    bale_data: "bg-status-success text-white",
    event: "bg-status-idle text-white",
    unknown: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 border-2 border-card-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Raw MQTT Messages {data && `(${data.pagination.total} total)`}
        </h3>

        {error ? (
          <p className="text-status-error">Failed to load messages</p>
        ) : isLoading ? (
          <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedId(r.id)}
                    >
                      <TableCell className="font-medium">{r.id}</TableCell>
                      <TableCell>{new Date(r.ts).toLocaleString()}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{r.topic}</TableCell>
                      <TableCell>
                        <Badge className={typeColors[r.message_type || "unknown"]}>
                          {r.message_type || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate font-mono">
                        {r.payload_preview}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">Page {data.pagination.page} of {data.pagination.totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail modal */}
      <Dialog open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raw Message #{selectedId}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <Skeleton className="h-48" />
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">ID</p><p className="font-semibold">{detail.id}</p></div>
                <div><p className="text-muted-foreground">Timestamp</p><p className="font-semibold">{new Date(detail.ts).toLocaleString()}</p></div>
                <div className="col-span-2"><p className="text-muted-foreground">Topic</p><p className="font-semibold font-mono text-xs">{detail.topic}</p></div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Full Payload</p>
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[400px] text-xs text-foreground">
                  {detail.parsedPayload
                    ? JSON.stringify(detail.parsedPayload, null, 2)
                    : detail.payload_text || "No payload"}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
