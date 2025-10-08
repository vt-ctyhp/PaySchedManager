import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
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
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ArrowUpRight, CalendarClock } from "lucide-react";
import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  format,
} from "date-fns";
import type {
  InternalCompany,
  PaymentRecord,
  PaymentSchedule,
} from "@shared/schema";

type Timeframe = "week" | "month" | "quarter" | "year";

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  week: "Next 7 Days",
  month: "Next 30 Days",
  quarter: "Next 90 Days",
  year: "Next 12 Months",
};

function getTimeframeEnd(timeframe: Timeframe, start: Date) {
  switch (timeframe) {
    case "week":
      return addDays(start, 7);
    case "month":
      return addMonths(start, 1);
    case "quarter":
      return addQuarters(start, 1);
    case "year":
      return addYears(start, 1);
    default:
      return addMonths(start, 1);
  }
}

export default function Reports() {
  const [timeframe, setTimeframe] = useState<Timeframe>("month");

  const { data: schedules = [] } = useQuery<PaymentSchedule[]>({
    queryKey: ["/api/payment-schedules"],
  });

  const { data: records = [] } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payment-records"],
  });

  const { data: companies = [] } = useQuery<InternalCompany[]>({
    queryKey: ["/api/internal-companies"],
  });

  const now = useMemo(() => new Date(), [timeframe]);
  const timeframeEnd = getTimeframeEnd(timeframe, now);

  const companyLookup = useMemo(() => {
    return new Map(companies.map((company) => [company.id, company]));
  }, [companies]);

  const upcomingByCompany = useMemo(() => {
    const groups = new Map<string, {
      companyId: string;
      companyName: string;
      totalAmount: number;
      scheduledCount: number;
      soonestDue?: Date;
    }>();

    schedules.forEach((schedule) => {
      const dueDate = new Date(schedule.nextDueDate);
      if (dueDate < now || dueDate > timeframeEnd) {
        return;
      }

      const company = companyLookup.get(schedule.internalCompanyId);
      if (!company) return;

      const key = company.id;
      const existing = groups.get(key) ?? {
        companyId: key,
        companyName: company.name,
        totalAmount: 0,
        scheduledCount: 0,
        soonestDue: undefined,
      };

      const amount = Number.parseFloat(schedule.amount);
      existing.totalAmount += Number.isFinite(amount) ? amount : 0;
      existing.scheduledCount += 1;
      if (!existing.soonestDue || dueDate < existing.soonestDue) {
        existing.soonestDue = dueDate;
      }

      groups.set(key, existing);
    });

    return Array.from(groups.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [schedules, now, timeframeEnd, companyLookup]);

  const issues = useMemo(() => {
    const tolerance = 0.01;
    const byExpenseId = new Map<string, PaymentRecord[]>();

    records.forEach((record) => {
      const bucket = byExpenseId.get(record.expenseId) ?? [];
      bucket.push(record);
      byExpenseId.set(record.expenseId, bucket);
    });

    const issueList: Array<{
      type: "overdue" | "underpaid" | "overpaid";
      schedule: PaymentSchedule;
      company?: InternalCompany;
      detail: string;
    }> = [];

    schedules.forEach((schedule) => {
      const company = companyLookup.get(schedule.internalCompanyId);
      const dueDate = new Date(schedule.nextDueDate);
      const scheduleAmount = Number.parseFloat(schedule.amount);
      const scheduleRecords = byExpenseId.get(schedule.expenseId) ?? [];

      const latestRecord = scheduleRecords
        .slice()
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];

      if (dueDate < now) {
        issueList.push({
          type: "overdue",
          schedule,
          company,
          detail: `Due ${format(dueDate, "MMM dd, yyyy")}`,
        });
      }

      if (latestRecord) {
        const paidAmount = Number.parseFloat(latestRecord.amount);

        if (paidAmount + tolerance < scheduleAmount) {
          issueList.push({
            type: "underpaid",
            schedule,
            company,
            detail: `Paid $${paidAmount.toFixed(2)} of $${scheduleAmount.toFixed(2)} on ${format(new Date(latestRecord.paymentDate), "MMM dd, yyyy")}`,
          });
        }

        if (paidAmount > scheduleAmount + tolerance) {
          issueList.push({
            type: "overpaid",
            schedule,
            company,
            detail: `Paid $${paidAmount.toFixed(2)} over $${scheduleAmount.toFixed(2)} on ${format(new Date(latestRecord.paymentDate), "MMM dd, yyyy")}`,
          });
        }
      }
    });

    return issueList.sort((a, b) => {
      const priority = { overdue: 0, underpaid: 1, overpaid: 2 } as const;
      return priority[a.type] - priority[b.type];
    });
  }, [schedules, records, companyLookup, now]);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Reports Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Upcoming obligations and payment health across internal companies.
              </p>
            </div>
            <ToggleGroup
              type="single"
              value={timeframe}
              onValueChange={(value) => {
                if (value) setTimeframe(value as Timeframe);
              }}
              className="flex"
            >
              {Object.entries(TIMEFRAME_LABELS).map(([value, label]) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="px-4"
                  data-testid={`toggle-${value}`}
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Upcoming Expenses by Company</CardTitle>
              <p className="text-sm text-muted-foreground">
                {TIMEFRAME_LABELS[timeframe]} · {format(now, "MMM dd, yyyy")} → {format(timeframeEnd, "MMM dd, yyyy")}.
              </p>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              Focus period
            </Badge>
          </CardHeader>
          <CardContent>
            {upcomingByCompany.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground" data-testid="text-no-upcoming">
                No upcoming expenses in this timeframe.
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Internal Company</TableHead>
                      <TableHead className="text-right">Scheduled Items</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Soonest Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingByCompany.map((group) => (
                      <TableRow key={group.companyId} data-testid={`row-company-${group.companyId}`}>
                        <TableCell className="font-medium">{group.companyName}</TableCell>
                        <TableCell className="text-right">{group.scheduledCount}</TableCell>
                        <TableCell className="text-right font-mono">${group.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {group.soonestDue ? format(group.soonestDue, "MMM dd, yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle>Payment Issues</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Underpaid, overpaid, or overdue payments that need attention.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {issues.length} flagged
            </Badge>
          </CardHeader>
          <CardContent>
            {issues.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground" data-testid="text-no-issues">
                No issues detected. Great job keeping payments on track!
              </div>
            ) : (
              <div className="space-y-4">
                {issues.map((issue) => (
                  <div
                    key={`${issue.schedule.id}-${issue.type}`}
                    className="rounded-lg border p-4"
                    data-testid={`issue-${issue.schedule.id}-${issue.type}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={issue.type === "overdue" ? "destructive" : issue.type === "underpaid" ? "secondary" : "outline"}
                          >
                            {issue.type === "overdue" && "Overdue"}
                            {issue.type === "underpaid" && "Underpaid"}
                            {issue.type === "overpaid" && "Overpaid"}
                          </Badge>
                          <span className="font-semibold">
                            {issue.schedule.vendorName} · {issue.schedule.expenseId}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {issue.company ? issue.company.name : "Unknown company"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Scheduled Amount</p>
                        <p className="font-mono text-base font-semibold">
                          ${Number.parseFloat(issue.schedule.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <p className="text-sm text-muted-foreground">{issue.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
