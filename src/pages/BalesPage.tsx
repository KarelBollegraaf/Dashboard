import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchBales } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ChevronLeft, ChevronRight } from "lucide-react";

export default function BalesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("ts");
  const [order, setOrder] = useState("DESC");
  const [material, setMaterial] = useState("");
  const [baleNumber, setBaleNumber] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const limit = 50;

  const { data, isLoading, error } = useQuery({
    queryKey: ["bales", page, sort, order, material, baleNumber, from, to],
    queryFn: () => fetchBales({
      page, limit, sort, order,
      material: material || undefined,
      bale_number: baleNumber ? Number(baleNumber) : undefined,
      from: from || undefined,
      to: to || undefined,
    }),
  });

  const toggleSort = (col: string) => {
    if (sort === col) {
      setOrder(o => o === "DESC" ? "ASC" : "DESC");
    } else {
      setSort(col);
      setOrder("DESC");
    }
    setPage(1);
  };

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => toggleSort(col)}
    >
      {children} {sort === col && (order === "DESC" ? "↓" : "↑")}
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4 border-2 border-card-border">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Material</label>
            <Select value={material} onValueChange={(v) => { setMaterial(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All materials" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All materials</SelectItem>
                {data?.filters?.materials?.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bale #</label>
            <Input
              className="w-[120px]"
              type="number"
              placeholder="Bale #"
              value={baleNumber}
              onChange={(e) => { setBaleNumber(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">From</label>
            <Input
              className="w-[180px]"
              type="datetime-local"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">To</label>
            <Input
              className="w-[180px]"
              type="datetime-local"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            setMaterial(""); setBaleNumber(""); setFrom(""); setTo(""); setPage(1);
          }}>
            Clear
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-6 border-2 border-card-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Bales {data && `(${data.pagination.total} total)`}
          </h3>
        </div>

        {error ? (
          <p className="text-status-error">Failed to load bales</p>
        ) : isLoading ? (
          <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader col="bale_number">Bale #</SortHeader>
                    <SortHeader col="ts">Timestamp</SortHeader>
                    <SortHeader col="material_name">Material</SortHeader>
                    <TableHead>Recipe</TableHead>
                    <TableHead>Shift</TableHead>
                    <SortHeader col="weight">Weight (kg)</SortHeader>
                    <SortHeader col="volume">Volume (m³)</SortHeader>
                    <SortHeader col="bale_length">Length (cm)</SortHeader>
                    <SortHeader col="total_time">Total Time (s)</SortHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data.map((b) => (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/bales/${b.id}`)}
                    >
                      <TableCell className="font-medium">{b.bale_number}</TableCell>
                      <TableCell>{new Date(b.ts).toLocaleString()}</TableCell>
                      <TableCell>{b.material_name}</TableCell>
                      <TableCell>{b.recipe_number}</TableCell>
                      <TableCell>{b.shift_number}</TableCell>
                      <TableCell className="text-right">{b.weight?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{b.volume?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{b.bale_length?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{b.total_time?.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {data?.data.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No bales found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </p>
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
