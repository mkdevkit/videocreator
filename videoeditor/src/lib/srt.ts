export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

function parseStamp(s: string): number {
  const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600000 + Number(m[2]) * 60000 + Number(m[3]) * 1000 + Number(m[4].padEnd(3, "0").slice(0, 3));
}

export function parseSrt(raw: string): Cue[] {
  const blocks = raw.replace(/\r/g, "").split(/\n\n+/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const time = lines.find((l) => l.includes("-->"));
    if (!time) continue;
    const [a, b] = time.split("-->");
    const text = lines
      .slice(lines.indexOf(time) + 1)
      .join("\n")
      .trim();
    if (!text) continue;
    cues.push({ startMs: parseStamp(a), endMs: parseStamp(b), text });
  }
  return cues;
}

export function toSrt(cues: Cue[]): string {
  return cues
    .map((c, i) => {
      const fmt = (ms: number) => {
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const f = Math.floor(ms % 1000);
        const p = (n: number, w: number) => String(n).padStart(w, "0");
        return `${p(h, 2)}:${p(m, 2)}:${p(s, 2)},${p(f, 3)}`;
      };
      return `${i + 1}\n${fmt(c.startMs)} --> ${fmt(c.endMs)}\n${c.text}\n`;
    })
    .join("\n");
}
