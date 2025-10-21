import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  ArrowUpRight, 
  CalendarClock, 
  DollarSign, 
  TrendingUp,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock3
} from "lucide-react";
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
      if (schedule.status === "completed") {
        return;
      }
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
      type: "overdue" | "underpaid" | "overpaid" | "late";
      schedule: PaymentSchedule;
      company?: InternalCompany;
      detail: string;
      daysLate?: number;
    }> = [];

    schedules.forEach((schedule) => {
      if (schedule.status === "completed") {
        return;
      }
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

    records.forEach((record) => {
      if (!record.daysLate || record.daysLate <= 0) {
        return;
      }

      const schedule =
        record.paymentScheduleId
          ? schedules.find((s) => s.id === record.paymentScheduleId)
          : schedules.find((s) => s.expenseId === record.expenseId);

      if (!schedule) {
        return;
      }

      const company =
        companyLookup.get(schedule.internalCompanyId) ??
        companyLookup.get(record.internalCompanyId);
      const dueDate = record.scheduledDueDate
        ? new Date(record.scheduledDueDate)
        : undefined;
      const paymentDate = new Date(record.paymentDate);

      issueList.push({
        type: "late",
        schedule,
        company,
        daysLate: record.daysLate,
        detail: `Paid on ${format(paymentDate, "MMM dd, yyyy")} (${record.daysLate} day${record.daysLate === 1 ? "" : "s"} late${
          dueDate ? `; due ${format(dueDate, "MMM dd, yyyy")}` : ""
        })`,
      });
    });

    return issueList.sort((a, b) => {
      const priority = { overdue: 0, late: 1, underpaid: 2, overpaid: 3 } as const;
      return priority[a.type] - priority[b.type];
    });
  }, [schedules, records, companyLookup, now]);

  const summaryStats = useMemo(() => {
    const totalUpcoming = upcomingByCompany.reduce((sum, group) => sum + group.totalAmount, 0);
    const totalScheduled = upcomingByCompany.reduce((sum, group) => sum + group.scheduledCount, 0);
    const overdueCount = issues.filter(i => i.type === "overdue").length;
    const issueCount = issues.length;

    return {
      totalUpcoming,
      totalScheduled,
      overdueCount,
      issueCount,
    };
  }, [upcomingByCompany, issues]);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-semibold" data-testid="text-reports-title">Reports Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Track upcoming obligations and payment health across internal companies
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-upcoming">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-4">
                <CardTitle className="text-sm font-medium">Total Upcoming</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold" data-testid="text-total-upcoming">
                  ${summaryStats.totalUpcoming.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {TIMEFRAME_LABELS[timeframe]}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-scheduled-count">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-4">
                <CardTitle className="text-sm font-medium">Scheduled Payments</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-scheduled-count">
                  {summaryStats.totalScheduled}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Due in timeframe
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-overdue-count">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-4">
                <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-overdue-count">
                  {summaryStats.overdueCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Require immediate attention
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-issue-count">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-4">
                <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-issue-count">
                  {summaryStats.issueCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Including over/underpayments
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-primary" />
                  <CardTitle>Upcoming Expenses by Company</CardTitle>
                </div>
                <CardDescription className="mt-2">
                  Breakdown of scheduled payments grouped by internal company · {format(now, "MMM dd, yyyy")} → {format(timeframeEnd, "MMM dd, yyyy")}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                {upcomingByCompany.length} {upcomingByCompany.length === 1 ? 'company' : 'companies'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingByCompany.length === 0 ? (
              <div className="rounded-lg border border-dashed py-16 text-center" data-testid="text-no-upcoming">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-1">No upcoming expenses</p>
                <p className="text-sm text-muted-foreground">
                  There are no scheduled payments in this timeframe
                </p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Internal Company</TableHead>
                      <TableHead className="text-right font-semibold">Scheduled Items</TableHead>
                      <TableHead className="text-right font-semibold">Total Amount</TableHead>
                      <TableHead className="text-right font-semibold">Soonest Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingByCompany.map((group, index) => (
                      <TableRow 
                        key={group.companyId} 
                        data-testid={`row-company-${group.companyId}`}
                        className="hover-elevate"
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-semibold text-primary">
                                {group.companyName.charAt(0)}
                              </span>
                            </div>
                            {group.companyName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">
                            {group.scheduledCount} {group.scheduledCount === 1 ? 'item' : 'items'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-lg font-semibold">
                            ${group.totalAmount.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-sm">
                              {group.soonestDue ? format(group.soonestDue, "MMM dd, yyyy") : "—"}
                            </span>
                          </div>
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
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <CardTitle>Payment Issues</CardTitle>
                </div>
                <CardDescription className="mt-2">
                  Overdue, late, underpaid, or overpaid items that need attention
                </CardDescription>
              </div>
              <Badge 
                variant={issues.length > 0 ? "destructive" : "outline"} 
                className="flex items-center gap-1.5"
              >
                {issues.length > 0 ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {issues.length === 0 ? (
              <div className="rounded-lg border border-dashed py-16 text-center" data-testid="text-no-issues">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium mb-1">All clear!</p>
                <p className="text-sm text-muted-foreground">
                  No payment issues detected. Great job keeping payments on track.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map((issue) => (
                  <div
                    key={`${issue.schedule.id}-${issue.type}`}
                    className="rounded-lg border p-4 hover-elevate"
                    data-testid={`issue-${issue.schedule.id}-${issue.type}`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={
                              issue.type === "overdue"
                                ? "destructive"
                                : issue.type === "underpaid"
                                ? "secondary"
                                : issue.type === "late"
                                ? "outline"
                                : "outline"
                            }
                            className="flex items-center gap-1"
                          >
                            {issue.type === "overdue" && <AlertCircle className="h-3 w-3" />}
                            {issue.type === "underpaid" && <ArrowUpRight className="h-3 w-3" />}
                            {issue.type === "overpaid" && <TrendingUp className="h-3 w-3" />}
                            {issue.type === "late" && <Clock3 className="h-3 w-3" />}
                            {issue.type === "overdue" && "Overdue"}
                            {issue.type === "late" && "Late Payment"}
                            {issue.type === "underpaid" && "Underpaid"}
                            {issue.type === "overpaid" && "Overpaid"}
                          </Badge>
                          <span className="font-semibold text-base">
                            {issue.schedule.vendorName}
                          </span>
                          <span className="text-sm text-muted-foreground font-mono">
                            {issue.schedule.expenseId}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5">
                          {issue.company ? issue.company.name : "Unknown company"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Scheduled Amount</p>
                        <p className="font-mono text-lg font-bold">
                          ${Number.parseFloat(issue.schedule.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-start gap-2">
                      {issue.type === "late" ? (
                        <Clock3 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      )}
                      <p className="text-sm text-muted-foreground">{issue.detail}</p>
                    </div>
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
