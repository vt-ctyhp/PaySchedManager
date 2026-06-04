import { differenceInCalendarDays, format } from "date-fns";
import { CalendarDays, AlertCircle, CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/expense-analytics";

export type UpcomingStatus = "overdue" | "due-soon" | "scheduled";

export interface UpcomingPaymentItem {
  id: string;
  vendorName: string;
  expenseId: string;
  companyLabel?: string;
  expenseTypeLabel?: string;
  amount: number;
  dueDate: Date;
  status: UpcomingStatus;
}

export interface UpcomingCompanyRow {
  companyId: string;
  companyName: string;
  totalAmount: number;
  scheduledCount: number;
  soonestDue?: Date;
}

export type UpcomingView = "company" | "list";

interface UpcomingPanelProps {
  view: UpcomingView;
  onViewChange: (view: UpcomingView) => void;
  windowLabel: string;
  items: UpcomingPaymentItem[];
  byCompany: UpcomingCompanyRow[];
  onRecordPayment?: (id: string) => void;
  onSelectCompany?: (companyId: string, companyName: string) => void;
}

function relativeDue(dueDate: Date, now: Date): string {
  const days = differenceInCalendarDays(dueDate, now);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}

const STATUS_STYLES: Record<
  UpcomingStatus,
  { label: string; variant: "destructive" | "secondary" | "outline" }
> = {
  overdue: { label: "Overdue", variant: "destructive" },
  "due-soon": { label: "Due soon", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "outline" },
};

export default function UpcomingPanel({
  view,
  onViewChange,
  windowLabel,
  items,
  byCompany,
  onRecordPayment,
  onSelectCompany,
}: UpcomingPanelProps) {
  const now = new Date();
  const total =
    view === "company"
      ? byCompany.reduce((sum, row) => sum + row.totalAmount, 0)
      : items.reduce((sum, item) => sum + item.amount, 0);
  const count =
    view === "company"
      ? byCompany.reduce((sum, row) => sum + row.scheduledCount, 0)
      : items.length;

  return (
    <Card data-testid="card-upcoming-payments">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle>Upcoming Payments</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Obligations due · {windowLabel}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {count > 0 && (
              <div className="text-right">
                <div className="font-mono text-lg font-semibold">
                  {formatCurrency(total)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {count} payment{count === 1 ? "" : "s"}
                </p>
              </div>
            )}
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(value) => value && onViewChange(value as UpcomingView)}
              variant="outline"
              size="sm"
              data-testid="toggle-upcoming-view"
            >
              <ToggleGroupItem value="company" data-testid="toggle-upcoming-company">
                By Company
              </ToggleGroupItem>
              <ToggleGroupItem value="list" data-testid="toggle-upcoming-list">
                List
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {view === "company" ? (
          byCompany.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="mb-3 h-10 w-10 text-muted-foreground" />}
              title="Nothing due in this window"
              subtitle="No scheduled payments fall within the selected timeframe"
            />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Internal Company</TableHead>
                    <TableHead className="text-right font-semibold">Items</TableHead>
                    <TableHead className="text-right font-semibold">Total Amount</TableHead>
                    <TableHead className="text-right font-semibold">Soonest Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCompany.map((row) => (
                    <TableRow
                      key={row.companyId}
                      data-testid={`row-company-${row.companyId}`}
                      className="hover-elevate cursor-pointer"
                      onClick={() => onSelectCompany?.(row.companyId, row.companyName)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {row.companyName.charAt(0)}
                            </span>
                          </div>
                          {row.companyName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          {row.scheduledCount} {row.scheduledCount === 1 ? "item" : "items"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-base font-semibold">
                          {formatCurrency(row.totalAmount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {row.soonestDue ? format(row.soonestDue, "MMM dd, yyyy") : "—"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="mb-3 h-10 w-10 text-muted-foreground" />}
            title="Nothing due in this window"
            subtitle="You're all caught up on upcoming payments"
          />
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              const style = STATUS_STYLES[item.status];
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
                  data-testid={`upcoming-${item.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={style.variant} className="flex items-center gap-1">
                        {item.status === "overdue" && <AlertCircle className="h-3 w-3" />}
                        {style.label}
                      </Badge>
                      <span className="truncate font-medium">{item.vendorName}</span>
                      {item.expenseTypeLabel && (
                        <span className="truncate text-xs text-muted-foreground">
                          {item.expenseTypeLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.companyLabel ? `${item.companyLabel} · ` : ""}
                      {relativeDue(item.dueDate, now)} · {format(item.dueDate, "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="font-mono font-semibold">{formatCurrency(item.amount)}</div>
                  {onRecordPayment && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRecordPayment(item.id)}
                      data-testid={`button-record-${item.id}`}
                    >
                      Record
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
