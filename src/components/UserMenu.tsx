import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";
import { ChevronDown, LogOut, Shield, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { user, profile, isAdmin, signOut, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    const next =
      typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;
    return (
      <div className="user-menu fixed right-3 top-3 z-[9999] flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/auth" search={{ mode: "signin", next }}>
            Sign in
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/auth" search={{ mode: "signup", next }}>
            Sign up
          </Link>
        </Button>
      </div>
    );
  }

  const label = profile?.username ?? user.email ?? "Account";

  return (
    <div className="user-menu fixed right-3 top-3 z-[9999] flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Account menu" className="account-menu-trigger gap-1.5">
            <UserRound className="account-menu-icon hidden" aria-hidden="true" />
            <span className="account-menu-label max-w-[180px] truncate">{label}</span>
            <ChevronDown className="account-menu-chevron h-3.5 w-3.5 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/account">My Account</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/lesson-plans">Saved Lesson Plans</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/worksheets">Saved Worksheets</Link>
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem asChild>
              <Link to="/admin"><Shield aria-hidden="true" /> Admin</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut aria-hidden="true" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isAdmin && (
        <Button asChild variant="outline" size="sm" className="desktop-account-action">
          <Link to="/admin">Admin</Link>
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={signOut} className="desktop-account-action">
        Sign out
      </Button>
    </div>
  );
}
