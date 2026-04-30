# slideotter website

Small Gustwind site for Cloudflare Workers.

## Commands

```bash
npm run website:dev
npm run website:check
npm run website:deploy
```

The Worker entry is `website/worker.ts`. It uses Gustwind's Cloudflare Worker adapter with the edge router and HTMLisp edge renderer.
