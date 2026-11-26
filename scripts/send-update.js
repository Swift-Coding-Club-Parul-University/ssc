#!/usr/bin/env node
/**
 * SSC 2027 — TIME-UPDATE campaign sender (correction mail to the 247).
 *
 * Uses mail/briefing-update-template.html (Apple-native, important-update copy)
 * with a FRESH log (update-log.csv) — the old campaign-log.csv is ignored so
 * all recipients stay pending for this resend.
 *
 * Batch timing comes from CLI: --date "28 Nov 2026" --day Saturday --time "10:00 - 12:00"
 *
 * Usage:
 *   node scripts/send-update.js --file <csv> --dry-run
 *   node scripts/send-update.js --test --name Subhansh [--to email]
 *   node scripts/send-update.js --file <csv> --date "..." --day "..." --time "..." --go [--limit N]
 *
 * NEVER touches registrations. Real sends require --go.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const TEMPLATE_PATH = path.join(__dirname, "..", "mail", "briefing-update-template.html");
const LOG_PATH = path.join(__dirname, "..", "invites-out", "update-log.csv");
const SUBJECT = "Important update: new time for the Swift Student Challenge 2027 briefing";
const TEST_TO = "subhansh.dev@gmail.com";

const CONFIG = {
  DATE: "28 Nov 2026",
  DAY: "Saturday",
  TIME: "",
  VENUE: "109 CV Raman Seminar Hall, Parul University",
  CONFIRM_LINK:
    "https://docs.google.com/forms/d/e/1FAIpQLSdZoNfxqcbs_cXWdDAiJfqoTtpBD_hlanobk0NRBfWUsBTZfw/viewform?usp=header",
};

/* Openings reference the time change (correction mail) */
function openingFor(first) {
  const t = CONFIG.TIME;
  const variants = [
    `Hi ${first} — quick but important: the briefing time we sent earlier was wrong. The correct slot is ${t}. Please update your calendar; everything else stays the same.`,
    `${first}, heads up — we've corrected the briefing timing. It's now ${t}. Same venue, same agenda, just the right time this time.`,
    `Hey ${first}, sorry about the mix-up: the earlier time slot was a mistake. Your briefing is ${t}. Mark it down and you're set.`,
    `Hi ${first}, important update — please note the corrected briefing time: ${t}. We'd love to see you there.`,
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function firstNameOf(fullName) {
  const token = String(fullName || "").trim().split(/\s+/)[0] || "Student";
  if (token.length > 1 && token === token.toUpperCase() && /[A-Z]/.test(token)) {
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }
  return token;
}

function splitCsvLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { cur += c; }
    } else if (c === '"') { inQ = true; }
    else if (c === ",") { out.push(cur); cur = ""; }
    else { cur += c; }
  }
  out.push(cur);
  return out;
}

function loadRecipients(csvPath) {
  if (!fs.existsSync(csvPath)) { console.error("\u2717 CSV not found: " + csvPath); process.exit(1); }
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) { console.error("\u2717 CSV has no data rows"); process.exit(1); }
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const emailIdx = header.findIndex((h) => h.includes("email"));
  const nameIdx = header.findIndex((h) => h.includes("name"));
  if (emailIdx === -1) { console.error("\u2717 CSV missing 'email' column"); process.exit(1); }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const email = String(cells[emailIdx] || "").trim();
    if (!email || !email.includes("@")) continue;
    const rawName = nameIdx !== -1 ? String(cells[nameIdx] || "").trim() : "";
    rows.push({ email, first: firstNameOf(rawName) });
  }
  return rows;
}

function loadSentSet() {
  const sent = new Set();
  if (fs.existsSync(LOG_PATH)) {
    const text = fs.readFileSync(LOG_PATH, "utf8").replace(/^\uFEFF/, "");
    for (const line of text.split(/\r?\n/).slice(1)) {
      if (!line.trim()) continue;
      const cells = splitCsvLine(line);
      if (cells[2] === "SENT") sent.add(String(cells[0]).trim().toLowerCase());
    }
  }
  return sent;
}

function appendLog(email, first, status) {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const needsHeader = !fs.existsSync(LOG_PATH);
  const safeStatus = String(status).replace(/"/g, "'").replace(/[\r\n]/g, " ");
  const line =
    (needsHeader ? "email,first_name,status,timestamp\n" : "") +
    `"${email}","${(first || "").replace(/"/g, '""')}","${safeStatus}","${new Date().toISOString()}"\n`;
  fs.appendFileSync(LOG_PATH, line, "utf8");
}

function render(template, recipient) {
  return template
    .replace(/\{\{OPENING\}\}/g, openingFor(recipient.first))
    .replace(/\{\{DATE\}\}/g, CONFIG.DATE)
    .replace(/\{\{DAY\}\}/g, CONFIG.DAY)
    .replace(/\{\{TIME\}\}/g, CONFIG.TIME)
    .replace(/\{\{VENUE\}\}/g, CONFIG.VENUE)
    .replace(/\{\{CONFIRM_LINK\}\}/g, CONFIG.CONFIRM_LINK)
    .replace(/\{\{FirstName\}\}/g, recipient.first);
}

function parseArgs(argv) {
  const o = { file: "", dryRun: false, test: false, go: false, limit: 0, to: "", name: "", date: "", day: "", time: "" };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--file") o.file = argv[++i] || "";
    else if (k === "--dry-run") o.dryRun = true;
    else if (k === "--test") o.test = true;
    else if (k === "--go") o.go = true;
    else if (k === "--limit") o.limit = parseInt(argv[++i], 10) || 0;
    else if (k === "--to") o.to = argv[++i] || "";
    else if (k === "--name") o.name = argv[++i] || "";
    else if (k === "--date") o.date = argv[++i] || "";
    else if (k === "--day") o.day = argv[++i] || "";
    else if (k === "--time") o.time = argv[++i] || "";
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.date) CONFIG.DATE = opts.date;
  if (opts.day) CONFIG.DAY = opts.day;
  if (opts.time) CONFIG.TIME = opts.time;

  if (!fs.existsSync(TEMPLATE_PATH)) { console.error("\u2717 Template not found: " + TEMPLATE_PATH); process.exit(1); }
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");

  /* require an explicit time — a wrong-time mail about wrong times would be embarrassing */
  if (!CONFIG.TIME && !opts.dryRun) {
    console.error("\u2717 --time is required for real sends (e.g. --time \"10:00 - 12:00\")");
    process.exit(1);
  }

  if (opts.test) {
    const to = opts.to || TEST_TO;
    const smtpUser = process.env.SMTP_USER, smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) { console.error("\u2717 SMTP creds missing"); process.exit(1); }
    if (!CONFIG.TIME) { console.error("\u2717 --time required even for tests"); process.exit(1); }
    const recipient = { email: to, first: opts.name || "Subhansh" };
    const html = render(template, recipient);
    const leftover = html.match(/\{\{[^}]+\}\}/g);
    if (leftover) { console.error("\u2717 Leftover placeholders: " + leftover.join(",")); process.exit(1); }
    if (!html.includes(recipient.first)) { console.error("\u2717 Recipient name missing"); process.exit(1); }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "465", 10),
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });
    console.log("Sending UPDATE TEST -> " + to + "  (time: " + CONFIG.TIME + ")");
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Swift Coding Club Parul University" <${smtpUser}>`,
      to, subject: "[TEST] " + SUBJECT, html,
    });
    console.log("\u2713 test sent: " + info.messageId);
    return;
  }

  if (!opts.file) {
    console.error("Usage:\n" +
      "  node scripts/send-update.js --file <csv> --dry-run\n" +
      "  node scripts/send-update.js --test --name X [--to email] --time \"...\"\n" +
      "  node scripts/send-update.js --file <csv> --date \"...\" --day \"...\" --time \"...\" --go [--limit N]");
    process.exit(1);
  }

  const recipients = loadRecipients(opts.file);
  const sentSet = loadSentSet();
  const pending = recipients.filter((r) => !sentSet.has(r.email.toLowerCase()));
  console.log("Recipients in file : " + recipients.length);
  console.log("Already SENT (upd) : " + (recipients.length - pending.length));
  console.log("Pending            : " + pending.length);
  console.log("Slot               : " + CONFIG.DATE + " / " + CONFIG.DAY + " / " + CONFIG.TIME);
  console.log("Log                : " + LOG_PATH);

  if (opts.dryRun) {
    let bad = 0;
    for (const r of pending) {
      const html = render(template, r);
      const left = html.match(/\{\{[^}]+\}\}/g);
      if (left) { bad++; console.log("  \u2717 " + r.email + " -> " + left.join(",")); }
      if (!html.includes(r.first)) { bad++; console.log("  \u2717 " + r.email + " -> NAME MISSING"); }
      if (/Subhansh/.test(html) && r.first !== "Subhansh") { bad++; console.log("  \u2717 " + r.email + " -> name leak"); }
      if (!html.includes(CONFIG.TIME)) { bad++; console.log("  \u2717 " + r.email + " -> TIME MISSING"); }
    }
    console.log("\n--- DRY RUN previews (first 5) ---");
    for (const r of pending.slice(0, 5)) {
      const html = render(template, r);
      const m = html.match(/padding-top:16px;font-size:17px[^>]*>([^<]{0,80})/);
      console.log("  \u2192 " + r.email + " | " + r.first + " | " + ((m && m[1]) || html.slice(0, 60)));
    }
    console.log("\n\u2713 dry run done. " + (bad === 0 ? "all clean." : bad + " issues."));
    console.log("No mail was sent.");
    return;
  }

  if (!opts.go) {
    console.log("\nDry first? --dry-run. Ready? re-run with --go" + (opts.limit ? " --limit " + opts.limit : ""));
    return;
  }
  const smtpUser = process.env.SMTP_USER, smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) { console.error("\u2717 SMTP creds missing"); process.exit(1); }

  const queue = opts.limit > 0 ? pending.slice(0, opts.limit) : pending;
  if (queue.length === 0) { console.log("Nothing left — queue empty."); return; }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "465", 10),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  console.log("\nSending " + queue.length + " update mail(s) as " + smtpUser + " ...\n");
  let sent = 0, errors = 0, processed = 0;
  let nextRestAt = Math.floor(Math.random() * 7) + 6;
  const started = Date.now();

  for (let i = 0; i < queue.length; i++) {
    const r = queue[i];
    const html = render(template, r);
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Swift Coding Club Parul University" <${smtpUser}>`,
        to: r.email, subject: SUBJECT, html,
      });
      sent++; processed++;
      appendLog(r.email, r.first, "SENT");
      console.log("[" + (i + 1) + "/" + queue.length + "] \u2713 " + r.email + " (" + r.first + ")");
      const delay = Math.floor(Math.random() * 7000) + 4000;
      if (i < queue.length - 1) {
        console.log("    waiting " + Math.round(delay / 1000) + "s...");
        await wait(delay);
      }
      if (processed >= nextRestAt && i < queue.length - 1) {
        const rest = Math.floor(Math.random() * 40000) + 35000;
        console.log("    --- rest break " + Math.round(rest / 1000) + "s ---");
        await wait(rest);
        nextRestAt = processed + Math.floor(Math.random() * 7) + 6;
      }
    } catch (err) {
      errors++;
      appendLog(r.email, r.first, "ERROR: " + String(err.message || err).slice(0, 120));
      console.log("[" + (i + 1) + "/" + queue.length + "] \u2717 FAILED " + r.email + " -> " + err.message);
      await wait(15000);
    }
  }
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log("\n\u2713 Update run complete in " + mins + " min");
  console.log("  sent  : " + sent);
  console.log("  errors: " + errors);
  console.log("  log   : " + LOG_PATH);
}

main().catch((e) => { console.error(e); process.exit(1); });
