import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AccessTier = "free" | "premium" | "export";

interface AccessGrant {
  tier: AccessTier;
  granted_at: string;
}

interface AccessContextType {
  grants: AccessGrant[];
  loading: boolean;
  highestTier: AccessTier | null;
  hasAccess: (minTier?: AccessTier) => boolean;
  canExport: boolean;
  isPremium: boolean;
  redeemCode: (code: string) => Promise<{ success: boolean; error?: string; tier?: string }>;
  refresh: () => Promise<void>;
}

const TIER_RANK: Record<AccessTier, number> = { free: 0, premium: 1, export: 2 };

const AccessContext = createContext<AccessContextType | undefined>(undefined);

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setGrants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_access")
        .select("tier, granted_at")
        .eq("user_id", user.id);
      if (error) throw error;
      setGrants((data ?? []) as AccessGrant[]);
    } catch {
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const highestTier: AccessTier | null = grants.length === 0
    ? null
    : grants.reduce<AccessTier>((best, g) => {
        const t = g.tier as AccessTier;
        return TIER_RANK[t] > TIER_RANK[best] ? t : best;
      }, "free");

  const hasAccess = (minTier: AccessTier = "free") => {
    if (!highestTier) return false;
    return TIER_RANK[highestTier] >= TIER_RANK[minTier];
  };

  const canExport = hasAccess("export");
  const isPremium = hasAccess("premium");

  const redeemCode = async (code: string): Promise<{ success: boolean; error?: string; tier?: string }> => {
    const { data, error } = await supabase.rpc("redeem_access_code", { p_code: code });
    if (error) return { success: false, error: error.message };
    const result = data as any;
    if (result?.success) {
      await refresh();
      return { success: true, tier: result.tier };
    }
    return { success: false, error: result?.error ?? "Unknown error" };
  };

  return (
    <AccessContext.Provider value={{ grants, loading, highestTier, hasAccess, canExport, isPremium, redeemCode, refresh }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) throw new Error("useAccess must be used within AccessProvider");
  return context;
}
