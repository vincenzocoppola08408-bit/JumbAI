/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dashscope-intl.aliyuncs.com' },
      { protocol: 'https', hostname: 'dashscope.aliyuncs.com' },
      { protocol: 'https', hostname: 'fal.media' },
      { protocol: 'https', hostname: 'fal.ai' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'supabase.co' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: false },
      { source: '/pricing', destination: '/landing#pricing', permanent: false },
      { source: '/login', destination: '/?login=1', permanent: false },
      { source: '/signup', destination: '/?login=1', permanent: false },
      { source: '/app', destination: '/', permanent: false },
    ];
  },
};

module.exports = nextConfig;