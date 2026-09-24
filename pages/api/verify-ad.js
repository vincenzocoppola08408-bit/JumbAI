// ============================================================
// /api/verify-ad — Il server emette un token firmato dopo ad
// Il client chiama /api/reward-credits con token + userId
// ============================================================
import crypto from 'crypto';

function signToken(userId) {
  const secret = process.env.JWT_SECRET || 'jumbai-secret-change-me';
  return crypto.createHmac('sha256', secret).update(`ads_verified:${userId}:${Date.now()}`).digest('hex');
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId mancante' });
  const token = signToken(userId);
  return res.status(200).json({ token_jumbai_ads: token, expires_in: 3600 });
}
