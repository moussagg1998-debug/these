import type { MetadataRoute } from 'next';

// Only the 3 public, indexable routes — see robots.ts for the rest.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? 'http://localhost:3000';
  const lastModified = new Date();

  return [
    { url: base, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/demo`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
