import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function EventsPage() {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", page],
    queryFn: () => fetchEvents({ page, limit }),
  });

  return (
    <div className="space-y-4">
      <Card className="p-6 border-2 border-card-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Events / Length Messages {data && `(${data.pagination.total} total)`}
        </h3>

        {error ? (
          <p className="text-status-error">Failed to load events</p>
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
                    <TableHead>Event Identifier</TableHead>
                    <TableHead>Bale Ready</TableHead>
                    <TableHead>Bale Click</TableHead>
                    <TableHead>Topic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.id}</TableCell>
                      <TableCell>{new Date(e.ts).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{e.event_identifier ?? "—"}</TableCell>
                      <TableCell>{e.bale_ready != null ? String(e.bale_ready) : "—"}</TableCell>
                      <TableCell>{e.bale_click != null ? String(e.bale_click) : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.topic}</TableCell>
                    </TableRow>
                  ))}
                  {data?.data.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No events found</TableCell></TableRow>
                  )}
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
    </div>
  );
}
