# MAAROOF Existing System Map

## نقطة الفحص

هذه الخريطة مبنية على المستودع `maaroof-ai`، الفرع `feature/maaroof-kernel-v1` المشتق من `main` عند commit `406cb31`. الغرض منها توثيق النظام الموجود قبل الدمج، لا استبداله.

| المكوّن | المسار الفعلي | الحالة | وظيفة الدمج |
|---|---|---|---|
| سطح الوكيل الموحد | `src/routes/maaroof.tsx` | ACTIVE | الحفاظ على `/maaroof` والتبويبات الخمسة وسجل الجلسات |
| نقطة SSE | `src/routes/api/maaroof.ts` | ACTIVE | الحفاظ على المصادقة، workspace validation، token/trial gate، وSSE |
| المنسق | `src/lib/maaroof/orchestrator.server.ts` | ACTIVE | تمديد المنسق نفسه وإصدار kernel manifest إضافي |
| الذاكرة | `src/lib/maaroof/memory.server.ts` | ACTIVE مع consent | إعادة استخدام user/workspace scope وعدم إنشاء مزود موازٍ |
| المعرفة | `src/lib/maaroof/knowledge.server.ts` | OPT_IN | لا تُفعّل افتراضياً؛ تبقى خلف الإعدادات الحالية |
| Agent Factory | `src/lib/maaroof/agents.server.ts` | ACTIVE/إعدادات reuse | الحفاظ على warm reuse وDNA وversioning |
| سجل الأدوات | `src/lib/tool-catalog.ts` | ACTIVE | استخدام الأدوات المسجلة فقط؛ لا Browser Operator مثبت |
| اختيار النماذج | `src/lib/maaroof/models.server.ts` | OPT_IN | لا Omni Router مثبت؛ default/fallback الحاليان محفوظان |
| الأدلة والواقع | `reality.server.ts` و`evidence.server.ts` و`trust.server.ts` | OPT_IN جزئياً | لا تُعرض حالة أقوى من الأدلة الفعلية |
| الموافقات | مسارات النشر والتنفيذ الموجودة | PARTIAL | النشر والمحتوى لهما مسارات موافقة؛ مسار orchestrator القديم يبقى كما هو |
| أوضاع التنفيذ | `settings.server.ts` و`orchestrator.server.ts` | PARTIAL | تفعيل صريح للـ simulation/recommendation/execution مع بقاء المحركات المتقدمة OFF |
| نواة معروف | `src/lib/maaroof/kernel.server.ts` | EXISTS_EXTEND | manifest خادمي فوق المكوّنات، بدون جدول أو route موازٍ |
| Google Drive | غير مثبت في runtime الحالي | MISSING | مؤجل إلى file/archive provider اختياري |
| Omni Router | غير مثبت في runtime الحالي | UNVERIFIED/MISSING | مؤجل إلى adapter بعد فحص provider واختبارات حقيقية |
| Browser Operator | غير مؤكد في `tool-catalog.ts` | UNVERIFIED | مؤجل لمسار read-only محدود مع موافقة |
| النطاق العالمي | `src/lib/maaroof/geo.server.ts` وAR/EN/KU | ACTIVE | الحفاظ على world scope وعدم افتراض العراق |

## الاعتماديات الأساسية

التدفق الحالي هو `POST /api/maaroof` ثم `runMaaroof`، مع استدعاء الذاكرة، التخطيط، council، الأدوات المسجلة، reflection، الإجابة النهائية، وسجل `maaroof_runs` و`maaroof_messages`. تمت إضافة kernel manifest داخل هذا المسار فقط.

## حدود الثقة

وجود ملف أو flag لا يثبت تشغيل القدرة. لذلك لا تُعتبر Omni Router أو Browser Operator أو Google Drive أو التعلم العالمي قدرات مفعلة في هذا الفرع. كما لا تُعتبر موافقة إنتاجية عامة جزءاً من مسار orchestrator القديم ما لم يثبتها الكود ومسار قاعدة البيانات.
