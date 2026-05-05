const STORE = "ignatiev-lounge-matrix-v1";
const PHOTO = "ignatiev-lounge-shelf-photo-v1";
const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];

const els = {
  title: $("#viewTitle"),
  tabs: $$(".nav-tab"),
  views: $$(".view"),
  search: $("#globalSearch"),
  doka: $("#dokaCount"),
  nua: $("#nuaCount"),
  items: $("#metricItems"),
  order: $("#metricOrder"),
  sum: $("#metricSum"),
  brands: $("#metricBrands"),
  shelfPreview: $("#shelfPreview"),
  shelfBrand: $("#shelfBrandFilter"),
  low: $("#lowStockList"),
  shelfGrid: $("#shelfGrid"),
  catalogGrid: $("#catalogGrid"),
  catalogBrand: $("#catalogBrand"),
  catalogGrams: $("#catalogGrams"),
  orderRows: $("#orderRows"),
  orderSummary: $("#orderSummary"),
  dialog: $("#itemDialog"),
  dialogTitle: $("#dialogTitle"),
  shelfPhoto: $("#shelfPhoto"),
};

const titles = {
  dashboard: "Контроль полки",
  shelf: "Полочная матрица",
  catalog: "Каталог ароматов",
  order: "Заявка поставщику",
  settings: "Настройки",
};

let seed;
let state;
let tab = "dashboard";
let status = "all";
let editId = null;

function expand(data) {
  if (!Array.isArray(data.shelf?.[0])) return data;
  return {
    updatedAt: data.updatedAt,
    lounge: data.lounge,
    shelf: data.shelf.map((r, i) => ({
      id: `shelf-${i + 1}`,
      supplier: r[0],
      brand: r[1],
      line: r[2],
      flavor: r[3],
      grams: r[4],
      stock: r[5],
      min: r[6],
      target: r[7],
      price: r[8],
      article: r[9],
      active: r[10] !== 0,
      required: r[11] === 1,
      shelf: r[12],
      slot: r[13],
    })),
    catalog: data.catalog.map((r, i) => ({
      id: `catalog-${i + 1}`,
      supplier: r[0],
      brand: r[1],
      line: r[2],
      flavor: r[3],
      grams: r[4],
      price: r[5],
      article: r[6],
    })),
  };
}

function h(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
}

function norm(v) {
  return String(v ?? "").toLowerCase().replaceAll("ё", "е");
}

function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function qty(item) {
  return item.active ? Math.max(0, Number(item.target || 0) - Number(item.stock || 0)) : 0;
}

function itemStatus(item) {
  if (!item.active) return "inactive";
  if (Number(item.stock || 0) <= 0) return "missing";
  if (Number(item.stock || 0) <= Number(item.min || 0)) return "low";
  return "ok";
}

function color(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${hash} 45% 38%)`;
}

function orders() {
  return state.shelf
    .map((item) => ({ ...item, qty: qty(item) }))
    .filter((item) => item.qty > 0)
    .sort((a, b) => a.brand.localeCompare(b.brand, "ru") || a.flavor.localeCompare(b.flavor, "ru"));
}

function filteredShelf() {
  const q = norm(els.search.value);
  return state.shelf.filter((item) => {
    const text = norm(`${item.brand} ${item.line} ${item.flavor} ${item.article} ${item.grams}`);
    return (!q || text.includes(q)) && (status === "all" || itemStatus(item) === status);
  });
}

function filteredCatalog() {
  const q = norm(els.search.value);
  const brand = els.catalogBrand.value;
  const grams = Number(els.catalogGrams.value || 0);
  return state.catalog
    .filter((item) => !brand || item.brand === brand)
    .filter((item) => !grams || item.grams === grams)
    .filter((item) => !q || norm(`${item.brand} ${item.line} ${item.flavor} ${item.article}`).includes(q))
    .slice(0, 240);
}

function renderStats() {
  const order = orders();
  els.doka.textContent = state.shelf.filter((i) => i.supplier === "DOKA").length;
  els.nua.textContent = state.shelf.filter((i) => i.supplier === "НУА").length;
  els.items.textContent = state.shelf.filter((i) => i.active).length;
  els.order.textContent = order.length;
  els.sum.textContent = money.format(order.reduce((s, i) => s + i.qty * Number(i.price || 0), 0));
  els.brands.textContent = new Set(state.shelf.filter((i) => i.active).map((i) => i.brand)).size;
}

function renderSelects() {
  const shelfBrand = els.shelfBrand.value;
  const catalogBrand = els.catalogBrand.value;
  const catalogGrams = els.catalogGrams.value;
  const brands = [...new Set(state.shelf.map((i) => i.brand))].sort((a, b) => a.localeCompare(b, "ru"));
  const catBrands = [...new Set(state.catalog.map((i) => i.brand))].sort((a, b) => a.localeCompare(b, "ru"));
  const grams = [...new Set(state.catalog.map((i) => i.grams).filter(Boolean))].sort((a, b) => a - b);
  els.shelfBrand.innerHTML = `<option value="">Все бренды</option>${brands.map((b) => `<option>${h(b)}</option>`).join("")}`;
  els.catalogBrand.innerHTML = `<option value="">Все бренды</option>${catBrands.map((b) => `<option>${h(b)}</option>`).join("")}`;
  els.catalogGrams.innerHTML = `<option value="">Любая граммовка</option>${grams.map((g) => `<option value="${g}">${g} г</option>`).join("")}`;
  els.shelfBrand.value = brands.includes(shelfBrand) ? shelfBrand : "";
  els.catalogBrand.value = catBrands.includes(catalogBrand) ? catalogBrand : "";
  els.catalogGrams.value = grams.includes(Number(catalogGrams)) ? catalogGrams : "";
}

function renderPreview() {
  const brand = els.shelfBrand.value;
  const items = state.shelf
    .filter((i) => i.active && (!brand || i.brand === brand))
    .sort((a, b) => a.shelf - b.shelf || a.slot - b.slot)
    .slice(0, 108);
  els.shelfPreview.innerHTML = [1, 2, 3, 4, 5, 6].map((shelf) => `
    <div class="shelf-row">
      ${items.filter((i) => i.shelf === shelf).map((i) => `
        <button class="jar ${itemStatus(i)}" style="--jar-color:${color(i.brand)}" data-edit="${i.id}" type="button" title="${h(i.brand)} ${h(i.flavor)}">
          <strong>${h(i.brand)}</strong><span>${h(i.flavor)}</span><span>${i.grams} г · ${i.stock} шт</span>
        </button>`).join("")}
    </div>`).join("");
}

function renderLow() {
  const low = state.shelf.filter((i) => i.active && itemStatus(i) !== "ok").sort((a, b) => a.stock - b.stock).slice(0, 12);
  els.low.innerHTML = low.length ? low.map((i) => `
    <button class="compact-row" data-edit="${i.id}" type="button">
      <div><strong>${h(i.brand)}</strong><br><span>${h(i.flavor)} · ${i.grams} г</span></div><strong>${i.stock}/${i.target}</strong>
    </button>`).join("") : `<div class="compact-row"><strong>Критичных остатков нет</strong><span>Матрица закрыта</span></div>`;
}

function renderShelfGrid() {
  els.shelfGrid.innerHTML = filteredShelf().map((i) => `
    <article class="item-card">
      <header><div><h3>${h(i.brand)}</h3><span class="pill">${h(i.line || i.supplier)}</span></div><span class="pill">${i.grams} г</span></header>
      <strong>${h(i.flavor)}</strong>
      <div class="item-meta"><span class="pill">${h(i.supplier)}</span><span class="pill">${i.required ? "Матрица" : "Дополнительно"}</span><span class="pill">${money.format(i.price || 0)}</span></div>
      <div class="stock-controls" data-id="${i.id}">
        <label>Остаток<input data-field="stock" type="number" min="0" value="${i.stock}"></label>
        <label>Мин<input data-field="min" type="number" min="0" value="${i.min}"></label>
        <label>Цель<input data-field="target" type="number" min="0" value="${i.target}"></label>
      </div>
      <div class="card-actions"><button class="ghost-button" data-toggle="${i.id}" type="button">${i.active ? "Убрать" : "Вернуть"}</button><button class="primary-button" data-edit="${i.id}" type="button">Редактировать</button></div>
    </article>`).join("");
}

function renderCatalog() {
  els.catalogGrid.innerHTML = filteredCatalog().map((i) => `
    <article class="catalog-card">
      <header><div><h3>${h(i.brand)}</h3><span class="pill">${h(i.article || "без артикула")}</span></div><span class="pill">${i.grams || "?"} г</span></header>
      <strong>${h(i.flavor)}</strong>
      <div class="item-meta"><span class="pill">${h(i.supplier)}</span><span class="pill">${money.format(i.price || 0)}</span></div>
      <button class="primary-button" data-add-catalog="${i.id}" type="button">Добавить на полку</button>
    </article>`).join("");
}

function renderOrder() {
  const list = orders();
  els.orderSummary.textContent = `${list.length} позиций · ${money.format(list.reduce((s, i) => s + i.qty * Number(i.price || 0), 0))}`;
  els.orderRows.innerHTML = list.map((i) => `
    <tr><td>${h(i.brand)}</td><td>${h(i.flavor)}</td><td>${i.grams}</td><td>${i.stock}</td><td><strong>${i.qty}</strong></td><td>${money.format(i.price || 0)}</td><td>${money.format(i.qty * Number(i.price || 0))}</td></tr>
  `).join("");
}

function render() {
  renderStats();
  renderSelects();
  renderPreview();
  renderLow();
  renderShelfGrid();
  renderCatalog();
  renderOrder();
}

function switchTab(name) {
  tab = name;
  els.tabs.forEach((x) => x.classList.toggle("active", x.dataset.tab === tab));
  els.views.forEach((x) => x.classList.toggle("active", x.id === tab));
  els.title.textContent = titles[tab];
}

function openEditor(id) {
  const item = state.shelf.find((x) => x.id === id);
  editId = id;
  els.dialogTitle.textContent = item ? "Редактировать позицию" : "Новая позиция";
  $("#itemBrand").value = item?.brand || "";
  $("#itemLine").value = item?.line || "";
  $("#itemFlavor").value = item?.flavor || "";
  $("#itemGrams").value = item?.grams || 100;
  $("#itemStock").value = item?.stock || 0;
  $("#itemMin").value = item?.min || 1;
  $("#itemTarget").value = item?.target || 3;
  $("#itemPrice").value = item?.price || 0;
  $("#itemRequired").checked = item?.required ?? true;
  $("#removeItem").style.visibility = item ? "visible" : "hidden";
  els.dialog.showModal();
}

function saveEditor() {
  const item = {
    id: editId || `shelf-${Date.now()}`,
    supplier: "DOKA",
    brand: $("#itemBrand").value.trim(),
    line: $("#itemLine").value.trim(),
    flavor: $("#itemFlavor").value.trim(),
    grams: Number($("#itemGrams").value || 0),
    stock: Number($("#itemStock").value || 0),
    min: Number($("#itemMin").value || 0),
    target: Number($("#itemTarget").value || 0),
    price: Number($("#itemPrice").value || 0),
    article: "",
    active: true,
    required: $("#itemRequired").checked,
    shelf: Math.floor(state.shelf.length / 18) + 1,
    slot: (state.shelf.length % 18) + 1,
  };
  const index = state.shelf.findIndex((x) => x.id === item.id);
  if (index >= 0) state.shelf[index] = { ...state.shelf[index], ...item };
  else state.shelf.push(item);
  save();
  els.dialog.close();
  render();
}

function addCatalog(id) {
  const i = state.catalog.find((x) => x.id === id);
  if (!i) return;
  state.shelf.push({ id: `shelf-${Date.now()}`, supplier: i.supplier, brand: i.brand, line: i.line, flavor: i.flavor, grams: i.grams || 100, stock: 0, min: 1, target: i.grams >= 200 ? 3 : 4, price: i.price, article: i.article, active: true, required: false, shelf: Math.floor(state.shelf.length / 18) + 1, slot: (state.shelf.length % 18) + 1 });
  save();
  render();
}

function download(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const header = ["Поставщик", "Бренд", "Аромат", "Граммовка", "Остаток", "Заказать", "Цена", "Сумма", "Артикул"];
  const rows = orders().map((i) => [i.supplier, i.brand, i.flavor, i.grams, i.stock, i.qty, i.price, i.qty * Number(i.price || 0), i.article]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  download("zayavka_ignatiev_lounge.csv", csv, "text/csv;charset=utf-8");
}

function bind() {
  els.tabs.forEach((x) => x.addEventListener("click", () => switchTab(x.dataset.tab)));
  els.search.addEventListener("input", render);
  els.shelfBrand.addEventListener("change", renderPreview);
  els.catalogBrand.addEventListener("change", renderCatalog);
  els.catalogGrams.addEventListener("change", renderCatalog);
  $("#resetCatalogFilters").addEventListener("click", () => { els.catalogBrand.value = ""; els.catalogGrams.value = ""; renderCatalog(); });
  $("#addManualItem").addEventListener("click", () => openEditor(null));
  $("#saveItem").addEventListener("click", saveEditor);
  $("#exportCsv").addEventListener("click", exportCsv);
  $("#exportState").addEventListener("click", () => download("ignatiev-lounge-matrix.json", JSON.stringify(state, null, 2), "application/json;charset=utf-8"));
  $("#resetData").addEventListener("click", () => { localStorage.removeItem(STORE); state = structuredClone(seed); render(); });
  $("#removeItem").addEventListener("click", () => { state.shelf = state.shelf.filter((i) => i.id !== editId); save(); els.dialog.close(); render(); });
  $("#importState").addEventListener("change", async (e) => { const file = e.target.files?.[0]; if (!file) return; state = JSON.parse(await file.text()); save(); render(); });
  $("#shelfPhotoInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { localStorage.setItem(PHOTO, reader.result); showPhoto(reader.result); };
    reader.readAsDataURL(file);
  });
  document.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]")?.dataset.edit;
    const toggle = e.target.closest("[data-toggle]")?.dataset.toggle;
    const add = e.target.closest("[data-add-catalog]")?.dataset.addCatalog;
    const jump = e.target.closest("[data-jump]")?.dataset.jump;
    if (jump) switchTab(jump);
    if (edit) openEditor(edit);
    if (toggle) { const item = state.shelf.find((i) => i.id === toggle); if (item) item.active = !item.active; save(); render(); }
    if (add) addCatalog(add);
  });
  document.addEventListener("input", (e) => {
    const input = e.target.closest(".stock-controls input");
    if (!input) return;
    const item = state.shelf.find((i) => i.id === input.closest(".stock-controls").dataset.id);
    if (!item) return;
    item[input.dataset.field] = Number(input.value || 0);
    save();
    renderStats();
    renderPreview();
    renderLow();
    renderOrder();
  });
}

function showPhoto(src) {
  if (!src) return;
  els.shelfPhoto.src = src;
  els.shelfPhoto.style.display = "block";
}

async function init() {
  seed = expand(await fetch("./data/shelf-data.json").then((r) => r.json()));
  state = localStorage.getItem(STORE) ? JSON.parse(localStorage.getItem(STORE)) : structuredClone(seed);
  bind();
  render();
  showPhoto(localStorage.getItem(PHOTO));
}

init();
