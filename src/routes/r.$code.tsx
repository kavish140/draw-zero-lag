import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DrawCanvas, type CanvasHandle, type DrawAction, type Tool } from "@/components/DrawCanvas";
import { useRoom } from "@/hooks/useRoom";
import { getOrCreatePlayer } from "@/lib/playerStore";
import { Brush, Eraser, PaintBucket, Undo2, Redo2, Trash2, Copy, Check, ArrowLeft, Crown, Send, SkipForward } from "lucide-react";

export const Route = createFileRoute("/r/$code")({
  component: RoomPage,
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — Scribble Arena` },
      { name: "description", content: "Join a live Pictionary room and start drawing." },
      { property: "og:title", content: `Room ${params.code} — Scribble Arena` },
      { property: "og:description", content: "Real-time multiplayer Pictionary." },
    ],
  }),
});

const PALETTE = [
  "#000000", "#FFFFFF", "#FF0099", "#FF6B00", "#FACC15",
  "#CCFF00", "#16A34A", "#00FAFF", "#2563EB", "#7C3AED",
  "#DC2626", "#92400E",
];

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const canvasRef = useRef<CanvasHandle | null>(null);
  const [player] = useState(() => getOrCreatePlayer());

  const {
    players, chat, state, isHost, wordChoices,
    broadcastDraw, sendChat, startGame, pickWord, skipRound, updateSnapshot,
  } = useRoom({
    roomCode: code,
    player,
    onDraw: (a) => canvasRef.current?.applyRemote(a),
    onCanvasSnapshot: (png) => canvasRef.current?.applyRemote({ type: "snapshot", png }),
  });

  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(8);
  const [chatText, setChatText] = useState("");
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const isDrawer = state.drawerId === player.id;
  const drawingEnabled = state.status === "drawing" && isDrawer;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length]);

  // periodic snapshot for late joiners (host only)
  useEffect(() => {
    if (!isHost) return;
    const t = setInterval(() => {
      const png = canvasRef.current?.exportPng();
      if (png) updateSnapshot(png);
    }, 4000);
    return () => clearInterval(t);
  }, [isHost, updateSnapshot]);

  const drawer = useMemo(() => players.find((p) => p.id === state.drawerId), [players, state.drawerId]);
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);

  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (!state.endsAt) { setTimeLeft(0); return; }
    const tick = () => setTimeLeft(Math.max(0, Math.ceil(((state.endsAt ?? 0) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [state.endsAt]);

  const onCanvasAction = (a: DrawAction) => broadcastDraw(a);

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    sendChat(chatText);
    setChatText("");
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const wordDisplay = state.status === "drawing"
    ? (isDrawer ? state.word : state.maskedWord)
    : state.status === "reveal"
      ? state.word
      : null;

  return (
    <div className="min-h-dvh flex flex-col p-3 sm:p-5 gap-3 sm:gap-5">
      {/* Top bar */}
      <header className="glass rounded-3xl p-3 sm:p-4 flex items-center gap-3 sm:gap-5">
        <Link to="/" className="arcade-btn bg-secondary text-white size-11 flex items-center justify-center shrink-0">
          <ArrowLeft className="size-5" />
        </Link>

        <button onClick={copyCode} className="arcade-btn bg-arcade-black px-4 h-11 flex items-center gap-2 text-neon-cyan font-display text-lg tracking-widest shrink-0">
          {code}
          {copied ? <Check className="size-4 text-neon-lime" /> : <Copy className="size-4 opacity-60" />}
        </button>

        <div className="flex-1 min-w-0 text-center">
          {state.status === "drawing" && (
            <>
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-neon-magenta">
                {isDrawer ? "You're drawing" : `${drawer?.name ?? "?"} is drawing`}
              </div>
              <div className="font-display text-2xl sm:text-3xl tracking-[0.3em] text-white truncate">
                {wordDisplay}
              </div>
            </>
          )}
          {state.status === "lobby" && (
            <div className="font-display text-xl sm:text-2xl text-neon-lime">LOBBY</div>
          )}
          {state.status === "picking" && (
            <div className="font-display text-xl sm:text-2xl text-neon-cyan">
              {isDrawer ? "PICK A WORD" : `${drawer?.name ?? "?"} IS PICKING…`}
            </div>
          )}
          {state.status === "reveal" && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-neon-cyan">The word was</div>
              <div className="font-display text-2xl sm:text-3xl text-neon-lime">{state.word}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {state.status === "drawing" && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-neon-magenta">Time</div>
              <div className="font-display text-2xl sm:text-3xl tabular-nums">{String(Math.floor(timeLeft / 60))}:{String(timeLeft % 60).padStart(2, "0")}</div>
            </div>
          )}
          {state.status === "drawing" && isHost && (
            <button onClick={skipRound} className="arcade-btn bg-destructive size-11 flex items-center justify-center" title="Skip round">
              <SkipForward className="size-5" />
            </button>
          )}
          <div className="hidden sm:block bg-candy-orange rounded-2xl px-3 py-1.5 text-arcade-black font-bold text-sm">
            R {state.round || 0}/{state.totalRounds}
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 min-h-0">
        {/* Players */}
        <aside className="order-2 lg:order-1 lg:col-span-2 glass rounded-3xl p-4 flex flex-col gap-3 max-h-48 lg:max-h-none overflow-hidden">
          <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold text-neon-magenta">Scoreboard</h2>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {sortedPlayers.map((p, i) => {
              const isMe = p.id === player.id;
              const isCurrentDrawer = p.id === state.drawerId;
              const guessed = state.correctGuessers.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border transition-colors ${
                    guessed ? "bg-neon-lime/15 border-neon-lime/40"
                    : isCurrentDrawer ? "bg-neon-magenta/15 border-neon-magenta/40"
                    : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground w-4">#{i + 1}</span>
                    {isCurrentDrawer && <Brush className="size-3 text-neon-magenta shrink-0" />}
                    {p.id === (sortedPlayers[0]?.id) && <Crown className="size-3 text-neon-lime shrink-0" />}
                    <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className={`text-sm font-bold truncate ${isMe ? "text-neon-cyan" : ""}`}>{p.name}{isMe && " (you)"}</span>
                  </div>
                  <span className="font-display text-sm tabular-nums">{p.score}</span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Canvas */}
        <section className="order-1 lg:order-2 lg:col-span-7 flex flex-col gap-3 min-h-0">
          <div className="relative flex-1 rounded-3xl overflow-hidden bg-white shadow-[0_12px_0_0_var(--arcade-black)] aspect-[10/7] lg:aspect-auto">
            <DrawCanvas
              ref={canvasRef}
              tool={tool}
              color={color}
              size={size}
              drawingEnabled={drawingEnabled}
              onAction={onCanvasAction}
            />

            {/* Overlays */}
            {state.status === "lobby" && (
              <div className="absolute inset-0 bg-arcade-black/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 gap-4">
                <h3 className="font-display text-3xl sm:text-5xl text-neon-lime">Waiting Room</h3>
                <p className="text-muted-foreground max-w-sm">Share the room code <span className="text-neon-cyan font-bold">{code}</span> with friends. Need at least 2 players to start.</p>
                <p className="text-sm text-muted-foreground">{players.length} player{players.length === 1 ? "" : "s"} in room</p>
                {isHost ? (
                  <button
                    disabled={players.length < 2}
                    onClick={startGame}
                    className="arcade-btn bg-neon-magenta text-white px-8 h-14 font-display text-xl neon-glow-magenta disabled:opacity-50 disabled:saturate-50"
                  >
                    START GAME
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Waiting for host to start…</p>
                )}
              </div>
            )}

            {state.status === "picking" && isDrawer && wordChoices.length > 0 && (
              <div className="absolute inset-0 bg-arcade-black/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 gap-4">
                <h3 className="font-display text-2xl sm:text-3xl text-neon-cyan">Pick a word to draw</h3>
                <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                  {wordChoices.map((w) => (
                    <button
                      key={w}
                      onClick={() => pickWord(w)}
                      className="arcade-btn bg-neon-lime text-arcade-black px-5 h-14 font-display text-lg sm:text-xl uppercase"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {state.status === "picking" && !isDrawer && (
              <div className="absolute inset-0 bg-arcade-black/80 backdrop-blur-sm flex items-center justify-center">
                <p className="font-display text-xl sm:text-2xl text-neon-cyan animate-pulse">{drawer?.name ?? "?"} is choosing a word…</p>
              </div>
            )}

            {state.status === "reveal" && (
              <div className="absolute inset-0 bg-arcade-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-neon-magenta">Round Over</p>
                <p className="font-display text-3xl sm:text-5xl text-neon-lime">{state.word}</p>
              </div>
            )}

            {state.status === "drawing" && !isDrawer && (
              <div className="absolute top-3 right-3 bg-arcade-black/70 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-bold text-neon-cyan border border-neon-cyan/30">
                Watching
              </div>
            )}
          </div>

          {/* Toolbar - only for drawer */}
          {drawingEnabled && (
            <div className="glass rounded-3xl p-3 flex flex-wrap items-center justify-center gap-3">
              {/* Tools */}
              <div className="flex gap-1.5 bg-arcade-black/50 rounded-2xl p-1.5">
                <ToolBtn active={tool === "brush"} onClick={() => setTool("brush")} title="Brush"><Brush className="size-5" /></ToolBtn>
                <ToolBtn active={tool === "fill"} onClick={() => setTool("fill")} title="Fill"><PaintBucket className="size-5" /></ToolBtn>
                <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} title="Eraser"><Eraser className="size-5" /></ToolBtn>
              </div>

              {/* Brush sizes */}
              <div className="flex items-center gap-2 bg-arcade-black/50 rounded-2xl p-2">
                {[3, 8, 16, 28].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`size-9 rounded-full flex items-center justify-center transition-all ${size === s ? "bg-neon-cyan/20 ring-2 ring-neon-cyan" : "hover:bg-white/10"}`}
                    title={`Size ${s}`}
                  >
                    <span className="rounded-full" style={{ width: Math.min(s, 22), height: Math.min(s, 22), background: tool === "eraser" ? "#FFFFFF" : color, border: tool === "eraser" ? "1px solid rgba(255,255,255,0.3)" : "none" }} />
                  </button>
                ))}
              </div>

              {/* Colors */}
              <div className="grid grid-cols-6 gap-1.5 bg-arcade-black/50 rounded-2xl p-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); if (tool === "eraser") setTool("brush"); }}
                    className={`size-7 rounded-full transition-transform ${color === c && tool !== "eraser" ? "ring-2 ring-white scale-110" : "hover:scale-110"}`}
                    style={{ background: c, border: c === "#FFFFFF" ? "1px solid rgba(255,255,255,0.3)" : "none" }}
                    title={c}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={() => canvasRef.current?.undo()} className="arcade-btn bg-secondary size-11 flex items-center justify-center" title="Undo"><Undo2 className="size-5" /></button>
                <button onClick={() => canvasRef.current?.redo()} className="arcade-btn bg-secondary size-11 flex items-center justify-center" title="Redo"><Redo2 className="size-5" /></button>
                <button onClick={() => canvasRef.current?.clear()} className="arcade-btn bg-destructive px-4 h-11 flex items-center gap-2 font-bold" title="Clear">
                  <Trash2 className="size-4" /> <span className="hidden sm:inline text-sm uppercase">Clear</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Chat */}
        <aside className="order-3 lg:col-span-3 glass rounded-3xl flex flex-col overflow-hidden min-h-[280px] lg:min-h-0">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold text-neon-magenta">Guesses & Chat</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 text-sm">
            {chat.length === 0 && (
              <p className="text-muted-foreground italic text-xs">No messages yet. Type a guess below ↓</p>
            )}
            {chat.map((m) => (
              <ChatLine key={m.id} m={m} meId={player.id} />
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={submitChat} className="p-3 border-t border-white/10 flex gap-2">
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder={isDrawer && state.status === "drawing" ? "You can't guess..." : "Type your guess..."}
              disabled={isDrawer && state.status === "drawing"}
              className="flex-1 bg-arcade-black/60 border-2 border-neon-magenta/40 focus:border-neon-magenta rounded-2xl px-4 py-2.5 outline-none font-bold disabled:opacity-50"
              maxLength={80}
            />
            <button type="submit" className="arcade-btn bg-neon-magenta text-white size-11 flex items-center justify-center shrink-0">
              <Send className="size-4" />
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}

function ToolBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`size-10 rounded-xl flex items-center justify-center transition-colors ${active ? "bg-neon-cyan text-arcade-black" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function ChatLine({ m, meId }: { m: { kind: string; text: string; playerName: string; playerId: string; id: string }; meId: string }) {
  if (m.kind === "correct") {
    return (
      <div className="rounded-xl bg-neon-lime/15 border border-neon-lime/30 px-3 py-2">
        <span className="text-neon-lime font-bold text-sm">✓ {m.text}</span>
      </div>
    );
  }
  if (m.kind === "system") {
    return <p className="text-xs italic text-muted-foreground">{m.text}</p>;
  }
  if (m.kind === "close") {
    return (
      <p className="text-sm">
        <span className="font-bold" style={{ color: "#FACC15" }}>{m.playerName}:</span>{" "}
        <span className="text-candy-orange">{m.text}</span>
      </p>
    );
  }
  const isMe = m.playerId === meId;
  return (
    <p className="text-sm">
      <span className={`font-bold ${isMe ? "text-neon-cyan" : "text-white/80"}`}>{m.playerName}:</span>{" "}
      <span className="text-white/90">{m.text}</span>
    </p>
  );
}
