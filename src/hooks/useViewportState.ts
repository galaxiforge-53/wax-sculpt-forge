import { useReducer, useCallback, Dispatch } from "react";
import { SnapshotAngle, CutawayMode, BackgroundPreset } from "@/components/builder/RingViewport";
import { ScaleReferenceType } from "@/components/builder/ScaleReference";
import { LightingSettings, DEFAULT_LIGHTING } from "@/types/lighting";

/**
 * Consolidated viewport state — replaces 18 separate useState calls in Builder.
 * Grouped by functional area for clear organization.
 */
export interface ViewportState {
  // Camera
  cameraPreset: SnapshotAngle | null;
  rotationLocked: boolean;
  // View modes
  showcaseMode: boolean;
  inspectionMode: boolean;
  showMeasurements: boolean;
  showPrinterBed: boolean;
  thicknessHeatmap: boolean;
  // Cutaway
  cutawayMode: CutawayMode;
  cutawayOffset: number;
  // Lighting & background
  lighting: LightingSettings;
  bgPreset: BackgroundPreset;
  turntableSpeed: number;
  // Ring transform
  ringPosition: [number, number, number];
  ringRotation: [number, number, number];
  // Inspection tools
  loupeActive: boolean;
  loupeZoom: number;
  // Preview effects
  wearPreview: number;
  polishPreview: number;
  detailBoost: number;
  // Scale reference
  scaleReference: ScaleReferenceType;
}

export const INITIAL_VIEWPORT_STATE: ViewportState = {
  cameraPreset: null,
  rotationLocked: false,
  showcaseMode: false,
  inspectionMode: false,
  showMeasurements: false,
  showPrinterBed: false,
  thicknessHeatmap: false,
  cutawayMode: "normal",
  cutawayOffset: 0,
  lighting: DEFAULT_LIGHTING,
  bgPreset: "dark-studio",
  turntableSpeed: 0,
  ringPosition: [0, 0, 0],
  ringRotation: [0, 0, 0],
  loupeActive: false,
  loupeZoom: 3,
  wearPreview: 0,
  polishPreview: 0,
  detailBoost: 0,
  scaleReference: "none",
};

type ViewportAction =
  | { type: "SET"; field: keyof ViewportState; value: unknown }
  | { type: "TOGGLE"; field: keyof ViewportState }
  | { type: "SET_CUTAWAY"; mode: CutawayMode }
  | { type: "TOGGLE_PRINTER_BED" }
  | { type: "RESET_TRANSFORM" }
  | { type: "BATCH"; updates: Partial<ViewportState> };

function viewportReducer(state: ViewportState, action: ViewportAction): ViewportState {
  switch (action.type) {
    case "SET":
      if (state[action.field] === action.value) return state;
      return { ...state, [action.field]: action.value };
    case "TOGGLE":
      return { ...state, [action.field]: !(state[action.field] as boolean) };
    case "SET_CUTAWAY":
      return { ...state, cutawayMode: action.mode, cutawayOffset: 0 };
    case "TOGGLE_PRINTER_BED":
      return {
        ...state,
        showPrinterBed: !state.showPrinterBed,
        ringRotation: !state.showPrinterBed ? [Math.PI / 2, 0, 0] : state.ringRotation,
      };
    case "RESET_TRANSFORM":
      return { ...state, ringPosition: [0, 0, 0], ringRotation: [0, 0, 0] };
    case "BATCH":
      return { ...state, ...action.updates };
    default:
      return state;
  }
}

/**
 * Hook that provides consolidated viewport state with stable dispatch.
 * Reduces Builder.tsx's 18 useState calls to a single useReducer.
 */
export function useViewportState() {
  const [state, dispatch] = useReducer(viewportReducer, INITIAL_VIEWPORT_STATE);

  // Convenience setters for ViewportControls compatibility
  const set = useCallback(<K extends keyof ViewportState>(field: K, value: ViewportState[K]) => {
    dispatch({ type: "SET", field, value });
  }, []);

  // Fixed: uses dispatch instead of reading stale state
  const toggle = useCallback((field: keyof ViewportState) => {
    dispatch({ type: "TOGGLE", field });
  }, []);

  // ── Stable per-field setters (never change identity) ──────────
  // These prevent re-renders in memoized children like ViewportControls
  const setCameraPreset = useCallback((v: SnapshotAngle | null) => dispatch({ type: "SET", field: "cameraPreset", value: v }), []);
  const setShowMeasurements = useCallback((v: boolean) => dispatch({ type: "SET", field: "showMeasurements", value: v }), []);
  const setCutawayMode = useCallback((v: CutawayMode) => dispatch({ type: "SET", field: "cutawayMode", value: v }), []);
  const setCutawayOffset = useCallback((v: number) => dispatch({ type: "SET", field: "cutawayOffset", value: v }), []);
  const setLighting = useCallback((v: LightingSettings) => dispatch({ type: "SET", field: "lighting", value: v }), []);
  const setShowcaseMode = useCallback((v: boolean) => dispatch({ type: "SET", field: "showcaseMode", value: v }), []);
  const setInspectionMode = useCallback((v: boolean) => dispatch({ type: "SET", field: "inspectionMode", value: v }), []);
  const setRingPosition = useCallback((v: [number, number, number]) => dispatch({ type: "SET", field: "ringPosition", value: v }), []);
  const setRingRotation = useCallback((v: [number, number, number]) => dispatch({ type: "SET", field: "ringRotation", value: v }), []);
  const setShowPrinterBed = useCallback((v: boolean) => dispatch({ type: "SET", field: "showPrinterBed", value: v }), []);
  const setRotationLocked = useCallback((v: boolean) => dispatch({ type: "SET", field: "rotationLocked", value: v }), []);
  const setScaleReference = useCallback((v: ScaleReferenceType) => dispatch({ type: "SET", field: "scaleReference", value: v }), []);
  const setWearPreview = useCallback((v: number) => dispatch({ type: "SET", field: "wearPreview", value: v }), []);
  const setPolishPreview = useCallback((v: number) => dispatch({ type: "SET", field: "polishPreview", value: v }), []);
  const setDetailBoost = useCallback((v: number) => dispatch({ type: "SET", field: "detailBoost", value: v }), []);
  const setThicknessHeatmap = useCallback((v: boolean) => dispatch({ type: "SET", field: "thicknessHeatmap", value: v }), []);
  const setTurntableSpeed = useCallback((v: number) => dispatch({ type: "SET", field: "turntableSpeed", value: v }), []);
  const setBgPreset = useCallback((v: BackgroundPreset) => dispatch({ type: "SET", field: "bgPreset", value: v }), []);
  const setLoupeActive = useCallback((v: boolean) => dispatch({ type: "SET", field: "loupeActive", value: v }), []);
  const setLoupeZoom = useCallback((v: number) => dispatch({ type: "SET", field: "loupeZoom", value: v }), []);

  const setters = useMemo(() => ({
    setCameraPreset, setShowMeasurements, setCutawayMode, setCutawayOffset,
    setLighting, setShowcaseMode, setInspectionMode, setRingPosition,
    setRingRotation, setShowPrinterBed, setRotationLocked, setScaleReference,
    setWearPreview, setPolishPreview, setDetailBoost, setThicknessHeatmap,
    setTurntableSpeed, setBgPreset, setLoupeActive, setLoupeZoom,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { vp: state, vpDispatch: dispatch, vpSet: set, vpToggle: toggle, ...setters };
}

export type { ViewportAction };
