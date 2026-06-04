import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatCurrency,
  formatCurrencyCompact,
  type ForecastBucket,
} from "@/lib/expense-analytics";

const config = {
  total: { label: "Projected", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

interface ExpenseForecastChartProps {
  data: ForecastBucket[];
  onSelectMonth?: (bucket: ForecastBucket) => void;
}

export default function ExpenseForecastChart({
  data,
  onSelectMonth,
}: ExpenseForecastChartProps) {
  const total = data.reduce((sum, bucket) => sum + bucket.total, 0);
  const hasData = total > 0;

  const handleBarClick = (payload: unknown) => {
    if (!onSelectMonth) return;
    const entry = payload as { payload?: ForecastBucket } & Partial<ForecastBucket>;
    const bucket = (entry?.payload ?? entry) as ForecastBucket;
    if (bucket && bucket.monthStart) onSelectMonth(bucket);
  };

  return (
    <Card data-testid="card-forecast">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <CardTitle>Upcoming Expense Forecast</CardTitle>
        </div>
        <CardDescription>
          Projected obligations across the next {data.length} months, including
          recurring payments —{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(total)}
          </span>{" "}
          total{onSelectMonth ? " · click a month to drill in" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={config} className="aspect-[16/7] w-full">
            <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value) => formatCurrencyCompact(Number(value))}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-medium">
                          {formatCurrency(Number(value))}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item?.payload?.count ?? 0} payment
                          {item?.payload?.count === 1 ? "" : "s"}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="total"
                fill="var(--color-total)"
                radius={[4, 4, 0, 0]}
                onClick={handleBarClick}
                cursor={onSelectMonth ? "pointer" : undefined}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex aspect-[16/7] flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <CalendarClock className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No upcoming payments projected</p>
            <p className="text-xs text-muted-foreground">
              Scheduled payments will appear here as a monthly forecast
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
