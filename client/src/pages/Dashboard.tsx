import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Calendar, Clock, AlertCircle, Settings as SettingsIcon } from "lucide-react";
import QuickStatsCard from "@/components/QuickStatsCard";
import PaymentScheduleCard from "@/components/PaymentScheduleCard";
import AddPaymentDialog from "@/components/AddPaymentDialog";
import RecordPaymentDialog from "@/components/RecordPaymentDialog";
import PaymentHistoryTable from "@/components/PaymentHistoryTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Link } from "wouter";
import type { 
  PaymentSchedule, 
  PaymentRecord, 
  InternalCompany, 
  PaymentAccount, 
  PaymentType, 
  ExpenseType 
} from "@shared/schema";
import { differenceInDays, format } from "date-fns";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

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

  // Helper functions
  const getCompanyById = (id: string) => companies.find(c => c.id === id);
  const getAccountById = (id: string) => paymentAccounts.find(a => a.id === id);
  const getPaymentTypeById = (id: string) => paymentTypes.find(t => t.id === id);
  const getExpenseTypeById = (id: string) => expenseTypes.find(t => t.id === id);

  // Determine payment status
  const getPaymentStatus = (schedule: PaymentSchedule): "paid" | "due-soon" | "overdue" | "scheduled" => {
    const dueDate = new Date(schedule.nextDueDate);
    const today = new Date();
    const daysUntil = differenceInDays(dueDate, today);

    if (daysUntil < 0) return "overdue";
    if (daysUntil <= 7) return "due-soon";
    return "scheduled";
  };

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
  }, [schedules, companies, paymentAccounts, paymentTypes, expenseTypes]);

  // Filter schedules
  const filteredSchedules = enrichedSchedules.filter((schedule) => {
    const matchesSearch = 
      schedule.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      schedule.expenseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      schedule.company?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = activeTab === "all" || 
      (activeTab === "due-soon" && schedule.status === "due-soon") ||
      (activeTab === "overdue" && schedule.status === "overdue") ||
      (activeTab === "recurring" && ["bi-weekly", "monthly", "quarterly", "yearly"].includes(schedule.frequency));
    
    return matchesSearch && matchesTab;
  });

  // Enrich payment records
  const enrichedRecords = useMemo(() => {
    return records.map(record => ({
      id: record.id,
      date: new Date(record.paymentDate),
      company: schedules.find(s => s.expenseId === record.expenseId)?.vendorName || "Unknown",
      amount: parseFloat(record.amount),
      payer: record.payer,
      method: record.paymentMethod,
      account: record.paymentAccount || undefined,
      hasConfirmation: !!record.confirmationFile,
    }));
  }, [records, schedules]);

  // Stats calculations
  const totalScheduled = enrichedSchedules.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const dueSoon = enrichedSchedules.filter(s => s.status === "due-soon").length;
  const overdue = enrichedSchedules.filter(s => s.status === "overdue").length;
  const paidThisMonth = records.filter(r => {
    const recordDate = new Date(r.paymentDate);
    const now = new Date();
    return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold" data-testid="text-dashboard-title">Payment Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your recurring and one-time payments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" data-testid="button-settings">
              <Link href="/settings">
                <SettingsIcon className="h-4 w-4" />
              </Link>
            </Button>
            <AddPaymentDialog />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStatsCard
            title="Total Scheduled"
            value={`$${totalScheduled.toFixed(2)}`}
            icon={DollarSign}
            description={`${enrichedSchedules.length} active payments`}
          />
          <QuickStatsCard
            title="Paid This Month"
            value={paidThisMonth}
            icon={Calendar}
            description={`$${enrichedRecords
              .filter(r => {
                const now = new Date();
                return r.date.getMonth() === now.getMonth() && r.date.getFullYear() === now.getFullYear();
              })
              .reduce((sum, r) => sum + r.amount, 0)
              .toFixed(2)} total`}
          />
          <QuickStatsCard
            title="Due Soon"
            value={dueSoon}
            icon={Clock}
            description="Next 7 days"
          />
          <QuickStatsCard
            title="Overdue"
            value={overdue}
            icon={AlertCircle}
            description="Needs attention"
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <TabsList data-testid="tabs-filter">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="recurring" data-testid="tab-recurring">Recurring</TabsTrigger>
              <TabsTrigger value="due-soon" data-testid="tab-due-soon">Due Soon</TabsTrigger>
              <TabsTrigger value="overdue" data-testid="tab-overdue">Overdue</TabsTrigger>
            </TabsList>
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

          <TabsContent value={activeTab} className="space-y-6">
            {/* Payment Schedules */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Payment Schedules</h2>
              {filteredSchedules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No payment schedules found</p>
                  <AddPaymentDialog 
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
                      onEdit={(id) => console.log("Edit", id)}
                      onDelete={(id) => console.log("Delete", id)}
                      onRecordPayment={(id) => {
                        const s = schedules.find(sch => sch.id === id);
                        console.log("Record payment for", s?.expenseId);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Payment History */}
            <div>
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <h2 className="text-xl font-semibold">Payment History</h2>
                <RecordPaymentDialog />
              </div>
              <PaymentHistoryTable payments={enrichedRecords} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
