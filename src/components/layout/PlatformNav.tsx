import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isEmbedMode } from "@/config/galaxiforge";
import { Flame } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Builders", path: "/builders" },
  { label: "Templates", path: "/templates" },
  { label: "My Designs", path: "/my-designs" },
  { label: "Help", path: "/help" },
];

export default function PlatformNav() {
  const location = useLocation();
  const embed = isEmbedMode();

  // Hide nav in embed mode or inside the builder workspace
  if (embed || location.pathname === "/builder") return null;

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-border bg-card/80 backdrop-blur-md">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 group">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Flame className="w-4 h-4 text-primary" />
        </div>
        <span className="font-display text-sm tracking-[0.15em] text-foreground">
          Forge<span className="text-primary">Lab</span>
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
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
      </div>
    </nav>
  );
}
