export default function handler(req, res) {
  const clientId = process.env.CIVITAI_CLIENT_ID || '';
  const redirectUri = `${process.env.APP_URL || 'https://jumbai.vercel.app'}/api/civitai-callback`;
  const scope = '114689'; // UserRead + BuzzRead + AIServicesWrite + AIServicesRead
  const state = Math.random().toString(36).slice(2);
  const url = `https://auth.civitai.com/api/auth/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&code_challenge=${Buffer.from(Math.random().toString()).toString('base64')}&code_challenge_method=S256`;
  res.setHeader('Set-Cookie', `civitai_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  res.redirect(url);
}
