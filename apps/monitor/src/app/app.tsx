import React from 'react';
import { SidebarInset, SidebarProvider } from './components/ui/sidebar';
import { Routes, Route, Navigate } from 'react-router';
import { AppSidebar } from './components/containers/ContainerSidebar';
import { SiteHeader } from './components/common/SiteHeader';
import { useSidebarState } from './hooks/useSidebarState';
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
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
