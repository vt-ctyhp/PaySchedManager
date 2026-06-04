import { differenceInCalendarDays, format } from "date-fns";
import { CalendarDays, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface UpcomingPaymentsListProps {
  items: UpcomingPaymentItem[];
  windowLabel: string;
  onRecordPayment?: (id: string) => void;
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

export default function UpcomingPaymentsList({
  items,
  windowLabel,
  onRecordPayment,
}: UpcomingPaymentsListProps) {
  const now = new Date();
  const total = items.reduce((sum, item) => sum + item.amount, 0);

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
              Next due and overdue obligations · {windowLabel}
            </CardDescription>
          </div>
          {items.length > 0 && (
            <div className="text-right">
              <div className="font-mono text-lg font-semibold">
                {formatCurrency(total)}
              </div>
              <p className="text-xs text-muted-foreground">
                {items.length} payment{items.length === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Nothing due in this window</p>
            <p className="text-xs text-muted-foreground">
              You&apos;re all caught up on upcoming payments
            </p>
          </div>
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
                      <Badge
                        variant={style.variant}
                        className="flex items-center gap-1"
                      >
                        {item.status === "overdue" && (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {style.label}
                      </Badge>
                      <span className="truncate font-medium">
                        {item.vendorName}
                      </span>
                      {item.expenseTypeLabel && (
                        <span className="truncate text-xs text-muted-foreground">
                          {item.expenseTypeLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.companyLabel ? `${item.companyLabel} · ` : ""}
                      {relativeDue(item.dueDate, now)} ·{" "}
                      {format(item.dueDate, "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="font-mono font-semibold">
                    {formatCurrency(item.amount)}
                  </div>
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
