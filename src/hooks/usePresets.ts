import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export type PresetCategory = "dimensions" | "surface" | "crater";

export interface UserPreset {
  id: string;
  name: string;
  category: PresetCategory;
  preset_data: Record<string, unknown>;
  created_at: string;
}

const LOCAL_KEY = "forgelab-user-presets";

function loadLocal(): UserPreset[] {
  try {
    const stored = localStorage.getItem(LOCAL_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveLocal(presets: UserPreset[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(presets)); } catch { /* */ }
}

export function usePresets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [presets, setPresets] = useState<UserPreset[]>(loadLocal);
  const [loading, setLoading] = useState(true);

  // Load from DB
  useEffect(() => {
    if (!user) { setPresets(loadLocal()); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_presets" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (!error && data) {
        const mapped = (data as unknown as UserPreset[]);
        setPresets(mapped);
        saveLocal(mapped);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const savePreset = useCallback(async (name: string, category: PresetCategory, data: Record<string, unknown>) => {
    const newPreset: UserPreset = {
      id: crypto.randomUUID(),
      name,
      category,
      preset_data: data,
      created_at: new Date().toISOString(),
    };

    setPresets((prev) => {
      const updated = [newPreset, ...prev];
      saveLocal(updated);
      return updated;
    });

    if (user) {
      await supabase.from("user_presets" as any).insert({
        id: newPreset.id,
        user_id: user.id,
        name,
        category,
        preset_data: data,
      } as any);
    }

    toast({ title: "💾 Preset Saved", description: `"${name}" saved to ${category}` });
    return newPreset;
  }, [user, toast]);

  const deletePreset = useCallback(async (id: string) => {
    setPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      saveLocal(updated);
      return updated;
    });

    if (user) {
      await supabase.from("user_presets" as any).delete().eq("id", id);
    }

    toast({ title: "Preset Deleted" });
  }, [user, toast]);

  const getPresetsByCategory = useCallback((category: PresetCategory) => {
    return presets.filter((p) => p.category === category);
  }, [presets]);

  return { presets, loading, savePreset, deletePreset, getPresetsByCategory };
}
