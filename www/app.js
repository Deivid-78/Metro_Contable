"use strict";
/* ===== Utilidades ===== */
const $ = id => document.getElementById(id);
const esc = v => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => new Intl.NumberFormat("es-CO", {style:"currency", currency:"COP", maximumFractionDigits:0}).format(n || 0);
const TZ = "America/Bogota";
const sv = o => new Intl.DateTimeFormat("sv-SE", {timeZone: TZ, ...o});
const dayKey = d => sv({dateStyle:"short"}).format(new Date(d));
const nowLocal = () => sv({dateStyle:"short", timeStyle:"short"}).format(new Date()).replace(" ", "T");
const toISO = local => new Date(local + ":00-05:00").toISOString();       // Colombia = UTC-5 fijo
const fmtDate = d => sv({dateStyle:"short", timeStyle:"short"}).format(new Date(d));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
const groupSum = (rows, key) => rows.reduce((m, r) => (m[key(r)] = (m[key(r)] || 0) + r.amount, m), {});
const toast = t => { const e = $("toast"); e.textContent = t; e.style.display = "block"; setTimeout(() => e.style.display = "none", 2800); };
const COLORS = ["#0b5cab", "#138a62", "#c47b18", "#7a52a8"];

/* ===== Catálogos (F018: tipo y medio separados; la recarga es anticipo, no ingreso) ===== */
const TYPES = {"Pago de pasaje":true, "Venta en taquilla":true, "Transacción electrónica":true, "Recarga":false};
const PAYS = ["Efectivo", "Tarjeta bancaria", "QR", "Saldo de tarjeta"];
const PORTALS = {
  suba:     {name:"Portal Suba",     pre:"SUB", user:"suba",     salt:"metro-suba",     hash:"a385e07f64adb92d91103d081b06e9ba8cc7f215243c056973737babb10e2246", st:["Portal Suba","Av. Suba","Rionegro","Calle 127"]},
  norte:    {name:"Portal Norte",    pre:"NOR", user:"norte",    salt:"metro-norte",    hash:"abe89204888f056064d6d7ff3ffff45caac8f4b5630292e3a1a77ba5ff7154ef", st:["Portal Norte","Toberín","Calle 170","Calle 142"]},
  americas: {name:"Portal Américas", pre:"AME", user:"americas", salt:"metro-americas", hash:"4034c4f442513e1a7a9588362fc7927ca0dec9e5320a7c2090c3289e3b657772", st:["Portal Américas","Bosa","Kennedy","Av. Boyacá"]},
};

/* ===== Persistencia con manejo de errores (F005, F014) ===== */
const KEY = "metro_contable_v2";
let DB;
function demo() {
  const db = {tx:[], log:[], seq:{suba:0, norte:0, americas:0}};
  Object.entries(PORTALS).forEach(([p, P], k) => { for (let i = 0; i < 40; i++) {
    const t = Object.keys(TYPES)[(i + k) % 4], d = new Date(Date.now() - (i % 12) * 864e5 - (i % 9) * 36e5);
    db.tx.push({id:uid(), portal:p, date:d.toISOString(), station:P.st[i % 4], type:t, pay:PAYS[(i * 3 + k) % (t === "Recarga" ? 3 : 4)],
      amount:3000 + ((i * 137) % 35) * 500, ref:P.pre + "-" + String(++db.seq[p]).padStart(4, "0"), note:"Demo", status:"activa"}); } });
  return db;
}
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.tx) && Array.isArray(d.log) && d.seq) return d; } catch (e) { setTimeout(() => toast("Datos dañados: se restauró la demostración"), 500); }
  return demo();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast("No se pudo guardar (almacenamiento lleno)"); }
}
const audit = (action, detail) => { DB.log.unshift({at:new Date().toISOString(), portal:S.p, user:PORTALS[S.p].user, action, detail}); DB.log.length = Math.min(DB.log.length, 500); };

/* ===== Autenticación por portal (F009) ===== */
let S = null, tries = 0, lockUntil = 0, idle;
async function hashPw(pw, salt) {
  if (!(window.crypto && crypto.subtle)) throw new Error("Contexto no seguro");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const b = await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", salt:new TextEncoder().encode(salt), iterations:100000}, k, 256);
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
let chosen = "suba";
function drawPortals() {
  $("portals").innerHTML = Object.entries(PORTALS).map(([k, P]) => `<button type="button" role="radio" aria-checked="${k === chosen}" class="${k === chosen ? "on" : ""}" data-p="${k}">${esc(P.name)}</button>`).join("");
}
$("portals").onclick = e => { const b = e.target.closest("[data-p]"); if (b) { chosen = b.dataset.p; drawPortals(); } };
$("lf").onsubmit = async e => {
  e.preventDefault();
  if (Date.now() < lockUntil) return $("le").textContent = "Demasiados intentos. Espere un minuto.";
  const P = PORTALS[chosen];
  try {
    const ok = $("lu").value.trim().toLowerCase() === P.user && await hashPw($("lp").value, P.salt) === P.hash;
    if (!ok) { if (++tries >= 5) { lockUntil = Date.now() + 6e4; tries = 0; } return $("le").textContent = "Usuario o contraseña incorrectos para " + P.name; }
  } catch (err) { return $("le").textContent = "Este navegador no permite validar credenciales (use https o la app)."; }
  tries = 0; S = {p:chosen}; sessionStorage.setItem("mc_s", chosen); $("lp").value = ""; $("le").textContent = "";
  audit("Inicio de sesión", P.name); save(); start();
};
function logout() { if (S) { audit("Cierre de sesión", PORTALS[S.p].name); save(); } S = null; sessionStorage.removeItem("mc_s"); $("app").hidden = true; $("login").hidden = false; }
function resetIdle() { clearTimeout(idle); if (S) idle = setTimeout(() => { logout(); toast("Sesión cerrada por inactividad"); }, 9e5); }
["click", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, resetIdle));
$("out").onclick = logout;

/* ===== Datos del portal activo ===== */
const mine = () => DB.tx.filter(t => t.portal === S.p);
const active = rows => rows.filter(t => t.status === "activa");
const income = rows => active(rows).filter(t => TYPES[t.type]);

/* ===== Validación en JavaScript (F006, F010) ===== */
function validate(f) {
  const e = {}, P = PORTALS[S.p], amt = Number(f.amount);
  if (!f.date || isNaN(new Date(toISO(f.date)))) e.date = "Fecha inválida";
  else if (new Date(toISO(f.date)) > Date.now() + 3e5) e.date = "No se permiten fechas futuras";
  if (!P.st.includes(f.station)) e.station = "Estación no pertenece a su portal";
  if (!(f.type in TYPES)) e.type = "Tipo inválido";
  if (!PAYS.includes(f.pay)) e.pay = "Medio inválido";
  else if (f.type === "Recarga" && f.pay === "Saldo de tarjeta") e.pay = "Una recarga no puede pagarse con saldo";
  if (!Number.isInteger(amt) || amt < 1 || amt > 5e6) e.amount = "Valor entero entre 1 y 5.000.000";
  if (f.ref && DB.tx.some(t => t.ref.toLowerCase() === f.ref.toLowerCase())) e.ref = "La referencia ya existe";
  if (f.note.length > 200) e.note = "Máximo 200 caracteres";
  return e;
}

/* ===== Diálogos accesibles (F016) ===== */
const dlg = $("dlg");
dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
function ask(title, fields, onOk, okLabel = "Aceptar") {
  dlg.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3>${fields}<div class="f" style="margin-top:12px"><button class="btn" value="x" formnovalidate>Cancelar</button><button class="btn p" value="ok">${okLabel}</button></div></form>`;
  dlg.querySelector("form").onsubmit = ev => {
    if (ev.submitter.value !== "ok") return;
    if (onOk(Object.fromEntries(new FormData(ev.target))) === false) ev.preventDefault();
  };
  dlg.showModal();
}
const fld = (n, l, inner) => `<label>${l}${inner}<small class="err" id="e_${n}"></small></label>`;
function txForm() {
  const P = PORTALS[S.p], opts = a => a.map(x => `<option>${esc(x)}</option>`).join("");
  ask("Registrar recaudo", `<div class="f">${fld("date", "Fecha y hora (Bogotá)", `<input name="date" type="datetime-local" value="${nowLocal()}" required>`)}${fld("station", "Estación", `<select name="station">${opts(P.st)}</select>`)}</div>
  <div class="f">${fld("type", "Tipo", `<select name="type">${opts(Object.keys(TYPES))}</select>`)}${fld("pay", "Medio de pago", `<select name="pay">${opts(PAYS)}</select>`)}</div>
  <div class="f">${fld("amount", "Valor (COP)", `<input name="amount" type="number" min="1" step="1" required>`)}${fld("ref", "Referencia (opcional, se genera sola)", `<input name="ref" maxlength="20">`)}</div>${fld("note", "Observación", `<textarea name="note" rows="2" maxlength="200"></textarea>`)}`, f => {
    f.ref = (f.ref || "").trim(); f.note = f.note || "";
    const er = validate(f);
    dlg.querySelectorAll(".err").forEach(x => x.textContent = "");
    if (Object.keys(er).length) { Object.entries(er).forEach(([k, m]) => $("e_" + k).textContent = m); return false; }
    DB.tx.push({id:uid(), portal:S.p, date:toISO(f.date), station:f.station, type:f.type, pay:f.pay, amount:Number(f.amount),
      ref:f.ref || P.pre + "-" + String(++DB.seq[S.p]).padStart(4, "0"), note:f.note, status:"activa"});
    audit("Registro", DB.tx.at(-1).ref); save(); toast("Operación guardada"); route();
  }, "Guardar operación");
}

/* ===== Vistas ===== */
const bars = (obj, colored) => { const a = Object.entries(obj).sort((x, y) => y[1] - x[1]), mx = a[0]?.[1] || 1;
  return a.length ? a.map(([k, v], i) => `<div class="bar"><span>${esc(k)}</span><div><i style="width:${v / mx * 100}%;background:${COLORS[colored ? i % 4 : 0]}"></i></div><b>${money(v)}</b></div>`).join("") : "<p>Sin datos.</p>"; };
function dash() {
  const r = income(mine()), tot = r.reduce((a, t) => a + t.amount, 0), rec = active(mine()).filter(t => !TYPES[t.type]).reduce((a, t) => a + t.amount, 0);
  const days = groupSum(r, t => dayKey(t.date)), last = Object.fromEntries(Object.entries(days).sort().slice(-10));
  return `<div class="kpis">${[["Ingresos reconocidos", money(tot)], ["Operaciones de ingreso", r.length], ["Ticket promedio", money(r.length ? tot / r.length : 0)], ["Recargas (anticipos, no ingreso)", money(rec)]].map(k => `<div class="card"><span>${k[0]}</span><b>${k[1]}</b></div>`).join("")}</div>
  <div class="card"><h3>Ingresos por día (últimos 10)</h3>${bars(last)}</div><div class="card"><h3>Por medio de pago</h3>${bars(groupSum(r, t => t.pay), true)}</div><div class="card"><h3>Ranking de estaciones</h3>${bars(groupSum(r, t => t.station))}</div>`;
}
let page = 0, FL = {q:"", st:"", ps:""};
const filtered = () => mine().filter(t => (!FL.q || (t.ref + t.station + t.type).toLowerCase().includes(FL.q.toLowerCase())) && (!FL.st || t.station === FL.st) && (!FL.ps || t.status === FL.ps)).sort((a, b) => b.date.localeCompare(a.date));
function txView() {
  const d = filtered(), n = Math.max(1, Math.ceil(d.length / 20)); page = Math.min(page, n - 1);
  return `<div class="card"><div class="f"><input id="fq" aria-label="Buscar" placeholder="Buscar referencia, estación o tipo" value="${esc(FL.q)}"><select id="fs" aria-label="Estación"><option value="">Todas las estaciones</option>${PORTALS[S.p].st.map(s => `<option ${FL.st === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
  <select id="fp" aria-label="Estado"><option value="">Todos los estados</option><option ${FL.ps === "activa" ? "selected" : ""} value="activa">Activas</option><option ${FL.ps === "anulada" ? "selected" : ""} value="anulada">Anuladas</option></select><button class="btn" id="expF">⬇ Exportar vista</button></div>
  <div class="wrap"><table><thead><tr><th>Fecha</th><th>Ref.</th><th>Estación</th><th>Tipo</th><th>Medio</th><th>Valor</th><th></th></tr></thead><tbody>${d.slice(page * 20, page * 20 + 20).map(t => `<tr class="${t.status === "anulada" ? "x" : ""}"><td>${fmtDate(t.date)}</td><td>${esc(t.ref)}</td><td>${esc(t.station)}</td><td>${esc(t.type)}</td><td>${esc(t.pay)}</td><td>${money(t.amount)}</td><td>${t.status === "activa" ? `<button class="btn r" data-void="${esc(t.id)}">Anular</button>` : "Anulada"}</td></tr>`).join("") || `<tr><td colspan="7">Sin resultados.</td></tr>`}</tbody></table></div>
  <div class="f" style="margin-top:10px"><button class="btn" data-pg="-1" ${page < 1 ? "disabled" : ""}>←</button><span>Página ${page + 1} de ${n} · ${d.length} registros</span><button class="btn" data-pg="1" ${page >= n - 1 ? "disabled" : ""}>→</button></div></div>`;
}
function reports() {
  const r = income(mine()), tot = r.reduce((a, t) => a + t.amount, 0), tbl = o => { const a = Object.entries(o).sort((x, y) => y[1] - x[1]);
    return `<table><tr><th>Categoría</th><th>Ingresos</th><th>%</th></tr>${a.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${money(v)}</td><td>${tot ? (v / tot * 100).toFixed(1) : 0}%</td></tr>`).join("")}</table>`; };
  return `<div class="card"><div class="f"><button class="btn" onclick="print()">🖨 Imprimir</button></div><h3>Total ingresos: ${money(tot)} (${r.length} operaciones)</h3><h4>Por tipo</h4>${tbl(groupSum(r, t => t.type))}<h4>Por medio de pago</h4>${tbl(groupSum(r, t => t.pay))}<h4>Por estación</h4>${tbl(groupSum(r, t => t.station))}</div>`;
}
const logView = () => `<div class="card wrap"><table><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr>${DB.log.filter(l => l.portal === S.p).slice(0, 100).map(l => `<tr><td>${fmtDate(l.at)}</td><td>${esc(l.user)}</td><td>${esc(l.action)}</td><td>${esc(l.detail)}</td></tr>`).join("")}</table></div>`;
const settings = () => `<div class="card"><h3>Copia de seguridad</h3><p>Los datos viven en este dispositivo. Descargue copias periódicas.</p><div class="f"><button class="btn" id="bk">⬇ Descargar copia (JSON)</button><label class="btn">⬆ Restaurar copia<input id="rs" type="file" accept=".json" hidden></label><button class="btn r" id="rd">Restablecer demostración</button></div></div>`;

/* ===== Exportación CSV segura (F007, F017) ===== */
const safe = v => { v = String(v ?? ""); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function exportCSV(rows, name) {
  const h = ["Fecha", "Referencia", "Estación", "Tipo", "Medio", "Valor COP", "Estado", "Observación"];
  download(name, "\ufeff" + [h, ...rows.map(t => [fmtDate(t.date), t.ref, t.station, t.type, t.pay, t.amount, t.status, t.note])].map(r => r.map(safe).join(",")).join("\n"), "text/csv;charset=utf-8");
}

/* ===== Navegación por hash (F016) y eventos delegados (F008) ===== */
const ROUTES = {dashboard:["Dashboard", dash], transactions:["Transacciones", txView], reports:["Reportes", reports], log:["Bitácora", logView], settings:["Configuración", settings]};
function route() {
  if (!S) return; const k = ROUTES[location.hash.slice(1)] ? location.hash.slice(1) : "dashboard";
  $("title").textContent = ROUTES[k][0]; $("view").innerHTML = ROUTES[k][1]();
  $("nav").innerHTML = Object.entries(ROUTES).map(([r, v]) => `<a href="#${r}" class="${r === k ? "on" : ""}">${v[0]}</a>`).join("");
}
$("view").addEventListener("click", e => {
  const v = e.target.closest("[data-void]"), g = e.target.closest("[data-pg]");
  if (g) { page += Number(g.dataset.pg); route(); }
  if (v) ask("Anular operación", fld("why", "Motivo (mín. 5 caracteres)", `<input name="why" required minlength="5">`), f => {
    if ((f.why || "").trim().length < 5) { $("e_why").textContent = "Indique un motivo"; return false; }
    const t = DB.tx.find(x => x.id === v.dataset.void && x.portal === S.p); if (!t) return;
    t.status = "anulada"; t.reason = f.why.trim(); audit("Anulación", t.ref + ": " + t.reason); save(); toast("Operación anulada"); route();
  }, "Anular");
  if (e.target.id === "expF") exportCSV(filtered(), "recaudos_vista.csv");
  if (e.target.id === "bk") download("copia_metro_contable.json", JSON.stringify(DB), "application/json");
  if (e.target.id === "rd") ask("Restablecer", "<p>Se borrarán TODOS los datos y se cargará la demostración.</p>", () => { DB = demo(); save(); toast("Datos restablecidos"); route(); }, "Restablecer");
});
$("view").addEventListener("input", e => {
  if (!["fq", "fs", "fp"].includes(e.target.id)) return;
  clearTimeout(window.dbn); window.dbn = setTimeout(() => { FL = {q:$("fq").value, st:$("fs").value, ps:$("fp").value}; page = 0; route(); $("fq").focus(); }, 250);
});
$("view").addEventListener("change", e => {
  if (e.target.id !== "rs" || !e.target.files[0]) return;
  e.target.files[0].text().then(t => { try { const d = JSON.parse(t); if (!Array.isArray(d.tx) || !Array.isArray(d.log) || !d.seq) throw 0; DB = d; save(); toast("Copia restaurada"); route(); } catch (x) { toast("Archivo de copia inválido"); } });
});
$("new").onclick = txForm; $("expAll").onclick = () => exportCSV(mine().sort((a, b) => b.date.localeCompare(a.date)), "recaudos_" + S.p + ".csv");
window.addEventListener("hashchange", route);
function start() { $("login").hidden = true; $("app").hidden = false; $("who").textContent = PORTALS[S.p].name; resetIdle(); route(); }
DB = load(); drawPortals();
if (PORTALS[sessionStorage.getItem("mc_s")]) { S = {p:sessionStorage.getItem("mc_s")}; start(); }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
