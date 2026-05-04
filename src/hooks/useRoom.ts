import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Player, ChatMessage, RoundState } from "@/lib/gameTypes";
import type { DrawAction } from "@/components/DrawCanvas";
import { pickWords, maskWord, WORDS } from "@/lib/words";

export type RoomEvent =
  | { kind: "draw"; action: DrawAction; from: string }
  | { kind: "chat"; message: ChatMessage }
  | { kind: "state"; state: RoundState; players: Player[] }
  | { kind: "request_sync"; from: string }
  | { kind: "sync"; to: string; state: RoundState; players: Player[]; canvasPng?: string }
  | { kind: "word_pick"; word: string }
  | { kind: "skip" };

export function useRoom(opts: {
  roomCode: string;
  player: { id: string; name: string; color: string };
  onDraw: (a: DrawAction) => void;
  onCanvasSnapshot: (png: string) => void;
}) {
  const { roomCode, player, onDraw, onCanvasSnapshot } = opts;
  const [players, setPlayers] = useState<Player[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<RoundState>({
    drawerId: null,
    word: null,
    maskedWord: null,
    endsAt: null,
    round: 0,
    totalRounds: 5,
    status: "lobby",
    correctGuessers: [],
  });
  const [hostId, setHostId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef(state);
  const playersRef = useRef(players);
  const playerRef = useRef(player);
  const myWordRef = useRef<string | null>(null);
  const wordChoicesRef = useRef<string[]>([]);
  const [wordChoices, setWordChoices] = useState<string[]>([]);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { playerRef.current = player; }, [player]);

  const isHost = hostId === player.id;

  const send = useCallback((event: RoomEvent) => {
    channelRef.current?.send({ type: "broadcast", event: "msg", payload: event });
  }, []);

  // setup
  useEffect(() => {
    const ch = supabase.channel(`pictionary:${roomCode}`, {
      config: { presence: { key: player.id }, broadcast: { self: false } },
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const presenceState = ch.presenceState() as Record<string, Array<Player>>;
      const list: Player[] = Object.values(presenceState).map((arr) => arr[0]).filter(Boolean);
      list.sort((a, b) => a.id.localeCompare(b.id));
      setPlayers(list);
      const newHost = list[0]?.id ?? null;
      setHostId(newHost);
    });

    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      const ev = payload as RoomEvent;
      if (ev.kind === "draw") {
        if (ev.from !== playerRef.current.id) onDraw(ev.action);
      } else if (ev.kind === "chat") {
        setChat((c) => [...c.slice(-100), ev.message]);
      } else if (ev.kind === "state") {
        setState(ev.state);
        setPlayers(ev.players);
        if (ev.state.drawerId !== playerRef.current.id) myWordRef.current = null;
      } else if (ev.kind === "request_sync") {
        if (hostIdRef.current === playerRef.current.id) {
          send({
            kind: "sync",
            to: ev.from,
            state: stateRef.current,
            players: playersRef.current,
            canvasPng: lastSnapshotRef.current ?? undefined,
          });
        }
      } else if (ev.kind === "sync") {
        if (ev.to === playerRef.current.id) {
          setState(ev.state);
          setPlayers(ev.players);
          if (ev.canvasPng) onCanvasSnapshot(ev.canvasPng);
        }
      } else if (ev.kind === "word_pick") {
        // Only used for drawer broadcasting that they picked
        // game state will arrive via 'state' broadcast
      }
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ ...player, score: 0 });
        setTimeout(() => send({ kind: "request_sync", from: player.id }), 400);
      }
    });

    return () => {
      ch.unsubscribe();
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, player.id]);

  const hostIdRef = useRef<string | null>(null);
  useEffect(() => { hostIdRef.current = hostId; }, [hostId]);
  const lastSnapshotRef = useRef<string | null>(null);
  const updateSnapshot = useCallback((png: string) => { lastSnapshotRef.current = png; }, []);

  // local drawing -> broadcast
  const broadcastDraw = useCallback((action: DrawAction) => {
    send({ kind: "draw", action, from: playerRef.current.id });
  }, [send]);

  const sendChat = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    const s = stateRef.current;
    const me = playerRef.current;
    // Drawers can't guess
    if (s.drawerId === me.id && s.status === "drawing") return;

    if (s.status === "drawing" && s.word) {
      const guess = t.toLowerCase();
      const target = s.word.toLowerCase();
      if (guess === target) {
        // Already guessed?
        if (s.correctGuessers.includes(me.id)) return;
        // Award points based on time remaining
        const timeLeft = Math.max(0, (s.endsAt ?? 0) - Date.now());
        const points = 100 + Math.round((timeLeft / 90000) * 200);
        const drawerPoints = 50;

        const updatedPlayers = playersRef.current.map((p) => {
          if (p.id === me.id) return { ...p, score: p.score + points };
          if (p.id === s.drawerId) return { ...p, score: p.score + drawerPoints };
          return p;
        });
        const updatedState: RoundState = {
          ...s,
          correctGuessers: [...s.correctGuessers, me.id],
        };

        const correctMsg: ChatMessage = {
          id: crypto.randomUUID(),
          playerId: "system",
          playerName: "system",
          text: `${me.name} guessed the word! +${points}`,
          kind: "correct",
          ts: Date.now(),
        };
        setChat((c) => [...c.slice(-100), correctMsg]);
        send({ kind: "chat", message: correctMsg });

        // Host-like broadcaster: anyone broadcasts state because all clients can compute consistently
        setState(updatedState);
        setPlayers(updatedPlayers);
        send({ kind: "state", state: updatedState, players: updatedPlayers });

        // If everyone (except drawer) guessed -> end round
        const guessersNeeded = updatedPlayers.filter((p) => p.id !== s.drawerId).length;
        if (updatedState.correctGuessers.length >= guessersNeeded && hostIdRef.current === me.id) {
          setTimeout(() => endRound(), 600);
        }
        return;
      }
      // Close guess (off by 1-2 chars)
      if (closeGuess(guess, target)) {
        const closeMsg: ChatMessage = {
          id: crypto.randomUUID(),
          playerId: me.id,
          playerName: me.name,
          text: `${t}  (close!)`,
          kind: "close",
          ts: Date.now(),
        };
        setChat((c) => [...c.slice(-100), closeMsg]);
        send({ kind: "chat", message: closeMsg });
        return;
      }
    }

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: me.id,
      playerName: me.name,
      text: t,
      kind: "guess",
      ts: Date.now(),
    };
    setChat((c) => [...c.slice(-100), msg]);
    send({ kind: "chat", message: msg });
  }, [send]);

  // Round management (host)
  const startGame = useCallback(() => {
    if (!isHost) return;
    const list = playersRef.current;
    if (list.length < 2) return;
    startNextRound(0, list.map((p) => ({ ...p, score: 0 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  const startNextRound = useCallback(
    (roundIndex: number, basePlayers?: Player[]) => {
      const list = basePlayers ?? playersRef.current;
      if (list.length === 0) return;
      const drawer = list[roundIndex % list.length];
      const choices = pickWords(3);
      wordChoicesRef.current = choices;
      const newState: RoundState = {
        drawerId: drawer.id,
        word: null,
        maskedWord: null,
        endsAt: null,
        round: roundIndex + 1,
        totalRounds: stateRef.current.totalRounds,
        status: "picking",
        correctGuessers: [],
      };
      setState(newState);
      setPlayers(list);
      send({ kind: "state", state: newState, players: list });
      // clear canvas
      onDraw({ type: "clear" });
      send({ kind: "draw", action: { type: "clear" }, from: playerRef.current.id });

      // Show word choices to drawer
      if (drawer.id === playerRef.current.id) {
        setWordChoices(choices);
      } else {
        setWordChoices([]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send, onDraw],
  );

  const pickWord = useCallback(
    (word: string) => {
      const s = stateRef.current;
      if (s.drawerId !== playerRef.current.id) return;
      myWordRef.current = word;
      const newState: RoundState = {
        ...s,
        word, // broadcast to all (we want all clients to know for chat checking; in real prod hide from non-drawers)
        maskedWord: maskWord(word),
        endsAt: Date.now() + 80_000,
        status: "drawing",
      };
      setState(newState);
      send({ kind: "state", state: newState, players: playersRef.current });
      setWordChoices([]);
    },
    [send],
  );

  const endRound = useCallback(() => {
    const s = stateRef.current;
    const reveal: RoundState = { ...s, status: "reveal", endsAt: Date.now() + 4000 };
    setState(reveal);
    send({ kind: "state", state: reveal, players: playersRef.current });

    setTimeout(() => {
      const nextRoundIndex = s.round; // round was 1-based
      if (nextRoundIndex >= s.totalRounds) {
        const finalState: RoundState = { ...reveal, status: "lobby", drawerId: null, word: null, maskedWord: null, endsAt: null };
        setState(finalState);
        send({ kind: "state", state: finalState, players: playersRef.current });
      } else if (hostIdRef.current === playerRef.current.id) {
        startNextRound(nextRoundIndex);
      }
    }, 4200);
  }, [send, startNextRound]);

  // Timer tick - host ends round when time up
  useEffect(() => {
    if (state.status !== "drawing" || !state.endsAt) return;
    const t = setInterval(() => {
      if (!stateRef.current.endsAt) return;
      if (Date.now() >= stateRef.current.endsAt && hostIdRef.current === playerRef.current.id) {
        endRound();
      }
    }, 500);
    return () => clearInterval(t);
  }, [state.status, state.endsAt, endRound]);

  return {
    players,
    chat,
    state,
    isHost,
    hostId,
    wordChoices,
    broadcastDraw,
    sendChat,
    startGame,
    pickWord,
    skipRound: endRound,
    updateSnapshot,
  };
}

function closeGuess(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;
  let diffs = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) diffs++;
  return diffs > 0 && diffs <= 2;
}

export { WORDS };
