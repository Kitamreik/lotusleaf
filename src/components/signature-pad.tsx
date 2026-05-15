import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  onChange: (dataUrl: string | null) => void;
  height?: number;
};

export function SignaturePad({ onChange, height = 160 }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (empty) setEmpty(false);
  }
  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    onChange(e.currentTarget.toDataURL("image/png"));
  }
  function clear() {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        style={{ width: "100%", height, touchAction: "none" }}
        className="rounded border border-border bg-white cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={empty}>
          Clear
        </Button>
      </div>
    </div>
  );
}
