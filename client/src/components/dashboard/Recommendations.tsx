import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingDown } from "lucide-react";
import { OptimizationRecommendation } from "@/lib/analytics";

interface RecommationsProps {
  recommendations: OptimizationRecommendation[];
}

export function Recommendations({ recommendations }: RecommationsProps) {
  if (recommendations.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Lightbulb className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No optimization opportunities found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <Card key={rec.id} className="p-6 border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{rec.title}</h3>
                <Badge
                  variant="outline"
                  className={
                    rec.priority === 'high'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : rec.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }
                >
                  {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
              <div className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400">
                <TrendingDown className="w-4 h-4" />
                Potential Savings: ${rec.potentialSavings.toFixed(2)}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
