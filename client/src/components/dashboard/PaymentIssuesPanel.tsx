import {
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  Clock3,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/expense-analytics";

export type IssueType = "overdue" | "underpaid" | "overpaid" | "late";

export interface PaymentIssue {
  scheduleId: string;
  type: IssueType;
  vendorName: string;
  expenseId: string;
  companyName?: string;
  amount: number;
  detail: string;
}

const TYPE_META: Record<
  IssueType,
  { label: string; variant: "destructive" | "secondary" | "outline"; Icon: typeof AlertCircle }
> = {
  overdue: { label: "Overdue", variant: "destructive", Icon: AlertCircle },
  late: { label: "Late Payment", variant: "outline", Icon: Clock3 },
  underpaid: { label: "Underpaid", variant: "secondary", Icon: ArrowUpRight },
  overpaid: { label: "Overpaid", variant: "outline", Icon: TrendingUp },
};

interface PaymentIssuesPanelProps {
  issues: PaymentIssue[];
  onSelect?: (scheduleId: string) => void;
}

export default function PaymentIssuesPanel({ issues, onSelect }: PaymentIssuesPanelProps) {
  return (
    <Card data-testid="card-payment-issues">
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Payment Issues</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Overdue, late, underpaid, or overpaid items needing attention
            </CardDescription>
          </div>
          <Badge
            variant={issues.length > 0 ? "destructive" : "outline"}
            className="flex items-center gap-1.5"
            data-testid="badge-issue-count"
          >
            {issues.length > 0 ? (
              <XCircle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {issues.length} {issues.length === 1 ? "issue" : "issues"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center"
            data-testid="text-no-issues"
          >
            <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs text-muted-foreground">
              No payment issues detected
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => {
              const meta = TYPE_META[issue.type];
              const { Icon } = meta;
              return (
                <div
                  key={`${issue.scheduleId}-${issue.type}`}
                  className={`rounded-lg border p-4 hover-elevate ${
                    onSelect ? "cursor-pointer" : ""
                  }`}
                  data-testid={`issue-${issue.scheduleId}-${issue.type}`}
                  role={onSelect ? "button" : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  onClick={() => onSelect?.(issue.scheduleId)}
                  onKeyDown={
                    onSelect
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(issue.scheduleId);
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={meta.variant} className="flex items-center gap-1">
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                        <span className="font-semibold">{issue.vendorName}</span>
                        <span className="text-sm text-muted-foreground font-mono">
                          {issue.expenseId}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5">
                        {issue.companyName ?? "Unknown company"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Scheduled</p>
                      <p className="font-mono text-base font-bold">
                        {formatCurrency(issue.amount)}
                      </p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{issue.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
