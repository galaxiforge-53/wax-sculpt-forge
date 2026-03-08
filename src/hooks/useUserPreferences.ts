import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { MetalPreset, FinishPreset, RingProfile, RingSizeStandard, DimensionUnit } from "@/types/ring";
import type { LightingSettings } from "@/types/lighting";
import { LIGHTING_PRESETS } from "@/types/lighting";

export interface UserPreferences {
  sizeStandard: RingSizeStandard;
  dimensionUnit: DimensionUnit;
  defaultMetal: MetalPreset;
  defaultFinish: FinishPreset;
  defaultProfile: RingProfile;
  lightingPreset: string;
  cameraView: string;
  showMeasurements: boolean;
  comfortFitDefault: boolean;
  autoSave: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  sizeStandard: "US",
  dimensionUnit: "mm",
  defaultMetal: "silver",
  defaultFinish: "polished",
  defaultProfile: "comfort",
  lightingPreset: "jeweller",
  cameraView: "front",
  showMeasurements: false,
  comfortFitDefault: true,
  autoSave: true,
};

const LOCAL_STORAGE_KEY = "forgelab-user-prefs";

function loadLocalPrefs(): UserPreferences {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS };
}

function saveLocalPrefs(prefs: UserPreferences) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

/** Map DB row to UserPreferences */
function fromDbRow(row: Record<string, unknown>): UserPreferences {
  return {
    sizeStandard: (row.size_standard as RingSizeStandard) ?? DEFAULT_PREFS.sizeStandard,
    dimensionUnit: (row.dimension_unit as DimensionUnit) ?? DEFAULT_PREFS.dimensionUnit,
    defaultMetal: (row.default_metal as MetalPreset) ?? DEFAULT_PREFS.defaultMetal,
    defaultFinish: (row.default_finish as FinishPreset) ?? DEFAULT_PREFS.defaultFinish,
    defaultProfile: (row.default_profile as RingProfile) ?? DEFAULT_PREFS.defaultProfile,
    lightingPreset: (row.lighting_preset as string) ?? DEFAULT_PREFS.lightingPreset,
    cameraView: (row.camera_view as string) ?? DEFAULT_PREFS.cameraView,
    showMeasurements: (row.show_measurements as boolean) ?? DEFAULT_PREFS.showMeasurements,
    comfortFitDefault: (row.comfort_fit_default as boolean) ?? DEFAULT_PREFS.comfortFitDefault,
    autoSave: (row.auto_save as boolean) ?? DEFAULT_PREFS.autoSave,
  };
}

/** Map UserPreferences to DB columns */
function toDbRow(prefs: UserPreferences) {
  return {
    size_standard: prefs.sizeStandard,
    dimension_unit: prefs.dimensionUnit,
    default_metal: prefs.defaultMetal,
    default_finish: prefs.defaultFinish,
    default_profile: prefs.defaultProfile,
    lighting_preset: prefs.lightingPreset,
    camera_view: prefs.cameraView,
    show_measurements: prefs.showMeasurements,
    comfort_fit_default: prefs.comfortFitDefault,
    auto_save: prefs.autoSave,
    updated_at: new Date().toISOString(),
  };
}

export function useUserPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(loadLocalPrefs);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from DB when user logs in
  useEffect(() => {
    if (!user) {
      setPrefs(loadLocalPrefs());
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_preferences" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn("Failed to load preferences:", error.message);
        setPrefs(loadLocalPrefs());
      } else if (data) {
        const loaded = fromDbRow(data as Record<string, unknown>);
        setPrefs(loaded);
        saveLocalPrefs(loaded); // sync local
      } else {
        // No row yet — use local prefs and create DB row
        const local = loadLocalPrefs();
        setPrefs(local);
        await supabase
          .from("user_preferences" as any)
          .insert({ user_id: user.id, ...toDbRow(local) } as any);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  // Debounced save
  const persistPrefs = useCallback((updated: UserPreferences) => {
    saveLocalPrefs(updated);

    if (!user) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from("user_preferences" as any)
        .upsert({ user_id: user.id, ...toDbRow(updated) } as any, { onConflict: "user_id" });
    }, 1000);
  }, [user]);

  const updatePrefs = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs((prev) => {
      const updated = { ...prev, ...patch };
      persistPrefs(updated);
      return updated;
    });
  }, [persistPrefs]);

  /** Get the lighting settings for the stored preset */
  const getLightingSettings = useCallback((): Partial<LightingSettings> | undefined => {
    const preset = LIGHTING_PRESETS.find((p) => p.id === prefs.lightingPreset);
    return preset?.settings;
  }, [prefs.lightingPreset]);

  return {
    prefs,
    updatePrefs,
    loading,
    getLightingSettings,
    defaults: DEFAULT_PREFS,
  };
}
