import type { MetadataRoute } from 'next'

// Personal app: nothing here is for search engines (pairs with `robots: noindex` in layout.tsx).
// `/robots.txt` is listed in proxy.ts PUBLIC_PREFIXES so crawlers get this file, not a sign-in redirect.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } }
}
