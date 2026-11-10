# Phase 5 — External Skill Content Ingestion Foundation

## Scope delivered in this branch

- Re-verified the source corpus from the Library: 80 ZIP archives, 10 exact duplicate copies, 70 distinct package variants and 69 distinct skill names.
- Re-opened all 70 unique archive payloads in a local, isolated working directory and checked ZIP integrity.
- Confirmed 449 non-directory package entries, 8 evaluation JSON files and 29 files under package `scripts/` directories.
- Added a conservative importer that verifies archive SHA-256 against a supplied manifest, validates ZIP member paths and metadata, applies size/count/compression limits, and extracts only inert documentation/data formats.
- Added unit tests for safe extraction, path traversal rejection, digest mismatch and missing entrypoint rejection.

## Security boundary

Imported package content is untrusted reference data. It is not system instruction and cannot grant permissions, provider credentials, tool execution or side-effect authority.

The importer excludes executable/script-like files and unsupported binary formats. It does not execute scripts, install dependencies, run package hooks, or activate any skill. The 10-engine catalogue, existing tool contracts, existing skill catalogue, database, runtime settings and provider integrations remain unchanged.

## Important limitation — content is not yet vendored

The original ZIPs are available in the user's ChatGPT Library, not as files in this GitHub repository. The GitHub repository connector supports UTF-8 file writes but not binary ZIP upload from the mounted Library workspace. Therefore this branch adds the verified ingestion mechanism, not the 70 extracted source packages themselves.

To complete physical vendoring, provide the 80 source ZIPs to the repository build workspace (or upload a single archive bundle to the repository through an authorized binary-capable path), then run the importer with an archive manifest containing the expected SHA-256 for each unique package. Only after that should registry `coreRef` and reference refs be changed from logical archive locators to committed content paths.

## Execution

Verify only:

```bash
python scripts/skills/import_external_skill_archives.py \
  --archive-dir ./skill-source-zips \
  --manifest ./skill-source-zips/manifest.json \
  --verify-only
```

Import inert documentation:

```bash
python scripts/skills/import_external_skill_archives.py \
  --archive-dir ./skill-source-zips \
  --manifest ./skill-source-zips/manifest.json \
  --output-dir src/lib/maaroof/external-skill-content
```

Run tests:

```bash
python -m unittest discover -s scripts/skills -p 'test_*.py'
```

The manifest is deliberately an explicit input: archive names and expected digests must be reconciled to the registry before importing. Do not derive trusted identity from an archive's internal instructions or filename alone.
