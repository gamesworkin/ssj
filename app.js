/* ============================================================================
   SISTEMA GERENCIAL DE RECICLAGEM
   ----------------------------------------------------------------------------
   1) COLE SUAS CREDENCIAIS DO FIREBASE ABAIXO (Console Firebase > Configurações
      do projeto > Seus apps > Configuração do SDK).
   2) Ative "Authentication > E-mail/senha" e crie o usuário admin@admin.com.
   3) Ative o "Realtime Database" e publique as regras do arquivo
      database.rules.json (fornecido junto com este projeto).
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDL2IqS0ESrPAbkdGlxRr6aoLuafQTEzpg",
  authDomain: "susj-a1f90.firebaseapp.com",
  projectId: "susj-a1f90",
  storageBucket: "susj-a1f90.firebasestorage.app",
  messagingSenderId: "504906646580",
  appId: "1:504906646580:web:bf260fa5dcf22737a9b661"
};

const ADMIN_EMAIL = "admin@admin.com"; // único usuário com permissão de escrita

/* ------------------------------ imports ---------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail, setPersistence, browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, push, set, update, remove, onValue, get, child,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* ------------------------------ helpers ---------------------------------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const num = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
let MOEDA = "R$";
const money = (v) => `${MOEDA} ` + num(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = (v) => num(v).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const dtLocal = (iso) => new Date(iso).toLocaleString("pt-BR");
const toInputDT = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);

function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (isError ? " error" : "");
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.className = "toast"), 3200);
}
function loader(on, text = "Carregando sistema...") {
  $("#loaderText").textContent = text;
  $("#loader").classList.toggle("open", on);
}

/* ------------------------------ estado ----------------------------------- */
const state = { produtos: {}, lancamentos: {}, ajustes: {}, ui: {}, user: null, editLanc: null, editProd: null };
const isAdmin = () => state.user && state.user.email === ADMIN_EMAIL;
function guard() {
  if (!isAdmin()) { toast(`Somente ${ADMIN_EMAIL} pode gravar dados.`, true); return false; }
  return true;
}

/* ------------------------------ tema ------------------------------------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}
function toggleTheme() {
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
}
applyTheme(localStorage.getItem("theme") || "dark");
$("#themeFabLogin").onclick = toggleTheme;
$("#themeBtn").onclick = toggleTheme;

/* ------------------------------ interface editável ----------------------- */
const UI_DEFAULT = {
  brand: "Sistema Reciclagem",
  loginTitle: "Acesso Administrativo",
  loginSubtitle: "Entre com suas credenciais",
  logo: "/logo.png",
  primary: "#22c55e",
  accent: "#38bdf8",
  radius: 12,
  font: 15,
  theme: "dark",
  moeda: "R$",
  menu: "Painel,Lançamentos,Estoque,Produtos,Relatórios,Import/Export,Interface",
};
function applyUI(ui) {
  const u = { ...UI_DEFAULT, ...(ui || {}) };
  state.ui = u;
  MOEDA = u.moeda || "R$";
  const r = document.documentElement.style;
  r.setProperty("--primary", u.primary);
  r.setProperty("--accent", u.accent);
  r.setProperty("--radius", u.radius + "px");
  r.setProperty("--fs", u.font + "px");
  $("#brandName").textContent = u.brand;
  $("#loginTitle").textContent = u.loginTitle;
  $("#loginSubtitle").textContent = u.loginSubtitle;
  if (u.logo) { $("#logoImg").src = u.logo; $("#brandLogo") && ($("#brandLogo").src = u.logo); }
  const labels = String(u.menu).split(",");
  $$(".nav-item").forEach((b, i) => { if (labels[i]) b.querySelector("span").textContent = labels[i].trim(); });
  if (!localStorage.getItem("theme")) applyTheme(u.theme);
  // preencher formulário admin
  $("#uiBrand").value = u.brand; $("#uiLoginTitle").value = u.loginTitle;
  $("#uiLoginSubtitle").value = u.loginSubtitle; $("#uiLogo").value = u.logo;
  $("#uiPrimary").value = u.primary; $("#uiAccent").value = u.accent;
  $("#uiRadius").value = u.radius; $("#uiFont").value = u.font;
  $("#uiTheme").value = u.theme; $("#uiMoeda").value = u.moeda; $("#uiMenu").value = u.menu;
}
applyUI(JSON.parse(localStorage.getItem("uiCache") || "null"));

$("#uiForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!guard()) return;
  const ui = {
    brand: $("#uiBrand").value, loginTitle: $("#uiLoginTitle").value,
    loginSubtitle: $("#uiLoginSubtitle").value, logo: $("#uiLogo").value,
    primary: $("#uiPrimary").value, accent: $("#uiAccent").value,
    radius: num($("#uiRadius").value) || 12, font: num($("#uiFont").value) || 15,
    theme: $("#uiTheme").value, moeda: $("#uiMoeda").value || "R$", menu: $("#uiMenu").value,
  };
  await set(ref(db, "config/ui"), ui);
  toast("Interface atualizada.");
});
$("#uiReset").onclick = async () => { if (!guard()) return; await set(ref(db, "config/ui"), UI_DEFAULT); toast("Interface restaurada."); };

/* ------------------------------ login ------------------------------------ */
$("#pwToggle").onclick = () => {
  const p = $("#password"); p.type = p.type === "password" ? "text" : "password";
};
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); // Enter também dispara este submit
  const msg = $("#loginMsg");
  msg.className = "msg"; msg.textContent = "";
  loader(true, "Autenticando...");
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value);
  } catch (err) {
    loader(false);
    msg.className = "msg error";
    msg.textContent = traduzErro(err.code);
  }
});
$("#forgotBtn").onclick = () => {
  $("#resetEmail").value = $("#email").value.trim();
  $("#resetModal").classList.add("open");
};
$$("[data-close]").forEach((b) => (b.onclick = () => $("#" + b.dataset.close).classList.remove("open")));
$("#resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#resetMsg"); msg.className = "msg"; msg.textContent = "Enviando...";
  try {
    await sendPasswordResetEmail(auth, $("#resetEmail").value.trim());
    msg.className = "msg ok"; msg.textContent = "Link enviado! Verifique seu e-mail.";
  } catch (err) { msg.className = "msg error"; msg.textContent = traduzErro(err.code); }
});
function traduzErro(code) {
  const m = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Tente mais tarde.",
    "auth/network-request-failed": "Falha de conexão.",
    "auth/missing-password": "Informe a senha.",
  };
  return m[code] || "Erro: " + code;
}
$("#logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  state.user = user;
  if (user) {
    $("#loginScreen").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#userBadge").textContent = user.email + (isAdmin() ? " (admin)" : " (somente leitura)");
    loader(true, "Carregando sistema...");
    startListeners();
  } else {
    $("#app").classList.add("hidden");
    $("#loginScreen").classList.remove("hidden");
    $("#password").value = "";
    loader(false);
  }
});

/* ------------------------------ relógio ---------------------------------- */
setInterval(() => { $("#clock").textContent = new Date().toLocaleString("pt-BR"); }, 1000);

/* ------------------------------ navegação -------------------------------- */
$$(".nav-item").forEach((btn) => {
  btn.onclick = () => {
    $$(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $$(".view").forEach((v) => v.classList.add("hidden"));
    $("#view-" + btn.dataset.view).classList.remove("hidden");
    closeSidebar();
  };
});
const openSidebar = () => { $("#sidebar").classList.add("open"); $("#sidebarBackdrop").classList.add("open"); };
const closeSidebar = () => { $("#sidebar").classList.remove("open"); $("#sidebarBackdrop").classList.remove("open"); };
$("#menuBtn").onclick = openSidebar;
$("#sidebarBackdrop").onclick = closeSidebar;

/* ------------------------------ listeners RTDB --------------------------- */
let loadedOnce = false;
function startListeners() {
  onValue(ref(db, "config/ui"), (s) => {
    const v = s.val();
    if (v) localStorage.setItem("uiCache", JSON.stringify(v));
    applyUI(v);
  });
  onValue(ref(db, "produtos"), (s) => { state.produtos = s.val() || {}; renderProdutos(); fillProductSelects(); renderAll(); done(); });
  onValue(ref(db, "lancamentos"), (s) => { state.lancamentos = s.val() || {}; renderAll(); done(); });
  onValue(ref(db, "ajustes"), (s) => { state.ajustes = s.val() || {}; renderAll(); done(); });
}
function done() { if (!loadedOnce) { loadedOnce = true; setTimeout(() => loader(false), 500); } }

/* ------------------------------ produtos --------------------------------- */
$("#prodForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!guard()) return;
  const p = {
    nome: $("#prodNome").value.trim(),
    categoria: $("#prodCat").value.trim(),
    precoCompra: num($("#prodCompra").value),
    precoVenda: num($("#prodVenda").value),
  };
  if (state.editProd) await update(ref(db, "produtos/" + state.editProd), p);
  else await push(ref(db, "produtos"), p);
  state.editProd = null;
  e.target.reset();
  toast("Produto salvo.");
});
$("#prodCancel").onclick = () => { state.editProd = null; $("#prodForm").reset(); };

function renderProdutos() {
  const tb = $("#tblProdutos tbody"); tb.innerHTML = "";
  const list = Object.entries(state.produtos).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  if (!list.length) { tb.innerHTML = `<tr><td colspan="6" class="empty">Nenhum produto cadastrado.</td></tr>`; return; }
  for (const [id, p] of list) {
    const margem = num(p.precoVenda) - num(p.precoCompra);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.nome}</td><td>${p.categoria || "-"}</td><td>${money(p.precoCompra)}</td>
      <td>${money(p.precoVenda)}</td><td>${money(margem)}</td>
      <td><button class="btn mini" data-e="${id}">Editar</button>
          <button class="btn mini danger" data-d="${id}">Excluir</button></td>`;
    tb.appendChild(tr);
  }
  tb.querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => {
    const p = state.produtos[b.dataset.e]; state.editProd = b.dataset.e;
    $("#prodNome").value = p.nome; $("#prodCat").value = p.categoria || "";
    $("#prodCompra").value = p.precoCompra || ""; $("#prodVenda").value = p.precoVenda || "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  tb.querySelectorAll("[data-d]").forEach((b) => (b.onclick = async () => {
    if (!guard() || !confirm("Excluir produto?")) return;
    await remove(ref(db, "produtos/" + b.dataset.d)); toast("Produto excluído.");
  }));
}
function fillProductSelects() {
  const list = Object.entries(state.produtos).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  const opts = list.map(([id, p]) => `<option value="${id}">${p.nome}</option>`).join("");
  $("#lancProduto").innerHTML = opts;
  $("#ajProduto").innerHTML = opts;
  $("#fProduto").innerHTML = `<option value="">Todos</option>` + opts;
}
const prodNome = (id) => (state.produtos[id] ? state.produtos[id].nome : "(removido)");

/* preço sugerido ao trocar produto/tipo */
function sugerirPreco() {
  const p = state.produtos[$("#lancProduto").value];
  if (!p) return;
  $("#lancPreco").value = $("#lancTipo").value === "venda" ? (p.precoVenda || "") : (p.precoCompra || "");
  calcTotal();
}
$("#lancProduto").onchange = sugerirPreco;
$("#lancTipo").onchange = sugerirPreco;
function calcTotal() { $("#lancTotal").textContent = "Total: " + money(num($("#lancPeso").value) * num($("#lancPreco").value)); }
$("#lancPeso").oninput = calcTotal;
$("#lancPreco").oninput = calcTotal;

/* ------------------------------ lançamentos ------------------------------ */
$("#lancData").value = toInputDT(new Date());
$("#lancForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!guard()) return;
  const l = {
    data: new Date($("#lancData").value).toISOString(),
    tipo: $("#lancTipo").value,
    produtoId: $("#lancProduto").value,
    produtoNome: prodNome($("#lancProduto").value),
    peso: num($("#lancPeso").value),
    preco: num($("#lancPreco").value),
    total: num($("#lancPeso").value) * num($("#lancPreco").value),
    pessoa: $("#lancPessoa").value.trim(),
    obs: $("#lancObs").value.trim(),
    criadoEm: Date.now(),
  };
  if (!l.produtoId) return toast("Cadastre um produto primeiro.", true);
  if (state.editLanc) await update(ref(db, "lancamentos/" + state.editLanc), l);
  else await push(ref(db, "lancamentos"), l);
  state.editLanc = null;
  $("#lancPeso").value = ""; $("#lancPessoa").value = ""; $("#lancObs").value = "";
  $("#lancData").value = toInputDT(new Date());
  calcTotal();
  toast("Lançamento salvo.");
});
$("#lancCancel").onclick = () => { state.editLanc = null; $("#lancForm").reset(); $("#lancData").value = toInputDT(new Date()); };

["#fDe", "#fAte", "#fProduto", "#fTipo", "#fBusca"].forEach((s) => {
  $(s).addEventListener("input", renderLancamentos);
  $(s).addEventListener("change", renderLancamentos);
});
$("#fLimpar").onclick = () => { ["#fDe", "#fAte", "#fBusca"].forEach((s) => ($(s).value = "")); $("#fProduto").value = ""; $("#fTipo").value = ""; renderLancamentos(); };

function lancArray() {
  return Object.entries(state.lancamentos)
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => new Date(b.data) - new Date(a.data));
}
function aplicaFiltros(arr) {
  const de = $("#fDe").value, ate = $("#fAte").value;
  const pid = $("#fProduto").value, tipo = $("#fTipo").value;
  const q = $("#fBusca").value.toLowerCase();
  return arr.filter((l) => {
    const d = dayKey(l.data);
    if (de && d < de) return false;
    if (ate && d > ate) return false;
    if (pid && l.produtoId !== pid) return false;
    if (tipo && l.tipo !== tipo) return false;
    if (q && !((l.pessoa || "") + " " + (l.obs || "") + " " + (l.produtoNome || "")).toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderLancamentos() {
  const rows = aplicaFiltros(lancArray());
  const tb = $("#tblLanc tbody"); tb.innerHTML = "";
  if (!rows.length) { tb.innerHTML = `<tr><td colspan="9" class="empty">Nenhum lançamento no filtro.</td></tr>`; $("#tblLanc tfoot").innerHTML = ""; return; }
  for (const l of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${dtLocal(l.data)}</td><td><span class="tag ${l.tipo}">${l.tipo}</span></td>
      <td>${l.produtoNome || prodNome(l.produtoId)}</td><td>${kg(l.peso)}</td><td>${money(l.preco)}</td>
      <td>${money(l.total)}</td><td>${l.pessoa || "-"}</td><td>${l.obs || "-"}</td>
      <td><button class="btn mini" data-e="${l.id}">Editar</button>
          <button class="btn mini danger" data-d="${l.id}">Excluir</button></td>`;
    tb.appendChild(tr);
  }
  const tPeso = rows.reduce((s, l) => s + num(l.peso), 0);
  const tC = rows.filter((l) => l.tipo === "compra").reduce((s, l) => s + num(l.total), 0);
  const tV = rows.filter((l) => l.tipo === "venda").reduce((s, l) => s + num(l.total), 0);
  $("#tblLanc tfoot").innerHTML = `<tr><td colspan="3">${rows.length} registro(s)</td><td>${kg(tPeso)}</td>
    <td>Compras</td><td>${money(tC)}</td><td>Vendas</td><td colspan="2">${money(tV)}</td></tr>`;

  tb.querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => {
    const l = state.lancamentos[b.dataset.e]; state.editLanc = b.dataset.e;
    $("#lancData").value = toInputDT(new Date(l.data)); $("#lancTipo").value = l.tipo;
    $("#lancProduto").value = l.produtoId; $("#lancPeso").value = l.peso;
    $("#lancPreco").value = l.preco; $("#lancPessoa").value = l.pessoa || ""; $("#lancObs").value = l.obs || "";
    calcTotal(); window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  tb.querySelectorAll("[data-d]").forEach((b) => (b.onclick = async () => {
    if (!guard() || !confirm("Excluir lançamento?")) return;
    await remove(ref(db, "lancamentos/" + b.dataset.d)); toast("Lançamento excluído.");
  }));
}

/* ------------------------------ estoque ---------------------------------- */
$("#ajusteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!guard()) return;
  const a = {
    data: new Date().toISOString(),
    produtoId: $("#ajProduto").value,
    produtoNome: prodNome($("#ajProduto").value),
    tipo: $("#ajTipo").value,
    peso: num($("#ajPeso").value),
    custo: num($("#ajCusto").value),
    obs: $("#ajObs").value.trim(),
  };
  if (!a.produtoId) return toast("Cadastre um produto primeiro.", true);
  await push(ref(db, "ajustes"), a);
  e.target.reset();
  toast("Ajuste registrado.");
});

function calcEstoque() {
  const map = {};
  const ini = (id) => (map[id] = map[id] || { inicial: 0, comprado: 0, vendido: 0, ajuste: 0, custoAcum: 0, kgCusto: 0 });
  for (const [, a] of Object.entries(state.ajustes)) {
    const m = ini(a.produtoId);
    if (a.tipo === "inicial") { m.inicial += num(a.peso); m.custoAcum += num(a.peso) * num(a.custo); m.kgCusto += num(a.peso); }
    else if (a.tipo === "entrada") m.ajuste += num(a.peso);
    else m.ajuste -= num(a.peso);
  }
  for (const [, l] of Object.entries(state.lancamentos)) {
    const m = ini(l.produtoId);
    if (l.tipo === "compra") { m.comprado += num(l.peso); m.custoAcum += num(l.total); m.kgCusto += num(l.peso); }
    else m.vendido += num(l.peso);
  }
  for (const id in map) {
    const m = map[id];
    m.saldo = m.inicial + m.comprado - m.vendido + m.ajuste;
    m.custoMedio = m.kgCusto ? m.custoAcum / m.kgCusto : 0;
    m.valor = m.saldo * m.custoMedio;
  }
  return map;
}
function renderEstoque() {
  const map = calcEstoque();
  const tb = $("#tblEstoque tbody"); tb.innerHTML = "";
  const ids = Object.keys(map);
  if (!ids.length) { tb.innerHTML = `<tr><td colspan="7" class="empty">Sem movimentação.</td></tr>`; }
  ids.sort((a, b) => prodNome(a).localeCompare(prodNome(b))).forEach((id) => {
    const m = map[id];
    tb.insertAdjacentHTML("beforeend", `<tr><td>${prodNome(id)}</td><td>${kg(m.inicial)}</td><td>${kg(m.comprado)}</td>
      <td>${kg(m.vendido)}</td><td>${kg(m.ajuste)}</td><td><strong>${kg(m.saldo)}</strong></td><td>${money(m.valor)}</td></tr>`);
  });

  const ta = $("#tblAjustes tbody"); ta.innerHTML = "";
  const list = Object.entries(state.ajustes).map(([id, a]) => ({ id, ...a })).sort((a, b) => new Date(b.data) - new Date(a.data));
  if (!list.length) ta.innerHTML = `<tr><td colspan="7" class="empty">Nenhum ajuste.</td></tr>`;
  list.forEach((a) => {
    ta.insertAdjacentHTML("beforeend", `<tr><td>${dtLocal(a.data)}</td><td>${a.produtoNome || prodNome(a.produtoId)}</td>
      <td>${a.tipo}</td><td>${kg(a.peso)}</td><td>${money(a.custo)}</td><td>${a.obs || "-"}</td>
      <td><button class="btn mini danger" data-da="${a.id}">Excluir</button></td></tr>`);
  });
  ta.querySelectorAll("[data-da]").forEach((b) => (b.onclick = async () => {
    if (!guard() || !confirm("Excluir ajuste?")) return;
    await remove(ref(db, "ajustes/" + b.dataset.da)); toast("Ajuste excluído.");
  }));

  const total = Object.values(map).reduce((s, m) => s + m.saldo, 0);
  const valor = Object.values(map).reduce((s, m) => s + m.valor, 0);
  $("#kpiEstoque").textContent = kg(total);
  $("#kpiEstoqueValor").textContent = money(valor);
}

/* ------------------------------ dashboard -------------------------------- */
function renderDashboard() {
  const hoje = dayKey(new Date().toISOString());
  const arr = lancArray();
  const dia = arr.filter((l) => dayKey(l.data) === hoje);
  const compras = dia.filter((l) => l.tipo === "compra");
  const vendas = dia.filter((l) => l.tipo === "venda");
  $("#kpiKgHoje").textContent = kg(compras.reduce((s, l) => s + num(l.peso), 0));
  const gasto = compras.reduce((s, l) => s + num(l.total), 0);
  const venda = vendas.reduce((s, l) => s + num(l.total), 0);
  $("#kpiGastoHoje").textContent = money(gasto);
  $("#kpiVendaHoje").textContent = money(venda);
  $("#kpiLucroHoje").textContent = money(venda - gasto);

  const tb = $("#tblUltimos tbody"); tb.innerHTML = "";
  const top = arr.slice(0, 10);
  if (!top.length) tb.innerHTML = `<tr><td colspan="6" class="empty">Sem lançamentos ainda.</td></tr>`;
  top.forEach((l) => tb.insertAdjacentHTML("beforeend",
    `<tr><td>${dtLocal(l.data)}</td><td>${l.produtoNome || prodNome(l.produtoId)}</td>
     <td><span class="tag ${l.tipo}">${l.tipo}</span></td><td>${kg(l.peso)}</td><td>${money(l.preco)}</td><td>${money(l.total)}</td></tr>`));
}

/* ------------------------------ relatórios ------------------------------- */
$("#relRef").value = new Date().toISOString().slice(0, 10);
$("#relGerar").onclick = renderRelatorio;
$("#relTipo").onchange = renderRelatorio;
$("#relPrint").onclick = () => window.print();

function periodoRel() {
  const tipo = $("#relTipo").value;
  const ref0 = $("#relRef").value || new Date().toISOString().slice(0, 10);
  if (tipo === "diario") return { de: ref0, ate: ref0, label: "Dia " + ref0 };
  if (tipo === "mensal") {
    const [y, m] = ref0.split("-");
    const last = new Date(Number(y), Number(m), 0).getDate();
    return { de: `${y}-${m}-01`, ate: `${y}-${m}-${String(last).padStart(2, "0")}`, label: `Mês ${m}/${y}` };
  }
  const y = ref0.slice(0, 4);
  return { de: `${y}-01-01`, ate: `${y}-12-31`, label: "Ano " + y };
}
function relRows() {
  const { de, ate } = periodoRel();
  const arr = lancArray().filter((l) => dayKey(l.data) >= de && dayKey(l.data) <= ate);
  const map = {};
  arr.forEach((l) => {
    const m = (map[l.produtoId] = map[l.produtoId] || { kgC: 0, rC: 0, kgV: 0, rV: 0 });
    if (l.tipo === "compra") { m.kgC += num(l.peso); m.rC += num(l.total); }
    else { m.kgV += num(l.peso); m.rV += num(l.total); }
  });
  return map;
}
function renderRelatorio() {
  const map = relRows();
  const tb = $("#tblRel tbody"); tb.innerHTML = "";
  let kgC = 0, kgV = 0, tC = 0, tV = 0;
  const ids = Object.keys(map);
  if (!ids.length) tb.innerHTML = `<tr><td colspan="6" class="empty">Sem dados no período.</td></tr>`;
  ids.sort((a, b) => prodNome(a).localeCompare(prodNome(b))).forEach((id) => {
    const m = map[id]; kgC += m.kgC; kgV += m.kgV; tC += m.rC; tV += m.rV;
    tb.insertAdjacentHTML("beforeend", `<tr><td>${prodNome(id)}</td><td>${kg(m.kgC)}</td><td>${money(m.rC)}</td>
      <td>${kg(m.kgV)}</td><td>${money(m.rV)}</td><td>${money(m.rV - m.rC)}</td></tr>`);
  });
  $("#relKgC").textContent = kg(kgC); $("#relKgV").textContent = kg(kgV);
  $("#relTotC").textContent = money(tC); $("#relTotV").textContent = money(tV);
  $("#relResult").textContent = money(tV - tC);
}
$("#relCsv").onclick = () => {
  const map = relRows();
  const lines = [["Produto", "Kg compra", "R$ compra", "Kg venda", "R$ venda", "Resultado"]];
  Object.keys(map).forEach((id) => {
    const m = map[id];
    lines.push([prodNome(id), m.kgC, m.rC.toFixed(2), m.kgV, m.rV.toFixed(2), (m.rV - m.rC).toFixed(2)]);
  });
  baixar(csv(lines), `relatorio-${periodoRel().label.replace(/[ /]/g, "_")}.csv`, "text/csv");
};

/* ------------------------------ import / export -------------------------- */
function csv(rows) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
}
function baixar(conteudo, nome, mime) {
  const blob = new Blob(["\ufeff" + conteudo], { type: mime + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  URL.revokeObjectURL(a.href);
}
function filtraPeriodoObj(obj, de, ate) {
  const out = {};
  Object.entries(obj || {}).forEach(([id, v]) => {
    const d = dayKey(v.data || new Date().toISOString());
    if ((!de || d >= de) && (!ate || d <= ate)) out[id] = v;
  });
  return out;
}
function dumpAtual() {
  const escopo = $("#expEscopo").value;
  const de = $("#expDe").value, ate = $("#expAte").value;
  if (escopo === "full") {
    return { config: { ui: state.ui }, produtos: state.produtos, lancamentos: state.lancamentos, ajustes: state.ajustes };
  }
  return {
    config: { ui: state.ui },
    produtos: state.produtos,
    lancamentos: filtraPeriodoObj(state.lancamentos, de, ate),
    ajustes: filtraPeriodoObj(state.ajustes, de, ate),
  };
}
$("#expJson").onclick = () => {
  const data = { exportadoEm: new Date().toISOString(), ...dumpAtual() };
  baixar(JSON.stringify(data, null, 2), `backup-reciclagem-${Date.now()}.json`, "application/json");
  toast("Exportação concluída.");
};
$("#expCsv").onclick = () => {
  const d = dumpAtual();
  const rows = [["Data", "Tipo", "Produto", "Peso(kg)", "Preco/kg", "Total", "Pessoa", "Obs"]];
  Object.values(d.lancamentos || {})
    .sort((a, b) => new Date(a.data) - new Date(b.data))
    .forEach((l) => rows.push([dtLocal(l.data), l.tipo, l.produtoNome || prodNome(l.produtoId),
      num(l.peso).toFixed(3), num(l.preco).toFixed(2), num(l.total).toFixed(2), l.pessoa || "", l.obs || ""]));
  baixar(csv(rows), `lancamentos-${Date.now()}.csv`, "text/csv");
};
$("#impBtn").onclick = async () => {
  const msg = $("#impMsg"); msg.className = "msg";
  if (!guard()) return;
  const f = $("#impFile").files[0];
  if (!f) { msg.className = "msg error"; msg.textContent = "Selecione um arquivo JSON."; return; }
  try {
    const data = JSON.parse(await f.text());
    const modo = $("#impModo").value;
    if (modo === "replace") {
      if (!confirm("Isso substituirá TODOS os dados atuais. Continuar?")) return;
      await set(ref(db, "/"), {
        config: data.config || { ui: state.ui },
        produtos: data.produtos || {},
        lancamentos: data.lancamentos || {},
        ajustes: data.ajustes || {},
      });
    } else {
      const upd = {};
      Object.entries(data.produtos || {}).forEach(([k, v]) => (upd["produtos/" + k] = v));
      Object.entries(data.lancamentos || {}).forEach(([k, v]) => (upd["lancamentos/" + k] = v));
      Object.entries(data.ajustes || {}).forEach(([k, v]) => (upd["ajustes/" + k] = v));
      if (data.config && data.config.ui) upd["config/ui"] = data.config.ui;
      await update(ref(db, "/"), upd);
    }
    msg.className = "msg ok"; msg.textContent = "Importação concluída com sucesso.";
    toast("Dados importados.");
  } catch (err) {
    msg.className = "msg error"; msg.textContent = "Falha na importação: " + err.message;
  }
};

/* ------------------------------ render geral ----------------------------- */
function renderAll() {
  renderDashboard();
  renderLancamentos();
  renderEstoque();
  renderRelatorio();
}
