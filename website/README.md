# slideotter website

Small Gustwind site for Cloudflare Workers.

## Commands

```bash
npm run website:dev
npm run website:check
npm run website:audit
npm run website:deploy
```

The Worker entry is `website/worker.ts`. It uses Gustwind's Cloudflare Worker adapter with the edge router and HTMLisp edge renderer.

Every response is finalized with the public-site CSP, framing, permissions, referrer, MIME-sniffing, and opener policies. HTTPS responses also receive a one-year HSTS policy; 4xx/5xx responses are `no-store`, and `HEAD` responses preserve GET metadata without a body. The CSP deliberately allows only the site's inline CSS, Google Fonts styles/fonts, and local or `data:` images beyond its default-deny policy.

`npm run website:audit` starts the Worker on `127.0.0.1:8798`, runs Lighthouse in mobile and desktop modes, and writes HTML/JSON reports under ignored `reports/lighthouse/`. The default floor is 90 for performance, accessibility, best practices, and SEO. External Google Fonts can add network variance, so this audit remains a focused manual check rather than part of the deterministic quality gate.
