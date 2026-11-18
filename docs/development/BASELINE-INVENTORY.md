# جرد خط الأساس — معروف

**التاريخ:** 2026-11-19  
**المصدر:** الأرشيف المرفق `maaroof-ai-main.zip`، نسخة `main`.  
**الفرع الذي تُسجل عليه أعمال الخطة:** `work/maaroof-development-10-phases`.  
**الغرض:** توثيق ما أمكن جرده من نسخة main قبل التطوير، دون تعديل التطبيق.

## حدود الفحص

- استُبعدت ملفات `.env` وأي أسرار.
- استُبعدت مجلدات وملفات Supabase وأعمال قاعدة البيانات المرتبطة بها من نطاق المراجعة.
- لم تُفتح أو تُراجع ملفات النماذج اللغوية أو موصلاتها أو إعداداتها؛ وهي مستثناة من جميع مراحل التنفيذ.
- هذا الجرد خاص بنسخة main المرفقة. الأرشيف لا يحتوي على تاريخ Git أو لقطات محتوى الفروع، لذلك لا يثبت اكتمال مراجعة جميع الفروع أو تغييراتها.
- لا يحتوي مجلد المشروع المستخرج على `node_modules`، ولا تتوفر أداة Bun في بيئة الفحص.

## إحصاء الملفات

بعد الاستثناءات أعلاه، فُهرس 959 ملفاً:

| النطاق | العدد |
|---|---:|
| جميع الملفات المفهرسة | 959 |
| ملفات `src` | 685 |
| TypeScript | 441 |
| TSX | 239 |
| Markdown | 181 |
| مكونات ضمن `src/components` | 209 |
| مكتبات ضمن `src/lib` | 399 |
| ملفات ضمن `src/routes` | 67 |
| مسارات API | 36 |
| اختبارات `*.test.ts` | 144 |
| خطط `.lovable/plan` | 153 |
| مستندات Markdown ضمن `docs` | 23 |
| أسطر ملفات `src` | 144,076 |
| أسطر خطط `.lovable/plan` | 5,039 |

هذه أعداد جرد وليست مؤشرات جودة أو اكتمال.

## خريطة البنية

- `src/routes`: صفحات التطبيق ومسارات API العامة والخاصة.
- `src/components`: واجهات الأدوات ومساحات العمل ولوحات الإدارة والتقارير.
- `src/lib`: منطق الأعمال، المنسّق، القياسات، الأدلة، المهارات، التصدير، المعرفة والمساعدات.
- `docs`: وثائق مرجعية ومواصفات.
- `.lovable/plan`: خطط تنفيذ وتغييرات تاريخية؛ لا تُعد حالة تنفيذ موثوقة دون مطابقة الكود والاختبارات.
- `scripts`: أدوات فحص وتعريب واستيراد مهارات.

### مسارات API الموجودة في الجرد

`analyze`, `applied-ranking`, `attachment-analyze`, `bizdev`, `brand-authority`, `brand-boost-report-settings`, `brand-boost-scheduler`, `brand-boost`, `company-email`, `compare`, `competitor-monitor`, `deep-audit`, `delegated-browser`, `dual-result`, `feasibility`, `geo-rewrite`, `geo-strategist`, `keyword-upload`, `known`, `maaroof-chat`, `maaroof-jobs`, `maaroof`, `research`, `security-scan`, `site-discovery`, `social-analysis`, `suggest`, `visibility-baseline`, `visibility-trial-usage`, `visibility-trial`, `visibility`, `what-if`، إضافة إلى مسارات عامة/تكاملية أخرى ضمن العدد الإجمالي.

## أوامر المشروع المتاحة

وفق `package.json`:

- `npm run dev`
- `npm run build`
- `npm run build:dev`
- `npm run preview`
- `npm run lint`
- `npm run test` (يشغّل `vitest run`)

إعداد Vitest في `vitest.config.ts` يضم `src/**/*.test.ts`. توجد 144 وحدة اختبار بهذا النمط في الجرد.

## نتائج تحقق قابلة للتكرار

### تدقيق التعريب

تم تشغيل `node scripts/i18n-audit.mjs` بنجاح على الأرشيف المستخرج. أخرجت الأداة:

- 628 ملفاً مفحوصاً.
- 158 مكوناً و67 مساراً وفق تعريفات الأداة.
- 1,149 مفتاحاً لكل لغة من اللغات الثلاث (en/ar/ku).
- صفر مفاتيح ناقصة في ar وku وفق الأداة.
- 11 مفتاحاً صنفتها الأداة كغير معروفة.
- 476 مفتاحاً صنفتها الأداة كغير مستخدمة.
- 3,660 سطراً صنفتها كاحتمال نص ثابت ضمن 282 ملفاً.

هذه نتائج الأداة كما هي، وليست حكماً بأن كل سطر من النصوص الثابتة خطأ تعريب أو أن كل مفتاح غير مستخدم مهجور. يلزم تدقيق قواعد الاستخراج والاستعمال قبل اتخاذ قرارات حذف أو نقل.

### TypeScript

تمت محاولة `tsc --noEmit` باستخدام TypeScript المتاح في بيئة الفحص. توقفت المحاولة بسبب غياب تعريف النوع `vite/client`:

`TS2688: Cannot find type definition file for 'vite/client'.`

لم يكن `node_modules` موجوداً، ولم تكن Bun مثبتة. لذلك لم يتم تشغيل Vitest أو ESLint أو Vite build؛ ولا تُسجل هذه الفحوص كناجحة أو فاشلة وظيفياً، بل كـ **غير متحققة بسبب نقص بيئة الاعتماديات**.

## ملاحظات خط أساس تحتاج متابعة

1. ملف `AGENTS.md` يصف وحدات MCI Foundation بأنها pure وغير موصولة بالأدوات، بينما يوجد مسار Resolver منفصل لإعادة استخدام نتائج الأدوات. يلزم في مرحلة لاحقة التحقق من نقطة الدمج الفعلية دون افتراض أن الأساس الجديد مستخدم.
2. توجد 153 خطة تاريخية في `.lovable/plan`. لا يجوز اعتماد حالة «مكتمل» أو «متبقٍ» من اسم الخطة أو نصها وحده؛ يجب مطابقة كل بند مع الكود والاختبار.
3. يوجد 144 اختباراً وفق نمط Vitest المحدد، لكن وجود الاختبارات لا يثبت أنها تعمل أو تغطي كل المسارات.
4. توجد 67 route file و36 مسار API وفق جرد الملفات؛ يلزم ربط كل مسار بعقد الأداة/المهارة والواجهة في المرحلة الثانية.
5. توجد فروع تطوير كثيرة في المستودع؛ أسماء الفروع ومقارنات commits لا تكفي لتحديد اكتمال محتوياتها. يلزم توفير محتوى الفروع أو diffs موثوقة قبل اعتماد أي تغيير فرعي.


## مطابقة أولية بين كتالوج الأدوات والمهارات والخيارات

تمت مراجعة التعريفات الساكنة التالية على نسخة main:

| الطبقة | العدد | الملاحظة |
|---|---:|---|
| أعضاء اتحاد النوع `ToolKey` | 24 | يتضمن 3 معرفات للوكيل: `agent.command` و`agent.run_targets` و`agent.visibility` |
| سجلات `TOOL_CATALOG` الفعلية | 24 | تشمل الأدوات ومفاتيح الوكيل والمنسّق بحسب بنية السجل؛ يجب عدم مساواة العدد بعدد endpoints |
| المهارات في `MAAROOF_SKILLS` | 21 | سجل المهارات الحالي |
| سجلات `TOOL_OPTIONS` | 18 | ثلاثة مفاتيح من كتالوج الأدوات لا تملك مدخلاً هنا: `maaroof` و`translate` و`teach_space`، ويجب التحقق من كونها مسارات خاصة مقصودة |
| `EXECUTABLE_TOOLS` | 18 | يستبعد `keyword_intelligence` و`competitor_monitor` رغم وجودهما في الكتالوج والخيارات؛ كما يستبعد `maaroof` بوصفه المنسّق الأعلى |

هذه المطابقة تكشف فجوة تستحق التتبع، لكنها لا تحسم وحدها ما إذا كانت الأداة معطلة أو لها مسار تنفيذ بديل. تُستكمل مطابقة كل أداة من الواجهة إلى API والمنسّق في المرحلة الثانية قبل تغيير أي تعريف.

## ملاحظة في منطق تصنيف الواقع

في `src/lib/maaroof/orchestrator.server.ts`، عند تجميع بيانات `classifyReality`، تُمرر قيمة `externalSources` بعدد نتائج الأدوات الناجحة (`results.filter((r) => r.ok).length`). نجاح تنفيذ الأداة لا يثبت أن نتيجتها تمثل مصدراً خارجياً مستقلاً؛ لذلك يجب مراجعة هذا الربط في مرحلة حوكمة الأدلة، وعدم اعتباره إثباتاً لمصدر خارجي.


## تتبع تدفق الأدوات والمهارات إلى التنفيذ

تمت مطابقة `tool-catalog.ts` و`tool-options.ts` و`skill-catalog.ts` و`skill-inference.ts` و`reasoning.server.ts` ومواضع dispatch في `orchestrator.server.ts`.

### نتائج المطابقة الدقيقة

| عنصر | العدد | التفسير |
|---|---:|---|
| مفاتيح `ToolKey` | 24 | تشمل 3 مفاتيح agent، والمنسّق `maaroof` |
| سجلات `TOOL_CATALOG` | 24 | تشمل أدوات الوكيل والمفاتيح الخاصة |
| المهارات | 21 | لكل مهارة قائمة أدوات |
| مفاتيح `TOOL_OPTIONS` | 18 | 18 أداة ذات خيارات معرفة |
| مفاتيح `EXECUTABLE_TOOLS` | 18 | 18 أداة تسمح بها مهارات الاستدلال |
| مفاتيح `toolPath` | 19 | تشمل alias إضافياً `competitor_compare` |
| مسارات API | 36 | منها 18 مساراً مسانداً/عاماً لا تمثل استدعاء أداة مباشر |

### الفجوات المؤكدة في الربط

1. `keyword_intelligence` موجودة في الكتالوج والخيارات والمهارات، ولها مسار `/api/dual-result`، وتظهر ضمن تغطية reasoning intent؛ لكنها غائبة من `EXECUTABLE_TOOLS`. لذلك تُسقطها `executableToolsFor()` عند تحويل المهارة إلى خطوات تنفيذ. اختبار `skill-inference.test.ts` يثبت السلوك الحالي بتوقع عدم ظهورها في خطوات `search_visibility_strategy`. هذه فجوة وظيفية مؤكدة بين تعريف المهارة ومسار التنفيذ، وليست مجرد اختلاف تسمية.
2. `competitor_monitor` موجود في الكتالوج والخيارات وله مسار API، لكنه مستبعد عمداً من `EXECUTABLE_TOOLS`، ومن اختيارات الأدوات التي يعرضها المنسّق، ومن `TOOL_KEYS` المقبولة في `reasoning.server.ts`. كما أن المنسّق يتخطى الخطط القديمة التي تتضمنه بسبب حالة إيقاف مؤقت. الاختبارات توثق رفضه. يصنف «متوقف/مستبعد عمداً» لا «مفقود التنفيذ».
3. `translate` و`teach_space` موجودتان في الكتالوج والخيارات والمهارات و`EXECUTABLE_TOOLS`، ولا تظهران في خريطة `toolPath` لأن المنسّق يعالجهما في dispatch داخلي خاص. لا تعتبران مسارين مفقودين.
4. `maaroof` هو مدخل المنسّق نفسه وليس خطوة أداة فرعية عادية. مفاتيح `agent.command` و`agent.run_targets` و`agent.visibility` ليست ضمن مسارات أدوات `toolPath` العادية؛ يجب توثيق عقودها في طبقة الوكيل بدلاً من إدخالها قسراً في الخريطة.
5. `competitor_compare` اسم alias في خريطة `toolPath` يوجّه إلى `/api/compare`، لكنه ليس مفتاحاً في `ToolKey` أو `TOOL_CATALOG`. يلزم حسم ما إذا كان alias تاريخياً لازماً أم بقايا غير مستخدمة قبل أي حذف.
6. 18 مفتاحاً في `TOOL_OPTIONS` جميعها موجودة في `TOOL_CATALOG`؛ اختبار `tool-options.test.ts` يتحقق من هذا الاتجاه فقط. لا يتحقق الاختبار من وجود تعريف خيارات لكل أداة أو من مطابقة الحقول مع قراءة endpoint فعلياً.
7. `TOOL_OPTIONS.fields` وصفية في النسخة الحالية: `enforceEnums()` يزيل القيم غير المقبولة في حقول enum فقط، ولا يطبق allowlist عامة على `fields`. لذلك لا ينبغي التعامل مع `fields` على أنها تحقق runtime لمدخلات endpoint؛ يجب اختبار ذلك وتوحيد العقد في المرحلة الثانية.

### تتبع إضافي لمسار dispatch

- خريطة `toolPath()` في `orchestrator.server.ts` تربط `keyword_intelligence` بالمسار `/api/dual-result`.
- `direct-tool-dispatch.server.ts` يحتوي على loader للمسار نفسه؛ أي أن المسار موجود في طبقة التنفيذ المباشر أيضاً. سبب عدم وصول المهارة إليه ليس غياب endpoint أو loader، بل إسقاط المفتاح في `EXECUTABLE_TOOLS` أثناء تحويل المهارة إلى خطوات.
- `toolPath()` يحتوي 19 مفتاحاً، بينما `ROUTE_LOADERS` يسمح بالمسارات المقابلة؛ توجد مطابقة تستلزم تدقيقاً شاملاً في المرحلة الثانية، ولا يكفي وجود loader لإثبات أن endpoint قابل للتشغيل في كل الظروف، لأن dispatch يرجع إلى HTTP fallback عند تعذر حل handler أو وجود middleware.
- `competitor_compare` alias إلى `/api/compare` داخل `toolPath()`، ولا يقابله مفتاح مستقل في الكتالوج. لا يوجد قرار حذف في هذه المرحلة.
- `TOOL_OPTIONS.fields` تُستخدم في وصف الأداة للـ planner، لكن مسار التنفيذ الحالي لا يحذف تلقائياً كل حقل غير مدرج فيها؛ `enforceEnums()` يطبق قيود enum فقط. يجب أن يكون عقد الحقول في المرحلة الثانية متسقاً مع endpoint الفعلي قبل إضافة فلترة صارمة.

### ملاحظات على الاختبارات القائمة

- `skill-inference.test.ts` يثبت أن `keyword_intelligence` لا تُضاف إلى خطوات المهارة حالياً، رغم أنها مذكورة في مهارة استراتيجية الظهور. الاختبار يثبت السلوك ولا يثبت أن هذا السلوك هو القرار المنتج الصحيح.
- `reasoning.server.test.ts` يثبت رفض `competitor_monitor` والأدوات المجهولة، ويثبت صلاحية التبعيات السابقة فقط.
- `tool-options.test.ts` يثبت أن كل مفتاح خيارات له تعريف في الكتالوج، لكنه لا يثبت تغطية كل أداة نشطة أو تطابق المخطط مع endpoint.
- لم تُشغّل هذه الاختبارات بسبب نقص الاعتماديات في بيئة الفحص؛ تمت مراجعة نصوصها فقط.

## حالة CI والفروع

- يحتوي `.github/workflows/validation.yml` على workflow لاختبارات Vitest وبناء الإنتاج باستخدام Bun و`bun install --frozen-lockfile`.
- تشغيل push محدد على `main` و`fix/**` و`feat/**`، إضافة إلى pull requests. فرع العمل الحالي `work/maaroof-development-10-phases` غير مشمول بقاعدة push هذه؛ لا يوجد في الأرشيف ما يثبت تشغيل CI عليه.
- استعلام حالة checks لآخر commit معروف على `main` لم يُرجع status checks. هذا لا يثبت نجاحاً أو فشلاً.
- قائمة GitHub الحالية أظهرت 87 فرعاً أصلياً (بما فيها `main`) قبل إضافة فرع العمل هذا. تمت مقارنة بيانات commits للفروع الأخرى في التدقيق السابق، وكانت حالات المقارنة متباعدة؛ بيانات المقارنة لا تثبت اكتمال محتوى الفروع.
- لا تتضمن نسخة ZIP تاريخ Git أو snapshots للفروع. لم تتم مراجعة جميع ملفات كل فرع سطراً بسطر؛ لا يجوز إعلان تدقيق شامل للفروع بناءً على أسماء الفروع أو counts فقط.

## حالة المرحلة الأولى

**الحالة: جزئية — لا يبدأ تنفيذ المرحلة الثانية بعد.**

### ما بدأ
- جرد نسخة main المرفقة.
- فهرسة الملفات والمسارات والاختبارات والخطط.
- تشغيل تدقيق التعريب.
- محاولة تحقق TypeScript.

### ما اكتمل
- إحصاء 959 ملفاً ضمن حدود الفحص.
- جرد 685 ملفاً ضمن src، و67 route file، و36 مسار API، و144 اختباراً.
- توثيق أوامر المشروع ومحددات Vitest.
- تشغيل تدقيق التعريب وتسجيل مخرجاته.
- تحديد سبب تعذر فحوص الاختبارات والبناء والـ lint في بيئة الفحص.

### ما تبقى
- توفير بيئة اعتماديات مطابقة للمشروع (Bun/lockfile أو بيئة CI قائمة) لتشغيل الاختبارات وlint وbuild دون تعديل ملفات النماذج أو Supabase أو `.env`.
- مراجعة ربط الواجهات والأدوات والمهارات والمسارات على مستوى التدفق، لا الاكتفاء بعدّ الملفات.
- توفير diffs أو snapshots للفروع المطلوب تقييمها؛ الأرشيف الحالي لا يتضمنها.
- استكمال تصنيف العيوب المؤكدة حسب الأثر والدليل.

### قرار البوابة
لا تُعلن المرحلة الأولى مكتملة قبل استكمال التحقق التشغيلي والحصول على مادة كافية لتقييم تغييرات الفروع ذات الصلة. لا يبدأ تغيير عقود الأدوات أو المهارات قبل ذلك.

## مطابقة واجهات الأدوات مع العقود والتنفيذ

تم فحص SkillToolsPanel.tsx وDirectToolsPanel.tsx وTOOL_UI وTOOL_OPTIONS وTOOL_CATALOG وEXECUTABLE_TOOLS وtoolPath() وROUTE_LOADERS.

| مجموعة المطابقة | العدد/المفاتيح | النتيجة |
|---|---|---|
| مكونات TOOL_UI | 18 | واجهات فعلية تُفتح داخل مساحة العمل |
| TOOL_OPTIONS | 18 | 16 مفتاحاً تتقاطع مع TOOL_UI |
| مفاتيح خيارات بلا مكوّن في TOOL_UI | brand_authority, geo_rewrite | تظهر في لوحة المهارات كأدوات تنفذ ضمن المهام، لا كواجهة مباشرة |
| مفاتيح UI بلا TOOL_OPTIONS أو ToolKey | security_scan, report | مساران مستقلان في مساحة العمل؛ لا يصح إدخالهما تلقائياً في عقد أدوات المنسّق |
| competitor_monitor | موجود في TOOL_UI | واجهته تعرض حالة الإيقاف المؤقت، ولا تعرض تشغيل الفحص |
| keyword_intelligence | موجود في TOOL_UI وTOOL_OPTIONS وToolKey وtoolPath وROUTE_LOADERS | أداة ظاهرة وقابلة للاستدعاء المباشر؛ الخلل المحدد في EXECUTABLE_TOOLS التي تستخدمها ضمانات إضافة أدوات المهارة |

**تمييز مهم:** TOOL_UI يصف واجهات تشغيل مباشرة، وليس قائمة كاملة بكل ما يستطيع المنسّق تنفيذه. وبالمثل، وجود المفتاح في TOOL_OPTIONS لا يعني بالضرورة وجود مكوّن UI مباشر.

## تحقق CI على main — نتيجة أحدث من الأرشيف

تم فحص سجل GitHub Actions على main بعد جرد الأرشيف:

- أحدث تشغيل مكتمل عند الفحص: run 44278208035 على commit 3d94c7d65540e53f9d2eb05aeb7bdeb9a6fb686c بتاريخ 2026-11-18، والنتيجة **failure**.
- فشل التشغيل في خطوة Unit Tests قبل الوصول إلى TypeScript validation أو production build.
- سجل الاختبار: **1 suite failed، 143 suites passed؛ 730 tests passed، 3 skipped**.
- سبب الفشل المباشر: src/lib/maaroof/attribution/domain.test.ts يستورد ./domain، لكن الملف src/lib/maaroof/attribution/domain.ts غير موجود على main.
- تمت مطابقة الملف على فرع feat/attribution-intelligence-foundation-v1، حيث يوجد domain.ts، بينما لا يوجد على main. هذا الفرع مرتبط بـ PR #73 المفتوح بحالة Draft وغير مدمج؛ نص PR يصرّح بأن الاختبارات لم تُشغّل وأن التغييرات لا تتضمن تعديلات على ملفات قائمة. هذا يثبت عدم اتساق ملفات الاختبار والتنفيذ في main، ولا يثبت أن نسخ الملف وحده هو الإصلاح الصحيح؛ يلزم مراجعة diff الفرع وتوافقه قبل أي نقل.
- يوجد تشغيل سابق ناجح على main (run 44125549196) لكنه على commit أقدم، فلا يلغي فشل أحدث commit.
- يوجد تشغيل ناجح على فرع آخر feat/non-destructive-owner-workspaces-reports-2026-11-17 (run 44057164020) شمل tests وTypeScript وbuild، لكنه لا يمثل حالة main الحالية. فحصه لا يغني عن إصلاح فشل main.
- lint في التشغيل المشار إليه مصنف في handoff الفرع الآخر كتقرير تشخيصي، وليس بوابة نجاح؛ لا يُعامل كاجتياز lint.

**الأثر:** أصبح لدينا الآن سبب فشل CI محدد وقابل لإعادة الإنتاج من سجل GitHub، بدلاً من الاكتفاء بتسجيل أن التحقق التشغيلي غير متاح في بيئة الأرشيف.

## حالة المرحلة الأولى — تحديث

**الحالة: جزئية.** اكتمل الآن تتبع واجهات الأدوات المباشرة ومقارنة UI/options/catalog/dispatch، كما تم تحديد فشل CI الحالي على main وموضع الملف المفقود. لا تزال بوابة الإغلاق تتطلب مراجعة diffs الفروع ذات الصلة، وتحديد الإصلاح المعتمد لفشل الاختبارات، ثم تشغيل الاختبارات وTypeScript والبناء على commit موحد دون تغيير النطاقات المستثناة.
## حالة الفروع وطلبات الدمج المفتوحة

تم استرجاع قائمة الفروع الحالية من GitHub: **88 فرعاً** إجمالاً عند الفحص، منها main وفرع العمل الحالي. لا توجد صفحة ثانية من نتائج الفروع. تمت مراجعة بيانات طلبات الدمج المفتوحة وعدد الملفات، مع فتح عينات من الملفات ذات الصلة؛ هذا جرد حالة وليس تدقيقاً كاملاً لكل diff.

| PR | الفرع | الحالة | الملفات المتغيرة | النطاق المعلن/المشاهد |
|---|---|---|---:|---|
| #1 | feat/maaroof-skills-workspace-clean | Draft | 45 | مساحة العمل والمهارات والمهام الخلفية؛ يتضمن migrations وملفات حسابات/تشغيل، لذلك لا يُعتمد دون مراجعة حدود DB المستثناة |
| #3 | feat/maaroof-interview-foundation-no-cloudflare | Draft | 58 | مقابلات الكيان وبنك الأسئلة وتقارير المقابلات؛ يتضمن migrations واختبارات RLS، مستبعدة من الفحص الحالي |
| #24 | feat/dardasha-contextual-chat-ui | Open / Ready | 6 | إجراءات رسائل الدردشة وتحسين عرض Markdown؛ تمت مراجعة عينة من parser/action helpers فقط |
| #26 | fix/workspace-data-isolation | Draft | 21 | عزل مساحة العمل؛ يتضمن Drizzle migration وملفات types؛ لم تتم مراجعة DB changes |
| #42 | feat/brand-aware-bilingual-unified-report | Open / Ready | 8 | تحسينات probe/workbook/keyword clusters؛ تمت مراجعة الملفات المنطقية الرئيسية كعينة، ولم يثبت اكتمال تدقيق كل diff |
| #53 | feat/skill-registry-foundation-v1 | Open / Ready | 23 | أساس سجل 69 مهارة خارجية؛ تمت مراجعة registry/evidence-pack/quality-evaluation كعينة، وهو أساس حوكمة وليس إثبات دمج runtime كامل |
| #59 | feat/visibility-free-trial-counter | Draft | 23 | تجربة الظهور المجانية والعداد؛ يتضمن سلسلة Supabase migrations، مستبعدة من هذا النطاق |
| #73 | feat/attribution-intelligence-foundation-v1 | Draft | 18 | أساس Attribution Intelligence؛ يضم الملف domain.ts الذي يستورده اختبار موجود على main، لكنه غير مدمج |

**قراءة الحالة:** يوجد 8 PRs مفتوحة، منها 5 Draft و3 غير Draft. كون PR غير Draft لا يعني اجتياز التدقيق أو جاهزيته للدمج. الفروع غير المرتبطة بهذه PRs لا تزال بحاجة إلى تصنيف حسب آخر commit وdiff، ولا يُستنتج اكتمالها من اسم الفرع.

**حدود الالتزام:** لم تتم قراءة أو تعديل migrations أو سياسات قاعدة البيانات أو ملفات Supabase، ولم تتم مراجعة .env أو الأسرار أو ملفات مزودي النماذج والاتصال. لا يُعتبر فحص metadata لطلبات الدمج مراجعة لهذه الملفات.
## مراجعة مباشرة إضافية لفروع التطوير — 2026-11-19

تمت مراجعة محتوى ملفات محددة من PRs #42 و#53 و#73 ومقارنة commits. هذه مراجعة انتقائية للمسارات المرتبطة بالخطة، وليست تدقيقاً كاملاً لكل ملف في كل فرع.

### PR #73 — Attribution Intelligence foundation

- مقارنة main مع feat/attribution-intelligence-foundation-v1 أظهرت أن الفرع متباعد: 128 commit ahead و5 behind، وأن ملفات attribution الـ18 مضافة على هذا الفرع.
- ملف src/lib/maaroof/attribution/domain.test.ts موجود على main ويستورد ./domain، لكن src/lib/maaroof/attribution/domain.ts غير موجود على main.
- تتبع commit محدد أكد أن commit 45aa0e22f26839960e0a67c42f880def40ff5e2d أضاف ملف الاختبار وحده، من دون ملف domain. ثم أضاف commit منفصل 051fba15c741a5957343d704dbe10e5732f69b9f ملف domain إلى فرع attribution. هذا يثبت تسلسل إدخال الاختبار دون مصدره على main؛ لا يثبت أن نقل الملف وحده هو الحل الصحيح أو أن بقية PR آمنة للدمج.
- PR #73 ما زال Draft، ووصفه يصرح بأن الاختبارات وlint وTypeScript والبناء لم تُشغّل. لذلك لا يعتمد كإصلاح متحقق.
- المراجعة الساكنة لملف domain تبين قواعد تصنيف UTM/referrer وUA، وخمسة نماذج attribution، مع منع cross-workspace واستبعاد crawler واللمسات اللاحقة للتحويل. المخرجات وصفية وليست سببية.
- حد مهم: attributeConversion() يسمح افتراضياً بجمع اللمسات من أكثر من session داخل workspace نفسه إذا لم يمرر المستدعي eligibleSessionId أو eligibleEventIds. يجب أن تضمن طبقة projection/الاستدعاء قيد الرحلة المقصود؛ لا يكفي الاعتماد على الدالة وحدها.
- sessionization.ts يعتمد session IDs المقدمة من المزود، ويستبعد الجلسة كاملة من non-crawler إذا احتوت حدث crawler واحداً؛ ويصرح بأن UA قابل للتزوير. لم يتم اختبار التنفيذ في بيئة تشغيل.

### PR #42 — Keyword visibility and operational workbook

- مقارنة الفرع مع main أظهرت 16 commit ahead و228 behind وحالة diverged؛ لا يصح التعامل معه كفرع متزامن جاهز للدمج.
- ملفات التغيير تشمل operational-workbook.ts وkeyword-clusters.ts واختباراتهما وprobe-answer.ts، إضافة إلى تغييرات غير مرتبطة مباشرة بنطاق workbook في SiteHeader.tsx وsound.ts.
- keyword-clusters.ts يجمع الكلمات وفق أول كلمة رأسية مشتركة بعد stop words؛ التعليق نفسه يوضح أن ذلك قاعدة نصية وليس تجميعاً دلالياً. يجب تسمية المخرجات clusters heuristic وعدم عرضها كعناقيد semantic مثبتة.
- في keyword-clusters.ts، الدالتان answeredClusterCount() وbillableClusterCount() لهما التنفيذ نفسه حرفياً (كلتاهما تعدان status=answered)، رغم اختلاف الوصف: الأولى direct primary والثانية أي إجابة قابلة للفوترة. لا يوجد تمييز فعلي لمسار fallback.
- clusterScore() لا يفلتر provider_path === fallback، وبالتالي يمكن أن تدخل إجابات fallback في قياس ظهور الكلمات داخل cluster.
- shareOfVoice() يفلتر status === answered فقط، ولا يطبق شرط المسار primary رغم تعليق الدالة الذي يصف direct primary answers. هذا يخلق عدم اتساق مع منطق per-keyword الذي يستبعد fallback من بعض الحسابات.
- probe-answer.ts يستخرج الروابط من حقول النموذج/النص، ثم linkSources() لا يعيد إلا عناصر من قائمة searchItems الفعلية؛ هذه حماية من اختراع سجل مصدر جديد، لكنها لا تثبت أن نتيجة البحث تدعم الادعاء أو أن ذكر النطاق/العلامة entailment صحيح. لا تعتبر Claim verification.
- بعض اختبارات workbook تثبت الفصل بين unasked = Not measured وasked with no literal mention = 0/N، وهذه قاعدة عرض صحيحة من حيث عدم تحويل غير المقاس إلى صفر؛ لكن لا تغطي الاختبارات حالة fallback في cluster وshare-of-voice.
- يجب إصلاح تمييز primary/fallback وتغطية الاختبارات قبل اعتماد هذه الحسابات كمقاييس ظهور.

### PR #53 — External skill registry foundation

- مقارنة الفرع مع main أظهرت 41 commit ahead و103 behind وحالة diverged.
- تمت مراجعة external-skill-registry.ts وexecution-evidence-pack.ts وquality-evaluation.server.ts وعينات من الاختبارات/المواصفات.
- سجل الحزم يعرّف 70 package variants و69 skill names، مع الاحتفاظ بنسختين من Humanizer. القيم المعلنة في stats تتسق مع هذا التصميم؛ لم يظهر تناقض عددي في الملف المفحوص.
- كل الحزم تبقى candidate وreference_only وexecutionAllowed: false. ملفات الترخيص الموجودة موسومة review_required، والتي لا تحتوي license file موسومة unknown؛ لا يوجد اعتماد على أنها مرخصة لمجرد وجودها في السجل.
- execution-evidence-pack.ts يصرح أن مخرجات الأدوات في التشغيل ليست تحققاً مستقلاً من المصادر، ويحافظ على الفشل/القيود والحدود الحجمية؛ هذا فصل سليم بين نجاح التنفيذ والتحقق الخارجي.
- quality-evaluation.server.ts لا يصدر quality score؛ يصدر وقائع تشغيل قابلة للرصد ويضع معايير الجودة not_measured حتى تتوفر ground truth أو evaluators. هذا يمنع تحويل نجاح الأداة إلى صحة معرفية.
- مقارنة الفرع أظهرت أيضاً تغييرات في SiteHeader.tsx وsound.ts وتعديلات في orchestrator.server.ts؛ يلزم فصلها ومراجعتها ضمن سياقها قبل أي قرار دمج. لا يعني نجاح CI المعلن في وصف PR أن كامل الفرع المتباعد آمن للدمج مع main الحالي.

### أثر هذه المراجعة على خطة التطوير

1. تُنقل فجوات fallback/primary في مقاييس PR #42 إلى سجل عيوب المرحلة الخامسة، ولا تُصلح ضمن المرحلة الأولى.
2. تُسجل حدود Attribution وشرط same-session ضمن متطلبات مراجعة المرحلة الخامسة/الثالثة بحسب موضع الدمج، ولا يُنقل كود PR #73.
3. تُستخدم مبادئ فصل execution evidence عن independent verification وunmeasured quality rubric كمرجع تصميمي في المرحلتين الثالثة والسادسة، دون نسخ الفرع أو اعتماد registry للتنفيذ.
4. لا يُعتمد أي من PR #42 أو #53 أو #73 للدمج من هذه المراجعة؛ فروعها متباعدة، والمراجعة انتقائية، والتحقق التشغيلي غير مكتمل.

### PR #24 — Dardasha contextual chat UI

- تمت مراجعة chat-message-actions.ts واختباراته وAssistantMessage.tsx والجزء المتصل بها من Dardasha.tsx.
- إظهار أدوات النسخ/التصدير/تحويل المهمة يعتمد على عتبات heuristic: 180 حرفاً و28 كلمة، ثم إشارات تحليلية أو بنية Markdown؛ تحويل المهمة يتطلب إشارات إجراء إضافية. الاختبارات تغطي التحية، إجابة تحليلية عربية، وشرحاً وصفياً طويلاً، لكنها لا تغطي لغات/نصوصاً مختلطة أو حالات markdown مشوهة وحدود العتبات.
- normalizeAssistantMarkdown يعالج عدة أنماط شائعة من علامات Markdown المضمنة، مع الحفاظ على fenced code؛ لا توجد في الملف المفحوص اختبارات مقابلة شاملة للـ parser، لذلك لا يُعتمد على المراجعة الساكنة لإثبات سلامة كل الجداول/القوائم/الكود.
- Dardasha يوضح أن تحويل الرد إلى مهمة يمر عبر مسودة وموافقة المستخدم قبل التنفيذ؛ هذا يحافظ على فصل التحضير عن بدء المهمة في الجزء المفحوص.
- الفرع يحتوي أيضاً تعديلات على SiteHeader.tsx وsound.ts خارج نطاق تحسين الدردشة. كما أن مقارنة الفرع مع main أظهرت 14 commit ahead و332 behind وحالة diverged؛ لا يُعامل كفرع جاهز للدمج.
- لا يوجد في هذه المراجعة دليل على فشل وظيفي محدد في PR #24؛ التصنيف الحالي: تحسين UI/UX مشروط باختبارات أوسع ومراجعة التغييرات غير المرتبطة قبل الدمج.

### PR #1 — Skills workspace and background jobs

- مقارنة الفرع مع main: 145 commit ahead و902 behind، وحالة diverged؛ ملفاته تتضمن تغييرات كثيرة في auth/request context/orchestrator/routes وCloudflare config، إضافة إلى migrations مستثناة.
- تمت مراجعة الوحدات pure التالية فقط: job-weight.ts واختباراته وskill-access-policy.ts. تقدير light/medium/deep deterministic heuristic ويصرح بأنه ليس صلاحية أو عرض سعر؛ واختباراته تغطي عتبات أساسية. سياسة الوصول تطبق precedence: user ثم plan ثم global.
- لم تُراجع background-jobs.server.ts أو server routes أو auth أو migrations/Cloudflare wiring؛ لا تُعتمد نتائج وصف PR أو نجاح CI على أنها تحقق runtime. لا قرار دمج.

### PR #3 — Context-aware interview engine

- مقارنة الفرع مع main: 230 commit ahead و876 behind، وحالة diverged؛ التغيير واسع ويتضمن migrations وRLS tests وAPI وUI، وهي خارج نطاق الفحص التشغيلي المسموح.
- تمت مراجعة interview-engine.ts وquestion-bank.ts وعينة كبيرة من اختبارات المحرك بوصفها منطقاً pure فقط. المحرك يدعم target types متعددة، مجالات SEO/AEO/GEO/GSEO، أسئلة شرطية، منع دورات الاعتماد، ترتيب الأولوية، أسئلة required/optional، skip/unknown، وفصل traversal completion عن data completion.
- الاختبارات تغطي سلوكيات مهمة مثل التبعيات الشرطية، المؤشر المحفوظ، التخطي، unknown، اكتمال البيانات، والتحقق من snapshot. لم تُشغّل في هذه البيئة، ولا تثبت صحة API/persistence/resume end-to-end.
- لا تُراجع ترحيلات Supabase أو سياساتها أو ملفات التكامل معها، ولا قرار دمج للفرع المتباعد.

### PR #59 — Free visibility trial

- تأكد اسم الفرع feat/visibility-free-trial-counter. المقارنة مع main: 99 commit ahead و67 behind، وحالة diverged؛ وتتضمن 9 migrations، لذلك لم تُراجع طبقة التخزين أو إعداداتها.
- تمت مراجعة visibility-trial-policy.ts واختباراته: TTL للنتيجة 72 ساعة، ثم cooldown خمس ساعات، وإعادة الأهلية بعد 77 ساعة؛ كما يسمح باسترجاع إضافي واحد فقط قبل انتهاء TTL. اختبارات pure تغطي حدود الوقت والوقت غير الصالح.
- تمت مراجعة TrialKnowledgeSignals.tsx: الواجهة تصف بوضوح أنها عينة من ثلاثة مسارات نموذجية من أصل عشرة، وليست تحققاً مستقلاً أو SEO audit أو Schema.org inspection. هذا إفصاح سليم عن حدود العينة.
- لم تُراجع visibility-trial.server.ts أو APIs أو migrations أو HMAC/locks/cleanup runtime؛ لا يمكن اعتماد سلامة دورة الحجز أو العزل أو الحذف من مراجعة policy وحدها.

### PR #26 — Workspace isolation

- مقارنة الفرع مع main: 48 commit ahead و331 behind، وحالة diverged. قائمة التغييرات تشمل migration في Drizzle وSupabase وتغييرات في وظائف الوكيل والنشر والقنوات ومكونات مساحات العمل.
- لم تُراجع migrations أو Supabase types أو سياسات RLS أو سلوك قاعدة البيانات، التزاماً بحدود النطاق. تمت معاينة أسماء الملفات فقط لتحديد نطاق التغيير؛ لا يوجد حكم على نجاح عزل المستأجرين أو فشله.
- لا يُعتمد PR #26 دون تحقق منفصل مصرح به في نطاق قاعدة البيانات والاختبارات متعددة مساحات العمل.

### خلاصة الفروع المفتوحة ذات الصلة

- الفروع #1 و#3 و#26 و#42 و#53 و#59 و#73 جميعها متباعدة عن main في المقارنات الحالية؛ لا يجوز استنتاج قابلية الدمج من أعداد ahead أو نتائج CI تاريخية.
- المراجعة الحالية انتقائية ومقصودة: منطق pure وواجهات محددة فقط، مع استبعاد Supabase/DB وملفات الأسرار ومزودي النماذج. لم يُنفذ merge أو cherry-pick أو نشر.

## مصفوفة ربط واجهات الأدوات المباشرة بمسارات التنفيذ

تم تتبع مكونات TOOL_UI في SkillToolsPanel.tsx وDirectToolsPanel.tsx إلى ملفات الواجهة الفعلية، ثم استخراج مسارات API المستخدمة من تلك المكونات. المصفوفة التالية تصف الربط الساكن في main؛ وجود استدعاء في الواجهة لا يثبت نجاح endpoint وقت التشغيل.

| Tool/UI key | مكوّن الواجهة | مسارات التنفيذ المرصودة | الملاحظة |
|---|---|---|---|
| analyze | Sandbox | /api/analyze؛ /api/geo-rewrite | أداة التحليل تتضمن إجراء إعادة كتابة ثانوياً داخل المكوّن نفسه. |
| suggest | PostSuggester | /api/suggest | واجهة توليد المنشورات. |
| compare | CompetitorCompare | /api/compare | alias competitor_compare في toolPath يوجّه إلى هذا المسار، وليس ToolKey مستقلاً. |
| known | KnownDiscovery | /api/known؛ /api/competitor-monitor | اكتشاف المنافسين؛ إجراء المراقبة الثانوي يطلب policy/create من مسار المراقبة. |
| feasibility | FeasibilityStudy | /api/feasibility | تطابق مباشر. |
| bizdev | BizDev | /api/bizdev | تطابق مباشر. |
| brand_boost | BrandBoostAgent | /api/brand-boost؛ /api/brand-authority؛ /api/brand-boost-report-settings | المكوّن يجمع عمليات أساسية وثانوية وإعدادات تقارير؛ لا تختزل جميعها في endpoint واحد. |
| applied_ranking | AppliedRanking | /api/applied-ranking | تطابق مباشر. |
| visibility | VisibilityIntelligence → AIVisibility | /api/visibility؛ /api/site-discovery؛ /api/visibility-baseline | لوحة الرؤية تجمع probe واكتشاف الموقع وتعيين baseline. |
| social_analysis | VisibilityIntelligence → SocialAnalysis | /api/social-analysis؛ /api/site-discovery | نفس الحاوية المرئية مع view اجتماعي متخصص. |
| competitor_monitor | CompetitorMonitor | /api/competitor-monitor | المكوّن موجود في TOOL_UI لكن DirectToolsPanel يعرضه متوقفاً ويمنع الإطلاق؛ endpoint يظهر أيضاً كإجراء مراقبة ثانوي في KnownDiscovery. |
| geo_strategist | GeoStrategist | /api/geo-strategist | تطابق مباشر. |
| what_if | WhatIfSimulator | /api/what-if | تطابق مباشر. |
| research | SmartResearch | /api/research | تطابق مباشر. |
| company_email | CompanyOutreach | /api/company-email | تطابق مباشر. |
| keyword_intelligence | KeywordIntelligence | /api/dual-result؛ /api/keyword-upload | endpoint التحليل هو dual-result؛ keyword-upload مسار رفع الملف المساند. |
| security_scan | SecurityScanCard | /api/security-scan | مكوّن UI إضافي لا يقابله ToolKey أو TOOL_OPTIONS في المصفوفة الحالية. |
| report | ReportBuilder | لا يوجد API route مباشر مرصود في المكوّن | يستخدم captured results وtool-history server functions وقراءات تقارير؛ مسار workspace مستقل وليس ToolKey عادي. |

### نتائج ربط الواجهة بالتنفيذ

1. 17 مكوّناً/مدخلاً فعلياً تتبع إلى أدوات أو مسارات UI، مع وجود Security Scan وReport كمسارين إضافيين خارج ToolKey/TOOL_OPTIONS.
2. بعض الأدوات متعددة المسارات: analyze وbrand_boost وknown وvisibility وsocial_analysis؛ يجب أن تكون العقود على مستوى العملية/الإجراء، لا افتراض endpoint واحد لكل مكوّن.
3. social_analysis وvisibility يعيدان استخدام VisibilityIntelligence لكن يختاران مكوّنين داخليين مختلفين (SocialAnalysis وAIVisibility).
4. keyword_intelligence لديها واجهة مباشرة ومسار تحليل ورفع ملف، لكن فجوة EXECUTABLE_TOOLS السابقة تمنع ضمان إدراجها في خطط المهارات.
5. competitor_monitor ظاهر في سجل UI لكنه disabled في DirectToolsPanel؛ وجود endpoint لا يساوي توفر التنفيذ للمستخدم أو للمنسّق.
6. ReportBuilder ليس endpoint لأداة عادية؛ لا ينبغي إضافته قسراً إلى ToolKey دون تعريف عقد منفصل.
7. لم تُجرَ طلبات HTTP حية إلى هذه المسارات، ولم تُراجع موصلات النماذج أو قاعدة البيانات؛ هذه مصفوفة static wiring فقط.
