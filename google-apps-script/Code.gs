/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI SHEET "LIVE VISUAL" KE SUPABASE
 * Project: Lomba Bayi (Olimpiakids)
 * =========================================================================
 * 
 * Script ini disesuaikan khusus dengan struktur Spreadsheet "DATA & TIMER BABYCRAWLING":
 * Tab yang dibaca: "LIVE VISUAL" (atau "DATA KLASEMEN FIX")
 * Baris 2 Header : No. | NOMOR DADA | NAMA ANAK | TIMER
 * Baris 3 dst    : Data peserta & timer
 */

// =========================================================================
// 1. KONFIGURASI SUPABASE (PASTIKAN SUDAH DIISI KREDENSIAL ASLI)
// =========================================================================

// ISI INI: Masukkan Project URL Supabase Anda (misal: "https://xyzcompany.supabase.co")
var SUPABASE_URL = "https://your-project-ref.supabase.co"; // ISI INI

// ISI INI: Masukkan Service Role Key dari Supabase Dashboard (Settings -> API -> service_role)
var SUPABASE_SERVICE_KEY = "your_service_role_key_here"; // ISI INI

// Nama Tab Sheet Utama yang ditampilkan di spreadsheet
var TAB_LIVE_VISUAL = 'LIVE VISUAL';
var TAB_FALLBACK = 'DATA KLASEMEN FIX';

// =========================================================================
// 2. FUNGSI SYNC LANGSUNG DARI TAB "LIVE VISUAL" KE SUPABASE
// =========================================================================

/**
 * Membaca data dari tab "LIVE VISUAL" dan menyimpannya langsung ke Supabase
 * agar leaderboard di web langsung ter-update secara instan.
 */
function syncLiveVisualToSupabase() {
  if (!SUPABASE_URL || SUPABASE_URL.indexOf("your-project-ref") !== -1) {
    Logger.log("⚠️ Peringatan: SUPABASE_URL belum diatur di Code.gs");
    return;
  }
  if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === "your_service_role_key_here") {
    Logger.log("⚠️ Peringatan: SUPABASE_SERVICE_KEY belum diatur di Code.gs");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TAB_LIVE_VISUAL) || ss.getSheetByName(TAB_FALLBACK);

  if (!sheet) {
    Logger.log("❌ Sheet '" + TAB_LIVE_VISUAL + "' tidak ditemukan! Cek nama tab di spreadsheet.");
    return;
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 3) {
    Logger.log("Sheet tidak memiliki data baris yang cukup.");
    return;
  }

  // 1. Pastikan Sesi Lomba Aktif (Event ID 1) tersedia di tabel race_events
  var eventPayload = [{
    id: 1,
    name: "LEADERBOARD BABY CRAWLING",
    status: "running",
    start_time: new Date().toISOString()
  }];
  sendToSupabase('race_events', eventPayload, 'id');

  // 2. Baca Baris 3 dst (karena Baris 1: Judul, Baris 2: Header No/Nomor Dada/Nama/Timer)
  var participantsPayload = [];
  var resultsPayload = [];

  for (var i = 2; i < values.length; i++) {
    var row = values[i];
    var rank = row[0];
    var bib = row[1];
    var name = row[2];
    var timerStr = row[3];

    // Lewati baris kosong
    if (!name || bib === '' || bib === null || bib === undefined) continue;

    var participantId = i - 1; // ID konsisten berdasarkan urutan baris
    var durationMs = parseTimerToMs(timerStr);

    participantsPayload.push({
      id: participantId,
      name: String(name).trim(),
      bib_number: String(bib).trim(),
      age_months: null
    });

    resultsPayload.push({
      id: participantId,
      participant_id: participantId,
      race_event_id: 1,
      duration_ms: durationMs,
      finish_time: new Date().toISOString(),
      status: 'finished'
    });
  }

  if (participantsPayload.length > 0) {
    // Upsert peserta
    sendToSupabase('participants', participantsPayload, 'id');
    // Upsert hasil klasemen
    sendToSupabase('race_results', resultsPayload, 'id');
    Logger.log("✅ Berhasil sync " + participantsPayload.length + " peserta dari tab '" + sheet.getName() + "' ke Supabase!");
  }
}

/**
 * Konversi format waktu MM.SS.CC atau MM:SS.CC (contoh "00.15.00" atau "01.20.00") ke Milidetik
 */
function parseTimerToMs(timerVal) {
  if (!timerVal) return 0;

  var str = String(timerVal).trim();
  // Pisahkan berdasarkan titik (.) atau titik dua (:)
  var parts = str.split(/[.:]/);

  if (parts.length === 3) {
    var min = parseInt(parts[0], 10) || 0;
    var sec = parseInt(parts[1], 10) || 0;
    var cs = parseInt(parts[2], 10) || 0; // centidetik (1/100 detik)
    return (min * 60 * 1000) + (sec * 1000) + (cs * 10);
  } else if (parts.length === 2) {
    var sec = parseInt(parts[0], 10) || 0;
    var cs = parseInt(parts[1], 10) || 0;
    return (sec * 1000) + (cs * 10);
  }

  var num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num * 1000);
}

/**
 * Mengirimkan data ke PostgREST API Supabase via UPSERT
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
      Logger.log("✅ Sukses sync " + table);
    } else {
      Logger.log("❌ Gagal sync " + table + " [" + statusCode + "]: " + response.getContentText());
    }
  } catch (err) {
    Logger.log("❌ Error fetch ke Supabase [" + table + "]: " + err.toString());
  }
}

// =========================================================
// 3. TRIGGER OTOMATIS SAAT CELL DIEDIT (onEdit)
// =========================================================

function onEditTrigger(e) {
  if (!e || !e.range) return;

  var sheetName = e.range.getSheet().getName();
  // Pantau tab LIVE VISUAL atau DATA KLASEMEN FIX
  if (sheetName !== TAB_LIVE_VISUAL && sheetName !== TAB_FALLBACK) {
    return;
  }

  // Debounce 3 detik
  var scriptProperties = PropertiesService.getScriptProperties();
  var lastSyncStr = scriptProperties.getProperty('LAST_ONEDIT_TIME');
  var now = new Date().getTime();

  if (lastSyncStr) {
    var lastSync = parseInt(lastSyncStr, 10);
    if (now - lastSync < 3000) {
      return;
    }
  }

  scriptProperties.setProperty('LAST_ONEDIT_TIME', now.toString());
  syncLiveVisualToSupabase();
}

/**
 * Pasang trigger otomatis onEdit
 */
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

  Logger.log("🎉 Trigger onEdit untuk tab '" + TAB_LIVE_VISUAL + "' berhasil dipasang!");
}
