import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccess, AccessTier } from "@/hooks/useAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { KeyRound, Sparkles, Download, Palette, Check, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_INFO: Record<AccessTier, { label: string; icon: typeof Sparkles; description: string; color: string }> = {
  free: {
    label: "Free Access",
    icon: Palette,
    description: "Design rings with all basic tools",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  premium: {
    label: "Premium Member",
    icon: Sparkles,
    description: "Advanced features including lunar textures, inlays, and AI assistant",
    color: "text-primary border-primary/30 bg-primary/10",
  },
  export: {
    label: "Export Pro",
    icon: Download,
    description: "Full access including STL downloads and production submission",
    color: "text-accent border-accent/30 bg-accent/10",
  },
};

export default function AccessCode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { redeemCode, grants, highestTier, loading } = useAccess();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in before redeeming a code.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    setSubmitting(true);
    try {
      const result = await redeemCode(code.trim());
      if (result.success) {
        const tierLabel = TIER_INFO[result.tier as AccessTier]?.label ?? result.tier;
        toast({ title: "Access Granted! 🔑", description: `${tierLabel} unlocked.` });
        setCode("");
      } else {
        toast({ title: "Invalid Code", description: result.error, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeTiers = grants.map((g) => g.tier as AccessTier);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl tracking-wider text-foreground">
            Access Code
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your Galaxy Forge access code to unlock features
          </p>
        </div>

        {/* Code input */}
        <form onSubmit={handleRedeem} className="space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ENTER ACCESS CODE"
            className="bg-card border-border text-center font-mono text-lg tracking-[0.2em] h-12 uppercase"
            maxLength={30}
            autoFocus
          />
          <Button type="submit" className="w-full h-11" disabled={submitting || !code.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
            Redeem Code
          </Button>
        </form>

        {/* Current access */}
        {!loading && grants.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">Your active access</p>
            <div className="space-y-2">
              {(Object.keys(TIER_INFO) as AccessTier[]).map((tier) => {
                const info = TIER_INFO[tier];
                const active = activeTiers.includes(tier);
                const Icon = info.icon;
                return (
                  <div
                    key={tier}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                      active ? info.color : "border-border/50 bg-card/50 opacity-40"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{info.label}</p>
                      <p className="text-[10px] text-muted-foreground">{info.description}</p>
                    </div>
                    {active && <Check className="w-4 h-4 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No access yet */}
        {!loading && grants.length === 0 && user && (
          <p className="text-xs text-muted-foreground text-center">
            No access codes redeemed yet. Enter a code above to get started.
          </p>
        )}

        {!user && (
          <p className="text-xs text-muted-foreground text-center">
            <button onClick={() => navigate("/auth")} className="text-primary hover:underline">
              Sign in
            </button>{" "}
            to redeem an access code.
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate("/")}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Home
          </button>
          {highestTier && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/builder")}>
              Open Builder
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
