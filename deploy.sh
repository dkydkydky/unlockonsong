#!/usr/bin/env bash
# Deploy the built static site to Zero CDN
# Usage: ./deploy.sh

set -euo pipefail

echo "Building..."
npm run build 2>/dev/null || (echo "Build failed"; exit 1)

echo "Zipping dist/..."
cd dist
zip -r ../dist.zip . -x "*.DS_Store"
cd ..

echo "Encoding to base64..."
BASE64=$(base64 -i dist.zip)

echo "Deploying via Zero CDN..."
RESULT=$(zero fetch --capability cdn-withzero-xyz-upload-files-or-static-sites-and-serve-them-from-a-a0d9f22f \
  --json \
  -d "{\"ext\":\"zip\",\"data\":\"${BASE64}\",\"kind\":\"site\",\"slug\":\"unlockonsong\"}" \
  --max-pay 0.50)

echo "$RESULT" | python3 -c "
import sys, json
r = json.load(sys.stdin)
if r.get('ok'):
    body = r.get('body', {})
    url = body.get('url', body.get('siteUrl', 'unknown'))
    print(f'\\nDeployed! Live at: {url}')
else:
    print(f'Deploy failed: {json.dumps(r)}')
"

rm -f dist.zip
