export interface AgentItem {
  id: string;
  name: string;
  category:
    | "Content Creation"
    | "Customer Support"
    | "Data Analysis"
    | "Design"
    | "Education"
    | "Engineering"
    | "Finance"
    | "IT & Security"
    | "Investment"
    | "Legal"
    | "Life";
  avatar: string;
  avatarBg: string;
  description: string;
  runId?: string;
  version?: string;
  author: string;
  badge?: string;
  sampleQuestions: string[];
  systemPrompt?: string;
}

export interface AgentTeamItem {
  id: string;
  name: string;
  category: string;
  badge: string;
  description: string;
  members: { name: string; role: string; avatar: string }[];
  outputArtifact: string;
}

export const CATEGORIES = [
  "All",
  "Content Creation",
  "Customer Support",
  "Data Analysis",
  "Design",
  "Education",
  "Engineering",
  "Finance",
  "IT & Security",
  "Investment",
  "Legal",
  "Life",
] as const;

export const AGENTS: AgentItem[] = [
  {
    id: "hr_policy_live",
    name: "HR Policy Assistant",
    category: "Customer Support",
    avatar: "📋",
    avatarBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    description: "Autonomous shore staff policy advisor. Formulated from HR policy documents with verified citations and groundability guards.",
    runId: "hr_policy_live",
    version: "v1.4",
    author: "ForgeAI Factory",
    badge: "Live Tested Agent",
    sampleQuestions: [
      "How many days of annual leave do shore staff accrue per year?",
      "Can I carry over unused leave into the following year?",
      "What is the maximum reimbursement for international meal per-diem?",
    ],
  },
  {
    id: "ship_spares_live",
    name: "Ship Spares Specialist",
    category: "Engineering",
    avatar: "⚓",
    avatarBg: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    description: "Technical marine equipment & spares procurement assistant. Operates over parts catalogues and engineering manuals.",
    runId: "ship_spares_live",
    version: "v1.2",
    author: "ForgeAI Factory",
    badge: "Live Tested Agent",
    sampleQuestions: [
      "What is the part number and lead time for the Alfa Laval centrifugal pump seal kit?",
      "Which supplier provides emergency delivery within 48 hours for main engine fuel injectors?",
      "Check inventory threshold for standard 50mm stainless steel ball valves.",
    ],
  },
  {
    id: "content-creator",
    name: "Content Creator",
    category: "Content Creation",
    avatar: "🎨",
    avatarBg: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    description: "Expert content strategist and creator for multi-platform campaigns. Develops targeted narrative hooks and scripts.",
    version: "v2.0",
    author: "ForgeAI",
    sampleQuestions: [
      "Draft a 3-part LinkedIn thought-leadership carousel on autonomous AI agents in maritime logistics.",
      "Give me 5 viral hook concepts for a product demo video.",
      "Write a monthly newsletter summary for engineering leaders.",
    ],
  },
  {
    id: "image-prompt-engineer",
    name: "Image Prompt Engineer",
    category: "Design",
    avatar: "📸",
    avatarBg: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
    description: "Expert photography prompt engineer specializing in crafting detailed, evocative generative image prompts.",
    version: "v1.8",
    author: "ForgeAI",
    sampleQuestions: [
      "Write a photorealistic Midjourney v6 prompt for an ultra-modern autonomous shipping vessel at sunset.",
      "Craft a studio lighting prompt for minimal SaaS 3D isometric icons.",
      "Generate a cinematic prompt for an AI neural interface in macro detail.",
    ],
  },
  {
    id: "visual-storyteller",
    name: "Visual Storyteller",
    category: "Design",
    avatar: "📖",
    avatarBg: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    description: "Expert visual communication specialist focused on creating compelling visual narratives and graphic concepts.",
    version: "v2.1",
    author: "ForgeAI",
    sampleQuestions: [
      "How can we visually communicate our 7-stage autonomous evaluation harness to non-technical stakeholders?",
      "Design an infographic storyboard explaining deterministic vs LLM-as-judge scoring.",
      "Create a visual brand identity guidelines outline for our enterprise suite.",
    ],
  },
  {
    id: "short-video-editing-coach",
    name: "Short-Video Editing Coach",
    category: "Content Creation",
    avatar: "🎬",
    avatarBg: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300",
    description: "Hands-on short-video editing coach covering the full post-production pipeline, retention hooks, and pacing.",
    version: "v1.3",
    author: "ForgeAI",
    sampleQuestions: [
      "Review my 30-second pacing structure to maximize retention past the 3-second mark.",
      "What B-roll and sound design transitions work best for AI technical walkthroughs?",
      "Suggest CapCut / Premiere export settings for crisp 4K TikTok/Reels delivery.",
    ],
  },
  {
    id: "frontend-developer",
    name: "Frontend Developer",
    category: "Engineering",
    avatar: "💻",
    avatarBg: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
    description: "Expert frontend developer specializing in modern web technologies, React 19, Next.js, and design system fidelity.",
    version: "v2.5",
    author: "ForgeAI",
    sampleQuestions: [
      "Refactor this interactive Kanban board with Tailwind CSS and accessible keyboard navigation.",
      "How do we optimize React 19 Server Components for streaming retrieval logs?",
      "Audit my Tailwind palette tokens for consistent light and dark mode contrast.",
    ],
  },
  {
    id: "corporate-training-designer",
    name: "Corporate Training Designer",
    category: "Education",
    avatar: "🎓",
    avatarBg: "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300",
    description: "Expert in enterprise training system design and curriculum development — proficient in structured adult learning.",
    version: "v1.7",
    author: "ForgeAI",
    sampleQuestions: [
      "Structure a 4-week onboarding curriculum for junior AI engineers learning autonomous evals.",
      "Create a rubric for grading prompt engineering tournament submissions.",
      "Design interactive micro-learning modules for vessel compliance officers.",
    ],
  },
  {
    id: "pitch-deck-builder",
    name: "Pitch Deck Builder",
    category: "Finance",
    avatar: "📊",
    avatarBg: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
    description: "Builds investor pitch decks and fundraising materials with narrative discipline — from seed to growth rounds.",
    version: "v2.2",
    author: "ForgeAI",
    sampleQuestions: [
      "Structure a 10-slide Seed round deck for an autonomous agent factory platform.",
      "Help me formulate the 'Why Now' slide focusing on open-weight model specialization.",
      "Stress-test our unit economics and TAM calculation against venture benchmarks.",
    ],
  },
  {
    id: "study-abroad-advisor",
    name: "Study Abroad Advisor",
    category: "Education",
    avatar: "🌍",
    avatarBg: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
    description: "Full-spectrum study abroad planning expert covering the US, UK, Canada, Europe admissions and visa logistics.",
    version: "v1.5",
    author: "ForgeAI",
    sampleQuestions: [
      "Compare MSc Computer Science programs in the UK vs Germany for AI systems research.",
      "Review my statement of purpose draft for Ivy League graduate admissions.",
      "What are the post-graduation work visa requirements for Canada and Australia?",
    ],
  },
  {
    id: "growth-ads-operator",
    name: "Growth Ads Operator",
    category: "Content Creation",
    avatar: "📈",
    avatarBg: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
    description: "Content Growth & Advertising Operations Specialist: Responsible for multi-channel performance marketing & ROI.",
    version: "v1.9",
    author: "ForgeAI",
    sampleQuestions: [
      "Structure an A/B test framework for Google Ads targeting enterprise B2B CTOs.",
      "Calculate CAC payback period across LinkedIn vs search acquisition channels.",
      "Write 3 variations of ad copy highlighting 'autonomous agent testing'.",
    ],
  },
  {
    id: "bug-analysis-agent",
    name: "Bug Analysis Agent",
    category: "Engineering",
    avatar: "🐛",
    avatarBg: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
    description: "Root-cause analyst and defect shepherd for ForgeAI. Bring error logs, anomalies, and stack traces for triage.",
    version: "v2.4",
    author: "ForgeAI",
    sampleQuestions: [
      "Analyze this stack trace from our retrieval chunker and pinpoint the index boundary bug.",
      "Why did the LLM-as-judge trigger an unhandled JSON parse failure on empty citations?",
      "Construct a minimal reproduction script for this BM25 zero-division edge case.",
    ],
  },
  {
    id: "data-engineer",
    name: "Data Engineer",
    category: "Engineering",
    avatar: "🗄️",
    avatarBg: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
    description: "Expert data engineer specializing in building reliable data pipelines, lakehouse architectures, and dbt models.",
    version: "v2.3",
    author: "ForgeAI",
    sampleQuestions: [
      "Design an incremental ETL pipeline for ingesting shipping manifests and marine sensor logs.",
      "How should we partition Parquet datasets for fast cosine vector lookups?",
      "Write a dbt schema test ensuring no orphan document chunks exist after synchronization.",
    ],
  },
  {
    id: "ai-engineer",
    name: "AI Engineer",
    category: "Engineering",
    avatar: "🤖",
    avatarBg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
    description: "Expert AI/ML engineer specializing in machine learning model development, agentic workflows, and fine-tuning.",
    version: "v3.0",
    author: "ForgeAI",
    sampleQuestions: [
      "Compare LoRA vs full fine-tuning for specialized legal document retrieval routers.",
      "How can we defend our judge against verbosity bias and self-preference in evaluation sets?",
      "Design a semantic caching layer that avoids redundant embedding calculations.",
    ],
  },
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    category: "Engineering",
    avatar: "⚡",
    avatarBg: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
    description: "Specialist in crafting, testing, and systematically optimizing prompts for complex multi-step reasoning.",
    version: "v2.8",
    author: "ForgeAI",
    sampleQuestions: [
      "Optimize this system prompt to enforce strict citation bounds and refuse out-of-scope queries.",
      "Write a prompt tournament harness comparing 3 candidate agent personas on edge-case retrieval.",
      "How do we prevent few-shot examples from leaking into model assumptions?",
    ],
  },
  {
    id: "model-qa-specialist",
    name: "Model QA Specialist",
    category: "Engineering",
    avatar: "🔬",
    avatarBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    description: "Independent model QA expert who audits ML and statistical models end-to-end with deterministic evaluation suites.",
    version: "v2.1",
    author: "ForgeAI",
    sampleQuestions: [
      "Calculate Cohen's kappa for our automated judge vs human gold-standard labels.",
      "Formulate a 20-case test suite spanning answerable, out-of-scope, and ambiguous queries.",
      "Audit our hallucination detection gate for position bias.",
    ],
  },
  {
    id: "personal-growth-mentor",
    name: "Personal Growth Mentor",
    category: "Life",
    avatar: "🌱",
    avatarBg: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    description: "Cross-domain personal development mentor for goal clarity, habit design, productivity systems, and wellness.",
    version: "v1.6",
    author: "ForgeAI",
    sampleQuestions: [
      "Design a sustainable 90-day deep work routine for senior software architects.",
      "How do I manage cognitive load when orchestrating high-stakes engineering deployments?",
      "Suggest a structured weekly reflection framework for continuous professional learning.",
    ],
  },
  {
    id: "compliance-officer",
    name: "Legal & Compliance Advisor",
    category: "Legal",
    avatar: "⚖️",
    avatarBg: "bg-slate-100 text-slate-800 dark:bg-slate-950/60 dark:text-slate-300",
    description: "Audits contracts, policies, and operational agreements against maritime & enterprise statutory regulations.",
    version: "v2.0",
    author: "ForgeAI",
    sampleQuestions: [
      "Check this crew employment agreement clause against IMO MLC 2006 guidelines.",
      "What are the statutory requirements for carrying over unused vacation in EU jurisdictions?",
      "Verify indemnification limits in this maritime spares vendor procurement contract.",
    ],
  },
];

export const AGENT_TEAMS: AgentTeamItem[] = [
  {
    id: "launch-week-team",
    name: "Release & Deployment Swarm (Atlas v2.4)",
    category: "Engineering",
    badge: "Active Swarm",
    description: "Coordinates end-to-end release cycles: audits git branches, syncs Kanban task boards, runs automated QA evals, and deploys verified deliverables.",
    members: [
      { name: "Atlas", role: "Autonomous Orchestrator", avatar: "🤖" },
      { name: "Frontend Developer", role: "UI & State Implementation", avatar: "💻" },
      { name: "Model QA Specialist", role: "Test Harness & Judge", avatar: "🔬" },
      { name: "Bug Analysis Agent", role: "Triage & Exception Watchdog", avatar: "🐛" },
    ],
    outputArtifact: "Release board · v2.4 (3 humans · 8 agents)",
  },
  {
    id: "maritime-procurement-cell",
    name: "Maritime Spares & Safety Cell",
    category: "Engineering",
    badge: "Enterprise Pipeline",
    description: "Processes technical requisitions, matches part serial numbers across vendor catalogues, and asserts compliance with maritime safety standards.",
    members: [
      { name: "Ship Spares Specialist", role: "Catalogue Retrieval & Pricing", avatar: "⚓" },
      { name: "Legal & Compliance Advisor", role: "Statutory & Class Auditing", avatar: "⚖️" },
      { name: "Data Engineer", role: "Inventory Sync & Lakehouse", avatar: "🗄️" },
    ],
    outputArtifact: "Audited Purchase Order Specification + Delivery Trace",
  },
  {
    id: "enterprise-hr-cell",
    name: "Enterprise HR & Training Cell",
    category: "Customer Support",
    badge: "Certified Factory Run",
    description: "Grounds corporate policy Q&A on committed HR documents, demotes unsupported topics, and generates interactive training modules for staff.",
    members: [
      { name: "HR Policy Assistant", role: "Policy Interpretation & Citations", avatar: "📋" },
      { name: "Corporate Training Designer", role: "Curriculum & Onboarding Flow", avatar: "🎓" },
      { name: "Personal Growth Mentor", role: "Staff Development & Habit Design", avatar: "🌱" },
    ],
    outputArtifact: "Shore Staff Policy Handbook + 28 Verified Case Evals",
  },
  {
    id: "growth-narrative-guild",
    name: "Strategic Growth & Creative Guild",
    category: "Content Creation",
    badge: "Autonomous Campaign",
    description: "Aligns high-impact storytelling, ad creative generation, and investor pitch deck materials into one unified narrative engine.",
    members: [
      { name: "Content Creator", role: "Copy & Narrative Hooks", avatar: "🎨" },
      { name: "Visual Storyteller", role: "Graphic Direction & Storyboards", avatar: "📖" },
      { name: "Pitch Deck Builder", role: "Investor Thesis & Financial Modeling", avatar: "📊" },
      { name: "Growth Ads Operator", role: "Campaign Routing & Attribution", avatar: "📈" },
    ],
    outputArtifact: "Investor Deck + Multi-Channel Launch Asset Package",
  },
];
