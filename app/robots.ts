import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-exam-assistant.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/exams/',
          '/teacher/',
          '/classes/',
          '/join/',
          '/reset-password/',
          '/auth/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
