import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

function getKey() {
  if (ENCRYPTION_KEY.length === 32) return ENCRYPTION_KEY;
  const fb = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY mancante o non valida (deve essere 32 byte hex)');
  }
  console.warn('ENCRYPTION_KEY non valida: uso chiave di fallback per sviluppo');
  return fb;
}

export function encryptAES256GCM(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decryptAES256GCM(encrypted, iv, authTag) {
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
