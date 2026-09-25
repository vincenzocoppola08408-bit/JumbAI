import crypto from 'crypto';
import { encryptAES256GCM, decryptAES256GCM } from './cipher.js';

// Endpoint ufficiali Civitai (verificati: auth.civitai.com)
const AUTH_URL = process.env.CIVITAI_AUTH_URL || 'https://auth.civitai.com/api/auth/oauth/authorize';
const TOKEN_URL = process.env.CIVITAI_TOKEN_URL || 'https://auth.civitai.com/api/auth/oauth/token';
const ORCHESTRATION_URL = process.env.CIVITAI_ORCHESTRATION_URL || 'https://orchestration.civitai.com/v2/consumer/workflows';

// Scope bitmask (verificato da docs): UserRead(1) | AIServicesRead(16384) | AIServicesWrite(32768) | BuzzRead(65536)
const SCOPES = 114689;

/** PKCE */
export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url').slice(0, 64);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  return { verifier, challenge, state };
}

export function getCivitaiAuthUrl(clientId, redirectUri, state) {
  const { challenge } = generatePKCE();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: String(SCOPES),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code,
  codeVerifier,
  clientId,
  clientSecret,
  redirectUri
) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: redirectUri || process.env.CIVITAI_REDIRECT_URI || 'http://localhost:3000/api/auth/civitai/callback',
  });
  if (clientSecret) body.set('client_secret', clientSecret);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${err.error || res.status}`);
  }
  return res.json();
}

export async function refreshAccessToken(
  refreshToken,
  clientId,
  clientSecret
) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  if (clientSecret) body.set('client_secret', clientSecret);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Token refresh failed: ${err.error || res.status}`);
  }
  return res.json();
}

export async function generateImage(
  accessToken,
  prompt,
  options = {}
) {
  const {
    width = 1024,
    height = 1024,
    model = 'flux',
    negativePrompt = '',
    seed = null,
    callbacks = [{
      url: `${process.env.SITE_URL || process.env.VERCEL_URL || 'https://jumbai.vercel.app'}/api/webhooks/civitai`,
      type: ['workflow:succeeded', 'workflow:failed'],
      detailed: true,
    }],
  } = options;

  const body = {
    steps: [
      {
        $type: 'imageGen',
        input: {
          engine: model,
          prompt,
          width,
          height,
          ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
          ...(seed !== null && seed !== undefined ? { seed } : {}),
        },
      },
    ],
    callbacks,
    tags: ['jumbai'],
    metadata: { source: 'jumbai_platform', timestamp: new Date().toISOString() },
  };

  const res = await fetch(ORCHESTRATION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Generation failed: ${err.error || res.status}`);
  }
  return res.json();
}

export async function getWorkflowStatus(accessToken, workflowId) {
  const res = await fetch(`${ORCHESTRATION_URL}/${workflowId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to get workflow status: ${res.status}`);
  return res.json();
}

export function saveEncryptedTokens(
  accessToken,
  refreshToken,
  expiresIn
) {
  const encAccess = encryptAES256GCM(accessToken);
  const encRefresh = encryptAES256GCM(refreshToken);
  return {
    encrypted_access_token: encAccess.encrypted,
    access_iv: encAccess.iv,
    access_auth_tag: encAccess.authTag,
    encrypted_refresh_token: encRefresh.encrypted,
    refresh_iv: encRefresh.iv,
    refresh_auth_tag: encRefresh.authTag,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    last_refreshed_at: new Date().toISOString(),
  };
}