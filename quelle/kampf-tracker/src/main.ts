import OBR from "@owlbear-rodeo/sdk";
// @ts-ignore – reines JavaScript aus der bisherigen Tracker-Version
import { startGM } from "./tracker.js";

const KEY = "de.sofke.kampf-tracker/ansicht";

interface Slim { name: string; type: "player" | "npc"; label: string }
interface View { turnCount: number; active: Slim | null; next: Slim | null }

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!);
}

function who(c: Slim | null): string {
  if (!c) return `<span class="pv-empty">–</span>`;
  return `<span class="badge ${c.type}">${esc(c.label)}</span> <span class="name">${esc(c.name)}</span>`;
}

function renderPlayer(view: View | undefined) {
  const round = document.getElementById("pvRound")!;
  if (!view || !view.active) {
    round.textContent = "Kein Kampf aktiv";
    document.getElementById("pvActive")!.innerHTML = who(null);
    document.getElementById("pvNext")!.innerHTML = who(null);
    return;
  }
  round.textContent = view.turnCount ? `Zug ${view.turnCount}` : "Kampf beginnt";
  document.getElementById("pvActive")!.innerHTML = who(view.active);
  document.getElementById("pvNext")!.innerHTML = who(view.next);
}

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  if (role === "GM") {
    document.body.classList.add("role-gm");
    OBR.action.setWidth(480);
    OBR.action.setHeight(720);
    startGM((view: View) => {
      OBR.room.setMetadata({ [KEY]: view });
    });
  } else {
    document.body.classList.add("role-player");
    OBR.action.setWidth(300);
    OBR.action.setHeight(210);
    renderPlayer((await OBR.room.getMetadata())[KEY] as View | undefined);
    OBR.room.onMetadataChange((m) => renderPlayer(m[KEY] as View | undefined));
  }
  OBR.player.onChange((p) => {
    if (p.role !== role) window.location.reload();
  });
});
