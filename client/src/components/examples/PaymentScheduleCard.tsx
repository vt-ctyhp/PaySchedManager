import PaymentScheduleCard from "../PaymentScheduleCard";

export default function PaymentScheduleCardExample() {
  return (
    <div className="p-6 bg-background">
      <div className="max-w-sm">
        <PaymentScheduleCard
          id="1"
          company="Netflix"
          amount={15.99}
          dueDate={new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)}
          frequency="monthly"
          status="due-soon"
          onEdit={(id) => console.log("Edit", id)}
          onDelete={(id) => console.log("Delete", id)}
          onRecordPayment={(id) => console.log("Record payment", id)}
        />
      </div>
    </div>
  );
}
