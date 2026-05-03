const STORAGE_KEY = "ignatiev-lounge-orders-v1";
const SYNC_SETTINGS_KEY = "ignatiev-lounge-sync-settings-v1";

const state = loadState();
const filters = {
  search: "",
  supplier: "all",
  status: "all",
  strength: "all",
  view: "shelf",
};

const els = {
  viewTitle: document.querySelector("#view-title"),
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  search: document.querySelector("#search-input"),
  supplierFilter: document.querySelector("#supplier-filter"),
  statusFilter: document.querySelector("#status-filter"),
  strengthFilter: document.querySelector("#strength-filter"),
  importSupplier: document.querySelector("#import-supplier"),
  exportSupplier: document.querySelector("#export-supplier"),
  shelfBody: document.querySelector("#shelf-body"),
  orderBody: document.querySelector("#order-body"),
  pricesBody: document.querySelector("#prices-body"),
  metricItems: document.querySelector("#metric-items"),
  metricLow: document.querySelector("#metric-low"),
  metricOrder: document.querySelector("#metric-order"),
  metricAmount: document.querySelector("#metric-amount"),
  saveButton: document.querySelector("#save-button"),
  resetButton: document.querySelector("#reset-button"),
  exportStateButton: document.querySelector("#export-state-button"),
  exportOrderButton: document.querySelector("#export-order-button"),
  importButton: document.querySelector("#import-button"),
  addItemButton: document.querySelector("#add-item-button"),
  priceFile: document.querySelector("#price-file"),
  importMessage: document.querySelector("#import-message"),
  itemDialog: document.querySelector("#item-dialog"),
  itemDialogTitle: document.querySelector("#item-dialog-title"),
  modalSupplier: document.querySelector("#modal-supplier"),
  modalPriceSearch: document.querySelector("#modal-price-search"),
  modalPriceSelect: document.querySelector("#modal-price-select"),
  modalBrand: document.querySelector("#modal-brand"),
  modalStrength: document.querySelector("#modal-strength"),
  modalWeight: document.querySelector("#modal-weight"),
  modalPrice: document.querySelector("#modal-price"),
  modalName: document.querySelector("#modal-name"),
  modalStock: document.querySelector("#modal-stock"),
  modalMin: document.querySelector("#modal-min"),
  modalTarget: document.querySelector("#modal-target"),
  modalOrder: document.querySelector("#modal-order"),
  modalSave: document.querySelector("#modal-save"),
  syncUrl: document.querySelector("#sync-url"),
  syncToken: document.querySelector("#sync-token"),
  syncSaveSettings: document.querySelector("#sync-save-settings"),
  syncLoadButton: document.querySelector("#sync-load-button"),
  syncPushButton: document.querySelector("#sync-push-button"),
  syncMessage: document.querySelector("#sync-message"),
};

init();

function init() {
  loadSyncSettings();
  populateSelects();
  bindEvents();
  render();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return structuredClone(window.IGNATIEV_SEED);
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  if (!confirm("Сбросить локальные правки и вернуть стартовую базу?")) return;
  localStorage.removeItem(STORAGE_KEY);
  Object.assign(state, structuredClone(window.IGNATIEV_SEED));
  populateSelects();
  render();
}

function populateSelects() {
  const suppliers = ["all", ...state.suppliers];
  const supplierOptions = suppliers.map((supplier) => option(supplier, supplier === "all" ? "Все" : supplier)).join("");
  els.supplierFilter.innerHTML = supplierOptions;
  els.exportSupplier.innerHTML = supplierOptions;
  els.importSupplier.innerHTML = state.suppliers.map((supplier) => option(supplier, supplier)).join("");

  const strengths = ["all", ...new Set(state.items.map((item) => item.strength).filter(Boolean))];
  els.strengthFilter.innerHTML = strengths.map((strength) => option(strength, strength === "all" ? "Все" : strength)).join("");
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.search.addEventListener("input", (event) => {
    filters.search = event.target.value.trim().toLowerCase();
    render();
  });

  els.supplierFilter.addEventListener("change", (event) => {
    filters.supplier = event.target.value;
    render();
  });

  els.statusFilter.addEventListener("change", (event) => {
    filters.status = event.target.value;
    render();
  });

  els.strengthFilter.addEventListener("change", (event) => {
    filters.strength = event.target.value;
    render();
  });

  els.saveButton.addEventListener("click", () => {
    saveState();
    flash(els.saveButton, "Сохранено");
  });

  els.resetButton.addEventListener("click", resetState);
  els.exportStateButton.addEventListener("click", exportState);
  els.exportOrderButton.addEventListener("click", () => exportOrder(els.exportSupplier.value));
  els.importButton.addEventListener("click", importPriceFile);
  els.addItemButton.addEventListener("click", () => openItemDialog());
  els.modalSupplier.addEventListener("change", refreshModalPrices);
  els.modalPriceSearch.addEventListener("input", refreshModalPrices);
  els.modalPriceSelect.addEventListener("change", applySelectedPriceToModal);
  els.modalSave.addEventListener("click", saveModalItem);
  els.syncSaveSettings.addEventListener("click", saveSyncSettings);
  els.syncLoadButton.addEventListener("click", loadFromSheets);
  els.syncPushButton.addEventListener("click", pushToSheets);

  els.shelfBody.addEventListener("input", handleShelfInput);
  els.shelfBody.addEventListener("change", handleShelfInput);
  els.shelfBody.addEventListener("click", handleShelfClick);
}

function switchView(view) {
  filters.view = view;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  els.views.forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
  els.viewTitle.textContent = {
    shelf: "Полка",
    order: "Заявка",
    prices: "Прайсы",
    import: "Импорт",
    sync: "Google Sheets",
  }[view];
  render();
}

function render() {
  renderMetrics();
  if (filters.view === "shelf") renderShelf();
  if (filters.view === "order") renderOrder();
  if (filters.view === "prices") renderPrices();
}

function renderMetrics() {
  const activeItems = state.items.filter((item) => !item.archived);
  const lowItems = activeItems.filter((item) => getStatus(item).key === "low");
  const lines = getOrderLines();
  const amount = lines.reduce((sum, line) => sum + line.amount, 0);

  els.metricItems.textContent = activeItems.length;
  els.metricLow.textContent = lowItems.length;
  els.metricOrder.textContent = lines.length;
  els.metricAmount.textContent = money(amount);
}

function renderShelf() {
  const rows = filteredItems().map((item) => {
    const status = getStatus(item);
    const suggested = suggestedOrderQty(item);
    return `
      <tr>
        <td><span class="status ${status.key}">${escapeHtml(status.label)}</span></td>
        <td>${escapeHtml(item.supplier)}</td>
        <td class="name-cell">
          <span class="name-main">${escapeHtml(item.name)}</span>
          <span class="name-sub">${escapeHtml([item.brand, item.article, item.weightGrams ? `${item.weightGrams} г` : ""].filter(Boolean).join(" · "))}</span>
        </td>
        <td>${escapeHtml(item.strength || "Не указана")}</td>
        <td><input class="qty-input" type="number" min="0" data-id="${item.id}" data-field="currentStock" value="${numberValue(item.currentStock)}" /></td>
        <td><input class="qty-input" type="number" min="0" data-id="${item.id}" data-field="minStock" value="${numberValue(item.minStock)}" /></td>
        <td><input class="qty-input" type="number" min="0" data-id="${item.id}" data-field="targetStock" value="${numberValue(item.targetStock)}" /></td>
        <td>
          <div class="row-actions">
            <input class="qty-input" type="number" min="0" data-id="${item.id}" data-field="orderQty" placeholder="${suggested}" value="${numberValue(item.orderQty)}" />
            <button class="mini-button" data-action="plus-order" data-id="${item.id}" type="button">+1</button>
          </div>
        </td>
        <td class="number">${money(item.price || item.lastPrice || 0)}</td>
        <td><button class="mini-button" data-action="variants" data-id="${item.id}" type="button">Варианты</button></td>
        <td class="check-cell"><input type="checkbox" data-id="${item.id}" data-field="required" ${item.required ? "checked" : ""} /></td>
        <td class="check-cell"><input type="checkbox" data-id="${item.id}" data-field="archived" ${item.archived ? "checked" : ""} /></td>
      </tr>
    `;
  });

  els.shelfBody.innerHTML = rows.join("") || emptyRow(12, "Нет позиций по выбранным фильтрам");
}

function renderOrder() {
  const supplier = els.exportSupplier.value || "all";
  const rows = getOrderLines()
    .filter((line) => supplier === "all" || line.supplier === supplier)
    .map((line) => `
      <tr>
        <td>${escapeHtml(line.supplier)}</td>
        <td>${escapeHtml(line.article)}</td>
        <td class="name-cell">
          <span class="name-main">${escapeHtml(line.name)}</span>
          <span class="name-sub">${escapeHtml([line.brand, line.strength].filter(Boolean).join(" · "))}</span>
        </td>
        <td class="number">${line.qty}</td>
        <td class="number">${money(line.price)}</td>
        <td class="number">${money(line.amount)}</td>
      </tr>
    `);

  els.orderBody.innerHTML = rows.join("") || emptyRow(6, "Сейчас нет позиций к заказу");
}

function renderPrices() {
  const search = filters.search;
  const supplier = filters.supplier;
  const rows = state.prices
    .filter((line) => supplier === "all" || line.supplier === supplier)
    .filter((line) => !search || `${line.name} ${line.brand} ${line.article}`.toLowerCase().includes(search))
    .slice(0, 500)
    .map((line) => `
      <tr>
        <td>${escapeHtml(line.supplier)}</td>
        <td>${escapeHtml(line.article)}</td>
        <td class="name-cell">${escapeHtml(line.name)}</td>
        <td>${escapeHtml(line.brand)}</td>
        <td class="number">${money(line.priceLarge || 0)}</td>
        <td class="number">${money(line.priceSmall || 0)}</td>
        <td>${escapeHtml(line.sourceFile || "")}</td>
      </tr>
    `);

  els.pricesBody.innerHTML = rows.join("") || emptyRow(7, "Прайс не найден");
}

function filteredItems() {
  return state.items
    .filter((item) => filters.supplier === "all" || item.supplier === filters.supplier)
    .filter((item) => filters.status === "all" || getStatus(item).key === filters.status)
    .filter((item) => filters.strength === "all" || item.strength === filters.strength)
    .filter((item) => {
      if (!filters.search) return true;
      return `${item.name} ${item.brand} ${item.article} ${item.supplier}`.toLowerCase().includes(filters.search);
    });
}

function handleShelfInput(event) {
  const target = event.target;
  const id = target.dataset.id;
  const field = target.dataset.field;
  if (!id || !field) return;

  const item = state.items.find((row) => row.id === id);
  if (!item) return;

  if (target.type === "checkbox") {
    item[field] = target.checked;
  } else {
    item[field] = Math.max(0, Number(target.value || 0));
  }

  saveState();
  renderMetrics();
  if (field !== "orderQty") renderShelf();
}

function handleShelfClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const item = state.items.find((row) => row.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "plus-order") {
    item.orderQty = Number(item.orderQty || 0) + 1;
    saveState();
    render();
  }

  if (button.dataset.action === "variants") {
    openItemDialog(item);
  }
}

function openItemDialog(item = null) {
  els.itemDialog.dataset.editId = item?.id || "";
  els.itemDialogTitle.textContent = item ? "Варианты граммовки" : "Новая позиция";
  els.modalSave.textContent = item ? "Сохранить" : "Добавить";
  els.modalSupplier.innerHTML = state.suppliers.map((supplier) => option(supplier, supplier)).join("");
  els.modalSupplier.value = item?.supplier || state.suppliers[0] || "";
  els.modalPriceSearch.value = item ? [item.brand, item.name].filter(Boolean).join(" ") : "";
  els.modalBrand.value = item?.brand || "";
  els.modalStrength.value = item?.strength || "Не указана";
  els.modalWeight.innerHTML = weightOptions(item?.weightGrams);
  els.modalPrice.value = item?.price || item?.lastPrice || "";
  els.modalName.value = item?.name || "";
  els.modalStock.value = item?.currentStock || 0;
  els.modalMin.value = item?.minStock || 0;
  els.modalTarget.value = item?.targetStock || 1;
  els.modalOrder.value = item?.orderQty || 0;
  refreshModalPrices();
  els.itemDialog.showModal();
}

function refreshModalPrices() {
  const supplier = els.modalSupplier.value;
  const query = normalize(els.modalPriceSearch.value);
  const prices = state.prices
    .filter((line) => !supplier || line.supplier === supplier)
    .filter((line) => !query || normalize(`${line.name} ${line.brand} ${line.article}`).includes(query))
    .slice(0, 80);

  els.modalPriceSelect.innerHTML = [`<option value="">Не выбрано</option>`]
    .concat(prices.map((line) => {
      const price = line.priceLarge || line.priceSmall || "";
      const weight = inferWeight(line.name);
      const label = `${line.name}${weight ? ` · ${weight} г` : ""}${price ? ` · ${money(price)}` : ""}`;
      return `<option value="${escapeHtml(line.id)}">${escapeHtml(label)}</option>`;
    }))
    .join("");
}

function applySelectedPriceToModal() {
  const line = state.prices.find((price) => price.id === els.modalPriceSelect.value);
  if (!line) return;
  const weight = inferWeight(line.name);
  els.modalBrand.value = line.brand || inferBrand(line.name);
  els.modalStrength.value = inferStrength(line.name);
  els.modalWeight.innerHTML = weightOptions(weight);
  els.modalWeight.value = String(weight || "");
  els.modalPrice.value = line.priceLarge || line.priceSmall || "";
  els.modalName.value = line.name;
}

function saveModalItem(event) {
  event.preventDefault();
  const selectedPrice = state.prices.find((price) => price.id === els.modalPriceSelect.value);
  const editId = els.itemDialog.dataset.editId;
  const existing = state.items.find((item) => item.id === editId);
  const item = existing || {};
  item.id = existing?.id || `item-manual-${Date.now()}`;
  item.supplier = els.modalSupplier.value;
  item.article = selectedPrice?.article || existing?.article || "";
  item.name = els.modalName.value.trim() || selectedPrice?.name || "";
  item.brand = els.modalBrand.value.trim() || inferBrand(item.name);
  item.strength = els.modalStrength.value;
  item.weightGrams = numberOrNull(els.modalWeight.value);
  item.currentStock = Number(els.modalStock.value || 0);
  item.minStock = Number(els.modalMin.value || 0);
  item.targetStock = Number(els.modalTarget.value || 1);
  item.required = existing?.required || false;
  item.archived = existing?.archived || false;
  item.manualOrder = Number(els.modalOrder.value || 0) > 0;
  item.orderQty = Number(els.modalOrder.value || 0);
  item.price = Number(els.modalPrice.value || 0);
  item.lastPrice = item.price || existing?.lastPrice || null;
  item.lastDate = existing?.lastDate || "";
  item.orders = existing?.orders || 0;
  item.totalQty = existing?.totalQty || 0;
  item.priceSource = selectedPrice?.sourceFile || existing?.priceSource || "";

  if (!item.name) return;
  if (!existing) state.items.push(item);
  saveState();
  populateSelects();
  render();
  els.itemDialog.close();
}

function weightOptions(selectedWeight) {
  const weights = [...new Set(state.prices.map((line) => inferWeight(line.name)).filter(Boolean))].sort((a, b) => a - b);
  if (selectedWeight && !weights.includes(Number(selectedWeight))) weights.push(Number(selectedWeight));
  return [`<option value="">Не указана</option>`]
    .concat(weights.sort((a, b) => a - b).map((weight) => `<option value="${weight}" ${Number(selectedWeight) === weight ? "selected" : ""}>${weight} г</option>`))
    .join("");
}

function getStatus(item) {
  if (item.archived) return { key: "archived", label: "Вывести" };
  if (Number(item.currentStock) <= Number(item.minStock)) return { key: "low", label: "Мало" };
  if (Number(item.currentStock) > Number(item.targetStock) + 2) return { key: "overstock", label: "Избыток" };
  if (item.required) return { key: "required", label: "Матрица" };
  return { key: "normal", label: "Норма" };
}

function suggestedOrderQty(item) {
  if (item.archived) return 0;
  if (Number(item.orderQty) > 0) return Number(item.orderQty);
  if (Number(item.currentStock) <= Number(item.minStock)) {
    return Math.max(Number(item.targetStock) - Number(item.currentStock), 1);
  }
  return 0;
}

function getOrderLines() {
  return state.items
    .filter((item) => !item.archived)
    .map((item) => {
      const qty = suggestedOrderQty(item);
      const price = Number(item.price || item.lastPrice || 0);
      return { ...item, qty, price, amount: qty * price };
    })
    .filter((line) => line.qty > 0)
    .sort((a, b) => `${a.supplier} ${a.name}`.localeCompare(`${b.supplier} ${b.name}`, "ru"));
}

async function importPriceFile() {
  const file = els.priceFile.files[0];
  if (!file) {
    els.importMessage.textContent = "Выберите CSV-файл.";
    return;
  }

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) {
    els.importMessage.textContent = "Файл пустой или без строк прайса.";
    return;
  }

  const supplier = els.importSupplier.value;
  const header = rows[0].map((cell) => cell.toLowerCase());
  const indexes = {
    article: header.findIndex((cell) => cell.includes("артикул") || cell.includes("код")),
    name: header.findIndex((cell) => cell.includes("номенклатура") || cell.includes("наименование") || cell.includes("позиция") || cell.includes("товар")),
    priceLarge: header.findIndex((cell) => cell.includes("круп") || cell.includes("опт") || cell === "цена"),
    priceSmall: header.findIndex((cell) => cell.includes("мел") || cell.includes("розн")),
  };
  if (indexes.name < 0) indexes.name = 0;

  let imported = 0;
  rows.slice(1).forEach((row) => {
    const name = valueAt(row, indexes.name);
    if (!name) return;
    const article = valueAt(row, indexes.article);
    const priceLarge = numberFrom(valueAt(row, indexes.priceLarge));
    const priceSmall = numberFrom(valueAt(row, indexes.priceSmall));
    const line = {
      id: `price-import-${Date.now()}-${imported}`,
      supplier,
      article,
      name,
      brand: inferBrand(name),
      priceLarge,
      priceSmall,
      sourceFile: file.name,
      importedAt: new Date().toISOString().slice(0, 10),
    };
    upsertPrice(line);
    upsertItemFromPrice(line);
    imported += 1;
  });

  if (!state.suppliers.includes(supplier)) state.suppliers.push(supplier);
  saveState();
  populateSelects();
  render();
  els.importMessage.textContent = `Импортировано строк: ${imported}`;
}

function upsertPrice(line) {
  const index = state.prices.findIndex((existing) =>
    existing.supplier === line.supplier &&
    ((line.article && existing.article === line.article) || normalize(existing.name) === normalize(line.name))
  );
  if (index >= 0) state.prices[index] = line;
  else state.prices.push(line);
}

function upsertItemFromPrice(line) {
  const exists = state.items.some((item) =>
    item.supplier === line.supplier &&
    ((line.article && item.article === line.article) || normalize(item.name) === normalize(line.name))
  );
  if (exists) return;

  state.items.push({
    id: `item-import-${Date.now()}-${state.items.length}`,
    supplier: line.supplier,
    article: line.article,
    name: line.name,
    brand: line.brand,
    strength: inferStrength(line.name),
    weightGrams: inferWeight(line.name),
    currentStock: 0,
    minStock: 0,
    targetStock: 1,
    required: false,
    archived: false,
    manualOrder: false,
    orderQty: 0,
    price: line.priceLarge || line.priceSmall || 0,
    lastPrice: line.priceLarge || line.priceSmall || 0,
    lastDate: "",
    orders: 0,
    totalQty: 0,
    priceSource: line.sourceFile,
  });
}

function exportOrder(supplier) {
  const lines = getOrderLines().filter((line) => supplier === "all" || line.supplier === supplier);
  const rows = [["Поставщик", "Артикул", "Позиция", "Количество", "Цена", "Сумма"]].concat(
    lines.map((line) => [line.supplier, line.article, line.name, line.qty, line.price, line.amount])
  );
  downloadCSV(rows, `zayavka-${supplier === "all" ? "all" : supplier}-${dateStamp()}.csv`);
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, `ignatiev-lounge-base-${dateStamp()}.json`);
}

function loadSyncSettings() {
  const settings = JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY) || "{}");
  els.syncUrl.value = settings.url || "";
  els.syncToken.value = settings.token || "";
}

function saveSyncSettings() {
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify({
    url: els.syncUrl.value.trim(),
    token: els.syncToken.value.trim(),
  }));
  els.syncMessage.textContent = "Настройки синхронизации сохранены.";
}

function syncSettings() {
  return {
    url: els.syncUrl.value.trim(),
    token: els.syncToken.value.trim(),
  };
}

async function loadFromSheets() {
  const settings = syncSettings();
  if (!settings.url || !settings.token) {
    els.syncMessage.textContent = "Укажите URL Apps Script и токен.";
    return;
  }

  els.syncMessage.textContent = "Загружаю данные из Google Sheets...";
  try {
    const data = await jsonpRequest(settings.url, {
      action: "load",
      token: settings.token,
    });
    if (!data.ok) throw new Error(data.error || "Google Sheets returned an error");
    state.generatedAt = data.generatedAt;
    state.suppliers = data.suppliers || [];
    state.items = data.items || [];
    state.prices = data.prices || [];
    saveState();
    populateSelects();
    render();
    els.syncMessage.textContent = `Загружено: ${state.items.length} позиций, ${state.prices.length} строк прайса.`;
  } catch (error) {
    els.syncMessage.textContent = `Ошибка загрузки: ${error.message}`;
  }
}

async function pushToSheets() {
  const settings = syncSettings();
  if (!settings.url || !settings.token) {
    els.syncMessage.textContent = "Укажите URL Apps Script и токен.";
    return;
  }

  els.syncMessage.textContent = "Отправляю данные в Google Sheets...";
  try {
    await formPost(settings.url, {
      token: settings.token,
      payload: JSON.stringify({
        action: "saveAll",
        suppliers: state.suppliers,
        items: state.items,
        prices: state.prices,
      }),
    });
    els.syncMessage.textContent = "Данные отправлены. Для проверки нажмите «Загрузить из Sheets».";
  } catch (error) {
    els.syncMessage.textContent = `Ошибка отправки: ${error.message}`;
  }
}

function jsonpRequest(url, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `ignatievCallback${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const script = document.createElement("script");
    const requestUrl = new URL(url);
    Object.entries(params).forEach(([key, value]) => requestUrl.searchParams.set(key, value));
    requestUrl.searchParams.set("callback", callbackName);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Таймаут ответа Google Sheets"));
    }, 20000);

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Не удалось загрузить Apps Script"));
    };

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    script.src = requestUrl.toString();
    document.body.append(script);
  });
}

function formPost(url, fields) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.name = `sync-frame-${Date.now()}`;
    iframe.hidden = true;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = url;
    form.target = iframe.name;
    form.hidden = true;

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("textarea");
      input.name = name;
      input.value = value;
      form.append(input);
    });

    iframe.addEventListener("load", () => {
      setTimeout(() => {
        form.remove();
        iframe.remove();
        resolve();
      }, 300);
    });

    document.body.append(iframe, form);
    form.submit();
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && (char === ";" || char === "," || char === "\t")) {
      row.push(field.trim());
      field = "";
    } else if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function downloadCSV(rows, filename) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function inferBrand(name) {
  const known = ["Bonche", "Jent", "Duft", "Darkside", "BlackBurn", "Chabacco", "MustHave", "Sarma", "Sebero", "Palitra", "DEUS", "АГМ", "Хулиган", "БАЗА", "Trofimoff", "Tangiers", "Kraken", "Snobless"];
  const lower = String(name).toLowerCase();
  return known.find((brand) => lower.includes(brand.toLowerCase())) || String(name).split(/\s+/)[0] || "Без бренда";
}

function inferStrength(name) {
  const lower = String(name).toLowerCase();
  if (lower.includes("no aroma") || lower.includes("база")) return "No Aroma";
  if (lower.includes("cigar")) return "Cigar";
  if (lower.includes("black") || lower.includes("hard") || lower.includes("darkside") || lower.includes("blackburn")) return "Крепкая";
  if (lower.includes("medium") || lower.includes("classic") || lower.includes("palitra") || lower.includes("sebero")) return "Средняя";
  if (lower.includes("light") || lower.includes("легк")) return "Легкая";
  return "Не указана";
}

function inferWeight(name) {
  const match = String(name).match(/(\d{2,3})\s*(г|гр|g)/i);
  return match ? Number(match[1]) : null;
}

function normalize(value) {
  return String(value).toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function valueAt(row, index) {
  return index >= 0 ? String(row[index] || "").trim() : "";
}

function numberFrom(value) {
  const number = Number(String(value || "").replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && value !== "" ? number : null;
}

function numberValue(value) {
  return Number(value || 0);
}

function money(value) {
  return Number(value || 0).toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
}

function option(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function emptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}">${escapeHtml(text)}</td></tr>`;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function flash(button, text) {
  const old = button.textContent;
  button.textContent = text;
  setTimeout(() => {
    button.textContent = old;
  }, 900);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
