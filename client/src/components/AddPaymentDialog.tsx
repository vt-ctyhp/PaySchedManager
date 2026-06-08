import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { InternalCompany, PaymentAccount, PaymentType, ExpenseType, PaymentSchedule } from "@shared/schema";

interface AddPaymentDialogProps {
  trigger?: React.ReactNode;
  onOneTimeScheduleCreated?: (details: {
    schedule: PaymentSchedule;
    recordDefaults: {
      paymentDate: Date;
      amount: number;
      paymentMethod: string;
      paymentAccountId?: string | null;
    };
  }) => void;
}

const PAYMENT_METHOD_VALUES = new Set([
  "credit-card",
  "debit-card",
  "bank-transfer",
  "cash",
  "paypal",
  "ach",
  "wire",
  "other",
]);

const mapPaymentTypeToMethod = (typeName?: string) => {
  if (!typeName) return "other";
  const sanitized = typeName
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

  if (PAYMENT_METHOD_VALUES.has(sanitized)) {
    return sanitized;
  }

  switch (sanitized) {
    case "creditcard":
      return "credit-card";
    case "debitcard":
      return "debit-card";
    case "banktransfer":
      return "bank-transfer";
    default:
      return "other";
  }
};

export default function AddPaymentDialog({ trigger, onOneTimeScheduleCreated }: AddPaymentDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [internalCompanyId, setInternalCompanyId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorAbbreviation, setVendorAbbreviation] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("");
  const [nextDueDate, setNextDueDate] = useState<Date>();
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [expenseTypeId, setExpenseTypeId] = useState("");

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

  const createMutation = useMutation<PaymentSchedule, unknown, any>({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/payment-schedules", data);
      return (await response.json()) as PaymentSchedule;
    },
    onSuccess: (schedule, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-schedules"] });
      toast({ title: "Payment schedule created successfully" });
      setOpen(false);
      resetForm();

      if (
        variables?.frequency === "one-time" &&
        typeof variables.nextDueDate === "string" &&
        typeof variables.amount === "string" &&
        onOneTimeScheduleCreated
      ) {
        const selectedType = paymentTypes.find((type) => type.id === variables.paymentTypeId);
        const paymentMethod = mapPaymentTypeToMethod(selectedType?.name);
        const paymentDate = new Date(variables.nextDueDate);
        const amountNumber = Number.parseFloat(variables.amount);

        onOneTimeScheduleCreated({
          schedule,
          recordDefaults: {
            paymentDate,
            amount: Number.isFinite(amountNumber) ? amountNumber : 0,
            paymentMethod,
            paymentAccountId: variables.paymentAccountId || schedule.paymentAccountId || null,
          },
        });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create payment schedule", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setInternalCompanyId("");
    setVendorName("");
    setVendorAbbreviation("");
    setAmount("");
    setFrequency("");
    setNextDueDate(undefined);
    setPaymentTypeId("");
    setPaymentAccountId("");
    setExpenseTypeId("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nextDueDate) {
      toast({ title: "Please select a due date", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      internalCompanyId,
      vendorName,
      vendorAbbreviation,
      amount,
      frequency,
      nextDueDate: nextDueDate.toISOString(),
      paymentTypeId,
      paymentAccountId,
      expenseTypeId,
      status: "scheduled",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="button-add-payment">
            <Plus className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Payment Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="internal-company">Internal Company</Label>
              <Select value={internalCompanyId} onValueChange={setInternalCompanyId} required>
                <SelectTrigger id="internal-company" data-testid="select-internal-company">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-type">Expense Type</Label>
              <Combobox
                id="expense-type"
                data-testid="select-expense-type"
                value={expenseTypeId}
                onValueChange={setExpenseTypeId}
                placeholder="Select type"
                searchPlaceholder="Search types..."
                emptyText="No expense types found."
                options={expenseTypes.map((type) => ({
                  value: type.id,
                  label: type.name,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor Name</Label>
              <Input
                id="vendor-name"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g., Netflix, Adobe"
                data-testid="input-vendor-name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-abbr">Vendor Abbreviation</Label>
              <Input
                id="vendor-abbr"
                value={vendorAbbreviation}
                onChange={(e) => setVendorAbbreviation(e.target.value.toUpperCase())}
                placeholder="e.g., NFLX, ADBE"
                data-testid="input-vendor-abbr"
                maxLength={6}
                required
              />
              <p className="text-xs text-muted-foreground">
                For Expense ID generation (max 6 chars)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                  data-testid="input-amount"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency} required>
                <SelectTrigger id="frequency" data-testid="select-frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment-type">Payment Type</Label>
              <Select value={paymentTypeId} onValueChange={setPaymentTypeId} required>
                <SelectTrigger id="payment-type" data-testid="select-payment-type">
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-account">Payment Account</Label>
              <Combobox
                id="payment-account"
                data-testid="select-payment-account"
                value={paymentAccountId}
                onValueChange={setPaymentAccountId}
                placeholder="Select account"
                searchPlaceholder="Search accounts..."
                emptyText="No accounts found."
                options={paymentAccounts.map((account) => ({
                  value: account.id,
                  label: account.lastFourDigits
                    ? `${account.name} (****${account.lastFourDigits})`
                    : account.name,
                  keywords: account.lastFourDigits ?? undefined,
                }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Next Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-due-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nextDueDate ? format(nextDueDate, "PPP") : <span>Pick the next due date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={nextDueDate}
                  onSelect={setNextDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {frequency !== "one-time" && (
              <p className="text-xs text-muted-foreground">
                Future due dates will be calculated automatically based on frequency
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1" data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending} data-testid="button-save-payment">
              {createMutation.isPending ? "Adding..." : "Add Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
