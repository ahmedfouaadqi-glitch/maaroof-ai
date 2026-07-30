# الأجزاء 9 → 17: طبقات إدارية فوق معمارية معروف القائمة

قرأت الملفات التسعة. أغلب ما تطلبه هذه الأجزاء **موجود جزئياً** داخل المحرّكات التي بنيناها في الأجزاء 1–8، لذلك — التزاماً بالدستور — لن أُنشئ محرّكات موازية. سأقيّم الموجود، أطوّره، ثم أدمج المتطلب الجديد فيه.

## ما هو موجود فعلاً مقابل الجديد

| الجزء | المكوّن القائم الذي يغطي جزءاً منه | الفجوة الحقيقية التي سأبنيها |
|---|---|---|
| 9 — Expert Learning | `tool-catalog.ts` (Capability Registry)، `capability.server.ts`، `agents.server.ts` (DNA) | جلسة حوار معرفي مع كل أداة + Expert Registry + Understanding Score + Expert Academy |
| 10 — Learning Governance | `token_ledger`، `charge_tokens`، `spend.server.ts` | ميزانية تعلّم منفصلة لا تمسّ رصيد المستخدم + سبب صفرية التكلفة + Snapshots + تقرير الفروقات |
| 11 — Living Knowledge | `maaroof_memory` (scope/confidence/freshness)، `platform_dna` | طبقات المعرفة التسع + Knowledge Graph (عُقد/علاقات) + تحقّق وتعارض + Knowledge Observatory |
| 12 — Model Governance | `model_scores_v`، `provider_rates`، `maaroof_settings.planner_model` | سجل نماذج + اختيار مُعلَّل لكل مهمة + مقترحات تحديث + AI Model Center |
| 13 — Decision Intelligence | `decision_log`، Expert Council، Capability OS، `timing.server.ts` | خط قرار موحّد + بدائل مرفوضة وأسبابها + Decision Center |
| 14 — Publishing | `publish_channels`، `publish_log`، `ApprovalQueue`، `brand_boost_jobs` | Publication Strategy + Platform Profiles + حملات + Publishing Center |
| 15 — Trust Architecture | Trust Engine (الجزء 7) + `buildEvidenceGraph` | Trust Profile لكل كيان (خبير/نموذج/MCP/معرفة) يتطوّر مع الزمن + Trust Center |
| 16 — State Anchor | `workspaces`، `maaroof_runs`، `maaroof_agents` | مرساة حالة متعددة المستويات + كشف الانحراف (Drift) + استرجاع بعد الفشل + State Center |
| 17 — HERMES | لا يوجد | كيان مراقبة يقترح ولا ينفّذ + Founder Inbox + Founder DNA |

## الموجة 1 — المعرفة والخبراء (9 + 10 + 11)

- جداول: `expert_profiles` (الـDNA والفهم لكل أداة)، `expert_learning_sessions` (الحوار كاملاً: سؤال/جواب/تكلفة/نموذج)، `expert_snapshots` (نسخ معتمدة)، `knowledge_nodes` + `knowledge_edges` (الرسم المعرفي)، `learning_budget_ledger`.
- `experts.server.ts`: تشغيل المقابلة المعرفية (مرحلتان: استجواب ثم حوار عكسي)، استخراج الـDNA، حساب Understanding Score، وإصدار Snapshot.
- الحوكمة: كل استهلاك تعلّم يُقيَّد على ميزانية النظام لا على المستخدم؛ وأي تكلفة صفرية تُسجَّل مع سببها (كاش / Snapshot معاد / بلا نموذج).
- المنسّق يقرأ Snapshot الخبير بدل الوصف الثابت، ولا يستخدم أداة قبل اكتمال تعلّمها.
- واجهات إدارة: **Expert Academy** و**Knowledge Observatory** داخل مركز الذكاء القائم (لا صفحات منفصلة).

## الموجة 2 — النماذج والقرار (12 + 13)

- `ai_models` سجل مركزي + `model_proposals` + `model_benchmarks`.
- `models.server.ts`: اختيار النموذج لكل خطوة حسب المهمة والتكلفة والسرعة مع تسجيل سبب الاختيار؛ الاختيار خلف مفتاح، والافتراضي يبقى `planner_model` الحالي.
- توسعة `decision_log` القائم إلى خط قرار كامل: البدائل المطروحة، سبب رفض كل بديل، الخبراء، النماذج، التكلفة، المخاطر.
- واجهات: **AI Model Center** و**Decision Center** (خط زمني + شجرة قرار + تصدير).

## الموجة 3 — النشر والثقة (14 + 15)

- تطوير `publish_channels` القائم بدل استبداله: إضافة `platform_profiles` (سلوك كل منصة وأفضل وقت وقيود المحتوى) و`publishing_campaigns` و`publication_strategies`.
- سير النشر يمرّ عبر مجلس الخبراء ثم بوابة الموافقة الحالية؛ نتائج ما بعد النشر تعود إلى الذاكرة.
- `trust_profiles`: ملف ثقة متطوّر لكل خبير/نموذج/MCP/عقدة معرفة، يُحدَّث من نتائج التشغيل الفعلية، ويصبح مدخلاً في اختيار الخبير والنموذج.
- واجهات: **Publishing Center** و**Executive Trust Center**.

## الموجة 4 — مرساة الحالة وهيرمس (16 + 17)

- `state_anchors` بمستويات (platform / workspace / user / run / agent) مع وراثة وعدم جواز مخالفة الأعلى، و`state_events` لسجل التغيير والتراجع.
- `anchor.server.ts`: تحقّق ما قبل التنفيذ + كشف الانحراف (هدف/سياسة/لغة/ميزانية) + استرجاع بعد الفشل من آخر حالة سليمة بدل إعادة التشغيل الأعمى.
- HERMES: `hermes_proposals` + `founder_dna`. يراقب ويقترح فقط — لا ينفّذ أي تغيير. كل مقترح يحمل تبريراً اقتصادياً (القيمة المتوقعة > التكلفة) ويُرفض تلقائياً إن لم يحققه. صندوق قرارات المؤسس داخل الإدارة، وكل موافقة أو رفض تُغذّي Founder DNA.

## قواعد ملزِمة عبر كل الموجات

- كل طبقة جديدة خلف مفتاح في `maaroof_settings` **مُطفأ افتراضياً** — مسار الجزء 8 يبقى مطابقاً حتى تفعّلها.
- لا صفحات إدارة منفصلة: كل الأقسام الجديدة تُضاف داخل `MaaroofIntelligenceCenter`.
- كل جدول جديد يُنشأ مع GRANT + RLS من نفس النوع المستخدم حالياً؛ التعلّم الداخلي مقصور على الإدارة، وبيانات المستخدم معزولة بـ`auth.uid()`.
- التصدير (PDF / Excel / CSV / JSON / Markdown) يعيد استخدام `exports.ts` القائم.
- بعد كل موجة: تدقيق ذاتي وتحديث `docs/MAAROOF-AUDIT.md` بجدول «القائم / الجديد / سبب التطوير بدل الإنشاء».

## تفاصيل تقنية

جميع الجداول في `public` مع GRANT صريح ثم RLS ثم السياسات. المحرّكات الجديدة ملفات `*.server.ts` تُستدعى من `orchestrator.server.ts` عند نقاط حقن محددة فقط، وواجهات الإدارة تقرأ عبر Views مثل `expert_understanding_v` و`trust_ranking_v` و`state_health_v`. جلسات التعلّم تعمل عبر server function إدارية لا عبر مسار المستخدم، لضمان عدم خصم أي توكن من رصيده.

## نطاق التنفيذ

سأبدأ بالموجة 1 كاملة في الدورة القادمة، ثم أتابع الموجات تباعاً — كل موجة بتدقيق وتوثيق مستقل.
