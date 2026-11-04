import type { ToolKey } from "../tool-catalog";

export type ExternalSkillLifecycle = "candidate" | "approved" | "deprecated" | "blocked";
export type ExternalSkillRisk = "low" | "moderate" | "high" | "critical";
export type ExternalSkillLicenseStatus = "verified" | "review_required" | "unknown";
export type ExternalSkillVariantDisposition = "single_candidate" | "preferred_candidate" | "alternate_candidate";

export interface ExternalSkillPackage {
  id: string;
  canonicalName: string;
  version: string;
  variantDisposition: ExternalSkillVariantDisposition;
  source: {
    archiveName: string;
    sha256: string;
    archiveBytes: number;
    fileCount: number;
    importedAt: "2026-11-04";
    licenseFiles: string[];
    licenseStatus: ExternalSkillLicenseStatus;
  };
  contentIndex: {
    coreRef: string;
    referenceIndexRef: string | null;
    referenceCount: number;
    evalIndexRef: string | null;
    evalFileCount: number;
    bundledScriptCount: number;
  };
  capabilityBindings: Array<{
    targetType: "tool";
    targetId: ToolKey;
    role: "primary" | "supporting";
    required: false;
  }>;
  governance: {
    lifecycle: ExternalSkillLifecycle;
    risk: ExternalSkillRisk;
    loadMode: "reference_only";
    evidenceRequired: boolean;
    requiresApproval: boolean;
    executionAllowed: false;
  };
}

type RawPackage = {
  name: string; version: string; sha: string; archive: string;
  bytes: number; files: number; refs: number; evals: number; scripts: number;
  licenses: string[];
};

/** 70 unique source variants after exact duplicate removal; both Humanizer variants retained. */
const RAW_PACKAGES: RawPackage[] = [
  {name:"alternative-blog-writer",version:"unversioned",sha:"3693e6646959d856219bb8fd1cce0e0a6c7b88b54ed0b8d440b802a992e7675e",archive:"alternative-blog-writer.zip",bytes:11741,files:3,refs:1,evals:0,scripts:0,licenses:["LICENSE.txt"]},
  {name:"dispatching-parallel-agents",version:"unversioned",sha:"2e5f18b30479092e903a4b107355d3ddcd28540f687e7e58307002c23bbfded4",archive:"archive (1).zip",bytes:6078,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"marketing-ideas",version:"unversioned",sha:"2629b6a3c85a1534d7e9bfb90c1c3215b3ec7b4f1468fb9301b0bf4f33a098fa",archive:"archive (10).zip",bytes:33815,files:4,refs:2,evals:1,scripts:0,licenses:[]},
  {name:"muapi-product-campaign",version:"1.0.0",sha:"1ed7f0c1b699cfaed61e3f2a5abaa33b868f0b86b0ab3607f676dee08ca80124",archive:"archive (11).zip",bytes:4557,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"kpi-dashboard-design",version:"unversioned",sha:"d7d20ed63a67baa529fb681561b5b6397d104f061d36a1fb6d1f203ef80c6f81",archive:"archive (12).zip",bytes:20498,files:2,refs:1,evals:0,scripts:0,licenses:[]},
  {name:"market-research-reports",version:"unversioned",sha:"28fbae8b832d4021cb2d8c60b91824bbbb007e46ce6c8a4c5bba82d08a8fe39a",archive:"archive (13).zip",bytes:193238,files:26,refs:7,evals:0,scripts:8,licenses:[]},
  {name:"copy-editing",version:"unversioned",sha:"dc7a89e74660cd566c7587f19194983df6aa582bb2af7383f110ab97469aef61",archive:"archive (14).zip",bytes:47763,files:5,refs:3,evals:1,scripts:0,licenses:[]},
  {name:"pricing-strategy",version:"unversioned",sha:"fe80fa62d783e96880139fcede84ae3f7d864f16591dd298d03b043ffb064f77",archive:"archive (15).zip",bytes:161666,files:3,refs:2,evals:0,scripts:0,licenses:[]},
  {name:"business-model",version:"unversioned",sha:"a9d686baa1fea7439780fb4722bf05ebf0c3a729539869abba4d13a394dfcdfa",archive:"archive (16).zip",bytes:5784,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"programmatic-seo",version:"unversioned",sha:"50e8559fb36fe007864f92f3ae887506ad9b9cf5e82dc2abbb6ce21f49dada4c",archive:"archive (17).zip",bytes:29826,files:4,refs:2,evals:1,scripts:0,licenses:[]},
  {name:"muapi-ugc-ads-workflow",version:"1.0.0",sha:"7e1d758407697599c6768e0ce65cdc8b17da4f9d6e914afa32cfe798eb954136",archive:"archive (18).zip",bytes:3820,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"account-research",version:"unversioned",sha:"a3ce721977606664c047fb70b615695544aa181e9d3a7df43a96d941644901dd",archive:"archive (19).zip",bytes:9587,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"agent-development",version:"0.1.0",sha:"5297c9dc5bccf8d5e4cf8f06a1318acd2aa6889ceed81c7a7247a2185532cd10",archive:"archive (2).zip",bytes:69333,files:7,refs:3,evals:0,scripts:1,licenses:[]},
  {name:"legal-risk-assessment",version:"unversioned",sha:"651804be922193cec6f90cc98fa8cdc9d616dc25add0357601f444b41051d58c",archive:"archive (20).zip",bytes:12581,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"draft-outreach",version:"unversioned",sha:"80c994c7a03ce7af6a50620f0155c71e4da925e6b2b3a9670b345341633d494e",archive:"archive (21).zip",bytes:11491,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"risk-metrics-calculation",version:"unversioned",sha:"e6497a028cad322b7312b2d7df4102050ce987d83479da58d70f9dbfb632bf7a",archive:"archive (22).zip",bytes:18932,files:2,refs:1,evals:0,scripts:0,licenses:[]},
  {name:"backtesting-frameworks",version:"unversioned",sha:"1233f23ae4e92269335be3aea46208f105524807f617abe4874b3f8b4ce7822a",archive:"archive (23).zip",bytes:21696,files:2,refs:1,evals:0,scripts:0,licenses:[]},
  {name:"memory-management",version:"unversioned",sha:"cf07c9ba22cd0109ff0bf2722e6f2d49df4a7284092336c5994499d5d2d7e225",archive:"archive (24).zip",bytes:8742,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"call-prep",version:"unversioned",sha:"5ba44048632abd744b83dbbf5691b8a195665c9c58eebb5689c6610ba8d0132a",archive:"archive (25).zip",bytes:11197,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"competitive-intelligence",version:"unversioned",sha:"807128cb00c9634d440429a7df4672a19734f7eb5c78d9513b2bac468f8098d2",archive:"archive (26).zip",bytes:10280,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"create-prd",version:"unversioned",sha:"7934c73aab386da45e794743e0605c1ba8c3cb7dc9109f7404fe756a566d1478",archive:"archive (27).zip",bytes:7301,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"market-sizing-analysis",version:"1.0.0",sha:"73ac87e9ec5ac695ac685fa78938f27acda1d7f413cefbb8f7e500527c1d3e8e",archive:"archive (28).zip",bytes:31384,files:4,refs:2,evals:0,scripts:0,licenses:[]},
  {name:"secops-hunt",version:"unversioned",sha:"ede7608acee9ef94423e7caaed5cebba66dadc0fb2b29afb94d22694cef90288",archive:"archive (29).zip",bytes:4362,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"search-strategy",version:"unversioned",sha:"57db08c95dd4bfd3a11927d0244613594a9e336cbb056285af4625e9597ad132",archive:"archive (3).zip",bytes:7198,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"war-council",version:"unversioned",sha:"d8439bfd4dfc647fe9d5a4fb978f1075607e5fe8c337b75b9070acd9a6e3a616",archive:"archive (30).zip",bytes:8235,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"task-management",version:"unversioned",sha:"b2e57e48bef8eddb4d6b58cc12dddeb60e02b3724179a1a5e9b207be2566cd18",archive:"archive (31).zip",bytes:2604,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"audit-support",version:"unversioned",sha:"e09a192438876ff401b68829edd75e0d7a7086047eacac86a66381366dd61678",archive:"archive (32).zip",bytes:16801,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"churn-prevention",version:"unversioned",sha:"68da76f2ea33103d8affbd2819e61f77c228b81ebdc4e8ddbd420ff6ca9a30ab",archive:"archive (33).zip",bytes:52892,files:4,refs:2,evals:1,scripts:0,licenses:[]},
  {name:"obsidian-bases",version:"unversioned",sha:"3911f9848e6e71be3b2565fefa40196991d8205e574857aa8281090325b97072",archive:"archive (34).zip",bytes:20565,files:2,refs:1,evals:0,scripts:0,licenses:[]},
  {name:"metadata-optimization",version:"unversioned",sha:"1e129114f743540cd3408be26f79505820f670092014bc70b54af874be3bb61d",archive:"archive (35)(1).zip",bytes:6026,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"aso-audit",version:"unversioned",sha:"4e81d4e9fca56229080b685cd42fc3b304f3a396b143e13449923454331ac1ae",archive:"archive (36).zip",bytes:6570,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"applying-brand-guidelines",version:"unversioned",sha:"e16af30bb6512ee689f373da7bfe69b261afcbea223298ff876e063294a0435c",archive:"archive (37).zip",bytes:34285,files:4,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"copywriting",version:"unversioned",sha:"deff0e1f6d6bb9569c842e69bcdfe1cf8ebd358b6e36feaa6ba00d063c066020",archive:"archive (38).zip",bytes:69322,files:5,refs:3,evals:1,scripts:0,licenses:[]},
  {name:"humanizer",version:"3.1.0",sha:"ba83233c3694cbd6fb1488630b8e2cfd00861d3cd7df5dde9756ce99c62df353",archive:"archive (39).zip",bytes:65852,files:14,refs:0,evals:0,scripts:1,licenses:["LICENSE"]},
  {name:"content-strategy",version:"unversioned",sha:"70cb3e2016e58c5ef9b834796fc2eb3b25bc8a99eb48da413b6418f39bc10f64",archive:"archive (40).zip",bytes:43736,files:4,refs:2,evals:1,scripts:0,licenses:[]},
  {name:"humanizer",version:"2.1.1",sha:"c8ed619bf7f555fd88599844f6c09556c27f2f2afdfceaa0553f6b254e3fe5b1",archive:"archive (41).zip",bytes:23264,files:2,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"content-creation",version:"unversioned",sha:"0138dc216dcd974ca4c38573501a26687cfc4595375b68af402f169bf28114b1",archive:"archive (42).zip",bytes:8830,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"no-ai-slop",version:"unversioned",sha:"19d7bdad5bf7ed8a6b5a1f46d660e1eee05b715e300841f21525438909ef0ced",archive:"archive (43).zip",bytes:14302,files:3,refs:0,evals:1,scripts:0,licenses:[]},
  {name:"ai-seo",version:"unversioned",sha:"142d57cc83b08aca05452f498a0ce467b1f7ddf1fda8dd10860a249d3b217e52",archive:"archive (44).zip",bytes:186903,files:17,refs:15,evals:1,scripts:0,licenses:[]},
  {name:"knowledge-synthesis",version:"unversioned",sha:"a4d479ba9f32a2c130de7745ea81b26b388fd364bb576a5685408be92781262d",archive:"archive (45).zip",bytes:8526,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"seo-aeo-best-practices",version:"unversioned",sha:"fe3d70795403e82b583b0869970f4ada57222d5c6b4dd2e74d843c3adf856ded",archive:"archive (47).zip",bytes:19659,files:5,refs:4,evals:0,scripts:0,licenses:[]},
  {name:"grammar-check",version:"unversioned",sha:"12bdeaeefa1747c0ce20cff5c261fe7bd4f7e461bb2ea1447c6f9c41810f4e6f",archive:"archive (48).zip",bytes:9673,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"blog-write",version:"unversioned",sha:"292345317cd40bdbe5c48cd8c4fbbe3b1d657f94887b81b1e773d9cafbf57c51",archive:"archive (50).zip",bytes:38835,files:3,refs:2,evals:0,scripts:0,licenses:[]},
  {name:"content-modeling-best-practices",version:"unversioned",sha:"ffce01cca298ef0ce0d48ba97dec4e9995545334c1b82429a569c1ec6a22eb31",archive:"archive (51).zip",bytes:12779,files:5,refs:4,evals:0,scripts:0,licenses:[]},
  {name:"obsidian-canvas-creator",version:"unversioned",sha:"6cdc08eeacef6de16ede6f8f349c0c1c63f9b61ad85a0c54128a154bc7e07ba2",archive:"archive (52).zip",bytes:36356,files:5,refs:2,evals:0,scripts:0,licenses:[]},
  {name:"seo-content-audit",version:"unversioned",sha:"d4eb41c457f2cffd1046e87a45ba465a7ea96b51ea88854b89e412dc44a34217",archive:"archive (53).zip",bytes:31520,files:4,refs:2,evals:0,scripts:0,licenses:[]},
  {name:"research-writing-skill",version:"unversioned",sha:"fd9f3a93a5d971d0325aec325c153533da970d16d8d3cb6cb3fce9fa2718f33d",archive:"archive (54).zip",bytes:125040,files:21,refs:19,evals:2,scripts:0,licenses:[]},
  {name:"stop-slop",version:"unversioned",sha:"2e492e7015de0b973c9b369141c79da325796b9eb22d3d993581d2ce64dcc6e8",archive:"archive (55).zip",bytes:16344,files:7,refs:3,evals:0,scripts:0,licenses:["LICENSE"]},
  {name:"blog-repurpose",version:"unversioned",sha:"6a4ed5679d0d23c1c9c24d97abe47893aad80bd888da9450156a11ab768ee6c7",archive:"archive (56).zip",bytes:14836,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"blog-rewrite",version:"unversioned",sha:"266f54f3055a1cff5fe4da461f6cfb0103e04af3d616802700fef74f5346ec6e",archive:"archive (57).zip",bytes:24174,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"cover-letter-generator",version:"unversioned",sha:"6c38691e0f191bcd164a059050bcde100472b92c3fe2e5400ece3e8cce61532a",archive:"archive (58).zip",bytes:9183,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"agent-md-refactor",version:"unversioned",sha:"ebb66eb6630cce07597951b7fa0b24a2245d62189af8253afc49f7ca83c59207",archive:"archive (59).zip",bytes:14799,files:2,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"marketing-psychology",version:"unversioned",sha:"81724b75f378142183fac2b4e9d456224ee5dd200c422f3e990bd0516e2f193f",archive:"archive (6).zip",bytes:27920,files:2,refs:0,evals:1,scripts:0,licenses:[]},
  {name:"blog-translate",version:"unversioned",sha:"5747b0e9754aa8d682f7b946f2d2506097bab11e6445b534951194cc777a5cde",archive:"archive (60).zip",bytes:28304,files:3,refs:2,evals:0,scripts:0,licenses:[]},
  {name:"blog-factcheck",version:"unversioned",sha:"62492732975071bf7b0a2eb0270636c97eef62e3b63d07f92eff45240663ff62",archive:"archive (61).zip",bytes:10999,files:1,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"crafting-effective-readmes",version:"unversioned",sha:"07780c5b904e9e433a60d37cad36335ee9cf4ede60d6646c0d896f53e9bd17ec",archive:"archive (62).zip",bytes:60214,files:14,refs:5,evals:0,scripts:0,licenses:[]},
  {name:"writing-prds",version:"unversioned",sha:"c40426adbad700f1e8a9cbe9ac209ef9729ed0e5a5e9b90477619ccdef3526bb",archive:"archive (63).zip",bytes:73626,files:3,refs:2,evals:0,scripts:0,licenses:[]},
  {name:"obsidian-markdown",version:"unversioned",sha:"fadec7d09cb25db59882c5a8ffafd723643d8337f2a031ba09b89b9600753fcc",archive:"archive (64).zip",bytes:8615,files:4,refs:3,evals:0,scripts:0,licenses:[]},
  {name:"content-experimentation-best-practices",version:"unversioned",sha:"4afa04f83081c4764f33fd9a6a5cd6b66590e87438b796f0eb93264aa401d763",archive:"archive (65).zip",bytes:23973,files:5,refs:4,evals:0,scripts:0,licenses:[]},
  {name:"agent-reach",version:"unversioned",sha:"5bb386a43ffc195c3a6a4ba9ff775c55abcaa4d2aa94ce41cf6664c5133e5707",archive:"archive (7).zip",bytes:23896,files:5,refs:3,evals:0,scripts:0,licenses:[]},
  {name:"scrapling",version:"unversioned",sha:"a1fb3047aa0297096a57541b5d08d40c31fdbd841a90aaf43fc1b170addf6b0f",archive:"archive.zip",bytes:42688,files:16,refs:7,evals:0,scripts:0,licenses:["LICENSE"]},
  {name:"comparison-article-writer",version:"unversioned",sha:"d61c7cd3858b8d631d4c7d8aa75daccc56bfaa1793fd95bf96c720a3ede776d6",archive:"comparison-article-writer.zip",bytes:18546,files:2,refs:1,evals:0,scripts:0,licenses:[]},
  {name:"content-gap-analysis",version:"unversioned",sha:"0c62c2f58d3f4071ceaf8cd0d3d115e1fb0d55bc0ca8c3272a35cf0a7b268ed0",archive:"content-gap-analysis.zip",bytes:80494,files:12,refs:0,evals:0,scripts:9,licenses:[]},
  {name:"keyword-research",version:"unversioned",sha:"a965aa4e6a0da06a094dbadc1507293b47b701ee41ef6716bb3a7c6501988f00",archive:"keyword-research (1).zip",bytes:22826,files:3,refs:1,evals:0,scripts:1,licenses:[]},
  {name:"listicle-blog-writer",version:"unversioned",sha:"0b585d8512d4054af569f884d98e67ce0c751c12084695a4a7fd476f2b17018a",archive:"listicle-blog-writer.zip",bytes:14927,files:3,refs:1,evals:0,scripts:0,licenses:["LICENSE.txt"]},
  {name:"manim-animator",version:"unversioned",sha:"8d231605c03d0e3df0b036f0e34726d60f072a73cbdaae630468c1de03105b3d",archive:"manim-animator.zip",bytes:1047199,files:161,refs:154,evals:0,scripts:5,licenses:["references/manimce/LICENSE.txt","references/manimgl/LICENSE.txt"]},
  {name:"seo-audit",version:"unversioned",sha:"ac0b08fc951a6b0535369f79fca22603a3e11e4067719a7817c064921dad9ef1",archive:"seo-audit (1).zip",bytes:58740,files:4,refs:0,evals:0,scripts:2,licenses:[]},
  {name:"seo-competitor-analysis",version:"unversioned",sha:"55d896db5eef4f4852033f00d7ab311e522c8c1c4867f8c50cd2d8d58d340412",archive:"seo-competitor-analysis (1).zip",bytes:58619,files:5,refs:2,evals:0,scripts:2,licenses:[]},
  {name:"system-settings-playbooks",version:"unversioned",sha:"5df11b0761e94accb03b3c4f538d0ccf3db92027ec8db1bf2cabbff86f3c299f",archive:"system-settings-playbooks.zip",bytes:25608,files:8,refs:0,evals:0,scripts:0,licenses:[]},
  {name:"youtube-video-research",version:"unversioned",sha:"ae3cca752f3c32dadbcebeab41f3c20dd381980a800aae7ccd8a9785424beb31",archive:"youtube-video-research.zip",bytes:43710,files:5,refs:4,evals:0,scripts:0,licenses:[]}
];

const TOOL_BINDINGS = {
  "account-research": ["known", "research", "bizdev", "company_email"],
  "agent-development": ["maaroof"],
  "agent-md-refactor": ["maaroof"],
  "agent-reach": ["research", "social_analysis", "visibility"],
  "ai-seo": ["analyze", "visibility", "applied_ranking", "brand_authority", "keyword_intelligence"],
  "alternative-blog-writer": ["suggest", "research", "compare", "keyword_intelligence", "geo_rewrite"],
  "applying-brand-guidelines": ["suggest", "brand_boost", "geo_rewrite"],
  "aso-audit": ["analyze", "research", "keyword_intelligence"],
  "audit-support": ["analyze", "research"],
  "backtesting-frameworks": ["what_if", "feasibility"],
  "blog-factcheck": ["analyze", "research"],
  "blog-repurpose": ["suggest", "social_analysis"],
  "blog-rewrite": ["geo_rewrite", "suggest"],
  "blog-translate": ["translate"],
  "blog-write": ["suggest", "geo_rewrite"],
  "business-model": ["feasibility", "bizdev", "what_if"],
  "call-prep": ["research", "company_email", "bizdev"],
  "churn-prevention": ["bizdev", "feasibility", "what_if"],
  "comparison-article-writer": ["compare", "research", "suggest"],
  "competitive-intelligence": ["known", "compare", "keyword_intelligence"],
  "content-creation": ["suggest", "geo_rewrite"],
  "content-experimentation-best-practices": ["suggest", "visibility"],
  "content-gap-analysis": ["keyword_intelligence", "compare", "analyze"],
  "content-modeling-best-practices": ["analyze", "brand_authority"],
  "content-strategy": ["geo_strategist", "research", "suggest"],
  "copy-editing": ["suggest", "geo_rewrite"],
  "copywriting": ["suggest", "geo_rewrite", "company_email"],
  "create-prd": ["maaroof", "feasibility", "bizdev"],
  "dispatching-parallel-agents": ["maaroof"],
  "draft-outreach": ["company_email"],
  "grammar-check": ["suggest", "geo_rewrite"],
  "humanizer": ["suggest", "geo_rewrite"],
  "keyword-research": ["keyword_intelligence", "research"],
  "knowledge-synthesis": ["research", "known"],
  "kpi-dashboard-design": ["analyze"],
  "legal-risk-assessment": ["analyze", "research", "feasibility"],
  "listicle-blog-writer": ["suggest", "research", "keyword_intelligence", "compare"],
  "market-research-reports": ["research", "known", "compare", "feasibility", "bizdev"],
  "market-sizing-analysis": ["feasibility", "what_if", "bizdev"],
  "marketing-ideas": ["geo_strategist", "bizdev", "suggest"],
  "marketing-psychology": ["suggest", "geo_rewrite", "geo_strategist"],
  "metadata-optimization": ["keyword_intelligence", "translate", "analyze"],
  "muapi-product-campaign": ["brand_boost", "suggest"],
  "muapi-ugc-ads-workflow": ["brand_boost", "suggest"],
  "no-ai-slop": ["suggest", "geo_rewrite"],
  "pricing-strategy": ["feasibility", "bizdev", "what_if"],
  "programmatic-seo": ["keyword_intelligence", "geo_strategist", "analyze"],
  "research-writing-skill": ["research"],
  "risk-metrics-calculation": ["feasibility", "what_if"],
  "scrapling": ["analyze", "research"],
  "search-strategy": ["research", "known", "keyword_intelligence"],
  "seo-aeo-best-practices": ["analyze", "brand_authority"],
  "seo-audit": ["analyze", "applied_ranking", "keyword_intelligence", "visibility"],
  "seo-competitor-analysis": ["compare", "keyword_intelligence", "research"],
  "seo-content-audit": ["analyze", "research"],
  "stop-slop": ["suggest", "geo_rewrite"],
  "task-management": ["maaroof"],
  "war-council": ["maaroof"],
  "writing-prds": ["maaroof"],
  "youtube-video-research": ["research"]
} satisfies Record<string, ToolKey[]>;

const HIGH_RISK = new Set(["legal-risk-assessment","secops-hunt","risk-metrics-calculation","backtesting-frameworks","market-sizing-analysis","pricing-strategy"]);
const MODERATE_RISK = new Set(["account-research","competitive-intelligence","churn-prevention","market-research-reports","seo-audit","seo-competitor-analysis","seo-content-audit","scrapling","agent-reach"]);

function makeId(name: string, version: string, sha: string): string {
  const versionPart = version === "unversioned" ? "unversioned" : version.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return name + "--v-" + versionPart + "--" + sha.slice(0, 12);
}

export const EXTERNAL_SKILL_PACKAGES: ExternalSkillPackage[] = RAW_PACKAGES.map((raw) => {
  const variantDisposition: ExternalSkillVariantDisposition =
    raw.name !== "humanizer" ? "single_candidate" :
    raw.version === "3.1.0" ? "preferred_candidate" : "alternate_candidate";
  const bindings = TOOL_BINDINGS[raw.name as keyof typeof TOOL_BINDINGS] || [];
  return {
    id: makeId(raw.name, raw.version, raw.sha),
    canonicalName: raw.name,
    version: raw.version,
    variantDisposition,
    source: {
      archiveName: raw.archive,
      sha256: raw.sha,
      archiveBytes: raw.bytes,
      fileCount: raw.files,
      importedAt: "2026-11-04",
      licenseFiles: raw.licenses,
      licenseStatus: raw.licenses.length ? "review_required" : "unknown",
    },
    contentIndex: {
      coreRef: "archive:sha256:" + raw.sha + "#SKILL.md",
      referenceIndexRef: raw.refs ? "archive:sha256:" + raw.sha + "#references-index" : null,
      referenceCount: raw.refs,
      evalIndexRef: raw.evals ? "archive:sha256:" + raw.sha + "#eval-index" : null,
      evalFileCount: raw.evals,
      bundledScriptCount: raw.scripts,
    },
    capabilityBindings: bindings.map((targetId, index) => ({
      targetType: "tool" as const,
      targetId,
      role: index === 0 ? "primary" as const : "supporting" as const,
      required: false as const,
    })),
    governance: {
      lifecycle: "candidate",
      risk: HIGH_RISK.has(raw.name) ? "high" : MODERATE_RISK.has(raw.name) ? "moderate" : "low",
      loadMode: "reference_only",
      evidenceRequired: true,
      requiresApproval: HIGH_RISK.has(raw.name) || ["draft-outreach","muapi-product-campaign","muapi-ugc-ads-workflow","task-management"].includes(raw.name),
      executionAllowed: false,
    },
  };
});

export const EXTERNAL_SKILL_REGISTRY_STATS = Object.freeze({
  sourceArchives: 80,
  exactDuplicateArchives: 10,
  uniquePackageVariants: EXTERNAL_SKILL_PACKAGES.length,
  uniqueSkillNames: new Set(EXTERNAL_SKILL_PACKAGES.map((item) => item.canonicalName)).size,
  expectedPackageVariants: 70,
  expectedSkillNames: 69,
});

export function getExternalSkillVariants(name: string): ExternalSkillPackage[] {
  const normalized = String(name || "").trim().toLowerCase();
  return EXTERNAL_SKILL_PACKAGES.filter((item) => item.canonicalName === normalized);
}

export function validateExternalSkillRegistry(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const digests = new Set<string>();
  const names = new Set<string>();
  for (const item of EXTERNAL_SKILL_PACKAGES) {
    if (ids.has(item.id)) errors.push("duplicate_package_id:" + item.id);
    ids.add(item.id);
    if (!/^[a-f0-9]{64}$/.test(item.source.sha256)) errors.push("invalid_sha256:" + item.id);
    if (digests.has(item.source.sha256)) errors.push("duplicate_source_digest:" + item.source.sha256);
    digests.add(item.source.sha256);
    if (!item.canonicalName || item.canonicalName !== item.canonicalName.toLowerCase()) errors.push("invalid_canonical_name:" + item.id);
    if (item.governance.lifecycle !== "candidate") errors.push("unexpected_lifecycle:" + item.id);
    if (item.governance.loadMode !== "reference_only") errors.push("unexpected_load_mode:" + item.id);
    if (item.governance.executionAllowed !== false) errors.push("execution_must_remain_disabled:" + item.id);
    if (!item.contentIndex.coreRef.startsWith("archive:sha256:")) errors.push("invalid_core_ref:" + item.id);
    names.add(item.canonicalName);
  }
  if (EXTERNAL_SKILL_PACKAGES.length !== EXTERNAL_SKILL_REGISTRY_STATS.expectedPackageVariants) errors.push("package_variant_count:" + EXTERNAL_SKILL_PACKAGES.length);
  if (names.size !== EXTERNAL_SKILL_REGISTRY_STATS.expectedSkillNames) errors.push("skill_name_count:" + names.size);
  if (getExternalSkillVariants("humanizer").length !== 2) errors.push("humanizer_variants_must_remain_distinct");
  return errors;
}
