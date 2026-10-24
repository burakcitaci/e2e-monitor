import { useLocation } from 'react-router';
import { Separator } from '../ui/separator';
import { SidebarTrigger } from '../ui/sidebar';
import { ModeToggle } from './mode-toggle';
import { ThemeSelector } from './ThemeSelector';

type NavItem = { title: string; url: string };

export function SiteHeader({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const current = items.find(
    (item) => item.url === pathname && item.url !== '/',
  );
  const title = pathname.startsWith('/messages/')
    ? 'Message details'
    : pathname.startsWith('/policies/')
      ? 'Policy details'
      : pathname === '/policies'
        ? 'Policies'
        : pathname === '/chat'
          ? 'Messaging Chat'
          : (current?.title ?? 'Messages');
  return (
    <header className="relative flex h-(--header-height) shrink-0 items-center border-b">
      <div className="flex w-full items-center px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <div className="text-lg font-default flex items-center gap-2 font-medium">
            {title}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeSelector />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
