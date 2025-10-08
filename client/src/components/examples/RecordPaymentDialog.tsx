import RecordPaymentDialog from "../RecordPaymentDialog";

export default function RecordPaymentDialogExample() {
  return (
    <div className="p-6 bg-background">
      <RecordPaymentDialog 
        expenseId="TFJ-NFLX-001"
        scheduledAmount={15.99}
      />
    </div>
  );
}
