import OBR, { Item, isImage } from "@owlbear-rodeo/sdk";
import { ID, loadState, newId, saveState } from "./state";

function tokenName(item: Item): string {
  if (isImage(item) && item.text?.plainText) return item.text.plainText;
  return item.name || "Unbenannt";
}

const ICON = new URL("./icon.svg", window.location.href).toString();

OBR.onReady(() => {
  OBR.contextMenu.create({
    id: `${ID}/add-player`,
    icons: [
      {
        icon: ICON,
        label: "Kampf: als Spieler hinzufügen",
        filter: {
          roles: ["GM"],
          every: [{ key: "layer", value: "CHARACTER" }],
        },
      },
    ],
    async onClick(context) {
      const state = await loadState();
      for (const item of context.items) {
        if (state.combatants.some((c) => c.tokenId === item.id)) continue;
        state.combatants.push({
          id: newId(),
          name: tokenName(item),
          enemy: false,
          ini: 0,
          lp: 0,
          lpMax: 0,
          tokenId: item.id,
          seq: state.nextSeq++,
        });
      }
      await saveState(state);
      OBR.notification.show(`${context.items.length} zum Kampf hinzugefügt`);
    },
  });

  OBR.contextMenu.create({
    id: `${ID}/add-enemy`,
    icons: [
      {
        icon: ICON,
        label: "Kampf: als Gegner hinzufügen",
        filter: {
          roles: ["GM"],
          every: [{ key: "layer", value: "CHARACTER" }],
        },
      },
    ],
    async onClick(context) {
      const state = await loadState();
      const labels: Record<string, string> = {};
      for (const item of context.items) {
        if (state.combatants.some((c) => c.tokenId === item.id)) continue;
        const no = state.nextNo++;
        state.combatants.push({
          id: newId(),
          name: "",
          enemy: true,
          no,
          level: 1,
          ini: 0,
          lp: 0,
          lpMax: 0,
          tokenId: item.id,
          seq: state.nextSeq++,
        });
        labels[item.id] = `#${no}`;
      }
      await saveState(state);
      // Token auf der Karte mit der Gegner-Nummer beschriften, damit alle sie zuordnen können
      const ids = Object.keys(labels);
      if (ids.length) {
        await OBR.scene.items.updateItems(ids, (items) => {
          for (const it of items) {
            if (isImage(it)) {
              it.text.plainText = labels[it.id];
              it.text.richText = [{ type: "paragraph", children: [{ text: labels[it.id] }] }];
            }
          }
        });
      }
      OBR.notification.show(`${ids.length} Gegner zum Kampf hinzugefügt`);
    },
  });
});
