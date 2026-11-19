# تدقيق عقود الأدوات والمهارات — المرحلة الثانية

> النطاق: مراجعة ساكنة لفرع main فقط. لم يُعدّل أي كود تطبيقي في هذا التدقيق.
> القيود: لا Supabase/DB/RLS/Auth، لا .env/secrets، لا نماذج أو موصلات أو توجيه مزودي النماذج، لا merge ولا deploy.

## 1. سجل الأعداد والتغطية

| السجل | العدد | الملاحظة |
|---|---:|---|
| TOOL_CATALOG | 24 key | يتضمن أدوات، المنسق، أدوات داخلية ومفاتيح agent |
| TOOL_OPTIONS | 18 key | بيانات وصفية للمدخلات والـ enums وليست JSON Schema كاملة |
| MAAROOF_SKILLS | 21 skill | كل skill يعلن tool keys من الكتالوج |
| EXECUTABLE_TOOLS | 18 key | allowlist مستقلة لإضافة أدوات المهارات تلقائياً |
| toolPath() | 19 mapping | 18 مساراً فعلياً + alias competitor_compare إلى compare |
| ROUTE_LOADERS | 18 route | تتطابق المسارات مع 18 مساراً فعلياً في toolPath |

## 2. تصنيف نمط التنفيذ الحالي

| الفئة | المفاتيح | الحالة |
|---|---|---|
| HTTP/API عبر in-process dispatch أو HTTP fallback | analyze, suggest, compare, known, feasibility, bizdev, research, visibility, brand_boost, company_email, applied_ranking, geo_strategist, social_analysis, what_if, brand_authority, geo_rewrite, keyword_intelligence | مسارات فعلية؛ toolPath وROUTE_LOADERS متطابقان في المسارات الـ18 |
| API متوقف | competitor_monitor | مستبعد من reasoning validation وEXECUTABLE_TOOLS؛ orchestrator يتخطى الخطط القديمة قبل التنفيذ؛ endpoint يعيد temporarily_paused |
| تنفيذ داخلي بلا endpoint | translate, teach_space | مدرجان في EXECUTABLE_TOOLS وينفذان داخل orchestrator |
| منسق/مدخل رئيسي | maaroof | POST /api/maaroof، ليس خطوة فرعية عادية |
| مفاتيح agent خاصة | agent.command, agent.run_targets, agent.visibility | لا تملك ToolOptions أو toolPath كأدوات فرعية |
| alias | competitor_compare | ليس ToolKey؛ يوجّه إلى /api/compare |
| واجهات مستقلة خارج ToolKey | security_scan, report | مسارات مساحة عمل مستقلة، لا تُضاف إلى كتالوج أدوات المنسق تلقائياً |

## 3. عيب ربط مهارة مؤكد: keyword_intelligence

- skill `search_visibility_strategy` تعلن الأدوات: keyword_intelligence, analyze, research, compare, known, visibility, geo_strategist, applied_ranking.
- `keyword_intelligence` موجود في TOOL_CATALOG وTOOL_OPTIONS وtoolPath() وROUTE_LOADERS، وreasoning.server.ts يقبله ضمن TOOL_COVERAGE وTOOL_KEYS.
- لكنه غائب عن EXECUTABLE_TOOLS؛ لذلك `executableToolsFor(["search_visibility_strategy"])` يعيده محذوفاً.
- اختبار `skill-inference.test.ts` يثبت هذا الاستبعاد ويتوقع قائمة من سبع أدوات، أي إنه يثبت السلوك الحالي لكنه لا يثبت صحة اكتمال المهارة.
- `agent-input.ts` لا يضع keyword_intelligence ضمن BRAND_KEYS أو REQUIRED_FIELDS. في وضع الحساب الرئيسي دون workspace، يمكن أن تختار chooseSkillsAutonomously المهارة اعتماداً على brand من profile، لكن هذا brand لا يُمرر تلقائياً إلى مدخل keyword_intelligence. endpoint /api/dual-result يحل الهوية من المدخلات أو workspace؛ إذا لم يوجد أي منهما قد يرجع brand_required.
- الاستنتاج: هناك فجوة ربط بين تعريف المهارة والتنفيذ التلقائي وإكمال المدخلات. المعالجة المقترحة في المرحلة الثانية: إدراج الأداة في مصدر تنفيذ موحد، وإضافة mapping لحقول brand/site/category إلى سياق الكيان، وكتابة اختبارات للحساب الرئيسي والـ workspace قبل اعتماد الإصلاح.

## 4. TOOL_OPTIONS ليست عقد تنفيذ موحداً

- النوع الحالي يعرّف tabs وfields وenums فقط.
- `describeToolOptions()` يستخدم fields في وصف التخطيط.
- `enforceEnums()` يحذف القيم غير المقبولة في حقول enums فقط؛ لا يتحقق من أنواع كل حقل، ولا يرفض الحقول غير المعرفة، ولا يثبت أن الحقول المدرجة كلها تقرؤها endpoint.
- `normalizeToolInput()` في orchestrator يطبّع مجموعات محددة من النصوص والقوائم، لكنه ليس validator عاماً ولا allowlist للحقول.
- كل endpoint يحتفظ بمنطق قراءة/تحقق محلي خاص به؛ لذلك TOOL_OPTIONS حالياً مرجع planner/UI وليس contract schema ملزماً.

### اختلافات مؤكدة بين الوصف وبعض ما تقرؤه endpoints

| الأداة | حقول إضافية مرصودة في endpoint | الموجود في TOOL_OPTIONS |
|---|---|---|
| research | include_channels, channel_types | query, mode |
| brand_boost | website_url | brand_name, brand_keywords, platforms |
| social_analysis | official_website | brand, keywords |
| keyword_intelligence (/api/dual-result) | content_language, request_text, text, target_market, geo_scope, live_search, live_search_limit, estimate_only, skip_keyword_pairs, skip_keywords, cluster_limit, sample_limit, markets، إضافة إلى حقول الهوية/المساحة | brand, site, category, competitors, market_text, attachment_id, lang |

ملاحظة: بعض الحقول الإضافية أعلاه خيارات UI/قياس/سياق وليست بالضرورة مدخلات planner مناسبة. يجب تصنيفها إلى user-input أو workspace-derived أو system-injected أو UI-operation قبل نقلها إلى العقد الموحد. لا ينبغي إضافة كل حقل إلى prompt لمجرد أن endpoint يقرأه.

## 5. حقول مطلوبة وإكمال السياق

- `REQUIRED_FIELDS` في agent-input يغطي brand keys والأدوات research/suggest/geo_rewrite.
- لا يغطي keyword_intelligence رغم أن endpoint قد يتطلب brand عندما لا يوجد workspace أو site أو workbook signals كافية.
- لا يوجد حالياً تعريف واحد يجمع: required fields، أنواع الحقول، defaults، enum values، مصدر القيمة، وشرط التوضيح.
- `fillToolInput()` يحافظ على قيمة planner ولا يستبدلها، ثم يملأ brand/keywords/site من السياق للأدوات التي لها mapping صريح. يجب أن تبقى هذه الأولوية ضمن أي عقد موحد.

## 6. تصميم العقد المقترح للمرحلة الثانية

تعريف سجل مركزي pure لكل مفتاح أداة يتضمن:

1. `key` ثابتاً يطابق ToolKey.
2. `status`: active | paused | internal | coordinator | agent_only.
3. `execution.kind`: api | internal | coordinator، مع `path` وHTTP method للأدوات API فقط.
4. `input`: الحقول وأنواعها وrequired/optional وenums وdefaults وحدود الطول.
5. `input.source`: user | workspace | entity_profile | prior_tool | system، لتمييز ما يجب أن يملأه المستخدم عما يحقن تلقائياً.
6. `output`: شكل أعلى مستوى وحقول النتيجة/الأدلة/الأخطاء المتوقعة، دون فرض schema غير مثبت على مخرجات النماذج.
7. `skillExposure`: هل يجوز إدراجها تلقائياً من مهارة؟ ولماذا؟ مع منع paused/internal-only من المرور إلى endpoint.
8. `tests`: مرجع لاختبارات العقد والتطابق بين registry وcatalog وskills وdispatch.

### مبادئ تنفيذ

- لا تُنشأ allowlists متكررة مستقلة إذا أمكن اشتقاقها من contract registry.
- لا تُزال أي أداة أو حقل أو alias قبل توثيق استخدامه واختبار التكافؤ.
- لا يتغير أي endpoint أو موصل نموذج أو ملف مزود ضمن هذه المرحلة.
- لا تُحوّل حقول UI-only إلى prompt planner تلقائياً.
- يظل competitor_monitor paused ولا يُعاد تفعيله.
- يظل translate وteach_space داخليين ولا يُختلق لهما endpoint.
- يظل maaroof منسقاً، وتظل agent.* مفاتيح خاصة.

## 7. خطة الاختبارات المطلوبة قبل تعديل التنفيذ

1. اختبار تطابق كل ToolCatalog key مع contract classification.
2. اختبار أن كل API contract له path واحد وloader واحد، والعكس.
3. اختبار أن كل skill tool إما executable أو مبرر صراحةً بأنه paused/internal/coordinator.
4. اختبار أن كل أداة auto-injected لها required-input mapping واضح.
5. اختبار أن fields/enums/defaults/types في العقد لا تتعارض مع قراءات endpoint الموثقة.
6. اختبار خاص بـ keyword_intelligence في workspace mode وmain-account mode، مع حالات brand/site/attachment مفقودة.
7. اختبار عدم إدراج competitor_monitor في الخطط القابلة للتنفيذ.
8. اختبار أن translate وteach_space يظلان internal، ولا يمران إلى toolPath.

## 8. القرارات المؤجلة

- لم يُعدّل الكود بعد؛ هذه وثيقة تحليل.
- لا قرار بتغيير schemas الخاصة بالـ endpoints قبل اكتمال مصفوفة المدخلات لكل route.
- لا تغيير في CI أو معالجة revert attribution ضمن المرحلة الثانية.
- لا تعديل على Supabase أو ملفات النماذج/المزودين.

## 9. فجوتان إضافيتان في قبول خطة التنفيذ

- `reasoning.server.ts` كان يبني TOOL_KEYS من TOOL_CATALOG حيث group=tools، مع استبعاد competitor_monitor فقط. لذلك كان يقبل `maaroof` كخطوة فرعية رغم أنه منسق ومدخله الحقيقي /api/maaroof وليس له toolPath فرعي، ما قد ينتج unknown_tool عند التنفيذ.
- في المقابل، `teach_space` موجود في EXECUTABLE_TOOLS وضمن مهارة knowledge_training وينفذ داخلياً، لكنه group=agent ولذلك كان reasoning validator يرفضه. هذا يجعل تعريف skill execution غير متسق مع plan validation.
- التعديل الأول في المرحلة الثانية وحّد تصنيف التنفيذ في `src/lib/tool-contracts.ts`: API/internal/coordinator/agent_only، active/paused/special، وplannerSelectable/skillExecutable، مع الحفاظ على alias competitor_compare. أصبح keyword_intelligence وteach_space قابلين للتخطيط، بينما خرج maaroof وcompetitor_monitor وagent.* من خطوات الأدوات الفرعية.

## 10. تغييرات المرحلة الثانية المنفذة على فرع العمل

- إضافة `src/lib/tool-contracts.ts` كسجل تصنيف وتنفيذ مركزي لكل ToolKey، مع اشتقاق المسارات وقابلية التخطيط والتنفيذ للمهارات.
- إضافة `src/lib/tool-contracts.test.ts` لاختبار تغطية catalog/options/route loaders وتصنيف المفاتيح والـ alias.
- تصدير DIRECT_DISPATCH_PATHS من direct-tool-dispatch.server.ts لتمكين اختبار تطابق مسارات التحميل دون تغيير طريقة dispatch.
- تعديل skill-inference.ts لاشتقاق EXECUTABLE_TOOLS من العقود بدلاً من allowlist يدوية.
- تعديل reasoning.server.ts لقبول مفاتيح plannerSelectable فقط، ما يزيل maaroof من الخطوات ويسمح teach_space الداخلي.
- تعديل orchestrator.server.ts لاشتقاق toolPath() ووصف الأدوات من العقد الموحد، وإضافة تطبيع نصي/قائمي لحقول Keyword Intelligence وحقول UI/البحث المرصودة.
- تعديل agent-input.ts لملء brand/site/category لأداة keyword_intelligence من سياق workspace/profile، وقبول site URL صحيح كبديل عن brand، وتمرير URL الكيان السابق في حقل site لا url.
- تحديث اختبارات skill-inference وreasoning وagent-input لتغطية الحالات السابقة.
- لم تتغير أي route endpoint، ولم تتغير Supabase/DB/Auth أو ملفات الأسرار أو موصلات/نماذج/مزودات الذكاء الاصطناعي.

## 11. التحقق المتاح وحدوده

- لم تُشغّل الاختبارات بعد على فرع work؛ workflow الحالي لا يشمل work/** ضمن push filters، ولا يوجد CI run جديد لهذا الفرع.
- لا توجد node_modules/Bun في بيئة الأرشيف السابقة؛ لذلك لا أدعي نجاح Vitest أو TypeScript أو lint أو build لهذه التغييرات.
- أضيفت اختبارات عقد واختبارات regression، لكنها تبقى غير متحققة تشغيلياً حتى تشغيلها في بيئة المشروع.
- يجب مراجعة diff الفعلي ثم تشغيل الاختبارات قبل اعتماد هذه التغييرات أو الانتقال إلى بقية المرحلة الثانية.


## 12. فصل مدخلات المخطط عن واجهة المستخدم والسياق

تم توسيع ToolOptions إلى ثلاث طبقات واضحة:
- `fields`: مدخلات يمكن للمخطط اقتراحها كجزء من المهمة.
- `uiFields`: حقول واجهة/تشغيل مثل رفع المرفقات وخيارات البحث الحي ووضع estimate/expand، ولا تُرسل تلقائياً إلى prompt المخطط.
- `contextFields`: قيم يحقنها النظام من اللغة والنطاق ومساحة العمل وهوية الكيان.

تم تصنيف هذه الطبقات للأدوات الـ18، مع تصحيح حقول معروفة:
- known: إضافة keywords كمدخل planner، والإبقاء على force كخيار UI، وurl كقيمة سياق/alias.
- geo_strategist: إضافة timeframe كمدخل planner.
- research: تصنيف include_channels وchannel_types وforce كخيارات UI.
- visibility: تصنيف background كخيار UI وofficial_website كسياق.
- brand_boost: website_url كسياق.
- social_analysis: official_website كسياق.
- keyword_intelligence: فصل attachment_id وcontent_language والبحث الحي والحدود وخيارات estimate/expand وأسواق/geo scope عن مدخلات planner؛ lang وworkspace_id سياق.

هذا الفصل لا يحول ToolOptions إلى schema runtime؛ لا تزال أنواع الحقول، الحدود العددية، التحقق من URL، والتزامات كل endpoint بحاجة إلى schemas واختبارات أكثر دقة.

## 13. نتائج CI على فرع العمل

- تم توسيع push branch filter في workflow ليشمل work/** على فرع العمل فقط، حتى يمكن التحقق من تغييرات هذه الخطة دون فتح PR أو لمس main.
- في run 44420833674 (commit 137eb0604ef22125da9987d1ecbc33ce0f5ffb86): نجح install؛ 144 test files passed وواحدة failed؛ 743 tests passed و3 skipped. الفشل الوحيد بقي attribution/domain.test.ts بسبب domain.ts المحذوف بواسطة revert 70095aa9. هذا يعني أن suite الجديدة الخاصة بالعقود والـ regression اجتازت التشغيل في هذا run.
- أضيف شرط build step ليعمل بعد نجاح install حتى لو فشلت unit tests، بدلاً من تخطيه بسبب test failure. run 44420981714 بدأ تشغيل build مستقلاً بعد فشل الاختبارات؛ لم يُسجل نجاحه بعد عند آخر مراجعة.
- run 44421120229 على التغييرات الأحدث كان قيد التشغيل؛ لا تُسجل نتيجته قبل اكتماله.

## 14. توحيد metadata الخاصة بإكمال المدخلات

- أضيفت إلى ToolOptions خصائص brandField وrequiredFields وrequiredAnyOf وminLength. أصبحت agent-input.ts تشتق اسم حقل الكيان والحقول المطلوبة وحدود الطول من TOOL_OPTIONS بدلاً من خرائط BRAND_KEYS/REQUIRED_FIELDS المكررة.
- بقي REQUIRED_FIELDS كتصدير متوافق للخلف، لكنه أصبح مشتقاً من metadata.
- analyze يتطلب text بطول 20 حرفاً على الأقل؛ geo_rewrite يتطلب text بطول 25؛ suggest يقبل أحد description أو sourceText أو imageBase64؛ keyword_intelligence يقبل brand أو site صالحاً ببروتوكول HTTP(S).
- تم تعديل رسالة الاستيضاح الخاصة بالنص لتكون عامة لتحليل المحتوى أو إعادة صياغته، بدلاً من ربطها حصراً بـ GEO rewrite.
- أضيفت اختبارات regression لهذه الشروط. لا تُسجل نتيجة تشغيلها إلا من CI run على commit يحتوي هذه التغييرات.

### CI run 44421531884 — verified build baseline

- Commit: 1ebf5cfd08afe2fc640b00dd64e2c5577a8f7ff6.
- Install succeeded.
- Vitest: 144 test files passed, 1 failed (145 total); 745 tests passed, 3 skipped (748 total). The only failed suite remains attribution/domain.test.ts importing the reverted ./domain module.
- Production build succeeded after setting NODE_OPTIONS=--max-old-space-size=4096. Client build completed in 26.66s, SSR in 10.62s, Nitro in 26.74s.
- This confirms the 4GB Node heap setting resolves the observed 2GB heap OOM on that commit. The overall workflow conclusion remains failure only because the known attribution suite fails.
- This run includes the canonical execution registry, tool/skill routing changes, input identity metadata, and their initial regression tests. It predates the later analyze/suggest required-input refinements; those are being checked by subsequent runs.


### CI run 44421646404 — required-input metadata verified

- Commit: 1172250b64338081bcb33285cf958d4bd35c2b23.
- Vitest: 144 files passed, 1 failed; 746 tests passed, 3 skipped (749 total). The only failure is still the pre-existing attribution/domain.test.ts import of the reverted source file.
- Build: client, SSR and Nitro all succeeded with the 4GB Node heap setting (17.56s, 7.78s, 22.32s respectively).
- This run includes the centralized brandField/requiredFields/requiredAnyOf/minLength metadata, analyze 20-character source requirement, suggest source alternatives, keyword identity fallback and corresponding tests. Therefore these tests and production build passed on this commit; overall workflow remains red only due to the unrelated attribution baseline defect.

## 15. CI run 44422028713 — TypeScript and production build

- Commit: c41364810e602cc3a41a8c7b64b12e6d7df84089.
- Vitest: 144 test files passed, 1 failed (145 total); 746 tests passed and 3 skipped (749 total). The only failing test file is attribution/domain.test.ts importing the reverted ./domain module.
- TypeScript: the check ran and reported only errors in the same attribution test file: TS2307 for missing ./domain, followed by TS7006 implicit-any errors for callback parameters whose types depend on that missing module. No TypeScript errors were reported in the modified contract/orchestrator/agent-input files.
- Production build: client 22.57s, SSR 11.41s, Nitro 27.48s; all succeeded with NODE_OPTIONS=--max-old-space-size=4096.
- Conclusion: the run remains failure due the known attribution source/revert inconsistency. The contract changes pass Vitest; the new typecheck is blocked by the same baseline missing file; production build passes.


## 16. استكمال أنواع المدخلات والتحقق وقت التنفيذ — 2026-11-19

- أضيفت `fieldTypes` إلى `ToolOptions` لتوثيق الأنواع المعروفة صراحةً لبعض مدخلات endpoints، مع قيد متعمد: الحقول غير المدرجة تبقى pass-through ولا تُرفض، للمحافظة على توافق الحقول الخاصة بكل route.
- أضيفت `src/lib/tool-input-validation.ts` لتطبيع الأنواع المعلنة فقط: string وstring[] وnumber وboolean وobject. القيم المعلنة غير الصالحة تُحذف من body وتنتج issue محدداً باسم الحقل والنوع المتوقع؛ الحقول غير المعروفة لا تُحذف.
- رُبط التطبيع بمسار التنفيذ في `orchestrator.server.ts` بعد تطبيع المدخلات وتطبيق enums وقبل dispatch. يصدر الحدث `tool_input_warning` عند إسقاط قيم ذات نوع غير صالح.
- أضيفت `src/lib/tool-input-validation.test.ts` لتغطية التحويل الرقمي والمنطقي والقوائم، الحفاظ على false/0، إسقاط القيم غير الصالحة، إبقاء الحقول غير المعلنة، والتحقق من أن metadata لا تشير إلى حقول خارج طبقات fields/uiFields/contextFields.
- هذه ليست بعد JSON Schema كاملة لكل endpoint: لم تُعلن أنواع غير مؤكدة، ولم تُفرض allowlist للحقول، ولم تُخترع حدود قصوى أو defaults غير مثبتة. يجب استكمال المصفوفة route-by-route قبل اعتبار العقود مكتملة.

## 17. تحقق CI الأحدث قبل إضافة fieldTypes

### Run 44422365396

- Vitest: 144 test files passed، وملف واحد failed من أصل 145؛ 747 اختباراً passed و3 skipped (750 إجمالاً).
- الفشل الوحيد: `src/lib/maaroof/attribution/domain.test.ts` لا يجد `./domain`.
- TypeScript: TS2307 للاستيراد المفقود، ثم TS7006 للوسائط التي فقدت أنواعها بسبب غياب المصدر؛ لا توجد أخطاء مسجلة في ملفات العقد/المنسق المعدلة في هذا التشغيل.
- Production build: نجح؛ اكتمل بناء Nitro في 28.44 ثانية.
- هذا التشغيل يسبق commits الخاصة بـ `fieldTypes` و`tool-input-validation`؛ لا يُستخدم لإثبات صحتها. يلزم CI جديد على HEAD الحالي.

## 18. الحالة الحالية للمرحلة الثانية

- مكتمل على الفرع: سجل تصنيف التنفيذ المركزي، اشتقاق planner/skill eligibility، مطابقة catalog/options/dispatch، metadata الهوية والحقول المطلوبة، وإضافة طبقات planner/UI/context.
- بدأ ولم يكتمل: أنواع الحقول المعلنة وتطبيعها وقت التنفيذ؛ التغطية الحالية انتقائية ومقصودة وليست schema شاملة.
- المتبقي قبل الإغلاق: تشغيل CI على أحدث HEAD؛ مراجعة أنواع وقيود كل endpoint مقابل route الفعلي؛ اختبار المدخلات المطلوبة لـ keyword_intelligence في workspace/account mode؛ مراجعة output/result contract لكل أداة؛ مراجعة diff النهائي وحصر الملفات المستثناة؛ وتحديث معايير القبول.
- لا يبدأ Phase 3 قبل إغلاق Phase 2 وفق معايير القبول.


## 19. عقود مخرجات API — مراجعة ساكنة

أضيفت إلى `ToolExecutionContract` خاصية `output` للأدوات الـ18 ذات المسارات API، وتتضمن:
- نوع النقل: JSON، أو SSE للأداة `known` التي ترسل حدث `result` وحدث `error`.
- نوع الغلاف الأعلى: كائن أعلى المستوى، أو غلاف `result`، أو event stream، أو استجابة الأداة المتوقفة.
- أسماء الحقول العليا المستقرة التي شوهدت في مسار النجاح.
- حقل الخطأ `error`، بما في ذلك payload خطأ SSE.

أضيف اختبار يضمن وجود output contract لكل API key، ويثبت نوع نقل `known`، وحالة `competitor_monitor` المتوقفة. هذه metadata وصفية مبنية على مخرجات route المرصودة؛ لا تتحقق من payload runtime ولا تفرض schema على استجابات النماذج الديناميكية. ما زالت بعض الحقول الداخلية الديناميكية بحاجة إلى توثيق تفصيلي عند الحاجة، ولا يُدعى اكتمال schema لكل نتيجة.


## 20. إكمال مدخلات ومخرجات الأدوات الداخلية

- أضيفت metadata مدخلات داخلية منفصلة عن `TOOL_OPTIONS` حتى لا يتغير اختبار تطابق TOOL_OPTIONS مع API routes:
  - `translate`: مدخل اختياري `target_lang`، وسياق اللغة والنتائج السابقة.
  - `teach_space`: لا يعلن مدخلات planner؛ يعتمد على الهدف والنتائج السابقة وسياق مساحة العمل.
- أضيفت output contracts داخلية:
  - `translate`: `target_lang`, `text`, `charged`.
  - `teach_space`: `saved_facts`.
- أصبح اختبار العقد يتحقق من وجود output لكل أداة skillExecutable، ومن وجود input metadata للأدوات الداخلية دون اختلاق API path.
- تظل مخرجات العقود وصفية وليست runtime validators، كما أن تكلفة الأداة وصلاحياتها التفصيلية لم تُحوّل بعد إلى حقول مركزية موثقة.


## 21. حدود التفويض والملكية المالية

أضيفت إلى كل `ToolExecutionContract` حقول ملكية واضحة:
- `authorizationOwner`: route للأدوات API والمنسق ذي entry route، orchestrator للأدوات الداخلية التي تعمل ضمن run مصادق عليه، وnone لمفاتيح agent الخاصة غير القابلة للتنفيذ المستقل.
- `billingOwner`: route للأدوات API النشطة، orchestrator لأداة الترجمة والمنسق، وnone للأداة الداخلية التعليمية غير المفوترة والأداة المتوقفة ومفاتيح agent.

هذه الحقول تحدد موضع المسؤولية ولا تعيد تنفيذ المصادقة أو الخصم ولا تتجاوز route guards. لم تُضف أسعاراً رقمية أو تقديرات تكلفة؛ لا تزال التكلفة الفعلية متفاوتة بحسب endpoint والـ plan والاستخدام، وتحتاج إلى تدقيق مستقل قبل تحويلها إلى أرقام مركزية.


## 22. مراجعة type metadata وتثبيت حدود التفويض

- راجعت استعمالات الحقول ذات الأنواع المعلنة في endpoints ذات الصلة: القوائم تُقرأ كمصفوفات، الحقول المنظمة مثل `websites` و`goals` و`changes` و`axes` تُمرر ككائنات، والحقول العددية/المنطقية تُحوّل وفق طريقة قراءة route.
- أضيف اختبار للقيم المنظمة واختبار للقوائم المفصولة بسطر جديد؛ وصُحح delimiter regex ليعالج newline فعلياً لا الحرفين backslash/n.
- أضيفت ملكية المصادقة والفوترة إلى العقد: API النشط route-owned، coordinator محمي عبر entry route، الأدوات الداخلية ضمن سياق orchestrator، والـ paused/agent-only لا تُفوتر من مسار التنفيذ الفرعي.
- هذه المراجعة لا تعني تغطية كل مدخل في كل route؛ الحقول غير المعلنة لا تزال pass-through. ولا توجد أسعار رقمية مركزية أو output runtime validation.
- لا يوجد حتى هذه المراجعة status check ظاهر للـ commits الأخيرة عبر واجهة حالة commit؛ لذلك لا تُسجل نجاح اختبارات أو TypeScript أو build للتغييرات الأحدث. أحدث CI مثبت بالأرقام هو run 44422365396 السابق لهذه التغييرات.


## 23. إسقاط بيانات الكتالوج داخل العقد الموحد

أضيفت `catalog` إلى `ToolExecutionContract` وتُشتق من `TOOL_CATALOG` دون نسخ أو تعديل سجل النماذج:
- labels باللغات الثلاث.
- dna كملخص وصفي.
- `costPerRun` بوصفه وحدات المهام/التحليلات الحالية لكل تشغيل، وليس سعراً نقدياً.
- `costProfile` و`riskLevel` والقدرات ونقاط القوة/الضعف والسياسات والمعرفة المطلوبة.
- لم تُنقل `preferredModels` أو بيانات اختيار النماذج إلى العقد الجديد.

أضيف اختبار يضمن وجود بيانات الكتالوج لكل ToolKey، وصحة costPerRun، وعدم تسريب حقل preferredModels إلى إسقاط العقد. تبقى التكلفة النقدية الفعلية وحقوق الوصول الدقيقة على مستوى endpoint بحاجة إلى تدقيق مستقل؛ `authorizationOwner` و`billingOwner` يحددان موضع المسؤولية فقط.


### تصحيح ملكية الفوترة الداخلية

تم تصحيح تصنيف `teach_space`: رغم أنه لا ينفذ `chargeTokens` مستقلاً في فرعه الداخلي، فإن له `costPerRun` في كتالوج الأدوات ويعمل داخل run المنسق؛ لذلك تبقى ملكية احتساب تكلفته على orchestrator، لا `none`. لا يثبت هذا وحده خصماً نقدياً مستقلاً.


## 24. توحيد تطبيع المدخلات حسب الأداة

ظهرت أثناء مراجعة Body types حالة تعارض لا يمكن حلها بتصنيف عام حسب اسم الحقل وحده:
- `compare.competitors` مصفوفة.
- `feasibility.competitors` نص.
- `geo_strategist.goals` كائن.
- `bizdev.goals` نص.

لذلك نُقلت `normalizeToolInput` إلى `tool-input-validation.ts` وأصبحت تستقبل tool key، وتعطي أولوية إلى `TOOL_OPTIONS[tool].fieldTypes` قبل قواعد التطبيع العامة القديمة. هذا يمنع تحويل الحقل نفسه إلى شكل واحد لجميع الأدوات.
- أضيف النوع `string|number` للحقول التي يعرّفها route بهذا الشكل، مثل budget/revenue/team_size/timeline.
- وسّعت أنواع الحقول للنصوص والقوائم والأرقام والمنطق والكائنات في الأدوات التي تمت مراجعة Body/usage الخاص بها.
- أضيفت اختبارات تبين اختلاف competitors وgoals حسب الأداة، وتحافظ على القيم العددية، وترفض object في الحقول scalar.
- بقيت الحقول غير المصنفة pass-through؛ لا تزال بعض endpoints لا تملك Body type صريحاً، وبعض القيم تقبل صيغاً متعددة. لا يُدعى اكتمال schema شاملة حتى تغطية كل حقل من المصدر.



## 25. تغطية إضافية لأنواع حقول endpoints

وسعت `fieldTypes` لتشمل الحقول النصية وحقول UI والسياق التي تم التحقق من استخدامها، مع دعم `string|number` للحقول التي تقبل النوعين صراحةً في Body (مثل budget/revenue/team_size/timeline). كما أُضيفت أنواع imageBase64/imageMime وwebsite_url/official_website وgeo_scope بحسب مواضعها في طبقات UI/context.
- تمت مراجعة `dual-result.geo_scope` وتأكد أنه كائن؛ لذلك صُنّف object.
- تمت مراجعة `research.force` وتأكد أنه boolean.
- نُقلت `normalizeToolInput` إلى الوحدة المستقلة وأصبحت tool-aware، مع أولوية النوع الخاص بالأداة على التصنيف العام. الاختبارات تغطي اختلاف `competitors` و`goals` بين الأدوات.
- لم يُجرَ تشغيل Vitest/tsc/build على هذه التغييرات بعد؛ لا يوجد status check متاح للـ commits الجديدة عبر الأداة المستخدمة. يجب عدم اعتبار هذه المرحلة متحققة تشغيلياً.


## 26. معالجة اختلاف الأنواع بين الأدوات في نقطة التطبيع

- تم نقل `normalizeToolInput` من orchestrator إلى `tool-input-validation.ts` لتصبح وحدة مستقلة قابلة للاختبار.
- أصبحت الدالة تستقبل `toolKey`، وتطبق `fieldTypes` الخاصة بالأداة قبل fallback إلى قواعد التطبيع القديمة.
- عولج تعارض مثبت في الحقل `competitors`: string في feasibility مقابل string[] في compare، وكذلك `goals`: string في bizdev مقابل object في geo_strategist.
- أضيف دعم `string|number` دون تحويل القيمة الرقمية إلى نص، مع إسقاط object غير صالح.
- رُبطت الدالة بالمنسق قبل `coerceToolInput` وdispatch؛ لا تغيير في endpoints نفسها.
- لا تزال هذه التغطية تعتمد على الحقول التي أمكن تثبيت أنواعها من route source. لم يُنفذ بعد تشغيل الاختبارات/TypeScript/build على HEAD الحالي؛ CI مثبت بالأرقام فقط حتى run 44422365396 الأقدم.


## 27. مراجعة أخيرة لقيم النصوص غير المطابقة

- عُدّل التطبيع ليحافظ على القيم غير المطابقة للنوع المعلن حتى تصل إلى `coerceToolInput` وتنتج `tool_input_warning` بدلاً من تحويل object إلى JSON string داخل حقل نصي.
- أضيف اختبار يثبت رفض object في حقل نصي معلن.
- القيم المعلنة الصحيحة تستمر بالتطبيع، والقيم غير المعلنة تستمر pass-through.
- لا تزال نتيجة CI/tsc/build لـ HEAD الحالي غير متاحة عبر combined status؛ لا تُسجل هذه التغييرات على أنها مجتازة.


## 28. بوابة التحقق قبل الاستيضاح والتنفيذ

- تم نقل تطبيع المدخلات والتحقق من أنواعها إلى ما قبل `missingFields` في orchestrator.
- أصبحت الحقول المطلوبة تُفحص بعد التطبيع والتحقق، فلا يمر object غير صالح كقيمة brand/text مطلوبة إلى endpoint ثم يفشل لاحقاً.
- عند وجود قيمة اختيارية غير مطابقة، يصدر `tool_input_warning` ويستمر التنفيذ بعد إسقاطها؛ وعند فقدان حقل مطلوب، يطلب المنسق الاستيضاح قبل إنشاء specialist أو dispatch.
- تم الحفاظ على skip الخاص بالمنافسين بعد التحقق من الشكل الموحّد، مع استمرار رفض أسماء placeholders.
- تمت معالجة القوائم الفارغة الصريحة، والقيم غير الصالحة داخل القوائم، حتى لا تتحول مصفوفة فارغة مقصودة إلى default غير مقصود.
- هذه تغييرات منطقية لم يُثبت تشغيلها بعد على CI؛ يلزم فحص HEAD الأحدث.



## 29. عقد موحد للمهارات وربطه بالتنفيذ

- أضيف `src/lib/maaroof/skill-contracts.ts` لاشتقاق عقد لكل مهارة من `MAAROOF_SKILLS` وعقود الأدوات.
- يتضمن العقد: الهدف متعدد اللغات، ترتيب الأدوات المعلن، دلالة ترتيب التنفيذ الفعلية، عقد المدخلات/المخرجات لكل أداة، نموذج نتائج كل أداة، إطار العرض السباعي، ومعايير قبول بنيوية.
- دلالة الترتيب موثقة بدقة: خطوات المخطط الموجودة تبقى أولاً؛ الأدوات الناقصة التي تضيفها المهارة تُلحق بترتيب الكتالوج. لا يُدعى أن ترتيب الكتالوج يفرض إعادة ترتيب خطوات المخطط.
- تم تعديل `executableToolsFor` ليقرأ من عقد المهارة، مع إعادة التحقق من `EXECUTABLE_TOOLS` و`skillExecutable` قبل الإضافة.
- أضيفت اختبارات تغطي كل المهارات الـ21، وجود عقد مدخلات/مخرجات لكل أداة، ترتيبها، وإطار العرض السباعي.
- معايير النجاح هنا structural contract checks؛ لا تعني أن كل تشغيل فعلي للمهارة سينجح، ولا تستبدل تقييم نتائج التنفيذ.



## 30. حماية تطبيع المدخلات من مفاتيح prototype

- أصبحت حاوية ناتج `normalizeToolInput` ذات prototype فارغ.
- لا تُقرأ metadata لنوع الحقل إلا إذا كان المفتاح موجوداً own-property داخل `fieldTypes`.
- أضيف اختبار لمدخل JSON يحتوي `__proto__` و`constructor`؛ يبقى المفتاحان بيانات عادية ولا يتغير prototype العام.
- هذا hardening محصور في وحدة تطبيع مدخلات الأدوات ولا يغير ملفات أو إعدادات Supabase.



## 31. تحويل متطلبات route إلى استيضاح مضبوط

- أضيف `filterDeclaredNeedFields` لتقييد `need[]` القادمة من استجابة route إلى حقول input المعلنة في عقد الأداة.
- إذا أعاد endpoint خطأ مع حقول `need` معروفة، يحول orchestrator النتيجة إلى حدث `clarify` ونتيجة `needs_input` بدلاً من الاكتفاء بفشل عام.
- تم تحديث keyword_intelligence ليطلب category أو site صالحاً بعد تحقق الهوية؛ الموقع الصالح يتيح للـ route محاولة استنتاج الفئة من دليل الموقع. إذا تعذر الاستنتاج، يعيد route `need:["category"]` ويطلب المنسق توضيحاً.
- تم جعل مجموعات `requiredAnyOf` متدرجة: يُطلب أول شرط غير مستوفى فقط في كل مرة، بدلاً من عرض جميع النواقص دفعة واحدة.
- أضيفت اختبارات لقائمة الحقول المسموحة وسلوك الفئة في keyword intelligence.
