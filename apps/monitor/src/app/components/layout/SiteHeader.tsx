import { useLocation } from 'react-router';
import { Separator } from '../ui/separator';
import { SidebarTrigger } from '../ui/sidebar';
import { ModeToggle } from '../common/mode-toggle';
import { ThemeSelector } from '../common/ThemeSelector';
import { pageTitle } from '../../lib/navigation';

export function SiteHeader() {
  const { pathname } = useLocation();
  const title = pageTitle(pathname);
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
