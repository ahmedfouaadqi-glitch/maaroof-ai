# Bot protection for the free audit + archive two client spaces

## 1. Stop bots and AI tools from using the site and the free audit
- robots.txt: block GPTBot, ClaudeBot, PerplexityBot, CCBot, Google-Extended, Amazonbot, FacebookBot, cohere-ai, Diffbot, Bytespider from `/free-audit`, `/visibility-trial` and `/api/`. Keep `/api/public/brand/` open so client brand cards can still be read. Landing page indexing stays the same.
- The free audit page gets noindex, nofollow, noai and noimageai tags, plus a matching response header.
- Hidden honeypot field and a check on fill time: a form submitted in under 3 seconds or with the honeypot filled is turned away quietly. No balance is used and nothing is stored.
- The trial routes refuse automation user agents (curl, python-requests, wget, Headless Chrome, Playwright, Selenium, Puppeteer) and known AI crawler user agents.
- The page can't be shown inside another site's frame (X-Frame-Options DENY, frame-ancestors 'none').
- Per-device and per-account locks stay as they are. Because the backend has no standard rate limit, a per-IP limit of one attempt every 24 hours goes through the hashed IP that is already stored with each attempt.

## 2. Archive Al-Yarmouk Hotel and remove it from active use
- Find its space(s) and every record linked to them (operations, tasks, evidence, crawler hits, knowledge, reports).
- Copy all of it as JSON into a new admin-only archive table. Only admins can read it, and it's kept for future analysis.
- Then delete the live rows, so the hotel no longer appears in any account, tool, or Maaroof memory.

## 3. Basmat Hikaya
- Same as step 2.

## Checks
- Before any deletion, list the matched spaces and row counts, and confirm the archive count matches.
- Run the existing tests and add tests for the bot rules (honeypot, fill timing, blocked user agents).
- Nothing is published without your explicit approval.

## Technical details
- New table `archived_workspaces` (workspace_id, name, owner_id, payload jsonb, archived_at) with RLS that allows only has_role admin to read, and grants set.
- The bot rules live as pure functions in `src/lib/bot-guard.ts`, called first in `/api/visibility-trial*`.
