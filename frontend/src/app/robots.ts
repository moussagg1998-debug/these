import type { MetadataRoute } from 'next';

// The counterpart to next.config.ts's X-Robots-Tag headers: this Disallows
// crawling of the same auth-gated / auth-funnel prefixes to save crawl
// budget (the X-Robots-Tag header is what actually guarantees exclusion
// from the index — see next.config.ts for why both are needed).
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? 'http://localhost:3000';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard',
        '/admin',
        '/documents',
        '/students',
        '/comments',
        '/deadlines',
        '/settings',
        '/onboarding',
        '/login',
        '/signup',
        '/verify-email',
        '/forgot-password',
        '/reset-password',
        '/auth',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
