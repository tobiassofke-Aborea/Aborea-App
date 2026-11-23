import OBR from "@owlbear-rodeo/sdk";
// @ts-ignore – reines JavaScript aus der Tracker-Version
import { startGM } from "./tracker.js";

const KEY = "de.sofke.kampf-tracker/ansicht";

interface Slim { name: string; type: "player" | "npc"; label: string }
interface View { turnCount: number; queue?: Slim[]; active: Slim | null; next: Slim | null }

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!);
}

function renderPlayer(view: View | undefined) {
  const round = document.getElementById("pvRound")!;
  const out = document.getElementById("pvQueue")!;
  const queue = view?.queue ?? [view?.active, view?.next].filter((x): x is Slim => !!x);
  if (!view || queue.length === 0) {
    round.textContent = "";
    out.innerHTML = `<span class="pv-empty">Kein Kampf aktiv</span>`;
    return;
  }
  round.textContent = view.turnCount ? `Zug ${view.turnCount}` : "Start";
  out.innerHTML = queue
    .map(
      (c, i) =>
        (i ? `<span class="pv-sep">›</span>` : "") +
        `<span class="pv-item${i === 0 ? " now" : ""}"><span class="badge ${c.type}">${esc(c.label)}</span><span class="name">${esc(c.name)}</span></span>`,
    )
    .join("");
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
    OBR.action.setWidth(460);
    OBR.action.setHeight(46);
    renderPlayer((await OBR.room.getMetadata())[KEY] as View | undefined);
    OBR.room.onMetadataChange((m) => renderPlayer(m[KEY] as View | undefined));
  }
  OBR.player.onChange((p) => {
    if (p.role !== role) window.location.reload();
  });
});
