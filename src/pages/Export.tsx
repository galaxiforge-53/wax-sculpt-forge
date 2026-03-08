import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DesignPackage, ViewMode, MetalPreset, FinishPreset, RING_SIZE_MAP } from "@/types/ring";
import { LunarTextureState, DEFAULT_LUNAR_TEXTURE } from "@/types/lunar";
import { EngravingState, DEFAULT_ENGRAVING } from "@/types/engraving";
import { getReturnUrl, getHandoffUrl, isEmbedMode } from "@/config/galaxiforge";
import { generateExportSTL, downloadBlob, STLExportResult, SHRINKAGE_PROFILES, ShrinkageMetal } from "@/lib/stlExporter";
import { evaluateCastability } from "@/lib/castabilityEngine";
import ProductionSummaryPanel from "@/components/builder/ProductionSummaryPanel";
import { Check, ArrowLeft, Send, Download, Box, Ruler, Layers, AlertTriangle, Loader2, Lock, FileText, ChevronRight, Sparkles, Scale } from "lucide-react";
import ViewportErrorBoundary from "@/components/builder/ViewportErrorBoundary";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/hooks/useAccess";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── 3D Preview of export geometry ────────────────────────────────

function ExportPreviewMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <meshStandardMaterial
        color="#C8B896"
        roughness={0.55}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ExportPreviewScene({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} color="#fff8f0" castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#c8d8f0" />
      <pointLight position={[0, 3, 0]} intensity={0.4} color="#ffecd2" />
      <ExportPreviewMesh geometry={geometry} />
      <ContactShadows position={[0, -0.5, 0]} opacity={0.4} scale={4} blur={2} far={3} />
      <Environment preset="warehouse" />
      <OrbitControls enablePan={false} enableZoom={true} autoRotate autoRotateSpeed={1.5} />
    </>
  );
}

// ── Spec badge ───────────────────────────────────────────────────

function SpecBadge({ icon: Icon, label, value, warn }: { icon: React.ElementType; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${warn ? "border-destructive/30 bg-destructive/5" : "border-border bg-card/50"}`}>
      <Icon className={`w-4 h-4 ${warn ? "text-destructive" : "text-primary"}`} />
      <div>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xs font-mono font-medium ${warn ? "text-destructive" : "text-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Metals & Finishes ────────────────────────────────────────────

const METALS: { value: MetalPreset; label: string }[] = [
  { value: "silver", label: "Sterling Silver" },
  { value: "gold", label: "14K Gold" },
  { value: "rose-gold", label: "14K Rose Gold" },
  { value: "titanium", label: "Titanium" },
  { value: "tungsten", label: "Tungsten Carbide" },
];

const FINISHES: { value: FinishPreset; label: string }[] = [
  { value: "polished", label: "High Polish" },
  { value: "brushed", label: "Brushed" },
  { value: "hammered", label: "Hammered" },
  { value: "matte", label: "Matte" },
  { value: "satin", label: "Satin" },
];

const RING_SIZES = Object.keys(RING_SIZE_MAP).map(Number);

// ── Submission Steps ─────────────────────────────────────────────

type SubmitStep = "review" | "confirm" | "submitting" | "uploading-stl" | "uploading-previews" | "done";

// ── Main Export page ─────────────────────────────────────────────

export default function Export() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canExport } = useAccess();
  const { user } = useAuth();
  const [pkg, setPkg] = useState<DesignPackage | null>(null);
  const [sent, setSent] = useState(false);
  const [stlResult, setStlResult] = useState<STLExportResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [shrinkage, setShrinkage] = useState<ShrinkageMetal>("none");

  // Submission form state
  const [submitStep, setSubmitStep] = useState<SubmitStep>("review");
  const [confirmSize, setConfirmSize] = useState<number>(8);
  const [confirmMetal, setConfirmMetal] = useState<MetalPreset>("silver");
  const [confirmFinish, setConfirmFinish] = useState<FinishPreset>("polished");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("designPackage");
    if (raw) {
      const parsed = JSON.parse(raw) as DesignPackage;
      setPkg(parsed);
      setConfirmSize(parsed.parameters.size);
      setConfirmMetal(parsed.metalPreset);
      setConfirmFinish(parsed.finishPreset);
      // Auto-select shrinkage based on metal
      if (parsed.metalPreset === "gold" || parsed.metalPreset === "rose-gold") {
        setShrinkage("gold");
      } else if (parsed.metalPreset === "silver") {
        setShrinkage("silver");
      }
    }
  }, []);

  // Generate STL when package loads or shrinkage changes
  useEffect(() => {
    if (!pkg) return;
    setGenerating(true);

    requestAnimationFrame(() => {
      try {
        const lunar: LunarTextureState = pkg.craftState?.lunarTexture ?? DEFAULT_LUNAR_TEXTURE;
        const engraving: EngravingState = pkg.craftState?.engraving ?? DEFAULT_ENGRAVING;

        const result = generateExportSTL(
          pkg.parameters,
          lunar.enabled ? lunar : null,
          engraving.enabled ? engraving : null,
          shrinkage,
        );
        setStlResult(result);
      } catch (e) {
        console.error("STL generation error:", e);
        toast({ title: "Export Error", description: "Failed to generate STL model.", variant: "destructive" });
      } finally {
        setGenerating(false);
      }
    });
  }, [pkg, shrinkage]);

  const handleDownloadSTL = () => {
    if (!stlResult || !pkg) return;
    const name = `forgelab-ring-${pkg.parameters.size}US-${pkg.parameters.width}mm.stl`;
    downloadBlob(stlResult.blob, name);
    toast({ title: "STL Downloaded", description: `${name} (${stlResult.fileSizeKB} KB)` });
  };

  const handleSubmitToForge = async () => {
    if (!pkg || !user) return;
    setSubmitting(true);
    setSubmitStep("submitting");

    try {
      const orderId = crypto.randomUUID();
      const basePath = `${user.id}/${orderId}`;

      // 1. Generate manufacturing STL with shrinkage compensation
      const lunar: LunarTextureState = pkg.craftState?.lunarTexture ?? DEFAULT_LUNAR_TEXTURE;
      const engravingState: EngravingState = pkg.craftState?.engraving ?? DEFAULT_ENGRAVING;

      // Auto-select shrinkage based on confirmed metal
      let autoShrinkage: ShrinkageMetal = "none";
      if (confirmMetal === "gold" || confirmMetal === "rose-gold") autoShrinkage = "gold";
      else if (confirmMetal === "silver") autoShrinkage = "silver";

      const exportResult = generateExportSTL(
        { ...pkg.parameters, size: confirmSize, innerDiameter: RING_SIZE_MAP[confirmSize] || pkg.parameters.innerDiameter },
        lunar.enabled ? lunar : null,
        engravingState.enabled ? engravingState : null,
        autoShrinkage,
      );

      // 2. Upload STL to storage
      setSubmitStep("uploading-stl");
      const stlPath = `${basePath}/ring-${confirmSize}US-${pkg.parameters.width}mm.stl`;
      const { error: stlErr } = await supabase.storage
        .from("production-assets")
        .upload(stlPath, exportResult.blob, {
          contentType: "application/octet-stream",
          upsert: true,
        });
      if (stlErr) throw new Error(`STL upload failed: ${stlErr.message}`);

      // 3. Upload preview images
      setSubmitStep("uploading-previews");
      const previewUrls: string[] = [];
      const previews = pkg.previews ?? [];
      for (const preview of previews) {
        if (!preview.dataUrl || preview.dataUrl.length < 100) continue;
        try {
          // Convert data URL to blob
          const res = await fetch(preview.dataUrl);
          const blob = await res.blob();
          const ext = preview.dataUrl.startsWith("data:image/webp") ? "webp" : "png";
          const imgPath = `${basePath}/preview-${preview.id}-${preview.viewMode}.${ext}`;

          const { error: imgErr } = await supabase.storage
            .from("production-assets")
            .upload(imgPath, blob, {
              contentType: `image/${ext}`,
              upsert: true,
            });
          if (!imgErr) previewUrls.push(imgPath);
        } catch (e) {
          console.warn(`Preview upload failed for ${preview.id}:`, e);
        }
      }

      // 4. Build the full manufacturing package
      const manufacturingPackage = {
        ...pkg,
        parameters: {
          ...pkg.parameters,
          size: confirmSize,
          innerDiameter: RING_SIZE_MAP[confirmSize] || pkg.parameters.innerDiameter,
        },
        metalPreset: confirmMetal,
        finishPreset: confirmFinish,
        manufacturing: {
          shrinkageProfile: autoShrinkage,
          shrinkageFactor: exportResult.scaleFactor,
          stlTriangleCount: exportResult.triangleCount,
          stlFileSizeKB: exportResult.fileSizeKB,
          compensatedInnerDiameter: (RING_SIZE_MAP[confirmSize] || pkg.parameters.innerDiameter) * exportResult.scaleFactor,
        },
      };

      // 5. Insert production order with asset references
      const { error } = await supabase
        .from("production_orders")
        .insert({
          id: orderId,
          user_id: user.id,
          ring_size: confirmSize,
          metal: confirmMetal,
          finish: confirmFinish,
          notes: notes.trim(),
          design_package: manufacturingPackage as any,
          stl_path: stlPath,
          preview_urls: previewUrls,
          status: "submitted",
        } as any);

      if (error) throw error;

      setSubmitStep("done");
      setSent(true);
      toast({
        title: "Order Submitted! 🔥",
        description: `Complete package uploaded: STL (${exportResult.fileSizeKB} KB, ${exportResult.triangleCount.toLocaleString()} triangles) + ${previewUrls.length} preview image${previewUrls.length !== 1 ? "s" : ""}.`,
      });
    } catch (err: any) {
      console.error("Submit error:", err);
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
      setSubmitStep("confirm");
    } finally {
      setSubmitting(false);
    }
  };

  // Keep the old handleSend for non-authenticated fallback
  const handleSend = async () => {
    if (!pkg) return;
    if (user) {
      // Open submission flow
      setSubmitStep("confirm");
    } else {
      // Legacy: just mark as sent without DB
      console.log("Sending design package to:", getHandoffUrl(), pkg);
      setSent(true);
    }
  };

  // Manufacturing warnings
  const warnings = useMemo(() => {
    if (!pkg) return [];
    const w: string[] = [];
    if (pkg.parameters.thickness < 1.2) w.push("Wall thickness below 1.2mm may be fragile for wax printing");
    if (pkg.parameters.width > 12) w.push("Width above 12mm may require support structures");
    return w;
  }, [pkg]);

  // Castability report for production summary
  const castReport = useMemo(() => {
    if (!pkg) return undefined;
    const lunar = pkg.craftState?.lunarTexture ?? null;
    const engr = pkg.craftState?.engraving ?? null;
    const inlayChannels = pkg.craftState?.inlays?.channels ?? null;
    return evaluateCastability(pkg.parameters, lunar, engr, inlayChannels);
  }, [pkg]);

  if (!pkg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No design found.</p>
          <Button variant="outline" onClick={() => navigate("/builder")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Builder
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-3xl w-full space-y-6">
        <h1 className="font-display text-xl sm:text-2xl text-primary ember-text">Manufacturing Export</h1>

        {/* 3D STL Preview */}
        <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border/50 bg-gradient-to-br from-forge-dark via-card to-forge-dark">
          {generating ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Generating export model…</span>
              </div>
            </div>
          ) : stlResult ? (
            <ViewportErrorBoundary>
              <Canvas
                camera={{ position: [0, 1.2, 3.0], fov: 32 }}
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 2]}
              >
                <ExportPreviewScene geometry={stlResult.geometry} />
              </Canvas>
            </ViewportErrorBoundary>
          ) : null}

          {/* Model stats overlay */}
          {stlResult && (
            <div className="absolute bottom-3 left-3 flex gap-2">
              <span className="text-[9px] px-2 py-1 rounded bg-card/80 backdrop-blur-sm border border-border/30 text-muted-foreground font-mono">
                {stlResult.triangleCount.toLocaleString()} triangles
              </span>
              <span className="text-[9px] px-2 py-1 rounded bg-card/80 backdrop-blur-sm border border-border/30 text-muted-foreground font-mono">
                {stlResult.fileSizeKB} KB
              </span>
            </div>
          )}

          <div className="absolute top-3 right-3 px-2 py-1 rounded bg-card/80 backdrop-blur-sm border border-border/30">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">STL Preview — Orbit to inspect</span>
          </div>
        </div>

        {/* Manufacturing specs grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SpecBadge icon={Ruler} label="Inner Diameter" value={`${pkg.parameters.innerDiameter}mm`} />
          <SpecBadge icon={Ruler} label="Width" value={`${pkg.parameters.width}mm`} />
          <SpecBadge
            icon={Layers}
            label="Wall Thickness"
            value={`${pkg.parameters.thickness}mm`}
            warn={pkg.parameters.thickness < 1.2}
          />
          <SpecBadge icon={Box} label="Ring Size" value={`${pkg.parameters.size} US`} />
        </div>

        {/* ── Production Summary ── */}
        <ProductionSummaryPanel
          params={pkg.parameters}
          metalPreset={pkg.metalPreset}
          finishPreset={pkg.finishPreset}
          craftState={pkg.craftState}
          castabilityReport={castReport}
        />

        {/* ── Casting Shrinkage Compensation ── */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-display uppercase tracking-wider text-foreground">Casting Shrinkage Compensation</h3>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Metals shrink during the investment casting process. Select a shrinkage profile to automatically scale the STL model so the final cast ring matches your intended dimensions.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.entries(SHRINKAGE_PROFILES) as [ShrinkageMetal, typeof SHRINKAGE_PROFILES["none"]][]).map(
              ([key, profile]) => (
                <button
                  key={key}
                  onClick={() => setShrinkage(key)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    shrinkage === key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:border-border hover:bg-secondary/50"
                  }`}
                >
                  <p className={`text-[11px] font-medium ${shrinkage === key ? "text-primary" : "text-foreground"}`}>
                    {profile.label}
                  </p>
                  <p className={`text-[10px] font-mono mt-0.5 ${shrinkage === key ? "text-primary/80" : "text-muted-foreground"}`}>
                    {key === "none" ? "×1.000" : `×${profile.factor.toFixed(3)}`}
                    {key !== "none" && ` (+${((profile.factor - 1) * 100).toFixed(1)}%)`}
                  </p>
                </button>
              )
            )}
          </div>
          {shrinkage !== "none" && (
            <div className="flex items-start gap-2 text-[10px] text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <Scale className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                STL is scaled ×{SHRINKAGE_PROFILES[shrinkage].factor.toFixed(3)} — 
                inner Ø becomes {(pkg.parameters.innerDiameter * SHRINKAGE_PROFILES[shrinkage].factor).toFixed(2)}mm 
                (was {pkg.parameters.innerDiameter.toFixed(1)}mm)
              </span>
            </div>
          )}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1.5">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Preview thumbnails */}
        {pkg.previews && pkg.previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {pkg.previews.map((preview) => (
              <div key={preview.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <img src={preview.dataUrl} alt={preview.label} className="w-full aspect-square object-cover" />
                <div className="px-2 py-1 sm:py-1.5 text-center">
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {preview.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Design details */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-2 sm:space-y-3">
          {[
            ["Design ID", pkg.id],
            ["Profile", pkg.parameters.profile],
            ["Comfort Fit", pkg.parameters.comfortFit ? "Yes" : "No"],
            ["Grooves", String(pkg.parameters.grooveCount)],
            ["Metal", pkg.metalPreset],
            ["Finish", pkg.finishPreset],
            ["Tool Operations", String(pkg.toolHistory.length)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-foreground font-mono capitalize">{value}</span>
            </div>
          ))}
        </div>

        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            View Raw JSON
          </summary>
          <pre className="mt-2 p-3 bg-secondary rounded-md overflow-auto max-h-48 text-muted-foreground text-[10px]">
            {JSON.stringify(pkg, null, 2)}
          </pre>
        </details>

        {/* ── Production Submission Form ─────────────────────────── */}
        <AnimatePresence mode="wait">
          {submitStep === "confirm" && !sent && (
            <motion.div
              key="confirm-form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="bg-card border-2 border-primary/30 rounded-xl p-5 sm:p-6 space-y-5"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="font-display text-base tracking-wide text-foreground">
                  Submit to Galaxy Forge
                </h2>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Confirm the final specifications before sending your design for production.
                All parameters, surface textures, and geometry are included in the manufacturing package.
              </p>

              {/* Ring Size */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">
                  Confirm Ring Size (US)
                </label>
                <Select value={String(confirmSize)} onValueChange={(v) => setConfirmSize(Number(v))}>
                  <SelectTrigger className="w-full h-9 text-sm bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RING_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        Size {s} — {RING_SIZE_MAP[s]}mm inner diameter
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Metal */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">
                  Confirm Metal
                </label>
                <Select value={confirmMetal} onValueChange={(v) => setConfirmMetal(v as MetalPreset)}>
                  <SelectTrigger className="w-full h-9 text-sm bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METALS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Finish */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">
                  Confirm Finish
                </label>
                <Select value={confirmFinish} onValueChange={(v) => setConfirmFinish(v as FinishPreset)}>
                  <SelectTrigger className="w-full h-9 text-sm bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINISHES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-display flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Production Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Any special instructions, engraving requests, shipping notes..."
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none"
                />
                <p className="text-[9px] text-muted-foreground/50 text-right">{notes.length}/1000</p>
              </div>

              {/* Summary */}
              <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-display">Order Summary</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Ring Size</span>
                  <span className="text-foreground font-mono">{confirmSize} US ({RING_SIZE_MAP[confirmSize]}mm)</span>
                  <span className="text-muted-foreground">Metal</span>
                  <span className="text-foreground font-mono capitalize">{METALS.find(m => m.value === confirmMetal)?.label}</span>
                  <span className="text-muted-foreground">Finish</span>
                  <span className="text-foreground font-mono capitalize">{FINISHES.find(f => f.value === confirmFinish)?.label}</span>
                  <span className="text-muted-foreground">Profile</span>
                  <span className="text-foreground font-mono capitalize">{pkg.parameters.profile}</span>
                  <span className="text-muted-foreground">Width × Thickness</span>
                  <span className="text-foreground font-mono">{pkg.parameters.width}mm × {pkg.parameters.thickness}mm</span>
                </div>
                <div className="border-t border-border/40 mt-2 pt-2">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-display mb-1">Package Contents</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">STL Model</span>
                    <span className="text-primary font-mono text-[10px]">
                      {stlResult ? `${stlResult.triangleCount.toLocaleString()} triangles · ${stlResult.fileSizeKB} KB` : "Will generate"}
                    </span>
                    <span className="text-muted-foreground">Shrinkage</span>
                    <span className="text-foreground font-mono text-[10px]">
                      {confirmMetal === "gold" || confirmMetal === "rose-gold"
                        ? `Gold ×${SHRINKAGE_PROFILES.gold.factor}`
                        : confirmMetal === "silver"
                        ? `Silver ×${SHRINKAGE_PROFILES.silver.factor}`
                        : "None (1:1)"}
                    </span>
                    <span className="text-muted-foreground">Preview Images</span>
                    <span className="text-foreground font-mono text-[10px]">
                      {(pkg.previews?.length ?? 0)} angle{(pkg.previews?.length ?? 0) !== 1 ? "s" : ""}
                    </span>
                    <span className="text-muted-foreground">Design Package</span>
                    <span className="text-primary font-mono text-[10px]">Full JSON spec</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setSubmitStep("review")} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmitToForge} className="flex-1 bg-primary text-primary-foreground hover:bg-ember-glow gap-2">
                  <Send className="h-4 w-4" />
                  Submit Order
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {(submitStep === "submitting" || submitStep === "uploading-stl" || submitStep === "uploading-previews") && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-xl p-8 text-center space-y-4"
            >
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">
                {submitStep === "submitting" && "Generating manufacturing STL…"}
                {submitStep === "uploading-stl" && "Uploading STL model…"}
                {submitStep === "uploading-previews" && "Uploading preview images…"}
              </p>
              <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/60">
                <span className={submitStep === "submitting" ? "text-primary" : "text-muted-foreground"}>① Generate</span>
                <ChevronRight className="w-3 h-3" />
                <span className={submitStep === "uploading-stl" ? "text-primary" : "text-muted-foreground"}>② STL Upload</span>
                <ChevronRight className="w-3 h-3" />
                <span className={submitStep === "uploading-previews" ? "text-primary" : "text-muted-foreground"}>③ Previews</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions — shown when not in submission flow */}
        {!sent && submitStep === "review" ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => navigate("/builder")} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button
              onClick={handleDownloadSTL}
              disabled={!stlResult || generating || !canExport}
              className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80"
              title={!canExport ? "Requires Premium access code" : ""}
            >
              {!canExport ? <Lock className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {!canExport ? "Premium Required" : `Download STL ${stlResult ? `(${stlResult.fileSizeKB} KB)` : ""}`}
            </Button>
            <Button onClick={handleSend} className="flex-1 bg-primary text-primary-foreground hover:bg-ember-glow">
              <Send className="h-4 w-4 mr-2" /> Send to Galaxy Forge
            </Button>
          </div>
        ) : sent ? (
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary/20 text-primary border border-primary/30"
            >
              <Check className="h-5 w-5" />
              <span className="font-display text-sm tracking-wide">Design Submitted to Galaxy Forge</span>
            </motion.div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Your ring design with all manufacturing parameters has been submitted for production.
              {user && " You can view your orders in your design library."}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button variant="outline" onClick={handleDownloadSTL} disabled={!stlResult}>
                <Download className="h-4 w-4 mr-2" /> Download STL
              </Button>
              <Button variant="outline" onClick={() => navigate("/builder")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> New Design
              </Button>
              <a
                href={getReturnUrl(pkg.id)}
                className="inline-block text-sm text-primary hover:text-molten transition-colors underline leading-9"
              >
                View on Galaxy Forge →
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
