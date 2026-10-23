import React from 'react';
import { SidebarInset, SidebarProvider } from './components/ui/sidebar';
import { Routes, Route, Navigate, useLocation } from 'react-router';
import { AppSidebar } from './components/containers/ContainerSidebar';
import { SiteHeader } from './components/common/SiteHeader';
import { useSidebarState } from './hooks/useSidebarState';
import { Button } from './components/ui/button';
import { MessageCircle } from 'lucide-react';
const MessagingResources = React.lazy(
  () => import('./features/messaging-resources'),
);
const MessagingChatPage = React.lazy(() => import('./features/messaging-chat'));
const MessageDetailPage = React.lazy(() => import('./features/message-detail'));
const MessagesPage = React.lazy(() =>
  import('./features/messages').then((module) => ({
    default: module.MessagesPage,
  })),
);
const PoliciesPage = React.lazy(() => import('./features/policies'));
const MessagingChatSheet = React.lazy(
  () => import('./features/messaging-chat/components/MessagingChatSheet'),
);

function ChatFloatingAction() {
  const { pathname } = useLocation();
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const launcher = React.useRef<HTMLButtonElement>(null);
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
        <React.Suspense fallback={null}>
          <MessagingChatSheet
            open={open}
            onOpenChange={setOpen}
            onReturnFocus={() => launcher.current?.focus()}
          />
        </React.Suspense>
      )}
    </>
  );
}

export function App() {
  const { isOpen } = useSidebarState();

  const NAV_ITEMS = [
    { title: 'Messaging Monitor', url: '/' },
    { title: 'Messaging Resources', url: '/messaging-resources' },
  ];

  return (
    <SidebarProvider
      defaultOpen={isOpen}
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader items={NAV_ITEMS} />
        <div className="flex flex-1 flex-col min-w-0">
          <Routes>
            <Route path="/" element={<MessagesPage />} />
            <Route path="/messages/:id" element={<MessageDetailPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route
              path="/messaging-resources"
              element={<MessagingResources />}
            />
            <Route path="/chat" element={<MessagingChatPage />} />
            <Route
              path="/e2e-tests"
              element={<Navigate to="/chat" replace />}
            />
            <Route path="/sqs" element={<Navigate to="/" replace />} />
            <Route
              path="/azure-service-bus"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </div>
        <ChatFloatingAction />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
