import { lazy, Suspense, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { MessageCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';

const MessagingChatSheet = lazy(() => import('./MessagingChatSheet'));

export function ChatFloatingAction() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  if (pathname === '/chat') return null;
  return (
    <>
      <Button
        ref={launcher}
        size="icon"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg"
        aria-label="Open Messaging Chat"
        title="Messaging Chat"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        <MessageCircle className="!size-6" />
      </Button>
      {loaded && (
        <Suspense fallback={null}>
          <MessagingChatSheet
            open={open}
            onOpenChange={setOpen}
            onReturnFocus={() => launcher.current?.focus()}
          />
        </Suspense>
      )}
    </>
  );
}
