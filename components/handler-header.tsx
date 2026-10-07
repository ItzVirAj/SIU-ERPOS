'use client';

import { Logo } from "./logo";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { LogOut, User } from "lucide-react";

export default function HandlerHeader() {
  const { data: session } = authClient.useSession();
  const isSignedIn = !!session?.user;

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = '/sign-in'
  }

  return (
    <>
      <header className="fixed w-full z-50 h-16 flex items-center justify-between px-6 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <Logo link={isSignedIn ? "/dashboard" : "/"}/>

        <div className="flex items-center gap-4">
          {session?.user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={session.user.image || undefined} alt={session.user.name || ""} />
                    <AvatarFallback>
                      {session.user.name?.charAt(0)?.toUpperCase() || session.user.email?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session.user.name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleSignOut()} 
                  className="text-red-600 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <div className="h-16"/> {/* Placeholder for fixed header */}
    </>
  );
}