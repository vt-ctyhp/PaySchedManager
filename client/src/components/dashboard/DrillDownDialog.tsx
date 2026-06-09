import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronRight, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/expense-analytics";

export type DrillStatus = "paid" | "due-soon" | "overdue" | "scheduled";

export interface DrillEntry {
  /** Unique per row. */
  id: string;
  /** Set when the row maps to a payment schedule (enables detail view). */
  scheduleId?: string;
  /** Set when the row maps to a payment record (enables detail view). */
  recordId?: string;
  vendor: string;
  company: string;
  expenseType: string;
  account: string;
  amount: number;
  date?: Date;
  status?: DrillStatus;
}

export interface DrillDownConfig {
  title: string;
  description?: string;
  /** Header label for the date column (e.g. "Next due", "Payment date"). */
  dateLabel: string;
  entries: DrillEntry[];
}

interface DrillDownDialogProps {
  config: DrillDownConfig | null;
  onOpenChange: (open: boolean) => void;
  onOpenEntry: (entry: DrillEntry) => void;
}

const STATUS_BADGE: Record<
  DrillStatus,
  { label: string; variant: "destructive" | "secondary" | "outline" | "default" }
> = {
  overdue: { label: "Overdue", variant: "destructive" },
  "due-soon": { label: "Due soon", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "outline" },
  paid: { label: "Paid", variant: "outline" },
};

const ALL = "__all__";

export default function DrillDownDialog({
  config,
  onOpenChange,
  onOpenEntry,
}: DrillDownDialogProps) {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState(ALL);
  const [type, setType] = useState(ALL);

  // Reset filters whenever a new drill-down is opened.
  useEffect(() => {
    setSearch("");
    setCompany(ALL);
    setType(ALL);
  }, [config]);

  const entries = config?.entries ?? [];

  const companies = useMemo(
    () => Array.from(new Set(entries.map((e) => e.company))).sort(),
    [entries],
  );
  const types = useMemo(
    () => Array.from(new Set(entries.map((e) => e.expenseType))).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (company !== ALL && e.company !== company) return false;
      if (type !== ALL && e.expenseType !== type) return false;
      if (!q) return true;
      return (
        e.vendor.toLowerCase().includes(q) ||
        e.company.toLowerCase().includes(q) ||
        e.expenseType.toLowerCase().includes(q) ||
        e.account.toLowerCase().includes(q)
      );
    });
  }, [entries, search, company, type]);

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const showStatus = entries.some((e) => e.status);

  return (
    <Dialog open={!!config} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{config?.title}</DialogTitle>
          {config?.description && (
            <DialogDescription>{config.description}</DialogDescription>
          )}
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendor, account…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="drill-search"
            />
          </div>
          {companies.length > 1 && (
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="w-[170px]" data-testid="drill-filter-company">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {types.length > 1 && (
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[170px]" data-testid="drill-filter-type">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>{config?.dateLabel ?? "Date"}</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No matching items
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => onOpenEntry(entry)}
                    data-testid={`drill-row-${entry.id}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex max-w-[220px] items-center gap-2">
                        {showStatus && entry.status && (
                          <Badge
                            variant={STATUS_BADGE[entry.status].variant}
                            className="shrink-0"
                          >
                            {STATUS_BADGE[entry.status].label}
                          </Badge>
                        )}
                        <span className="min-w-0 truncate" title={entry.vendor}>
                          {entry.vendor}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="max-w-[140px] truncate" title={entry.company}>
                        {entry.company}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="max-w-[130px] truncate" title={entry.expenseType}>
                        {entry.expenseType}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="max-w-[150px] truncate" title={entry.account}>
                        {entry.account}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {entry.date ? format(entry.date, "MMM dd, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono font-medium tabular-nums">
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            {filtered.length} of {entries.length} item{entries.length === 1 ? "" : "s"}
          </span>
          <span className="font-mono text-base font-semibold">{formatCurrency(total)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
