import * as React from "react";
import {
  Mic,
  Mail,
  Star,
  Archive,
  Inbox,
  Settings2,
  Bot,
  PieChart,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";

interface AppSidebarProps {
  onTabSwitch?: (
    tab: "all" | "unread" | "read" | "important" | "archived",
  ) => void;
  activeTab: "all" | "unread" | "read" | "important" | "archived";
  emailCounts: {
    unread: number;
    read: number;
    important: number;
    archived: number;
  };
  onSettingsOpen: () => void;
  emailListComponent?: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// This is sample data
const data = {
  user: {
    name: "VoiceMail AI",
    email: "ai@voicemail.app",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "All Emails",
      url: "#",
      icon: Inbox,
      key: "all" as const,
      isActive: true,
    },
    {
      title: "Unread",
      url: "#",
      icon: Mail,
      key: "unread" as const,
      isActive: false,
    },
    {
      title: "Read",
      url: "#",
      icon: Check,
      key: "read" as const,
      isActive: false,
    },
    {
      title: "Important",
      url: "#",
      icon: Star,
      key: "important" as const,
      isActive: false,
    },
    {
      title: "Archived",
      url: "#",
      icon: Archive,
      key: "archived" as const,
      isActive: false,
    },
  ],
};

export function AppSidebar({
  onTabSwitch,
  activeTab,
  emailCounts,
  onSettingsOpen,
  emailListComponent,
  searchQuery,
  onSearchChange,
  ...props
}: AppSidebarProps & React.ComponentProps<typeof Sidebar>) {
  const [activeItem, setActiveItem] = React.useState(
    data.navMain.find((item) => item.key === activeTab) || data.navMain[0],
  );
  const { setOpen } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
      {...props}
    >
      {/* This is the first sidebar - Navigation icons */}
      <Sidebar
        collapsible="none"
        className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <a href="#">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Mic className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">VoiceMail AI</span>
                    <span className="truncate text-xs">Smart Assistant</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        setActiveItem(item);
                        onTabSwitch?.(item.key);
                        setOpen(true);
                      }}
                      isActive={activeItem?.key === item.key}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onSettingsOpen}
                tooltip={{
                  children: "Settings",
                  hidden: false,
                }}
                className="px-2.5 md:px-2"
              >
                <Settings2 />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* This is the second sidebar - Email details */}
      <Sidebar collapsible="none" className="hidden md:flex w-80 max-w-none">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium text-foreground">
              {activeItem?.title}
            </div>
            <div className="flex items-center gap-2">
              {activeItem?.key &&
                activeItem.key !== "all" &&
                emailCounts[activeItem.key as keyof typeof emailCounts] > 0 && (
                  <Badge variant="secondary">
                    {emailCounts[activeItem.key as keyof typeof emailCounts]}
                  </Badge>
                )}
            </div>
          </div>
          <SidebarInput
            placeholder="Search emails..."
            value={searchQuery ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </SidebarHeader>

        <SidebarContent className="flex-1 overflow-hidden p-0 w-full">
          <SidebarGroup className="h-full px-0 w-full">
            <SidebarGroupContent className="h-full overflow-y-auto w-full p-0 scrollbar-hide">
              {emailListComponent}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  );
}
