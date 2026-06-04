import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
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
  type TrendPoint,
} from "@/lib/expense-analytics";

const config = {
  total: { label: "Paid", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

interface SpendTrendChartProps {
  data: TrendPoint[];
}

export default function SpendTrendChart({ data }: SpendTrendChartProps) {
  const total = data.reduce((sum, point) => sum + point.total, 0);
  const hasData = total > 0;

  return (
    <Card data-testid="card-spend-trend">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Spending Trend</CardTitle>
        </div>
        <CardDescription>
          Actual payments recorded over the last {data.length} months
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={config} className="aspect-[16/6] w-full">
            <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
              <defs>
                <linearGradient id="fillSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-total)"
                    stopOpacity={0.7}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-total)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
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
              <Area
                dataKey="total"
                type="monotone"
                fill="url(#fillSpend)"
                stroke="var(--color-total)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex aspect-[16/6] flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No payments recorded yet</p>
            <p className="text-xs text-muted-foreground">
              Recorded payments will appear here as a monthly trend
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
