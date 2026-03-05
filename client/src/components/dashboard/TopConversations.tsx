import { ConversationStats } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";

interface TopConversationsProps {
  conversations: ConversationStats[];
}

export function TopConversations({ conversations }: TopConversationsProps) {
  if (conversations.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No conversations yet</div>;
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv, idx) => (
        <div key={conv.conversationId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
              <Badge variant="outline" className="text-xs">
                {conv.provider}
              </Badge>
            </div>
            <p className="text-sm font-medium truncate">{conv.model}</p>
            <p className="text-xs text-muted-foreground">
              {(conv.totalTokens / 1000).toFixed(1)}K tokens
            </p>
          </div>
          <div className="text-right ml-4">
            <p className="font-semibold text-sm">${conv.totalCost.toFixed(3)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
