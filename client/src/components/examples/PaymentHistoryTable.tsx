import PaymentHistoryTable from "../PaymentHistoryTable";

export default function PaymentHistoryTableExample() {
  const mockPayments = [
    {
      id: "1",
      date: new Date("2024-01-15"),
      company: "Netflix",
      amount: 15.99,
      payer: "John Doe",
      method: "credit-card",
      account: "**** 1234",
      hasConfirmation: true,
      confirmationFile: "confirmation-1.pdf",
      hasApproval: true,
      approvalFile: "approval-1.png",
      scheduledDueDate: new Date("2024-01-10"),
      daysLate: 5,
    },
    {
      id: "2",
      date: new Date("2024-01-10"),
      company: "Spotify",
      amount: 9.99,
      payer: "Jane Smith",
      method: "paypal",
      hasConfirmation: false,
      hasApproval: false,
      scheduledDueDate: new Date("2024-01-10"),
      daysLate: 0,
    },
  ];

  return (
    <div className="p-6 bg-background">
      <PaymentHistoryTable payments={mockPayments} />
    </div>
  );
}
