import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DailyStats } from "@/lib/analytics";

interface CostChartProps {
  data: DailyStats[];
}

export function CostChart({ data }: CostChartProps) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-muted-foreground">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          stroke="var(--muted-foreground)"
          style={{ fontSize: "12px" }}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          style={{ fontSize: "12px" }}
          label={{ value: "Cost ($)", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: `1px solid var(--border)`,
            borderRadius: "8px",
          }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(value) => `$${Number(value).toFixed(2)}`}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="totalCost"
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={false}
          name="Daily Cost"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
