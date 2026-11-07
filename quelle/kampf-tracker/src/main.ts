import OBR, { Theme } from "@owlbear-rodeo/sdk";
import { roll, valueOf } from "./dice";
import {
  Combatant,
  State,
  advance,
  current,
  displayName,
  emptyState,
  goBack,
  isDefeated,
  loadState,
  newId,
  onStateChange,
  saveState,
  upNext,
} from "./state";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let state: State = emptyState();
let role: "GM" | "PLAYER" = "PLAYER";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function label(c: Combatant | undefined): string {
  if (!c) return "–";
  return c.enemy ? `#${c.no} ${displayName(c)}` : displayName(c);
}

function applyTheme(theme: Theme) {
  const r = document.documentElement.style;
  r.setProperty("--bg", theme.background.paper);
  r.setProperty("--text", theme.text.primary);
  r.setProperty("--muted", theme.text.secondary);
  r.setProperty("--accent", theme.primary.main);
  r.setProperty("--accent-text", theme.primary.contrastText);
  document.documentElement.dataset.mode = theme.mode.toLowerCase();
}

/* ---------- Spieleransicht ---------- */

function renderPlayer() {
  const cur = current(state);
  const next = upNext(state);
  const active = state.round > 0 && !!cur;
  $("p-round").textContent = active ? `Runde ${state.round}` : "Kein Kampf aktiv";
  $("p-current").textContent = active ? label(cur) : "–";
  $("p-next").textContent = active ? label(next) : "–";
}

/* ---------- Spielleiteransicht ---------- */

async function update(fn: (s: State) => void) {
  const s = await loadState();
  fn(s);
  await saveState(s);
}

function renderGM() {
  const cur = current(state);
  const started = state.round > 0 && !!cur;
  $("g-round").textContent = started ? `Runde ${state.round}` : "Kampf nicht gestartet";
  $("btn-next").textContent = started ? "Weiter ▶" : "Kampf starten ▶";
  $<HTMLButtonElement>("btn-back").disabled = !started;
  $("g-next").textContent = started ? `Als Nächstes: ${label(upNext(state))}` : "";

  const list = $("list");
  if (state.combatants.length === 0) {
    list.innerHTML = `<p class="empty">Noch niemand im Kampf.</p>`;
    return;
  }

  list.innerHTML = state.combatants
    .map((c) => {
      const isCur = c.id === state.turnId && started;
      const pct = c.lpMax > 0 ? Math.max(0, Math.min(100, (c.lp / c.lpMax) * 100)) : 0;
      const nameField = c.enemy
        ? `<span class="no">#${c.no}</span>
           <span class="ename">Gegner lvl <input data-f="level" type="number" min="0" value="${c.level ?? 1}" class="tiny" /></span>`
        : `<input data-f="name" value="${esc(c.name)}" class="name" />`;
      return `
      <div class="row${isCur ? " current" : ""}${isDefeated(c) ? " down" : ""}" data-id="${c.id}">
        <div class="line">
          <span class="turn">${isCur ? "▶" : ""}</span>
          ${nameField}
          <span class="spacer"></span>
          ${c.tokenId ? `<button data-a="select" class="icon" title="Token auf der Karte auswählen">◎</button>` : ""}
          <label class="ini">Ini <input data-f="ini" type="number" value="${c.ini}" class="tiny" /></label>
          <button data-a="remove" class="icon" title="Entfernen">×</button>
        </div>
        <div class="line">
          <span class="lp">LP <b>${c.lp}</b> / <input data-f="lpMax" type="number" value="${c.lpMax}" class="tiny" /></span>
          <span class="hp"><span style="width:${pct}%"></span></span>
          <input data-f="amount" type="number" min="0" class="amount" placeholder="0" />
          <button data-a="dmg">−LP</button>
          <button data-a="heal">+LP</button>
        </div>
        ${isDefeated(c) ? `<div class="downnote">besiegt – wird übersprungen</div>` : ""}
      </div>`;
    })
    .join("");
}

function render() {
  if (role === "GM") renderGM();
  else renderPlayer();
}

function setupGM() {
  $("gm-view").hidden = false;

  // Zug-Steuerung
  $("btn-next").onclick = () => update(advance);
  $("btn-back").onclick = () => update(goBack);

  confirmButton($("btn-reset-round") as HTMLButtonElement, () =>
    update((s) => {
      s.round = 0;
      s.turnId = null;
    }),
  );
  confirmButton($("btn-clear") as HTMLButtonElement, () =>
    update((s) => {
      s.combatants = [];
      s.round = 0;
      s.turnId = null;
      s.nextNo = 1;
    }),
  );

  // Hinzufügen
  const kindInputs = document.querySelectorAll<HTMLInputElement>('input[name="kind"]');
  const syncKind = () => {
    const enemy = document.querySelector<HTMLInputElement>('input[name="kind"]:checked')!.value === "enemy";
    document.body.classList.toggle("kind-enemy", enemy);
    document.body.classList.toggle("kind-player", !enemy);
  };
  kindInputs.forEach((i) => (i.onchange = syncKind));
  syncKind();

  $("btn-add").onclick = () => {
    const enemy = document.body.classList.contains("kind-enemy");
    const iniExpr = $<HTMLInputElement>("add-ini").value;
    const lpExpr = $<HTMLInputElement>("add-lp").value;
    const name = $<HTMLInputElement>("add-name").value.trim();
    const level = parseInt($<HTMLInputElement>("add-level").value, 10) || 0;
    const count = enemy ? Math.max(1, Math.min(20, parseInt($<HTMLInputElement>("add-count").value, 10) || 1)) : 1;
    if (!enemy && !name) {
      $<HTMLInputElement>("add-name").focus();
      return;
    }
    update((s) => {
      for (let i = 0; i < count; i++) {
        const lp = Math.max(0, valueOf(lpExpr));
        s.combatants.push({
          id: newId(),
          name: enemy ? "" : name,
          enemy,
          no: enemy ? s.nextNo++ : undefined,
          level: enemy ? level : undefined,
          ini: valueOf(iniExpr),
          lp,
          lpMax: lp,
          seq: s.nextSeq++,
        });
      }
    });
    $<HTMLInputElement>("add-name").value = "";
  };

  // Liste: Eingaben und Knöpfe
  const list = $("list");
  list.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.dataset.f;
    const id = input.closest<HTMLElement>(".row")?.dataset.id;
    if (!f || !id || f === "amount") return;
    update((s) => {
      const c = s.combatants.find((x) => x.id === id);
      if (!c) return;
      if (f === "name") c.name = input.value.trim();
      if (f === "level") c.level = parseInt(input.value, 10) || 0;
      if (f === "ini") c.ini = parseInt(input.value, 10) || 0;
      if (f === "lpMax") {
        const max = Math.max(0, parseInt(input.value, 10) || 0);
        // Wenn noch volle LP: aktuelle LP mitziehen
        if (c.lp === c.lpMax) c.lp = max;
        c.lpMax = max;
      }
    });
  });

  list.addEventListener("keydown", (e) => {
    const input = e.target as HTMLInputElement;
    if (e.key === "Enter" && input.dataset.f === "amount") {
      // Enter im LP-Feld = Schaden
      input.closest(".row")?.querySelector<HTMLButtonElement>('[data-a="dmg"]')?.click();
    }
  });

  list.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-a]");
    if (!btn) return;
    const row = btn.closest<HTMLElement>(".row")!;
    const id = row.dataset.id!;
    const a = btn.dataset.a;
    if (a === "select") {
      const c = state.combatants.find((x) => x.id === id);
      if (c?.tokenId) OBR.player.select([c.tokenId]);
      return;
    }
    if (a === "dmg" || a === "heal") {
      const amount = parseInt(row.querySelector<HTMLInputElement>('[data-f="amount"]')!.value, 10) || 0;
      if (!amount) return;
      update((s) => {
        const c = s.combatants.find((x) => x.id === id);
        if (!c) return;
        if (a === "dmg") c.lp = Math.max(0, c.lp - amount);
        else c.lp = c.lpMax > 0 ? Math.min(c.lpMax, c.lp + amount) : c.lp + amount;
      });
    }
    if (a === "remove") {
      update((s) => {
        const idx = s.combatants.findIndex((x) => x.id === id);
        if (idx === -1) return;
        // Wer gerade dran ist und entfernt wird: Zug an den Nächsten geben
        if (s.turnId === id) advance(s);
        s.combatants = s.combatants.filter((x) => x.id !== id);
        if (s.turnId === id) s.turnId = null;
      });
    }
  });

  setupDice();
}

/* ---------- Würfeln ---------- */

const log: string[] = [];

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    /* Speicher nicht verfügbar */
  }
  return null;
}

function showRoll(title: string, expr: string) {
  const r = roll(expr);
  const out = $("dice-result");
  if (!r) {
    out.innerHTML = `<span class="err">„${esc(expr)}“ ist kein gültiger Wurf (z. B. 2W6+3)</span>`;
    return;
  }
  out.innerHTML = `<span class="dtitle">${esc(title)}</span> <span class="dtotal">${r.total}</span> <span class="ddetail">${esc(expr.toUpperCase())}: ${esc(r.detail)}</span>`;
  log.unshift(`${title}: ${r.total} (${expr.toUpperCase()})`);
  log.length = Math.min(log.length, 6);
  $("dice-log").innerHTML = log.slice(1).map((l) => `<div>${esc(l)}</div>`).join("");
}

function setupDice() {
  const hit = $<HTMLInputElement>("dice-hit");
  const dmg = $<HTMLInputElement>("dice-dmg");
  hit.value = store(`kt-hit`) ?? hit.value;
  dmg.value = store(`kt-dmg`) ?? dmg.value;
  hit.onchange = () => store("kt-hit", hit.value);
  dmg.onchange = () => store("kt-dmg", dmg.value);

  $("roll-hit").onclick = () => showRoll("Treffen", hit.value);
  $("roll-dmg").onclick = () => showRoll("Schaden", dmg.value);
  hit.onkeydown = (e) => e.key === "Enter" && showRoll("Treffen", hit.value);
  dmg.onkeydown = (e) => e.key === "Enter" && showRoll("Schaden", dmg.value);

  const quick = $("quick");
  for (const d of [4, 6, 8, 10, 12, 20, 100]) {
    const b = document.createElement("button");
    b.textContent = `W${d}`;
    b.onclick = () => showRoll(`W${d}`, `1W${d}`);
    quick.appendChild(b);
  }
}

/** Knopf, der beim ersten Klick nachfragt („Sicher?“) und erst beim zweiten auslöst */
function confirmButton(btn: HTMLButtonElement, action: () => void) {
  const text = btn.textContent;
  let armed = false;
  let timer: number | undefined;
  btn.onclick = () => {
    if (!armed) {
      armed = true;
      btn.textContent = "Sicher? Nochmal klicken";
      btn.classList.add("warn");
      timer = window.setTimeout(reset, 3000);
      return;
    }
    reset();
    action();
  };
  function reset() {
    armed = false;
    window.clearTimeout(timer);
    btn.textContent = text;
    btn.classList.remove("warn");
  }
}

/* ---------- Start ---------- */

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);

  $("loading").hidden = true;
  if (role === "GM") {
    setupGM();
    OBR.action.setHeight(640);
    OBR.action.setWidth(420);
  } else {
    $("player-view").hidden = false;
    OBR.action.setHeight(220);
    OBR.action.setWidth(300);
  }

  state = await loadState();
  render();
  onStateChange((s) => {
    state = s;
    render();
  });

  // Falls ein Spieler während der Sitzung zum GM gemacht wird (oder umgekehrt)
  OBR.player.onChange((p) => {
    if (p.role !== role) window.location.reload();
  });
});
