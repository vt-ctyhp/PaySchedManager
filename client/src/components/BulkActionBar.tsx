import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type {
  ExpenseType,
  InternalCompany,
  PaymentAccount,
} from "@shared/schema";

export type BulkScheduleUpdate = {
  expenseTypeId?: string;
  internalCompanyId?: string;
  paymentAccountId?: string;
};

interface BulkActionBarProps {
  count: number;
  expenseTypes: ExpenseType[];
  companies: InternalCompany[];
  paymentAccounts: PaymentAccount[];
  onClear: () => void;
  onApply: (update: BulkScheduleUpdate) => void;
  isApplying: boolean;
}

export default function BulkActionBar({
  count,
  expenseTypes,
  companies,
  paymentAccounts,
  onClear,
  onApply,
  isApplying,
}: BulkActionBarProps) {
  const [expenseTypeId, setExpenseTypeId] = useState("");
  const [internalCompanyId, setInternalCompanyId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const hasChange = Boolean(
    expenseTypeId || internalCompanyId || paymentAccountId,
  );

  const apply = () => {
    if (!hasChange) return;
    const update: BulkScheduleUpdate = {};
    if (expenseTypeId) update.expenseTypeId = expenseTypeId;
    if (internalCompanyId) update.internalCompanyId = internalCompanyId;
    if (paymentAccountId) update.paymentAccountId = paymentAccountId;
    onApply(update);
  };

  const accountLabel = (a: PaymentAccount) =>
    a.lastFourDigits ? `${a.name} (*${a.lastFourDigits})` : a.name;

  return (
    <div
      className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3 shadow-lg"
      data-testid="bulk-action-bar"
    >
      <span className="text-sm font-medium whitespace-nowrap">
        {count} selected
      </span>
      <Separator orientation="vertical" className="h-6 hidden sm:block" />

      <Select value={expenseTypeId} onValueChange={setExpenseTypeId}>
        <SelectTrigger className="h-9 w-[180px]" data-testid="bulk-select-category">
          <SelectValue placeholder="Set category" />
        </SelectTrigger>
        <SelectContent>
          {expenseTypes.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={internalCompanyId} onValueChange={setInternalCompanyId}>
        <SelectTrigger className="h-9 w-[180px]" data-testid="bulk-select-company">
          <SelectValue placeholder="Set company" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
        <SelectTrigger className="h-9 w-[200px]" data-testid="bulk-select-account">
          <SelectValue placeholder="Set account" />
        </SelectTrigger>
        <SelectContent>
          {paymentAccounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {accountLabel(a)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        onClick={apply}
        disabled={!hasChange || isApplying}
        data-testid="bulk-apply"
      >
        {isApplying ? "Applying..." : "Apply"}
      </Button>
      <Button variant="ghost" onClick={onClear} data-testid="bulk-clear">
        Clear
      </Button>
    </div>
  );
}
