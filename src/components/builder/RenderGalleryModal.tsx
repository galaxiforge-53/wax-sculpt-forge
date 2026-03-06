import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Download, Share2, Loader2, Image, RefreshCw, Check } from "lucide-react";
import { SnapshotAngle, RingViewportHandle } from "./RingViewport";
import { ViewMode, MetalPreset, FinishPreset, RingParameters } from "@/types/ring";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface RenderShot {
  id: string;
  label: string;
  angle: SnapshotAngle;
  description: string;
}

const RENDER_SHOTS: RenderShot[] = [
  { id: "hero", label: "Hero", angle: "angle", description: "Classic 45° beauty shot" },
  { id: "front", label: "Front", angle: "front", description: "Head-on symmetry view" },
  { id: "profile", label: "Profile", angle: "side", description: "Side silhouette" },
  { id: "interior", label: "Interior", angle: "inside", description: "Inner bore detail" },
];

interface RenderResult {
  id: string;
  label: string;
  dataUrl: string;
  timestamp: number;
}

interface RenderGalleryModalProps {
  open: boolean;
  onClose: () => void;
  viewportRef: React.RefObject<RingViewportHandle | null>;
  viewMode: ViewMode;
  metalPreset: MetalPreset;
  finishPreset: FinishPreset;
  params: RingParameters;
}

export default function RenderGalleryModal({
  open,
  onClose,
  viewportRef,
  viewMode,
  metalPreset,
  finishPreset,
  params,
}: RenderGalleryModalProps) {
  const [renders, setRenders] = useState<RenderResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const generateAllRenders = useCallback(async () => {
    if (!viewportRef.current) return;
    setGenerating(true);
    setRenders([]);

    const results: RenderResult[] = [];
    // Use cast mode for renders if we're in a cast-like view
    const captureMode: ViewMode = viewMode === "wax-print" ? "wax-print" : "cast";

    for (const shot of RENDER_SHOTS) {
      try {
        const dataUrl = await viewportRef.current.captureSnapshot(shot.angle, captureMode);
        if (dataUrl && dataUrl.length > 100) {
          results.push({
            id: shot.id,
            label: shot.label,
            dataUrl,
            timestamp: Date.now(),
          });
          // Update incrementally so user sees progress
          setRenders([...results]);
        }
      } catch {
        // Skip failed captures
      }
      // Small delay between captures for stability
      await new Promise((r) => setTimeout(r, 150));
    }

    setGenerating(false);
    if (results.length > 0) {
      toast({ title: `📸 ${results.length} renders captured`, description: "Click any image to select, then download or share." });
    }
  }, [viewportRef, viewMode, toast]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === renders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(renders.map((r) => r.id)));
    }
  };

  const downloadSelected = () => {
    const toDownload = renders.filter((r) => selectedIds.has(r.id));
    if (toDownload.length === 0) {
      toast({ title: "Select renders first", description: "Click on images to select them for download." });
      return;
    }

    const sizeName = `US${params.size}`;
    const metalName = metalPreset.replace("-", "");

    toDownload.forEach((render, i) => {
      const link = document.createElement("a");
      link.href = render.dataUrl;
      link.download = `ring-${metalName}-${sizeName}-${render.label.toLowerCase()}.png`;
      document.body.appendChild(link);
      // Stagger downloads slightly
      setTimeout(() => {
        link.click();
        document.body.removeChild(link);
      }, i * 200);
    });

    toast({ title: `Downloading ${toDownload.length} image${toDownload.length > 1 ? "s" : ""}` });
  };

  const shareSelected = async () => {
    const toShare = renders.filter((r) => selectedIds.has(r.id));
    if (toShare.length === 0) {
      toast({ title: "Select renders first", description: "Click on images to select them for sharing." });
      return;
    }

    // Try native share API with files
    if (navigator.share && navigator.canShare) {
      try {
        const files = await Promise.all(
          toShare.map(async (render) => {
            const res = await fetch(render.dataUrl);
            const blob = await res.blob();
            return new File([blob], `ring-${render.label.toLowerCase()}.png`, { type: "image/png" });
          })
        );

        if (navigator.canShare({ files })) {
          await navigator.share({
            title: `Ring Design — ${metalPreset} US${params.size}`,
            text: `Check out this ${metalPreset} ring design!`,
            files,
          });
          return;
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          // Fallback below
        } else {
          return;
        }
      }
    }

    // Fallback: copy first image to clipboard
    try {
      const res = await fetch(toShare[0].dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast({ title: "Copied to clipboard", description: "Image copied — paste it anywhere." });
    } catch {
      toast({ title: "Share unavailable", description: "Download the images instead.", variant: "destructive" });
    }
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-lg tracking-wide flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Render Gallery
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {metalLabel[metalPreset]} · US {params.size} · {params.width}mm wide
          </p>
        </DialogHeader>

        {/* Generate / Action bar */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={generateAllRenders}
            disabled={generating}
            className="gap-2"
            size="sm"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Capturing…</>
            ) : renders.length > 0 ? (
              <><RefreshCw className="w-4 h-4" /> Re-render</>
            ) : (
              <><Camera className="w-4 h-4" /> Generate Renders</>
            )}
          </Button>

          {renders.length > 0 && (
            <>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="text-xs gap-1.5"
              >
                <Check className="w-3 h-3" />
                {selectedIds.size === renders.length ? "Deselect All" : "Select All"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSelected}
                disabled={selectedIds.size === 0}
                className="text-xs gap-1.5"
              >
                <Download className="w-3 h-3" /> Download{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={shareSelected}
                disabled={selectedIds.size === 0}
                className="text-xs gap-1.5"
              >
                <Share2 className="w-3 h-3" /> Share
              </Button>
            </>
          )}
        </div>

        {/* Gallery grid */}
        <div className="flex-1 overflow-y-auto mt-3">
          {renders.length === 0 && !generating && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Image className="w-12 h-12 opacity-30" />
              <p className="text-sm">Click <strong>Generate Renders</strong> to capture beauty shots of your ring.</p>
              <p className="text-xs opacity-60">4 angles · High-resolution · Ready for sharing</p>
            </div>
          )}

          {generating && renders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm">Setting up studio lighting…</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {renders.map((render) => {
              const shot = RENDER_SHOTS.find((s) => s.id === render.id);
              const selected = selectedIds.has(render.id);
              return (
                <button
                  key={render.id}
                  onClick={() => toggleSelect(render.id)}
                  className={cn(
                    "relative group rounded-xl overflow-hidden border-2 transition-all bg-background",
                    selected
                      ? "border-primary shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                      : "border-border/50 hover:border-border"
                  )}
                >
                  <img
                    src={render.dataUrl}
                    alt={render.label}
                    className="w-full aspect-square object-cover"
                    draggable={false}
                  />

                  {/* Selection indicator */}
                  <div className={cn(
                    "absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    selected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background/60 border-border backdrop-blur-sm"
                  )}>
                    {selected && <Check className="w-3.5 h-3.5" />}
                  </div>

                  {/* Label overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                    <p className="text-white text-sm font-medium font-display tracking-wide">{render.label}</p>
                    <p className="text-white/60 text-[10px]">{shot?.description}</p>
                  </div>

                  {/* Generating overlay */}
                  {generating && (
                    <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px] flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Placeholder slots while generating */}
            {generating && Array.from({ length: Math.max(0, RENDER_SHOTS.length - renders.length) }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                className="rounded-xl border-2 border-dashed border-border/30 aspect-square flex items-center justify-center bg-secondary/20"
              >
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
