import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import RingShowcase from "@/components/landing/RingShowcase";
import { isEmbedMode } from "@/config/galaxiforge";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isEmbedMode()) navigate("/builder?embed=1", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <HowItWorks />
      <RingShowcase />

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground font-body">
          ForgeLab · Powered by{" "}
          <a href="https://galaxiforge.com" className="text-primary hover:text-molten transition-colors">
            GalaxiForge
          </a>
        </p>
      </footer>
    </div>
  );
}
