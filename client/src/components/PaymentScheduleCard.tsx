import { Calendar, DollarSign, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

type PaymentStatus = "paid" | "due-soon" | "overdue" | "scheduled";
type PaymentFrequency = "one-time" | "bi-weekly" | "monthly" | "quarterly" | "yearly";

interface PaymentScheduleCardProps {
  id: string;
  company: string;
  expenseId?: string;
  amount: number;
  dueDate: Date;
  frequency: PaymentFrequency;
  status: PaymentStatus;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRecordPayment?: (id: string) => void;
  canDelete?: boolean;
  inactive?: boolean;
}

const statusConfig = {
  paid: { label: "Paid", color: "bg-chart-2 text-white", icon: "✓" },
  "due-soon": { label: "Due Soon", color: "bg-chart-3 text-white", icon: "⏰" },
  overdue: { label: "Overdue", color: "bg-chart-4 text-white", icon: "!" },
  scheduled: { label: "Scheduled", color: "bg-chart-5 text-white", icon: "📅" },
};

const frequencyLabels = {
  "one-time": "One-time",
  "bi-weekly": "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export default function PaymentScheduleCard({
  id,
  company,
  expenseId,
  amount,
  dueDate,
  frequency,
  status,
  onEdit,
  onDelete,
  onRecordPayment,
  canDelete = true,
  inactive = false,
}: PaymentScheduleCardProps) {
  const config = statusConfig[status];
  const daysUntil = formatDistanceToNow(dueDate, { addSuffix: true });

  return (
    <Card className={`hover-elevate active-elevate-2${inactive ? " opacity-60" : ""}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex-1 min-w-0">
          {expenseId && (
            <p className="text-xs font-mono text-muted-foreground mb-1" data-testid={`text-expense-id-${id}`}>
              {expenseId}
            </p>
          )}
          <h3 className="text-lg font-semibold truncate" data-testid={`text-company-${id}`}>
            {company}
          </h3>
          {inactive ? (
            <Badge variant="outline" className="mt-2" data-testid={`badge-status-${id}`}>
              Inactive
            </Badge>
          ) : (
            <Badge className={`${config.color} mt-2`} data-testid={`badge-status-${id}`}>
              {config.icon} {config.label}
            </Badge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" data-testid={`button-menu-${id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRecordPayment?.(id)} data-testid={`button-record-${id}`}>
              <DollarSign className="h-4 w-4 mr-2" />
              Record Payment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(id)} data-testid={`button-edit-${id}`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem 
                onClick={() => onDelete?.(id)} 
                className="text-destructive"
                data-testid={`button-delete-${id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-mono font-bold" data-testid={`text-amount-${id}`}>
          ${amount.toFixed(2)}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1" data-testid={`text-due-date-${id}`}>
            <Calendar className="h-3.5 w-3.5" />
            <span>{daysUntil}</span>
          </div>
          <Badge variant="outline" data-testid={`badge-frequency-${id}`}>
            {frequencyLabels[frequency]}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
