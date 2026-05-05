export type Player = {
  id: string;
  name: string;
  score: number;
  color: string;
};

export type StrokePoint = { x: number; y: number };
export type StrokeSegment = {
  id: string;
  color: string;
  size: number;
  mode: "draw" | "erase";
  points: StrokePoint[]; // normalized 0..1
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  kind: "guess" | "system" | "correct" | "close";
  ts: number;
};

export type RoundState = {
  drawerId: string | null;
  word: string | null; // only known to drawer (broadcast hidden mask to others)
  maskedWord: string | null;
  endsAt: number | null; // epoch ms
  round: number;
  totalRounds: number;
  status: "lobby" | "picking" | "drawing" | "reveal";
  correctGuessers: string[];
};
