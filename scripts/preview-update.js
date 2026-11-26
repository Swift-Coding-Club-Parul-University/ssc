#!/usr/bin/env node
/* Render local preview files for the update mail (NO sending). */
const fs = require("fs");
const path = require("path");

const tpl = fs.readFileSync(path.join(__dirname, "..", "mail", "briefing-update-template.html"), "utf8");

function opening(first, t) {
  const v = [
    `Hi ${first} \u2014 quick but important: the briefing time we sent earlier was wrong. The correct slot is ${t}. Please update your calendar; everything else stays the same.`,
    `${first}, heads up \u2014 we've corrected the briefing timing. It's now ${t}. Same venue, same agenda, just the right time this time.`,
    `Hey ${first}, sorry about the mix-up: the earlier time slot was a mistake. Your briefing is ${t}. Mark it down and you're set.`,
    `Hi ${first}, important update \u2014 please note the corrected briefing time: ${t}. We'd love to see you there.`,
  ];
  return v[Math.floor(Math.random() * v.length)];
}

function render(first, time) {
  return tpl
    .replace(/\{\{OPENING\}\}/g, opening(first, time))
    .replace(/\{\{DATE\}\}/g, "28 Nov 2026")
    .replace(/\{\{DAY\}\}/g, "Saturday")
    .replace(/\{\{TIME\}\}/g, time)
    .replace(/\{\{VENUE\}\}/g, "109 CV Raman Seminar Hall, Parul University")
    .replace(/\{\{CONFIRM_LINK\}\}/g, "https://docs.google.com/forms/d/e/1FAIpQLSdZoNfxqcbs_cXWdDAiJfqoTtpBD_hlanobk0NRBfWUsBTZfw/viewform?usp=header");
}

const out1 = path.join(__dirname, "..", "invites-out", "preview-batch1.html");
const out2 = path.join(__dirname, "..", "invites-out", "preview-batch2.html");
fs.writeFileSync(out1, render("Rishu", "9:30 - 11:00"));
fs.writeFileSync(out2, render("Rishu", "11:30 - 1:00"));

for (const f of [out1, out2]) {
  const html = fs.readFileSync(f, "utf8");
  const left = html.match(/\{\{[^}]+\}\}/g) || [];
  console.log(path.basename(f), "->", left.length === 0 ? "clean" : "LEFTOVER: " + left.join(","));
}
