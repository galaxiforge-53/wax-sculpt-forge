import { memo } from "react";
import { ViewMode, ToolType } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { CutawayMode, BackgroundPreset, BG_PRESETS, SnapshotAngle } from "./RingViewport";
import { ScaleReferenceType } from "./ScaleReference";
import AIGenerateOverlay from "./AIGenerateOverlay";
import { RingParameters, MetalPreset, FinishPreset } from "@/types/ring";
import { cn } from "@/lib/utils";
import {
  Settings2, Eye, RotateCw, Sparkles, Camera, Search, ZoomIn, Lock, Unlock,
  Ruler, Circle, Hand, Clock, ArrowLeftRight, Aperture, Thermometer, Printer,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────── */

interface ViewportControlsProps {
  isMobile: boolean;
  // Camera
  cameraPreset: SnapshotAngle | null;
  setCameraPreset: (p: SnapshotAngle) => void;
  // Cutaway
  cutawayMode: CutawayMode;
  setCutawayMode: (m: CutawayMode) => void;
  cutawayOffset: number;
  setCutawayOffset: (o: number) => void;
  // Tools row
  showMeasurements: boolean;
  setShowMeasurements: (v: boolean) => void;
  activeTool: ToolType | null;
  showcaseMode: boolean;
  setShowcaseMode: (v: boolean) => void;
  bgPreset: BackgroundPreset;
  setBgPreset: (p: BackgroundPreset) => void;
  inspectionMode: boolean;
  setInspectionMode: (v: boolean) => void;
  loupeActive: boolean;
  setLoupeActive: (v: boolean) => void;
  detailBoost: number;
  setDetailBoost: (v: number) => void;
  thicknessHeatmap: boolean;
  setThicknessHeatmap: (v: boolean) => void;
  showPrinterBed: boolean;
  setShowPrinterBed: (v: boolean) => void;
  setRingRotation: (r: [number, number, number]) => void;
  turntableSpeed: number;
  setTurntableSpeed: (s: number) => void;
  rotationLocked: boolean;
  setRotationLocked: (v: boolean) => void;
  scaleReference: ScaleReferenceType;
  setScaleReference: (r: ScaleReferenceType) => void;
  wearPreview: number;
  setWearPreview: (v: number) => void;
  polishPreview: number;
  setPolishPreview: (v: number) => void;
  lunarTexture: LunarTextureState;
  // Studio / render
  setStudioRenderOpen: (v: boolean) => void;
  setRenderGalleryOpen: (v: boolean) => void;
  onCaptureSnapshot: () => void;
  compareSnapshot: unknown;
  setPrefsOpen: (v: boolean) => void;
  // AI overlay
  params: RingParameters;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  onUpdateParams: (updates: Partial<RingParameters>) => void;
  onLunarChange: (state: LunarTextureState) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onMetalChange: (metal: MetalPreset) => void;
  onFinishChange: (finish: FinishPreset) => void;
}

const CAMERA_BUTTONS: { id: SnapshotAngle; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "angle", label: "45°" },
  { id: "side", label: "Side" },
  { id: "inside", label: "Inside" },
];

/* ── Shared button style helper ─────────────────────────────────── */

function toolBtnClass(active: boolean, variant: "primary" | "secondary" | "destructive" | "accent" | "warning" = "primary") {
  const colorMap = {
    primary: active
      ? "bg-primary/30 text-primary border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
      : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground",
    secondary: active
      ? "bg-secondary/30 text-secondary-foreground border border-secondary/40 shadow-[0_0_8px_hsl(var(--secondary)/0.2)]"
      : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground",
    destructive: active
      ? "bg-destructive/20 text-destructive border border-destructive/40 shadow-[0_0_8px_hsl(var(--destructive)/0.2)]"
      : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground",
    accent: active
      ? "bg-accent/30 text-accent-foreground border border-accent/40 shadow-[0_0_8px_hsl(var(--accent)/0.3)]"
      : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground",
    warning: active
      ? "bg-warning/30 text-warning border border-warning/40 shadow-[0_0_8px_hsl(var(--warning)/0.3)]"
      : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground",
  };
  return cn("px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all flex items-center gap-1", colorMap[variant]);
}

/* ── Dropdown wrapper ───────────────────────────────────────────── */

function HoverDropdown({ trigger, children, align = "left" }: { trigger: React.ReactNode; children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <div className="relative group">
      {trigger}
      <div className={cn(
        "absolute top-full mt-1 bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50",
        align === "right" ? "right-0" : "left-0"
      )}>
        {children}
      </div>
    </div>
  );
}

/* ── Slider dropdown ────────────────────────────────────────────── */

function SliderDropdown({ title, value, onChange, presets, description }: {
  title: string;
  value: number;
  onChange: (v: number) => void;
  presets: { value: number; label: string }[];
  description?: string;
}) {
  return (
    <div className="p-3 min-w-[160px] space-y-2">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">{title}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1 accent-primary"
        />
        <span className="text-[10px] font-mono text-primary w-8 text-right">{value}%</span>
      </div>
      <div className="flex gap-1">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={cn(
              "flex-1 px-1 py-0.5 text-[8px] rounded transition-colors",
              value === p.value ? "bg-primary/20 text-primary" : "bg-secondary/30 text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {description && <p className="text-[7px] text-muted-foreground/50">{description}</p>}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

function ViewportControlsInner(props: ViewportControlsProps) {
  const { isMobile } = props;

  return (
    <>
      {/* Camera angle buttons — top-left */}
      <div className={cn("absolute top-2 left-2 flex gap-1 z-10", isMobile && "flex-wrap max-w-[60%]")}>
        {CAMERA_BUTTONS.map((cam) => (
          <button
            key={cam.id}
            onClick={() => props.setCameraPreset(cam.id)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium rounded-md backdrop-blur-xl transition-all touch-target",
              props.cameraPreset === cam.id
                ? "bg-primary/20 text-primary border border-primary/30 shadow-sm shadow-primary/10"
                : "bg-card/60 text-muted-foreground border border-builder-divider hover:bg-card/80 hover:text-foreground",
              isMobile && "px-3 py-1.5 text-[11px]"
            )}
          >
            {cam.label}
          </button>
        ))}
        {!isMobile && (
          <AIGenerateOverlay
            params={props.params}
            lunarTexture={props.lunarTexture}
            viewMode={props.viewMode}
            metalPreset={props.metalPreset}
            finishPreset={props.finishPreset}
            onUpdateParams={props.onUpdateParams}
            onLunarChange={props.onLunarChange}
            onViewModeChange={props.onViewModeChange}
            onMetalChange={props.onMetalChange}
            onFinishChange={props.onFinishChange}
          />
        )}
      </div>

      {/* View controls — top-right */}
      <div className={cn("absolute top-2 right-2 z-10 flex flex-col gap-1.5 items-end", isMobile && "max-w-[50%]")}>
        {/* Cutaway row */}
        <div className="flex gap-1 flex-wrap justify-end">
          {(isMobile
            ? (["normal", "inside"] as CutawayMode[])
            : (["normal", "inside", "cross-section", "quarter-cut"] as CutawayMode[])
          ).map((mode) => {
            const labels: Record<CutawayMode, string> = { normal: "Full", inside: "Inside", "cross-section": "X-Section", "quarter-cut": "¼ Cut" };
            const icons: Record<CutawayMode, string> = { normal: "◉", inside: "◔", "cross-section": "◑", "quarter-cut": "◕" };
            return (
              <button
                key={mode}
                onClick={() => { props.setCutawayMode(mode); props.setCutawayOffset(0); }}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded backdrop-blur-sm transition-all touch-target",
                  props.cutawayMode === mode
                    ? "bg-primary/30 text-primary border border-primary/40"
                    : "bg-card/70 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground",
                  isMobile && "px-2.5 py-1.5"
                )}
                title={labels[mode]}
              >
                {isMobile ? icons[mode] : labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Clip offset slider */}
        {props.cutawayMode !== "normal" && (
          <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border/50 rounded-md px-2.5 py-1.5">
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">Clip</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={props.cutawayOffset * 100}
              onChange={(e) => props.setCutawayOffset(Number(e.target.value) / 100)}
              className="w-20 h-1 accent-primary cursor-pointer"
            />
            <button
              onClick={() => props.setCutawayOffset(0)}
              className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
              title="Reset clip position"
            >
              ↺
            </button>
          </div>
        )}

        {/* Tools row */}
        <div className="flex gap-1">
          {!isMobile && (
            <button
              onClick={() => props.setShowMeasurements(!props.showMeasurements)}
              className={toolBtnClass(props.showMeasurements || props.activeTool === "measure")}
              title="Toggle dimension guides"
            >
              📐
            </button>
          )}
          <button
            onClick={() => props.setShowcaseMode(!props.showcaseMode)}
            className={toolBtnClass(props.showcaseMode)}
            title="High-quality showcase render"
          >
            <Sparkles className="w-3 h-3" />
          </button>

          {/* Background picker */}
          <HoverDropdown
            trigger={
              <button className={toolBtnClass(false)} title="Change background">
                <Eye className="w-3 h-3" />
              </button>
            }
          >
            <div className="py-1 min-w-[140px]">
              {BG_PRESETS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => props.setBgPreset(bg.id)}
                  className={cn(
                    "w-full px-3 py-1.5 text-[10px] text-left hover:bg-muted/50 transition-colors flex items-center gap-2",
                    props.bgPreset === bg.id ? "text-primary" : "text-foreground"
                  )}
                >
                  <span>{bg.icon}</span> {bg.label}
                </button>
              ))}
            </div>
          </HoverDropdown>

          {!isMobile && (
            <>
              <button
                onClick={() => props.setInspectionMode(!props.inspectionMode)}
                className={toolBtnClass(props.inspectionMode)}
                title="Inspection mode"
              >
                <Search className="w-3 h-3" />
              </button>
              <button
                onClick={() => props.setLoupeActive(!props.loupeActive)}
                className={toolBtnClass(props.loupeActive)}
                title="Magnifier loupe — scroll to zoom"
              >
                <ZoomIn className="w-3 h-3" />
              </button>

              {/* Detail Boost */}
              <HoverDropdown
                align="right"
                trigger={
                  <button
                    className={toolBtnClass(props.detailBoost > 0, "secondary")}
                    title="Exaggerate surface detail for inspection"
                    onClick={() => props.setDetailBoost(props.detailBoost > 0 ? 0 : 50)}
                  >
                    🔬
                  </button>
                }
              >
                <SliderDropdown
                  title="Detail Boost"
                  value={props.detailBoost}
                  onChange={props.setDetailBoost}
                  presets={[
                    { value: 0, label: "Off" },
                    { value: 25, label: "Low" },
                    { value: 50, label: "Med" },
                    { value: 75, label: "High" },
                    { value: 100, label: "Max" },
                  ]}
                  description="Exaggerates crater depth, rim sharpness, and engraving clarity for inspection"
                />
              </HoverDropdown>

              {/* Thickness heatmap */}
              <button
                onClick={() => props.setThicknessHeatmap(!props.thicknessHeatmap)}
                className={toolBtnClass(props.thicknessHeatmap, "destructive")}
                title="Thickness heatmap — shows thin/thick areas for casting safety"
              >
                <Thermometer className="w-3 h-3" />
              </button>

              {/* Printer bed */}
              <button
                onClick={() => {
                  props.setShowPrinterBed(!props.showPrinterBed);
                  if (!props.showPrinterBed) props.setRingRotation([Math.PI / 2, 0, 0]);
                }}
                className={toolBtnClass(props.showPrinterBed)}
                title="Print bed"
              >
                <Printer className="w-3 h-3" />
              </button>

              {/* Turntable */}
              <HoverDropdown
                trigger={
                  <button
                    onClick={() => props.setTurntableSpeed(props.turntableSpeed > 0 ? 0 : 2)}
                    className={toolBtnClass(props.turntableSpeed > 0)}
                    title={props.turntableSpeed > 0 ? "Stop turntable" : "Start turntable rotation"}
                  >
                    <RotateCw className={cn("w-3 h-3", props.turntableSpeed > 0 && "animate-spin")} style={props.turntableSpeed > 0 ? { animationDuration: "3s" } : undefined} />
                  </button>
                }
              >
                {props.turntableSpeed > 0 && (
                  <div className="p-2 min-w-[120px]">
                    <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider mb-1.5 text-center">Speed</p>
                    <div className="flex gap-1 justify-center">
                      {[1, 2, 4, 8].map((spd) => (
                        <button
                          key={spd}
                          onClick={(e) => { e.stopPropagation(); props.setTurntableSpeed(spd); }}
                          className={cn(
                            "px-2 py-1 text-[9px] rounded transition-all",
                            props.turntableSpeed === spd
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-secondary/40 text-muted-foreground border border-border/30 hover:text-foreground"
                          )}
                        >
                          {spd === 1 ? "Slow" : spd === 2 ? "Med" : spd === 4 ? "Fast" : "Spin"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </HoverDropdown>

              {/* Rotation lock */}
              <button
                onClick={() => props.setRotationLocked(!props.rotationLocked)}
                className={toolBtnClass(props.rotationLocked, "warning")}
                title={props.rotationLocked ? "Unlock rotation" : "Lock rotation to inspect area"}
              >
                {props.rotationLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </button>

              {/* Scale reference */}
              <HoverDropdown trigger={
                <button className={toolBtnClass(props.scaleReference !== "none", "secondary")} title="Show scale reference">
                  <Ruler className="w-3 h-3" />
                </button>
              }>
                <div className="py-1 min-w-[120px]">
                  {([
                    { id: "none" as ScaleReferenceType, label: "None", icon: null },
                    { id: "quarter" as ScaleReferenceType, label: "US Quarter", icon: <Circle className="w-3 h-3" /> },
                    { id: "ruler" as ScaleReferenceType, label: "Ruler (mm)", icon: <Ruler className="w-3 h-3" /> },
                    { id: "finger" as ScaleReferenceType, label: "Ring Finger", icon: <Hand className="w-3 h-3" /> },
                  ]).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => props.setScaleReference(item.id)}
                      className={cn("w-full px-3 py-1.5 text-[10px] text-left hover:bg-muted/50 transition-colors flex items-center gap-2",
                        props.scaleReference === item.id ? "text-primary" : "text-foreground")}
                    >
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
              </HoverDropdown>

              {/* Wear preview */}
              <HoverDropdown align="right" trigger={
                <button className={toolBtnClass(props.wearPreview > 0, "accent")} title="Wear & aging preview">
                  <Clock className="w-3 h-3" />
                </button>
              }>
                <SliderDropdown
                  title="Wear Preview"
                  value={props.wearPreview}
                  onChange={props.setWearPreview}
                  presets={[
                    { value: 0, label: "New" },
                    { value: 25, label: "1yr" },
                    { value: 50, label: "5yr" },
                    { value: 75, label: "10yr" },
                    { value: 100, label: "20yr" },
                  ]}
                  description={props.lunarTexture?.enabled
                    ? "Simulates crater erosion, rim flattening, and surface wear"
                    : "Simulates edge softening and surface wear over time"}
                />
              </HoverDropdown>

              {/* Polish preview */}
              <HoverDropdown align="right" trigger={
                <button className={toolBtnClass(props.polishPreview > 0)} title="Polishing simulation">
                  ✨
                </button>
              }>
                <SliderDropdown
                  title="Polish Preview"
                  value={props.polishPreview}
                  onChange={props.setPolishPreview}
                  presets={[
                    { value: 0, label: "Raw" },
                    { value: 25, label: "Buff" },
                    { value: 50, label: "Std" },
                    { value: 75, label: "Mirror" },
                    { value: 100, label: "Max" },
                  ]}
                  description={props.lunarTexture?.enabled
                    ? "Softens crater rims and sharpens reflections like hand polishing"
                    : "Simulates jeweller's polishing — smoother, shinier finish"}
                />
              </HoverDropdown>

              {/* Studio / Render / Compare / Prefs */}
              <button onClick={() => props.setStudioRenderOpen(true)} className={toolBtnClass(false)} title="Studio render mode">
                <Aperture className="w-3 h-3" />
              </button>
              <button onClick={() => props.setRenderGalleryOpen(true)} className={toolBtnClass(false)} title="Generate beauty renders">
                <Camera className="w-3 h-3" />
              </button>
              <button
                onClick={props.onCaptureSnapshot}
                className={toolBtnClass(!!props.compareSnapshot)}
                title={props.compareSnapshot ? "Re-capture snapshot for comparison" : "Capture snapshot to compare"}
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>
              <button onClick={() => props.setPrefsOpen(true)} className={toolBtnClass(false)} title="Designer preferences">
                <Settings2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const ViewportControls = memo(ViewportControlsInner);
export default ViewportControls;
