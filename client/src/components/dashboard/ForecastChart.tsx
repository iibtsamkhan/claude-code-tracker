import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { DailyStats, ForecastData } from "@/lib/analytics";

interface ForecastChartProps {
  forecast: ForecastData[];
  historical: DailyStats[];
}

export function ForecastChart({ forecast, historical }: ForecastChartProps) {
  // Combine historical and forecast data
  const combinedData = [
    ...historical.map(d => ({
      date: d.date,
      actual: d.totalCost,
      type: 'historical' as const,
    })),
    ...forecast.map(f => ({
      date: f.date,
      projected: f.projected,
      type: 'forecast' as const,
    })),
  ];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={combinedData}>
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
          dataKey="actual"
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={false}
          name="Historical"
        />
        <Line
          type="monotone"
          dataKey="projected"
          stroke="var(--chart-3)"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          name="Forecast"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
