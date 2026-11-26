#!/usr/bin/env node
/**
 * PRE-FLIGHT: verifies everything before a real update-campaign run.
 * - batch files: count, overlap, duplicates, valid emails, names present
 * - template: renders for ALL recipients, no leftover {{}}, own-name guard,
 *   no hardcoded "Subhansh", links present (RSVP + WhatsApp), time present
 * - sender: syntax, test path never logs, real path requires --go
 * - log state: update-log must be empty/absent (else resume skips people)
 * READ-ONLY: sends nothing, writes nothing except console output.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TPL = fs.readFileSync(path.join(ROOT, "mail", "briefing-update-template.html"), "utf8");
const SENDER = fs.readFileSync(path.join(ROOT, "scripts", "send-update.js"), "utf8");
const LOG = path.join(ROOT, "invites-out", "update-log.csv");

let fails = 0;
const ok = (m) => console.log("  \u2713 " + m);
const bad = (m) => { fails++; console.log("  \u2717 " + m); };

function splitCsvLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { cur += c; }
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function loadCsv(file) {
  const text = fs.readFileSync(path.join(ROOT, "invites-out", file), "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const eIdx = header.findIndex((h) => h.includes("email"));
  const nIdx = header.findIndex((h) => h.includes("name"));
  return lines.slice(1).map((l) => {
    const c = splitCsvLine(l);
    return { email: (c[eIdx] || "").trim(), name: nIdx !== -1 ? (c[nIdx] || "").trim() : "" };
  });
}

console.log("\n=== 1. BATCH FILES ===");
const b1 = loadCsv("batch1.csv");
const b2 = loadCsv("batch2.csv");
const master = loadCsv("campaign-recipients.csv");
b1.length === 124 ? ok("batch1 = 124") : bad("batch1 = " + b1.length + " (want 124)");
b2.length === 123 ? ok("batch2 = 123") : bad("batch2 = " + b2.length + " (want 123)");
(b1.length + b2.length) === master.length ? ok("batches total = master (" + master.length + ")") : bad("total " + (b1.length + b2.length) + " vs master " + master.length);

const all = [...b1, ...b2];
const seen = new Set();
let dupes = 0, badEmail = 0, noName = 0;
for (const r of all) {
  const e = r.email.toLowerCase();
  if (seen.has(e)) dupes++;
  seen.add(e);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) badEmail++;
  if (!r.name || r.name.length < 2) noName++;
}
dupes === 0 ? ok("no duplicate emails") : bad(dupes + " duplicate emails");
badEmail === 0 ? ok("all emails well-formed") : bad(badEmail + " malformed emails");
noName === 0 ? ok("every recipient has a name") : bad(noName + " recipients missing name");

const masterSet = new Set(master.map((r) => r.email.toLowerCase()));
const covered = new Set(all.map((r) => r.email.toLowerCase()));
const missing = [...masterSet].filter((e) => !covered.has(e));
missing.length === 0 ? ok("all master recipients covered") : bad(missing.length + " master recipients NOT in any batch: " + missing.slice(0, 3).join(","));

console.log("\n=== 2. TEMPLATE RENDER (all 247 x2 slots) ===");
const SLOTS = { "batch1.csv": "9:30 - 11:15", "batch2.csv": "11:15 - 1:00" };
let renderFails = 0, nameLeak = 0, timeFail = 0, leftoverAll = new Set();
for (const [file, time] of Object.entries(SLOTS)) {
  for (const r of loadCsv(file)) {
    const first = r.name.split(/\s+/)[0] || "Student";
    const html = TPL
      .replace(/\{\{OPENING\}\}/g, `Hey ${first}, quick update — the briefing timing is now ${time}.`)
      .replace(/\{\{DATE\}\}/g, "28 Nov 2026")
      .replace(/\{\{DAY\}\}/g, "Saturday")
      .replace(/\{\{TIME\}\}/g, time)
      .replace(/\{\{VENUE\}\}/g, "109 CV Raman Seminar Hall, Parul University")
      .replace(/\{\{CONFIRM_LINK\}\}/g, "https://example.com/form");
    const left = html.match(/\{\{[^}]+\}\}/g);
    if (left) { renderFails++; left.forEach((l) => leftoverAll.add(l)); }
    if (!html.includes(first)) { renderFails++; }
    if (/Subhansh/.test(html)) nameLeak++;
    if (!html.includes(time)) timeFail++;
  }
}
renderFails === 0 ? ok("247/247 render clean per slot (no leftover, name present)") : bad(renderFails + " render failures" + (leftoverAll.size ? " leftovers: " + [...leftoverAll].join(",") : ""));
nameLeak === 0 ? ok("no hardcoded 'Subhansh' leaks to other recipients") : bad(nameLeak + " mails would contain 'Subhansh'");
timeFail === 0 ? ok("correct slot time present in every render") : bad(timeFail + " renders missing their time");

console.log("\n=== 3. TEMPLATE CONTENT ===");
TPL.includes("chat.whatsapp.com/EICCXr8FNYKD85bgIHUIRG") ? ok("WhatsApp group link present") : bad("WhatsApp link missing");
SENDER.includes("docs.google.com/forms/d/e/1FAIpQLSdZoNfxqcbs_cXWdDAiJfqoTtpBD_hlanobk0NRBfWUsBTZfw") ? ok("RSVP form link present in sender config") : bad("RSVP link missing");
TPL.includes('href="{{CONFIRM_LINK}}"') ? ok("template RSVP button wired to {{CONFIRM_LINK}}") : bad("template RSVP button not wired");
TPL.includes("Briefing: Updated Time") ? ok("headline: 'Briefing: Updated Time'") : bad("headline text missing");
const uniquePlaceholders = [...new Set(TPL.match(/\{\{[A-Z_]+\}\}/g) || [])].length;
uniquePlaceholders === 6 ? ok("6 unique placeholders (TIME used twice by design): " + [...new Set(TPL.match(/\{\{[A-Z_]+\}\}/g) || [])].join(", ")) : bad("unique placeholder count = " + uniquePlaceholders);
for (const u of ["parul_university_logo_white", "tinkering_hub_logo_black", "swift_coding_club_logo_black", "apple_logo"]) {
  TPL.includes(u) ? ok("logo ref: " + u) : bad("logo ref missing: " + u);
}

console.log("\n=== 4. SENDER GUARDS ===");
SENDER.includes('require("fs")') || SENDER.includes("require('fs')") ? ok("sender loads fs") : bad("sender broken");
const testPath = SENDER.slice(SENDER.indexOf("if (opts.test)"), SENDER.indexOf("if (!opts.file)"));
testPath.includes("appendLog") ? bad("TEST path writes to log!") : ok("test path never writes the campaign log");
testPath.includes("return") ? ok("test path returns before sending loop") : bad("test path may fall through");
SENDER.includes("if (!opts.go)") ? ok("--go safety latch present") : bad("--go latch missing");
SENDER.includes("--time is required") ? ok("real send REQUIRES explicit --time") : bad("--time guard missing");
SENDER.includes("if (!CONFIG.TIME && !opts.dryRun)") ? ok("dry-run allowed without time, real send blocked") : bad("time guard logic missing");
const rest = SENDER.match(/nextRestAt = processed \+ Math\.floor\(Math\.random\(\) \* 7\) \+ 6/);
rest ? ok("deterministic rest breaks every 6-12") : bad("rest-break logic missing");
const delay = SENDER.match(/Math\.floor\(Math\.random\(\) \* 7000\) \+ 4000/);
delay ? ok("4-11s pacing between mails") : bad("pacing missing");

console.log("\n=== 5. LOG STATE ===");
if (fs.existsSync(LOG)) {
  const rows = fs.readFileSync(LOG, "utf8").split(/\r?\n/).filter((l) => l.trim()).length - 1;
  rows === 0 ? ok("update-log exists but empty (0 sent)") : bad("update-log has " + rows + " rows — resume would SKIP them");
} else {
  ok("update-log.csv absent — all 247 pending, fresh start");
}
const oldLog = path.join(ROOT, "invites-out", "campaign-log.csv");
if (fs.existsSync(oldLog)) ok("old campaign-log.csv untouched (separate campaign)");

console.log("\n=== 6. PLACEHOLDER SET MATCH ===");
const tplPlaceholders = [...new Set((TPL.match(/\{\{[A-Z_]+\}\}/g) || []))].sort();
const senderReplaces = [...new Set((SENDER.match(/\\{\\{[A-Za-z_]+\\}\\}/g) || []).map((s) => s.replace(/\\/g, "")))].sort();
const notReplaced = tplPlaceholders.filter((p) => !senderReplaces.includes(p));
notReplaced.length === 0 ? ok("every {{PLACEHOLDER}} is replaced by sender: " + tplPlaceholders.join(", ")) : bad("NOT replaced: " + notReplaced.join(", "));

console.log("\n" + (fails === 0 ? "\u2705 PRE-FLIGHT PASSED — 0 issues. No mail was sent." : "\u274c PRE-FLIGHT: " + fails + " issue(s). No mail was sent."));
process.exit(fails === 0 ? 0 : 1);
