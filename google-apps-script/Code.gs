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
  EVENT_ID: 2,
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

function runSync_(force, skipLock) {
  var lock = skipLock ? null : LockService.getScriptLock();
  if (lock && !lock.tryLock(15000)) {
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
    if (lock) {
      try { lock.releaseLock(); } catch(e) {}
    }
  }
}

// =========================================================================
// 2. BACA SHEET
// =========================================================================

function getTargetSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var targets = CONFIG.TAB_NAMES.map(function (t) { return t.trim().toUpperCase(); });

  // 1. Coba cocokkan dengan nama tab (case-insensitive & trimmed)
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().trim().toUpperCase();
    if (targets.indexOf(name) !== -1) return sheets[i];
  }

  // 2. Fallback: jika hanya ada 1 sheet, gunakan sheet aktif tersebut
  if (sheets.length === 1) return sheets[0];

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

/** Cari baris header & index kolom (0-based) secara fleksibel. */
function detectLayout_(values) {
  var maxScan = Math.min(values.length, 15);
  for (var r = 0; r < maxScan; r++) {
    var colBib = -1, colName = -1, colTimer = -1;
    var line = values[r] || [];
    for (var c = 0; c < line.length; c++) {
      var h = String(line[c] || '').toUpperCase().replace(/\s+/g, ' ').trim();
      if (colBib < 0 && /NOMOR DADA|NO\.? ?DADA|\bBIB\b|NO\.? ?PESERTA/.test(h)) colBib = c;
      else if (colName < 0 && /NAMA/.test(h)) colName = c;
      else if (colTimer < 0 && /TIMER|WAKTU|TIME|HASIL|DURASI|STOPWATCH/.test(h)) colTimer = c;
    }
    if (colBib >= 0 && colName >= 0 && colTimer >= 0) {
      return { headerRow: r, colBib: colBib, colName: colName, colTimer: colTimer };
    }
  }
  var f = CONFIG.FALLBACK;
  return { headerRow: f.HEADER_ROW - 1, colBib: f.COL_BIB - 1, colName: f.COL_NAME - 1, colTimer: f.COL_TIMER - 1 };
}

/**
 * Konversi timer ke milidetik secara cerdas & tangguh. Mendukung:
 *   "00.02.50" / "00:02.50" / "00:02:50" -> MM:SS.CC (2500ms)
 *   "02.50" / "2.50" / "2,50" / "2.5"     -> SS.CC (2500ms)
 *   "00:02" / "0:02"                     -> MM:SS (2000ms)
 *   "2" / "2s"                           -> Detik (2000ms)
 * Nilai kosong / tanda strip / DNF        -> null (peserta tetap tampil, timer "--.--.--").
 */
function parseTimerToMs(raw) {
  if (raw === null || raw === undefined) return null;
  var s = String(raw).trim().replace(/,/g, '.').replace(/[sS\"']/g, '');
  if (!s || s === '--.--.--' || s === '-' || s === 'DNF' || s === '--') return null;

  var result = null;
  if (s.indexOf(':') !== -1) {
    var cParts = s.split(':');
    if (cParts.length === 2) {
      var min = parseInt(cParts[0], 10);
      var secCs = cParts[1].split('.');
      if (secCs.length === 2) {
        var sec = parseInt(secCs[0], 10);
        var csStr = secCs[1];
        var cs = csStr.length === 1 ? parseInt(csStr, 10) * 100 : csStr.length === 2 ? parseInt(csStr, 10) * 10 : parseInt(csStr.substring(0, 3), 10);
        result = (min * 60 + sec) * 1000 + cs;
      } else {
        var sec = parseInt(cParts[1], 10);
        result = (min * 60 + sec) * 1000;
      }
    } else if (cParts.length === 3) {
      var p0 = parseInt(cParts[0], 10);
      var p1 = parseInt(cParts[1], 10);
      var p2Str = cParts[2];
      var cs = p2Str.length === 1 ? parseInt(p2Str, 10) * 100 : p2Str.length === 2 ? parseInt(p2Str, 10) * 10 : parseInt(p2Str.substring(0, 3), 10);
      result = (p0 * 60 + p1) * 1000 + cs;
    }
  } else {
    var parts = s.split('.');
    if (parts.length === 3) {
      var min = parseInt(parts[0], 10);
      var sec = parseInt(parts[1], 10);
      var csStr = parts[2];
      var cs = csStr.length === 1 ? parseInt(csStr, 10) * 100 : csStr.length === 2 ? parseInt(csStr, 10) * 10 : parseInt(csStr.substring(0, 3), 10);
      result = (min * 60 + sec) * 1000 + cs;
    } else if (parts.length === 2) {
      var sec = parseInt(parts[0], 10);
      var csStr = parts[1];
      var cs = csStr.length === 1 ? parseInt(csStr, 10) * 100 : csStr.length === 2 ? parseInt(csStr, 10) * 10 : parseInt(csStr.substring(0, 3), 10);
      result = sec * 1000 + cs;
    } else if (parts.length === 1) {
      var n = parseInt(parts[0], 10);
      result = isNaN(n) ? null : n * 1000;
    }
  }

  return (result === null || isNaN(result)) ? null : result;
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

// =========================================================================
// 6. WEB APP ENDPOINT UNTUK /WASIT (MENERIMA INPUT URUTAN HASIL MATCH)
// =========================================================================

/**
 * Endpoint HTTP POST untuk menerima urutan ranking langsung dari web /wasit
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Server sibuk, coba sesaat lagi.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var contents = e && e.postData ? e.postData.contents : '';
    if (!contents) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Data POST kosong.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(contents);
    if (payload.action === 'SUBMIT_URUTAN') {
      var results = payload.results || [];
      var ss = SpreadsheetApp.getActiveSpreadsheet();

      // Target penulisan urutan: tab WASIT 1, MASTER DATABASE, dan MASTER WASIT
      var targetSheets = [
        ss.getSheetByName('WASIT 1'),
        ss.getSheetByName('MASTER DATABASE'),
        ss.getSheetByName('MASTER WASIT'),
        ss.getSheetByName('WASIT 2'),
        ss.getSheetByName('WASIT 3')
      ].filter(Boolean);

      if (targetSheets.length === 0) {
        targetSheets = [ss.getSheets()[0]];
      }

      var resultMap = {};
      var timerMap = {};
      results.forEach(function(item) {
        if (item.bib_number) {
          var val = item.position;
          if (item.status === 'dnf') val = 'DNF';
          if (item.status === 'dns') val = 'DNS';
          var cleanBib = item.bib_number.trim().toUpperCase();
          resultMap[cleanBib] = val;
          if (item.timer) {
            timerMap[cleanBib] = item.timer;
          }
        }
      });

      var totalUpdated = 0;
      targetSheets.forEach(function(sh) {
        var sheetName = sh.getName();
        var data = sh.getDataRange().getValues();
        var colBib = 1; // Default kolom B (NOMOR DADA)
        var colsToUpdate = []; // Kolom-kolom yang akan diisi nilai urutan

        // Scan baris 1-4 untuk menemukan header
        var colTimer = -1;
        for (var r = 0; r < Math.min(data.length, 4); r++) {
          for (var c = 0; c < data[r].length; c++) {
            var header = String(data[r][c]).trim().toUpperCase();
            if (header.indexOf('NOMOR') !== -1 || header.indexOf('BIB') !== -1) colBib = c;
            if (header === 'URUTAN') {
              if (colsToUpdate.indexOf(c) === -1) colsToUpdate.push(c);
            }
            if (header === 'TIMER' || header === 'WAKTU') {
              colTimer = c;
            }
            if (sheetName === 'MASTER WASIT') {
              if (header === 'WASIT 1' || header === 'WASIT 2' || header === 'WASIT 3' || header === 'VALID') {
                if (colsToUpdate.indexOf(c) === -1) colsToUpdate.push(c);
              }
            }
          }
        }

        // Fallback jika tidak terdeteksi
        if (colsToUpdate.length === 0) {
          colsToUpdate = [3]; // Default kolom D
        }

        // Tulis nilai urutan dan timer jika ada
        for (var i = 0; i < data.length; i++) {
          var bibInRow = String(data[i][colBib]).trim().toUpperCase();
          if (bibInRow && Object.prototype.hasOwnProperty.call(resultMap, bibInRow)) {
            for (var k = 0; k < colsToUpdate.length; k++) {
              sh.getRange(i + 1, colsToUpdate[k] + 1).setValue(resultMap[bibInRow]);
            }
            if (colTimer !== -1 && timerMap[bibInRow]) {
              sh.getRange(i + 1, colTimer + 1).setValue(timerMap[bibInRow]);
            }
            totalUpdated++;
          }
        }
      });

      SpreadsheetApp.flush();

      // Lepaskan lock penulisan sheet sebelum sinkronisasi agar tidak terjadi deadlock
      try { lock.releaseLock(); } catch(e) {}
      lock = null;

      // Langsung picu sinkronisasi data ke Supabase & Leaderboard TV (skipLock = true)
      var syncResult = runSync_(true, true);

      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        message: 'Berhasil mencatat ' + totalUpdated + ' urutan di Sheet (' + (syncResult.message || '') + ')',
        matchId: payload.matchId,
        matchTitle: payload.matchTitle
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.action === 'SUBMIT_TIMER') {
      var splits = payload.splits || [];
      var matchId = payload.matchId;
      var ss = SpreadsheetApp.getActiveSpreadsheet();

      // 1. Tulis ke tab TIMER (jika tab tersebut ada di Sheet)
      var timerSheet = ss.getSheetByName('TIMER');
      if (timerSheet) {
        var timerData = timerSheet.getDataRange().getValues();
        var targetCol = -1;
        for (var c = 0; c < (timerData[0] ? timerData[0].length : 0); c++) {
          var h = String(timerData[0][c] || '').toUpperCase();
          if (h.indexOf('MATCH ' + matchId) !== -1 || h.indexOf('M' + matchId) !== -1) {
            targetCol = c;
            break;
          }
        }
        if (targetCol === -1 && timerData[1]) {
          for (var c2 = 0; c2 < timerData[1].length; c2++) {
            var h2 = String(timerData[1][c2] || '').toUpperCase();
            if (h2.indexOf('MATCH ' + matchId) !== -1) {
              targetCol = c2;
              break;
            }
          }
        }

        if (targetCol !== -1) {
          var colWrite = targetCol;
          if (String(timerData[0][targetCol] || '').toUpperCase().indexOf('TIMER') === -1 &&
              targetCol + 1 < timerData[0].length &&
              String(timerData[0][targetCol + 1] || '').toUpperCase().indexOf('TIMER') !== -1) {
            colWrite = targetCol + 1;
          }
          for (var s = 0; s < splits.length; s++) {
            var rowIdx = s + 3;
            if (rowIdx <= timerSheet.getMaxRows()) {
              timerSheet.getRange(rowIdx, colWrite + 1).setValue(splits[s].timer);
            }
          }
        }
      }

      // 2. Tulis ke tab MASTER DATABASE & LIVE VISUAL berdasarkan urutan juara
      var splitMapByPosition = {};
      splits.forEach(function(sp) {
        if (sp && sp.position && sp.timer) {
          splitMapByPosition[sp.position] = sp.timer;
        }
      });

      var targetSheetsTimer = [
        ss.getSheetByName('MASTER DATABASE'),
        ss.getSheetByName('LIVE VISUAL'),
        ss.getSheetByName('DATA KLASEMEN FIX')
      ].filter(Boolean);

      var totalTimerUpdated = 0;
      targetSheetsTimer.forEach(function(sh) {
        var data = sh.getDataRange().getValues();
        var colUrutan = -1;
        var colTimer = -1;

        for (var r = 0; r < Math.min(data.length, 4); r++) {
          for (var c = 0; c < data[r].length; c++) {
            var header = String(data[r][c]).trim().toUpperCase();
            if (header === 'URUTAN' || header === 'RANKING' || header === 'POSISI') colUrutan = c;
            if (header === 'TIMER' || header === 'WAKTU' || header === 'TIME' || header === 'DURASI') colTimer = c;
          }
        }

        if (colTimer !== -1 && colUrutan !== -1) {
          for (var i = 0; i < data.length; i++) {
            var urutanVal = parseInt(data[i][colUrutan], 10);
            if (!isNaN(urutanVal) && splitMapByPosition[urutanVal]) {
              sh.getRange(i + 1, colTimer + 1).setValue(splitMapByPosition[urutanVal]);
              totalTimerUpdated++;
            }
          }
        }
      });

      SpreadsheetApp.flush();

      try { lock.releaseLock(); } catch(e) {}
      lock = null;

      var syncResultTimer = runSync_(true, true);

      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        message: 'Berhasil mencatat timer ' + splits.length + ' split (' + (syncResultTimer.message || '') + ')',
        matchId: payload.matchId,
        matchTitle: payload.matchTitle
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Aksi tidak dikenal.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('doPost Error: ' + err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch(e) {}
    }
  }
}

/** Endpoint GET untuk tes koneksi Web App */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    service: 'Olimpiakids Wasit Web App Endpoint',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
