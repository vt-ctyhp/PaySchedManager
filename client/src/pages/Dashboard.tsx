import { useState } from "react";
import { DollarSign, Calendar, Clock, AlertCircle } from "lucide-react";
import QuickStatsCard from "@/components/QuickStatsCard";
import PaymentScheduleCard from "@/components/PaymentScheduleCard";
import AddPaymentDialog from "@/components/AddPaymentDialog";
import RecordPaymentDialog from "@/components/RecordPaymentDialog";
import PaymentHistoryTable from "@/components/PaymentHistoryTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

// Mock data - todo: remove mock functionality
const mockSchedules = [
  {
    id: "1",
    company: "Netflix",
    amount: 15.99,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    frequency: "monthly" as const,
    status: "due-soon" as const,
  },
  {
    id: "2",
    company: "Spotify",
    amount: 9.99,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    frequency: "monthly" as const,
    status: "scheduled" as const,
  },
  {
    id: "3",
    company: "Adobe Creative Cloud",
    amount: 54.99,
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    frequency: "monthly" as const,
    status: "overdue" as const,
  },
  {
    id: "4",
    company: "Amazon Prime",
    amount: 14.99,
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    frequency: "monthly" as const,
    status: "scheduled" as const,
  },
  {
    id: "5",
    company: "GitHub Pro",
    amount: 7.00,
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    frequency: "monthly" as const,
    status: "scheduled" as const,
  },
  {
    id: "6",
    company: "Insurance Premium",
    amount: 450.00,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    frequency: "quarterly" as const,
    status: "scheduled" as const,
  },
];

const mockHistory = [
  {
    id: "h1",
    date: new Date("2024-01-15"),
    company: "Netflix",
    amount: 15.99,
    payer: "John Doe",
    method: "credit-card",
    account: "**** 1234",
    hasConfirmation: true,
  },
  {
    id: "h2",
    date: new Date("2024-01-10"),
    company: "Spotify",
    amount: 9.99,
    payer: "Jane Smith",
    method: "paypal",
    hasConfirmation: false,
  },
  {
    id: "h3",
    date: new Date("2024-01-05"),
    company: "Adobe Creative Cloud",
    amount: 54.99,
    payer: "John Doe",
    method: "credit-card",
    account: "**** 5678",
    hasConfirmation: true,
  },
];

export default function Dashboard() {
  const [schedules] = useState(mockSchedules);
  const [history] = useState(mockHistory);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredSchedules = schedules.filter((schedule) => {
    const matchesSearch = schedule.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || 
      (activeTab === "due-soon" && schedule.status === "due-soon") ||
      (activeTab === "overdue" && schedule.status === "overdue") ||
      (activeTab === "recurring" && ["bi-weekly", "monthly", "quarterly", "yearly"].includes(schedule.frequency));
    return matchesSearch && matchesTab;
  });

  const totalScheduled = schedules.reduce((sum, s) => sum + s.amount, 0);
  const dueSoon = schedules.filter(s => s.status === "due-soon").length;
  const overdue = schedules.filter(s => s.status === "overdue").length;
  const paidThisMonth = history.length;

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
          <AddPaymentDialog />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStatsCard
            title="Total Scheduled"
            value={`$${totalScheduled.toFixed(2)}`}
            icon={DollarSign}
            description={`${schedules.length} active payments`}
          />
          <QuickStatsCard
            title="Paid This Month"
            value={paidThisMonth}
            icon={Calendar}
            description={`$${history.reduce((sum, h) => sum + h.amount, 0).toFixed(2)} total`}
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
                placeholder="Search payments..."
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
                      {...schedule}
                      onEdit={(id) => console.log("Edit", id)}
                      onDelete={(id) => console.log("Delete", id)}
                      onRecordPayment={(id) => {
                        const schedule = schedules.find(s => s.id === id);
                        console.log("Record payment for", schedule?.company);
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
              <PaymentHistoryTable payments={history} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
