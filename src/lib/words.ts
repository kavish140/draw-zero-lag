export const WORDS = [
  "pizza", "skyscraper", "astronaut", "guitar", "octopus", "rainbow",
  "volcano", "submarine", "robot", "dragon", "pirate", "lighthouse",
  "tornado", "cactus", "jellyfish", "hamburger", "telescope", "windmill",
  "treasure", "mermaid", "snowman", "skateboard", "unicorn", "rocket",
  "campfire", "butterfly", "elephant", "scarecrow", "bicycle", "donut",
  "mountain", "sandcastle", "spaceship", "kangaroo", "penguin", "wizard",
  "dinosaur", "ninja", "vampire", "ghost", "zombie", "alien",
  "iceberg", "saxophone", "umbrella", "diamond", "lightning", "popcorn",
];

export function pickWords(n = 3): string[] {
  const pool = [...WORDS];
  const out: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function maskWord(word: string): string {
  return word
    .split("")
    .map((c) => (c === " " ? " " : "_"))
    .join(" ");
}
