import { useMemo, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatCurrency,
  type BreakdownSlice,
} from "@/lib/expense-analytics";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const MAX_SLICES = 6;

type Dimension = "type" | "company" | "account";

const DIMENSION_LABELS: Record<Dimension, string> = {
  type: "Type",
  company: "Company",
  account: "Account",
};

interface ExpenseBreakdownChartProps {
  byType: BreakdownSlice[];
  byCompany: BreakdownSlice[];
  byAccount: BreakdownSlice[];
}

/** Collapse a long tail of small slices into a single "Other" slice. */
function collapse(slices: BreakdownSlice[]): BreakdownSlice[] {
  if (slices.length <= MAX_SLICES) return slices;
  const head = slices.slice(0, MAX_SLICES - 1);
  const tail = slices.slice(MAX_SLICES - 1);
  const other: BreakdownSlice = {
    key: "__other__",
    label: `Other (${tail.length})`,
    value: tail.reduce((sum, s) => sum + s.value, 0),
    count: tail.reduce((sum, s) => sum + s.count, 0),
  };
  return [...head, other];
}

export default function ExpenseBreakdownChart({
  byType,
  byCompany,
  byAccount,
}: ExpenseBreakdownChartProps) {
  const [dimension, setDimension] = useState<Dimension>("type");

  const source =
    dimension === "type" ? byType : dimension === "company" ? byCompany : byAccount;
  const slices = useMemo(() => collapse(source), [source]);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const config = useMemo(() => {
    const c: ChartConfig = {};
    slices.forEach((slice, i) => {
      c[slice.key] = {
        label: slice.label,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });
    return c;
  }, [slices]);

  return (
    <Card data-testid="card-breakdown" className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-primary" />
              <CardTitle>Expense Breakdown</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Active scheduled amounts by {DIMENSION_LABELS[dimension].toLowerCase()}
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            value={dimension}
            onValueChange={(value) => value && setDimension(value as Dimension)}
            size="sm"
          >
            {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((dim) => (
              <ToggleGroupItem
                key={dim}
                value={dim}
                className="px-3"
                data-testid={`toggle-breakdown-${dim}`}
              >
                {DIMENSION_LABELS[dim]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
        {total > 0 ? (
          <>
            <ChartContainer
              config={config}
              className="mx-auto aspect-square h-[200px]"
            >
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono font-medium">
                            {formatCurrency(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={85}
                  strokeWidth={2}
                  paddingAngle={2}
                >
                  {slices.map((slice, i) => (
                    <Cell
                      key={slice.key}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex-1 space-y-2" data-testid="breakdown-legend">
              {slices.map((slice, i) => {
                const pct = total > 0 ? (slice.value / total) * 100 : 0;
                return (
                  <li
                    key={slice.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate" title={slice.label}>
                      {slice.label}
                    </span>
                    <span className="font-mono font-medium">
                      {formatCurrency(slice.value)}
                    </span>
                    <span className="w-10 text-right text-xs text-muted-foreground">
                      {pct.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <PieIcon className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No active schedules</p>
            <p className="text-xs text-muted-foreground">
              Add payment schedules to see the breakdown
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
