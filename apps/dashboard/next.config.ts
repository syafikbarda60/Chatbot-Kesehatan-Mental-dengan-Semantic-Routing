import type { NextConfig } from 'next';

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : 'http://localhost:8000';
const development = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
  `connect-src 'self' ${apiOrigin}${development ? ' ws: wss:' : ''}`,
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/assessments', destination: '/monitoring', permanent: false },
      { source: '/attention', destination: '/monitoring', permanent: false },
      { source: '/risk', destination: '/monitoring', permanent: false },
      { source: '/schedule', destination: '/counseling', permanent: false },
      { source: '/hotlines', destination: '/hotline', permanent: false },
      { source: '/reports', destination: '/analytics', permanent: false },
      { source: '/report-preview', destination: '/reports/preview', permanent: false },
      { source: '/users', destination: '/students', permanent: false },
    ];
  },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ] }];
  },
};

export default nextConfig;
