import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getOrCreatePlayer, updatePlayerName } from "@/lib/playerStore";

export const Route = createFileRoute("/")({
  component: Home,
});

function makeCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    const p = getOrCreatePlayer();
    setName(p.name);
  }, []);

  const create = () => {
    const finalName = name.trim() || `Player${Math.floor(Math.random() * 999)}`;
    updatePlayerName(finalName);
    const c = makeCode();
    navigate({ to: "/r/$code", params: { code: c } });
  };
  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 3) return;
    const finalName = name.trim() || `Player${Math.floor(Math.random() * 999)}`;
    updatePlayerName(finalName);
    navigate({ to: "/r/$code", params: { code: c } });
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-neon-magenta/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-neon-cyan/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-neon-lime/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center gap-10">
        <header className="text-center space-y-3">
          <p className="text-neon-cyan text-xs sm:text-sm uppercase tracking-[0.4em] font-bold">Multiplayer · Realtime</p>
          <h1 className="font-display text-6xl sm:text-7xl md:text-8xl text-white drop-shadow-[0_4px_0_var(--neon-magenta)]">
            SCRIBBLE<br/>ARENA
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-sm mx-auto">
            Draw fast. Guess faster. The neon arcade Pictionary you can play anywhere.
          </p>
        </header>

        <section className="glass rounded-3xl p-6 sm:p-8 w-full neon-glow-magenta space-y-5">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-neon-magenta">Your Nickname</span>
            <input
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pixel_Wizard_99"
              className="mt-2 w-full bg-arcade-black/60 border-2 border-neon-magenta/40 focus:border-neon-magenta rounded-2xl px-4 py-3 font-bold text-lg outline-none transition-colors"
            />
          </label>

          <button
            onClick={create}
            className="arcade-btn w-full bg-neon-lime text-arcade-black h-14 text-lg neon-glow-lime font-display"
          >
            Create New Room
          </button>

          <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase font-bold tracking-widest">
            <div className="flex-1 h-px bg-border" />
            or join
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="flex-1 bg-arcade-black/60 border-2 border-neon-cyan/40 focus:border-neon-cyan rounded-2xl px-4 py-3 font-display tracking-[0.3em] text-xl text-center outline-none transition-colors uppercase"
            />
            <button onClick={join} className="arcade-btn bg-neon-cyan text-arcade-black px-6 font-display">
              JOIN
            </button>
          </div>
        </section>

        <footer className="text-xs text-muted-foreground/60 text-center">
          Built for speed. Real-time on every device.
        </footer>
      </div>
    </main>
  );
}
