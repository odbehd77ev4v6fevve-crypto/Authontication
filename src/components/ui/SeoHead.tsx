import { useEffect } from 'react';
import { sanitizeHref } from '../../../shared/security.ts';

interface SeoHeadProps {
  title: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  noindex?: boolean;
  structuredData?: Record<string, unknown> | null;
}

export function SeoHead({
  title,
  description,
  canonicalUrl,
  ogImage,
  noindex = false,
  structuredData,
}: SeoHeadProps) {
  useEffect(() => {
    document.title = title;

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);

    const safeOgImage = sanitizeHref(ogImage);
    if (safeOgImage) {
      const resolvedOgImage = safeOgImage.startsWith('/')
        ? `${window.location.origin}${safeOgImage}`
        : safeOgImage;
      setMeta('meta[property="og:image"]', 'property', 'og:image', resolvedOgImage);
    }

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) {
      if (!robots) {
        robots = document.createElement('meta');
        robots.name = 'robots';
        document.head.appendChild(robots);
      }
      robots.content = 'noindex, nofollow';
    } else if (robots) {
      robots.remove();
    }

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const safeCanonical = sanitizeHref(canonicalUrl);
    canonical.href = safeCanonical
      ? safeCanonical.startsWith('/')
        ? `${window.location.origin}${safeCanonical}`
        : safeCanonical
      : `${window.location.origin}${window.location.pathname}`;

    const ldId = 'novara-structured-data';
    const existingLd = document.getElementById(ldId);
    if (existingLd) existingLd.remove();
    if (structuredData) {
      const script = document.createElement('script');
      script.id = ldId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [title, description, canonicalUrl, ogImage, noindex, structuredData]);

  return null;
}
