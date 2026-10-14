/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI GOOGLE SHEETS KE SUPABASE
 * Project: Lomba Bayi (Olimpiakids)
 * =========================================================================
 * 
 * Script ini berjalan di Google Sheets untuk mengirimkan perubahan data secara
 * otomatis ke Supabase database (PostgreSQL) via REST API PostgREST.
 * Karena menggunakan HTTP Request server-side, gunakan SERVICE_ROLE_KEY Supabase.
 */

// =========================================================================
// 1. KONFIGURASI SUPABASE (USER HARUS MENGISI NILAI INI)
// =========================================================================

// ISI INI: Masukkan Project URL Supabase Anda (contoh: "https://xyzcompany.supabase.co")
var SUPABASE_URL = "https://your-project-ref.supabase.co"; // ISI INI

// ISI INI: Masukkan Service Role Key dari Supabase Dashboard (Settings -> API -> service_role)
// PERINGATAN: Jangan sebarkan kunci ini kepada pihak luar karena memiliki akses admin bypass RLS.
var SUPABASE_SERVICE_KEY = "your_service_role_key_here"; // ISI INI

// Nama Tab Sheet yang digunakan
var SHEET_PESERTA = 'PESERTA';
var SHEET_RACE = 'RACE_EVENT';
var SHEET_HASIL = 'HASIL';

// =========================================================================
// 2. FUNGSI UTAMA SINKRONISASI KE SUPABASE
// =========================================================================

/**
 * Membaca data dari ketiga sheet (PESERTA, RACE_EVENT, HASIL) lalu melakukan
 * UPSERT (insert/update merge-duplicates) ke Supabase.
 */
function syncAllToSupabase() {
  if (!SUPABASE_URL || SUPABASE_URL.indexOf("your-project-ref") !== -1) {
    Logger.log("⚠️ Peringatan: SUPABASE_URL belum diatur dengan benar di Code.gs");
    return;
  }
  if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === "your_service_role_key_here") {
    Logger.log("⚠️ Peringatan: SUPABASE_SERVICE_KEY belum diatur di Code.gs");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sinkronisasi Peserta
  var pesertaSheet = ss.getSheetByName(SHEET_PESERTA);
  if (pesertaSheet) {
    syncPeserta(pesertaSheet);
  } else {
    Logger.log("Sheet '" + SHEET_PESERTA + "' tidak ditemukan. Lewati.");
  }

  // 2. Sinkronisasi Race Event
  var raceSheet = ss.getSheetByName(SHEET_RACE);
  if (raceSheet) {
    syncRaceEvents(raceSheet);
  } else {
    Logger.log("Sheet '" + SHEET_RACE + "' tidak ditemukan. Lewati.");
  }

  // 3. Sinkronisasi Hasil Lomba
  var hasilSheet = ss.getSheetByName(SHEET_HASIL);
  if (hasilSheet) {
    syncHasil(hasilSheet);
  } else {
    Logger.log("Sheet '" + SHEET_HASIL + "' tidak ditemukan. Lewati.");
  }

  // Update timestamp last sync di PropertiesService
  PropertiesService.getScriptProperties().setProperty('LAST_SYNC_AT', new Date().toISOString());
  Logger.log("✅ Sinkronisasi selesai pada " + new Date().toLocaleString());
}

/**
 * Sinkronisasi data sheet PESERTA ke tabel 'participants' di Supabase
 * Format kolom: id | name | bib_number | age_months
 */
function syncPeserta(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return; // Hanya ada header

  var payload = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var id = row[0];
    var name = row[1];
    var bib = row[2];
    var age = row[3];

    // Minimal nama dan nomor bib harus ada
    if (!name || bib === '' || bib === null || bib === undefined) continue;

    var item = {
      name: String(name).trim(),
      bib_number: String(bib).trim(),
      age_months: age !== '' && !isNaN(Number(age)) ? Number(age) : null
    };

    if (id !== '' && !isNaN(Number(id))) {
      item.id = Number(id);
    }

    payload.push(item);
  }

  if (payload.length > 0) {
    sendToSupabase('participants', payload, 'id');
  }
}

/**
 * Sinkronisasi data sheet RACE_EVENT ke tabel 'race_events' di Supabase
 * Format kolom: id | name | status | start_time
 */
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

    if (id !== '' && !isNaN(Number(id))) {
      item.id = Number(id);
    }

    payload.push(item);
  }

  if (payload.length > 0) {
    sendToSupabase('race_events', payload, 'id');
  }
}

/**
 * Sinkronisasi data sheet HASIL ke tabel 'race_results' di Supabase
 * Format kolom: id | participant_id | race_event_id | duration_ms | status
 */
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

    if (id !== '' && !isNaN(Number(id))) {
      item.id = Number(id);
    }

    payload.push(item);
  }

  if (payload.length > 0) {
    sendToSupabase('race_results', payload, 'id');
  }
}

/**
 * Mengirimkan data ke PostgREST API Supabase dengan headers upsert (merge-duplicates)
 */
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
      Logger.log("❌ Gagal sync tabel '" + table + "'. Status code: " + statusCode + " | Pesan: " + response.getContentText());
    }
  } catch (err) {
    Logger.log("❌ Error kirim request ke Supabase [" + table + "]: " + err.toString());
  }
}

/**
 * Helper untuk format tanggal dari Google Sheets ke string ISO 8601
 */
function parseDateToISO(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString();
  }
  var d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// =========================================================
// 3. TRIGGER OTOMATIS SAAT USER EDIT SHEET (onEdit)
// =========================================================

/**
 * Trigger otomatis saat cell di Google Sheets diubah.
 * Dilengkapi proteksi debounce 5 detik agar tidak membanjiri request jika user mengetik beruntun.
 */
function onEditTrigger(e) {
  if (!e || !e.range) return;

  var sheetName = e.range.getSheet().getName();
  // Hanya proses jika sheet yang diedit adalah tab yang dipantau
  if (sheetName !== SHEET_PESERTA && sheetName !== SHEET_RACE && sheetName !== SHEET_HASIL) {
    return;
  }

  // Debounce check
  var scriptProperties = PropertiesService.getScriptProperties();
  var lastSyncStr = scriptProperties.getProperty('LAST_ONEDIT_TIME');
  var now = new Date().getTime();

  if (lastSyncStr) {
    var lastSync = parseInt(lastSyncStr, 10);
    if (now - lastSync < 5000) {
      // Masih dalam periode 5 detik, tunda atau lewati untuk debounce
      Logger.log("Debounce: Melewatkan sync karena perubahan terjadi < 5 detik yang lalu.");
      return;
    }
  }

  scriptProperties.setProperty('LAST_ONEDIT_TIME', now.toString());

  // Jalankan sync
  syncAllToSupabase();
}

// =========================================================
// 4. SETUP TRIGGER PROGRAMATIK
// =========================================================

/**
 * Jalankan fungsi ini SEKALI saja dari editor Google Apps Script.
 * Fungsi ini akan menghapus trigger lama (jika ada) dan memasang trigger On Edit
 * yang terpasang secara permanen pada spreadsheet ini.
 */
function setupTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Hapus trigger onEdit sebelumnya agar tidak dobel
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === 'onEditTrigger') {
      ScriptApp.deleteTrigger(existingTriggers[i]);
    }
  }

  // Pasang trigger installable On Edit baru
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log("🎉 Trigger otomatis 'onEditTrigger' berhasil dipasang!");
}
