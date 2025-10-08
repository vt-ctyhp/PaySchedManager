import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Upload } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { PaymentSchedule, PaymentAccount, User } from "@shared/schema";

interface RecordPaymentDialogProps {
  trigger?: React.ReactNode;
  scheduleId?: string;
  expenseId?: string;
  scheduledAmount?: number;
}

export default function RecordPaymentDialog({ 
  trigger, 
  scheduleId,
  expenseId: preselectedExpenseId,
  scheduledAmount,
}: RecordPaymentDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date>();
  const [amount, setAmount] = useState(scheduledAmount?.toString() || "");
  const [approvedBy, setApprovedBy] = useState("");
  const [method, setMethod] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState(preselectedExpenseId || "");

  const { data: schedules = [] } = useQuery<PaymentSchedule[]>({
    queryKey: ["/api/payment-schedules"],
  });

  const { data: users = [] } = useQuery<{ id: string; username: string }[]>({
    queryKey: ["/api/users/approvers"],
  });

  const { data: paymentAccounts = [] } = useQuery<PaymentAccount[]>({
    queryKey: ["/api/payment-accounts"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payment-records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-schedules"] });
      toast({ title: "Payment recorded successfully" });
      setOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ 
        title: "Failed to record payment", 
        description: "Please try again",
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setPaymentDate(undefined);
    setAmount(scheduledAmount?.toString() || "");
    setApprovedBy("");
    setMethod("");
    setPaymentAccountId("");
    setFile(null);
    if (!preselectedExpenseId) {
      setSelectedExpenseId("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentDate) {
      toast({ title: "Please select a payment date", variant: "destructive" });
      return;
    }

    const selectedSchedule = schedules.find(s => s.expenseId === selectedExpenseId);

    createMutation.mutate({
      paymentScheduleId: scheduleId || selectedSchedule?.id || null,
      expenseId: selectedExpenseId,
      paymentDate: paymentDate.toISOString(),
      amount,
      approvedBy: approvedBy || null,
      paymentMethod: method,
      paymentAccountId: paymentAccountId || null,
      confirmationFile: file?.name || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" data-testid="button-record-payment">
            Record Payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!preselectedExpenseId && (
            <div className="space-y-2">
              <Label htmlFor="expense-id">Expense ID</Label>
              <Select value={selectedExpenseId} onValueChange={setSelectedExpenseId} required>
                <SelectTrigger id="expense-id" data-testid="select-expense-id">
                  <SelectValue placeholder="Select expense" />
                </SelectTrigger>
                <SelectContent>
                  {schedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.expenseId}>
                      {schedule.expenseId} - {schedule.vendorName} (${schedule.amount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {preselectedExpenseId && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm">
                <span className="font-medium">Expense ID:</span> {preselectedExpenseId}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-payment-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={setPaymentDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                data-testid="input-payment-amount"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approved-by">Approved By</Label>
            <Select value={approvedBy} onValueChange={setApprovedBy}>
              <SelectTrigger id="approved-by" data-testid="select-approved-by">
                <SelectValue placeholder="Select approver (optional)" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={method} onValueChange={setMethod} required>
              <SelectTrigger id="payment-method" data-testid="select-payment-method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit-card">Credit Card</SelectItem>
                <SelectItem value="debit-card">Debit Card</SelectItem>
                <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="ach">ACH</SelectItem>
                <SelectItem value="wire">Wire</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-account">Payment Account</Label>
            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
              <SelectTrigger id="payment-account" data-testid="select-payment-account">
                <SelectValue placeholder="Select account (optional)" />
              </SelectTrigger>
              <SelectContent>
                {paymentAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} {account.lastFourDigits && `(**** ${account.lastFourDigits})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Confirmation File</Label>
            <div className="flex gap-2">
              <Input
                id="file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex-1"
                data-testid="input-file"
              />
              <Button type="button" size="icon" variant="outline">
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            {file && (
              <p className="text-xs text-muted-foreground" data-testid="text-file-name">
                {file.name}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1" data-testid="button-cancel-record">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending} data-testid="button-save-record">
              {createMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
