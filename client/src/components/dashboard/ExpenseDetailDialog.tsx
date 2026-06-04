import type { ReactNode } from "react";
import { Receipt, FileCheck2, AlertTriangle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DrillStatus } from "@/components/dashboard/DrillDownDialog";

export interface DetailField {
  label: string;
  value: ReactNode;
}

export interface DetailHistoryItem {
  id: string;
  date: string;
  amount: string;
  method: string;
  account?: string;
  daysLate?: number;
  hasConfirmation?: boolean;
}

export interface ExpenseDetailData {
  vendor: string;
  expenseId: string;
  status?: DrillStatus;
  /** Underlying schedule id; enables the Edit action. */
  scheduleId?: string;
  /** False when the schedule has been cancelled. */
  active?: boolean;
  fields: DetailField[];
  history: DetailHistoryItem[];
  /** Record id to visually highlight within the history table. */
  highlightId?: string;
}

interface ExpenseDetailDialogProps {
  data: ExpenseDetailData | null;
  onOpenChange: (open: boolean) => void;
  /** Called with the schedule id when the user clicks Edit. */
  onEdit?: (scheduleId: string) => void;
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

export default function ExpenseDetailDialog({
  data,
  onOpenChange,
  onEdit,
}: ExpenseDetailDialogProps) {
  const inactive = data?.active === false;
  return (
    <Dialog open={!!data} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{data?.vendor}</DialogTitle>
            {inactive ? (
              <Badge variant="outline">Inactive</Badge>
            ) : (
              data?.status && (
                <Badge variant={STATUS_BADGE[data.status].variant}>
                  {STATUS_BADGE[data.status].label}
                </Badge>
              )
            )}
          </div>
          <DialogDescription className="font-mono">{data?.expenseId}</DialogDescription>
        </DialogHeader>

        {data && (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
            {/* Field grid */}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {data.fields.map((field) => (
                <div key={field.label}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium">{field.value}</dd>
                </div>
              ))}
            </dl>

            {/* Payment history */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Payment history</h3>
                <span className="text-xs text-muted-foreground">
                  {data.history.length} payment{data.history.length === 1 ? "" : "s"}
                </span>
              </div>
              {data.history.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No payments recorded yet
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.history.map((item) => (
                        <TableRow
                          key={item.id}
                          className={
                            item.id === data.highlightId ? "bg-primary/5" : undefined
                          }
                          data-testid={`history-${item.id}`}
                        >
                          <TableCell className="whitespace-nowrap">{item.date}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">
                            {item.method}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.account ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {item.amount}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {item.daysLate && item.daysLate > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs text-destructive">
                                  <AlertTriangle className="h-3 w-3" />
                                  {item.daysLate}d late
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">On time</span>
                              )}
                              {item.hasConfirmation && (
                                <FileCheck2 className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}

        {data?.scheduleId && onEdit && (
          <DialogFooter className="border-t pt-3">
            <Button
              variant="outline"
              onClick={() => onEdit(data.scheduleId!)}
              data-testid="button-detail-edit"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit schedule
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
