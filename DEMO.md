# Demo — Run, Inspect, Tear Down

> Two ways to run the demo, plus how to clean everything up when the interview is done.
>
> Technical re-deploy details (Dockerfile, Caddy config, EC2 paths): see [`demo/DEPLOY.md`](./demo/DEPLOY.md).
> What each page actually does and what to click during a walkthrough: see [`demo/DEMO-SCRIPT.md`](./demo/DEMO-SCRIPT.md).

---

## ▶️ Live deployment

| URL | What it shows |
|---|---|
| <https://offer.gummui.com> | Landing |
| <https://offer.gummui.com/admin> | Admin: change the layout, hit **Save**, watch the green toast |
| <https://offer.gummui.com/client> | Courier phone view — offers are pushed via SSE |
| <https://offer.gummui.com/approaches> | Side-by-side A vs B vs C payloads on the wire |

**API endpoints worth knowing:**
```
GET  /api/tenants                    → ["PL","UK","CA"]
GET  /api/approaches/PL              → full A/B/C payload for tenant PL
GET  /api/stream?courierId=c123      → SSE stream of pushed offers
```

The live URL is served from the shared gummui EC2 (`54.251.138.201`), behind Caddy with auto-HTTPS via Let's Encrypt. It's a single container, ~15 MB RSS.

---

## 🖥️ Run locally

```sh
cd demo
npm install
npm run dev
```

Two dev servers start (Vite frontend + Express backend with hot reload):

| Local URL | What it is |
|---|---|
| <http://localhost:5173/admin> | Admin |
| <http://localhost:5173/client> | Client |
| <http://localhost:5173/approaches> | A/B/C inspector |
| <http://localhost:3001/api/...> | Backend API (Vite proxies `/api` here) |

Stop with `Ctrl-C`.

To test the **production** build (single port, like the live deploy):

```sh
cd demo
docker build -t offer-demo:test .
docker run --rm -p 3007:3001 offer-demo:test
# → http://localhost:3007 serves both frontend and API
```

---

## 🔁 Re-deploy after a code change

```sh
# Local
git add -A
git commit -m "Your change"
git push origin main

# On the shared EC2
ssh -i ~/.ssh/shared-ec2-key ec2-user@54.251.138.201
cd /opt/apps/offer-demo
git pull
cd demo
docker compose up -d --build
docker compose logs --tail=50 offer-demo
```

Caddy doesn't need to be touched — the reverse-proxy target (port 3007) is stable.

---

## 🗑️ Tear down (delete everything after the interview)

Run these in order — each step is reversible until the last one.

### 1. Stop the container & remove the image

```sh
ssh -i ~/.ssh/shared-ec2-key ec2-user@54.251.138.201

cd /opt/apps/offer-demo/demo
docker compose down                      # stops + removes the container
docker rmi offer-demo:latest 2>/dev/null # remove the image (frees ~200 MB)
```

At this point `https://offer.gummui.com` returns a Caddy 502 (the upstream is gone). Other apps on the host are unaffected.

### 2. Remove the source on the EC2

```sh
# still on the EC2
rm -rf /opt/apps/offer-demo
```

### 3. Remove the Caddy block

A timestamped backup of the original `Caddyfile` exists at `/etc/caddy/Caddyfile.bak.<timestamp>` from when the agent added our block. Two options:

**Option A — surgical (recommended):** edit the file and delete just our block.

```sh
sudo nano /etc/caddy/Caddyfile
# Delete the lines:
#   # === offer-demo ===
#   offer.gummui.com {
#     reverse_proxy localhost:3007 {
#       flush_interval -1
#     }
#   }

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Option B — restore from backup:**

```sh
# list backups
ls /etc/caddy/Caddyfile.bak.*

# restore the most recent (verify the filename first)
sudo cp /etc/caddy/Caddyfile.bak.<timestamp> /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

After reload, `https://offer.gummui.com` will fail TLS handshake — Caddy no longer knows about that name.

### 4. Remove the DNS A record (Terraform)

```sh
# back on your local machine
cd /Users/tony/Documents/git-gummui/gummui-infra/projects/offer-demo
terraform destroy
# Type "yes" to confirm. Removes the offer.gummui.com A record from Route 53.
```

### 5. Optional: remove the local Terraform files

```sh
cd /Users/tony/Documents/git-gummui/gummui-infra/projects
rm -rf offer-demo/
```

This also removes the cached `.terraform/` plugin lock. The remote state at `s3://burn1000-tfstate/offer-demo/terraform.tfstate` is empty after the destroy, so it's safe to leave or delete from the AWS console.

### 6. Optional: make the repo private again

```sh
gh repo edit tonyQihuanYang/offer-master --visibility private --accept-visibility-change-consequences
```

---

## 🔍 Sanity-check while it's live

From your local machine:

```sh
curl -sI https://offer.gummui.com/
# expect: HTTP/2 200, via: 1.1 Caddy, valid cert

curl -sN https://offer.gummui.com/api/stream?courierId=c123 | head -3
# expect: event: connected
#         data: ...

curl -s https://offer.gummui.com/api/approaches/CH | head -c 200
# expect: full JSON
```

On the EC2:

```sh
docker compose -f /opt/apps/offer-demo/demo/docker-compose.yml ps
# expect: offer-demo  Up ...  0.0.0.0:3007->3001/tcp

docker compose -f /opt/apps/offer-demo/demo/docker-compose.yml logs --tail=20
free -h     # memory pressure
df -h /     # disk pressure
```

---

## 📦 What's where

| Path | Purpose |
|---|---|
| `demo/` (this repo) | App source — React + Express + SSE |
| `demo/Dockerfile` | Multi-stage build (vite build → node runtime) |
| `demo/docker-compose.yml` | Single-service, port 3007:3001 |
| `demo/DEPLOY.md` | Re-deploy + Dockerfile details |
| `demo/DEMO-SCRIPT.md` | What to click during a 2-minute walkthrough |
| `demo/README.md` | Architecture + features of the demo itself |
| `gummui-infra/projects/offer-demo/` | Terraform: the `offer.gummui.com` A record |
| EC2 `/opt/apps/offer-demo/` | Cloned repo on the host |
| EC2 `/etc/caddy/Caddyfile` | Reverse proxy config (our block at the end) |
