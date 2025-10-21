import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface ManagePaymentFilesDialogProps {
  paymentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasConfirmation: boolean;
  hasApproval: boolean;
}

export default function ManagePaymentFilesDialog({
  paymentId,
  open,
  onOpenChange,
  hasConfirmation,
  hasApproval,
}: ManagePaymentFilesDialogProps) {
  const { toast } = useToast();
  const [confirmationFile, setConfirmationFile] = useState<File | null>(null);
  const [approvalFile, setApprovalFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmationFile(null);
      setApprovalFile(null);
      setReason("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!confirmationFile && !approvalFile) {
        throw new Error("Please select a file to upload.");
      }

      if (!reason.trim()) {
        throw new Error("Reason is required.");
      }

      const formData = new FormData();
      if (confirmationFile) {
        formData.append("confirmationFile", confirmationFile);
      }
      if (approvalFile) {
        formData.append("approvalScreenshot", approvalFile);
      }
      formData.append("reason", reason.trim());

      const response = await fetch(`/api/payment-records/${paymentId}/files`, {
        method: "PUT",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to update files");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-records"] });
      toast({ title: "Files updated successfully" });
      setConfirmationFile(null);
      setApprovalFile(null);
      setReason("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Payment Files</DialogTitle>
          <DialogDescription>
            Upload or replace supporting documents for this payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for update</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Provide context for updating these files"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation-upload">
              Confirmation File{" "}
              {hasConfirmation && (
                <span className="text-xs text-muted-foreground">(existing)</span>
              )}
            </Label>
            <Input
              id="confirmation-upload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(event) =>
                setConfirmationFile(event.target.files?.[0] ?? null)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="approval-upload">
              Approval Screenshot{" "}
              {hasApproval && (
                <span className="text-xs text-muted-foreground">(existing)</span>
              )}
            </Label>
            <Input
              id="approval-upload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(event) =>
                setApprovalFile(event.target.files?.[0] ?? null)
              }
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
              {mutation.isPending ? "Uploading..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
