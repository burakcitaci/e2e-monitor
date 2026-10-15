import React from 'react';
import {
  SidebarInset,
  SidebarProvider,
} from './components/ui/sidebar';
import { Routes, Route } from 'react-router';
import { AppSidebar } from './components/containers/ContainerSidebar';
import { SiteHeader } from './components/common/SiteHeader';
import { useSidebarState } from './hooks/useSidebarState';
const MessagingResources = React.lazy(
  () => import('./features/messaging-resources'),
);
const E2eTestsPage = React.lazy(() => import('./features/e2e-tests'));
const AzureSbDetailPage = React.lazy(() =>
  import('./features/azure-sb').then((module) => ({
    default: module.AzureSbDetailPage,
  })),
);
const AwsSqsDetailPage = React.lazy(() =>
  import('./features/aws-sqs').then((module) => ({
    default: module.AwsSqsDetailPage,
  })),
);
const MessagesPage = React.lazy(() =>
  import('./features/messages').then((module) => ({
    default: module.MessagesPage,
  })),
);

export function App() {
  const { isOpen } = useSidebarState();

 const NAV_ITEMS = [
  { title: "Messaging Monitor", url: "/" },
  { title: "Messaging Resources", url: "/messaging-resources" },
  { title: "E2E Tests", url: "/e2e-tests" },
]

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
              <Route path="/messaging-resources" element={<MessagingResources />} />
              <Route path="/e2e-tests" element={<E2eTestsPage />} />
              <Route path="/sqs" element={<AwsSqsDetailPage />} />
              <Route path="/azure-service-bus" element={<AzureSbDetailPage />} />
            </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
