/**
 * Maaroof domain ontology.
 *
 * The registry intentionally distinguishes established standards, common industry
 * terminology, product names, and variable/ambiguous acronyms. It is a routing
 * vocabulary, not a claim that every acronym has one universally accepted meaning.
 * Initial seed: terminology explicitly enumerated in the approved engineering brief.
 * The source workbook must be reconciled before calling this a complete 119-row import.
 */
export type OntologyStatus = "standard" | "established" | "variable" | "ambiguous" | "historical";
export type OntologyDomain =
  | "search_visibility" | "digital_marketing" | "local_entity_schema"
  | "platform_content" | "ai_retrieval_systems";

export type DomainTerm = {
  acronym: string;
  full_name_en: string;
  full_name_ar: string;
  domain_scope: OntologyDomain;
  definition_en: string;
  definition_ar: string;
  semantic_signals: string[];
  linked_tools: string[];
  terminology_status: OntologyStatus;
  notes?: string;
};

const term = (
  acronym: string, full_name_en: string, full_name_ar: string,
  domain_scope: OntologyDomain, definition_en: string, definition_ar: string,
  semantic_signals: string[], linked_tools: string[],
  terminology_status: OntologyStatus = "established", notes?: string,
): DomainTerm => ({
  acronym, full_name_en, full_name_ar, domain_scope, definition_en, definition_ar,
  semantic_signals, linked_tools, terminology_status, ...(notes ? { notes } : {}),
});

export const DOMAIN_ONTOLOGY: readonly DomainTerm[] = [
  // Search and AI visibility
  term("SEO","Search Engine Optimization","تحسين محركات البحث","search_visibility","Improve discoverability and organic search performance through technical, content and authority signals.","تحسين قابلية الاكتشاف والأداء العضوي عبر الإشارات التقنية والمحتوى والموثوقية.",["crawlability","indexability","metadata","headings","internal_links","organic_search"],["analyze","keyword_intelligence","applied_ranking"]),
  term("AEO","Answer Engine Optimization","تحسين محركات الإجابة","search_visibility","Structure authoritative content so answer systems can identify and extract direct answers.","تهيئة المحتوى الموثوق كي تتمكن أنظمة الإجابة من تحديد الإجابات المباشرة واستخلاصها.",["direct_answers","question_intent","faq","answer_extraction"],["analyze","known","visibility"]),
  term("GEO","Generative Engine Optimization","تحسين محركات التوليد","search_visibility","Improve the likelihood that generative systems understand, retrieve and cite a brand or source.","تحسين قابلية فهم العلامة أو المصدر واسترجاعه والاستشهاد به في الأنظمة التوليدية.",["entity_clarity","grounded_facts","citations","retrieval"],["analyze","known","visibility","brand_authority"]),
  term("SGE","Search Generative Experience","تجربة البحث التوليدي","search_visibility","Historical Google product terminology for generative search experiences; not a universal ranking metric.","مصطلح تاريخي لتجربة البحث التوليدي من Google وليس مقياس ترتيب عاماً.",["generative_search","search_overview"],["research","visibility"],"historical","Google product terminology; do not treat as an active independent engine."),
  term("SGEO","Maaroof Search Generative Ecosystem Index","مؤشر معروف التكاملي لمنظومة البحث التوليدي","search_visibility","A Maaroof-proposed integrated index that examines overlap, similarity, divergence and complementarity across SEO, AEO, GEO and SGE. It preserves each axis result and must disclose evidence, coverage and uncertainty.","مؤشر تكاملي مقترح من معروف يفحص التقاطع والتشابه والاختلاف والتكامل بين SEO وAEO وGEO وSGE، مع الاحتفاظ بنتيجة كل محور وإظهار الأدلة والتغطية ودرجة عدم اليقين.",["axis_overlap","semantic_similarity","divergence","complementarity","integrated_index","evidence_coverage"],["analyze","visibility"],"variable","Maaroof-origin concept proposal. A web search did not establish prior use of this exact expansion and definition; this is not proof of worldwide novelty, exclusivity or trademark ownership. Do not present a production score until its metrics, normalization and validation protocol are implemented."),
  term("GSEO","Generative Search Engine Optimization","تحسين محركات البحث التوليدي","search_visibility","Variable industry acronym used for generative-search optimization; distinguish from GEO only when the project defines a separate metric.","اختصار متغير الاستخدام لتحسين البحث التوليدي؛ لا يُفصل عن GEO كمقياس إلا بتعريف تشغيلي واضح.",["generative_search","search_engine"],["analyze","visibility"],"variable","Non-standard usage; project-specific definition required."),
  term("AIO","AI Optimization / AI Overview Optimization","تحسين الذكاء الاصطناعي / تحسين ملخصات الذكاء الاصطناعي","search_visibility","Ambiguous acronym whose expansion depends on the source and context.","اختصار ملتبس يتغير توسعه بحسب المصدر والسياق.",["ai_optimization","ai_overviews"],["research","analyze"],"ambiguous","Do not infer the intended expansion without context."),
  term("LLMO","Large Language Model Optimization","تحسين نماذج اللغة الكبيرة","search_visibility","Industry term for making content and entities more usable by large language model applications.","مصطلح صناعي لتهيئة المحتوى والكيانات لتكون أكثر قابلية للاستخدام في تطبيقات نماذج اللغة الكبيرة.",["llm_retrieval","entity_context","citations"],["known","visibility","brand_authority"]),
  term("GAIO","Generative AI Optimization","تحسين الذكاء الاصطناعي التوليدي","search_visibility","Optimization for discovery and representation in generative AI systems.","تهيئة الاكتشاف والتمثيل داخل أنظمة الذكاء الاصطناعي التوليدي.",["generative_ai","discovery"],["research","visibility"],"variable"),
  term("GSO","Generative Search Optimization","تحسين البحث التوليدي","search_visibility","Variable term for improving visibility in generative search interfaces.","مصطلح متغير لتحسين الظهور في واجهات البحث التوليدي.",["generative_search","visibility"],["analyze","visibility"],"variable"),
  term("AISO","AI Search Optimization","تحسين البحث بالذكاء الاصطناعي","search_visibility","Industry term for optimizing presence in AI-assisted search experiences.","مصطلح صناعي لتحسين الحضور في تجارب البحث المدعومة بالذكاء الاصطناعي.",["ai_search","retrieval"],["research","visibility"],"variable"),
  term("AI SEO","Artificial Intelligence for Search Engine Optimization","استخدام الذكاء الاصطناعي في تحسين محركات البحث","search_visibility","Use AI methods to support SEO research, analysis and execution; not a separate search standard.","استخدام تقنيات الذكاء الاصطناعي لدعم بحث وتحليل وتنفيذ SEO وليس معيار بحث مستقلاً.",["ai_assisted_seo","automation"],["analyze","keyword_intelligence"]),
  term("VSO","Voice Search Optimization","تحسين البحث الصوتي","search_visibility","Optimize content and local information for voice-query patterns and spoken answers.","تهيئة المحتوى والمعلومات المحلية لأنماط الاستعلام الصوتي والإجابات المنطوقة.",["voice_queries","conversational_queries"],["analyze","keyword_intelligence"]),
  term("ASO","App Store Optimization","تحسين ظهور التطبيقات في المتاجر","search_visibility","Improve an app listing's visibility and conversion in app stores.","تحسين ظهور صفحة التطبيق ومعدل تحويلها داخل متاجر التطبيقات.",["app_listing","store_search","installs"],["research","analyze"]),

  // Digital marketing and growth
  term("SEM","Search Engine Marketing","التسويق عبر محركات البحث","digital_marketing","Paid and organic search marketing activities, depending on market usage.","أنشطة التسويق عبر البحث المدفوع والعضوي بحسب الاستخدام.",["search_campaigns","paid_search"],["keyword_intelligence","research"]),
  term("SMM","Social Media Marketing","التسويق عبر وسائل التواصل الاجتماعي","digital_marketing","Use social platforms to reach audiences and achieve marketing objectives.","استخدام منصات التواصل للوصول إلى الجمهور وتحقيق أهداف التسويق.",["social_campaigns","audience"],["social_analysis","research"]),
  term("SMO","Social Media Optimization","تحسين وسائل التواصل الاجتماعي","digital_marketing","Improve social profiles and content for discoverability and engagement.","تحسين الملفات والمحتوى الاجتماعي لزيادة الاكتشاف والتفاعل.",["social_profiles","engagement"],["social_analysis"]),
  term("SMA","Social Media Advertising","الإعلان عبر وسائل التواصل الاجتماعي","digital_marketing","Paid advertising distributed through social platforms.","الإعلانات المدفوعة الموزعة عبر منصات التواصل.",["paid_social","campaign"],["research","social_analysis"]),
  term("CRO","Conversion Rate Optimization","تحسين معدل التحويل","digital_marketing","Improve the share of visitors completing a defined conversion action.","رفع نسبة الزوار الذين ينفذون إجراء التحويل المحدد.",["conversion","funnel","landing_page"],["analyze","geo_strategist"]),
  term("SXO","Search Experience Optimization","تحسين تجربة البحث","digital_marketing","Improve the end-to-end search experience across relevance, usability and conversion.","تحسين تجربة البحث من البداية إلى النهاية عبر الملاءمة وسهولة الاستخدام والتحويل.",["search_intent","usability","conversion"],["analyze","keyword_intelligence"]),
  term("ORM","Online Reputation Management","إدارة السمعة عبر الإنترنت","digital_marketing","Monitor and manage public reputation signals across online sources.","رصد وإدارة إشارات السمعة العامة عبر المصادر الرقمية.",["reviews","mentions","sentiment"],["known","social_analysis","research"]),
  term("SERM","Search Engine Reputation Management","إدارة السمعة في نتائج البحث","digital_marketing","Manage reputation-related content and results appearing in search engines.","إدارة المحتوى والنتائج المرتبطة بالسمعة في محركات البحث.",["brand_serp","reviews","reputation"],["research","known"]),
  term("PPC","Pay Per Click","الدفع مقابل النقرة","digital_marketing","Advertising pricing model where an advertiser pays per click.","نموذج إعلاني يدفع فيه المعلن مقابل كل نقرة.",["paid_clicks","ad_cost"],["keyword_intelligence"]),
  term("PPA","Pay Per Action","الدفع مقابل الإجراء","digital_marketing","Advertising pricing model where payment is tied to a defined action.","نموذج إعلاني يرتبط فيه الدفع بإجراء محدد.",["action_cost","conversion"],["keyword_intelligence"],"variable"),
  term("CPA","Cost Per Acquisition / Action","تكلفة الاستحواذ / الإجراء","digital_marketing","Cost attributed to acquiring a customer or completing a defined action.","التكلفة المنسوبة لاكتساب عميل أو إتمام إجراء محدد.",["acquisition_cost","conversion"],["keyword_intelligence"]),
  term("CAC","Customer Acquisition Cost","تكلفة اكتساب العميل","digital_marketing","Average cost of acquiring a new customer.","متوسط تكلفة اكتساب عميل جديد.",["customer_cost","acquisition"],["feasibility","geo_strategist"]),
  term("LTV","Customer Lifetime Value","القيمة العمرية للعميل","digital_marketing","Expected economic value generated by a customer over the relationship lifetime.","القيمة الاقتصادية المتوقعة من العميل طوال مدة علاقته بالنشاط.",["retention","revenue","customer_value"],["feasibility","geo_strategist"]),
  term("CTR","Click Through Rate","معدل النقر إلى الظهور","digital_marketing","Ratio of impressions that result in clicks.","نسبة مرات الظهور التي نتج عنها نقر.",["impressions","clicks"],["keyword_intelligence"]),
  term("CVR","Conversion Rate","معدل التحويل","digital_marketing","Ratio of eligible visits or interactions that complete a conversion.","نسبة الزيارات أو التفاعلات المؤهلة التي تنتهي بتحويل.",["conversion","visits"],["keyword_intelligence","geo_strategist"]),
  term("ROAS","Return On Ad Spend","العائد على الإنفاق الإعلاني","digital_marketing","Revenue attributed to advertising divided by advertising spend.","الإيرادات المنسوبة للإعلانات مقسومة على الإنفاق الإعلاني.",["ad_revenue","ad_spend"],["feasibility","keyword_intelligence"]),
  term("ROI","Return On Investment","العائد على الاستثمار","digital_marketing","Return relative to the cost of an investment.","العائد مقارنة بتكلفة الاستثمار.",["investment","return"],["feasibility"]),
  term("A/B Testing","A/B Testing","اختبار A/B","digital_marketing","Controlled comparison of two variants against a defined outcome.","مقارنة مضبوطة بين نسختين وفق نتيجة محددة.",["experiment","variant","conversion"],["analyze"]),
  term("UGC","User Generated Content","المحتوى المنشأ من المستخدمين","digital_marketing","Content created by customers or community members rather than the brand.","محتوى ينشئه العملاء أو أفراد المجتمع بدلاً من العلامة.",["reviews","community_content"],["social_analysis","known"]),
  term("E-E-A-T","Experience, Expertise, Authoritativeness, Trustworthiness","الخبرة والتخصص والموثوقية والجدارة بالثقة","digital_marketing","Google Search quality-rater concepts for evaluating experience, expertise, authoritativeness and trust; not a direct ranking score.","مفاهيم في إرشادات مقيمي جودة البحث لدى Google لتقييم الخبرة والتخصص والموثوقية والثقة؛ وليست درجة ترتيب مباشرة.",["author_bio","sources","trust","first_hand_experience"],["analyze","known","brand_authority"]),

  // Local, entity and structured data
  term("Local SEO","Local Search Engine Optimization","تحسين محركات البحث المحلي","local_entity_schema","Improve visibility for geographically constrained searches and local business listings.","تحسين الظهور للاستعلامات الجغرافية وملفات الأنشطة المحلية.",["NAP","GBP","local_landing_pages"],["analyze","known"]),
  term("International SEO","International Search Engine Optimization","تحسين محركات البحث الدولي","local_entity_schema","Target multiple countries and languages using appropriate localization and technical signals.","استهداف دول ولغات متعددة عبر التوطين والإشارات التقنية المناسبة.",["hreflang","country_targeting","localization"],["analyze","research"]),
  term("Entity SEO","Entity Search Engine Optimization","تحسين ظهور الكيانات في البحث","local_entity_schema","Make an entity's identity, attributes and relationships clear and consistent across sources.","توضيح هوية الكيان وسماته وعلاقاته واتساقها عبر المصادر.",["entity_identity","sameAs","knowledge_graph"],["known","brand_authority","analyze"]),
  term("KGO","Knowledge Graph Optimization","تحسين الرسم البياني المعرفي","local_entity_schema","Improve the consistency and machine-readable connections of entities and their relationships.","تحسين اتساق الروابط المقروءة آلياً بين الكيانات وعلاقاتها.",["knowledge_graph","entity_links","sameAs"],["known","brand_authority"]),
  term("NAP","Name, Address, Phone","الاسم والعنوان ورقم الهاتف","local_entity_schema","Core business identity fields whose consistency supports local entity reconciliation.","حقول الهوية الأساسية للنشاط، ويساعد اتساقها في مطابقة الكيان محلياً.",["business_name","address","phone"],["known","research"]),
  term("GBP","Google Business Profile","الملف التجاري على Google","local_entity_schema","Google's business listing product for managing a business presence on Search and Maps.","منتج Google لإدارة ظهور النشاط التجاري في البحث والخرائط.",["business_listing","maps","reviews"],["known","research"]),
  term("Schema.org","Schema.org","مفردات Schema.org للبيانات المنظمة","local_entity_schema","Shared vocabulary for describing entities and content with structured data.","مفردات مشتركة لوصف الكيانات والمحتوى باستخدام البيانات المنظمة.",["structured_data","entity_type","properties"],["analyze"]),
  term("JSON-LD","JavaScript Object Notation for Linked Data","صيغة JSON للبيانات المترابطة","local_entity_schema","JSON-based serialization for expressing linked data, commonly used for Schema.org markup.","صيغة مبنية على JSON لتمثيل البيانات المترابطة وتستخدم كثيراً مع Schema.org.",["application_ld_json","structured_data"],["analyze"]),
  term("RDF","Resource Description Framework","إطار وصف الموارد","local_entity_schema","W3C framework for representing information about resources and relationships.","إطار من W3C لتمثيل المعلومات عن الموارد والعلاقات.",["triples","linked_data","graph"],["analyze","known"],"standard"),
  term("SERP","Search Engine Results Page","صفحة نتائج محرك البحث","local_entity_schema","The results interface returned for a search query.","واجهة النتائج التي يعرضها محرك البحث لاستعلام معين.",["search_results","snippets","rank"],["research","keyword_intelligence"]),
  term("PAA","People Also Ask","يسأل المستخدمون أيضاً","local_entity_schema","A search-results feature showing related questions.","ميزة في نتائج البحث تعرض أسئلة ذات صلة.",["related_questions","question_intent"],["research","keyword_intelligence"]),
  term("Featured Snippets","Featured Snippets","المقتطفات المميزة","local_entity_schema","Selected search-result excerpts displayed prominently for a query.","مقتطفات مختارة من صفحات الويب تظهر بشكل بارز لاستعلام معين.",["snippet","answer_extraction"],["analyze","research"]),

  // Platforms, commerce and content
  term("ASA","Apple Search Ads","إعلانات البحث من Apple","platform_content","Apple's paid search advertising product for app discovery in App Store.","منتج Apple للإعلانات المدفوعة لاكتشاف التطبيقات في App Store.",["app_store_ads","paid_install"],["research"]),
  term("AEO for Apps","Answer Engine Optimization for Apps","تحسين ظهور التطبيقات في محركات الإجابة","platform_content","Apply answer-oriented entity and content practices to app listings and app documentation.","تطبيق ممارسات الإجابة والكيانات على صفحات التطبيقات ووثائقها.",["app_entity","app_faq","documentation"],["analyze","known"]),
  term("YouTube SEO","YouTube Search Engine Optimization","تحسين الظهور في YouTube","platform_content","Optimize video metadata, channel structure and content relevance for YouTube discovery.","تحسين بيانات الفيديو وهيكل القناة وملاءمة المحتوى لاكتشافه في YouTube.",["video_title","description","chapters"],["research","social_analysis"]),
  term("E-commerce SEO","E-commerce Search Engine Optimization","تحسين محركات البحث للتجارة الإلكترونية","platform_content","Optimize product, category and transactional pages for search discovery.","تحسين صفحات المنتجات والفئات والشراء للاكتشاف عبر البحث.",["product_schema","category_pages","facets","inventory"],["analyze","keyword_intelligence"]),
  term("PSEO","Programmatic Search Engine Optimization","تحسين محركات البحث البرمجي","platform_content","Generate and manage search-targeted pages from structured datasets under quality controls.","إنشاء وإدارة صفحات مستهدفة للبحث من مجموعات بيانات منظمة مع ضوابط الجودة.",["templates","structured_data","scaled_pages"],["analyze","keyword_intelligence"]),
  term("CMS","Content Management System","نظام إدارة المحتوى","platform_content","Software used to create, manage and publish digital content.","برنامج لإنشاء المحتوى الرقمي وإدارته ونشره.",["publishing","content_model"],["analyze"]),
  term("DAM","Digital Asset Management","إدارة الأصول الرقمية","platform_content","Systems for organizing, governing and distributing digital media assets.","أنظمة لتنظيم الأصول الإعلامية الرقمية وحوكمتها وتوزيعها.",["media_assets","metadata","rights"],["research"]),
  term("CMO","Chief Marketing Officer","الرئيس التنفيذي للتسويق","platform_content","Executive role accountable for an organization's marketing direction and performance.","منصب تنفيذي مسؤول عن توجه التسويق وأدائه في المؤسسة.",["marketing_leadership","strategy"],["geo_strategist"],"established"),

  // AI, retrieval and cognitive systems
  term("RAG","Retrieval-Augmented Generation","التوليد المعزز بالاسترجاع","ai_retrieval_systems","Ground model generation in retrieved external or internal evidence.","إسناد توليد النموذج إلى أدلة مسترجعة من مصادر داخلية أو خارجية.",["retrieval","grounding","context"],["research","known"]),
  term("GraphRAG","Graph Retrieval-Augmented Generation","التوليد المعزز بالاسترجاع عبر الرسوم البيانية","ai_retrieval_systems","Use entity graphs and graph traversal to retrieve connected evidence for generation.","استخدام رسوم الكيانات واجتياز الروابط لاسترجاع أدلة مترابطة للتوليد.",["entity_graph","multi_hop","graph_retrieval"],["known","research"]),
  term("KG","Knowledge Graph","الرسم البياني المعرفي","ai_retrieval_systems","Graph representation of entities and their typed relationships.","تمثيل بياني للكيانات والعلاقات المصنفة بينها.",["entities","relations","triples"],["known","brand_authority"]),
  term("LLM","Large Language Model","نموذج اللغة الكبير","ai_retrieval_systems","A neural language model trained on large-scale text or multimodal data.","نموذج لغوي عصبي مدرّب على بيانات نصية أو متعددة الوسائط واسعة النطاق.",["tokens","generation","context_window"],["maaroof","research"]),
  term("SLM","Small Language Model","نموذج اللغة الصغير","ai_retrieval_systems","A comparatively compact language model optimized for constrained deployment or tasks.","نموذج لغوي أصغر نسبياً ومهيأ للتشغيل المقيد أو المهام المحددة.",["low_latency","edge_inference"],["maaroof"]),
  term("MoE","Mixture of Experts","مزيج الخبراء","ai_retrieval_systems","Architecture that routes tokens or inputs through selected expert subnetworks.","بنية توجه المدخلات أو الرموز إلى شبكات خبراء فرعية مختارة.",["expert_routing","sparse_activation"],["maaroof"]),
  term("RL","Reinforcement Learning","التعلم المعزز","ai_retrieval_systems","Learning through actions, rewards and interaction with an environment.","التعلم من خلال الأفعال والمكافآت والتفاعل مع بيئة.",["reward","policy","environment"],["maaroof"]),
  term("RLHF","Reinforcement Learning from Human Feedback","التعلم المعزز من التغذية الراجعة البشرية","ai_retrieval_systems","Use human preference feedback to shape model behavior, often through reward modeling and policy optimization.","استخدام تفضيلات البشر لتوجيه سلوك النموذج، غالباً عبر نمذجة المكافأة وتحسين السياسة.",["human_preferences","reward_model"],["maaroof"]),
  term("DPO","Direct Preference Optimization","تحسين التفضيلات المباشر","ai_retrieval_systems","Optimize a model directly from preference pairs without a separate online RL loop.","تحسين النموذج مباشرة من أزواج التفضيل دون حلقة تعلم معزز متصلة منفصلة.",["preference_pairs","alignment"],["maaroof"]),
  term("PEFT","Parameter-Efficient Fine-Tuning","الضبط الدقيق الكفؤ للمعلمات","ai_retrieval_systems","Adapt a pretrained model by updating a small subset of parameters or added modules.","تكييف نموذج مدرب مسبقاً بتحديث مجموعة صغيرة من المعلمات أو الوحدات المضافة.",["adapter","low_rank","fine_tuning"],["maaroof"]),
  term("LoRA","Low-Rank Adaptation","التكييف منخفض الرتبة","ai_retrieval_systems","Parameter-efficient adaptation method that learns low-rank updates to model weights.","طريقة تكييف كفؤة تتعلم تحديثات منخفضة الرتبة لأوزان النموذج.",["low_rank_matrices","adapter"],["maaroof"]),
  term("RRF","Reciprocal Rank Fusion","دمج الرتب التبادلي","ai_retrieval_systems","Rank-fusion method combining multiple ranked retrieval lists using reciprocal rank contributions.","طريقة لدمج قوائم استرجاع مرتبة متعددة باستخدام مساهمات الرتب التبادلية.",["hybrid_retrieval","rank_fusion"],["research"]),
  term("BM25","Best Matching 25","أفضل تطابق 25","ai_retrieval_systems","Lexical relevance ranking function based on term frequency, inverse document frequency and document length normalization.","دالة ترتيب للاسترجاع المعجمي تعتمد تكرار المصطلح وندرته وطول المستند.",["lexical_search","term_frequency","inverted_index"],["research"]),
  term("ANN","Approximate Nearest Neighbors","أقرب الجيران التقريبيون","ai_retrieval_systems","Algorithms for efficiently finding approximately nearest vectors or points.","خوارزميات للعثور بكفاءة على المتجهات أو النقاط الأقرب بصورة تقريبية.",["vector_search","nearest_neighbors"],["research"]),
  term("HNSW","Hierarchical Navigable Small World","العالم الصغير القابل للتنقل الهرمي","ai_retrieval_systems","Graph-based approximate nearest-neighbor index for fast vector similarity search.","فهرس قائم على الرسوم البيانية للبحث السريع التقريبي عن تشابه المتجهات.",["vector_index","graph_index","ann"],["research"]),
  term("MMR","Maximal Marginal Relevance","الملاءمة الهامشية القصوى","ai_retrieval_systems","Retrieval/reranking method balancing query relevance with diversity among selected results.","طريقة استرجاع أو إعادة ترتيب توازن بين ملاءمة الاستعلام وتنوع النتائج المختارة.",["reranking","diversity","relevance"],["research"]),
  term("MCP","Model Context Protocol","بروتوكول سياق النموذج","ai_retrieval_systems","Protocol for connecting AI applications to external tools and context providers.","بروتوكول لربط تطبيقات الذكاء الاصطناعي بالأدوات ومزودي السياق الخارجيين.",["tool_connectors","resources","prompts"],["maaroof"]),
  term("A2A","Agent2Agent Protocol","بروتوكول التواصل بين الوكلاء","ai_retrieval_systems","Protocol family for interoperable communication and task delegation between agents.","عائلة بروتوكولات للتواصل وتفويض المهام بين الوكلاء بصورة متوافقة.",["agent_discovery","task_delegation"],["maaroof"],"variable","Protocol naming and versions evolve; pin the implementation specification."),
  term("MAS","Multi-Agent System","نظام متعدد الوكلاء","ai_retrieval_systems","System composed of multiple agents that coordinate or interact to achieve goals.","نظام يتكون من عدة وكلاء يتنسقون أو يتفاعلون لتحقيق أهداف.",["orchestration","coordination","delegation"],["maaroof"]),
  term("LTR","Learning To Rank","التعلم من أجل الترتيب","ai_retrieval_systems","Machine-learning methods that optimize ranking functions from relevance judgments or interaction data.","طرق تعلم آلي لتحسين دوال الترتيب من أحكام الملاءمة أو بيانات التفاعل.",["ranking_model","relevance_labels"],["research"]),
  term("MLOps","Machine Learning Operations","عمليات تعلم الآلة","ai_retrieval_systems","Practices for deploying, monitoring and governing machine-learning systems in production.","ممارسات نشر أنظمة تعلم الآلة ومراقبتها وحوكمتها في الإنتاج.",["model_deployment","monitoring","versioning"],["maaroof"]),
  term("LLMOps","Large Language Model Operations","عمليات نماذج اللغة الكبيرة","ai_retrieval_systems","Practices for operating, evaluating, monitoring and governing LLM applications.","ممارسات تشغيل تطبيقات نماذج اللغة الكبيرة وتقييمها ومراقبتها وحوكمتها.",["prompt_versioning","model_eval","observability"],["maaroof"]),
  term("Evals","Evaluations","التقييمات","ai_retrieval_systems","Repeatable evaluations that measure model or system behavior against defined tasks and criteria.","تقييمات قابلة للتكرار تقيس سلوك النموذج أو النظام وفق مهام ومعايير محددة.",["test_sets","rubrics","regression"],["maaroof"]),
] as const;

export const DOMAIN_ONTOLOGY_BY_ACRONYM: ReadonlyMap<string, DomainTerm> = new Map(
  DOMAIN_ONTOLOGY.map((entry) => [entry.acronym.toLowerCase(), entry]),
);

export function findDomainTerms(query: string, limit = 12): DomainTerm[] {
  const q = query.toLowerCase();
  if (!q.trim()) return [];
  const tokens = q.split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
  const ranked = DOMAIN_ONTOLOGY.map((entry) => {
    const haystack = [entry.acronym, entry.full_name_en, entry.full_name_ar, ...entry.semantic_signals].join(" ").toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? (token === entry.acronym.toLowerCase() ? 4 : 1) : 0), 0);
    return { entry, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return ranked.slice(0, Math.max(0, limit)).map((item) => item.entry);
}
