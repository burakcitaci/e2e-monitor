import { useEffect, useRef } from 'react';
import type { TranscriptTurn } from '../hooks/useConversation';

export function ChatTranscript({
  turns,
  pending,
}: {
  turns: TranscriptTurn[];
  pending: boolean;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [turns.length, pending]);
  return (
    <div
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      className="space-y-4 max-h-[50vh] overflow-y-auto rounded-lg border p-4"
    >
      {turns.map((turn) => (
        <article
          key={turn.id}
          className={turn.role === 'user' ? 'rounded-md bg-muted p-3' : 'p-3'}
        >
          <p className="text-xs font-semibold text-muted-foreground">
            {turn.role === 'user' ? 'You' : 'Assistant'}
          </p>
          <p className="whitespace-pre-wrap break-words">{turn.content}</p>
        </article>
      ))}
      {pending && <p role="status">Working…</p>}
      <div ref={bottom} />
    </div>
  );
}
