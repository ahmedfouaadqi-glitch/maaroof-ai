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
