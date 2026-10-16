"use client"

import * as React from "react"
import {
  IconDashboard,
  IconInnerShadowTop,
  IconMessageCircle,
  } from "@tabler/icons-react"

import { Sidebar,SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarContent, SidebarFooter } from "../ui/sidebar"
import { NavMain } from "./nav-main"
import { Separator } from "../ui/separator"




const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
    title: "Main",
    url: "/",
    icon: IconDashboard,
  },
    {
    title: "Messaging Resources",
    url: "/messaging-resources",
    icon: IconMessageCircle,
  }],
  navClouds: [],
  navSecondary: [],
  documents: [],
}

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
            <Separator orientation="horizontal"  className="h-0.5 data-[orientation=horizontal]:w-full" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
         <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        
      </SidebarFooter>
    </Sidebar>
  )
}
