"use client";

type ThoughtChatMessage = {
  id: string;
  side: "p1" | "p2" | "system";
  speaker: string;
  content: string;
  meta?: string;
  pending?: boolean;
};

export function AgentThoughtChat({
  messages,
  emptyMessage,
}: {
  messages: ThoughtChatMessage[];
  emptyMessage: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center rounded-xl border border-dashed bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {messages.map((message) => {
          const align =
            message.side === "p1"
              ? "items-end"
              : message.side === "p2"
                ? "items-start"
                : "items-center";
          const bubble =
            message.side === "p1"
              ? "bg-card border-border text-foreground"
              : message.side === "p2"
                ? "bg-card border-border text-foreground"
                : "bg-muted/20 border-border text-foreground";
          const pendingBubble = message.pending ? "border-dashed opacity-80" : "";
          const speakerTone = "text-muted-foreground";

          return (
            <div key={message.id} className={`flex flex-col ${align}`}>
              <div className={`mb-1 text-xs font-medium ${speakerTone}`}>
                {message.speaker}
              </div>
              <div className={`max-w-[92%] rounded-xl border px-4 py-3 text-sm ${bubble} ${pendingBubble}`}>
                <div className={message.pending ? "animate-pulse" : ""}>{message.content}</div>
                {message.meta ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {message.meta}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { ThoughtChatMessage };
