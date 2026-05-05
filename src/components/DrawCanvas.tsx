import { useEffect, useImperativeHandle, useRef, forwardRef, useCallback } from "react";
import { floodFill } from "@/lib/floodFill";
import { uuid } from "@/lib/utils";

export type Tool = "brush" | "eraser" | "fill";
export type DrawAction =
  | { type: "begin"; id: string; x: number; y: number; color: string; size: number; tool: Tool }
  | { type: "move"; id: string; points: { x: number; y: number }[] }
  | { type: "end"; id: string }
  | { type: "fill"; id: string; x: number; y: number; color: string }
  | { type: "clear" }
  | { type: "snapshot"; png: string };

export type CanvasHandle = {
  clear: () => void;
  undo: () => void;
  redo: () => void;
  applyRemote: (action: DrawAction) => void;
  applyHistory: (actions: DrawAction[]) => void;
  exportPng: () => string;
};

type Props = {
  width?: number;
  height?: number;
  tool: Tool;
  color: string;
  size: number;
  drawingEnabled: boolean;
  onAction?: (a: DrawAction) => void;
};

const W = 1000;
const H = 700;

export const DrawCanvas = forwardRef<CanvasHandle, Props>(function DrawCanvas(
  { tool, color, size, drawingEnabled, onAction },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const currentIdRef = useRef<string>("");
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pendingPointsRef = useRef<{ x: number; y: number }[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  // History of completed actions (snapshots of canvas after each action)
  const historyRef = useRef<ImageData[]>([]);
  const futureRef = useRef<ImageData[]>([]);

  useEffect(() => {
    const c = canvasRef.current!;
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    pushHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushHistory = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, W, H);
    historyRef.current.push(snap);
    if (historyRef.current.length > 30) historyRef.current.shift();
    futureRef.current = [];
  }, []);

  const applyStrokePoint = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number } | null,
    to: { x: number; y: number },
    col: string,
    sz: number,
    mode: "draw" | "erase",
  ) => {
    ctx.save();
    ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = sz;
    if (!from || (from.x === to.x && from.y === to.y)) {
      ctx.beginPath();
      ctx.arc(to.x, to.y, sz / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const remoteCtxState = useRef<
    Map<string, { last: { x: number; y: number } | null; color: string; size: number; tool: Tool }>
  >(new Map());

  const applyRemote = useCallback((a: DrawAction) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (a.type === "begin") {
      remoteCtxState.current.set(a.id, { last: { x: a.x, y: a.y }, color: a.color, size: a.size, tool: a.tool });
      applyStrokePoint(ctx, null, { x: a.x, y: a.y }, a.color, a.size, a.tool === "eraser" ? "erase" : "draw");
    } else if (a.type === "move") {
      const s = remoteCtxState.current.get(a.id);
      if (!s) return;
      for (const p of a.points) {
        applyStrokePoint(ctx, s.last, p, s.color, s.size, s.tool === "eraser" ? "erase" : "draw");
        s.last = p;
      }
    } else if (a.type === "end") {
      remoteCtxState.current.delete(a.id);
      pushHistory();
    } else if (a.type === "fill") {
      floodFill(ctx, a.x, a.y, a.color);
      pushHistory();
    } else if (a.type === "clear") {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      pushHistory();
    } else if (a.type === "snapshot") {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        ctx.restore();
        historyRef.current = [];
        pushHistory();
      };
      img.src = a.png;
    }
  }, [pushHistory]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const ctx = ctxRef.current!;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      pushHistory();
      onAction?.({ type: "clear" });
    },
    undo: () => {
      if (historyRef.current.length < 2) return;
      const current = historyRef.current.pop()!;
      futureRef.current.push(current);
      const prev = historyRef.current[historyRef.current.length - 1];
      ctxRef.current!.putImageData(prev, 0, 0);
      onAction?.({ type: "snapshot", png: ctxRef.current!.canvas.toDataURL("image/png") });
    },
    redo: () => {
      if (futureRef.current.length === 0) return;
      const next = futureRef.current.pop()!;
      historyRef.current.push(next);
      ctxRef.current!.putImageData(next, 0, 0);
      onAction?.({ type: "snapshot", png: ctxRef.current!.canvas.toDataURL("image/png") });
    },
    applyRemote,
    applyHistory: (actions) => actions.forEach(applyRemote),
    exportPng: () => ctxRef.current!.canvas.toDataURL("image/png"),
  }));

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const flushPoints = useCallback(() => {
    if (pendingPointsRef.current.length === 0) return;
    const pts = pendingPointsRef.current;
    pendingPointsRef.current = [];
    onAction?.({ type: "move", id: currentIdRef.current, points: pts });
    flushTimerRef.current = null;
  }, [onAction]);

  const schedule = () => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setTimeout(flushPoints, 16);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = getPos(e);
    const ctx = ctxRef.current!;
    if (tool === "fill") {
      floodFill(ctx, p.x, p.y, color);
      pushHistory();
      onAction?.({ type: "fill", id: uuid(), x: p.x, y: p.y, color });
      return;
    }
    drawingRef.current = true;
    currentIdRef.current = uuid();
    lastPointRef.current = p;
    applyStrokePoint(ctx, null, p, color, size, tool === "eraser" ? "erase" : "draw");
    onAction?.({ type: "begin", id: currentIdRef.current, x: p.x, y: p.y, color, size, tool });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = getPos(e);
    const ctx = ctxRef.current!;
    applyStrokePoint(ctx, lastPointRef.current, p, color, size, tool === "eraser" ? "erase" : "draw");
    lastPointRef.current = p;
    pendingPointsRef.current.push(p);
    schedule();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    flushPoints();
    pushHistory();
    onAction?.({ type: "end", id: currentIdRef.current });
  };

  return (
    <div ref={wrapRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        className="w-full h-full rounded-2xl bg-white touch-none"
        style={{
          cursor: drawingEnabled ? (tool === "fill" ? "crosshair" : "crosshair") : "not-allowed",
        }}
      />
    </div>
  );
});
