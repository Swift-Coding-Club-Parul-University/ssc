const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Small in-memory limiter so brute-forcing codes is slow (per-instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return true;
  }
  const record = rateLimitMap.get(ip);
  if (now - record.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return true;
  }
  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }
  record.count += 1;
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ valid: false, error: "Method not allowed" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ valid: false, error: "Too many attempts. Please try again later." });
  }

  const { code } = req.body || {};
  const inviteCode = String(code || "").trim().toUpperCase();

  if (!inviteCode) {
    return res.status(200).json({ valid: false, error: "Enter your invite code." });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ valid: false, error: "Server not configured." });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("invites")
      .select("expires_at, used_at")
      .eq("code", inviteCode)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(200).json({ valid: false, error: "Invalid invite code." });
    }
    if (data.used_at) {
      return res.status(200).json({ valid: false, error: "This invite has already been used." });
    }
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return res.status(200).json({ valid: false, error: "This invite has expired." });
    }

    return res.status(200).json({ valid: true });
  } catch (err) {
    console.error("Invite verify error:", err);
    return res.status(200).json({ valid: false, error: "Could not verify invite. Please try again." });
  }
};
