export interface RollResult {
  total: number;
  detail: string;
}

/**
 * Würfelt einen Ausdruck wie "2W6+3", "1d20-1", "W10", "2W6+1W4" oder einfach "12".
 * Gibt null zurück, wenn der Ausdruck nicht lesbar ist.
 */
export function roll(expr: string): RollResult | null {
  const clean = expr.replace(/\s+/g, "").toLowerCase().replace(/w/g, "d");
  if (!clean) return null;
  if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(clean)) return null;

  const terms = clean.match(/[+-]?(\d*d\d+|\d+)/g) ?? [];
  let total = 0;
  const parts: string[] = [];

  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    if (body.includes("d")) {
      const [countStr, sidesStr] = body.split("d");
      const count = Math.min(countStr ? parseInt(countStr, 10) : 1, 100);
      const sides = parseInt(sidesStr, 10);
      if (!sides || sides < 2) return null;
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));
      const sum = rolls.reduce((a, b) => a + b, 0);
      total += sign * sum;
      parts.push(`${sign < 0 ? "−" : parts.length ? "+" : ""}[${rolls.join(", ")}]`);
    } else {
      const n = parseInt(body, 10);
      total += sign * n;
      parts.push(`${sign < 0 ? "−" : parts.length ? "+" : ""}${n}`);
    }
  }
  return { total, detail: parts.join(" ") };
}

/** Zahl oder Würfelausdruck auswerten, z. B. für Ini oder LP beim Hinzufügen */
export function valueOf(expr: string, fallback = 0): number {
  const r = roll(expr);
  return r ? r.total : fallback;
}
