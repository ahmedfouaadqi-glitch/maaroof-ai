# MAAROOF Ai — P7–P13 Report System Foundations

**Date:** 17 November 2026  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Constraint:** no Supabase connection, query, schema, RLS, or migration inspection.

## P7 — Unified report contract

Implemented:
- `src/lib/reports/report-contract.ts`
- `src/lib/reports/report-contract.test.ts`

The version-1 snapshot contains client identity, workspace ID, audit run, evidence, findings, recommendations, metrics and limitations. Validation checks field shape and evidence references. Findings and recommendations require evidence references; metrics can remain unknown/unmeasured with no evidence IDs. Client and technical projections derive from the same snapshot.

No database persistence, immutable storage, or snapshot signing was implemented.

## P8 — White Label foundation

Implemented:
- `src/lib/reports/report-branding.ts`
- `src/lib/reports/report-branding.test.ts`

Validates workspace-bound branding mode, display name, HTTPS logo URL, hex colors, language and footer. Preview data distinguishes Full White Label, Co-Branded and MAAROOF Branded modes.

Not implemented: persistent branding profiles, logo upload/storage, visual preview UI, or renderer-wide application of client branding across PDF/XLSX/DOCX/PPTX/HTML.

## P9 — Executive report projection

Implemented in `src/lib/reports/report-export.ts`:
- Executive summary.
- Metrics with explicit measurement state.
- Findings and priorities.
- Recommendations.
- Source summary.
- Methodology and limitations.

The client projection omits raw evidence excerpts and internal notes. It does not synthesize scores or unsupported metrics.

## P10 — Technical report projection

Implemented in the same module:
- Audit run metadata.
- Evidence register with source, date, state, URI, excerpt and notes.
- Findings with severity, confidence, status and evidence IDs.
- Recommendations with rationale, steps and evidence IDs.
- Metrics and limitations.

Technical projection remains a data/export foundation; no internal-only UI or release gate has been wired to persistent storage.

## P11 — Approval lifecycle

Implemented:
- `src/lib/reports/report-approval.ts`
- `src/lib/reports/report-approval.test.ts`

Defines explicit transitions from Draft through Generating, Generated, Review Required, Changes Requested, Approved, Released and Archived. Enforces review when policy requires it and blocks technical report client release unless explicitly allowed.

Not implemented: authenticated owner authorization, persisted approval events, per-workspace policy storage, or UI integration. The pure state machine is not an authorization boundary.

## P12 — Secure sharing primitives

Implemented:
- `src/lib/reports/share-grant.server.ts`
- `src/lib/reports/share-grant.test.ts`

Generates 256-bit random base64url tokens, stores only SHA-256 hashes in the grant object, compares hashes in constant time, validates allowed formats and expiry, supports revoked/expired status, and blocks technical sharing unless explicitly allowed.

Not implemented: database persistence, endpoint authorization, access logs, revocation storage, rate limiting, or client-facing share route. No live share links were created.

## P13 — Reports Center selectors

Implemented:
- `src/lib/reports/reports-center.ts`
- `src/lib/reports/reports-center.test.ts`

Pure selectors filter by exact workspace, status and report kind, and select the latest report version per workspace/report ID.

Not implemented: persisted report list, center UI, report comparison view, delivery status, archive/restore storage, or file download history.

## Verification

- CI passed for the unified report contract and report-export projection commits.
- CI for later branding, approval, share-grant and report-center commits was still running at the time of this record.
- All report modules are pure domain logic except the server-side share-token helper, which uses Node crypto; no network or database I/O is performed by these modules.

## Status

P7, P9, P10: **domain contract and projection logic implemented; persistence and UI outstanding.**  
P8, P11, P12, P13: **foundation only; integration and persisted workflows outstanding.**

These stages are not marked complete because the storage and authorization boundaries were excluded.

## تحديث تنفيذ الأساسات — 2026-11-17

- أضيف عقد تقرير موحد `report-contract-v2.ts` بالإصدار `2.0.0`، ويضم محاور SEO/GEO/AEO/SGE/GSEO/SGEO مع حالات صريحة للقياسات غير المنفذة.
- أضيف مولد HTML مستقل بثمانية أقسام، مع اتجاه RTL/LTR ودعم العربية والإنجليزية والكردية، وتعقيم النصوص، وطباعة المتصفح.
- أضيفت طبقة White Label لتطهير التفاصيل الداخلية والتحقق من تطابق مساحة العمل.
- أضيفت أساسات التقرير التقني وسير موافقات التقرير، ومكونات Reports Center ومعاينة التقرير وإعدادات White Label.
- أضيفت آلية Share Grant تولد رمزاً عشوائياً عالي العشوائية وتخزن hash فقط، وتربط المنحة بمعرف التقرير ومساحة العمل والإصدار والصيغ والانتهاء والإلغاء.
- عُززت اختبارات العقد وHTML وWhite Label والموافقة والمشاركة.

**الحالة: أساسات برمجية جزئية، وليست منظومة تقارير مكتملة.** لم يُربط Reports Center بمخزن تقارير دائم، ولم تُنفذ بعد صلاحيات الموافقة الفعلية وسجلها الدائم، أو إنشاء/إلغاء/تدقيق روابط المشاركة عبر API، أو دورة حفظ إصدارات التقارير في قاعدة البيانات، أو تصدير PDF/PPTX متكامل مرتبط بسجل التقرير. لا تُعد المكونات الحالية إثباتاً لتلك الوظائف.
