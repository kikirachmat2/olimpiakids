/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI DUA ARAH (TWO-WAY SYNC)
 * GOOGLE SHEETS <---> SUPABASE DATABASE
 * Project: Lomba Bayi (Olimpiakids)
 * =========================================================================
 * 
 * 1. Arah 1 (Sheets -> Supabase): onEditTrigger / syncAllToSupabase
 * 2. Arah 2 (Supabase -> Sheets): doPost(e) via Supabase Database Webhook
 */

// =========================================================================
// 1. KONFIGURASI SUPABASE & WEBHOOK
// =========================================================================

// ISI INI: Masukkan Project URL Supabase Anda (contoh: "https://xyzcompany.supabase.co")
var SUPABASE_URL = "https://your-project-ref.supabase.co"; // ISI INI

// ISI INI: Masukkan Service Role Key dari Supabase Dashboard (Settings -> API -> service_role)
var SUPABASE_SERVICE_KEY = "your_service_role_key_here"; // ISI INI

// Secret token validasi webhook (opsional, cocokkan jika Anda set header di Supabase Webhook)
var WEBHOOK_SECRET = "olimpiakids_secret_token";

// Nama Tab Sheet yang digunakan
var SHEET_PESERTA = 'PESERTA';
var SHEET_RACE = 'RACE_EVENT';
var SHEET_HASIL = 'HASIL';

// =========================================================================
// 2. FUNGSI POST WEBHOOK (SUPABASE -> GOOGLE SHEETS)
// =========================================================================

/**
 * Menerima HTTP POST request dari Supabase Database Webhook saat ada event INSERT / UPDATE
 * Body payload dari Supabase: { type, table, record, old_record, schema }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ ok: false, error: "No post data found" });
    }

    var payload = JSON.parse(e.postData.contents);
    var table = payload.table;
    var type = payload.type; // 'INSERT', 'UPDATE', 'DELETE'
    var record = payload.record;

    if (!table || !record) {
      return responseJson({ ok: false, error: "Invalid payload shape" });
    }

    // 1. Tangani event dari tabel 'race_results' (Saat Juri klik Finish di Web Admin)
    if (table === 'race_results') {
      if (type === 'INSERT') {
        appendRowToSheet(SHEET_HASIL, {
          id: record.id,
          participant_id: record.participant_id,
          race_event_id: record.race_event_id,
          duration_ms: record.duration_ms,
          status: record.status || 'finished'
        });
      } else if (type === 'UPDATE') {
        updateRowInSheet(SHEET_HASIL, record.id, {
          id: record.id,
          participant_id: record.participant_id,
          race_event_id: record.race_event_id,
          duration_ms: record.duration_ms,
          status: record.status
        });
      }
    }

    // 2. Tangani event dari tabel 'race_events' (Saat Mulai / Akhiri Lomba)
    else if (table === 'race_events') {
      if (type === 'INSERT') {
        appendRowToSheet(SHEET_RACE, {
          id: record.id,
          name: record.name,
          status: record.status,
          start_time: record.start_time
        });
      } else if (type === 'UPDATE') {
        updateRowInSheet(SHEET_RACE, record.id, {
          id: record.id,
          name: record.name,
          status: record.status,
          start_time: record.start_time
        });
      }
    }

    // 3. Tangani event dari tabel 'participants' (Jika ada pendaftaran baru di web)
    else if (table === 'participants') {
      if (type === 'INSERT') {
        appendRowToSheet(SHEET_PESERTA, {
          id: record.id,
          name: record.name,
          bib_number: record.bib_number,
          age_months: record.age_months
        });
      } else if (type === 'UPDATE') {
        updateRowInSheet(SHEET_PESERTA, record.id, {
          id: record.id,
          name: record.name,
          bib_number: record.bib_number,
          age_months: record.age_months
        });
      }
    }

    return responseJson({ ok: true, message: "Sync webhook success" });
  } catch (err) {
    return responseJson({ ok: false, error: err.toString() });
  }
}

/**
 * Helper JSON response untuk Webhook
 */
function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Menambahkan row baru atau mengupdate jika ID sudah ada
 */
function appendRowToSheet(sheetName, rowObj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
  if (headers.length === 0 || headers[0] === '') return;

  // Cek apakah ID sudah ada, jika sudah ada panggil updateRowInSheet
  if (rowObj.id) {
    var data = sheet.getDataRange().getValues();
    var idColIdx = headers.indexOf('id');
    if (idColIdx !== -1) {
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idColIdx]) === String(rowObj.id)) {
          updateRowInSheet(sheetName, rowObj.id, rowObj);
          return;
        }
      }
    }
  }

  // Susun urutan cell sesuai urutan header kolom sheet
  var newRow = [];
  for (var c = 0; c < headers.length; c++) {
    var colName = headers[c];
    newRow.push(rowObj[colName] !== undefined ? rowObj[colName] : '');
  }

  sheet.appendRow(newRow);
}

/**
 * Mengupdate baris yang cocok berdasarkan kolom 'id'
 */
function updateRowInSheet(sheetName, id, rowObj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  var headers = data[0];
  var idColIdx = headers.indexOf('id');
  if (idColIdx === -1) return;

  var targetRowIdx = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idColIdx]) === String(id)) {
      targetRowIdx = r + 1; // 1-based index untuk Sheets
      break;
    }
  }

  if (targetRowIdx !== -1) {
    for (var c = 0; c < headers.length; c++) {
      var colName = headers[c];
      if (rowObj[colName] !== undefined) {
        sheet.getRange(targetRowIdx, c + 1).setValue(rowObj[colName]);
      }
    }
  } else {
    // Jika tidak ditemukan, tambahkan sebagai row baru
    appendRowToSheet(sheetName, rowObj);
  }
}

// =========================================================
// 3. FUNGSI SINKRONISASI DARI SHEETS KE SUPABASE (UPSERT)
// =========================================================

function syncAllToSupabase() {
  if (!SUPABASE_URL || SUPABASE_URL.indexOf("your-project-ref") !== -1) {
    Logger.log("⚠️ Peringatan: SUPABASE_URL belum diatur di Code.gs");
    return;
  }
  if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === "your_service_role_key_here") {
    Logger.log("⚠️ Peringatan: SUPABASE_SERVICE_KEY belum diatur di Code.gs");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var pesertaSheet = ss.getSheetByName(SHEET_PESERTA);
  if (pesertaSheet) syncPeserta(pesertaSheet);

  var raceSheet = ss.getSheetByName(SHEET_RACE);
  if (raceSheet) syncRaceEvents(raceSheet);

  var hasilSheet = ss.getSheetByName(SHEET_HASIL);
  if (hasilSheet) syncHasil(hasilSheet);

  PropertiesService.getScriptProperties().setProperty('LAST_SYNC_AT', new Date().toISOString());
  Logger.log("✅ Sinkronisasi Sheets -> Supabase selesai.");
}

function syncPeserta(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  var payload = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var id = row[0];
    var name = row[1];
    var bib = row[2];
    var age = row[3];

    if (!name || bib === '' || bib === null || bib === undefined) continue;

    var item = {
      name: String(name).trim(),
      bib_number: String(bib).trim(),
      age_months: age !== '' && !isNaN(Number(age)) ? Number(age) : null
    };

    if (id !== '' && !isNaN(Number(id))) item.id = Number(id);
    payload.push(item);
  }

  if (payload.length > 0) sendToSupabase('participants', payload, 'id');
}

function syncRaceEvents(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  var payload = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var id = row[0];
    var name = row[1];
    var status = row[2];
    var startTime = row[3];

    if (!name) continue;

    var item = {
      name: String(name).trim(),
      status: status ? String(status).toLowerCase().trim() : 'idle',
      start_time: startTime ? parseDateToISO(startTime) : null
    };

    if (id !== '' && !isNaN(Number(id))) item.id = Number(id);
    payload.push(item);
  }

  if (payload.length > 0) sendToSupabase('race_events', payload, 'id');
}

function syncHasil(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  var payload = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var id = row[0];
    var participantId = row[1];
    var raceEventId = row[2];
    var durationMs = row[3];
    var status = row[4];

    if (!participantId || !raceEventId) continue;

    var item = {
      participant_id: Number(participantId),
      race_event_id: Number(raceEventId),
      duration_ms: durationMs !== '' && !isNaN(Number(durationMs)) ? Number(durationMs) : null,
      status: status ? String(status).toLowerCase().trim() : 'finished'
    };

    if (id !== '' && !isNaN(Number(id))) item.id = Number(id);
    payload.push(item);
  }

  if (payload.length > 0) sendToSupabase('race_results', payload, 'id');
}

function sendToSupabase(table, payload, onConflictColumn) {
  var endpoint = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + table;
  if (onConflictColumn) {
    endpoint += '?on_conflict=' + encodeURIComponent(onConflictColumn);
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Prefer': 'resolution=merge-duplicates'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(endpoint, options);
    var statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 300) {
      Logger.log("✅ Berhasil sync tabel '" + table + "' (" + payload.length + " baris)");
    } else {
      Logger.log("❌ Gagal sync tabel '" + table + "': " + response.getContentText());
    }
  } catch (err) {
    Logger.log("❌ Error kirim request: " + err.toString());
  }
}

function parseDateToISO(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  var d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// =========================================================
// 4. TRIGGER OTOMATIS SAAT USER EDIT SHEET (onEdit)
// =========================================================

function onEditTrigger(e) {
  if (!e || !e.range) return;

  var sheetName = e.range.getSheet().getName();
  if (sheetName !== SHEET_PESERTA && sheetName !== SHEET_RACE && sheetName !== SHEET_HASIL) {
    return;
  }

  var scriptProperties = PropertiesService.getScriptProperties();
  var lastSyncStr = scriptProperties.getProperty('LAST_ONEDIT_TIME');
  var now = new Date().getTime();

  if (lastSyncStr) {
    var lastSync = parseInt(lastSyncStr, 10);
    if (now - lastSync < 5000) {
      return; // Debounce 5s
    }
  }

  scriptProperties.setProperty('LAST_ONEDIT_TIME', now.toString());
  syncAllToSupabase();
}

function setupTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === 'onEditTrigger') {
      ScriptApp.deleteTrigger(existingTriggers[i]);
    }
  }

  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log("🎉 Trigger otomatis 'onEditTrigger' berhasil dipasang!");
}
