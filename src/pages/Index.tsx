import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Gallery from "@/components/landing/Gallery";
import { isEmbedMode } from "@/config/galaxiforge";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();

  // If embed mode, skip landing and go straight to builder
  useEffect(() => {
    if (isEmbedMode()) navigate("/builder?embed=1", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <HowItWorks />
      <Gallery />

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground font-body">
          Wax Ring Builder · Powered by{" "}
          <a href="https://galaxiforge.com" className="text-primary hover:text-molten transition-colors">
            GalaxiForge
          </a>
        </p>
      </footer>
    </div>
  );
}
