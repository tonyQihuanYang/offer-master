# offer-demo — production deploy

Single-container Docker app that bundles the Vite frontend and the Express +
SSE backend behind one port. Reverse-proxied by Caddy on the shared EC2 host.

## What this deploys

- **Build**: multi-stage Dockerfile, Node 20 Alpine. Stage 1 runs `npm ci` and
  `vite build`; stage 2 keeps only production deps, `server/`, and the built
  `dist/`. Image is around 200 MB.
- **Run**: container listens on `3001` internally, host publishes `3007:3001`.
- **Routing**: Caddy block on the EC2 maps `offer.gummui.com` →
  `localhost:3007`. `flush_interval -1` is set so SSE events stream
  unbuffered.
- **State**: none. Admin saves to `demo/server/data/configs.json` inside the
  container — ephemeral; resets on container rebuild. That's intentional for
  the demo.

## URLs

- Public: <https://offer.gummui.com>
- Public admin: <https://offer.gummui.com/admin>
- Public client: <https://offer.gummui.com/client>
- Public approaches: <https://offer.gummui.com/approaches>
- API examples: `/api/approaches/citymeal`, `/api/stream?courierId=c123`

## First-time deploy

The DNS A record is managed in `gummui-infra/projects/offer-demo/`. Run
`terraform apply` there before the first SSH deploy.

## Re-deploy after a code change

```sh
# Local
git add -A
git commit -m "Your change"
git push origin main

# On the shared EC2 (54.251.138.201)
ssh -i ~/.ssh/shared-ec2-key ec2-user@54.251.138.201
cd /opt/apps/offer-demo
git pull
cd demo
docker compose up -d --build
docker compose logs --tail=50 offer-demo
```

Caddy needs no changes for code updates — the reverse-proxy target (port 3007)
stays the same.

## Health checks

```sh
# From the EC2
curl -sI http://localhost:3007/
curl -s http://localhost:3007/api/approaches/citymeal | head -c 200

# From anywhere
curl -sI https://offer.gummui.com/
curl -N https://offer.gummui.com/api/stream?courierId=c123  # SSE — Ctrl-C to stop
```

The SSE stream should emit `event: connected` immediately, then `: ping`
comments every 15s. If you see the pings buffered into a single chunk after
~30s, Caddy's `flush_interval -1` is not in effect — re-check the Caddyfile.

## Rollback

```sh
ssh -i ~/.ssh/shared-ec2-key ec2-user@54.251.138.201
cd /opt/apps/offer-demo
git log --oneline -10
git checkout <previous-sha>
cd demo
docker compose up -d --build
```

## Tear down

```sh
ssh -i ~/.ssh/shared-ec2-key ec2-user@54.251.138.201
cd /opt/apps/offer-demo/demo
docker compose down
docker rmi offer-demo:latest
# Optional: remove the Caddy block from /etc/caddy/Caddyfile, then
# sudo systemctl reload caddy
# Optional: rm -rf /opt/apps/offer-demo
```

Then `terraform destroy` in `gummui-infra/projects/offer-demo/` to remove the
DNS record.
