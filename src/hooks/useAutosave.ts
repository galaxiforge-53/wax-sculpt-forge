import { useEffect, useRef, useCallback, useState } from "react";
import { DesignPackage } from "@/types/ring";
import { saveCloudDesign } from "@/lib/cloudDesignsStore";

const AUTOSAVE_KEY = "forgelab_autosave";
const AUTOSAVE_META_KEY = "forgelab_autosave_meta";
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds
const AUTOSAVE_DEBOUNCE_MS = 5_000;  // 5s after last change before saving

export interface AutosaveMeta {
  savedAt: string;
  projectId: string | null;
  projectName: string | null;
  isCloudSynced: boolean;
}

export interface AutosaveStatus {
  lastSaved: string | null;
  isSaving: boolean;
  isDirty: boolean;
  isCloudSynced: boolean;
}

/** Save design to localStorage as crash recovery */
function saveToLocal(pkg: DesignPackage, meta: AutosaveMeta) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(pkg));
    localStorage.setItem(AUTOSAVE_META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn("Autosave to localStorage failed:", e);
  }
}

/** Load autosaved design from localStorage */
export function loadAutosave(): { pkg: DesignPackage; meta: AutosaveMeta } | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    const metaRaw = localStorage.getItem(AUTOSAVE_META_KEY);
    if (!raw || !metaRaw) return null;
    return { pkg: JSON.parse(raw), meta: JSON.parse(metaRaw) };
  } catch {
    return null;
  }
}

/** Clear autosave data (e.g. after manual save) */
export function clearAutosave() {
  localStorage.removeItem(AUTOSAVE_KEY);
  localStorage.removeItem(AUTOSAVE_META_KEY);
}

/**
 * Autosave hook — periodically saves the current design to localStorage
 * and optionally to cloud when the user is authenticated.
 */
export function useAutosave({
  generateDesignPackage,
  projectId,
  projectName,
  userId,
  enabled = true,
}: {
  generateDesignPackage: () => DesignPackage;
  projectId: string | null;
  projectName: string | null;
  userId: string | null;
  enabled?: boolean;
}): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>({
    lastSaved: null,
    isSaving: false,
    isDirty: false,
    isCloudSynced: false,
  });

  const lastPkgHashRef = useRef<string>("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Quick hash of design state to detect changes
  const computeHash = useCallback((pkg: DesignPackage): string => {
    // Use a fast fingerprint: key params + timestamps
    const p = pkg.parameters;
    return `${p.size}-${p.width}-${p.thickness}-${p.profile}-${p.grooveCount}-${p.grooveDepth}-${p.bevelSize}-${p.comfortFit}-${pkg.viewMode}-${pkg.metalPreset}-${pkg.finishPreset}-${pkg.craftState?.lunarTexture?.enabled}-${pkg.craftState?.lunarTexture?.intensity}-${pkg.craftState?.lunarTexture?.seed}-${pkg.craftState?.engraving?.enabled}-${pkg.craftState?.engraving?.text}-${pkg.craftState?.waxMarks?.length ?? 0}-${pkg.craftState?.inlays?.channels?.length ?? 0}-${p.interiorProfile}-${p.interiorCurvature}-${p.comfortFitDepth}-${p.edgeStyle}`;
  }, []);

  const performSave = useCallback(async () => {
    if (!isMountedRef.current || !enabled) return;

    const pkg = generateDesignPackage();
    const hash = computeHash(pkg);

    // Skip if nothing changed
    if (hash === lastPkgHashRef.current) {
      setStatus(s => ({ ...s, isDirty: false }));
      return;
    }

    setStatus(s => ({ ...s, isSaving: true }));
    lastPkgHashRef.current = hash;

    const now = new Date().toISOString();
    let isCloudSynced = false;

    // Always save to localStorage for crash recovery
    const meta: AutosaveMeta = {
      savedAt: now,
      projectId,
      projectName,
      isCloudSynced: false,
    };
    saveToLocal(pkg, meta);

    // If authenticated and has existing cloud project, save silently
    if (userId && projectId && !projectId.startsWith("PRJ-")) {
      try {
        await saveCloudDesign(
          { name: projectName || "Untitled Design", design_package: pkg },
          projectId,
        );
        isCloudSynced = true;
        // Update meta with cloud sync status
        saveToLocal(pkg, { ...meta, isCloudSynced: true });
      } catch (e) {
        console.warn("Cloud autosave failed:", e);
      }
    }

    if (isMountedRef.current) {
      setStatus({
        lastSaved: now,
        isSaving: false,
        isDirty: false,
        isCloudSynced,
      });
    }
  }, [generateDesignPackage, computeHash, projectId, projectName, userId, enabled]);

  // Mark as dirty whenever design package generator changes (deps change)
  useEffect(() => {
    if (!enabled) return;

    // Debounced save after changes
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setStatus(s => ({ ...s, isDirty: true }));
      performSave();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [performSave, enabled]);

  // Periodic save interval
  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(() => {
      performSave();
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [performSave, enabled]);

  // Save on page unload
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      // Synchronous localStorage save only (can't await cloud)
      try {
        const pkg = generateDesignPackage();
        const meta: AutosaveMeta = {
          savedAt: new Date().toISOString(),
          projectId,
          projectName,
          isCloudSynced: false,
        };
        saveToLocal(pkg, meta);
      } catch {
        // Best effort
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [generateDesignPackage, projectId, projectName, enabled]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  return status;
}
