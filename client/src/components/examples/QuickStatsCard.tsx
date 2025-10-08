import QuickStatsCard from "../QuickStatsCard";
import { DollarSign } from "lucide-react";

export default function QuickStatsCardExample() {
  return (
    <div className="p-6 bg-background">
      <div className="max-w-xs">
        <QuickStatsCard
          title="Total Scheduled"
          value="$1,248.50"
          icon={DollarSign}
          description="12 active payments"
        />
      </div>
    </div>
  );
}
