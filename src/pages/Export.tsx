import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DesignPackage, ViewMode } from "@/types/ring";
import { LunarTextureState, DEFAULT_LUNAR_TEXTURE } from "@/types/lunar";
import { EngravingState, DEFAULT_ENGRAVING } from "@/types/engraving";
import { getReturnUrl, getHandoffUrl, isEmbedMode } from "@/config/galaxiforge";
import { generateExportSTL, downloadBlob, STLExportResult } from "@/lib/stlExporter";
import { Check, ArrowLeft, Send, Download, Box, Ruler, Layers, AlertTriangle, Loader2, Lock } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/hooks/useAccess";

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

// ── Main Export page ─────────────────────────────────────────────

export default function Export() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canExport } = useAccess();
  const [pkg, setPkg] = useState<DesignPackage | null>(null);
  const [sent, setSent] = useState(false);
  const [stlResult, setStlResult] = useState<STLExportResult | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("designPackage");
    if (raw) setPkg(JSON.parse(raw));
  }, []);

  // Generate STL when package loads
  useEffect(() => {
    if (!pkg) return;
    setGenerating(true);

    // Use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(() => {
      try {
        const lunar: LunarTextureState = pkg.craftState?.lunarTexture ?? DEFAULT_LUNAR_TEXTURE;
        const engraving: EngravingState = pkg.craftState?.engraving ?? DEFAULT_ENGRAVING;

        const result = generateExportSTL(
          pkg.parameters,
          lunar.enabled ? lunar : null,
          engraving.enabled ? engraving : null,
        );
        setStlResult(result);
      } catch (e) {
        console.error("STL generation error:", e);
        toast({ title: "Export Error", description: "Failed to generate STL model.", variant: "destructive" });
      } finally {
        setGenerating(false);
      }
    });
  }, [pkg]);

  const handleDownloadSTL = () => {
    if (!stlResult || !pkg) return;
    const name = `forgelab-ring-${pkg.parameters.size}US-${pkg.parameters.width}mm.stl`;
    downloadBlob(stlResult.blob, name);
    toast({ title: "STL Downloaded", description: `${name} (${stlResult.fileSizeKB} KB)` });
  };

  const handleSend = async () => {
    if (!pkg) return;
    console.log("Sending design package to:", getHandoffUrl(), pkg);
    setSent(true);
  };

  // Manufacturing warnings
  const warnings = useMemo(() => {
    if (!pkg) return [];
    const w: string[] = [];
    if (pkg.parameters.thickness < 1.2) w.push("Wall thickness below 1.2mm may be fragile for wax printing");
    if (pkg.parameters.width > 12) w.push("Width above 12mm may require support structures");
    return w;
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
            <Canvas
              camera={{ position: [0, 1.2, 3.0], fov: 32 }}
              gl={{ antialias: true, alpha: true }}
              dpr={[1, 2]}
            >
              <ExportPreviewScene geometry={stlResult.geometry} />
            </Canvas>
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

        {/* Actions */}
        {!sent ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => navigate("/builder")} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button
              onClick={handleDownloadSTL}
              disabled={!stlResult || generating || !canExport}
              className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80"
              title={!canExport ? "Requires Export Pro access code" : ""}
            >
              {!canExport ? <Lock className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {!canExport ? "Export Pro Required" : `Download STL ${stlResult ? `(${stlResult.fileSizeKB} KB)` : ""}`}
            </Button>
            <Button onClick={handleSend} className="flex-1 bg-primary text-primary-foreground hover:bg-ember-glow">
              <Send className="h-4 w-4 mr-2" /> Send to GalaxiForge
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary">
              <Check className="h-5 w-5" />
              <span className="font-medium text-sm">Design Sent Successfully</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your design has been submitted to GalaxiForge for casting.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleDownloadSTL} disabled={!stlResult}>
                <Download className="h-4 w-4 mr-2" /> Download STL
              </Button>
              <a
                href={getReturnUrl(pkg.id)}
                className="inline-block text-sm text-primary hover:text-molten transition-colors underline leading-9"
              >
                View on GalaxiForge →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
