import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that wraps the 3D viewport Canvas.
 * Catches WebGL / Three.js runtime errors and shows a recovery UI
 * instead of crashing the entire builder page.
 */
export default class ViewportErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ViewportErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-background rounded-lg border border-border/50 p-8">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <div className="text-center space-y-1.5">
            <h3 className="text-sm font-display font-semibold text-foreground">
              3D Viewport Error
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              The 3D renderer encountered an issue. This can happen with extreme parameter values or GPU limitations.
            </p>
            {this.state.error && (
              <p className="text-[10px] text-muted-foreground/60 font-mono mt-2 max-w-sm truncate">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={this.handleRetry} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
