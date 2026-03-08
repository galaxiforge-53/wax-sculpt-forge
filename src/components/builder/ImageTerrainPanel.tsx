import { useCallback, useRef, useState } from "react";
import { ImageTerrainState, ImageTerrainMode, DEFAULT_IMAGE_TERRAIN } from "@/types/imageTerrain";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, Image, Layers, ArrowDown, ArrowUp, RotateCcw, FlipVertical } from "lucide-react";
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

export default function ImageTerrainPanel({ state, onChange }: ImageTerrainPanelProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(state.imageDataUrl);

  const patch = useCallback(
    (p: Partial<ImageTerrainState>) => onChange({ ...state, ...p }),
    [state, onChange],
  );

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, etc.)", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB for terrain images.", variant: "destructive" });
      return;
    }

    // Read as data URL
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      // Resize to max 1024px for performance
      const img = new Image();
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

    // Reset input so same file can be re-selected
    e.target.value = "";
  }, [patch, toast]);

  const handleClear = useCallback(() => {
    setPreviewUrl(null);
    onChange({ ...DEFAULT_IMAGE_TERRAIN });
  }, [onChange]);

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
        <div className="relative group">
          <img
            src={previewUrl}
            alt="Terrain source"
            className="w-full h-20 object-cover rounded-lg border border-border/50"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-6 text-[9px] px-2"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-[9px] px-2"
              onClick={handleClear}
            >
              Remove
            </Button>
          </div>
          {state.fileName && (
            <span className="absolute bottom-1 left-1 text-[8px] text-white/70 bg-black/40 px-1 rounded">
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

      {/* Only show controls if an image is loaded */}
      {state.imageDataUrl && (
        <>
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

          {/* Parameters */}
          <div className="space-y-2">
            <ParamRow label="Depth" value={state.depth} onChange={(v) => patch({ depth: v })} />
            <ParamRow label="Scale" value={state.scale} onChange={(v) => patch({ scale: v })} min={10} max={400} />
            <ParamRow label="Contrast" value={state.contrast} onChange={(v) => patch({ contrast: v })} min={0} max={200} />
            <ParamRow label="Smoothing" value={state.smoothing} onChange={(v) => patch({ smoothing: v })} min={0} max={20} />
            {(state.mode === "engraved" || state.mode === "raised") && (
              <ParamRow label="Threshold" value={state.threshold} onChange={(v) => patch({ threshold: v })} />
            )}
          </div>

          {/* Tiling & offset */}
          <div className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 block">Tiling & Position</span>
            <div className="grid grid-cols-2 gap-2">
              <ParamRow label="Tile U" value={state.tileU} onChange={(v) => patch({ tileU: v })} min={1} max={8} step={1} unit="×" />
              <ParamRow label="Tile V" value={state.tileV} onChange={(v) => patch({ tileV: v })} min={1} max={4} step={1} unit="×" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ParamRow label="Offset U" value={state.offsetU} onChange={(v) => patch({ offsetU: v })} />
              <ParamRow label="Offset V" value={state.offsetV} onChange={(v) => patch({ offsetV: v })} />
            </div>
          </div>

          {/* Invert toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FlipVertical className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground">Invert heights</span>
            </div>
            <Switch checked={state.invert} onCheckedChange={(v) => patch({ invert: v })} />
          </div>

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
            })}
          >
            <RotateCcw className="w-3 h-3" /> Reset Parameters
          </Button>
        </>
      )}
    </div>
  );
}
