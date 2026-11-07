// Kampf-Tracker als Owlbear-Rodeo-Extension (Spielleiter-Ansicht).
// Inhaltlich wie die Artifact-Version; die Speicherung läuft jetzt über
// localStorage, und nach jeder Änderung am Kampf geht eine schlanke Ansicht
// (wer ist dran, wer als Nächstes) an die Spieler im Raum.

const store = {
  async get(key){
    try{ const v = localStorage.getItem('kampf-tracker:'+key); return v===null ? null : {value:v}; }
    catch(e){ return null; }
  },
  async set(key, value){
    try{ localStorage.setItem('kampf-tracker:'+key, value); return true; }
    catch(e){ return false; }
  }
};

export function startGM(publish){

// Schlanke Ansicht für die Spieler: nur wer dran ist und wer danach kommt.
function publishView(){
  try{
    const alive = arr => arr.filter(c=>!c.dead);
    const byIni = arr => arr.sort((a,b)=> a.currentInit - b.currentInit);
    const active = alive(byIni([...combat]))[0] || null;
    let next = null;
    if(active){
      // Nächsten Zug simulieren: Aktiver bekommt seine Basis-INI drauf, dann neu sortieren.
      const sim = combat.map(c => ({...c, currentInit: c.id===active.id ? c.currentInit + c.baseInit : c.currentInit}));
      next = alive(byIni(sim))[0] || null;
    }
    const slim = c => c ? { name: c.name, type: c.type, label: c.type==='player' ? (c.icon||'⭐') : String(c.instanceNum ?? '?') } : null;
    publish({ turnCount, active: slim(active), next: slim(next) });
  }catch(e){ /* Veröffentlichen ist nur Komfort */ }
}


// ---------- State ----------
let templates = [];       // Gegner-Vorlagen
let playerTemplates = []; // Spieler-Vorlagen
let groups = [];          // Gruppennamen (z.B. "Party", "Encounter 1"), zugewiesen über die Vorlagen
let combat = [];          // aktive Kampfteilnehmer
let turnCount = 0;
let storageOk = true;
let expandedHistory = new Set();
let nextNum = 1; // globaler, fortlaufender Zähler für eindeutige Gegner-/Spieler-Nummern

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function uid(){ return Math.random().toString(36).slice(2,9); }

// D&D-inspirierte Symbol-Auswahl, nur für Spieler (statt festem Stern).
const PLAYER_ICONS = [
  {e:'⭐', l:'Stern'},
  {e:'⚔️', l:'Schwert'},
  {e:'🛡️', l:'Schild'},
  {e:'🏹', l:'Bogen'},
  {e:'🗡️', l:'Dolch'},
  {e:'🪓', l:'Axt'},
  {e:'🔨', l:'Hammer'},
  {e:'🔮', l:'Kristallkugel'},
  {e:'📖', l:'Zauberbuch'},
  {e:'🧪', l:'Trank'},
  {e:'🍲', l:'Kochkessel'},
  {e:'🧙', l:'Magier'},
  {e:'🐉', l:'Drache'},
  {e:'🦁', l:'Löwe'},
  {e:'🐺', l:'Wolf'},
  {e:'🦅', l:'Adler'},
  {e:'🦉', l:'Eule'},
  {e:'🕷️', l:'Spinne'},
  {e:'🔥', l:'Feuer'},
  {e:'❄️', l:'Eis'},
  {e:'⚡', l:'Blitz'},
  {e:'💀', l:'Totenkopf'},
  {e:'👑', l:'Krone'},
  {e:'💰', l:'Schatz'},
  {e:'🍀', l:'Klee'},
  {e:'🌙', l:'Mond'}
];
function playerIconOptionsHtml(selected){
  return PLAYER_ICONS.map(o => `<option value="${o.e}" ${o.e===(selected||'⭐')?'selected':''}>${o.e} ${o.l}</option>`).join('');
}

function defaultTemplates(){
  const list = [];
  for(let lvl=1; lvl<=20; lvl++){
    list.push({
      id: uid(),
      name: "Gegner Lvl " + lvl,
      hp: 10 + lvl*6,
      initiative: 10 + lvl,
      armor: Math.floor(lvl/2),
      attack: "1W20+" + (2 + Math.floor(lvl/2)),
      damage: (1 + Math.floor(lvl/6)) + "W6+" + Math.floor(lvl/3),
      apMax: 2 + Math.floor(lvl/5),
      manaMax: 0,
      kritThreshold: 5
    });
  }
  return list;
}

// ---------- Storage ----------
async function loadAll(){
  try{
    const t = await store.get('gegner-vorlagen');
    templates = t ? JSON.parse(t.value) : defaultTemplates();
  }catch(e){ templates = defaultTemplates(); }
  if(templates.length === 0) templates = defaultTemplates();

  try{
    const p = await store.get('spieler-vorlagen');
    playerTemplates = p ? JSON.parse(p.value) : [];
  }catch(e){ playerTemplates = []; }

  try{
    const g = await store.get('gruppen');
    groups = g ? JSON.parse(g.value) : [];
  }catch(e){ groups = []; }

  try{
    const c = await store.get('kampf-status');
    if(c){
      const parsed = JSON.parse(c.value);
      combat = parsed.combat || [];
      turnCount = parsed.turnCount || 0;
      nextNum = parsed.nextNum || 1;
    }
  }catch(e){ combat = []; turnCount = 0; nextNum = 1; }

  render();
  publishView();
  setStatus('bereit — Daten werden in diesem Browser gespeichert. Backup: ⚙️ → Speichern / Laden.');
}

async function saveTemplates(){
  try{
    const r = await store.set('gegner-vorlagen', JSON.stringify(templates), false);
    if(!r){ storageOk=false; setStatus('Speichern fehlgeschlagen — Änderungen evtl. nicht dauerhaft.'); }
  }catch(e){ storageOk=false; setStatus('Speichern fehlgeschlagen — Änderungen evtl. nicht dauerhaft.'); }
}
async function savePlayerTemplates(){
  try{
    await store.set('spieler-vorlagen', JSON.stringify(playerTemplates), false);
  }catch(e){ setStatus('Speichern fehlgeschlagen — Änderungen evtl. nicht dauerhaft.'); }
}
async function saveGroups(){
  try{
    await store.set('gruppen', JSON.stringify(groups), false);
  }catch(e){ setStatus('Speichern fehlgeschlagen — Änderungen evtl. nicht dauerhaft.'); }
}
async function saveCombat(){
  publishView();
  try{
    await store.set('kampf-status', JSON.stringify({combat, turnCount, nextNum}), false);
  }catch(e){ setStatus('Speichern fehlgeschlagen — Änderungen evtl. nicht dauerhaft.'); }
}

function setStatus(msg){ $('#statusBar').textContent = msg; }

// ---------- Eigenes Modal (statt confirm()/prompt(), die in eingebetteten Vorschauen blockiert sein können) ----------
let modalResolve = null;
function openModal(message, opts){
  opts = opts || {};
  return new Promise(resolve => {
    modalResolve = resolve;
    $('#modalMsg').textContent = message;
    const inp = $('#modalInput');
    if(opts.withInput){
      inp.style.display = 'block';
      inp.value = opts.defaultValue || '';
    } else {
      inp.style.display = 'none';
    }
    // Bei reinen Ja/Nein-Fragen (kein Eingabefeld) lauten die Buttons natürlicher
    // "Ja"/"Nein" statt "OK"/"Abbrechen".
    $('#modalOk').textContent = opts.okText || (opts.withInput ? 'OK' : 'Ja');
    $('#modalCancel').textContent = opts.cancelText || (opts.withInput ? 'Abbrechen' : 'Nein');
    $('#modalOverlay').classList.add('open');
    if(opts.withInput){ setTimeout(()=>inp.focus(), 0); }
  });
}
function closeModal(result){
  $('#modalOverlay').classList.remove('open');
  const resolve = modalResolve;
  modalResolve = null;
  if(resolve) resolve(result);
}
$('#modalCancel').addEventListener('click', () => closeModal(null));
$('#modalOk').addEventListener('click', () => {
  const inp = $('#modalInput');
  closeModal(inp.style.display==='block' ? (inp.value || null) : true);
});
$('#modalInput').addEventListener('keydown', (e) => {
  if(e.key==='Enter'){ closeModal($('#modalInput').value || null); }
  else if(e.key==='Escape'){ closeModal(null); }
});

// ---------- Dice ----------
function rollDice(notation){
  if(!notation) return null;
  const cleaned = notation.trim().replace(/\s+/g,'');
  if(!cleaned) return null;
  // Erlaubt beliebig viele Würfel-/Zahlenteile, verknüpft mit + oder -,
  // z.B. "2W6+3", "1W20+1W6-2", "3W4+2W6+5".
  const overall = /^[+-]?\d+([wWdD]\d+)?([+-]\d+([wWdD]\d+)?)*$/;
  if(!overall.test(cleaned)) return null;
  const terms = cleaned.match(/[+-]?\d+(?:[wWdD]\d+)?/g) || [];
  let total = 0;
  terms.forEach(term => {
    const sign = term.startsWith('-') ? -1 : 1;
    const body = term.replace(/^[+-]/, '');
    const diceMatch = body.match(/^(\d+)[wWdD](\d+)$/);
    if(diceMatch){
      const count = parseInt(diceMatch[1],10);
      const sides = parseInt(diceMatch[2],10);
      let sum = 0;
      for(let i=0;i<count;i++){ sum += 1 + Math.floor(Math.random()*sides); }
      total += sign*sum;
    } else {
      total += sign*parseInt(body,10);
    }
  });
  return total;
}

// ---------- Rendering ----------
function render(){
  renderCombat();
  renderMiniQueue();
  renderTemplates();
  renderPlayerTemplates();
  renderSettings();
  renderSelects();
  $('#turnCounter').textContent = turnCount ? ('· Zug ' + turnCount) : '';
}

function sortedCombat(){
  return [...combat].sort((a,b)=> a.currentInit - b.currentInit);
}

// Kompakte Reihenfolge-Leiste: nur nicht-deaktivierte Charaktere, sortiert nach
// Initiative, links = als nächstes/aktuell dran.
function renderMiniQueue(){
  const wrap = $('#miniQueue');
  if(!wrap) return;
  const list = sortedCombat();
  if(list.length===0){ wrap.innerHTML = ''; return; }
  const activeId = sortedCombat().find(c=>!c.dead)?.id;
  wrap.innerHTML = list.map((c,i) => {
    const label = c.type==='player' ? (c.icon||'⭐') : (c.instanceNum ?? '?');
    const cls = 'mini-badge ' + c.type + (c.id===activeId?' active':'') + (c.disabled?' mini-disabled':'') + (c.dead?' mini-dead':'');
    const sep = i>0 ? '<span class="mini-sep">›</span>' : '';
    return sep + `<span class="${cls}" data-id="${c.id}" data-name="${escapeHtml(c.name)}">${label}</span>`;
  }).join('');

  wrap.querySelectorAll('.mini-badge').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const popup = $('#miniPopup');
      const isOpenForThis = popup.style.display==='block' && popup.dataset.forId===el.dataset.id;
      if(isOpenForThis){
        popup.style.display = 'none';
      } else {
        showMiniPopup(el, el.dataset.id, el.dataset.name);
      }
    });
  });
}

function showMiniPopup(badgeEl, id, name){
  const popup = $('#miniPopup');
  const c = combat.find(x=>x.id===id);
  const label = c ? (c.type==='player' ? (c.icon||'⭐') : (c.instanceNum ?? '?')) : '';
  $('#miniPopupName').innerHTML = `<span class="mini-popup-badge ${c?c.type:''}">${label}</span> ${escapeHtml(name)}`;
  $('#miniDmgInput').value = '';
  popup.dataset.forId = id;

  if(c){
    const hpPct = c.maxHp>0 ? Math.max(0, Math.min(100, Math.round((c.hp/c.maxHp)*100))) : 0;
    const hpClass = hpPct<=25 ? 'crit' : (hpPct<=50 ? 'warn' : '');
    $('#miniPopupHpLabel').textContent = `❤️ ${c.hp}/${c.maxHp}`;
    const bar = $('#miniPopupHpBar');
    bar.style.width = hpPct + '%';
    bar.className = 'hp-bar-inner' + (hpClass ? ' '+hpClass : '');
  }

  popup.style.display = 'block';

  const rect = badgeEl.getBoundingClientRect();
  const popRect = popup.getBoundingClientRect();
  let left = rect.left + rect.width/2 - popRect.width/2;
  left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
  let top = rect.top - popRect.height - 8;
  if(top < 8) top = rect.bottom + 8;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}
async function applyMiniDamage(){
  const popup = $('#miniPopup');
  const id = popup.dataset.forId;
  if(!id) return;
  const raw = parseInt($('#miniDmgInput').value||'0',10);
  const dealt = await dealDamage(id, raw);
  if(dealt!==null){
    popup.style.display = 'none';
    render();
  }
}

// Referenzpunkt "jetzt" im Initiative-Verlauf: der niedrigste aktuelle Wert
// unter den noch lebenden Teilnehmern. Neue Charaktere docken hier an,
// statt bei 0 zu starten (sonst wären sie mitten im Kampf mehrfach hintereinander dran).
function referenceTick(){
  const active = combat.filter(c=>!c.dead);
  if(active.length===0) return 0;
  return Math.min(...active.map(c=>c.currentInit));
}

// Vergibt jedem Gegner eine fortlaufende, eindeutige Nummer (Spieler brauchen keine).
function nextInstanceNum(){
  const n = nextNum;
  nextNum += 1;
  return n;
}

function renderCombat(){
  const list = $('#combatList');
  list.innerHTML = '';
  if(combat.length === 0){
    list.innerHTML = '<div class="empty">Noch niemand im Kampf. Gegner oder Spieler hinzufügen.</div>';
    return;
  }
  const sorted = sortedCombat();
  const activeId = sorted.find(c => !c.dead)?.id;

  sorted.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'combat-row' + (c.id===activeId ? ' active':'') + (c.dead ? ' dead':'') + (c.disabled ? ' disabled':'');

    const main = document.createElement('div');
    main.className = 'row-main';

    const top = document.createElement('div');
    top.className = 'row-top';
    top.innerHTML = `
      <span class="badge ${c.type}">${c.type==='player' ? (c.icon||'⭐') : (c.instanceNum ?? '?')}</span>
      <span class="name ${c.dead?'kill-mark':''}">${c.dead?'💀 ':''}${c.disabled?'⏸️ ':''}${escapeHtml(c.name)}</span>
      <span class="ini-val">INI ${c.currentInit}</span>
      <span class="ini-base">(Basis ${c.baseInit})</span>
      ${c.id===activeId ? '<span class="turn-label">▶ Aktueller Zug</span>' : ''}
    `;
    main.appendChild(top);

    const hpPct = c.maxHp>0 ? Math.max(0, Math.min(100, Math.round((c.hp/c.maxHp)*100))) : 0;
    const hpClass = hpPct<=25 ? 'crit' : (hpPct<=50 ? 'warn' : '');
    const hpRow = document.createElement('div');
    hpRow.className = 'hp-row';
    hpRow.innerHTML = `
      <span class="hp-label">❤️ LP <b>${c.hp}</b>/${c.maxHp}</span>
      <span class="hp-bar-outer"><span class="hp-bar-inner ${hpClass}" style="width:${hpPct}%;"></span></span>
    `;
    main.appendChild(hpRow);

    const hpActions = document.createElement('div');
    hpActions.className = 'hp-actions';
    hpActions.innerHTML = `
      <input type="number" class="lp-input" placeholder="Wert" id="lp-input-${c.id}">
      <button class="btn small danger" data-act="applyDamage" data-id="${c.id}">Schaden</button>
      <button class="btn small ok" data-act="applyHeal" data-id="${c.id}">Heilen</button>
      <span class="lp-feedback" id="res-lpcalc-${c.id}"></span>
    `;
    main.appendChild(hpActions);

    const rollRow = document.createElement('div');
    rollRow.className = 'action-line';
    rollRow.innerHTML = `
      <span class="roll-group">
        <span class="action-label">🎯 Treffer</span>
        <span class="dice-note">${escapeHtml(c.attack||'—')}</span>
        <button class="btn dice-btn atk-dice" data-act="rollAttack" data-id="${c.id}">🎲</button>
        <span class="roll-result atk-result" id="res-attack-${c.id}"></span>
      </span>
      <span class="roll-group">
        <span class="action-label">⚔️ Schaden</span>
        <span class="dice-note">${escapeHtml(c.damage||'—')}</span>
        <button class="btn dice-btn dmg-dice" data-act="rollDamage" data-id="${c.id}">🎲</button>
        <span class="roll-result dmg-result" id="res-damage-${c.id}"></span>
      </span>
    `;
    main.appendChild(rollRow);

    const kritRow = document.createElement('div');
    kritRow.className = 'krit-row';
    kritRow.innerHTML = `<span class="krit-result" id="res-krit-${c.id}"></span>`;
    main.appendChild(kritRow);

    const stats = document.createElement('div');
    stats.className = 'stats';
    stats.innerHTML = `
      <span class="counter ap">⚡ AP
        <button class="counter-btn" data-act="ap-1" data-id="${c.id}">−</button>
        <span class="counter-val">${c.ap}</span><span class="counter-max">/${c.apMax||0}</span>
        <button class="counter-btn" data-act="ap+1" data-id="${c.id}">+</button>
      </span>
      <span class="counter mana">🔮 Mana
        <button class="counter-btn" data-act="mana-1" data-id="${c.id}">−</button>
        <span class="counter-val">${c.mana}</span><span class="counter-max">/${c.manaMax||0}</span>
        <button class="counter-btn" data-act="mana+1" data-id="${c.id}">+</button>
      </span>
    `;
    main.appendChild(stats);

    const refRow = document.createElement('div');
    refRow.className = 'ref-row';
    refRow.innerHTML = `<span class="ref-item">🛡️ Rüstung ${c.armor}</span><span class="ref-item">🎯 Krit ${c.kritThreshold ?? 5}</span>`;
    main.appendChild(refRow);

    const hist = (c.history||[]);
    if(hist.length){
      const lastLine = document.createElement('div');
      lastLine.className = 'last-activity';
      lastLine.textContent = hist[hist.length-1];
      main.appendChild(lastLine);
    }

    const histWrap = document.createElement('div');
    histWrap.className = 'history' + (expandedHistory.has(c.id) ? ' open' : '');
    if(hist.length > 1){
      histWrap.innerHTML = '<ul>' + hist.slice(0,-1).reverse().map(h=>`<li>${escapeHtml(h)}</li>`).join('') + '</ul>';
    } else {
      histWrap.innerHTML = '<div class="empty-hist">Keine weiteren Einträge.</div>';
    }
    main.appendChild(histWrap);

    const footer = document.createElement('div');
    footer.className = 'row-footer';
    footer.innerHTML = `
      ${hist.length > 1 ? `<button class="btn small" data-act="toggleHistory" data-id="${c.id}">${expandedHistory.has(c.id)?'Verlauf ▲':'Verlauf ▾'} (${hist.length-1})</button>` : '<span></span>'}
      <span class="footer-actions">
        <button class="btn small" data-act="editIni" data-id="${c.id}">Basis-INI ändern</button>
        <button class="btn small" data-act="toggleDisabled" data-id="${c.id}">${c.disabled ? 'Aktivieren' : 'Deaktivieren'}</button>
        <button class="btn small danger" data-act="remove" data-id="${c.id}">Entfernen</button>
      </span>
    `;
    main.appendChild(footer);

    row.appendChild(main);
    list.appendChild(row);
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function renderTemplates(){
  const wrap = $('#tplList');
  wrap.innerHTML = '';
  templates.forEach(t => {
    const row = document.createElement('div');
    row.className = 'tpl-row';
    row.innerHTML = `
      <div class="tpl-fields">
        <label>Name<input type="text" class="name-field" value="${escapeHtml(t.name)}" data-f="name"></label>
        <label>LP<input type="number" value="${t.hp}" data-f="hp"></label>
        <label>Initiative<input type="number" value="${t.initiative}" data-f="initiative"></label>
        <label>Rüstung<input type="number" value="${t.armor}" data-f="armor"></label>
        <label>Krit ab (W100)<input type="number" value="${t.kritThreshold??5}" data-f="kritThreshold"></label>
        <label>Treffer<input type="text" value="${escapeHtml(t.attack)}" data-f="attack"></label>
        <label>Schaden<input type="text" value="${escapeHtml(t.damage)}" data-f="damage"></label>
        <label>AP je Zug<input type="number" value="${t.apMax||0}" data-f="apMax"></label>
        <label>Max Mana<input type="number" value="${t.manaMax||0}" data-f="manaMax"></label>
        <label>Gruppe<select class="group-select" data-f="groupId">${groupOptionsHtml(t.groupId)}</select></label>
      </div>
      <button class="btn small danger" data-act="del-tpl" data-id="${t.id}">Löschen</button>
    `;
    row.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => {
        const f = inp.dataset.f;
        t[f] = (inp.type==='number') ? parseInt(inp.value||'0',10) : inp.value;
        saveTemplates();
        renderSelects();
      });
    });
    row.querySelector('.group-select').addEventListener('change', (e) => {
      t.groupId = e.target.value;
      saveTemplates(); render();
    });
    row.querySelector('[data-act=del-tpl]').addEventListener('click', () => {
      templates = templates.filter(x=>x.id!==t.id);
      saveTemplates(); render();
    });
    wrap.appendChild(row);
  });
}

function renderPlayerTemplates(){
  const wrap = $('#playerTplList');
  wrap.innerHTML = '';
  if(playerTemplates.length===0){
    wrap.innerHTML = '<div class="empty">Noch keine gespeicherten Spieler. "+ Neuer Spieler" klicken.</div>';
    return;
  }
  playerTemplates.forEach(t => {
    const row = document.createElement('div');
    row.className = 'tpl-row';
    row.innerHTML = `
      <div class="tpl-fields">
        <label>Name<input type="text" class="name-field" value="${escapeHtml(t.name)}" data-f="name"></label>
        <label>LP<input type="number" value="${t.hp}" data-f="hp"></label>
        <label>Initiative<input type="number" value="${t.initiative}" data-f="initiative"></label>
        <label>Rüstung<input type="number" value="${t.armor}" data-f="armor"></label>
        <label>Krit ab (W100)<input type="number" value="${t.kritThreshold??5}" data-f="kritThreshold"></label>
        <label>Treffer<input type="text" value="${escapeHtml(t.attack)}" data-f="attack"></label>
        <label>Schaden<input type="text" value="${escapeHtml(t.damage)}" data-f="damage"></label>
        <label>AP je Zug<input type="number" value="${t.apMax||0}" data-f="apMax"></label>
        <label>Max Mana<input type="number" value="${t.manaMax||0}" data-f="manaMax"></label>
        <label>Gruppe<select class="group-select" data-f="groupId">${groupOptionsHtml(t.groupId)}</select></label>
        <label>Symbol<select class="icon-select" data-f="icon">${playerIconOptionsHtml(t.icon)}</select></label>
      </div>
      <button class="btn small danger" data-act="del-ptpl" data-id="${t.id}">Löschen</button>
    `;
    row.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => {
        const f = inp.dataset.f;
        t[f] = (inp.type==='number') ? parseInt(inp.value||'0',10) : inp.value;
        savePlayerTemplates();
        renderSelects();
      });
    });
    row.querySelector('.group-select').addEventListener('change', (e) => {
      t.groupId = e.target.value;
      savePlayerTemplates(); render();
    });
    row.querySelector('.icon-select').addEventListener('change', (e) => {
      t.icon = e.target.value;
      savePlayerTemplates(); render();
    });
    row.querySelector('[data-act=del-ptpl]').addEventListener('click', () => {
      playerTemplates = playerTemplates.filter(x=>x.id!==t.id);
      savePlayerTemplates(); render();
    });
    wrap.appendChild(row);
  });
}

function renderSelects(){
  const gs = $('#gegnerSelect');
  gs.innerHTML = templates.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  const ss = $('#spielerSelect');
  const spielerOptions = playerTemplates.map(t=>`<option value="player|${t.id}">${escapeHtml(t.name)}</option>`).join('');
  const gruppenOptions = groups.filter(g=>groupMemberCount(g.id)>0)
    .map(g=>`<option value="group|${g.id}">👥 ${escapeHtml(g.name)} (${groupMemberCount(g.id)})</option>`).join('');
  if(!spielerOptions && !gruppenOptions){
    ss.innerHTML = '<option value="">(keine gespeicherten Spieler)</option>';
    ss.disabled = true;
  } else {
    ss.disabled = false;
    ss.innerHTML =
      (spielerOptions ? `<optgroup label="Spieler">${spielerOptions}</optgroup>` : '') +
      (gruppenOptions ? `<optgroup label="Gruppen">${gruppenOptions}</optgroup>` : '');
  }
}

// Zählt, wie viele Gegner-/Spieler-Vorlagen aktuell dieser Gruppe zugewiesen sind.
function groupMemberCount(groupId){
  return templates.filter(t=>t.groupId===groupId).length + playerTemplates.filter(t=>t.groupId===groupId).length;
}

function groupOptionsHtml(selectedId){
  const opts = ['<option value="">— keine Gruppe —</option>']
    .concat(groups.map(g=>`<option value="${g.id}" ${g.id===selectedId?'selected':''}>${escapeHtml(g.name)}</option>`));
  return opts.join('');
}

function renderSettings(){
  const wrap = $('#groupNameList');
  wrap.innerHTML = '';
  if(groups.length===0){
    wrap.innerHTML = '<div class="empty">Noch keine Gruppen angelegt.</div>';
  } else {
    groups.forEach(g => {
      const row = document.createElement('div');
      row.className = 'group-name-row';
      row.innerHTML = `
        <input type="text" value="${escapeHtml(g.name)}" data-id="${g.id}">
        <span class="hint">${groupMemberCount(g.id)} Vorlage(n) zugewiesen</span>
        <button class="btn small danger" data-act="del-groupname" data-id="${g.id}">Löschen</button>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        g.name = e.target.value;
        saveGroups(); render();
      });
      row.querySelector('[data-act=del-groupname]').addEventListener('click', async () => {
        const ok = await openModal(`Gruppe "${g.name}" löschen? Vorlagen, die ihr zugewiesen sind, verlieren die Zuordnung.`);
        if(!ok) return;
        groups = groups.filter(x=>x.id!==g.id);
        templates.forEach(t=>{ if(t.groupId===g.id) t.groupId=''; });
        playerTemplates.forEach(t=>{ if(t.groupId===g.id) t.groupId=''; });
        saveGroups(); saveTemplates(); savePlayerTemplates(); render();
      });
      wrap.appendChild(row);
    });
  }
}

// ---------- Actions ----------
function addFromTemplate(tpl, type, opts){
  combat.push({
    id: uid(),
    name: tpl.name,
    baseName: tpl.name,
    instanceNum: type==='npc' ? nextInstanceNum() : null,
    icon: type==='player' ? (tpl.icon || '⭐') : null,
    type: type,
    hp: tpl.hp,
    maxHp: tpl.hp,
    armor: tpl.armor,
    kritThreshold: (tpl.kritThreshold ?? 5),
    attack: tpl.attack,
    damage: tpl.damage,
    baseInit: tpl.initiative,
    currentInit: tpl.initiative,
    apMax: tpl.apMax || 0,
    ap: tpl.apMax || 0,
    manaMax: tpl.manaMax || 0,
    mana: tpl.manaMax || 0,
    dead: false,
    history: []
  });
  if(opts && opts.skipRender) return;
  saveCombat(); render();
}

$('#addGegnerBtn').addEventListener('click', () => {
  const id = $('#gegnerSelect').value;
  const tpl = templates.find(t=>t.id===id);
  if(tpl) addFromTemplate(tpl, 'npc');
});

$('#addSpielerBtn').addEventListener('click', () => {
  const val = $('#spielerSelect').value;
  if(!val) return;
  const [kind, id] = val.split('|');
  if(kind==='player'){
    const tpl = playerTemplates.find(t=>t.id===id);
    if(tpl) addFromTemplate(tpl, 'player');
  } else if(kind==='group'){
    const matching = [
      ...templates.filter(t=>t.groupId===id).map(t=>({tpl:t, type:'npc'})),
      ...playerTemplates.filter(t=>t.groupId===id).map(t=>({tpl:t, type:'player'}))
    ];
    if(matching.length===0) return;
    matching.forEach(({tpl, type}) => addFromTemplate(tpl, type, {skipRender:true}));
    saveCombat(); render();
  }
});

$('#addTplBtn').addEventListener('click', () => {
  templates.push({
    id: uid(), name:'Neue Vorlage', hp:10, initiative:10, armor:0, attack:'1W20+0', damage:'1W6+0', apMax:3, manaMax:0, kritThreshold:5, groupId:''
  });
  saveTemplates(); render();
});

$('#addPlayerTplBtn').addEventListener('click', () => {
  playerTemplates.push({
    id: uid(), name:'Neuer Spieler', hp:20, initiative:10, armor:0, attack:'1W20+0', damage:'1W6+0', apMax:3, manaMax:0, kritThreshold:5, groupId:'', icon:'⭐'
  });
  savePlayerTemplates(); render();
});

$('#addGroupNameBtn').addEventListener('click', () => {
  groups.push({ id: uid(), name: 'Neue Gruppe' });
  saveGroups(); render();
});

$('#nextTurnBtn').addEventListener('click', () => {
  // Nur die Figur an Position 1 (niedrigster INI-Wert = aktueller Zug) wird berechnet:
  // ihr Basis-INI wird auf den aktuellen Wert addiert, danach rutscht automatisch
  // die Figur mit dem nächstniedrigeren Wert auf Position 1. Alle anderen INI-Werte
  // bleiben unangetastet.
  const sorted = sortedCombat();
  const active = sorted.find(c=>!c.dead);
  if(!active) return;
  active.currentInit += active.baseInit;
  turnCount++;

  // Wer ist jetzt (nach dem Zugwechsel) neu an Position 1? Dessen AP auffüllen.
  const nextSorted = sortedCombat();
  const newActive = nextSorted.find(c=>!c.dead);
  if(newActive){
    newActive.ap = newActive.apMax || 0;
    if(!newActive.history) newActive.history = [];
    newActive.history.push(`Zug ${turnCount}: AP aufgefüllt auf ${newActive.ap}`);
  }

  saveCombat(); render();
});

$('#resetCombatBtn').addEventListener('click', async () => {
  const ok = await openModal('Kampf wirklich zurücksetzen? Alle Teilnehmer werden entfernt.');
  if(!ok) return;
  combat = [];
  turnCount = 0;
  nextNum = 1;
  expandedHistory.clear();
  saveCombat(); render();
});

// ---------- Kampf als Datei speichern / laden ----------
// Funktioniert unabhängig von der eingebauten Speicherung — auch wenn die Datei
// später auf einem anderen Gerät oder außerhalb des Chats geöffnet wird.
$('#exportCombatBtn').addEventListener('click', () => {
  const data = { combat, turnCount, nextNum, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
  a.href = url;
  a.download = `kampf-spielstand-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

$('#importCombatBtn').addEventListener('click', () => {
  $('#importCombatInput').click();
});

$('#importCombatInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!Array.isArray(data.combat)) throw new Error('Ungültiges Format');
    const ok = await openModal(`Gespeicherten Kampf laden (${data.combat.length} Teilnehmer)? Der aktuelle Kampf wird überschrieben.`);
    if(!ok) return;
    combat = data.combat || [];
    turnCount = data.turnCount || 0;
    nextNum = data.nextNum || 1;
    expandedHistory.clear();
    saveCombat(); render();
  }catch(err){
    await openModal('Diese Datei konnte nicht gelesen werden — ist es ein gültiger Kampf-Tracker-Spielstand?');
  }
});

// ---------- Vorlagen als Datei speichern / laden ----------
function downloadJson(data, filename){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
$('#exportTplBtn').addEventListener('click', () => {
  const stamp = new Date().toISOString().slice(0,10);
  downloadJson({ templates, playerTemplates, groups, exportedAt: new Date().toISOString() }, `kampf-vorlagen-${stamp}.json`);
});
$('#importTplBtn').addEventListener('click', () => $('#importTplInput').click());
$('#importTplInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if(!file) return;
  try{
    const data = JSON.parse(await file.text());
    if(!Array.isArray(data.templates) && !Array.isArray(data.playerTemplates)) throw new Error('Ungültiges Format');
    const ok = await openModal(`Vorlagen laden (${(data.templates||[]).length} Gegner, ${(data.playerTemplates||[]).length} Spieler, ${(data.groups||[]).length} Gruppen)? Die aktuellen Vorlagen werden ersetzt.`);
    if(!ok) return;
    if(Array.isArray(data.templates) && data.templates.length) templates = data.templates;
    if(Array.isArray(data.playerTemplates)) playerTemplates = data.playerTemplates;
    if(Array.isArray(data.groups)) groups = data.groups;
    saveTemplates(); savePlayerTemplates(); saveGroups(); render();
  }catch(err){
    await openModal('Diese Datei konnte nicht gelesen werden — ist es eine Vorlagen-Datei vom Kampf-Tracker?');
  }
});

// Automatischer W100-Kritwurf, direkt nach dem Schadenswurf ausgelöst.
// Ergebnis bleibt unauffällig, außer der Schwellenwert (Standard 5, editierbar
// pro Vorlage) wird unter- oder erreicht — dann dramatische Hervorhebung.
function rollKritCheck(c){
  const el = $('#res-krit-'+c.id);
  if(!el) return;
  const threshold = c.kritThreshold ?? 5;
  const roll = 1 + Math.floor(Math.random()*100);
  if(roll <= threshold){
    el.className = 'krit-result krit-hit';
    el.innerHTML = `💥 KRITISCHER TREFFER! <span class="krit-roll-note">(W100: ${roll} ≤ ${threshold})</span>`;
    if(!c.history) c.history = [];
    c.history.push(`Zug ${turnCount}: 💥 Kritischer Treffer (W100: ${roll} ≤ ${threshold})`);
    saveCombat();
  } else {
    el.className = 'krit-result';
    el.textContent = '';
  }
}

// Zieht Schaden ab (Rüstung berücksichtigt), aktualisiert Historie/Status.
// Wird sowohl von der Hauptzeile als auch vom Mini-Leiste-Popup genutzt.
// LP können ins Minus fallen (Balken bleibt dann einfach leer) — beim Erreichen
// von 0 oder weniger wird erst nachgefragt, ob der Charakter wirklich sterben soll
// (praktisch, um als GM mal ein Auge zuzudrücken und den Kampf spannend zu halten).
async function dealDamage(id, raw){
  const c = combat.find(x=>x.id===id);
  if(!c) return null;
  if(isNaN(raw) || raw<=0) return null;
  const dealt = Math.max(0, raw - c.armor);
  const newHp = c.hp - dealt;
  if(!c.history) c.history = [];

  if(newHp <= 0 && !c.dead){
    const ok = await openModal(`${c.name} fällt auf ${newHp} LP. Wirklich sterben lassen?`);
    c.hp = newHp;
    if(ok){
      c.dead = true;
      c.history.push(`Zug ${turnCount}: −${dealt} LP (${raw} Schaden, ${c.armor} Rüstung) → ${newHp} LP`);
      c.history.push(`Zug ${turnCount}: besiegt`);
    } else {
      c.history.push(`Zug ${turnCount}: −${dealt} LP (${raw} Schaden, ${c.armor} Rüstung) → ${newHp} LP (am Leben gehalten)`);
    }
  } else {
    c.hp = newHp;
    c.history.push(`Zug ${turnCount}: −${dealt} LP (${raw} Schaden, ${c.armor} Rüstung) → ${c.hp}/${c.maxHp} LP`);
  }
  saveCombat();
  return dealt;
}

async function applyDamageTo(id){
  const c = combat.find(x=>x.id===id);
  if(!c) return;
  const inp = $('#lp-input-'+id);
  const raw = parseInt(inp.value||'0',10);
  const dealt = await dealDamage(id, raw);
  if(dealt!==null){
    render();
    const resEl = document.getElementById('res-lpcalc-'+id);
    if(resEl){
      resEl.textContent = `−${dealt} LP (${raw} Schaden, ${c.armor} Rüstung)`;
      resEl.classList.remove('ok-text'); resEl.classList.add('danger-text');
    }
  }
}

function applyHealTo(id){
  const c = combat.find(x=>x.id===id);
  if(!c) return;
  const inp = $('#lp-input-'+id);
  const raw = parseInt(inp.value||'0',10);
  if(!isNaN(raw) && raw>0){
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + raw);
    const healed = c.hp - before;
    if(!c.history) c.history = [];
    const wasDead = c.dead;
    if(c.dead && c.hp>0) c.dead = false;
    c.history.push(`Zug ${turnCount}: +${healed} LP Heilung${wasDead && !c.dead ? ' (wiederbelebt)' : ''} → ${c.hp}/${c.maxHp} LP`);
    saveCombat(); render();
    const resEl = document.getElementById('res-lpcalc-'+id);
    if(resEl){
      resEl.textContent = `+${healed} LP`;
      resEl.classList.remove('danger-text'); resEl.classList.add('ok-text');
    }
  }
}

$('#combatList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if(!btn) return;
  const id = btn.dataset.id;
  const c = combat.find(x=>x.id===id);
  if(!c) return;
  const act = btn.dataset.act;

  if(act==='rollAttack'){
    const r = rollDice(c.attack);
    $('#res-attack-'+id).textContent = r===null ? '?' : r;
  } else if(act==='rollDamage'){
    const r = rollDice(c.damage);
    $('#res-damage-'+id).textContent = r===null ? '?' : r;
    rollKritCheck(c);
  } else if(act==='applyDamage'){
    applyDamageTo(id);
  } else if(act==='applyHeal'){
    applyHealTo(id);
  } else if(act==='ap-1'){ c.ap = Math.max(0,c.ap-1); saveCombat(); render(); }
  else if(act==='ap+1'){ c.ap += 1; saveCombat(); render(); }
  else if(act==='mana-1'){ c.mana = Math.max(0,c.mana-1); saveCombat(); render(); }
  else if(act==='mana+1'){ c.mana += 1; saveCombat(); render(); }
  else if(act==='remove'){
    openModal(`"${c.name}" wirklich aus dem Kampf entfernen?`).then(ok => {
      if(!ok) return;
      combat = combat.filter(x=>x.id!==id);
      saveCombat(); render();
    });
  } else if(act==='toggleHistory'){
    if(expandedHistory.has(id)) expandedHistory.delete(id);
    else expandedHistory.add(id);
    render();
  } else if(act==='toggleDisabled'){
    c.disabled = !c.disabled;
    if(!c.history) c.history = [];
    c.history.push(`Zug ${turnCount}: ${c.disabled ? 'deaktiviert (setzt aus)' : 'wieder aktiviert'}`);
    saveCombat(); render();
  } else if(act==='editIni'){
    openModal(`Neue Basis-INI für "${c.name}" (aktuell ${c.baseInit}):`, {withInput:true, defaultValue:String(c.baseInit)}).then(val => {
      if(val===null) return;
      const num = parseInt(val, 10);
      if(isNaN(num)) return;
      const before = c.baseInit;
      c.baseInit = num;
      if(!c.history) c.history = [];
      c.history.push(`Zug ${turnCount}: Basis-INI von ${before} auf ${num} geändert (wirkt sich ab dem nächsten Zug aus)`);
      saveCombat(); render();
    });
  }
});

// Enter-Taste im LP-Feld wendet standardmäßig Schaden an (häufigster Fall).
$('#combatList').addEventListener('keydown', (e) => {
  if(e.key !== 'Enter') return;
  if(e.target.id && e.target.id.startsWith('lp-input-')){
    applyDamageTo(e.target.id.replace('lp-input-',''));
  }
});

// ---------- Mini-Popup: per Klick öffnen/schließen ----------
$('#miniPopup').addEventListener('click', (e) => e.stopPropagation());
$('#miniDmgBtn').addEventListener('click', applyMiniDamage);
$('#miniDmgInput').addEventListener('keydown', (e) => { if(e.key==='Enter') applyMiniDamage(); });
document.addEventListener('click', () => { $('#miniPopup').style.display = 'none'; });

// ---------- Ansicht wechseln: Kampf <-> Einstellungen ----------
function openSettings(){
  $('#view-kampf').style.display = 'none';
  $('#view-einstellungen').style.display = '';
  $('#settingsFab').classList.add('active');
}
function closeSettings(){
  $('#view-kampf').style.display = '';
  $('#view-einstellungen').style.display = 'none';
  $('#settingsFab').classList.remove('active');
}
$('#settingsFab').addEventListener('click', () => {
  const isOpen = $('#view-einstellungen').style.display !== 'none';
  isOpen ? closeSettings() : openSettings();
});
$('#backToKampfBtn').addEventListener('click', closeSettings);

// ---------- Hinzufügen-Leiste ein-/ausklappen ----------
$('#addToggleBtn').addEventListener('click', () => {
  const wrap = $('#addControlsToolbar');
  const collapsed = wrap.style.display === 'none';
  wrap.style.display = collapsed ? '' : 'none';
  $('#addToggleIcon').textContent = collapsed ? '−' : '+';
});

// ---------- Untermenü innerhalb der Einstellungen ----------
const subButtons = $$('.subnav button');
const subViews = ['gruppen','gegner','spieler','speichern'];
function switchSubview(btn){
  subButtons.forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const sv = btn.dataset.subview;
  subViews.forEach(name => {
    $('#sub-'+name).style.display = (name===sv) ? '' : 'none';
  });
}
subButtons.forEach(btn => {
  btn.addEventListener('click', () => switchSubview(btn));
});


loadAll();
}
