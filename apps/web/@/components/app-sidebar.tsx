"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconChartBar,
  IconDatabase,
  IconPokeball,
  IconSword,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "New Battle",
      url: "/battles/new",
      icon: IconSword,
    },
    {
      title: "Benchmarks",
      url: "/benchmarks",
      icon: IconChartBar,
    },
    {
      title: "Dex",
      url: "/dex",
      icon: IconDatabase,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/benchmarks">
                <IconPokeball className="size-5!" />
                <span className="text-base font-semibold">PokeBench</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
    </Sidebar>
  )
}
