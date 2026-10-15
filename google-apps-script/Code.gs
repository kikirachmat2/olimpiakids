/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI SHEET "LIVE VISUAL" KE SUPABASE
 * Project: Lomba Bayi (Olimpiakids)
 * =========================================================================
 */

var SUPABASE_URL = "https://bldyeozjctblmfxajfty.supabase.co";
var SUPABASE_KEY = "sb_publishable_dmf0Fovjp827P-pmMRmdEg_Vg0jfBXY";
var TAB_NAME = "LIVE VISUAL";

function syncLiveVisualToSupabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TAB_NAME) || ss.getSheetByName("DATA KLASEMEN FIX");
  if (!sheet) {
    Logger.log("❌ Sheet " + TAB_NAME + " tidak ditemukan!");
    return;
  }

  var values = sheet.getDataRange().getValues();

  // 1. Pastikan Sesi Lomba Aktif (id: 1)
  postSupabase('race_events', [{
    id: 1,
    name: "LEADERBOARD BABY CRAWLING",
    status: "running",
    start_time: new Date().toISOString()
  }], 'id');

  // 2. Baca Peserta yang sudah terdaftar di database
  var existingParticipants = getSupabase('participants?select=id,bib_number,name');
  var pMap = {};
  if (Array.isArray(existingParticipants)) {
    existingParticipants.forEach(function(p) {
      if (p.bib_number) pMap[p.bib_number.trim().toUpperCase()] = p;
    });
  }

  // 3. Baca baris 3 dst dari spreadsheet
  var activeBibs = [];
  var resultsPayload = [];

  for (var i = 2; i < values.length; i++) {
    var row = values[i];
    var bib = row[1];
    var name = row[2];
    var timerStr = row[3];

    if (!name || bib === '' || bib === null || bib === undefined) continue;

    var bibClean = String(bib).trim();
    var nameClean = String(name).trim();
    var bibKey = bibClean.toUpperCase();
    var durationMs = parseTimerToMs(timerStr);

    var participantId = null;

    if (pMap[bibKey]) {
      // Update nama jika berubah
      participantId = pMap[bibKey].id;
      if (pMap[bibKey].name !== nameClean) {
        patchSupabase('participants?id=eq.' + participantId, { name: nameClean });
      }
    } else {
      // Insert participant baru
      var inserted = postSupabase('participants', [{
        name: nameClean,
        bib_number: bibClean
      }], null, true);

      if (inserted && inserted.length > 0) {
        participantId = inserted[0].id;
        pMap[bibKey] = { id: participantId, name: nameClean, bib_number: bibClean };
      }
    }

    if (participantId) {
      resultsPayload.push({
        participant_id: participantId,
        race_event_id: 1,
        duration_ms: durationMs,
        finish_time: new Date().toISOString(),
        status: 'finished'
      });
    }
  }

  // 4. Bersihkan hasil lama babak ini, lalu masukkan hasil terbaru sesuai spreadsheet
  deleteSupabase('race_results?race_event_id=eq.1');

  if (resultsPayload.length > 0) {
    postSupabase('race_results', resultsPayload);
    Logger.log("✅ Sukses sync " + resultsPayload.length + " peserta ke leaderboard!");
  } else {
    Logger.log("ℹ️ Data di sheet kosong, leaderboard di-reset.");
  }
}

function parseTimerToMs(timerVal) {
  if (!timerVal) return 0;
  var str = String(timerVal).trim();
  var parts = str.split(/[.:]/);

  if (parts.length === 3) {
    var min = parseInt(parts[0], 10) || 0;
    var sec = parseInt(parts[1], 10) || 0;
    var cs = parseInt(parts[2], 10) || 0;
    return (min * 60 * 1000) + (sec * 1000) + (cs * 10);
  } else if (parts.length === 2) {
    var sec = parseInt(parts[0], 10) || 0;
    var cs = parseInt(parts[1], 10) || 0;
    return (sec * 1000) + (cs * 10);
  }
  var num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num * 1000);
}

function getSupabase(path) {
  var url = SUPABASE_URL + '/rest/v1/' + path;
  var options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    },
    muteHttpExceptions: true
  };
  try {
    var res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() === 200) {
      return JSON.parse(res.getContentText());
    }
  } catch (e) {
    Logger.log("Error getSupabase: " + e);
  }
  return [];
}

function postSupabase(table, payload, onConflict, returnRepresentation) {
  var url = SUPABASE_URL + '/rest/v1/' + table;
  if (onConflict) url += '?on_conflict=' + encodeURIComponent(onConflict);

  var prefer = onConflict ? 'resolution=merge-duplicates' : 'return=minimal';
  if (returnRepresentation) prefer = 'return=representation';

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': prefer
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      var text = res.getContentText();
      return text ? JSON.parse(text) : true;
    } else {
      Logger.log("postSupabase error [" + code + "]: " + res.getContentText());
    }
  } catch (e) {
    Logger.log("postSupabase exception: " + e);
  }
  return null;
}

function patchSupabase(path, payload) {
  var url = SUPABASE_URL + '/rest/v1/' + path;
  var options = {
    method: 'patch',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log("patchSupabase error: " + e);
  }
}

function deleteSupabase(path) {
  var url = SUPABASE_URL + '/rest/v1/' + path;
  var options = {
    method: 'delete',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    },
    muteHttpExceptions: true
  };
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log("deleteSupabase error: " + e);
  }
}

function onEditTrigger(e) {
  syncLiveVisualToSupabase();
}

function pasangTriggerOtomatis() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(ss)
    .onChange()
    .create();

  Logger.log("🎉 Trigger otomatis realtime berhasil diaktifkan!");
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Olimpiakids')
    .addItem('⚡ Pasang Auto-Sync Realtime', 'pasangTriggerOtomatis')
    .addItem('🔄 Sinkronkan Sekarang', 'syncLiveVisualToSupabase')
    .addToUi();
}
