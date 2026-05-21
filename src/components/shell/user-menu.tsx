"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut, Settings, UserCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

export function UserMenu({
  user,
}: {
  user: { name?: string | null; email?: string | null };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Apri menu utente"
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initials(user.name ?? user.email)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[16rem]">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <p className="truncate text-sm font-medium">{user.name ?? user.email ?? "Utente"}</p>
          {user.email && (
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Impostazioni
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="flex items-center gap-2">
            <UserCircle2 className="h-4 w-4" /> Onboarding
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={(e) => {
            e.preventDefault();
            signOut({ callbackUrl: "/sign-in" });
          }}
        >
          <LogOut className="h-4 w-4" /> Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
