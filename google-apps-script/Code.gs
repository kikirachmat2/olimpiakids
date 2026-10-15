/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI SHEET "LIVE VISUAL" -> LEADERBOARD WEB
 * Project: Olimpiakids (Trans TV)
 * =========================================================================
 *
 * CARA PASANG (cukup sekali):
 *   1. Extensions -> Apps Script -> hapus semua kode lama -> paste file ini -> Save.
 *   2. Pilih fungsi `pasangTriggerOtomatis` -> Run -> izinkan akses (Allow).
 *   3. Selesai. Setiap edit di Sheet otomatis tampil di web dalam ~1-3 detik.
 *
 * Cara kerja:
 *   - Membaca nilai yang TAMPIL di tab LIVE VISUAL (getDisplayValues), jadi format
 *     timer apa pun yang terlihat di layar ikut terbaca dengan benar.
 *   - Kolom dicari otomatis dari header "NOMOR DADA", "NAMA ANAK", "TIMER".
 *   - Seluruh data dikirim dalam SATU request ke fungsi database
 *     `sync_leaderboard_from_sheet` yang berjalan atomik (tidak ada momen
 *     leaderboard kosong / setengah di web).
 *   - Peserta dicocokkan lewat NOMOR DADA, urutan ranking = urutan baris di Sheet.
 *   - Edit beruntun tidak saling bertabrakan (LockService), dan data yang tidak
 *     berubah tidak dikirim ulang.
 */

var CONFIG = {
  SUPABASE_URL: 'https://bldyeozjctblmfxajfty.supabase.co',
  SUPABASE_KEY: 'sb_publishable_dmf0Fovjp827P-pmMRmdEg_Vg0jfBXY',
  TAB_NAMES: ['LIVE VISUAL', 'DATA KLASEMEN FIX'],
  EVENT_ID: 1,
  EVENT_NAME: 'LEADERBOARD BABY CRAWLING',
  // Cadangan jika header tidak ditemukan (1-based): header di baris 2, kolom B/C/D
  FALLBACK: { HEADER_ROW: 2, COL_BIB: 2, COL_NAME: 3, COL_TIMER: 4 },
  // Data yang sama tidak dikirim ulang selama periode ini (detik)
  DEDUP_TTL_SECONDS: 120,
};

// =========================================================================
// 1. ENTRY POINT
// =========================================================================

/** Sync manual dari menu (selalu kirim, tampilkan hasil). */
function syncLiveVisualToSupabase() {
  var result = runSync_(true);
  notify_(result.message);
  return result;
}

/** Dipanggil oleh trigger onEdit / onChange / timer. */
function autoSyncTrigger(e) {
  runSync_(false);
}

function runSync_(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return { ok: false, message: '⏳ Sync lain sedang berjalan, coba lagi sebentar.' };
  }
  try {
    SpreadsheetApp.flush(); // pastikan formula sudah terhitung
    var rows = readSheetRows_();
    if (rows === null) {
      return { ok: false, message: '❌ Tab "' + CONFIG.TAB_NAMES.join('" / "') + '" tidak ditemukan.' };
    }

    var payloadJson = JSON.stringify(rows);
    var hash = md5_(payloadJson);
    var cache = CacheService.getScriptCache();
    if (!force && cache.get('last_sync_hash') === hash) {
      return { ok: true, skipped: true, message: 'ℹ️ Tidak ada perubahan.' };
    }

    var res = callRpc_('sync_leaderboard_from_sheet', {
      p_rows: rows,
      p_event_id: CONFIG.EVENT_ID,
      p_event_name: CONFIG.EVENT_NAME,
    });

    if (!res.ok) {
      Logger.log('❌ Sync gagal: ' + res.error);
      return { ok: false, message: '❌ Sync gagal: ' + res.error };
    }

    cache.put('last_sync_hash', hash, CONFIG.DEDUP_TTL_SECONDS);
    var d = res.data || {};
    var msg = '✅ ' + (d.synced || 0) + ' peserta tersinkron' +
      ' (baru ' + (d.inserted || 0) + ', berubah ' + (d.updated || 0) + ', dihapus ' + (d.deleted || 0) + ')' +
      (d.skipped ? ' — ' + d.skipped + ' baris dilewati (kosong/nomor dada dobel)' : '');
    Logger.log(msg);
    return { ok: true, message: msg, data: d };
  } catch (err) {
    Logger.log('❌ Error: ' + err);
    return { ok: false, message: '❌ Error: ' + err };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// 2. BACA SHEET
// =========================================================================

function getTargetSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < CONFIG.TAB_NAMES.length; i++) {
    var sh = ss.getSheetByName(CONFIG.TAB_NAMES[i]);
    if (sh) return sh;
  }
  return null;
}

function readSheetRows_() {
  var sheet = getTargetSheet_();
  if (!sheet) return null;
  var values = sheet.getDataRange().getDisplayValues();
  return extractRows_(values);
}

/** Pure function (bisa dites): ubah grid nilai sheet menjadi array baris peserta. */
function extractRows_(values) {
  var layout = detectLayout_(values);
  var rows = [];
  for (var r = layout.headerRow + 1; r < values.length; r++) {
    var line = values[r] || [];
    var bib = String(line[layout.colBib] == null ? '' : line[layout.colBib]).trim();
    var name = String(line[layout.colName] == null ? '' : line[layout.colName]).replace(/\s+/g, ' ').trim();
    if (!bib || !name) continue;
    rows.push({
      bib: bib.toUpperCase(),
      name: name,
      duration_ms: parseTimerToMs(line[layout.colTimer]),
    });
  }
  return rows;
}

/** Cari baris header & index kolom (0-based) secara otomatis. */
function detectLayout_(values) {
  var maxScan = Math.min(values.length, 15);
  for (var r = 0; r < maxScan; r++) {
    var colBib = -1, colName = -1, colTimer = -1;
    var line = values[r] || [];
    for (var c = 0; c < line.length; c++) {
      var h = String(line[c] || '').toUpperCase().replace(/\s+/g, ' ').trim();
      if (colBib < 0 && /NOMOR DADA|NO\.? ?DADA|\bBIB\b/.test(h)) colBib = c;
      else if (colName < 0 && /NAMA/.test(h)) colName = c;
      else if (colTimer < 0 && /TIMER|WAKTU/.test(h)) colTimer = c;
    }
    if (colBib >= 0 && colName >= 0 && colTimer >= 0) {
      return { headerRow: r, colBib: colBib, colName: colName, colTimer: colTimer };
    }
  }
  var f = CONFIG.FALLBACK;
  return { headerRow: f.HEADER_ROW - 1, colBib: f.COL_BIB - 1, colName: f.COL_NAME - 1, colTimer: f.COL_TIMER - 1 };
}

/**
 * Konversi timer ke milidetik. Mendukung:
 *   "00.32.00" / "00:32.00" / "0:32:00"  -> MM.SS.CC (menit.detik.centidetik)
 *   "32.00" / "32,5"                      -> SS.CC
 *   "1:02:03.45"                          -> HH:MM:SS.CC
 *   "32"                                  -> detik
 * Nilai kosong / tidak valid -> null (peserta tetap tampil, timer "--.--.--").
 */
function parseTimerToMs(raw) {
  if (raw === null || raw === undefined) return null;
  var s = String(raw).trim().replace(/,/g, '.');
  if (!s) return null;
  var parts = s.split(/[.:]/);
  for (var i = 0; i < parts.length; i++) {
    if (!/^\d+$/.test(parts[i])) return null;
  }
  var frac = function (str) {
    if (str.length === 1) return parseInt(str, 10) * 100;
    if (str.length === 2) return parseInt(str, 10) * 10;
    return parseInt(str.substring(0, 3), 10);
  };
  var n = function (str) { return parseInt(str, 10); };

  if (parts.length === 4) return ((n(parts[0]) * 60 + n(parts[1])) * 60 + n(parts[2])) * 1000 + frac(parts[3]);
  if (parts.length === 3) return (n(parts[0]) * 60 + n(parts[1])) * 1000 + frac(parts[2]);
  if (parts.length === 2) return n(parts[0]) * 1000 + frac(parts[1]);
  if (parts.length === 1) return n(parts[0]) * 1000;
  return null;
}

// =========================================================================
// 3. KIRIM KE SUPABASE (1 REQUEST, DENGAN RETRY)
// =========================================================================

function callRpc_(fnName, body) {
  var url = CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + fnName;
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: CONFIG.SUPABASE_KEY,
      Authorization: 'Bearer ' + CONFIG.SUPABASE_KEY,
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  };
  var lastError = '';
  for (var attempt = 1; attempt <= 3; attempt++) {
    try {
      var res = UrlFetchApp.fetch(url, options);
      var code = res.getResponseCode();
      var text = res.getContentText();
      if (code >= 200 && code < 300) {
        return { ok: true, data: text ? JSON.parse(text) : null };
      }
      lastError = 'HTTP ' + code + ': ' + text;
      if (code < 500 && code !== 429) break; // error permanen, jangan retry
    } catch (err) {
      lastError = String(err);
    }
    Utilities.sleep(500 * attempt);
  }
  return { ok: false, error: lastError };
}

// =========================================================================
// 4. TRIGGER & MENU
// =========================================================================

/** ⚡ Jalankan SEKALI untuk mengaktifkan auto-sync. */
function pasangTriggerOtomatis() {
  hapusTriggerOtomatis_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('autoSyncTrigger').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('autoSyncTrigger').forSpreadsheet(ss).onChange().create();
  // Jaring pengaman: cek tiap 1 menit (menangkap perubahan formula/IMPORTRANGE)
  ScriptApp.newTrigger('autoSyncTrigger').timeBased().everyMinutes(1).create();
  var result = runSync_(true);
  notify_('🎉 Auto-sync aktif! ' + result.message);
}

function matikanTriggerOtomatis() {
  hapusTriggerOtomatis_();
  notify_('⏸️ Auto-sync dimatikan.');
}

function hapusTriggerOtomatis_() {
  var handlers = { autoSyncTrigger: true, onEditTrigger: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
}

function cekStatus() {
  var triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'autoSyncTrigger';
  });
  var rows = readSheetRows_();
  notify_(
    'Auto-sync: ' + (triggers.length ? 'AKTIF (' + triggers.length + ' trigger)' : 'MATI') +
    ' | Baris terbaca dari Sheet: ' + (rows ? rows.length : 'tab tidak ditemukan')
  );
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 Olimpiakids')
    .addItem('🔄 Sinkronkan Sekarang', 'syncLiveVisualToSupabase')
    .addItem('⚡ Pasang Auto-Sync Realtime', 'pasangTriggerOtomatis')
    .addItem('ℹ️ Cek Status', 'cekStatus')
    .addSeparator()
    .addItem('⏸️ Matikan Auto-Sync', 'matikanTriggerOtomatis')
    .addToUi();
}

// =========================================================================
// 5. UTIL
// =========================================================================

function md5_(str) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, str, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(digest);
}

function notify_(msg) {
  Logger.log(msg);
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Olimpiakids', 6);
  } catch (e) {
    // dijalankan dari trigger/editor tanpa UI
  }
}
