import PaymentHistoryTable from "../PaymentHistoryTable";
import type { PaymentRecord as PaymentRecordModel, PaymentAccount } from "@shared/schema";

const mockAccount: PaymentAccount = {
  id: "account-1",
  name: "TFJ Chase CC 1234",
  accountType: "Credit Card",
  accountTypeCode: "CC",
  internalCompanyId: "company-1",
  bankId: "bank-1",
  lastFourDigits: "1234",
};

function createRecord(overrides: Partial<PaymentRecordModel>): PaymentRecordModel {
  return {
    id: "",
    paymentScheduleId: null,
    expenseId: "EXP-000",
    internalCompanyId: "company-1",
    paymentDate: new Date(),
    amount: "0",
    paidBy: "user-1",
    approvedBy: null,
    paymentMethod: "credit-card",
    paymentAccountId: mockAccount.id,
    confirmationFile: null,
    approvalScreenshot: null,
    scheduledDueDate: null,
    daysLate: 0,
    createdAt: new Date(),
    ...overrides,
  } as PaymentRecordModel;
}

export default function PaymentHistoryTableExample() {
  const mockPayments = [
    {
      id: "1",
      date: new Date("2024-01-15"),
      company: "Netflix",
      amount: 15.99,
      payer: "John Doe",
      method: "credit-card",
      account: "Chase Business Card (****1234)",
      hasConfirmation: true,
      confirmationFile: "confirmation-1.pdf",
      hasApproval: true,
      approvalFile: "approval-1.png",
      scheduledDueDate: new Date("2024-01-10"),
      daysLate: 5,
      paymentAccountId: mockAccount.id,
      rawRecord: createRecord({
        id: "1",
        paymentDate: new Date("2024-01-15"),
        amount: "15.99",
        confirmationFile: "confirmation-1.pdf",
        approvalScreenshot: "approval-1.png",
        scheduledDueDate: new Date("2024-01-10"),
        daysLate: 5,
      }),
    },
    {
      id: "2",
      date: new Date("2024-01-10"),
      company: "Spotify",
      amount: 9.99,
      payer: "Jane Smith",
      method: "paypal",
      account: "—",
      hasConfirmation: false,
      hasApproval: false,
      scheduledDueDate: new Date("2024-01-10"),
      daysLate: 0,
      paymentAccountId: null,
      rawRecord: createRecord({
        id: "2",
        paymentDate: new Date("2024-01-10"),
        amount: "9.99",
        paymentMethod: "paypal",
        paymentAccountId: null,
        scheduledDueDate: new Date("2024-01-10"),
        daysLate: 0,
      }),
    },
  ];

  return (
    <div className="p-6 bg-background">
      <PaymentHistoryTable
        payments={mockPayments}
        paymentAccounts={[mockAccount]}
        expenseTypes={[]}
        approvers={[{ id: "user-1", username: "John Doe" }]}
      />
    </div>
  );
}
