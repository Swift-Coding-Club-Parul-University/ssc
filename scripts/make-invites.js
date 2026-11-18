#!/usr/bin/env node
/**
 * SSC 2027 — Invite Code Generator (invite-only re-launch)
 *
 * Mints unique single-use invite codes, stores them in the Supabase `invites`
 * table, and writes a ready-to-send CSV (label, code, expires_at, link).
 *
 * Usage:
 *   node scripts/make-invites.js --count 25
 *   node scripts/make-invites.js --count 25 --label "AIML batch 1"
 *   node scripts/make-invites.js --file students.csv
 *   node scripts/make-invites.js --count 10 --expires 2026-12-01
 *
 * students.csv: one student per line (name/email/anything — used as the label).
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 * Requires supabase/invites.sql to have been run once in the SQL editor.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

/* Unambiguous alphabet — no I/L/O/0/1 so codes are safe to read aloud/type */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LINK_BASE = "https://sscpu.vercel.app/apply.html";

function makeCode() {
  const bytes = crypto.randomBytes(8);
  let raw = "";
  for (let i = 0; i < 8; i++) raw += ALPHABET[bytes[i] % ALPHABET.length];
  return raw.slice(0, 4) + "-" + raw.slice(4);
}

function parseArgs(argv) {
  const opts = { count: 0, label: "", file: "", expires: "" };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--count") opts.count = parseInt(argv[++i], 10) || 0;
    else if (k === "--label") opts.label = argv[++i] || "";
    else if (k === "--file") opts.file = argv[++i] || "";
    else if (k === "--expires") opts.expires = argv[++i] || "";
  }
  return opts;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("\u2717 SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const opts = parseArgs(process.argv.slice(2));

  /* Build the label list */
  let labels = [];
  if (opts.file) {
    if (!fs.existsSync(opts.file)) {
      console.error("\u2717 File not found: " + opts.file);
      process.exit(1);
    }
    labels = fs.readFileSync(opts.file, "utf8")
      .split(/\r?\n/)
      .map(function (l) { return l.trim(); })
      .filter(Boolean);
    console.log("Loaded " + labels.length + " label(s) from " + opts.file);
  } else {
    if (opts.count <= 0) {
      console.error('Usage: node scripts/make-invites.js --count 25 [--label "..."] [--file students.csv] [--expires 2026-12-01]');
      process.exit(1);
    }
    labels = [];
    for (let i = 0; i < opts.count; i++) labels.push(opts.label);
  }

  let expiresIso = null;
  if (opts.expires) {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(opts.expires) ? opts.expires + "T23:59:59Z" : opts.expires);
    if (isNaN(d.getTime())) { console.error("\u2717 Invalid --expires value: " + opts.expires); process.exit(1); }
    if (d.getTime() < Date.now()) { console.error("\u2717 --expires is in the past"); process.exit(1); }
    expiresIso = d.toISOString();
  }

  console.log("Minting " + labels.length + " invite code(s)" + (expiresIso ? " (expires " + expiresIso + ")" : "") + "...\n");

  const rows = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    let code = null;
    /* Collision retry — 32^8 ~ 1.09e12 combos, but belt-and-suspenders */
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = makeCode();
      const { data, error } = await supabase
        .from("invites")
        .insert([{ code: candidate, label: label || null, expires_at: expiresIso }])
        .select("code");
      if (error) {
        if (error.code === "23505") continue; // duplicate — mint another
        console.error("\u2717 Insert failed for \"" + (label || "#" + (i + 1)) + "\":", error.message);
        process.exit(1);
      }
      code = data[0].code;
    }
    if (!code) { console.error("\u2717 Could not mint a unique code after 5 tries"); process.exit(1); }
    rows.push({
      label: label || "",
      code: code,
      expires_at: expiresIso || "",
      link: LINK_BASE + "?code=" + code,
    });
    console.log("  " + String(i + 1).padStart(3, " ") + ". " + code + (label ? "  \u2192 " + label : ""));
  }

  /* Write the send-list CSV */
  const outDir = path.join(__dirname, "..", "invites-out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(outDir, "invites-" + stamp + ".csv");
  const csv = ["label,code,expires_at,link"]
    .concat(rows.map(function (r) {
      return [r.label, r.code, r.expires_at, r.link]
        .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; })
        .join(",");
    }))
    .join("\n");
  fs.writeFileSync(outFile, csv, "utf8");

  console.log("\n\u2713 " + rows.length + " invite(s) created.");
  console.log("\u2713 Send-list saved to: " + outFile);
  console.log("Each link is single-use. Revoke anytime by deleting the row in Supabase.");
}

main().catch(function (err) { console.error(err); process.exit(1); });
