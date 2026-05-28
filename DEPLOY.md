# Deploy Unlock On Song via Zero

This guide walks through deploying the Unlock On Song app using Zero capabilities.

## Prerequisites

1. **Zero CLI installed:**
   ```bash
   command -v zero >/dev/null || npm i -g @zeroxyz/cli
   ```

2. **Wallet configured:**
   ```bash
   zero wallet balance
   zero wallet fund --no-open  # If needed
   ```

3. **Backend deployed** (e.g., Railway, Fly.io, or local)
   - Ensure `/api/analyze` and `/api/generate` endpoints are accessible
   - Update Vite proxy in `vite.config.ts` if backend URL changes

## Option 1: Deploy Frontend via CDN (Zero, $0/call)

Best for static Vite builds.

### Step 1: Build the frontend

```bash
npm run build
```

This creates `dist/` with the built app.

### Step 2: Create deployment zip

```bash
cd dist
zip -r ../unlock-on-song.zip .
cd ..
```

### Step 3: Upload to Zero CDN

```bash
zero search "cdn upload static site"
zero get 2 --formatted

# Then fetch:
zero fetch --capability cdn-withzero-xyz-upload-files-or-static-sites-and-serve-them-from-a-a0d9f22f \
  -d '{"kind":"zip","slug":"unlock-on-song","data":"'"$(base64 -i unlock-on-song.zip)"'"}'
```

The response includes a public CDN URL where your app is now live.

## Option 2: Deploy via Host Website (Zero, $0.02/call)

Best for quick hosting without building.

### Step 1: Generate deployment-ready HTML

```bash
zero fetch --capability zeroclick-x402-service-registry-host-website-30-days-f983b3a4 \
  -H "X-ZAM-Access-Key: zeroclick" \
  -d '{
    "title": "Unlock On Song",
    "slug": "unlock-on-song",
    "format": "html",
    "content": "<h1>Unlock On Song</h1><p><a href=\"http://localhost:5173\">Open App</a></p>",
    "wrapInTemplate": "true"
  }'
```

## Option 3: Deploy Backend + Frontend (Zerohost, $0.098/call)

Best for full-stack deployment.

### Step 1: Create zerohost.json

```json
{
  "name": "unlock-on-song",
  "runtime": "node",
  "entrypoint": "server.ts",
  "env": {
    "PORT": "3001"
  }
}
```

### Step 2: Package and deploy

```bash
zip -r zerohost-pkg.zip server.ts node_modules package.json zerohost.json
base64 -i zerohost-pkg.zip > zerohost-pkg.b64

zero search "zerohost deploy"
zero get 10 --formatted

zero fetch --capability zerohost-deploy-mint-disposable-https-backend-4ed7a9b1 \
  -d '{"zipBase64":"'"$(cat zerohost-pkg.b64)"'","ttlSeconds":86400}'
```

## Production Checklist

- [ ] Backend (`server.ts`) deployed and accessible
- [ ] Frontend built (`npm run build`)
- [ ] Environment variables set (ZERO_ANALYZE_CAPABILITY, ZERO_GENERATE_CAPABILITY)
- [ ] Wallet funded with USDC on Base (~$1+ for testing)
- [ ] SSL/TLS certificate active
- [ ] CORS headers configured for cross-origin API calls
- [ ] Camera permissions requestable in production (https-only)

## Monitoring

After deployment:

1. **Check health:**
   ```bash
   curl https://your-deployed-url/api/health
   ```

2. **Review Zero runs:**
   ```bash
   zero runs --unreviewed
   zero review <runId> --accuracy 5 --value 5 --reliability 5
   ```

## Rollback

If deployment fails, revert to last commit:

```bash
git revert HEAD
git push origin main
```

Then redeploy.

## Support

- Zero docs: https://zero.xyz/docs
- SKILL guide: https://zero.xyz/SKILL.md
- Report issues: https://github.com/dkydkydky/unlockonsong/issues
