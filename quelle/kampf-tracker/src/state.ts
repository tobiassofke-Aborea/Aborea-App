import OBR from "@owlbear-rodeo/sdk";

export const ID = "de.sofke.kampf-tracker";
const KEY = `${ID}/state`;

export interface Combatant {
  id: string;
  /** Name bei Spielern; bei Gegnern wird der Name aus dem Level gebildet */
  name: string;
  enemy: boolean;
  /** fest vergebene, fortlaufende Gegner-Nummer */
  no?: number;
  level?: number;
  ini: number;
  lp: number;
  lpMax: number;
  tokenId?: string;
  /** Reihenfolge des Hinzufügens, für Gleichstand bei der Ini */
  seq: number;
}

export interface State {
  combatants: Combatant[];
  turnId: string | null;
  round: number;
  nextNo: number;
  nextSeq: number;
}

export const emptyState = (): State => ({
  combatants: [],
  turnId: null,
  round: 0,
  nextNo: 1,
  nextSeq: 1,
});

export function parseState(metadata: Record<string, unknown>): State {
  const raw = metadata[KEY] as Partial<State> | undefined;
  return { ...emptyState(), ...(raw ?? {}) };
}

export async function loadState(): Promise<State> {
  return parseState(await OBR.room.getMetadata());
}

export async function saveState(state: State): Promise<void> {
  sortCombatants(state);
  await OBR.room.setMetadata({ [KEY]: state });
}

export function onStateChange(cb: (s: State) => void): () => void {
  return OBR.room.onMetadataChange((m) => cb(parseState(m)));
}

export function displayName(c: Combatant): string {
  return c.enemy ? `Gegner lvl ${c.level ?? 1}` : c.name || "Unbenannt";
}

export function isDefeated(c: Combatant): boolean {
  return c.enemy && c.lp <= 0;
}

export function sortCombatants(state: State): void {
  state.combatants.sort((a, b) => b.ini - a.ini || a.seq - b.seq);
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Kämpfer, die tatsächlich an die Reihe kommen (besiegte Gegner werden übersprungen) */
export function activeOrder(state: State): Combatant[] {
  return state.combatants.filter((c) => !isDefeated(c));
}

export function current(state: State): Combatant | undefined {
  return state.combatants.find((c) => c.id === state.turnId);
}

/** Wer nach dem aktuellen Kämpfer dran ist */
export function upNext(state: State): Combatant | undefined {
  const order = activeOrder(state);
  if (order.length === 0) return undefined;
  if (!state.turnId) return order[0];
  const all = state.combatants;
  const start = all.findIndex((c) => c.id === state.turnId);
  for (let i = 1; i <= all.length; i++) {
    const c = all[(start + i) % all.length];
    if (!isDefeated(c) && c.id !== state.turnId) return c;
  }
  return undefined;
}

export function advance(state: State): void {
  const order = activeOrder(state);
  if (order.length === 0) {
    state.turnId = null;
    return;
  }
  if (!state.turnId || state.round === 0) {
    state.turnId = order[0].id;
    state.round = Math.max(1, state.round);
    return;
  }
  const all = state.combatants;
  let idx = all.findIndex((c) => c.id === state.turnId);
  if (idx === -1) idx = -1;
  for (let i = 1; i <= all.length; i++) {
    const j = idx + i;
    const c = all[j % all.length];
    if (!isDefeated(c)) {
      if (j >= all.length) state.round += 1;
      state.turnId = c.id;
      return;
    }
  }
}

export function goBack(state: State): void {
  if (!state.turnId) return;
  const all = state.combatants;
  const idx = all.findIndex((c) => c.id === state.turnId);
  for (let i = 1; i <= all.length; i++) {
    const j = idx - i;
    const c = all[(j + all.length * 2) % all.length];
    if (!isDefeated(c)) {
      if (j < 0) {
        if (state.round <= 1) return; // vor Runde 1 geht es nicht zurück
        state.round -= 1;
      }
      state.turnId = c.id;
      return;
    }
  }
}
