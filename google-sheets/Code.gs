const ACCESS_TOKEN = 'CHANGE_ME_TO_A_PRIVATE_TOKEN';

const SHEETS = {
  items: 'Items',
  prices: 'Prices',
  suppliers: 'Suppliers',
  log: 'ActivityLog',
};

function doGet(e) {
  const params = e.parameter || {};
  if (!isAuthorized(params.token)) {
    return jsonp(params.callback, { ok: false, error: 'Unauthorized' });
  }

  const action = params.action || 'load';
  if (action === 'load') {
    return jsonp(params.callback, {
      ok: true,
      generatedAt: new Date().toISOString(),
      suppliers: readSuppliers_(),
      items: readObjects_(SHEETS.items),
      prices: readObjects_(SHEETS.prices),
    });
  }

  return jsonp(params.callback, { ok: false, error: 'Unknown action' });
}

function doPost(e) {
  const params = e.parameter || {};
  if (!isAuthorized(params.token)) {
    return ContentService.createTextOutput('Unauthorized');
  }

  const payload = JSON.parse(params.payload || '{}');
  if (payload.action === 'saveAll') {
    writeObjects_(SHEETS.items, payload.items || []);
    writeObjects_(SHEETS.prices, payload.prices || []);
    writeSuppliers_(payload.suppliers || []);
    appendLog_('site', 'saveAll', `items=${(payload.items || []).length}; prices=${(payload.prices || []).length}`);
    return ContentService.createTextOutput('OK');
  }

  return ContentService.createTextOutput('Unknown action');
}

function isAuthorized(token) {
  return ACCESS_TOKEN && ACCESS_TOKEN !== 'CHANGE_ME_TO_A_PRIVATE_TOKEN' && token === ACCESS_TOKEN;
}

function jsonp(callback, payload) {
  const safeCallback = /^[A-Za-z_$][\w$]*$/.test(callback || '') ? callback : 'callback';
  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function readSuppliers_() {
  const rows = readObjects_(SHEETS.suppliers);
  return rows.map((row) => row.name).filter(Boolean);
}

function writeSuppliers_(suppliers) {
  writeObjects_(SHEETS.suppliers, suppliers.map((name) => ({ name, active: true })));
}

function readObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  return values.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = normalizeCell_(row[index]);
    });
    return object;
  });
}

function writeObjects_(sheetName, objects) {
  const sheet = getSheet_(sheetName);
  const existing = sheet.getDataRange().getValues();
  const existingHeaders = existing.length ? existing[0].map(String) : [];
  const objectHeaders = Array.from(objects.reduce((set, object) => {
    Object.keys(object).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  const headers = existingHeaders.length ? existingHeaders : objectHeaders;
  const values = [headers].concat(objects.map((object) => headers.map((header) => object[header] ?? '')));

  sheet.clearContents();
  if (values.length && headers.length) {
    sheet.getRange(1, 1, values.length, headers.length).setValues(values);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0F766E').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
}

function appendLog_(actor, action, details) {
  const sheet = getSheet_(SHEETS.log);
  sheet.appendRow([new Date().toISOString(), actor, action, details]);
}

function getSheet_(name) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet not found: ${name}`);
  return sheet;
}

function normalizeCell_(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === 'TRUE') return true;
  if (value === 'FALSE') return false;
  return value;
}
