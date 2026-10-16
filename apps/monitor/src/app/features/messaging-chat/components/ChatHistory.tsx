import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { useChatHistory } from '../api/history';

export function ChatHistory({
  selectedId,
  disabled,
  onSelect,
}: {
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const history = useChatHistory(page, open);
  return (
    <section
      aria-label="Chat history"
      className="space-y-2 rounded-lg border p-3"
    >
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Chat history
      </Button>
      {open && (
        <>
          {history.isFetching && <p role="status">Loading saved chats…</p>}
          {history.error && (
            <div role="alert">
              Could not load history.{' '}
              <Button variant="outline" onClick={() => void history.refetch()}>
                Retry history
              </Button>
            </div>
          )}
          {history.data && (
            <>
              {!history.data.items.length && (
                <p className="text-sm text-muted-foreground">
                  No saved chats yet. Start a conversation to save it here.
                </p>
              )}
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {history.data.items.map((chat) => (
                  <li key={chat.id}>
                    <Button
                      variant={selectedId === chat.id ? 'secondary' : 'ghost'}
                      className="h-auto w-full flex-col items-start whitespace-normal text-left"
                      disabled={disabled}
                      aria-pressed={selectedId === chat.id}
                      onClick={() => onSelect(chat.id)}
                    >
                      <span className="break-words">{chat.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {chat.mode === 'tools'
                          ? 'Tool calling'
                          : 'Structured output'}{' '}
                        · {new Date(chat.updatedAt).toLocaleString()}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || history.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Previous chats
                </Button>
                <span className="text-xs">
                  Page {page} of {history.data.pages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= history.data.pages || history.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  More chats
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
