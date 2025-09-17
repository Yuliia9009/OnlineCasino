import { Router } from "express";
import crypto from "crypto";
import { SiweMessage } from "siwe";
import prisma from "../db.js";
import logger from "../utils/logger.js";

const r = Router();

const COOKIE_NAME = process.env.COOKIE_NAME || "sid";
const DOMAIN = process.env.SIWE_DOMAIN || "localhost";
const URI = process.env.SIWE_URI || "http://localhost:4000";
const SESSION_TTL_MIN = Number(process.env.SESSION_TTL_MIN || 10080); // 7d
const NONCE_TTL_MIN = Number(process.env.NONCE_TTL_MIN || 10);

function now() { return new Date(); }
function addMinutes(d, m) { return new Date(d.getTime() + m*60*1000); }
const normAddr = (a) => (a ? a.toLowerCase() : a);
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");

function setSessionCookie(res, sid) {
  const secure = (process.env.COOKIE_SECURE || "false") === "true";
  const sameSite = (process.env.COOKIE_SAMESITE || "Lax");
  const domain = process.env.COOKIE_DOMAIN || undefined;

  res.cookie(COOKIE_NAME, sid, {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: "/",
    maxAge: SESSION_TTL_MIN * 60 * 1000
  });
}

r.get("/nonce", async (req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  const expires = addMinutes(now(), NONCE_TTL_MIN);
  await prisma.auth_nonces.create({
    data: { nonce, expires_at: expires }
  });
  logger.info({ nonce }, "auth.nonce.issued");
  res.json({ nonce, domain: DOMAIN, uri: URI });
});

r.post("/verify", async (req, res) => {
  try {
    const { message, signature } = req.body || {};
    if (!message || !signature) {
      return res.status(400).json({ ok:false, error: "message_and_signature_required" });
    }

    const siwe = new SiweMessage(message);
    const fields = await siwe.validate(signature, { domain: DOMAIN, nonce: siwe.nonce });
    const checksum = fields.address;
    const address = normAddr(checksum);

    if (!isAddr(address)) {
      return res.status(400).json({ ok:false, error: "bad_address" });
    }

    // nonce валиден и не использован?
    const rec = await prisma.auth_nonces.findUnique({ where: { nonce: siwe.nonce } });
    if (!rec || rec.used || rec.expires_at < now()) {
      return res.status(400).json({ ok:false, error: "nonce_invalid" });
    }
    await prisma.auth_nonces.update({
      where: { nonce: siwe.nonce },
      data: { used: true, address_norm: address }
    });

    // создаём сессию
    const sid = crypto.randomBytes(24).toString("base64url");
    const expiresAt = addMinutes(now(), SESSION_TTL_MIN);
    await prisma.sessions.create({
      data: {
        id: sid,
        address_norm: address,
        address_checksum: checksum,
        expires_at: expiresAt,
        ip: req.ip?.toString() || null,
        user_agent: req.get("user-agent") || null
      }
    });

    setSessionCookie(res, sid);
    logger.info({ address }, "auth.verify.ok");
    res.json({ ok:true, addressChecksum: checksum, addressNorm: address, expiresAt });
  } catch (e) {
    logger.warn(e, "auth.verify.fail");
    res.status(400).json({ ok:false, error: e.message || "verify_failed" });
  }
});

r.get("/me", async (req, res) => {
  const sid = req.cookies?.[COOKIE_NAME];
  if (!sid) return res.status(401).json({ ok:false, error:"no_session" });

  const s = await prisma.sessions.findUnique({ where: { id: sid } });
  if (!s || s.expires_at < now()) {
    return res.status(401).json({ ok:false, error:"session_expired" });
  }
  await prisma.sessions.update({ where: { id: sid }, data: { last_used_at: now() } });
  res.json({ ok:true, addressChecksum: s.address_checksum, addressNorm: s.address_norm, expiresAt: s.expires_at });
});

r.post("/logout", async (req, res) => {
  const sid = req.cookies?.[COOKIE_NAME];
  if (sid) {
    await prisma.sessions.delete({ where: { id: sid } }).catch(() => {});
  }
  res.clearCookie(COOKIE_NAME, { path: "/" });
  logger.info("auth.logout");
  res.json({ ok:true });
});

export default r;