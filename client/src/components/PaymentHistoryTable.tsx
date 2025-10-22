import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Upload, FileSpreadsheet, FileDown } from "lucide-react";
import { format } from "date-fns";
import ManagePaymentFilesDialog from "@/components/ManagePaymentFilesDialog";
import EditPaymentRecordDialog from "@/components/EditPaymentRecordDialog";
import DeletePaymentRecordDialog from "@/components/DeletePaymentRecordDialog";
import type { PaymentAccount, PaymentRecord as PaymentRecordModel } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

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

  const { toast } = useToast();
  const [managedPayment, setManagedPayment] = useState<PaymentHistoryRow | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryRow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<PaymentHistoryRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const hasPayments = payments.length > 0;

  const getTimingLabel = (payment: PaymentHistoryRow) => {
    if (payment.daysLate && payment.daysLate > 0) {
      const due = payment.scheduledDueDate ? ` (due ${format(payment.scheduledDueDate, "MMM dd, yyyy")})` : "";
      return `${payment.daysLate} day${payment.daysLate === 1 ? "" : "s"} late${due}`;
    }
    if (payment.scheduledDueDate) {
      return `On time (due ${format(payment.scheduledDueDate, "MMM dd, yyyy")})`;
    }
    return "On time";
  };

  const createExportRows = () =>
    payments.map((payment) => [
      format(payment.date, "MMM dd, yyyy"),
      payment.company,
      `$${payment.amount.toFixed(2)}`,
      payment.payer,
      methodLabels[payment.method] || payment.method,
      payment.account || "Unassigned",
      getTimingLabel(payment),
      payment.hasConfirmation ? "Yes" : "No",
      payment.hasApproval ? "Yes" : "No",
    ]);

  const handleExportCSV = () => {
    if (!hasPayments) {
      toast({
        title: "No payment records to export",
        description: "Add payment records before exporting.",
      });
      return;
    }

    try {
      const headers = [
        "Date",
        "Company",
        "Amount",
        "Payer",
        "Method",
        "Account",
        "Timing",
        "Confirmation",
        "Approval",
      ];

      const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const rows = createExportRows();
      const csvLines = [headers, ...rows].map((row) =>
        row.map(escapeCsv).join(","),
      );
      const csvContent = csvLines.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `payment-history-${format(new Date(), "yyyy-MM-dd")}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "CSV export created" });
    } catch (error: any) {
      toast({
        title: "Failed to export CSV",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async () => {
    if (!hasPayments) {
      toast({
        title: "No payment records to export",
        description: "Add payment records before exporting.",
      });
      return;
    }

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = typeof autoTableModule.default === "function"
        ? autoTableModule.default
        : autoTableModule;

      if (typeof autoTable !== "function") {
        throw new Error("PDF export module is unavailable.");
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "letter",
      });

      const tableHeader = [
        "Date",
        "Company",
        "Amount",
        "Payer",
        "Method",
        "Account",
        "Timing",
        "Confirmation",
        "Approval",
      ];
      const tableRows = createExportRows();

      doc.setFontSize(20);
      doc.text("Payment History", 40, 50);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated ${format(new Date(), "PPpp")}`, 40, 70);

      autoTable(doc, {
        head: [tableHeader],
        body: tableRows,
        startY: 90,
        styles: {
          fontSize: 10,
          cellPadding: 6,
          lineColor: [225, 225, 225],
        },
        headStyles: {
          fillColor: [41, 70, 147],
          textColor: 255,
          fontSize: 11,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: {
          2: { halign: "right" },
          7: { halign: "center" },
          8: { halign: "center" },
        },
        didDrawPage: () => {
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          doc.setFontSize(10);
          doc.setTextColor(120);
          doc.text(
            `Page ${doc.getNumberOfPages()}`,
            pageWidth - 80,
            pageHeight - 20,
          );
        },
      });

      doc.save(`payment-history-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF export created" });
    } catch (error: any) {
      toast({
        title: "Failed to export PDF",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

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
      <div className="flex justify-end gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          data-testid="button-export-csv"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleExportPDF()}
          data-testid="button-export-pdf"
        >
          <FileDown className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>
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
