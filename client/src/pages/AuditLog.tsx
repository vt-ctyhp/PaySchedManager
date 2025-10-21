import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PaymentRecordAudit } from "@shared/schema";
import { format } from "date-fns";

export default function AuditLog() {
  const { data: audits = [], isLoading } = useQuery<PaymentRecordAudit[]>({
    queryKey: ["/api/payment-record-audits"],
  });

  const sortedAudits = useMemo(() => {
    return audits
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [audits]);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Audit Ledger</CardTitle>
            <CardDescription>
              Historical edits and deletions to payment records with reasons.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading audits…</p>
            ) : sortedAudits.length === 0 ? (
              <p className="text-muted-foreground">No audit entries yet.</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Performed By</TableHead>
                      <TableHead>Snapshots</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAudits.map((audit) => (
                      <TableRow key={audit.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(audit.createdAt), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={audit.action === "delete" ? "destructive" : "secondary"}
                          >
                            {audit.action === "delete" ? "Deleted" : "Edited"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {audit.paymentRecordId}
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {audit.reason}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {audit.performedBy}
                        </TableCell>
                        <TableCell className="text-sm">
                          <details>
                            <summary className="cursor-pointer text-primary">
                              View snapshots
                            </summary>
                            <div className="mt-2 space-y-2 text-xs">
                              <div>
                                <p className="font-medium">Before</p>
                                <pre className="bg-muted/60 rounded-md p-2 whitespace-pre-wrap break-all">
                                  {JSON.stringify(audit.beforeSnapshot, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="font-medium">After</p>
                                <pre className="bg-muted/60 rounded-md p-2 whitespace-pre-wrap break-all">
                                  {audit.afterSnapshot
                                    ? JSON.stringify(audit.afterSnapshot, null, 2)
                                    : "(deleted)"}
                                </pre>
                              </div>
                            </div>
                          </details>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
