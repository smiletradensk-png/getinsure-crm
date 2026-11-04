/**
 * GETINSURE CRM — Facebook leads sheet -> CRM server
 * Runs every minute. Sends only NEW rows. Never edits or deletes anything in the sheet.
 *
 * FIRST TIME: run  setup()  once (Run button). It asks for permission, then starts the 1-minute timer.
 */
var SERVER_URL = 'https://getinsure-webhook.onrender.com/lead-from-sheet';
var SHEET_ID = '1D116-6tuB4wGxQB5c37mZjjASR6RlmSxPi9qJv9FAzA';

function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SHEET_KEY')) {
    throw new Error('First add SHEET_KEY: Project Settings (gear icon) > Script properties > Add property.');
  }
  // Baseline: leads already in the sheet today are NOT sent (they are old). Only new rows from now on.
  var ss = SpreadsheetApp.openById(SHEET_ID);
  ss.getSheets().forEach(function (sh) {
    if (props.getProperty('sent_' + sh.getSheetId()) === null) {
      props.setProperty('sent_' + sh.getSheetId(), String(sh.getLastRow()));
    }
  });
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncLeads').timeBased().everyMinutes(1).create();
  syncLeads();
}

function syncLeads() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var key = props.getProperty('SHEET_KEY');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    ss.getSheets().forEach(function (sh) {
      var last = sh.getLastRow();
      var propName = 'sent_' + sh.getSheetId();
      var sent = parseInt(props.getProperty(propName) || '1', 10);
      if (sent < 1) sent = 1;
      if (last <= sent || last < 2) return;
      var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      // Send in chunks of 50 rows so one failure never loses anything
      while (sent < last) {
        var from = sent + 1;
        var n = Math.min(50, last - sent);
        var values = sh.getRange(from, 1, n, headers.length).getValues();
        var rows = [];
        values.forEach(function (r) {
          var o = {}; var any = false;
          headers.forEach(function (h, i) {
            var v = r[i]; if (v instanceof Date) v = v.toISOString();
            o[h] = (v === null || v === undefined) ? '' : String(v);
            if (o[h] !== '') any = true;
          });
          if (any) { o['form_name'] = o['form_name'] || sh.getName(); rows.push(o); }
        });
        if (rows.length && !post(rows, key)) return; // keep position; retried next minute
        sent += n;
        props.setProperty(propName, String(sent));
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function post(rows, key) {
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var res = UrlFetchApp.fetch(SERVER_URL, {
        method: 'post', contentType: 'application/json',
        headers: { 'x-sheet-key': key },
        payload: JSON.stringify({ rows: rows }), muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) return true;
    } catch (e) {}
    Utilities.sleep(3000 * (attempt + 1)); // server may be waking up
  }
  return false;
}
