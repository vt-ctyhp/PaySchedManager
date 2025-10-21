import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Upload } from "lucide-react";
import { format } from "date-fns";
import ManagePaymentFilesDialog from "@/components/ManagePaymentFilesDialog";
import EditPaymentRecordDialog from "@/components/EditPaymentRecordDialog";
import DeletePaymentRecordDialog from "@/components/DeletePaymentRecordDialog";
import type { PaymentAccount, PaymentRecord as PaymentRecordModel } from "@shared/schema";

interface PaymentHistoryRow {
  id: string;
  date: Date;
  company: string;
  amount: number;
  payer: string;
  method: string;
  account?: string;
  hasConfirmation: boolean;
  confirmationFile?: string | null;
  scheduledDueDate?: Date;
  daysLate?: number;
  hasApproval: boolean;
  approvalFile?: string | null;
  paymentAccountId: string | null;
  rawRecord: PaymentRecordModel;
}

interface PaymentHistoryTableProps {
  payments: PaymentHistoryRow[];
  paymentAccounts: PaymentAccount[];
  approvers: { id: string; username: string }[];
}

const methodColors: Record<string, string> = {
  "credit-card": "bg-chart-1 text-white",
  "debit-card": "bg-chart-2 text-white",
  "bank-transfer": "bg-chart-3 text-white",
  cash: "bg-chart-5 text-white",
  paypal: "bg-primary text-white",
  other: "bg-muted text-foreground",
};

const methodLabels: Record<string, string> = {
  "credit-card": "Credit Card",
  "debit-card": "Debit Card",
  "bank-transfer": "Bank Transfer",
  cash: "Cash",
  paypal: "PayPal",
  other: "Other",
};

export default function PaymentHistoryTable({
  payments,
  paymentAccounts,
  approvers,
}: PaymentHistoryTableProps) {
  const handleDownload = (filename: string) => {
    window.open(`/api/files/${filename}`, '_blank');
  };

  const [managedPayment, setManagedPayment] = useState<PaymentHistoryRow | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryRow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<PaymentHistoryRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const openManageDialog = (payment: PaymentHistoryRow) => {
    setManagedPayment(payment);
    setManageDialogOpen(true);
  };

  const closeManageDialog = () => {
    setManageDialogOpen(false);
    setManagedPayment(null);
  };

  const openEditDialog = (payment: PaymentHistoryRow) => {
    setEditingPayment(payment);
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingPayment(null);
  };

  const openDeleteDialog = (payment: PaymentHistoryRow) => {
    setDeletingPayment(payment);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeletingPayment(null);
  };

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Timing</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Confirmation</TableHead>
              <TableHead className="text-right">Approval</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No payment records found
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                  <TableCell className="font-mono text-sm" data-testid={`text-date-${payment.id}`}>
                    {format(payment.date, "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-company-${payment.id}`}>
                    {payment.company}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold" data-testid={`text-amount-${payment.id}`}>
                    ${payment.amount.toFixed(2)}
                  </TableCell>
                  <TableCell data-testid={`text-payer-${payment.id}`}>{payment.payer}</TableCell>
                  <TableCell>
                    <Badge 
                      className={methodColors[payment.method] || methodColors.other}
                      data-testid={`badge-method-${payment.id}`}
                    >
                      {methodLabels[payment.method] || payment.method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {payment.daysLate && payment.daysLate > 0 ? (
                      <Badge variant="destructive" data-testid={`badge-late-${payment.id}`}>
                        {payment.daysLate} day{payment.daysLate === 1 ? "" : "s"} late
                        {payment.scheduledDueDate && (
                          <span className="ml-1 text-xs text-destructive-foreground/80">
                            (due {format(payment.scheduledDueDate, "MMM dd")})
                          </span>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" data-testid={`badge-on-time-${payment.id}`}>
                        On time
                        {payment.scheduledDueDate && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (due {format(payment.scheduledDueDate, "MMM dd")})
                          </span>
                        )}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm" data-testid={`text-account-${payment.id}`}>
                    {payment.account || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {payment.hasConfirmation && payment.confirmationFile ? (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleDownload(payment.confirmationFile!)}
                        data-testid={`button-download-confirmation-${payment.id}`}
                        aria-label="Download confirmation"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground inline-block" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {payment.hasApproval && payment.approvalFile ? (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleDownload(payment.approvalFile!)}
                        data-testid={`button-download-approval-${payment.id}`}
                        aria-label="Download approval"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground inline-block" />
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openManageDialog(payment)}
                      data-testid={`button-manage-files-${payment.id}`}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Files
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(payment)}
                      data-testid={`button-edit-payment-${payment.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openDeleteDialog(payment)}
                      data-testid={`button-delete-payment-${payment.id}`}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {managedPayment && (
        <ManagePaymentFilesDialog
          open={manageDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeManageDialog();
            } else {
              setManageDialogOpen(true);
            }
          }}
          paymentId={managedPayment.id}
          hasConfirmation={managedPayment.hasConfirmation}
          hasApproval={managedPayment.hasApproval}
        />
      )}

      {editingPayment && (
        <EditPaymentRecordDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeEditDialog();
            } else {
              setEditDialogOpen(true);
            }
          }}
          payment={editingPayment.rawRecord}
          displayAmount={editingPayment.amount}
          displayDate={editingPayment.date}
          paymentAccounts={paymentAccounts}
          approvers={approvers}
        />
      )}

      {deletingPayment && (
        <DeletePaymentRecordDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeDeleteDialog();
            } else {
              setDeleteDialogOpen(true);
            }
          }}
          payment={deletingPayment.rawRecord}
        />
      )}
    </>
  );
}
