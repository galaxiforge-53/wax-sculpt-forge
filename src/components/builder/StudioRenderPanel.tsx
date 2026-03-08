import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Camera, Download, Loader2, Sun, Image, RotateCw, Aperture } from "lucide-react";
import { SnapshotAngle, RingViewportHandle, BackgroundPreset, BG_PRESETS } from "./RingViewport";
import { LightingSettings, LIGHTING_PRESETS, DEFAULT_LIGHTING } from "@/types/lighting";
import { ViewMode, MetalPreset, FinishPreset, RingParameters } from "@/types/ring";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/* ── Camera angle presets ─────────────────────────────────── */
interface CameraAngle {
  id: SnapshotAngle;
  label: string;
  icon: string;
  description: string;
}

const CAMERA_ANGLES: CameraAngle[] = [
  { id: "front", label: "Front", icon: "🎯", description: "Head-on symmetry" },
  { id: "angle", label: "Hero 45°", icon: "💎", description: "Classic beauty shot" },
  { id: "side", label: "Profile", icon: "📐", description: "Side silhouette" },
  { id: "inside", label: "Interior", icon: "🔍", description: "Inner bore detail" },
];

/* ── Render resolution presets ────────────────────────────── */
const RESOLUTIONS = [
  { label: "1×", scale: 1, desc: "Standard" },
  { label: "2×", scale: 2, desc: "High-DPI" },
  { label: "4×", scale: 4, desc: "Print-ready" },
] as const;

interface StudioRenderPanelProps {
  open: boolean;
  onClose: () => void;
  viewportRef: React.RefObject<RingViewportHandle | null>;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  params: RingParameters;
  lighting: LightingSettings;
  onLightingChange: (settings: LightingSettings) => void;
  bgPreset: BackgroundPreset;
  onBgPresetChange: (preset: BackgroundPreset) => void;
  onCameraPreset: (angle: SnapshotAngle) => void;
  turntableSpeed: number;
  onTurntableSpeedChange: (speed: number) => void;
}

/* ── Compact slider row ───────────────────────────────────── */
function StudioSlider({ label, value, min, max, step, onChange, suffix = "" }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-foreground">{value.toFixed(step < 1 ? 1 : 0)}{suffix}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} className="w-full" />
    </div>
  );
}

export default function StudioRenderPanel({
  open, onClose, viewportRef, viewMode, metalPreset, finishPreset, params,
  lighting, onLightingChange, bgPreset, onBgPresetChange, onCameraPreset,
  turntableSpeed, onTurntableSpeedChange,
}: StudioRenderPanelProps) {
  const [capturing, setCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<SnapshotAngle>("angle");
  const [resScale] = useState(2);
  const { toast } = useToast();

  const updateLight = (patch: Partial<LightingSettings>) => onLightingChange({ ...lighting, ...patch });

  const handleCapture = useCallback(async () => {
    if (!viewportRef.current) return;
    setCapturing(true);
    try {
      const dataUrl = await viewportRef.current.captureSnapshot(selectedAngle, viewMode === "wax-print" ? "wax-print" : "cast");
      if (dataUrl && dataUrl.length > 100) {
        setCapturedImage(dataUrl);
        toast({ title: "📸 Render captured", description: "Download your product shot below." });
      }
    } catch {
      toast({ title: "Capture failed", variant: "destructive" });
    }
    setCapturing(false);
  }, [viewportRef, selectedAngle, viewMode, toast]);

  const handleDownload = () => {
    if (!capturedImage) return;
    const link = document.createElement("a");
    link.href = capturedImage;
    link.download = `ring-studio-${metalPreset}-US${params.size}-${selectedAngle}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Downloading render…" });
  };

  const metalLabel: Record<MetalPreset, string> = {
    silver: "Sterling Silver",
    gold: "14K Gold",
    "rose-gold": "Rose Gold",
    titanium: "Titanium",
    tungsten: "Tungsten",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-lg tracking-wide flex items-center gap-2">
            <Aperture className="w-5 h-5 text-primary" />
            Studio Render
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {metalLabel[metalPreset]} · US {params.size} · {params.width}mm wide
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-2 flex flex-col lg:flex-row gap-4">
          {/* ── Left: Controls ──────────────────────────────────── */}
          <div className="w-full lg:w-64 shrink-0 space-y-4">
            {/* Camera Angle */}
            <section className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium flex items-center gap-1">
                <Camera className="w-3 h-3" /> Camera Angle
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {CAMERA_ANGLES.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => {
                      setSelectedAngle(cam.id);
                      onCameraPreset(cam.id);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] transition-all",
                      selectedAngle === cam.id
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "border-border bg-card/50 hover:bg-secondary/50 hover:border-primary/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="text-base">{cam.icon}</span>
                    <span className="font-medium">{cam.label}</span>
                    <span className="text-[8px] text-muted-foreground/70">{cam.description}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Lighting Presets */}
            <section className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium flex items-center gap-1">
                <Sun className="w-3 h-3" /> Lighting Preset
              </span>
              <div className="grid grid-cols-2 gap-1">
                {LIGHTING_PRESETS.slice(0, 8).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onLightingChange({ ...lighting, ...preset.settings })}
                    className={cn(
                      "px-2 py-1.5 rounded-md border text-[9px] transition-all text-center",
                      "border-border bg-card/50 hover:bg-secondary/50 hover:border-primary/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="mr-1">{preset.icon}</span>{preset.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Fine-tune lighting */}
            <section className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Fine-tune</span>
              <StudioSlider label="Key Light" value={lighting.keyIntensity} min={0.2} max={4} step={0.1} onChange={(v) => updateLight({ keyIntensity: v })} />
              <StudioSlider label="Fill Light" value={lighting.fillIntensity} min={0} max={2} step={0.1} onChange={(v) => updateLight({ fillIntensity: v })} />
              <StudioSlider label="Ambient" value={lighting.ambientIntensity} min={0} max={1.5} step={0.05} onChange={(v) => updateLight({ ambientIntensity: v })} />
              <StudioSlider label="Azimuth" value={lighting.azimuth} min={0} max={360} step={5} onChange={(v) => updateLight({ azimuth: v })} suffix="°" />
              <StudioSlider label="Elevation" value={lighting.elevation} min={0} max={90} step={5} onChange={(v) => updateLight({ elevation: v })} suffix="°" />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Warmth</span>
                  <span className="text-[10px] font-mono text-foreground">
                    {lighting.warmth < 40 ? "Cool" : lighting.warmth > 60 ? "Warm" : "Neutral"}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 rounded-full h-2 mt-[7px]" style={{
                    background: "linear-gradient(to right, #8ec8f0, #ffffff, #ffcc77)"
                  }} />
                  <Slider min={0} max={100} step={5} value={[lighting.warmth]} onValueChange={([v]) => updateLight({ warmth: v })} className="w-full relative" />
                </div>
              </div>
            </section>

            {/* Background */}
            <section className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium flex items-center gap-1">
                <Image className="w-3 h-3" /> Background
              </span>
              <div className="grid grid-cols-2 gap-1">
                {BG_PRESETS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => onBgPresetChange(bg.id)}
                    className={cn(
                      "px-2 py-1.5 rounded-md border text-[9px] transition-all flex items-center gap-1.5",
                      bgPreset === bg.id
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:text-foreground hover:border-primary/20"
                    )}
                  >
                    <span>{bg.icon}</span> {bg.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Turntable */}
            <section className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium flex items-center gap-1">
                <RotateCw className="w-3 h-3" /> Turntable
              </span>
              <div className="flex gap-1">
                {[
                  { label: "Off", speed: 0 },
                  { label: "Slow", speed: 1 },
                  { label: "Med", speed: 2 },
                  { label: "Fast", speed: 4 },
                ].map(({ label, speed }) => (
                  <button
                    key={speed}
                    onClick={() => onTurntableSpeedChange(speed)}
                    className={cn(
                      "flex-1 px-2 py-1.5 text-[9px] rounded-md border transition-all",
                      turntableSpeed === speed
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:text-foreground hover:border-primary/20"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* ── Right: Preview + Capture ────────────────────────── */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* Preview area shows either captured image or placeholder */}
            <div className="flex-1 rounded-xl border-2 border-dashed border-border/40 overflow-hidden flex items-center justify-center bg-secondary/10 min-h-[280px]">
              {capturedImage ? (
                <img src={capturedImage} alt="Studio render" className="max-w-full max-h-full object-contain" draggable={false} />
              ) : (
                <div className="text-center space-y-2 text-muted-foreground p-6">
                  <Aperture className="w-12 h-12 opacity-20 mx-auto" />
                  <p className="text-sm">Adjust your scene in the live viewport, then capture.</p>
                  <p className="text-[10px] opacity-50">Camera, lighting, and background changes apply in real-time</p>
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-2">
              <Button onClick={handleCapture} disabled={capturing} className="gap-2" size="sm">
                {capturing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Capturing…</>
                ) : (
                  <><Camera className="w-4 h-4" /> Capture Render</>
                )}
              </Button>
              {capturedImage && (
                <>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                    <Download className="w-3 h-3" /> Download PNG
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCapturedImage(null)} className="text-xs text-muted-foreground">
                    Clear
                  </Button>
                </>
              )}
            </div>

            {/* Resolution note */}
            <p className="text-[9px] text-muted-foreground/50">
              Renders use the current viewport resolution. Resize the browser window for larger output.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
