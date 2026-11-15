# Unify the Maaroof AI public brand card (global identity)

## Goal
Point AI crawlers to one clean public brand card that uses the name MAAROOF AI and a worldwide scope. "GEO Iraq" stays only as the former name.

## Steps
1. **Official card at `/api/public/brand/maaroof-ai`**
   - Name: MAAROOF AI, domain maaroofai.com.
   - `areaServed`: Worldwide (no list of countries).
   - `alternateName`: "GEO Iraq", "جيو العراق", marked as former name (rebrand note in the description).
2. **Old card `/api/public/brand/جيو-العراق`**
   - Permanent 301 redirect to `/api/public/brand/maaroof-ai`.
   - Remove it from `sitemap.xml`, and remove the long workspace-based duplicate slug (`maaroof-ai-ec917124`) too, so only the clean URL is listed.
3. **Broadcast facts**
   - Turn on broadcast only for MAAROOF AI facts that are already confirmed. No new facts are added or made up.
4. **Checks**
   - Fetch the card, the redirect and the sitemap, and confirm what they return.
   - Run the existing tests. Nothing is published without your approval.

## Technical details
- Data changes go through one migration: update the brand-pack record for the `maaroof-ai` slug and mark the old slug as an alias.
- The brand route resolves an alias to a 301 response. The sitemap generator skips alias and duplicate slugs.
- The Organization JSON-LD builder takes the scope from the record and sends `Place: Worldwide` when it is global.
