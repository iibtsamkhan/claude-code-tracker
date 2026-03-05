import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ProviderStats } from "@/lib/analytics";

interface ProviderBreakdownProps {
  providers: ProviderStats[];
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function ProviderBreakdown({ providers }: ProviderBreakdownProps) {
  const pieData = providers.map(p => ({
    name: p.provider,
    value: p.totalCost,
  }));

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Cost by Provider</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Tokens by Provider</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={providers.map(p => ({
                name: p.provider,
                tokens: Math.round(p.totalTokens / 1000),
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" label={{ value: "Tokens (K)", angle: -90, position: "insideLeft" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: `1px solid var(--border)`,
                }}
                formatter={(value) => `${value}K`}
              />
              <Bar dataKey="tokens" fill="var(--chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Provider Details */}
      {providers.map((provider) => (
        <Card key={provider.provider} className="p-6">
          <h3 className="font-semibold mb-4 capitalize">{provider.provider} Models</h3>
          <div className="space-y-3">
            {provider.models.map((model) => (
              <div key={model.model} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{model.model}</p>
                  <p className="text-xs text-muted-foreground">
                    {model.entries} calls • {(model.totalTokens / 1000).toFixed(1)}K tokens
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${model.totalCost.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">${(model.costPerToken * 1000000).toFixed(2)}/M tokens</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
