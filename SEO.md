# SEO & search indexing — eHealth AI

Production site: **https://www.ehealthaigh.com**

## What is already in the app

| Item | Location |
|------|----------|
| Title, description, keywords | `app/+html.tsx` + `SRC/constants/seo.js` |
| Open Graph & Twitter cards | `app/+html.tsx` |
| JSON-LD (Organization, WebSite, WebApplication, FAQ) | `app/+html.tsx` |
| `robots.txt` | `public/robots.txt` |
| `sitemap.xml` | `public/sitemap.xml` (regenerated on build) |
| Crawlable fallback text | `<noscript>` in `app/+html.tsx` |
| PWA manifest | `public/manifest.json` |

## Build with production URL

```bash
EXPO_PUBLIC_SITE_URL=https://www.ehealthaigh.com npm run build:web
```

Deploy as usual (`cpanel-post-deploy.sh` copies `robots.txt` and `sitemap.xml` to `public_html`).

## 1. Google Search Console (required for indexing)

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://www.ehealthaigh.com` (prefer **URL prefix** or **Domain** if you control DNS)
3. Verify ownership — **HTML tag** is already configured in the app (`EVGPzHgfdl7…`). After deploy, click **Verify** in Search Console.
   - Override via build env: `EXPO_PUBLIC_GOOGLE_SITE_VERIFICATION=your_code_here`
   - Or upload Google’s HTML file to `public_html/`
4. Submit sitemap: `https://www.ehealthaigh.com/sitemap.xml`
5. **URL inspection** → enter `https://www.ehealthaigh.com/` → **Request indexing**

Repeat for `https://ehealthaigh.com` (non-www) or add a **301 redirect** in `.htaccess` so only one canonical host is indexed.

## 2. Bing Webmaster Tools

1. [Bing Webmaster](https://www.bing.com/webmasters)
2. Add site, verify (meta tag via `EXPO_PUBLIC_BING_SITE_VERIFICATION` or file upload)
3. Submit the same sitemap URL

## 3. Canonical host (www vs non-www)

Pick one primary URL (recommended: **www**). In cPanel redirect:

```apache
RewriteCond %{HTTP_HOST} ^ehealthaigh\.com$ [NC]
RewriteRule ^ https://www.ehealthaigh.com%{REQUEST_URI} [L,R=301]
```

## 4. Ongoing SEO tips

- Keep **HTTPS** enforced (already in `public_html.htaccess`)
- Page speed: Lighthouse on mobile — compress images, keep API fast
- Add real **backlinks** (social, health directories, Ghana tech blogs)
- Publish blog/FAQ pages later for more keywords (optional future routes)
- Do **not** block `/` in `robots.txt` (admin and `/api/` stay disallowed)

## 5. Verify after deploy

```bash
curl -sI https://www.ehealthaigh.com/robots.txt
curl -s https://www.ehealthaigh.com/sitemap.xml
curl -s https://www.ehealthaigh.com/ | head -40
```

Check that `<title>`, `<meta name="description">`, and `application/ld+json` appear in the HTML source (View Source in browser — not only Inspect Element after React loads).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SITE_URL` | Canonical site URL for sitemap, OG, canonical link |
| `EXPO_PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console HTML meta verification |
| `EXPO_PUBLIC_BING_SITE_VERIFICATION` | Bing site verification meta |

Add these to GitHub Actions / cPanel build env for production web builds.
