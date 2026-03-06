import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isEmbedMode } from "@/config/galaxiforge";
import { Flame, Menu, X, LogIn, LogOut, User, Shield } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Library", path: "/library" },
  { label: "Builders", path: "/builders" },
  { label: "Templates", path: "/templates" },
  { label: "My Designs", path: "/my-designs" },
  { label: "Access", path: "/access" },
  { label: "Help", path: "/help" },
];

export default function PlatformNav() {
  const location = useLocation();
  const embed = isEmbedMode();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();

  const navItems = [
    ...NAV_ITEMS,
    ...(isAdmin ? [{ label: "Admin", path: "/admin" }] : []),
  ];

  if (embed || location.pathname === "/builder") return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Flame className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-sm tracking-[0.15em] text-foreground">
            Forge<span className="text-primary">Lab</span>
          </span>
        </Link>

        {/* Desktop nav */}
        {!isMobile && (
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {/* Auth button */}
            {user ? (
              <div className="flex items-center gap-2 ml-3 pl-3 border-l border-border">
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {user.email}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => signOut()}
                >
                  <LogOut className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="ml-3 pl-3 border-l border-border flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </Link>
            )}
          </div>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Mobile dropdown */}
      {isMobile && menuOpen && (
        <div className="border-t border-border bg-card/95 backdrop-blur-md px-4 pb-4 pt-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block px-4 py-3 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {item.label}
              </Link>
            );
          })}
          {/* Mobile auth */}
          <div className="pt-2 border-t border-border mt-2">
            {user ? (
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => { signOut(); setMenuOpen(false); }}>
                  <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
                </Button>
              </div>
            ) : (
              <Link
                to="/auth"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-all"
              >
                <LogIn className="w-4 h-4 inline mr-2" /> Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
