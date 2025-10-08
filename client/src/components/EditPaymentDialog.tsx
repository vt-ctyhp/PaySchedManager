import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { InternalCompany, PaymentAccount, PaymentType, ExpenseType, PaymentSchedule } from "@shared/schema";

interface EditPaymentDialogProps {
  schedule: PaymentSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditPaymentDialog({ schedule, open, onOpenChange }: EditPaymentDialogProps) {
  const { toast } = useToast();
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

  // Pre-fill form when dialog opens or schedule changes
  useEffect(() => {
    if (schedule && open) {
      setInternalCompanyId(schedule.internalCompanyId);
      setVendorName(schedule.vendorName);
      setVendorAbbreviation(schedule.vendorAbbreviation);
      setAmount(schedule.amount);
      setFrequency(schedule.frequency);
      setNextDueDate(new Date(schedule.nextDueDate));
      setPaymentTypeId(schedule.paymentTypeId);
      setPaymentAccountId(schedule.paymentAccountId);
      setExpenseTypeId(schedule.expenseTypeId);
    }
  }, [schedule, open]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/payment-schedules/${schedule?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-schedules"] });
      toast({ title: "Payment schedule updated successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update payment schedule", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nextDueDate) {
      toast({ title: "Please select a due date", variant: "destructive" });
      return;
    }

    updateMutation.mutate({
      internalCompanyId,
      vendorName,
      vendorAbbreviation,
      amount,
      frequency,
      nextDueDate: nextDueDate.toISOString(),
      paymentTypeId,
      paymentAccountId,
      expenseTypeId,
    });
  };

  if (!schedule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Payment Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">Expense ID: {schedule.expenseId}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-internal-company">Internal Company</Label>
              <Select value={internalCompanyId} onValueChange={setInternalCompanyId} required>
                <SelectTrigger id="edit-internal-company" data-testid="select-edit-internal-company">
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
              <Label htmlFor="edit-expense-type">Expense Type</Label>
              <Select value={expenseTypeId} onValueChange={setExpenseTypeId} required>
                <SelectTrigger id="edit-expense-type" data-testid="select-edit-expense-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {expenseTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-vendor-name">Vendor Name</Label>
              <Input
                id="edit-vendor-name"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g., Netflix, Adobe"
                data-testid="input-edit-vendor-name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-vendor-abbr">Vendor Abbreviation</Label>
              <Input
                id="edit-vendor-abbr"
                value={vendorAbbreviation}
                onChange={(e) => setVendorAbbreviation(e.target.value.toUpperCase())}
                placeholder="e.g., NFLX, ADBE"
                data-testid="input-edit-vendor-abbr"
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
              <Label htmlFor="edit-amount">Payment Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                  data-testid="input-edit-amount"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency} required>
                <SelectTrigger id="edit-frequency" data-testid="select-edit-frequency">
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
              <Label htmlFor="edit-payment-type">Payment Type</Label>
              <Select value={paymentTypeId} onValueChange={setPaymentTypeId} required>
                <SelectTrigger id="edit-payment-type" data-testid="select-edit-payment-type">
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
              <Label htmlFor="edit-payment-account">Payment Account</Label>
              <Select value={paymentAccountId} onValueChange={setPaymentAccountId} required>
                <SelectTrigger id="edit-payment-account" data-testid="select-edit-payment-account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {paymentAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                      {account.lastFourDigits && ` (****${account.lastFourDigits})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Next Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-edit-due-date"
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" data-testid="button-edit-cancel">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={updateMutation.isPending} data-testid="button-edit-save">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
