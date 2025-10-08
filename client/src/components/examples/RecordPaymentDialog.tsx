import RecordPaymentDialog from "../RecordPaymentDialog";

export default function RecordPaymentDialogExample() {
  return (
    <div className="p-6 bg-background">
      <RecordPaymentDialog 
        company="Netflix"
        scheduledAmount={15.99}
      />
    </div>
  );
}
