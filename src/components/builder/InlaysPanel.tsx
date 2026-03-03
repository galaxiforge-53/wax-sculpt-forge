import { useState } from "react";
import { InlayChannel, InlayMaterialType, InlayPlacement } from "@/types/inlays";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Plus, ExternalLink, Gem } from "lucide-react";

interface InlaysPanelProps {
  inlays: InlayChannel[];
  onAdd: (input: Omit<InlayChannel, "id" | "createdAt">) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const MATERIAL_LABELS: Record<InlayMaterialType, string> = {
  crystal: "Crystal",
  opal: "Opal",
  meteorite: "Meteorite",
};

const MATERIAL_COLORS: Record<InlayMaterialType, string> = {
  crystal: "bg-primary/20 text-primary",
  opal: "bg-accent/20 text-accent-foreground",
  meteorite: "bg-muted text-muted-foreground",
};

const PLACEMENT_LABELS: Record<InlayPlacement, string> = {
  center: "Center",
  edgeLeft: "Left Edge",
  edgeRight: "Right Edge",
};

const OPAL_PRESETS = [
  { name: "White Opal", url: "https://galaxiforge.com/crystal-codex/opal/white" },
  { name: "Black Opal", url: "https://galaxiforge.com/crystal-codex/opal/black" },
  { name: "Boulder Opal", url: "https://galaxiforge.com/crystal-codex/opal/boulder" },
  { name: "Fire Opal", url: "https://galaxiforge.com/crystal-codex/opal/fire" },
];

export default function InlaysPanel({ inlays, onAdd, onRemove, onClear }: InlaysPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);

  // Add form state
  const [materialType, setMaterialType] = useState<InlayMaterialType>("crystal");
  const [placement, setPlacement] = useState<InlayPlacement>("center");
  const [width, setWidth] = useState(1.5);
  const [depth, setDepth] = useState(0.8);
  const [codexUrl, setCodexUrl] = useState("");
  const [displayName, setDisplayName] = useState("");

  const resetForm = () => {
    setMaterialType("crystal");
    setPlacement("center");
    setWidth(1.5);
    setDepth(0.8);
    setCodexUrl("");
    setDisplayName("");
  };

  const handleAdd = () => {
    const name = displayName.trim() || parseDisplayName(codexUrl) || `${MATERIAL_LABELS[materialType]} Inlay`;
    const url = codexUrl.trim() || `https://galaxiforge.com/crystal-codex/${materialType}`;
    onAdd({
      materialType,
      displayName: name,
      codexUrl: url,
      placement,
      channelWidthMm: width,
      channelDepthMm: depth,
    });
    resetForm();
    setAddOpen(false);
  };

  const applyOpalPreset = (preset: { name: string; url: string }) => {
    setDisplayName(preset.name);
    setCodexUrl(preset.url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-display flex items-center gap-1.5">
          <Gem className="w-3 h-3" />
          Inlays
        </h3>
        <span className="text-[10px] text-muted-foreground">{inlays.length} channel{inlays.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Channel list */}
      {inlays.length > 0 && (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {inlays.map((ch) => (
            <div key={ch.id} className="flex items-center gap-1.5 p-1.5 rounded bg-secondary border border-border/50 text-[10px]">
              <Badge variant="outline" className={`${MATERIAL_COLORS[ch.materialType]} text-[9px] px-1 py-0`}>
                {MATERIAL_LABELS[ch.materialType]}
              </Badge>
              <span className="flex-1 truncate text-foreground">{ch.displayName}</span>
              <span className="text-muted-foreground">{PLACEMENT_LABELS[ch.placement]}</span>
              <button
                onClick={() => onRemove(ch.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" className="flex-1 text-[10px] h-6" onClick={() => setAddOpen(true)}>
          <Plus className="w-3 h-3 mr-1" /> Add Channel
        </Button>
        {inlays.length > 0 && (
          <Button variant="ghost" size="sm" className="text-[10px] h-6 text-muted-foreground" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>

      {/* Add Channel Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Inlay Channel</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure an inlay channel with a GalaxiForge Codex material.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Material type */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Material Type</Label>
              <Select value={materialType} onValueChange={(v) => setMaterialType(v as InlayMaterialType)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crystal">Crystal</SelectItem>
                  <SelectItem value="opal">Opal</SelectItem>
                  <SelectItem value="meteorite">Meteorite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Opal quick picks */}
            {materialType === "opal" && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Quick Select</Label>
                <div className="flex flex-wrap gap-1">
                  {OPAL_PRESETS.map((p) => (
                    <Button
                      key={p.name}
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-6 px-2"
                      onClick={() => applyOpalPreset(p)}
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Placement */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Placement</Label>
              <Select value={placement} onValueChange={(v) => setPlacement(v as InlayPlacement)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="edgeLeft">Left Edge</SelectItem>
                  <SelectItem value="edgeRight">Right Edge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Width */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Channel Width: {width.toFixed(1)}mm</Label>
              <Slider value={[width]} onValueChange={([v]) => setWidth(v)} min={0.5} max={4.0} step={0.1} />
            </div>

            {/* Depth */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Channel Depth: {depth.toFixed(1)}mm</Label>
              <Slider value={[depth]} onValueChange={([v]) => setDepth(v)} min={0.3} max={2.0} step={0.1} />
            </div>

            {/* Codex URL */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Codex Link</Label>
                <button
                  onClick={() => setCodexOpen(true)}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> Browse Codex
                </button>
              </div>
              <Input
                value={codexUrl}
                onChange={(e) => setCodexUrl(e.target.value)}
                placeholder="https://galaxiforge.com/crystal-codex/..."
                className="h-7 text-xs"
              />
            </div>

            {/* Display name */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={`${MATERIAL_LABELS[materialType]} Inlay`}
                className="h-7 text-xs"
              />
            </div>

            <Button className="w-full text-xs h-8" onClick={handleAdd}>
              Add Inlay Channel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Crystal Codex Browser Dialog */}
      <Dialog open={codexOpen} onOpenChange={setCodexOpen}>
        <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">GalaxiForge Crystal Codex</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Browse the Codex library. Copy the URL of your selection and paste it into the Codex Link field.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 rounded border border-border overflow-hidden">
            <iframe
              src="https://galaxiforge.com/crystal-codex/library"
              className="w-full h-full"
              title="Crystal Codex Library"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setCodexOpen(false)} className="self-end text-xs">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseDisplayName(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const crystalParam = u.searchParams.get("crystal");
    if (crystalParam) return crystalParam.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last !== "library") return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch { /* ignore */ }
  return "Codex Item";
}
