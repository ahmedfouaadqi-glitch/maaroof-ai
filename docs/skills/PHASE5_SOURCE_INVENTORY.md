# Phase 5 Source Corpus Verification

| Measure | Verified value |
|---|---:|
| Source ZIP archives | 80 |
| Exact duplicate copies | 10 |
| Unique package variants | 70 |
| Unique skill names | 69 |
| Non-directory package entries | 449 |
| Evaluation JSON files | 8 |
| Files under package `scripts/` directories | 29 |
| ZIP integrity failures | 0 |
| Unsafe member paths found in source corpus | 0 |

The two Humanizer versions remain distinct package variants. Exact duplicate ZIP copies are not represented as additional skills.

All 70 unique ZIP payloads were inspected locally. The package scripts were not executed. Script-like files outside the packages' explicit `scripts/` directories are retained as untrusted reference content in the source audit and are not automatically runnable.

The SHA-256 recorded by the importer is the digest of the original ZIP byte stream. It is distinct from any package-content digest maintained by the MAAROOF registry.
