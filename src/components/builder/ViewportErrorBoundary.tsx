import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Error boundary that wraps the 3D viewport Canvas.
 * Catches WebGL / Three.js runtime errors and shows a recovery UI
 * instead of crashing the entire builder page.
 * Includes WebGL context loss detection and auto-recovery.
 */
export default class ViewportErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryCount: 0 };
  private contextLossHandler: ((e: Event) => void) | null = null;
  private contextRestoreHandler: ((e: Event) => void) | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidMount() {
    // Listen for WebGL context loss events on any canvas
    this.contextLossHandler = (e: Event) => {
      e.preventDefault(); // Allow context restore
      console.warn("[ViewportErrorBoundary] WebGL context lost — will auto-recover");
    };
    this.contextRestoreHandler = () => {
      console.info("[ViewportErrorBoundary] WebGL context restored — retrying render");
      this.handleRetry();
    };
    document.addEventListener("webglcontextlost", this.contextLossHandler, true);
    document.addEventListener("webglcontextrestored", this.contextRestoreHandler, true);
  }

  componentWillUnmount() {
    if (this.contextLossHandler) {
      document.removeEventListener("webglcontextlost", this.contextLossHandler, true);
    }
    if (this.contextRestoreHandler) {
      document.removeEventListener("webglcontextrestored", this.contextRestoreHandler, true);
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ViewportErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const isContextLoss = this.state.error?.message?.toLowerCase().includes("context");
      const maxRetries = 3;
      const canRetry = this.state.retryCount < maxRetries;

      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-background rounded-lg border border-border/50 p-8">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            {isContextLoss ? (
              <Monitor className="w-7 h-7 text-destructive" />
            ) : (
              <AlertTriangle className="w-7 h-7 text-destructive" />
            )}
          </div>
          <div className="text-center space-y-1.5">
            <h3 className="text-sm font-display font-semibold text-foreground">
              {isContextLoss ? "GPU Temporarily Unavailable" : "3D Viewport Error"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              {isContextLoss
                ? "The GPU context was reclaimed by the system. This is normal and will auto-recover."
                : "The 3D renderer encountered an issue. This can happen with extreme parameter values or GPU limitations."}
            </p>
            {this.state.error && (
              <p className="text-[10px] text-muted-foreground/60 font-mono mt-2 max-w-sm truncate">
                {this.state.error.message}
              </p>
            )}
            {!canRetry && (
              <p className="text-[10px] text-destructive/80 mt-2">
                Multiple retries failed. Try refreshing the page.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {canRetry && (
              <Button size="sm" variant="outline" onClick={this.handleRetry} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                {isContextLoss ? "Reconnect GPU" : "Retry"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()} className="gap-1.5 text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
