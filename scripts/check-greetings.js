#!/usr/bin/env node
/* Print greeting samples + flag suspicious names using the EXACT sender logic. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function firstNameOf(fullName) {
  const token = String(fullName || "").trim().split(/\s+/)[0] || "Student";
  if (token.length > 1 && token === token.toUpperCase() && /[A-Z]/.test(token)) {
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }
  return token;
}
function openingFor(first, t) {
  const v = [
    `Hey ${first}, quick update on Saturday's schedule — we've updated the briefing timing from 12:30 – 14:30 to ${t}. Mark it down and you're set.`,
    `Hi ${first} — quick but important: the briefing timing we sent earlier (12:30 – 14:30) was wrong. The correct slot is ${t}. Please update your calendar; everything else stays the same.`,
    `${first}, heads up — we've corrected the briefing timing from 12:30 – 14:30 to ${t}. Same venue, same agenda, just the right time this time.`,
    `Hey ${first}, sorry about the mix-up: the earlier 12:30 – 14:30 slot was a mistake. Your briefing is now ${t}. Mark it down and you're set.`,
  ];
  return v[Math.floor(Math.random() * v.length)];
}
function split(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur); return out;
}
let suspicious = 0;
for (const [file, time] of [["batch1.csv", "9:30 - 11:15"], ["batch2.csv", "11:15 - 1:00"]]) {
  const lines = fs.readFileSync(path.join(ROOT, "invites-out", file), "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const rows = lines.slice(1).map((l) => { const c = split(l); return { email: c[0], name: c[1] }; });
  console.log("\n=== " + file + " (" + rows.length + ") ===");
  for (const r of rows.slice(0, 4)) console.log("  " + r.email + " -> " + openingFor(firstNameOf(r.name), time));
  for (const r of rows) {
    const f = firstNameOf(r.name);
    if (f.length < 2 || /\d/.test(f) || /Subhansh/.test(f)) { suspicious++; console.log("  ? suspicious name: " + r.email + " -> '" + f + "'"); }
  }
}
console.log("\nsuspicious names: " + suspicious);
