import { Card } from "@/components/ui/card";
import { DollarSign, Zap, TrendingUp, Calendar } from "lucide-react";
import { calculateSummaryStats } from "@/lib/analytics";

type SummaryStats = ReturnType<typeof calculateSummaryStats>;

interface OverviewCardsProps {
  summary: SummaryStats;
  currency?: string;
}

export function OverviewCards({ summary, currency = "USD" }: OverviewCardsProps) {
  const formatMoney = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Cost</p>
            <p className="text-2xl font-bold mt-2">{formatMoney(summary.totalCost)}</p>
          </div>
          <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400 opacity-20" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Tokens</p>
            <p className="text-2xl font-bold mt-2">{(summary.totalTokens / 1000).toFixed(1)}K</p>
          </div>
          <Zap className="w-8 h-8 text-emerald-600 dark:text-emerald-400 opacity-20" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Avg Daily Cost</p>
            <p className="text-2xl font-bold mt-2">{formatMoney(summary.avgDailyCost)}</p>
          </div>
          <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400 opacity-20" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Date Range</p>
            <p className="text-2xl font-bold mt-2">{summary.dayCount} days</p>
          </div>
          <Calendar className="w-8 h-8 text-orange-600 dark:text-orange-400 opacity-20" />
        </div>
      </Card>
    </div>
  );
}
