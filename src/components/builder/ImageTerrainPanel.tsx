import { useCallback, useEffect, useRef, useState } from "react";
import { ImageTerrainState, ImageTerrainMode, DEFAULT_IMAGE_TERRAIN, IMAGE_TERRAIN_PRESETS } from "@/types/imageTerrain";
import { generateHeightmapPreview } from "@/lib/imageTerrainEngine";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NativeImage = globalThis.Image;
import {
  Upload, Layers, ArrowDown, ArrowUp, RotateCcw, FlipVertical,
  Moon, Flame, Zap, Eye, EyeOff, Sparkles, SlidersHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageTerrainPanelProps {
  state: ImageTerrainState;
  onChange: (state: ImageTerrainState) => void;
}

const MODES: { id: ImageTerrainMode; label: string; desc: string }[] = [
  { id: "heightmap", label: "Heightmap", desc: "Brightness → height" },
  { id: "engraved", label: "Engraved", desc: "Cut into surface" },
  { id: "raised", label: "Raised", desc: "Relief above surface" },
];

const PRESET_ICONS: Record<string, React.ReactNode> = {
  moon: <Moon className="w-3.5 h-3.5" />,
  flame: <Flame className="w-3.5 h-3.5" />,
  zap: <Zap className="w-3.5 h-3.5" />,
  "arrow-down": <ArrowDown className="w-3.5 h-3.5" />,
  "arrow-up": <ArrowUp className="w-3.5 h-3.5" />,
};

function ParamRow({
  label, value, onChange, min = 0, max = 100, step = 1, unit = "%",
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-foreground/70">{value}{unit}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
}

function BeforeAfterPreview({ originalUrl, processedUrl }: { originalUrl: string; processedUrl: string | null }) {
  const [showProcessed, setShowProcessed] = useState(true);

  return (
    <div className="relative rounded-lg overflow-hidden border border-border/50">
      <img
        src={showProcessed && processedUrl ? processedUrl : originalUrl}
        alt={showProcessed ? "Processed terrain" : "Original image"}
        className="w-full h-16 object-cover"
      />
      <div className="absolute top-1 right-1 flex gap-1">
        <button
          onClick={() => setShowProcessed(false)}
          className={cn(
            "px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors",
            !showProcessed
              ? "bg-primary text-primary-foreground"
              : "bg-black/40 text-white/70 hover:bg-black/60"
          )}
        >
          Original
        </button>
        <button
          onClick={() => setShowProcessed(true)}
          className={cn(
            "px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors",
            showProcessed
              ? "bg-primary text-primary-foreground"
              : "bg-black/40 text-white/70 hover:bg-black/60"
          )}
        >
          Terrain
        </button>
      </div>
      <span className="absolute bottom-1 left-1 text-[7px] text-white/60 bg-black/30 px-1 rounded">
        {showProcessed ? "Processed heightmap" : "Source image"}
      </span>
    </div>
  );
}

export default function ImageTerrainPanel({ state, onChange }: ImageTerrainPanelProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(state.imageDataUrl);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>();

  const patch = useCallback(
    (p: Partial<ImageTerrainState>) => onChange({ ...state, ...p, presetId: p.presetId !== undefined ? p.presetId : null }),
    [state, onChange],
  );

  // Generate processed preview with debounce
  useEffect(() => {
    if (!state.imageDataUrl || !state.enabled) {
      setProcessedPreview(null);
      return;
    }
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      const url = await generateHeightmapPreview(state);
      setProcessedPreview(url);
    }, 400);
    return () => clearTimeout(previewTimer.current);
  }, [state]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, etc.)", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB for terrain images.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new NativeImage();
      img.onload = () => {
        const maxDim = 1024;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const resizedUrl = canvas.toDataURL("image/png", 0.9);
        setPreviewUrl(resizedUrl);
        patch({ imageDataUrl: resizedUrl, fileName: file.name, enabled: true });
        toast({ title: "Image loaded", description: `${file.name} (${w}×${h})` });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [patch, toast]);

  const handleClear = useCallback(() => {
    setPreviewUrl(null);
    setProcessedPreview(null);
    onChange({ ...DEFAULT_IMAGE_TERRAIN });
  }, [onChange]);

  const applyPreset = useCallback((presetId: string) => {
    const preset = IMAGE_TERRAIN_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    onChange({
      ...state,
      ...preset.params,
      presetId,
      imageDataUrl: state.imageDataUrl,
      fileName: state.fileName,
      enabled: state.enabled,
    });
  }, [state, onChange]);

  return (
    <div className="space-y-3">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Image Terrain</span>
        <Switch
          checked={state.enabled}
          onCheckedChange={(v) => patch({ enabled: v })}
          disabled={!state.imageDataUrl}
        />
      </div>

      {/* Upload area */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {previewUrl ? (
        <div className="space-y-2">
          {/* Before/After preview */}
          <BeforeAfterPreview originalUrl={previewUrl} processedUrl={processedPreview} />
          {/* Replace / Remove */}
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 h-6 text-[9px] px-2"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 h-6 text-[9px] px-2"
              onClick={handleClear}
            >
              Remove
            </Button>
          </div>
          {state.fileName && (
            <span className="text-[8px] text-muted-foreground/60 block truncate">
              {state.fileName}
            </span>
          )}
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-20 border-2 border-dashed border-border/50 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <Upload className="w-5 h-5 text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground">Upload image</span>
          <span className="text-[8px] text-muted-foreground/50">PNG, JPG, SVG • max 10 MB</span>
        </button>
      )}

      {/* Controls only when image is loaded */}
      {state.imageDataUrl && (
        <>
          {/* Presets */}
          <div>
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5 block">Presets</span>
            <div className="grid grid-cols-2 gap-1">
              {IMAGE_TERRAIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 rounded-lg transition-all border text-left",
                    state.presetId === preset.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                  )}
                >
                  {PRESET_ICONS[preset.icon] || <Sparkles className="w-3.5 h-3.5" />}
                  <div className="min-w-0">
                    <span className="text-[9px] font-medium leading-none block truncate">{preset.label}</span>
                    <span className="text-[7px] text-muted-foreground/60 leading-none block truncate">{preset.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mode selector */}
          <div>
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5 block">Mode</span>
            <div className="grid grid-cols-3 gap-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => patch({ mode: m.id })}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all border text-center",
                    state.mode === m.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                  )}
                >
                  {m.id === "heightmap" && <Layers className="w-3.5 h-3.5" />}
                  {m.id === "engraved" && <ArrowDown className="w-3.5 h-3.5" />}
                  {m.id === "raised" && <ArrowUp className="w-3.5 h-3.5" />}
                  <span className="text-[9px] font-medium leading-none">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Core parameters */}
          <div className="space-y-2">
            <ParamRow label="Depth" value={state.depth} onChange={(v) => patch({ depth: v })} />
            <ParamRow label="Scale" value={state.scale} onChange={(v) => patch({ scale: v })} min={10} max={400} />
            <ParamRow label="Contrast" value={state.contrast} onChange={(v) => patch({ contrast: v })} min={0} max={200} />
            <ParamRow label="Smoothing" value={state.smoothing} onChange={(v) => patch({ smoothing: v })} min={0} max={20} />
            <ParamRow label="Sharpness" value={state.sharpness} onChange={(v) => patch({ sharpness: v })} min={0} max={100} />
            <ParamRow label="Wrap Correction" value={state.wrapCorrection} onChange={(v) => patch({ wrapCorrection: v })} min={0} max={100} />
            {(state.mode === "engraved" || state.mode === "raised") && (
              <ParamRow label="Threshold" value={state.threshold} onChange={(v) => patch({ threshold: v })} />
            )}
          </div>

          {/* Auto cleanup toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground">Auto cleanup</span>
            </div>
            <Switch checked={state.autoCleanup} onCheckedChange={(v) => patch({ autoCleanup: v })} />
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 w-full text-[9px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{showAdvanced ? "Hide" : "Show"} advanced controls</span>
          </button>

          {showAdvanced && (
            <div className="space-y-2 pl-1 border-l-2 border-border/30">
              <div className="grid grid-cols-2 gap-2">
                <ParamRow label="Tile U" value={state.tileU} onChange={(v) => patch({ tileU: v })} min={1} max={8} step={1} unit="×" />
                <ParamRow label="Tile V" value={state.tileV} onChange={(v) => patch({ tileV: v })} min={1} max={4} step={1} unit="×" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ParamRow label="Offset U" value={state.offsetU} onChange={(v) => patch({ offsetU: v })} />
                <ParamRow label="Offset V" value={state.offsetV} onChange={(v) => patch({ offsetV: v })} />
              </div>

              {/* Invert toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FlipVertical className="w-3 h-3 text-muted-foreground/60" />
                  <span className="text-[10px] text-muted-foreground">Invert heights</span>
                </div>
                <Switch checked={state.invert} onCheckedChange={(v) => patch({ invert: v })} />
              </div>
            </div>
          )}

          {/* Reset */}
          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 text-[10px] gap-1"
            onClick={() => patch({
              ...DEFAULT_IMAGE_TERRAIN,
              imageDataUrl: state.imageDataUrl,
              fileName: state.fileName,
              enabled: state.enabled,
              presetId: null,
            })}
          >
            <RotateCcw className="w-3 h-3" /> Reset Parameters
          </Button>
        </>
      )}
    </div>
  );
}
