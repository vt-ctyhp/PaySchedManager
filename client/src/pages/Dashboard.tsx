import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wallet,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Settings as SettingsIcon,
  Search,
  HelpCircle,
} from "lucide-react";
import QuickStatsCard from "@/components/QuickStatsCard";
import PaymentScheduleCard from "@/components/PaymentScheduleCard";
import AddPaymentDialog from "@/components/AddPaymentDialog";
import EditPaymentDialog from "@/components/EditPaymentDialog";
import RecordPaymentDialog, { type RecordPaymentInitialValues } from "@/components/RecordPaymentDialog";
import PaymentHistoryTable from "@/components/PaymentHistoryTable";
import { CSVImportDialog } from "@/components/CSVImportDialog";
import ExpenseForecastChart from "@/components/dashboard/ExpenseForecastChart";
import ExpenseBreakdownChart from "@/components/dashboard/ExpenseBreakdownChart";
import SpendTrendChart from "@/components/dashboard/SpendTrendChart";
import UpcomingPanel, {
  type UpcomingPaymentItem,
  type UpcomingCompanyRow,
  type UpcomingView,
} from "@/components/dashboard/UpcomingPanel";
import PaymentIssuesPanel, {
  type PaymentIssue,
} from "@/components/dashboard/PaymentIssuesPanel";
import DrillDownDialog, {
  type DrillDownConfig,
  type DrillEntry,
} from "@/components/dashboard/DrillDownDialog";
import ExpenseDetailDialog, {
  type ExpenseDetailData,
} from "@/components/dashboard/ExpenseDetailDialog";
import type { BreakdownSelection } from "@/components/dashboard/ExpenseBreakdownChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  PaymentSchedule,
  PaymentRecord,
  InternalCompany,
  PaymentAccount,
  PaymentType,
  ExpenseType,
} from "@shared/schema";
import { differenceInDays, addDays, addMonths, addQuarters, addYears, isSameMonth, format } from "date-fns";
import {
  monthlyRunRate,
  monthlyForecast,
  monthlySpendTrend,
  breakdownBy,
  projectOccurrences,
  parseAmount,
  formatCurrency,
  formatCurrencyWhole,
  FREQUENCY_LABELS,
  MONTHLY_FACTOR,
  isRecurring,
  type ForecastBucket,
  type TrendPoint,
} from "@/lib/expense-analytics";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const UPCOMING_LIST_LIMIT = 8;

type Timeframe = "week" | "month" | "quarter" | "year";

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  week: "Next 7 Days",
  month: "Next 30 Days",
  quarter: "Next 90 Days",
  year: "Next 12 Months",
};

function getTimeframeEnd(timeframe: Timeframe, start: Date): Date {
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

export default function Dashboard() {
  const { user, logout, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [activeView, setActiveView] = useState("overview");
  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [upcomingView, setUpcomingView] = useState<UpcomingView>("company");
  const [editingSchedule, setEditingSchedule] = useState<PaymentSchedule | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [recordingSchedule, setRecordingSchedule] = useState<PaymentSchedule | null>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [recordPrefill, setRecordPrefill] = useState<{
    values: RecordPaymentInitialValues;
    expenseId?: string;
  } | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDownConfig | null>(null);
  const [detail, setDetail] = useState<ExpenseDetailData | null>(null);

  // Stable "now" so memoised analytics don't shift on every render.
  const now = useMemo(() => new Date(), []);
  const timeframeEnd = useMemo(
    () => getTimeframeEnd(timeframe, now),
    [timeframe, now],
  );

  const handleOneTimeScheduleCreated = useCallback(
    ({
      schedule,
      recordDefaults,
    }: {
      schedule: PaymentSchedule;
      recordDefaults: {
        paymentDate: Date;
        amount: number;
        paymentMethod: string;
        paymentAccountId?: string | null;
      };
    }) => {
      const paymentDate =
        recordDefaults.paymentDate instanceof Date &&
        !Number.isNaN(recordDefaults.paymentDate.getTime())
          ? recordDefaults.paymentDate
          : undefined;
      const amountValue = Number.isFinite(recordDefaults.amount)
        ? recordDefaults.amount
        : undefined;
      setRecordingSchedule(schedule);
      setRecordPrefill({
        expenseId: schedule.expenseId,
        values: {
          paymentDate,
          amount: amountValue,
          paymentMethod: recordDefaults.paymentMethod || "other",
          paymentAccountId: recordDefaults.paymentAccountId || undefined,
        },
      });
      setRecordDialogOpen(true);
    },
    [],
  );
  const canDelete = user?.role === "Admin";

  const { data: schedules = [] } = useQuery<PaymentSchedule[]>({
    queryKey: ["/api/payment-schedules"],
  });

  const { data: records = [] } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payment-records"],
  });

  const { data: companies = [] } = useQuery<InternalCompany[]>({
    queryKey: ["/api/internal-companies"],
  });

  const { data: paymentAccounts = [] } = useQuery<PaymentAccount[]>({
    queryKey: ["/api/payment-accounts"],
  });

  const { data: paymentTypes = [] } = useQuery<PaymentType[]>({
    queryKey: ["/api/payment-types"],
  });

  const { data: expenseTypes = [] } = useQuery<ExpenseType[]>({
    queryKey: ["/api/expense-types"],
  });

  const { data: users = [] } = useQuery<{ id: string; username: string }[]>({
    queryKey: ["/api/users/approvers"],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/payment-schedules/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-schedules"] });
      toast({ title: "Payment schedule deleted successfully" });
    },
    onError: () => {
      toast({
        title: "Failed to delete payment schedule",
        description: "Please try again",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setDeletingScheduleId(null);
    },
  });

  // Lookups
  const getCompanyById = useCallback(
    (id: string) => companies.find((c) => c.id === id),
    [companies],
  );
  const getAccountById = useCallback(
    (id: string) => paymentAccounts.find((a) => a.id === id),
    [paymentAccounts],
  );
  const getPaymentTypeById = (id: string) => paymentTypes.find(t => t.id === id);
  const getExpenseTypeById = useCallback(
    (id: string) => expenseTypes.find((t) => t.id === id),
    [expenseTypes],
  );
  const getUserById = (id: string) => users.find(u => u.id === id);

  const accountLabel = useCallback(
    (id: string) => {
      const account = getAccountById(id);
      if (!account) return "Unknown account";
      return account.lastFourDigits
        ? `${account.name} (*${account.lastFourDigits})`
        : account.name;
    },
    [getAccountById],
  );

  // Determine payment status
  const getPaymentStatus = useCallback(
    (schedule: PaymentSchedule): "paid" | "due-soon" | "overdue" | "scheduled" => {
      if (schedule.status === "completed") {
        return "paid";
      }
      const dueDate = new Date(schedule.nextDueDate);
      const daysUntil = differenceInDays(dueDate, now);

      if (daysUntil < 0) return "overdue";
      if (daysUntil <= 7) return "due-soon";
      return "scheduled";
    },
    [now],
  );

  // Enrich schedules with status
  const enrichedSchedules = useMemo(() => {
    return schedules.map(schedule => ({
      ...schedule,
      status: getPaymentStatus(schedule),
      company: getCompanyById(schedule.internalCompanyId),
      account: getAccountById(schedule.paymentAccountId),
      paymentType: getPaymentTypeById(schedule.paymentTypeId),
      expenseType: getExpenseTypeById(schedule.expenseTypeId),
    }));
  }, [schedules, getCompanyById, getAccountById, getExpenseTypeById, getPaymentStatus]);

  // Filter schedules (Schedules tab)
  const filteredSchedules = enrichedSchedules.filter((schedule) => {
    const matchesSearch =
      schedule.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      schedule.expenseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      schedule.company?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = scheduleFilter === "all" ||
      (scheduleFilter === "due-soon" && schedule.status === "due-soon") ||
      (scheduleFilter === "overdue" && schedule.status === "overdue") ||
      (scheduleFilter === "recurring" && ["weekly", "bi-weekly", "monthly", "quarterly", "yearly"].includes(schedule.frequency));

    return matchesSearch && matchesTab;
  });

  // Enrich payment records
  const enrichedRecords = useMemo(() => {
    return records.map(record => {
      const payer = getUserById(record.paidBy);
      const account = record.paymentAccountId ? getAccountById(record.paymentAccountId) : undefined;
      const schedule = record.paymentScheduleId
        ? schedules.find(s => s.id === record.paymentScheduleId)
        : schedules.find(s => s.expenseId === record.expenseId);
      const company = record.internalCompanyId
        ? getCompanyById(record.internalCompanyId)
        : schedule
        ? getCompanyById(schedule.internalCompanyId)
        : undefined;
      const companyLabel = company?.name;
      const vendorLabel = schedule?.vendorName || record.expenseId;
      const displayName = companyLabel
        ? (companyLabel.includes(vendorLabel) || companyLabel === vendorLabel
            ? companyLabel
            : `${companyLabel} · ${vendorLabel}`)
        : vendorLabel || "Unknown";
      const paymentDate = new Date(record.paymentDate);
      const scheduledDueDate = record.scheduledDueDate
        ? new Date(record.scheduledDueDate)
        : schedule
        ? new Date(schedule.nextDueDate)
        : undefined;
      const storedDaysLate = Number(record.daysLate ?? 0);
      const computedDaysLate =
        scheduledDueDate && paymentDate
          ? Math.max(
              0,
              Math.ceil(
                (paymentDate.getTime() - scheduledDueDate.getTime()) / MS_PER_DAY,
              ),
            )
          : 0;
      const normalizedDaysLate =
        storedDaysLate > 0 ? storedDaysLate : computedDaysLate;

      return {
        id: record.id,
        date: paymentDate,
        company: displayName,
        amount: parseFloat(record.amount),
        payer: payer?.username || "Unknown",
        method: record.paymentMethod,
        account: account ? `${account.name}${account.lastFourDigits ? ` (*${account.lastFourDigits})` : ''}` : undefined,
        hasConfirmation: !!record.confirmationFile,
        confirmationFile: record.confirmationFile,
        hasApproval: !!record.approvalScreenshot,
        approvalFile: record.approvalScreenshot,
        daysLate: normalizedDaysLate,
        scheduledDueDate,
        paymentMethod: record.paymentMethod,
        paymentAccountId: record.paymentAccountId ?? null,
        rawRecord: record,
      };
    });
  }, [records, schedules, users, getAccountById, getCompanyById]);

  // ---- Dashboard analytics ----
  const runRate = useMemo(() => monthlyRunRate(schedules), [schedules]);

  const forecast = useMemo(
    () => monthlyForecast(schedules, now, timeframe === "year" ? 12 : 6),
    [schedules, now, timeframe],
  );

  const spendTrend = useMemo(
    () => monthlySpendTrend(records, now, 6),
    [records, now],
  );

  const breakdownByType = useMemo(
    () =>
      breakdownBy(
        schedules,
        (s) => s.expenseTypeId,
        (key) => getExpenseTypeById(key)?.name ?? "Uncategorized",
      ),
    [schedules, getExpenseTypeById],
  );

  const breakdownByCompany = useMemo(
    () =>
      breakdownBy(
        schedules,
        (s) => s.internalCompanyId,
        (key) => getCompanyById(key)?.name ?? "Unknown company",
      ),
    [schedules, getCompanyById],
  );

  const breakdownByAccount = useMemo(
    () =>
      breakdownBy(
        schedules,
        (s) => s.paymentAccountId,
        (key) => accountLabel(key),
      ),
    [schedules, accountLabel],
  );

  // Upcoming + overdue payments list (scoped to the active timeframe)
  const upcomingItems: UpcomingPaymentItem[] = useMemo(() => {
    return enrichedSchedules
      .filter((s) => s.status !== "paid" && s.isActive !== false)
      .map((s) => ({
        id: s.id,
        vendorName: s.vendorName,
        expenseId: s.expenseId,
        companyLabel: s.company?.name,
        expenseTypeLabel: s.expenseType?.name,
        amount: parseAmount(s.amount),
        dueDate: new Date(s.nextDueDate),
        status: s.status as UpcomingPaymentItem["status"],
      }))
      .filter((item) => item.dueDate <= timeframeEnd)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, UPCOMING_LIST_LIMIT);
  }, [enrichedSchedules, timeframeEnd]);

  // Upcoming obligations grouped by internal company, within the timeframe.
  const upcomingByCompany: UpcomingCompanyRow[] = useMemo(() => {
    const groups = new Map<string, UpcomingCompanyRow>();
    enrichedSchedules.forEach((s) => {
      if (s.status === "paid" || s.isActive === false) return;
      const dueDate = new Date(s.nextDueDate);
      if (dueDate < now || dueDate > timeframeEnd) return;
      const company = s.company;
      if (!company) return;
      const existing =
        groups.get(company.id) ?? {
          companyId: company.id,
          companyName: company.name,
          totalAmount: 0,
          scheduledCount: 0,
          soonestDue: undefined,
        };
      existing.totalAmount += parseAmount(s.amount);
      existing.scheduledCount += 1;
      if (!existing.soonestDue || dueDate < existing.soonestDue) {
        existing.soonestDue = dueDate;
      }
      groups.set(company.id, existing);
    });
    return Array.from(groups.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [enrichedSchedules, now, timeframeEnd]);

  // Payment issues across all active obligations (not timeframe-scoped — an
  // issue is an issue regardless of the selected window).
  const issues: PaymentIssue[] = useMemo(() => {
    const tolerance = 0.01;
    const recordsByExpenseId = new Map<string, PaymentRecord[]>();
    records.forEach((record) => {
      const bucket = recordsByExpenseId.get(record.expenseId) ?? [];
      bucket.push(record);
      recordsByExpenseId.set(record.expenseId, bucket);
    });

    const list: PaymentIssue[] = [];
    enrichedSchedules.forEach((s) => {
      if (s.status === "paid" || s.isActive === false) return;
      const dueDate = new Date(s.nextDueDate);
      const scheduleAmount = parseAmount(s.amount);
      const scheduleRecords = recordsByExpenseId.get(s.expenseId) ?? [];
      const latest = scheduleRecords
        .slice()
        .sort(
          (a, b) =>
            new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
        )[0];

      if (dueDate < now) {
        list.push({
          scheduleId: s.id,
          type: "overdue",
          vendorName: s.vendorName,
          expenseId: s.expenseId,
          companyName: s.company?.name,
          amount: scheduleAmount,
          detail: `Due ${format(dueDate, "MMM dd, yyyy")}`,
        });
      }

      if (latest) {
        const paidAmount = parseAmount(latest.amount);
        const paidOn = format(new Date(latest.paymentDate), "MMM dd, yyyy");
        if (paidAmount + tolerance < scheduleAmount) {
          list.push({
            scheduleId: s.id,
            type: "underpaid",
            vendorName: s.vendorName,
            expenseId: s.expenseId,
            companyName: s.company?.name,
            amount: scheduleAmount,
            detail: `Paid ${formatCurrency(paidAmount)} of ${formatCurrency(scheduleAmount)} on ${paidOn}`,
          });
        }
        if (paidAmount > scheduleAmount + tolerance) {
          list.push({
            scheduleId: s.id,
            type: "overpaid",
            vendorName: s.vendorName,
            expenseId: s.expenseId,
            companyName: s.company?.name,
            amount: scheduleAmount,
            detail: `Paid ${formatCurrency(paidAmount)} over ${formatCurrency(scheduleAmount)} on ${paidOn}`,
          });
        }
      }
    });

    records.forEach((record) => {
      const daysLate = Number(record.daysLate ?? 0);
      if (daysLate <= 0) return;
      const s =
        enrichedSchedules.find((x) => x.id === record.paymentScheduleId) ??
        enrichedSchedules.find((x) => x.expenseId === record.expenseId);
      if (!s || s.isActive === false) return;
      const dueDate = record.scheduledDueDate
        ? new Date(record.scheduledDueDate)
        : undefined;
      list.push({
        scheduleId: s.id,
        type: "late",
        vendorName: s.vendorName,
        expenseId: s.expenseId,
        companyName: s.company?.name,
        amount: parseAmount(s.amount),
        detail: `Paid ${format(new Date(record.paymentDate), "MMM dd, yyyy")} (${daysLate} day${daysLate === 1 ? "" : "s"} late${
          dueDate ? `; due ${format(dueDate, "MMM dd, yyyy")}` : ""
        })`,
      });
    });

    const priority = { overdue: 0, late: 1, underpaid: 2, overpaid: 3 } as const;
    return list.sort((a, b) => priority[a.type] - priority[b.type]);
  }, [enrichedSchedules, records, now]);

  // ---- KPI figures ----
  const overdueSchedules = enrichedSchedules.filter(
    (s) => s.status === "overdue" && s.isActive !== false,
  );
  const overdueAmount = overdueSchedules.reduce((sum, s) => sum + parseAmount(s.amount), 0);

  const upcomingInTimeframe = useMemo(() => {
    const items = enrichedSchedules.filter((s) => {
      if (s.status === "paid" || s.status === "overdue") return false;
      if (s.isActive === false) return false;
      const due = new Date(s.nextDueDate);
      return due >= now && due <= timeframeEnd;
    });
    return {
      count: items.length,
      amount: items.reduce((sum, s) => sum + parseAmount(s.amount), 0),
    };
  }, [enrichedSchedules, now, timeframeEnd]);

  const paidThisMonth = useMemo(() => {
    const items = enrichedRecords.filter(
      (r) =>
        r.date.getMonth() === now.getMonth() &&
        r.date.getFullYear() === now.getFullYear(),
    );
    return {
      count: items.length,
      amount: items.reduce((sum, r) => sum + r.amount, 0),
    };
  }, [enrichedRecords, now]);

  const handleRecordForSchedule = useCallback(
    (id: string) => {
      setRecordPrefill(null);
      const schedule = schedules.find((s) => s.id === id);
      if (schedule) {
        setRecordingSchedule(schedule);
        setRecordDialogOpen(true);
      }
    },
    [schedules],
  );

  // ---- Drill-down helpers ----
  const scheduleToEntry = useCallback(
    (
      s: (typeof enrichedSchedules)[number],
      date?: Date,
      amountOverride?: number,
    ): DrillEntry => ({
      id: date ? `${s.id}-${date.getTime()}` : s.id,
      scheduleId: s.id,
      vendor: s.vendorName,
      company: s.company?.name ?? "—",
      expenseType: s.expenseType?.name ?? "Uncategorized",
      account: accountLabel(s.paymentAccountId),
      amount: amountOverride ?? parseAmount(s.amount),
      date: date ?? new Date(s.nextDueDate),
      status: s.status,
    }),
    [accountLabel],
  );

  const recordToEntry = useCallback(
    (r: (typeof enrichedRecords)[number]): DrillEntry => {
      const rec = r.rawRecord;
      const schedule =
        schedules.find((s) => s.id === rec.paymentScheduleId) ??
        schedules.find((s) => s.expenseId === rec.expenseId);
      const company =
        getCompanyById(rec.internalCompanyId)?.name ??
        (schedule ? getCompanyById(schedule.internalCompanyId)?.name : undefined) ??
        "—";
      const expenseType = schedule
        ? getExpenseTypeById(schedule.expenseTypeId)?.name ?? "—"
        : "—";
      return {
        id: r.id,
        recordId: r.id,
        vendor: schedule?.vendorName ?? rec.expenseId,
        company,
        expenseType,
        account:
          r.account ??
          (rec.paymentAccountId ? accountLabel(rec.paymentAccountId) : "—"),
        amount: r.amount,
        date: r.date,
      };
    },
    [schedules, getCompanyById, getExpenseTypeById, accountLabel],
  );

  // ---- KPI drill-downs ----
  const handleRunRateDrill = () => {
    const entries = enrichedSchedules
      .filter((s) => s.status !== "paid" && s.isActive !== false && isRecurring(s.frequency))
      .map((s) =>
        scheduleToEntry(
          s,
          new Date(s.nextDueDate),
          parseAmount(s.amount) * (MONTHLY_FACTOR[s.frequency] ?? 0),
        ),
      )
      .sort((a, b) => b.amount - a.amount);
    setDrillDown({
      title: "Monthly run-rate",
      description: "Recurring schedules, each normalized to a monthly amount",
      dateLabel: "Next due",
      entries,
    });
  };

  const handleUpcomingDrill = () => {
    const entries = enrichedSchedules
      .filter((s) => {
        if (s.status === "paid" || s.status === "overdue") return false;
        if (s.isActive === false) return false;
        const due = new Date(s.nextDueDate);
        return due >= now && due <= timeframeEnd;
      })
      .map((s) => scheduleToEntry(s))
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
    setDrillDown({
      title: `Upcoming · ${TIMEFRAME_LABELS[timeframe]}`,
      description: `Scheduled payments coming due in the ${TIMEFRAME_LABELS[timeframe].toLowerCase()}`,
      dateLabel: "Due date",
      entries,
    });
  };

  const handleCompanyDrill = (companyId: string, companyName: string) => {
    const entries = enrichedSchedules
      .filter((s) => {
        if (s.status === "paid" || s.isActive === false) return false;
        if (s.internalCompanyId !== companyId) return false;
        const due = new Date(s.nextDueDate);
        return due >= now && due <= timeframeEnd;
      })
      .map((s) => scheduleToEntry(s))
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
    setDrillDown({
      title: `Upcoming · ${companyName}`,
      description: `Scheduled payments due ${format(now, "MMM dd")} → ${format(timeframeEnd, "MMM dd, yyyy")}`,
      dateLabel: "Due date",
      entries,
    });
  };

  const handleOverdueDrill = () => {
    const entries = enrichedSchedules
      .filter((s) => s.status === "overdue" && s.isActive !== false)
      .map((s) => scheduleToEntry(s))
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
    setDrillDown({
      title: "Overdue payments",
      description: "Schedules that are past their due date",
      dateLabel: "Due date",
      entries,
    });
  };

  const handlePaidDrill = () => {
    const entries = enrichedRecords
      .filter(
        (r) =>
          r.date.getMonth() === now.getMonth() &&
          r.date.getFullYear() === now.getFullYear(),
      )
      .map(recordToEntry)
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    setDrillDown({
      title: "Paid this month",
      description: "Payments recorded this calendar month",
      dateLabel: "Payment date",
      entries,
    });
  };

  // ---- Chart drill-downs ----
  const handleForecastMonth = (bucket: ForecastBucket) => {
    const start = bucket.monthStart;
    const end = addMonths(start, 1);
    const entries: DrillEntry[] = [];
    enrichedSchedules.forEach((s) => {
      if (s.status === "paid" || s.isActive === false) return;
      projectOccurrences(s, start, end)
        .filter((d) => isSameMonth(d, start))
        .forEach((date) => entries.push(scheduleToEntry(s, date)));
    });
    entries.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
    setDrillDown({
      title: `Projected expenses · ${format(start, "MMMM yyyy")}`,
      description:
        "Scheduled payments (including recurring) projected to fall in this month",
      dateLabel: "Projected date",
      entries,
    });
  };

  const handleBreakdownSelect = (sel: BreakdownSelection) => {
    const keys = new Set(sel.memberKeys);
    const keyOf = (s: (typeof enrichedSchedules)[number]) =>
      sel.dimension === "type"
        ? s.expenseTypeId
        : sel.dimension === "company"
        ? s.internalCompanyId
        : s.paymentAccountId;
    const word =
      sel.dimension === "type" ? "type" : sel.dimension === "company" ? "company" : "account";
    const entries = enrichedSchedules
      .filter((s) => s.status !== "paid" && s.isActive !== false && keys.has(keyOf(s)))
      .map((s) => scheduleToEntry(s))
      .sort((a, b) => b.amount - a.amount);
    setDrillDown({
      title: sel.label,
      description: `Active scheduled payments for this ${word}`,
      dateLabel: "Next due",
      entries,
    });
  };

  const handleTrendMonth = (point: TrendPoint) => {
    const entries = enrichedRecords
      .filter((r) => isSameMonth(r.date, point.monthStart))
      .map(recordToEntry)
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    setDrillDown({
      title: `Payments recorded · ${format(point.monthStart, "MMMM yyyy")}`,
      description: "Actual payments recorded in this month",
      dateLabel: "Payment date",
      entries,
    });
  };

  // ---- Row detail ----
  const buildScheduleDetail = useCallback(
    (scheduleId: string, highlightId?: string): ExpenseDetailData | null => {
      const s = enrichedSchedules.find((x) => x.id === scheduleId);
      if (!s) return null;
      const history = records
        .filter(
          (r) =>
            r.paymentScheduleId === s.id ||
            (!r.paymentScheduleId && r.expenseId === s.expenseId),
        )
        .sort(
          (a, b) =>
            new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
        )
        .map((r) => ({
          id: r.id,
          date: format(new Date(r.paymentDate), "MMM dd, yyyy"),
          amount: formatCurrency(parseAmount(r.amount)),
          method: r.paymentMethod,
          account: r.paymentAccountId ? accountLabel(r.paymentAccountId) : undefined,
          daysLate: Number(r.daysLate ?? 0),
          hasConfirmation: !!r.confirmationFile,
        }));
      return {
        vendor: s.vendorName,
        expenseId: s.expenseId,
        status: s.status,
        scheduleId: s.id,
        active: s.isActive !== false,
        fields: [
          { label: "Company", value: s.company?.name ?? "—" },
          { label: "Expense type", value: s.expenseType?.name ?? "—" },
          { label: "Amount", value: formatCurrency(parseAmount(s.amount)) },
          { label: "Frequency", value: FREQUENCY_LABELS[s.frequency] ?? s.frequency },
          { label: "Next due", value: format(new Date(s.nextDueDate), "MMM dd, yyyy") },
          { label: "Payment account", value: accountLabel(s.paymentAccountId) },
          { label: "Payment type", value: s.paymentType?.name ?? "—" },
        ],
        history,
        highlightId,
      };
    },
    [enrichedSchedules, records, accountLabel],
  );

  const buildRecordDetail = useCallback(
    (recordId: string): ExpenseDetailData | null => {
      const r = records.find((x) => x.id === recordId);
      if (!r) return null;
      const schedule =
        schedules.find((s) => s.id === r.paymentScheduleId) ??
        schedules.find((s) => s.expenseId === r.expenseId);
      if (schedule) return buildScheduleDetail(schedule.id, r.id);
      return {
        vendor: r.expenseId,
        expenseId: r.expenseId,
        fields: [
          { label: "Company", value: getCompanyById(r.internalCompanyId)?.name ?? "—" },
          { label: "Amount", value: formatCurrency(parseAmount(r.amount)) },
          { label: "Payment date", value: format(new Date(r.paymentDate), "MMM dd, yyyy") },
          { label: "Payment method", value: r.paymentMethod },
          {
            label: "Payment account",
            value: r.paymentAccountId ? accountLabel(r.paymentAccountId) : "—",
          },
        ],
        history: [
          {
            id: r.id,
            date: format(new Date(r.paymentDate), "MMM dd, yyyy"),
            amount: formatCurrency(parseAmount(r.amount)),
            method: r.paymentMethod,
            account: r.paymentAccountId ? accountLabel(r.paymentAccountId) : undefined,
            daysLate: Number(r.daysLate ?? 0),
            hasConfirmation: !!r.confirmationFile,
          },
        ],
        highlightId: r.id,
      };
    },
    [records, schedules, getCompanyById, accountLabel, buildScheduleDetail],
  );

  const handleOpenEntry = (entry: DrillEntry) => {
    const built = entry.scheduleId
      ? buildScheduleDetail(entry.scheduleId, entry.recordId)
      : entry.recordId
      ? buildRecordDetail(entry.recordId)
      : null;
    if (built) setDetail(built);
  };

  const handleEditFromDetail = (scheduleId: string) => {
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;
    setDetail(null);
    setDrillDown(null);
    setEditingSchedule(schedule);
    setEditDialogOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Signed out" });
    } catch (error: any) {
      toast({
        title: "Failed to log out",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold" data-testid="text-dashboard-title">Expense Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upcoming obligations, spending breakdown, and payment activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={timeframe}
              onValueChange={(value) => value && setTimeframe(value as Timeframe)}
              variant="outline"
              size="sm"
              className="mr-1"
              data-testid="toggle-timeframe"
            >
              {(Object.keys(TIMEFRAME_LABELS) as Timeframe[]).map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="px-3"
                  data-testid={`toggle-timeframe-${value}`}
                >
                  {TIMEFRAME_LABELS[value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <CSVImportDialog />
            {isAdmin && (
              <Button asChild variant="outline" data-testid="button-audit">
                <Link href="/audit">Audit Log</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="icon" data-testid="button-guide" title="User Guide">
              <Link href="/guide">
                <HelpCircle className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" data-testid="button-settings">
              <Link href="/settings">
                <SettingsIcon className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <AddPaymentDialog onOneTimeScheduleCreated={handleOneTimeScheduleCreated} />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStatsCard
            title="Monthly Run-Rate"
            value={formatCurrencyWhole(runRate)}
            icon={Wallet}
            description="Recurring commitments / month"
            onClick={handleRunRateDrill}
          />
          <QuickStatsCard
            title="Upcoming"
            value={formatCurrencyWhole(upcomingInTimeframe.amount)}
            icon={CalendarClock}
            description={`${upcomingInTimeframe.count} due · ${TIMEFRAME_LABELS[timeframe]}`}
            onClick={handleUpcomingDrill}
          />
          <QuickStatsCard
            title="Overdue"
            value={formatCurrencyWhole(overdueAmount)}
            icon={AlertCircle}
            description={`${overdueSchedules.length} item${overdueSchedules.length === 1 ? "" : "s"} past due`}
            onClick={handleOverdueDrill}
          />
          <QuickStatsCard
            title="Paid This Month"
            value={formatCurrencyWhole(paidThisMonth.amount)}
            icon={CheckCircle2}
            description={`${paidThisMonth.count} payment${paidThisMonth.count === 1 ? "" : "s"} recorded`}
            onClick={handlePaidDrill}
          />
        </div>

        {/* Main Views */}
        <Tabs value={activeView} onValueChange={setActiveView} className="space-y-6">
          <TabsList data-testid="tabs-view">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="schedules" data-testid="tab-schedules">Schedules</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ExpenseForecastChart
                  data={forecast}
                  onSelectMonth={handleForecastMonth}
                />
              </div>
              <ExpenseBreakdownChart
                byType={breakdownByType}
                byCompany={breakdownByCompany}
                byAccount={breakdownByAccount}
                onSelect={handleBreakdownSelect}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
              <UpcomingPanel
                view={upcomingView}
                onViewChange={setUpcomingView}
                windowLabel={`Overdue + ${TIMEFRAME_LABELS[timeframe].toLowerCase()}`}
                items={upcomingItems}
                byCompany={upcomingByCompany}
                onRecordPayment={handleRecordForSchedule}
                onSelectCompany={handleCompanyDrill}
              />
              <PaymentIssuesPanel
                issues={issues}
                onSelect={(scheduleId) => {
                  const built = buildScheduleDetail(scheduleId);
                  if (built) setDetail(built);
                }}
              />
            </div>
            <SpendTrendChart data={spendTrend} onSelectMonth={handleTrendMonth} />
          </TabsContent>

          {/* Schedules */}
          <TabsContent value="schedules" className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <ToggleGroup
                type="single"
                value={scheduleFilter}
                onValueChange={(value) => value && setScheduleFilter(value)}
                variant="outline"
                size="sm"
                data-testid="tabs-filter"
              >
                <ToggleGroupItem value="all" data-testid="tab-all">All</ToggleGroupItem>
                <ToggleGroupItem value="recurring" data-testid="tab-recurring">Recurring</ToggleGroupItem>
                <ToggleGroupItem value="due-soon" data-testid="tab-due-soon">Due Soon</ToggleGroupItem>
                <ToggleGroupItem value="overdue" data-testid="tab-overdue">Overdue</ToggleGroupItem>
              </ToggleGroup>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by vendor, expense ID, or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>

            {filteredSchedules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No payment schedules found</p>
                <AddPaymentDialog
                  onOneTimeScheduleCreated={handleOneTimeScheduleCreated}
                  trigger={
                    <Button variant="outline" className="mt-4" data-testid="button-add-first">
                      Add Your First Payment
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSchedules.map((schedule) => (
                  <PaymentScheduleCard
                    key={schedule.id}
                    id={schedule.id}
                    company={`${schedule.company?.abbreviation || ""} - ${schedule.vendorName}`}
                    expenseId={schedule.expenseId}
                    amount={parseFloat(schedule.amount)}
                    dueDate={new Date(schedule.nextDueDate)}
                    frequency={schedule.frequency as any}
                    status={schedule.status}
                    onEdit={(id) => {
                      const scheduleToEdit = schedules.find(s => s.id === id);
                      if (scheduleToEdit) {
                        setEditingSchedule(scheduleToEdit);
                        setEditDialogOpen(true);
                      }
                    }}
                    onDelete={(id) => setDeletingScheduleId(id)}
                    onRecordPayment={handleRecordForSchedule}
                    canDelete={canDelete}
                    inactive={schedule.isActive === false}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold">Payment History</h2>
                <p className="text-sm text-muted-foreground">
                  All recorded payments with confirmations and approvals
                </p>
              </div>
              <Button
                variant="outline"
                data-testid="button-record-payment"
                onClick={() => {
                  setRecordingSchedule(null);
                  setRecordPrefill(null);
                  setRecordDialogOpen(true);
                }}
              >
                Record Payment
              </Button>
            </div>
            <PaymentHistoryTable
              payments={enrichedRecords}
              paymentAccounts={paymentAccounts}
              approvers={users}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Record Payment Dialog (controlled, available from any view) */}
      <RecordPaymentDialog
        trigger={<span className="sr-only" aria-hidden />}
        open={recordDialogOpen}
        onOpenChange={(open) => {
          setRecordDialogOpen(open);
          if (!open) {
            setRecordingSchedule(null);
            setRecordPrefill(null);
          }
        }}
        scheduleId={recordingSchedule?.id}
        expenseId={recordPrefill?.expenseId ?? recordingSchedule?.expenseId}
        scheduledAmount={recordingSchedule ? parseFloat(recordingSchedule.amount) : undefined}
        initialValues={recordPrefill?.values}
      />

      {/* Chart & KPI drill-down */}
      <DrillDownDialog
        config={drillDown}
        onOpenChange={(open) => !open && setDrillDown(null)}
        onOpenEntry={handleOpenEntry}
      />

      {/* Expense detail */}
      <ExpenseDetailDialog
        data={detail}
        onOpenChange={(open) => !open && setDetail(null)}
        onEdit={handleEditFromDetail}
      />

      {/* Edit Payment Dialog */}
      <EditPaymentDialog
        schedule={editingSchedule}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingScheduleId}
        onOpenChange={(open) => !open && !deleteMutation.isPending && setDeletingScheduleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment schedule? This action cannot be undone.
              {deletingScheduleId && (
                <>
                  <br /><br />
                  <strong>
                    {schedules.find(s => s.id === deletingScheduleId)?.expenseId}
                  </strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} data-testid="button-delete-cancel">
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={() => deletingScheduleId && deleteMutation.mutate(deletingScheduleId)}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-confirm"
              variant="destructive"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
