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
import UpcomingPaymentsList, {
  type UpcomingPaymentItem,
} from "@/components/dashboard/UpcomingPaymentsList";
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
import { differenceInDays, addDays } from "date-fns";
import {
  monthlyRunRate,
  monthlyForecast,
  monthlySpendTrend,
  breakdownBy,
  parseAmount,
  formatCurrencyWhole,
} from "@/lib/expense-analytics";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const UPCOMING_HORIZON_DAYS = 30;
const UPCOMING_LIST_LIMIT = 8;

export default function Dashboard() {
  const { user, logout, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [activeView, setActiveView] = useState("overview");
  const [editingSchedule, setEditingSchedule] = useState<PaymentSchedule | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [recordingSchedule, setRecordingSchedule] = useState<PaymentSchedule | null>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [recordPrefill, setRecordPrefill] = useState<{
    values: RecordPaymentInitialValues;
    expenseId?: string;
  } | null>(null);

  // Stable "now" so memoised analytics don't shift on every render.
  const now = useMemo(() => new Date(), []);

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
    () => monthlyForecast(schedules, now, 6),
    [schedules, now],
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

  // Upcoming + overdue payments list
  const upcomingItems: UpcomingPaymentItem[] = useMemo(() => {
    const horizon = addDays(now, UPCOMING_HORIZON_DAYS);
    return enrichedSchedules
      .filter((s) => s.status !== "paid")
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
      .filter((item) => item.dueDate <= horizon)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, UPCOMING_LIST_LIMIT);
  }, [enrichedSchedules, now]);

  // ---- KPI figures ----
  const overdueSchedules = enrichedSchedules.filter((s) => s.status === "overdue");
  const overdueAmount = overdueSchedules.reduce((sum, s) => sum + parseAmount(s.amount), 0);

  const dueNext30 = useMemo(() => {
    const horizon = addDays(now, 30);
    const items = enrichedSchedules.filter((s) => {
      if (s.status === "paid" || s.status === "overdue") return false;
      const due = new Date(s.nextDueDate);
      return due >= now && due <= horizon;
    });
    return {
      count: items.length,
      amount: items.reduce((sum, s) => sum + parseAmount(s.amount), 0),
    };
  }, [enrichedSchedules, now]);

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
            <CSVImportDialog />
            <Button asChild variant="secondary" data-testid="button-reports">
              <Link href="/reports">Reports</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="outline" data-testid="button-audit">
                <Link href="/audit">Audit Log</Link>
              </Button>
            )}
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
          />
          <QuickStatsCard
            title="Due Next 30 Days"
            value={formatCurrencyWhole(dueNext30.amount)}
            icon={CalendarClock}
            description={`${dueNext30.count} payment${dueNext30.count === 1 ? "" : "s"} scheduled`}
          />
          <QuickStatsCard
            title="Overdue"
            value={formatCurrencyWhole(overdueAmount)}
            icon={AlertCircle}
            description={`${overdueSchedules.length} item${overdueSchedules.length === 1 ? "" : "s"} past due`}
          />
          <QuickStatsCard
            title="Paid This Month"
            value={formatCurrencyWhole(paidThisMonth.amount)}
            icon={CheckCircle2}
            description={`${paidThisMonth.count} payment${paidThisMonth.count === 1 ? "" : "s"} recorded`}
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
                <ExpenseForecastChart data={forecast} />
              </div>
              <ExpenseBreakdownChart
                byType={breakdownByType}
                byCompany={breakdownByCompany}
                byAccount={breakdownByAccount}
              />
            </div>
            <SpendTrendChart data={spendTrend} />
            <UpcomingPaymentsList
              items={upcomingItems}
              windowLabel="Overdue + next 30 days"
              onRecordPayment={handleRecordForSchedule}
            />
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
