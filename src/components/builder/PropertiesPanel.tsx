import { RingParameters, RingProfile, RING_SIZE_MAP, ViewMode } from "@/types/ring";
import { WaxMarkType } from "@/types/waxmarks";
import { StampSettings } from "@/hooks/useRingDesign";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface PropertiesPanelProps {
  params: RingParameters;
  onUpdate: (updates: Partial<RingParameters>) => void;
  showMeasure: boolean;
  viewMode?: ViewMode;
  waxMarkCount?: number;
  onClearWaxMarks?: () => void;
  stampSettings?: StampSettings;
  onStampSettingsChange?: (s: StampSettings) => void;
}

const PROFILES: { value: RingProfile; label: string }[] = [
  { value: "flat", label: "Flat" },
  { value: "dome", label: "Dome" },
  { value: "comfort", label: "Comfort Fit" },
  { value: "square", label: "Square" },
  { value: "knife-edge", label: "Knife Edge" },
];

const STAMP_TYPES: { value: WaxMarkType; label: string }[] = [
  { value: "dent", label: "Dent" },
  { value: "scratch", label: "Scratch" },
  { value: "chisel", label: "Chisel" },
  { value: "heat-soften", label: "Heat Soften" },
];

export default function PropertiesPanel({ params, onUpdate, showMeasure, viewMode, waxMarkCount, onClearWaxMarks, stampSettings, onStampSettingsChange }: PropertiesPanelProps) {
  const sizes = Object.keys(RING_SIZE_MAP).map(Number);

  return (
    <div className="flex flex-col gap-4">

      {/* Ring Size */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Ring Size (US): {params.size}</Label>
        <Slider
          value={[params.size]}
          onValueChange={([v]) => onUpdate({ size: v })}
          min={sizes[0]}
          max={sizes[sizes.length - 1]}
          step={1}
          className="w-full"
        />
      </div>

      {/* Width */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Width: {params.width}mm</Label>
        <Slider
          value={[params.width]}
          onValueChange={([v]) => onUpdate({ width: v })}
          min={2}
          max={14}
          step={0.5}
        />
      </div>

      {/* Thickness */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Thickness: {params.thickness}mm</Label>
        <Slider
          value={[params.thickness]}
          onValueChange={([v]) => onUpdate({ thickness: v })}
          min={1}
          max={4}
          step={0.1}
        />
      </div>

      {/* Profile */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Profile</Label>
        <Select
          value={params.profile}
          onValueChange={(v) => onUpdate({ profile: v as RingProfile })}
        >
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFILES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Comfort Fit */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-secondary-foreground">Comfort Fit</Label>
        <Switch
          checked={params.comfortFit}
          onCheckedChange={(v) => onUpdate({ comfortFit: v })}
        />
      </div>

      {/* Grooves */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Grooves: {params.grooveCount}</Label>
        <Slider
          value={[params.grooveCount]}
          onValueChange={([v]) => onUpdate({ grooveCount: v })}
          min={0}
          max={5}
          step={1}
        />
      </div>

      {/* Bevel */}
      <div className="space-y-2">
        <Label className="text-xs text-secondary-foreground">Bevel: {params.bevelSize.toFixed(1)}mm</Label>
        <Slider
          value={[params.bevelSize]}
          onValueChange={([v]) => onUpdate({ bevelSize: v })}
          min={0}
          max={2}
          step={0.1}
        />
      </div>

      {/* Measurements */}
      {showMeasure && (
        <div className="mt-2 p-3 rounded-md bg-secondary border border-border space-y-1">
          <h4 className="text-xs font-display text-primary uppercase tracking-wider">Measurements</h4>
          <p className="text-xs text-muted-foreground">Inner Ø: {params.innerDiameter.toFixed(1)}mm</p>
          <p className="text-xs text-muted-foreground">Width: {params.width}mm</p>
          <p className="text-xs text-muted-foreground">Thickness: {params.thickness}mm</p>
          <p className="text-xs text-muted-foreground">Profile: {params.profile}</p>
        </div>
      )}

      {/* Wax Marks section (wax mode only) */}
      {viewMode === "wax" && (
        <div className="mt-2 p-3 rounded-md bg-secondary border border-border space-y-3">
          <h4 className="text-xs font-display text-primary uppercase tracking-wider">Stamp Settings</h4>

          {/* Stamp type */}
          {stampSettings && onStampSettingsChange && (
            <>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Mark Type</Label>
                <Select
                  value={stampSettings.type}
                  onValueChange={(v) => onStampSettingsChange({ ...stampSettings, type: v as WaxMarkType })}
                >
                  <SelectTrigger className="bg-card border-border h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAMP_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Radius: {stampSettings.radiusMm.toFixed(1)}mm</Label>
                <Slider
                  value={[stampSettings.radiusMm]}
                  onValueChange={([v]) => onStampSettingsChange({ ...stampSettings, radiusMm: v })}
                  min={0.4}
                  max={3.0}
                  step={0.1}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Intensity: {(stampSettings.intensity * 100).toFixed(0)}%</Label>
                <Slider
                  value={[stampSettings.intensity]}
                  onValueChange={([v]) => onStampSettingsChange({ ...stampSettings, intensity: v })}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                />
              </div>
            </>
          )}

          {waxMarkCount !== undefined && waxMarkCount > 0 && (
            <div className="pt-2 border-t border-border/50 space-y-2">
              <p className="text-xs text-muted-foreground">{waxMarkCount} mark{waxMarkCount !== 1 ? "s" : ""} placed</p>
              {onClearWaxMarks && (
                <Button variant="outline" size="sm" onClick={onClearWaxMarks} className="w-full text-xs h-7">
                  Clear Marks
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
