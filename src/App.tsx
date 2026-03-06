import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessProvider } from "@/hooks/useAccess";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlatformNav from "@/components/layout/PlatformNav";

const Builder = lazy(() => import("./pages/Builder"));
const Export = lazy(() => import("./pages/Export"));
const Builders = lazy(() => import("./pages/Builders"));
const Templates = lazy(() => import("./pages/Templates"));
const MyDesigns = lazy(() => import("./pages/MyDesigns"));
const Help = lazy(() => import("./pages/Help"));
const Auth = lazy(() => import("./pages/Auth"));
const AccessCode = lazy(() => import("./pages/AccessCode"));
const Admin = lazy(() => import("./pages/Admin"));
const DesignLibrary = lazy(() => import("./pages/DesignLibrary"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="h-screen flex items-center justify-center bg-background">
    <div className="text-primary animate-pulse font-display text-xl tracking-wider">ForgeLab</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AccessProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PlatformNav />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/builder" element={<Builder />} />
              <Route path="/builders" element={<Builders />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/my-designs" element={<MyDesigns />} />
              <Route path="/help" element={<Help />} />
              <Route path="/export" element={<Export />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/access" element={<AccessCode />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/library" element={<DesignLibrary />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </AccessProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
