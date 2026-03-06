import { useNavigate } from "react-router-dom";
import { useAccess } from "@/hooks/useAccess";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { KeyRound, LogIn, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AccessGateProps {
  children: ReactNode;
  minTier?: "free" | "premium" | "export";
  featureLabel?: string;
}

export default function AccessGate({ children, minTier = "free", featureLabel = "this feature" }: AccessGateProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useAccess();

  if (authLoading || accessLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-primary animate-pulse font-display text-xl tracking-wider">ForgeLab</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <LogIn className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="font-display text-xl tracking-wider">Sign In Required</h2>
          <p className="text-sm text-muted-foreground">Sign in to access {featureLabel}.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>Home</Button>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!hasAccess(minTier)) {
    return (
      <div className="h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display text-xl tracking-wider">Access Required</h2>
          <p className="text-sm text-muted-foreground">
            You need a <span className="text-foreground font-medium">{minTier}</span> access code to use {featureLabel}.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>Home</Button>
            <Button onClick={() => navigate("/access")} className="gap-1.5">
              <KeyRound className="w-4 h-4" /> Enter Code
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
