# MAAROOF Workspace: motion and durable jobs

## Visual direction

Use the React Bits **Fade Content** pattern as a reference, but keep this workspace's implementation CSS-only:
- Reference: https://reactbits.dev/animations/fade-content
- Entrance: one short opacity + 8px translate reveal (360ms), used only when the page/section mounts.
- Skill cards: a 2px hover lift with a 160ms transition.
- Respect `prefers-reduced-motion`.
- No GSAP, ScrollTrigger, canvas, WebGL, particle field, blur filters, pointer-following effects, or continuous ambient animation on the goal-first workspace.

This is deliberately lighter than importing the full React Bits Fade Content component, whose optional effects and animation runtime are unnecessary for a productivity interface.

## Background-job architecture

Workspace runs are persisted in:
- `maaroof_background_jobs`: owner, goal, mode, state, request metadata, final status and timestamps.
- `maaroof_background_job_events`: ordered event history for reconnection and progress rendering.

The workspace submits once to `POST /api/maaroof`, receives a `job_id`, then polls `GET /api/maaroof-jobs?id=...&after=...`. Reopening or reloading the workspace discovers the latest active job and reconnects to its saved event history. Stopping a task marks it cancelled; the worker observes that state at the next event boundary.

The user access token is encrypted with AES-GCM using a key derived from the server-only Supabase service-role secret before it is stored for queued execution. The raw token is not stored in the job row or queue message.

## Cloudflare provisioning required

The worker is configured to use a Cloudflare Queue named `maaroof-background-jobs` and a dead-letter queue named `maaroof-background-jobs-dlq`. These queues are external Cloudflare resources and are **not created by a Git branch or Wrangler config alone**.

Create them once in the Cloudflare account used for this Worker:

```bash
npx wrangler queues create maaroof-background-jobs
npx wrangler queues create maaroof-background-jobs-dlq
```

Then deploy the migration `supabase/migrations/20261017160000_maaroof_background_jobs.sql` to the intended Supabase project, and deploy this branch through the project's approved release process. Do not deploy this branch automatically as part of review.

Until the queue binding is provisioned and available to the Worker, the goal-first workspace intentionally returns `background_queue_not_configured` rather than pretending a short-lived `waitUntil` task is durable. The professional interface keeps its existing SSE behavior.

## Acceptance checks before release

1. Submit a workspace goal and record the returned job ID.
2. Reload or close the browser; confirm the task continues and the same job ID is recovered.
3. Reopen the workspace and verify old events are not duplicated.
4. Verify queued, running, completed, failed and cancelled states.
5. Verify another authenticated user cannot read, poll, or cancel the job.
6. Verify queue retries do not start a second run when a job is already claimed.
7. Verify token balance/pricing behavior remains unchanged, including enqueue failures.
8. Test with reduced-motion enabled and inspect browser performance on a low-end device.
