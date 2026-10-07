"use client";

import React, { useState, useEffect } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import IconMsgs from "@/components/ui/IconMsgs";
import { authClient } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ApiKeyDialog } from "@/components/shared/api-key-dialog";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AIChatbot } from "@/components/ai/ai-chatbot";
import { TeamProvider, useActiveTeam } from "@/lib/context/team-context";

import {
  DashboardAppSidebar,
  navigationItems,
  type NavigationItem,
} from "@/components/dashboard/sidebar";
import { UserMenu } from "@/components/ui/user-menu";
import { Key, SlidersHorizontal, User } from "lucide-react";

function HeaderBreadcrumb({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();
  const currentItem = items.find((item) => item.type === "item" && item.href === pathname);
  const title = currentItem?.name || (pathname === "/dashboard" ? "Home" : "Task Suite");

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        {pathname !== "/dashboard" && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function DashboardInnerLayout({ children }: { children: React.ReactNode }) {
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isInbox = pathname === "/dashboard/inbox";

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === "k" || event.key === "f" || event.key === "K" || event.key === "F")
      ) {
        const target = event.target as HTMLElement;
        const isInputElement =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (!isInputElement) {
          event.preventDefault();
          setChatbotOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/sign-in";
  };

  const navItems = navigationItems(() => setApiKeyDialogOpen(true));

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "17.5rem",
          "--sidebar-width-icon": "4.5rem",
        } as React.CSSProperties
      }
      className="bg-[#0e0f11] text-neutral-100 min-h-screen"
    >
      <div className="flex h-screen w-full overflow-hidden bg-[#0e0f11] text-neutral-100">
        <DashboardAppSidebar items={navItems} />
        <SidebarInset className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden bg-[#0e0f11] border-none shadow-none">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0e0f11]/95 px-6 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-neutral-300 hover:text-white hover:bg-white/[0.06]" />
              <HeaderBreadcrumb items={navItems} />
            </div>

            <div className="flex items-center gap-3">
              {session?.user && (
                <>
                  {/* AI Assistant Button */}
                  <div className="border border-white/[0.08] rounded-md p-1.5 hidden sm:block bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChatbotOpen(true)}
                        className="h-7 px-2 text-xs gap-1.5 text-neutral-300 hover:text-white hover:bg-white/[0.06]"
                        title={`Open SketchItUp AI (${isMac ? "⌘" : "Ctrl"}+K)`}
                      >
                        <IconMsgs className="h-4 w-4 text-primary" />
                        <span>AI Assistant</span>
                      </Button>
                      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-white/[0.1] bg-white/[0.05] px-1.5 font-mono text-[10px] font-medium text-neutral-400">
                        <span>{isMac ? "⌘" : "Ctrl"}</span>K
                      </kbd>
                    </div>
                  </div>

                  {/* Profile Menu */}
                  <UserMenu
                    user={{
                      name: session.user.name || "User",
                      email: session.user.email || "",
                      avatarSrc: session.user.image || undefined,
                      plan: "Pro",
                    }}
                    status="available"
                    showTheme={true}
                    items={[
                      {
                        label: "Profile Settings",
                        icon: <User size={16} strokeWidth={1.75} />,
                        onSelect: () => router.push("/dashboard/settings"),
                      },
                      {
                        label: "API Keys",
                        icon: <Key size={16} strokeWidth={1.75} />,
                        keys: ["⌘", "K"],
                        onSelect: () => setApiKeyDialogOpen(true),
                      },
                      {
                        label: "Management",
                        icon: <SlidersHorizontal size={16} strokeWidth={1.75} />,
                        onSelect: () => router.push("/dashboard/management"),
                      },
                    ]}
                    onSignOut={handleSignOut}
                    align="end"
                  />
                </>
              )}
            </div>
          </header>

          <main
            className={cn(
              "flex-1 min-h-0 w-full bg-[#0e0f11]",
              isInbox
                ? "overflow-hidden flex flex-col p-0"
                : "overflow-y-auto p-4 md:p-6"
            )}
          >
            {children}
          </main>
        </SidebarInset>

        <ApiKeyDialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen} />

        <Sheet open={chatbotOpen} onOpenChange={setChatbotOpen}>
          <SheetContent className="w-full sm:max-w-md p-0 flex flex-col h-full">
            <AIChatbot onClose={() => setChatbotOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </SidebarProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeamProvider>
      <DashboardInnerLayout>
        {children}
      </DashboardInnerLayout>
    </TeamProvider>
  );
}
