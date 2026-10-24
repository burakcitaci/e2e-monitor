'use client';

import * as React from 'react';
import {
  IconListCheck,
  IconInnerShadowTop,
  IconShieldCheck,
  IconMessageCircle,
} from '@tabler/icons-react';

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
} from '../ui/sidebar';
import { NavMain } from './NavMain';
import { Separator } from '../ui/separator';
import { navigationItems } from '../../lib/navigation';

const navigationIcons = {
  '/': IconMessageCircle,
  '/messaging-resources': IconListCheck,
  '/policies': IconShieldCheck,
};
const sidebarItems = navigationItems.map((item) => ({
  ...item,
  icon: navigationIcons[item.url],
}));

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">E2E Monitor</span>
              </a>
            </SidebarMenuButton>
            <Separator
              orientation="horizontal"
              className="h-0.5 data-[orientation=horizontal]:w-full"
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarItems} />
      </SidebarContent>
    </Sidebar>
  );
}
