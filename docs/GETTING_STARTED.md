# Getting Started

This guide covers the tools you need installed and the shortest path to running slideotter locally.

## Hard Dependencies

Install these before working with the project:

- Node.js 24 and npm
- Playwright Chromium browser dependencies

The project also uses npm packages with native binaries, including `sharp`, `@napi-rs/canvas`, and Playwright. `npm install` installs the JavaScript dependencies, including the WebAssembly Graphviz renderer used for DOT diagrams, but Playwright may still need its browser runtime installed for your machine.

## Install Node

Use `nvm` from the repository root so the project reads `.nvmrc` and selects the Node 24 baseline:

```bash
nvm install
nvm use
```

Check the tools:

```bash
node --version
npm --version
```

The package engine is pinned to Node 24 (`>=24 <25`), and `.npmrc` enables `engine-strict=true` so npm fails early on the wrong major version. Other version managers can use the same major version, but local development and CI should treat Node 24 as the baseline.

## Install Project Dependencies

From the repository root:

```bash
npm install
```

This also configures the repo-managed Git hooks in `.githooks/`.

Install the Playwright browser runtime:

```bash
npx playwright install chromium
```

On Linux, include the browser system dependencies:

```bash
npx playwright install --with-deps chromium
```

## Run The App

The local app command stores mutable data under `~/.slideotter` by default:

```bash
npx slideotter init --template tutorial
npx slideotter studio
```

Open:

```text
http://127.0.0.1:4173
```

Use `--data-dir /path/to/data` or `SLIDEOTTER_HOME=/path/to/data` for an alternate data root.

## Run The Repo Server

Use source mode when you are developing the repository fixtures, checked-in baselines, or command wrappers:

```bash
npm run studio:start
```

Open:

```text
http://127.0.0.1:4173
```

The standalone deck preview is available while the studio server is running:

```text
http://127.0.0.1:4173/deck-preview
```

## Common Commands

Build the active presentation PDF:

```bash
npx slideotter build
```

Run fast validation against the active app presentation:

```bash
npx slideotter validate --fast
```

Package and smoke-test the installed command:

```bash
npm run package:smoke
```

Repo development commands:

```bash
npm run build
```

Run the fast deterministic quality gate:

```bash
npm run quality:gate:fast
```

Run the full quality gate, including render-baseline validation:

```bash
npm run quality:gate
```

Refresh the approved render baseline after an intentional visual change:

```bash
npm run baseline:render
```

Update the checked-in archive PDF for the active presentation:

```bash
npm run archive:update
```

Refresh the README screenshot:

```bash
npm run screenshot:home
```

## Cloud Worker Target

The Cloudflare target is an implemented hosted baseline for API and storage work. It is not yet a full hosted replacement for the local Studio: the cloud Worker serves the built browser client, exposes `/api/cloud/*` resources, stores cloud presentation metadata in D1, stores presentation documents and artifacts in R2, can enqueue placeholder job records, and can run a Browser Rendering proof against a cloud presentation.

Use these names unless you intentionally change the Worker code:

- Worker: `slideotter-cloud`
- D1 binding: `SLIDEOTTER_METADATA_DB`
- R2 binding: `SLIDEOTTER_OBJECT_BUCKET`
- Queue binding: `SLIDEOTTER_JOBS_QUEUE`
- Browser Rendering binding: `SLIDEOTTER_BROWSER`
- Write secret: `SLIDEOTTER_CLOUD_ADMIN_TOKEN`

### Local Verification

Install dependencies and verify the bundle before provisioning Cloudflare resources:

```bash
npm install
npm run cloud:check
```

Run the local cloud smoke validation with fake D1, R2, Queue, and Browser Rendering bindings. This exercises the implemented hosted API surface without touching Cloudflare:

```bash
npm run validate:cloud-smoke
```

For local Worker development, create `cloud/.dev.vars` with a non-production token:

```dotenv
SLIDEOTTER_CLOUD_ADMIN_TOKEN="dev-only-token"
```

Then start Wrangler:

```bash
npm run cloud:dev
```

Wrangler serves the Worker using `cloud/wrangler.toml`. The current checked-in config already declares Workers Static Assets and the Browser Rendering binding. Local development without real D1/R2 bindings can still serve health and API-root routes, but storage-backed endpoints need the bindings below.

### Provision Cloudflare Resources

Log in with Wrangler:

```bash
npx wrangler login
```

Create the D1 database:

```bash
npx wrangler d1 create slideotter-cloud-metadata
```

Copy the `database_id` from Wrangler's output. Add this block to `cloud/wrangler.toml`:

```toml
[[d1_databases]]
binding = "SLIDEOTTER_METADATA_DB"
database_name = "slideotter-cloud-metadata"
database_id = "<database_id from wrangler d1 create>"
```

Create the R2 bucket:

```bash
npx wrangler r2 bucket create slideotter-cloud-objects
```

Add this block to `cloud/wrangler.toml`:

```toml
[[r2_buckets]]
binding = "SLIDEOTTER_OBJECT_BUCKET"
bucket_name = "slideotter-cloud-objects"
```

Create the queue:

```bash
npx wrangler queues create slideotter-cloud-jobs
```

Add both producer and consumer bindings to `cloud/wrangler.toml` so the Worker can enqueue jobs and its `queue()` handler can process them:

```toml
[[queues.producers]]
binding = "SLIDEOTTER_JOBS_QUEUE"
queue = "slideotter-cloud-jobs"

[[queues.consumers]]
queue = "slideotter-cloud-jobs"
```

Keep the existing Browser Rendering config:

```toml
[browser]
binding = "SLIDEOTTER_BROWSER"
```

The Worker uses `nodejs_compat_v2` because Browser Rendering and `@cloudflare/puppeteer` need Node compatibility support. Keep these existing top-level settings:

```toml
compatibility_date = "2026-05-01"
compatibility_flags = [ "nodejs_compat_v2" ]
```

### Initialize D1

Apply the checked-in schema to the remote D1 database:

```bash
npx wrangler d1 execute slideotter-cloud-metadata --remote --file=cloud/schema.sql
```

Confirm the tables exist:

```bash
npx wrangler d1 execute slideotter-cloud-metadata --remote --command="SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
```

### Configure Write Auth

Generate a long random token and store it as a Worker secret. Do not put this value in `cloud/wrangler.toml`.

```bash
openssl rand -base64 32
npx wrangler secret put SLIDEOTTER_CLOUD_ADMIN_TOKEN --config cloud/wrangler.toml
```

Wrangler prompts for the token value. Store the same value in your password manager; clients must send it as:

```http
Authorization: Bearer <token>
```

### Deploy

Dry-run the production bundle:

```bash
npm run cloud:check
```

Deploy the Worker:

```bash
npm run cloud:client:build
npx wrangler deploy --config cloud/wrangler.toml
```

After deploy, set:

```bash
CLOUD_BASE_URL="https://slideotter-cloud.<your-subdomain>.workers.dev"
CLOUD_TOKEN="<the token stored in SLIDEOTTER_CLOUD_ADMIN_TOKEN>"
```

If you attach a custom route or domain, use that URL instead of the `workers.dev` URL.

### Smoke Test The Deployment

Check unauthenticated read routes:

```bash
curl -fsS "$CLOUD_BASE_URL/api/cloud/health"
curl -fsS "$CLOUD_BASE_URL/api/cloud/v1"
```

Create a workspace:

```bash
curl -fsS -X POST "$CLOUD_BASE_URL/api/cloud/v1/workspaces" \
  -H "authorization: Bearer $CLOUD_TOKEN" \
  -H "content-type: application/json" \
  --data '{"id":"demo","name":"Demo workspace"}'
```

Create a presentation:

```bash
curl -fsS -X POST "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations" \
  -H "authorization: Bearer $CLOUD_TOKEN" \
  -H "content-type: application/json" \
  --data '{
    "id": "demo-deck",
    "title": "Demo deck"
  }'
```

Create the first slide. New slides use `baseVersion: 0`:

```bash
curl -fsS -X PUT "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/slides/slide-1" \
  -H "authorization: Bearer $CLOUD_TOKEN" \
  -H "content-type: application/json" \
  --data '{
    "baseVersion": 0,
    "orderIndex": 0,
    "title": "Cloud baseline",
    "slideSpec": {
      "family": "cover",
      "title": "Cloud baseline",
      "subtitle": "Hosted storage smoke test"
    }
  }'
```

Read the presentation and slide:

```bash
curl -fsS "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations"
curl -fsS "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/slides"
curl -fsS "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/slides/slide-1"
```

Update the slide with optimistic concurrency. The newly created slide is now version `1`, so use `baseVersion: 1` for the first update:

```bash
curl -fsS -X PUT "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/slides/slide-1" \
  -H "authorization: Bearer $CLOUD_TOKEN" \
  -H "content-type: application/json" \
  --data '{
    "baseVersion": 1,
    "orderIndex": 0,
    "title": "Cloud baseline updated",
    "slideSpec": {
      "family": "cover",
      "title": "Cloud baseline updated",
      "subtitle": "Version checked write"
    }
  }'
```

Create source and material records:

```bash
curl -fsS -X POST "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/sources" \
  -H "authorization: Bearer $CLOUD_TOKEN" \
  -H "content-type: application/json" \
  --data '{"id":"source-1","title":"Launch notes","text":"Cloud deployment smoke source."}'

curl -fsS -X POST "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/materials" \
  -H "authorization: Bearer $CLOUD_TOKEN" \
  -H "content-type: application/json" \
  --data '{"id":"material-1","title":"Tiny PNG","fileName":"tiny.png","mediaType":"image/png","dataBase64":"iVBORw0KGgo="}'
```

Create a job record. Valid job kinds are `export`, `generation`, `import`, and `validation`. If `SLIDEOTTER_JOBS_QUEUE` is bound, the Worker also sends a queue message and the current queue consumer marks the job complete:

```bash
curl -fsS -X POST "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/jobs" \
  -H "authorization: Bearer $CLOUD_TOKEN" \
  -H "content-type: application/json" \
  --data '{"id":"job-1","kind":"export"}'

curl -fsS "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/jobs"
```

Export and import a presentation bundle:

```bash
curl -fsS "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/bundle"

curl -fsS -X POST "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentation-bundles" \
  -H "authorization: Bearer $CLOUD_TOKEN" \
  -H "content-type: application/json" \
  --data '{
    "presentationId": "demo-import",
    "bundle": {
      "bundleVersion": 1,
      "resource": "presentationBundle",
      "presentation": {
        "id": "demo-source",
        "title": "Imported demo",
        "latestVersion": 1
      },
      "slides": [
        {
          "metadata": {
            "id": "slide-1",
            "orderIndex": 0,
            "title": "Imported",
            "version": 1
          },
          "slideSpec": {
            "family": "cover",
            "title": "Imported",
            "subtitle": "Bundle import"
          }
        }
      ],
      "sources": [],
      "materials": []
    }
  }'
```

Run the Browser Rendering proof. This requires the `SLIDEOTTER_BROWSER` binding and stores a proof report in R2:

```bash
curl -fsS -X POST "$CLOUD_BASE_URL/api/cloud/v1/workspaces/demo/presentations/demo-deck/rendering-proof" \
  -H "authorization: Bearer $CLOUD_TOKEN"
```

### Current Limits

- The cloud target is not wired into the local Studio server; local repo mode and app mode still use filesystem-backed services.
- The Worker currently has bearer-token bootstrap auth, not production workspace membership or per-user authorization.
- The queue consumer marks jobs complete but does not yet run real generation, export, or validation jobs.
- The Browser Rendering route is a proof path that captures screenshot/PDF bytes and stores a report; it is not yet the production PDF export workflow.
- Durable Objects are not configured yet; optimistic D1/R2 writes are the current serialization model.

## Optional Tools

Docker is only needed if you want to run the GitHub Actions workflow locally through Agent CI:

```bash
npm run ci:local
```

An LLM provider is required for creating or regenerating presentations. Configure OpenAI, LM Studio, or OpenRouter before using those actions. See [DEVELOPMENT.md](../DEVELOPMENT.md) for provider setup.

Image search during new presentation setup is optional and uses public provider APIs. The built-in presets are Openverse for open-licensed images and Wikimedia Commons for commons-hosted media. Use the restrictions field for provider hints such as `license:cc0` or `source:flickr`; imported images are copied into the active presentation material library before generation uses them.

## Generated Files

- `~/.slideotter/presentations/<presentation-id>/` holds app-mode presentations.
- `~/.slideotter/output/<presentation-id>.pdf` is generated by `npx slideotter build`.
- `slides/output/<presentation-id>.pdf` is generated locally and ignored by Git.
- `studio/output/` holds local preview and validation artifacts.
- `studio/baseline/<presentation-id>/` stores checked-in render-baseline PNGs.
- `archive/<presentation-id>.pdf` stores checked-in archive snapshots.
