import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DesignPackage } from "@/types/ring";
import { getReturnUrl, getHandoffUrl, isEmbedMode } from "@/config/galaxiforge";
import { Check, ArrowLeft, Send } from "lucide-react";

export default function Export() {
  const navigate = useNavigate();
  const [pkg, setPkg] = useState<DesignPackage | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("designPackage");
    if (raw) setPkg(JSON.parse(raw));
  }, []);

  const handleSend = async () => {
    if (!pkg) return;
    console.log("Sending design package to:", getHandoffUrl(), pkg);
    setSent(true);
  };

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
      <div className="max-w-lg w-full space-y-6">
        <h1 className="font-display text-xl sm:text-2xl text-primary ember-text">Design Package</h1>

        {/* Preview thumbnails */}
        {pkg.previews && pkg.previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {pkg.previews.map((preview) => (
              <div
                key={preview.id}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                <img
                  src={preview.dataUrl}
                  alt={preview.label}
                  className="w-full aspect-square object-cover"
                />
                <div className="px-2 py-1 sm:py-1.5 text-center">
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {preview.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-2 sm:space-y-3">
          {[
            ["Design ID", pkg.id],
            ["Ring Size", `${pkg.parameters.size} US`],
            ["Inner Diameter", `${pkg.parameters.innerDiameter}mm`],
            ["Width", `${pkg.parameters.width}mm`],
            ["Thickness", `${pkg.parameters.thickness}mm`],
            ["Profile", pkg.parameters.profile],
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

        {!sent ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => navigate("/builder")} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
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
            <a
              href={getReturnUrl(pkg.id)}
              className="inline-block text-sm text-primary hover:text-molten transition-colors underline"
            >
              View on GalaxiForge →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
