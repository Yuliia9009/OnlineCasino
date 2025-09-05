// автоматически проверяет, есть ли у пользователя активная сессия 
import prisma from "../db.js";
const COOKIE_NAME = process.env.COOKIE_NAME || "sid";

export default function auth(required = true) {
  return async (req, res, next) => {
    const sid = req.cookies?.[COOKIE_NAME];
    if (!sid) {
      if (required) return res.status(401).json({ ok:false, error:"no_session" });
      req.user = null; return next();
    }
    const s = await prisma.sessions.findUnique({ where: { id: sid } });
    if (!s || s.expires_at < new Date()) {
      if (required) return res.status(401).json({ ok:false, error:"session_expired" });
      req.user = null; return next();
    }
    req.user = { addressNorm: s.address_norm, addressChecksum: s.address_checksum, sid: s.id };
    next();
  };
}