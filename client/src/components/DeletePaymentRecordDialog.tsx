import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentRecord } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface DeletePaymentRecordDialogProps {
  payment: PaymentRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeletePaymentRecordDialog({
  payment,
  open,
  onOpenChange,
}: DeletePaymentRecordDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        throw new Error("Reason is required.");
      }

      const response = await fetch(`/api/payment-records/${payment.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ reason: trimmedReason }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to delete payment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-records"] });
      toast({ title: "Payment deleted" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete payment",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Payment</DialogTitle>
          <DialogDescription>
            Provide a reason for deleting this payment record. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-md text-sm">
            <p className="font-medium">Payment ID: {payment.id}</p>
            <p className="text-muted-foreground">Expense ID: {payment.expenseId}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-reason">Reason</Label>
            <Textarea
              id="delete-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder="Explain why this record is being deleted"
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
            <Button
              variant="destructive"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
