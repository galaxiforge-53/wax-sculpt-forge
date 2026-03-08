import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSharedTemplate } from "@/lib/shareStore";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ExternalLink, Eye } from "lucide-react";
import SEOHead from "@/components/SEOHead";

export default function SharedDesign() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [template, setTemplate] = useState<{
    name: string;
    design_package: any;
    thumbnail: string | null;
    view_count: number;
    created_at: string;
  } | null>(null);

  useEffect(() => {
    if (!code) { setNotFound(true); setLoading(false); return; }

    getSharedTemplate(code).then((data) => {
      if (!data) {
        setNotFound(true);
      } else {
        setTemplate(data);
      }
      setLoading(false);
    });
  }, [code]);

  const handleOpenInBuilder = () => {
    if (!template) return;
    // Store the design package so Builder picks it up
    sessionStorage.setItem("sharedDesignPackage", JSON.stringify(template.design_package));
    sessionStorage.setItem("sharedDesignName", template.name);
    navigate("/builder");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading shared design…</span>
        </div>
      </div>
    );
  }

  if (notFound || !template) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <SEOHead title="Design Not Found — ForgeLab" description="This shared design link is invalid or has expired." />
        <div className="text-center space-y-4">
          <h1 className="font-display text-xl text-primary">Design Not Found</h1>
          <p className="text-sm text-muted-foreground">This share link is invalid or has been removed.</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Home
          </Button>
        </div>
      </div>
    );
  }

  const pkg = template.design_package;
  const params = pkg?.parameters;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-8">
      <SEOHead
        title={`${template.name} — Shared Ring Design | ForgeLab`}
        description={`View and customize this shared ring design in ForgeLab's 3D ring builder.`}
      />
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-xl sm:text-2xl text-primary ember-text">{template.name}</h1>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
            Shared design
            <span className="inline-flex items-center gap-1 text-muted-foreground/60">
              <Eye className="w-3 h-3" /> {template.view_count} view{template.view_count !== 1 ? "s" : ""}
            </span>
          </p>
        </div>

        {/* Thumbnail */}
        {template.thumbnail && (
          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border/50 bg-card">
            <img
              src={template.thumbnail}
              alt={template.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Specs */}
        {params && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50 font-display">Design Specs</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">Ring Size</span>
              <span className="text-foreground font-mono">{params.size} US</span>
              <span className="text-muted-foreground">Width</span>
              <span className="text-foreground font-mono">{params.width}mm</span>
              <span className="text-muted-foreground">Thickness</span>
              <span className="text-foreground font-mono">{params.thickness}mm</span>
              <span className="text-muted-foreground">Profile</span>
              <span className="text-foreground font-mono capitalize">{params.profile}</span>
              {pkg.metalPreset && (
                <>
                  <span className="text-muted-foreground">Metal</span>
                  <span className="text-foreground font-mono capitalize">{pkg.metalPreset}</span>
                </>
              )}
              {pkg.finishPreset && (
                <>
                  <span className="text-muted-foreground">Finish</span>
                  <span className="text-foreground font-mono capitalize">{pkg.finishPreset}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            onClick={handleOpenInBuilder}
            className="flex-1 bg-primary text-primary-foreground hover:bg-ember-glow gap-2"
          >
            <ExternalLink className="w-4 h-4" /> Open in Builder
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/")}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to ForgeLab
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground/50">
          Opening in the builder creates your own copy — the original stays unchanged.
        </p>
      </div>
    </div>
  );
}
