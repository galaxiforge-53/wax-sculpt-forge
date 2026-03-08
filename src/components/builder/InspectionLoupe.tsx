import { useCallback, useEffect, useRef, useState } from "react";

interface InspectionLoupeProps {
  /** The container element that holds the 3D canvas */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Whether the loupe is active */
  active: boolean;
  /** Zoom magnification level (default 3) */
  zoom?: number;
  /** Loupe diameter in px (default 180) */
  size?: number;
  onZoomChange?: (zoom: number) => void;
}

/**
 * A circular magnifying loupe overlay that captures and zooms into
 * a region of the 3D viewport canvas under the cursor.
 */
export default function InspectionLoupe({
  containerRef,
  active,
  zoom = 3,
  size = 180,
  onZoomChange,
}: InspectionLoupeProps) {
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  const drawLoupe = useCallback(
    (mx: number, my: number) => {
      const container = containerRef.current;
      if (!container) return;

      // Find the WebGL canvas inside the container
      const sourceCanvas = container.querySelector("canvas") as HTMLCanvasElement | null;
      if (!sourceCanvas) return;

      const loupeCanvas = loupeCanvasRef.current;
      if (!loupeCanvas) return;

      const ctx = loupeCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Get the position of the source canvas relative to the container
      const rect = sourceCanvas.getBoundingClientRect();
      const scaleX = sourceCanvas.width / rect.width;
      const scaleY = sourceCanvas.height / rect.height;

      // Mouse position relative to canvas
      const canvasX = (mx - rect.left) * scaleX;
      const canvasY = (my - rect.top) * scaleY;

      // Source region size (in canvas pixels)
      const srcSize = (size / zoom) * scaleX;
      const halfSrc = srcSize / 2;

      // Clear and clip to circle
      const r = size / 2;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r - 2, 0, Math.PI * 2);
      ctx.clip();

      // Draw zoomed region from the source canvas
      ctx.drawImage(
        sourceCanvas,
        canvasX - halfSrc,
        canvasY - halfSrc,
        srcSize,
        srcSize,
        0,
        0,
        size,
        size,
      );

      // Crosshair
      ctx.strokeStyle = "hsla(var(--primary) / 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r, r - 12);
      ctx.lineTo(r, r + 12);
      ctx.moveTo(r - 12, r);
      ctx.lineTo(r + 12, r);
      ctx.stroke();

      ctx.restore();
    },
    [containerRef, zoom, size],
  );

  useEffect(() => {
    if (!active) {
      setVisible(false);
      setPos(null);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      // Check if within container bounds
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setVisible(true);

        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          drawLoupe(e.clientX, e.clientY);
        });
      } else {
        setVisible(false);
      }
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    const onWheel = (e: WheelEvent) => {
      if (!onZoomChange) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.5 : 0.5;
      const next = Math.max(1.5, Math.min(8, zoom + delta));
      onZoomChange(next);
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    container.addEventListener("mouseenter", onEnter);
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      container.removeEventListener("mouseenter", onEnter);
      container.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, containerRef, drawLoupe, zoom, onZoomChange]);

  if (!active || !visible || !pos) return null;

  // Position the loupe offset from cursor so it doesn't block the view
  const offsetX = 20;
  const offsetY = -size / 2;

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        left: pos.x + offsetX,
        top: pos.y + offsetY,
        width: size,
        height: size,
      }}
    >
      {/* Loupe ring border */}
      <div
        className="absolute inset-0 rounded-full border-2 border-primary/40 shadow-lg shadow-black/40"
        style={{
          boxShadow: "0 0 20px 4px hsl(var(--primary) / 0.15), inset 0 0 0 1px hsl(var(--primary) / 0.1)",
        }}
      />
      <canvas
        ref={loupeCanvasRef}
        width={size}
        height={size}
        className="rounded-full"
        style={{ width: size, height: size }}
      />
      {/* Zoom label */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-card/90 backdrop-blur-sm border border-border/50 text-[9px] font-mono text-muted-foreground whitespace-nowrap">
        {zoom.toFixed(1)}×
      </div>
    </div>
  );
}
