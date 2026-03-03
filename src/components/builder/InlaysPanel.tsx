import { useState, useMemo } from "react";
import { InlayChannel, InlayMaterialType, InlayPlacement } from "@/types/inlays";
import { CodexMaterial, CodexMaterialType } from "@/types/codex";
import { CODEX_MATERIALS } from "@/lib/codexMaterials";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Plus, Gem, Search, Star } from "lucide-react";

interface InlaysPanelProps {
  inlays: InlayChannel[];
  onAdd: (input: Omit<InlayChannel, "id" | "createdAt">) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

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

const RARITY_COLORS: Record<string, string> = {
  common: "text-muted-foreground",
  rare: "text-primary",
  "ultra-rare": "text-yellow-500",
};

export default function InlaysPanel({ inlays, onAdd, onRemove, onClear }: InlaysPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<CodexMaterialType | "all">("all");
  const [selectedMaterial, setSelectedMaterial] = useState<CodexMaterial | null>(null);
  const [placement, setPlacement] = useState<InlayPlacement>("center");
  const [width, setWidth] = useState(1.5);
  const [depth, setDepth] = useState(0.8);

  const filteredMaterials = useMemo(() => {
    return CODEX_MATERIALS.filter((m) => {
      if (filterType !== "all" && m.type !== filterType) return false;
      if (search && !m.name.toLowerCase().includes(search.toLowerCase()) &&
          !(m.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [search, filterType]);

  const resetForm = () => {
    setSelectedMaterial(null);
    setPlacement("center");
    setWidth(1.5);
    setDepth(0.8);
    setSearch("");
    setFilterType("all");
  };

  const handleAdd = () => {
    if (!selectedMaterial) return;
    onAdd({
      materialType: selectedMaterial.type as InlayMaterialType,
      displayName: selectedMaterial.name,
      codexId: selectedMaterial.id,
      codexUrl: selectedMaterial.canonicalUrl,
      materialImage: selectedMaterial.image,
      placement,
      channelWidthMm: width,
      channelDepthMm: depth,
    });
    resetForm();
    setAddOpen(false);
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
                {ch.materialType}
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
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Inlay Channel</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a material from the Crystal Codex, then configure placement and dimensions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Search + Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search materials..."
                  className="h-7 text-xs pl-7"
                />
              </div>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as CodexMaterialType | "all")}>
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="crystal">Crystal</SelectItem>
                  <SelectItem value="opal">Opal</SelectItem>
                  <SelectItem value="meteorite">Meteorite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Material Grid */}
            <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
              {filteredMaterials.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMaterial(m)}
                  className={`flex flex-col items-center gap-1 p-2 rounded border text-[10px] transition-all ${
                    selectedMaterial?.id === m.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/50 bg-secondary hover:border-border hover:bg-secondary/80"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Gem className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-foreground font-medium truncate w-full text-center leading-tight">{m.name}</span>
                  <div className="flex items-center gap-0.5">
                    {m.rarity === "ultra-rare" && <Star className="w-2 h-2 text-yellow-500 fill-yellow-500" />}
                    {m.rarity === "rare" && <Star className="w-2 h-2 text-primary" />}
                    <span className={`${RARITY_COLORS[m.rarity ?? "common"]}`}>{m.rarity ?? "common"}</span>
                  </div>
                </button>
              ))}
              {filteredMaterials.length === 0 && (
                <div className="col-span-3 text-center text-[10px] text-muted-foreground py-4">
                  No materials match your search.
                </div>
              )}
            </div>

            {/* Selected material info */}
            {selectedMaterial && (
              <div className="flex items-center gap-2 p-2 rounded bg-primary/5 border border-primary/20 text-xs">
                <Gem className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{selectedMaterial.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{selectedMaterial.canonicalUrl}</div>
                </div>
                <Badge variant="outline" className={`${MATERIAL_COLORS[selectedMaterial.type as InlayMaterialType]} text-[9px]`}>
                  {selectedMaterial.type}
                </Badge>
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

            <Button
              className="w-full text-xs h-8"
              onClick={handleAdd}
              disabled={!selectedMaterial}
            >
              {selectedMaterial ? `Add ${selectedMaterial.name} Channel` : "Select a Material"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
