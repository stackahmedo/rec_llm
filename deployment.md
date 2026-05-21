# Deployment

VoiceLens is a single-page React app. There is no server component yet (API calls go directly from the browser to the chosen AI provider).

## Figma Make preview

The Vite dev server is already running in this environment. Use the in-app preview surface — `localhost` URLs are not reachable from your browser.

## Self-hosted (static)

```bash
pnpm install
pnpm build      # outputs dist/
```

Drop `dist/` behind any static host:

- **Vercel** — `vercel deploy --prod`
- **Netlify** — drag-drop `dist/` or `netlify deploy --prod --dir=dist`
- **Cloudflare Pages** — connect the repo, build command `pnpm build`, output dir `dist`
- **S3 + CloudFront** — `aws s3 sync dist/ s3://bucket --delete`
- **nginx** — copy `dist/` into `/var/www/voicelens`; serve with a SPA fallback (`try_files $uri /index.html`)

## Environment

No `.env` is required — keys are entered by the end user in Settings and stored in the browser's encrypted vault. If you want to ship default keys for a managed deployment, expose them as `VITE_*` variables and read them in `src/app/components/settings-panel.tsx`.

## CORS

Some providers (notably AssemblyAI's `/v2/upload`) refuse browser-origin requests. For production, proxy them through a tiny edge function:

- Cloudflare Worker
- Vercel Edge Function
- AWS Lambda + Function URL

Each only needs to forward the request and inject the API key server-side.

## Browser support

Latest Chrome, Edge, Firefox, Safari. The PDF editor requires `OffscreenCanvas` and `WebAssembly` (for OCR).
