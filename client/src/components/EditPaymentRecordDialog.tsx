import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentAccount, PaymentRecord } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface EditPaymentRecordDialogProps {
  payment: PaymentRecord;
  displayAmount: number;
  displayDate: Date;
  paymentAccounts: PaymentAccount[];
  approvers: { id: string; username: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_METHOD_OPTIONS = [
  "credit-card",
  "debit-card",
  "bank-transfer",
  "cash",
  "paypal",
  "ach",
  "wire",
  "other",
];

export default function EditPaymentRecordDialog({
  payment,
  displayAmount,
  displayDate,
  paymentAccounts,
  approvers,
  open,
  onOpenChange,
}: EditPaymentRecordDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>(displayAmount.toFixed(2));
  const [paymentDate, setPaymentDate] = useState<string>(format(displayDate, "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState<string>(payment.paymentMethod);
  const [paymentAccountId, setPaymentAccountId] = useState<string>(payment.paymentAccountId ?? "");
  const [approvedBy, setApprovedBy] = useState<string>(payment.approvedBy ?? "");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (open) {
      setAmount(displayAmount.toFixed(2));
      setPaymentDate(format(displayDate, "yyyy-MM-dd"));
      setPaymentMethod(payment.paymentMethod);
      setPaymentAccountId(payment.paymentAccountId ?? "");
      setApprovedBy(payment.approvedBy ?? "");
      setReason("");
    }
  }, [open, payment, displayAmount, displayDate]);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        throw new Error("Reason is required.");
      }

      const numericAmount = Number.parseFloat(amount);
      if (Number.isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Enter a valid amount.");
      }

      if (!paymentDate) {
        throw new Error("Payment date is required.");
      }

      const payload: Record<string, unknown> = {
        reason: trimmedReason,
        amount: numericAmount.toFixed(2),
        paymentDate: new Date(paymentDate).toISOString(),
        paymentMethod,
        paymentAccountId: paymentAccountId || null,
        approvedBy: approvedBy || null,
      };

      const response = await fetch(`/api/payment-records/${payment.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to update payment");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-records"] });
      toast({ title: "Payment updated" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update payment",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const approverOptions = useMemo(() => approvers ?? [], [approvers]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
          <DialogDescription>
            Update payment details and provide a reason for the change.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-payment-amount">Amount</Label>
            <Input
              id="edit-payment-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-payment-date">Payment Date</Label>
            <Input
              id="edit-payment-date"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.replace(/-/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Payment Account</Label>
            <Select
              value={paymentAccountId}
              onValueChange={setPaymentAccountId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {paymentAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                    {account.lastFourDigits ? ` (****${account.lastFourDigits})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Approved By</Label>
            <Select value={approvedBy} onValueChange={setApprovedBy}>
              <SelectTrigger>
                <SelectValue placeholder="Select approver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {approverOptions.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-payment-reason">Reason</Label>
            <Textarea
              id="edit-payment-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Explain why this payment is being edited"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
