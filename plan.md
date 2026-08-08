# Expensify Production Deployment Learning Plan

This file is the working roadmap for turning Expensify from a locally run application into a production-shaped Kubernetes deployment. Work through it in order. Do not begin a stage until the previous stage's exit criteria pass.

The purpose is not only to make the application deployable. Each task should teach what changes at the architecture level, why the change is needed, how the code implements it, and how to verify it.

## How to use this plan

- Treat every unchecked checkbox as a separate piece of work.
- Copy the prompt under that task into a new development session.
- Before editing code, the implementer must explain the current behavior and proposed design.
- Keep each change small enough to review and test independently.
- Update this document after completing a task: check the box, add the pull request or commit, and record important decisions.
- Never combine an unrelated feature with deployment work just because the same file is open.
- Commands and manifests must not contain real secrets.

## Target outcome

```text
Internet
   |
DNS and HTTPS
   |
Ingress controller
   |-- /       -> frontend Service -> frontend Pods
   `-- /api    -> API Service      -> API Pods
                                      |
                    +-----------------+-----------------+
                    |                 |                 |
                    v                 v                 v
                PostgreSQL         Redis             S3/Groq
                                      ^
                                      |
                               Worker Deployments
                               - scheduled jobs
                               - OCR jobs
```

PostgreSQL and Redis will be self-hosted for learning. Their data must use persistent storage, and backups must leave the cluster/VMs. S3 and Groq remain external services.

## Stage 0: Confirm the infrastructure target

The intended target was cut off in the original request after “I want to deploy it on ...”. Do not create provider-specific cluster manifests or installation scripts until this is decided.

- [ ] **0.1 Record the target platform and topology**

Decide and record:

- Cloud/provider or local infrastructure.
- Self-managed Kubernetes (`kubeadm`, RKE2, etc.) or a managed Kubernetes service.
- Number and role of VMs: control-plane and worker nodes.
- VM operating system, CPU, memory, disk, region, and network layout.
- Storage implementation/StorageClass for persistent volumes.
- Container registry.
- Domain name and DNS provider.
- How external traffic reaches the cluster: cloud load balancer, reverse proxy, or public node IP.
- Where off-cluster PostgreSQL backups will be stored.

### Prompt 0.1

> Help me choose and document the Kubernetes infrastructure for Expensify. Do not modify application code yet. Inspect `plan.md` and the repository architecture. Ask only for information that cannot be discovered locally: provider, budget, domain, expected topology, and whether I want managed or self-managed Kubernetes. Compare the realistic options in simple language, including cost, operational work, failure behavior, persistent-storage support, and what I will learn. I do not want a single-node k3s deployment. Produce an architecture decision record with the chosen VM/node topology, networking, StorageClass, registry, DNS/TLS approach, backup destination, and explicit limitations. Update the Stage 0 decision section in `plan.md` after I choose.

### Stage 0 decision record

- Provider: **TBD**
- Kubernetes distribution/service: **TBD**
- Node topology: **TBD — explicitly not single-node k3s**
- StorageClass: **TBD**
- Registry: **TBD**
- Domain/DNS: **TBD**
- Backup destination: **TBD**

### Why this comes first

Storage, Ingress and load-balancer manifests depend on the provider and cluster design. For example, a cloud load balancer may be provisioned automatically in managed Kubernetes, while bare VMs may need MetalLB or an external reverse proxy. Choosing these details implicitly in a later task can lead to manifests that look correct but never receive traffic or cannot reattach data after a node failure.

### Stage 0 exit criteria

- The decision record contains no `TBD` values.
- The failure behavior of losing one worker node and one control-plane node is understood.
- The storage and backup designs are separate: persistent storage is not called a backup.

---

## Stage 1: Separate the API and background-worker processes

### Goal

Build one backend codebase into two independently runnable processes:

```text
API process
|-- controllers and HTTP server
|-- authentication
|-- business services
`-- queue producers

Worker process
|-- BullMQ consumers
|-- repeatable-job registration
|-- business services
`-- no public HTTP API
```

This must happen before horizontal scaling. Currently, every NestJS instance registers and runs all BullMQ workers. Scaling the API from one to five Pods would also scale every worker to five consumers, even if queue traffic did not increase.

- [ ] **1.1 Inventory modules and design the process boundary**

### Prompt 1.1

> Inspect the backend module graph and all files under `backend/src/queues`. Explain which providers are API-only, worker-only, and shared. Trace application startup from `main.ts` and `AppModule`, including every Redis connection and repeatable-job registration. Propose a concrete NestJS module structure for separate API and worker entry points. Identify circular-dependency risks and explain how queue producers can be available to HTTP services without starting queue consumers. Do not edit code in this task. Add a short design record to `plan.md`, including the selected file/module layout and test strategy.

Deliverables:

- A module dependency map.
- Proposed `main.ts` and `worker.ts` responsibilities.
- Proposed `ApiModule`, `WorkerModule`, and shared domain modules.
- Decision about whether repeatable-job registration lives in the worker process or a dedicated scheduler process.

- [ ] **1.2 Implement separate entry points**

### Prompt 1.2

> Implement the Stage 1 process split using the approved design in `plan.md`. The API entry point must start the HTTP server and queue producers but no BullMQ consumers or repeatable schedulers. The worker entry point must start a Nest application context without exposing a public HTTP server, start the selected BullMQ workers, and close gracefully. Keep shared business logic in reusable modules rather than duplicating it. Add package scripts for development, build, and production startup of both processes. Preserve current behavior. Before editing, explain the boot sequence; afterward, list the changed files and explain the new boot sequence. Add focused tests that prove starting the API does not construct workers and starting the worker does not bind an HTTP port.

Acceptance checks:

- Starting only the API creates no BullMQ `Worker` instances.
- Starting only the worker binds no public HTTP port.
- Both processes can use shared services without duplicated implementations.
- Existing API behavior and scheduled jobs still work.
- Backend build and tests pass.

### Tradeoff

There are now two processes to deploy and monitor instead of one. That is extra configuration, but it gives independent scaling and fault isolation. A real-world example: ten users uploading receipts may require more OCR workers, while normal API traffic remains low. Coupling both would waste API Pods or overload them.

### Stage 1 exit criteria

- API and worker can be built and started separately.
- No HTTP request is required to wake a worker.
- API replica count can change without changing worker concurrency.

---

## Stage 2: Make the application safe to operate

Stage 2 is intentionally split into related groups. Each group should be a separate reviewable change.

### 2A: Runtime configuration, validation and graceful lifecycle

- [ ] **2A.1 Add typed environment validation**

### Prompt 2A.1

> Add centralized, typed startup validation for all backend environment variables used by the API and worker processes. Classify variables as shared, API-only, worker-only, secret, optional, and production-required. Fail startup with a useful message when required configuration is absent or invalid, but never print secret values. Include `PORT`, `HOST`, `NODE_ENV`, database pool settings, Redis settings, URLs, OAuth, JWT, AWS/S3, Groq, cron expressions, timezone, Bull Board settings, and proxy settings. Remove unsafe localhost fallbacks in production while preserving convenient development defaults. Update `.env.example` with documentation and non-secret placeholders. Add tests for valid and invalid configurations.

Why:

Without validation, a Pod can appear to start and fail only when a user reaches a rarely used feature. For example, a missing S3 bucket may remain unnoticed until the first receipt upload.

- [ ] **2A.2 Add graceful shutdown and configurable network binding**

### Prompt 2A.2

> Update both backend entry points to handle Kubernetes termination correctly. The API must read `HOST` and `PORT`, listen on `0.0.0.0` in containers, enable Nest shutdown hooks, stop accepting traffic, drain active requests/SSE connections within a documented grace period, and close PostgreSQL and Redis resources. The worker must stop accepting new jobs, finish or safely return active jobs according to BullMQ behavior, and close all workers, queues, and connections. Explain the SIGTERM sequence and align it with a proposed Kubernetes `terminationGracePeriodSeconds`. Add automated tests where practical and document a manual termination test.

Why:

During a rolling deployment Kubernetes sends SIGTERM before killing a Pod. Without graceful shutdown, an expense request can be interrupted after charging external services but before saving data, or an active job can be abandoned halfway through.

### 2B: Health endpoints and dependency semantics

- [ ] **2B.1 Add liveness, readiness and worker-health design**

### Prompt 2B.1

> Add health reporting suitable for Kubernetes. Implement `/health/live` to answer whether the API event loop/process is alive without calling PostgreSQL, Redis, S3, or Groq. Implement `/health/ready` to report whether the API is ready to receive traffic, using fast bounded checks for only critical request-path dependencies. Design worker health reporting without exposing a public admin endpoint; choose a process/heartbeat or internal HTTP approach and document it. Return stable status codes and avoid leaking connection strings or internal error details. Add tests and provide the exact startup, readiness, and liveness probe settings that Stage 5 should use.

Why:

- Liveness answers: “Should Kubernetes restart this container?”
- Readiness answers: “Should Kubernetes send user traffic here?”
- If liveness depends on PostgreSQL, a database outage may restart every API Pod repeatedly and make recovery harder.

### 2C: PostgreSQL and Redis connection safety

- [ ] **2C.1 Configure PostgreSQL pooling explicitly**

### Prompt 2C.1

> Add explicit PostgreSQL pool configuration to `DrizzleService`: maximum/minimum connections where supported, idle timeout, connection timeout, statement/query timeout if appropriate, application name, and safe shutdown. Explain how to calculate the pool maximum from PostgreSQL's connection budget, number of API replicas, number of worker replicas, migration jobs, and an administrative reserve. Add observability for pool exhaustion without logging SQL parameters or secrets. Add configuration documentation and tests.

Example capacity model:

```text
usable DB connections
>= API replicas * API pool max
 + worker replicas * worker pool max
 + migration/maintenance reserve
```

Without a budget, scaling from two to ten Pods can make every Pod healthy at the process level while PostgreSQL rejects all new connections.

- [ ] **2C.2 Standardize Redis connections and timeouts**

### Prompt 2C.2

> Inventory every Redis client, duplicate connection, queue and worker. Create shared connection configuration with TLS/auth support, connection names, bounded retry behavior appropriate to API versus workers, and graceful shutdown. Explain which BullMQ connections must remain separate and which configuration can be shared. Ensure an unavailable Redis instance does not cause infinite hanging HTTP requests. Add tests for startup and failure behavior.

### 2D: Queue correctness and delivery guarantees

- [ ] **2D.1 Make jobs retry-safe and idempotent**

### Prompt 2D.1

> Audit every BullMQ job and producer. Document its side effects, retry policy, timeout, backoff, concurrency, deduplication key, and idempotency strategy. Assume delivery is at least once: a worker can complete a side effect and crash before acknowledging the job. Modify jobs so retries cannot create duplicate notifications, insights, badges, recurring expenses, or other permanent records. Prefer database unique constraints/transactions and deterministic job IDs over in-memory flags. Configure attempts, exponential backoff with jitter where supported, retention, stalled-job behavior, and dead-letter/manual-recovery visibility. Add tests that execute important handlers twice and verify one logical result.

Real-world failure solved:

```text
Worker inserts notification
        |
        `-- crashes before BullMQ marks job complete
                    |
                    `-- job retries and inserts a duplicate
```

Idempotency makes the second execution safe.

- [ ] **2D.2 Secure or disable Bull Board**

### Prompt 2D.2

> Audit the Bull Board route and assume queue payloads, job failures, and retry controls are sensitive. In production, either disable Bull Board by default or expose it only through a separately authenticated internal/admin path with strong authorization. Do not rely on an obscure URL. Document the chosen access method, network restrictions, CSRF considerations for destructive actions, and audit logging. Add tests proving an unauthenticated production request cannot view or mutate queues.

Without this change, someone who discovers `/admin/queues` may read job data or retry/remove operational jobs.

### 2E: Upload and OCR architecture

- [ ] **2E.1 Replace proxy uploads with presigned direct-to-S3 uploads**

### Prompt 2E.1

> Design and implement direct browser-to-S3 uploads for receipts and attachments. The API should authorize the user, validate intended filename/type/size, generate a short-lived presigned upload, and later verify/finalize metadata ownership. Use unpredictable object keys, private objects, content-type and size restrictions where the signing method supports them, expiration, and cleanup for abandoned uploads. Do not expose AWS credentials to the browser. Preserve signed downloads. Update the frontend flow and add tests for ownership, unsupported files, oversized files, expired/reused requests, and metadata finalization. Explain the old and new data paths before editing.

Old path:

```text
Browser -> API memory -> S3
```

New path:

```text
Browser -> S3
Browser -> API with verified object key
```

The new path prevents a 10 MB file from consuming 10 MB or more in every API Pod and removes the API as a bandwidth bottleneck.

- [ ] **2E.2 Move OCR into a dedicated queue and worker**

### Prompt 2E.2

> Refactor receipt OCR from synchronous HTTP execution into a dedicated BullMQ queue and independently deployable OCR worker. Today `POST /expenses/ocr` stores the whole file in memory, creates a Tesseract worker, and blocks the request. Design an asynchronous contract: upload/finalize receipt, enqueue an idempotent OCR job, return `202 Accepted` with a job/resource ID, persist status (`queued`, `processing`, `completed`, `failed`), expose an authorized status/result endpoint, and update the frontend to poll or consume an event. The OCR worker should fetch the private S3 object, enforce size/type limits, reuse or safely manage OCR resources, set concurrency, timeout and retries, and clean temporary resources. Separate the OCR worker deployment from lightweight scheduled workers so it can receive different CPU/memory limits. Add tests for duplicate jobs, retries, failure status and authorization.

Why OCR needs separation:

- Tesseract is CPU- and memory-heavy compared with a normal database request.
- A slow receipt can make an API Pod unresponsive to unrelated users.
- Kubernetes CPU limits protect other Pods, but throttling synchronous OCR would make the HTTP request even slower.
- A queue absorbs bursts: 100 uploads can wait safely while a controlled number of OCR jobs run.

### 2F: Proxy, CORS, cookies, throttling and frontend URL

- [ ] **2F.1 Make reverse-proxy and authentication behavior production-safe**

### Prompt 2F.1

> Configure Nest/Express proxy trust explicitly for the selected Ingress topology. Trace how client IP, protocol, secure cookies, OAuth callback URLs, CORS, and throttling behave from browser through Ingress to the API. Prefer serving frontend and API under one site/domain when compatible with the Stage 0 decision. Do not blindly trust every proxy hop. Add production cookie settings and tests for HTTPS forwarding, allowed origins, refresh cookies, and spoofed forwarding headers. Document the exact Ingress headers the application relies upon.

- [ ] **2F.2 Replace per-Pod throttling with distributed throttling**

### Prompt 2F.2

> Replace or extend the current in-memory Nest throttling with a Redis-backed distributed store. Define separate policies for authentication, expensive AI/OCR initiation, writes, reads, and health checks. Determine the rate-limit key using authenticated user ID where available and correctly resolved client IP otherwise. Decide fail-open versus fail-closed behavior for each class when Redis is unavailable. Return standard rate-limit responses/headers and add tests across two simulated API instances.

Without a distributed store, a user can receive a different counter on each Pod. With five Pods, a “20 request” limit may effectively allow around 100 requests.

- [ ] **2F.3 Make frontend runtime/build configuration explicit**

### Prompt 2F.3

> Remove the production fallback to `http://localhost:4000` from `frontend/lib/config.ts`. Decide whether the browser should use a same-origin relative `/api` URL or an explicitly injected public URL. Explain that `NEXT_PUBLIC_*` values are normally embedded in the client bundle at build time and are not secrets. Ensure local development remains convenient, production fails visibly if misconfigured, OAuth and SSE URLs remain correct, and one immutable frontend image can be promoted between environments if the selected design permits it. Add tests or build-time validation and document the deployment contract.

### Stage 2 exit criteria

- Both processes shut down cleanly on SIGTERM.
- Health behavior is tested and documented.
- Environment validation fails fast without exposing secrets.
- Connection budgets and timeouts are explicit.
- Jobs are safe to retry.
- Bull Board is inaccessible anonymously in production.
- Large files no longer pass through API memory.
- OCR runs asynchronously in a resource-isolated worker.
- Rate limiting is consistent across API replicas.
- Production frontend configuration cannot silently point to localhost.

---

## Stage 3: Build secure, reproducible container images

### Goal

Use multi-stage builds:

```text
Dependencies stage -> install exact locked dependencies
Build stage        -> compile NestJS or Next.js
Runtime stage      -> copy only required production output
```

- [ ] **3.1 Design image and monorepo build strategy**

### Prompt 3.1

> Inspect the pnpm workspace, lockfiles, Nest build output, Next.js runtime requirements, OCR/Tesseract runtime assets, and separate backend entry points. Propose the Docker build contexts and image strategy. Decide whether API and worker use the same immutable backend image with different commands or separate images. Prefer one backend image when their dependency sets are the same. For Next.js, evaluate standalone output. Explain caching behavior, build context size, native/system dependencies, and how OCR affects the worker image. Do not implement until the design and tradeoffs are recorded in `plan.md`.

- [ ] **3.2 Implement production Dockerfiles and ignore rules**

### Prompt 3.2

> Implement production multi-stage Dockerfiles for frontend and backend from the approved design. Install dependencies with the repository's package manager and frozen lockfile, compile in a builder stage, and copy only necessary production artifacts into minimal runtime stages. Run as a numeric non-root user, define explicit start commands, support API and worker commands, avoid copying `.env`, and add appropriate `.dockerignore` files. Pin the Node major version and base image variant. Do not place credentials in build arguments or image layers. Add image metadata labels and document any writable directories required by Node, Next.js, Tesseract or temporary processing.

- [ ] **3.3 Verify and harden images**

### Prompt 3.3

> Build the images from a clean checkout, run API/frontend/worker smoke tests, inspect image history for secrets, report image sizes, run a vulnerability scan with the chosen CI scanner, and verify the runtime containers are non-root. Test read-only root filesystems where practical and use a bounded writable temporary directory for OCR. Generate an SBOM if the selected registry/CI tooling supports it. Record commands and expected results in deployment documentation.

### Container rules and their tradeoffs

| Rule | Why follow it | What can happen if skipped | Tradeoff |
|---|---|---|---|
| Frozen lockfile | The same commit installs the same dependency graph | A deployment unexpectedly installs a newer broken/transitive package | Dependency upgrades must be deliberate |
| Multi-stage build | Build tools and source do not inflate the runtime image | Larger downloads, slower rollout and a larger attack surface | Dockerfile is more complex |
| Non-root user | A compromised process has fewer OS privileges | An attacker may modify more of the container or exploit mounted paths | Writable paths and file ownership need planning |
| No `.env` in image | Secrets stay outside image history and registries | Anyone who can pull the image can recover production credentials | Runtime secret injection is required |
| Immutable Git-SHA/digest | The deployed artifact can be identified and rolled back exactly | `latest` may point to different code on different nodes | CI must publish and update versions |
| Minimal runtime contents | Faster pulls and fewer vulnerable packages | Compilers/package managers in production give attackers extra tools | Debugging inside a container is less convenient |
| Pinned base version | Builds do not change unexpectedly overnight | A rebuild can silently introduce incompatibility | Security updates require an intentional rebuild process |
| Image scanning/SBOM | Known vulnerable packages are visible before release | A known critical vulnerability may reach production unnoticed | Scanners need policy and can report false positives |

### Real-world immutable-image example

If `latest` is rebuilt between two node pulls, Pod A can run old code and Pod B new code even though their Kubernetes specs look identical. A digest such as `image@sha256:...` always means one exact artifact.

### Stage 3 exit criteria

- Clean builds use locked dependencies.
- API and worker start from immutable backend artifacts.
- Containers run as non-root.
- Images contain no `.env` or credentials.
- Image sizes, vulnerabilities and required writable paths are documented.

---

## Stage 4: Self-host PostgreSQL and Redis on the Kubernetes VMs

This is the learning option. It teaches stateful operations, but it also makes the team responsible for durability, upgrades, backups and recovery.

### 4A: Persistent-storage design

- [ ] **4A.1 Prove storage behavior before installing databases**

### Prompt 4A.1

> Using the completed Stage 0 architecture, design persistent storage for PostgreSQL and Redis. Explain what happens to a volume when a Pod restarts, moves to another worker VM, its VM is destroyed, and the entire cluster is lost. Select a StorageClass and volume binding/reclaim policy intentionally. Include disk encryption, capacity expansion, snapshots, node/zone affinity, IOPS, monitoring, and failure limitations. Run a disposable persistence test before installing either database. Do not call replication or a snapshot a backup unless restoration from a separate failure domain is demonstrated.

### 4B: PostgreSQL

- [ ] **4B.1 Deploy PostgreSQL safely for the selected learning topology**

### Prompt 4B.1

> Deploy a pinned PostgreSQL version using a maintained Helm chart or operator selected in Stage 0; do not hand-roll production database behavior without explaining why. Configure a PVC, resource requests/limits, readiness/startup checks, authentication from Kubernetes Secrets, internal-only networking, database/user initialization, connection limits consistent with Stage 2, and controlled version upgrades. Do not publish PostgreSQL through public NodePort or Ingress. Explain StatefulSet/operator identity, services, DNS, storage and termination behavior. Verify the API can connect using an internal service name.

- [ ] **4B.2 Implement off-cluster backup and restore testing**

### Prompt 4B.2

> Implement scheduled PostgreSQL backups to the external destination selected in Stage 0. Encrypt backups, use least-privilege credentials, define retention, record recovery point objective and recovery time objective, alert on backup failures, and prevent overlapping jobs. Include logical backups and evaluate physical/WAL-based recovery according to the chosen operator and learning goals. Most importantly, perform and document a restore into a separate database/namespace and verify representative Expensify records. A backup task is incomplete until restore succeeds.

Why:

A PVC survives a Pod restart, but it may not survive accidental deletion, storage corruption, stolen credentials, provider failure, or loss of all VMs. Off-cluster backups create another recovery path.

### 4C: Redis for BullMQ

- [ ] **4C.1 Deploy Redis with BullMQ-appropriate persistence**

### Prompt 4C.1

> Deploy a pinned Redis version internally for BullMQ, distributed throttling and dashboard pub/sub. Configure authentication, a PVC, AOF persistence, resource requests/limits, probes, internal-only networking, and a `maxmemory`/eviction policy appropriate for queues (do not silently evict BullMQ keys). Explain which Redis data must survive restart, which pub/sub events may be transient, and what happens to queued/running jobs during failure. Test Redis Pod restart while jobs are queued and while a worker is processing. Document whether the selected topology is single-instance, replicated or sentinel/cluster based and its real failure guarantees.

Tradeoff:

Redis persistence adds disk I/O and may reduce throughput, but losing queue state can lose scheduled or pending work. Pub/sub messages themselves are transient, so browser clients must reconnect and refresh authoritative dashboard state.

### Stage 4 exit criteria

- Databases are reachable only inside the cluster or approved administration paths.
- Data survives Pod restart and the documented node-failure case.
- PostgreSQL restore has been tested, not merely scheduled.
- Redis restart behavior with BullMQ has been tested.
- Capacity and disk alerts exist.

---

## Stage 5: Deploy application workloads with Kubernetes best practices

### 5A: Namespaces, configuration and secrets

- [ ] **5A.1 Establish environment and secret structure**

### Prompt 5A.1

> Create the Kubernetes namespace and configuration structure for Expensify. Separate non-secret ConfigMaps from Secrets, map every validated Stage 2 variable to its owner process, and ensure containers receive only secrets they require. Choose a secret-management workflow compatible with Stage 0, such as SOPS/age, Sealed Secrets, or an external secret store; never commit plaintext or merely base64-encoded production secrets. Add least-privilege ServiceAccounts and RBAC. Document secret creation, rotation and emergency revocation for JWT, Google, Groq, S3, PostgreSQL and Redis credentials.

### 5B: API, scheduled worker and OCR worker Deployments

- [ ] **5B.1 Deploy API and workers independently**

### Prompt 5B.1

> Create Kubernetes Deployments and Services for the API, lightweight/scheduled worker, OCR worker, and frontend. Use immutable image references, labels, selectors, rolling-update settings, validated environment injection, security contexts, graceful termination, topology spreading/anti-affinity appropriate to the Stage 0 node count, and the probes designed in Stage 2. Only HTTP-serving workloads get Services. Start with conservative replica counts and document how each workload is scaled. Add a PodDisruptionBudget only where replica count makes it meaningful.

### OCR-specific resource design

- [ ] **5B.2 Load-test and tune OCR separately**

### Prompt 5B.2

> Benchmark the OCR worker with small, normal and worst-allowed receipt images/PDFs. Measure CPU time, peak memory, temporary disk, Tesseract initialization cost, Groq latency and total job duration. Use the measurements to select Kubernetes requests, limits, ephemeral-storage limits, BullMQ concurrency and timeouts. Explain CPU throttling versus memory OOMKill behavior. Test a burst of jobs and confirm normal API latency remains stable. Define autoscaling based on queue depth with KEDA only if justified; otherwise document a safe manual scaling procedure.

Why requests/limits matter especially for OCR:

- CPU requests reserve scheduling capacity; without them, OCR may compete unpredictably with the API.
- CPU limits can throttle OCR, making jobs slower but usually recoverable.
- Memory limits prevent one receipt from consuming the node; exceeding them causes OOMKill, so job retry/idempotency must work.
- Separate Pods let Kubernetes place and scale compute-heavy work independently.

### 5C: Networking, DNS, HTTPS and Ingress

- [ ] **5C.1 Expose only the web entry points**

### Prompt 5C.1

> Install/configure the Ingress controller selected in Stage 0 and create Ingress resources for frontend and API. Configure DNS, trusted proxy hops, request-size policy consistent with direct S3 uploads, SSE timeouts/stream buffering, security headers, and HTTP-to-HTTPS redirect. Automate TLS certificates with the chosen issuer and test renewal. Keep PostgreSQL, Redis, worker health and Bull Board off the public Internet. Explain the complete packet path from browser DNS lookup to Pod and the reverse response path.

### 5D: Resource, scheduling and security policy

- [ ] **5D.1 Apply workload hardening**

### Prompt 5D.1

> Add measured CPU, memory and ephemeral-storage requests/limits; non-root security contexts; seccomp RuntimeDefault; dropped capabilities; read-only root filesystems where tested; bounded `/tmp`; NetworkPolicies; image pull policy consistent with immutable tags; and namespace-level security controls. Explain every exception required by Next.js, Node, Tesseract, PostgreSQL or Redis. Test that the API can reach only required services and that frontend Pods cannot connect directly to databases.

Tradeoff:

Strict policies require more initial debugging, but they reduce blast radius. For example, if the frontend is compromised, a NetworkPolicy can prevent direct access to PostgreSQL even if an attacker scans internal DNS.

### 5E: Logs, metrics, alerts and uptime

- [ ] **5E.1 Add structured application logging**

### Prompt 5E.1

> Implement structured JSON logs to stdout/stderr with timestamp, level, service/process name, environment, version/commit, request or correlation ID, route, status, latency, queue/job ID, and safe error context. Redact authorization headers, cookies, JWTs, database URLs, S3 signatures, Groq keys, file contents and personal financial data. Propagate a correlation ID from HTTP request to queued job. Explain why container files are not durable logs.

- [ ] **5E.2 Deploy cluster observability and alerts**

### Prompt 5E.2

> Deploy or configure a VM-sized observability stack compatible with Stage 0. Collect container logs centrally; expose/scrape metrics for API request rate/errors/latency, Node event-loop behavior, PostgreSQL connections/storage, Redis memory/evictions, BullMQ queue depth/age/failures, OCR duration/OOMs, Pod restarts, node health, certificate expiry and backup results. Add an external uptime check against a user-representative endpoint, not just `/health/live`. Create a small alert set with actionable thresholds and runbooks. Control retention so logs cannot fill the VM disks.

Why external uptime monitoring matters:

An in-cluster monitor may report everything healthy while DNS, the public IP, Ingress or TLS is broken for all users. An external check sees the service from the user's side.

### Stage 5 exit criteria

- Public HTTPS reaches frontend and API through Ingress.
- PostgreSQL, Redis, workers and admin tools are not public.
- API and workers roll without abruptly abandoning requests/jobs.
- OCR load cannot starve the API under the tested workload.
- Secrets are absent from Git, images and logs.
- Logs, metrics, backup alerts and external uptime checks work.

---

## Stage 6: Release flow, migrations and CI/CD

### Required release sequence

```text
Test source
    |
Build image once
    |
Scan and push immutable image
    |
Run Kubernetes migration Job using that image
    |
Migration succeeds? -- no --> stop release; keep old app running
    |
   yes
    |
Roll out API and worker Deployments
    |
Wait for readiness and run smoke tests
    |
Success? -- no --> roll back compatible application images
```

### Why this order solves real problems

1. **Build once:** CI, staging and production refer to the same bytes. Rebuilding for production could install different dependencies or produce different output.
2. **Push before deployment:** every node can pull the exact artifact. A Pod should not compile source during startup.
3. **Migrate once:** a Kubernetes Job has one controlled owner and visible result. If every API Pod migrates, several Pods can race on the schema.
4. **Stop when migration fails:** old Pods remain available instead of starting new code against a half-migrated database.
5. **Roll out after schema readiness:** new code only receives traffic when the database contract it expects exists.
6. **Readiness-gated rollout:** Kubernetes sends traffic only to healthy new Pods while old ones still serve users.

### Important migration limitation

Running migrations first is safe only when schema changes are compatible with the currently running application. Use expand-and-contract changes:

```text
Release A: add nullable/new schema; old code still works
Release B: deploy code that reads/writes the new schema
Release C: backfill and later remove the old schema
```

Bad one-release example:

```text
Migration renames `amount` to `amount_cents`
Old Pods still query `amount` during rolling update
Result: live requests fail
```

- [ ] **6.1 Build a safe migration Job**

### Prompt 6.1

> Create a Kubernetes migration Job using the same immutable backend image as the release. It must run Drizzle migrations exactly once per release workflow, use a least-privilege database credential where practical, have no public Service, report logs, use a bounded retry/backoff policy, and remain inspectable after failure. Prevent API/worker rollout if the Job fails. Analyze every existing migration for repeatability and locking behavior. Document how to recover from partial failure and why automatically rolling back a database migration is usually unsafe.

- [ ] **6.2 Design CI checks for pull requests**

### Prompt 6.2

> Add a pull-request CI workflow using the repository's locked package manager. Run formatting/linting if configured, type checking, unit/integration tests, backend and frontend production builds, migration validation against an ephemeral PostgreSQL service, and focused queue tests with Redis. Cache dependencies without weakening lockfile correctness. Do not expose deployment secrets to untrusted pull requests. Add concurrency cancellation for superseded commits and publish useful test/build results.

- [ ] **6.3 Build and publish immutable images in CI**

### Prompt 6.3

> Add a protected-branch/release workflow that builds frontend and backend images once, tags them with full Git SHA and human-readable release metadata, generates provenance/SBOM where supported, scans them, pushes them to the Stage 0 registry, and records image digests. Authenticate with short-lived identity/OIDC where the provider supports it instead of permanent registry passwords. Fail before deployment on the agreed critical-vulnerability policy. Never use `latest` in Kubernetes manifests.

- [ ] **6.4 Deploy with approvals, migration gating and rollback**

### Prompt 6.4

> Implement CI/CD deployment to Kubernetes using the published image digests. Use a least-privilege deploy identity and protected production environment/approval. Apply configuration, create a uniquely named migration Job, wait for it to succeed, update API and worker images, wait for rollout status, and run authenticated/safe smoke tests. On application rollout failure, collect diagnostics and roll back application images only when the database change is backward compatible. Prevent concurrent production releases. Record who deployed which commit/digests and preserve migration/rollout logs.

- [ ] **6.5 Rehearse failure scenarios**

### Prompt 6.5

> Run a release rehearsal covering: image pull failure, migration syntax failure, migration timeout/lock, one new API Pod failing readiness, worker termination during a job, OCR OOMKill, Redis restart, PostgreSQL Pod restart, expired TLS certificate simulation where practical, and failed backup alert. For each case, record what users observe, whether CI stops, what remains running, recovery commands, data-loss risk, and the alert/runbook. Do not mark deployment complete merely because the happy path works.

### Stage 6 exit criteria

- Pull requests cannot merge without agreed checks.
- Production deploys immutable image digests built once by CI.
- Only one release/migration can run at a time.
- Failed migrations prevent application rollout.
- Rollouts wait for readiness and run smoke tests.
- Rollback and restore procedures have been rehearsed.

---

## Suggested implementation order

```text
0. Infrastructure decision
   |
1. API/worker split
   |
2A-2C. Config, shutdown, health, connections
   |
2D. Queue correctness and Bull Board security
   |
2E. Direct uploads and asynchronous OCR
   |
2F. Proxy, throttling and frontend configuration
   |
3. Container images
   |
4. Persistent storage, PostgreSQL, Redis and restore test
   |
5. Kubernetes app deployment, Ingress and observability
   |
6. Migration-gated CI/CD and failure rehearsal
```

## Global definition of done for every task

A task is complete only when:

- The current and new architecture have been explained in simple language.
- Relevant failure cases and tradeoffs are documented.
- Code/manifests are reviewed for secrets and destructive behavior.
- Tests/builds relevant to the change pass.
- A manual verification procedure is documented and, where possible, executed.
- Operational documentation and `.env.example` are updated.
- No unrelated user changes are overwritten.
- This checklist is updated with the commit or pull request reference.

## Progress log

| Date | Task | Commit/PR | Decision or result |
|---|---|---|---|
| TBD | TBD | TBD | TBD |
