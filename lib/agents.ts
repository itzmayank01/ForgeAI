/**
 * The agent catalogue.
 *
 * An entry is either:
 *
 *   1. BUILT BY THE FACTORY: it has a `runId` that points to a committed
 *      directory under `runs/` holding requirements, an agent definition,
 *      generated evals, and a final scorecard. It can be chatted with because
 *      its retrieval runtime can mount its real corpus and invoke its real
 *      system prompt.
 *
 *   2. SPECIFIED AS A BRIEF: it has a `brief` stating what it should answer,
 *      from which documents, and what it must refuse. It has NO committed
 *      artifacts and has NOT been built. It cannot be chatted with, because
 *      pretending to chat with an agent that was never generated is the exact
 *      failure mode ForgeAI exists to eliminate. It can be loaded into the
 *      brief composer, edited, and pre-flighted.
 */

export type AgentCategory =
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

export type CorpusId = "hr_policy_live" | "ship_spares_live";

export interface AgentItem {
  id: string;
  name: string;
  category: AgentCategory;
  /** Clean 2-letter monogram for fallback / avatar */
  avatar: string;
  /** Vector SVG icon key */
  iconKey?: string;
  avatarBg: string;
  description: string;
  runId?: string;
  version: string;
  author: string;
  badge?: string;
  tags: string[];
  brief: string;
  corpusHint?: CorpusId;
  sampleQuestions: string[];
}

export interface TeamMemberRef {
  agentId: string;
  role: string;
}

export interface AgentTeamItem {
  id: string;
  name: string;
  category: AgentCategory;
  badge: string;
  description: string;
  tags: string[];
  members: TeamMemberRef[];
  outputArtifact: string;
}

/**
 * One avatar treatment for every entry.
 *
 * This was nineteen agents in seventeen hue families — sky, teal, fuchsia,
 * stone, orange — which reads as decoration rather than a system, and fought
 * the brand colour on every card. A gallery says what an item IS through its
 * label and its badge; the icon chip is chrome, so it is uniform.
 */
export const AVATAR_SURFACE =
  "bg-accent-soft text-accent-text border border-accent-line/40";

export const AGENTS: AgentItem[] = [
  // ── built by the factory ────────────────────────────────────────────────
  {
    id: "hr_policy_live",
    name: "HR Policy Assistant",
    category: "Customer Support",
    avatar: "HR",
    iconKey: "policy",
    avatarBg: "bg-gradient-to-br from-blue-500/15 to-indigo-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
    description:
      "Shore-staff policy advisor built from three HR documents. Answers with numbered citations and refuses legal, medical and individual-record questions by construction.",
    runId: "hr_policy_live",
    version: "v1.4",
    author: "ForgeAI Factory",
    badge: "Built & scored",
    tags: ["hr-policy", "leave", "expenses", "grievance"],
    brief: "", // replaced with the committed manifest brief
    corpusHint: "hr_policy_live",
    sampleQuestions: [
      "How much annual leave do shore staff get, and how much can I carry over?",
      "What can I claim for meals while travelling?",
      "How do I raise a grievance about my manager?",
    ],
  },
  {
    id: "ship_spares_live",
    name: "Ship Spares Specialist",
    category: "Engineering",
    avatar: "SS",
    iconKey: "marine",
    avatarBg: "bg-gradient-to-br from-cyan-500/15 to-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/30",
    description:
      "Procurement desk assistant over a parts catalogue and two supplier agreements. Quotes price and lead time, works out order totals, refuses to rank suppliers.",
    runId: "ship_spares_live",
    version: "v1.2",
    author: "ForgeAI Factory",
    badge: "Built & scored",
    tags: ["procurement", "catalogue", "lead-time", "suppliers"],
    brief: "",
    corpusHint: "ship_spares_live",
    sampleQuestions: [
      "What is the unit price and lead time for the fuel injector?",
      "What is the minimum order quantity in the Nordhavn agreement?",
      "What is the total for 12 gasket sets at catalogue price?",
    ],
  },

  // ── briefs: specified, not built ────────────────────────────────────────
  {
    id: "brief-content-creator",
    name: "Content Creator",
    category: "Content Creation",
    avatar: "CC",
    iconKey: "content",
    avatarBg: "bg-gradient-to-br from-amber-500/15 to-orange-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
    description:
      "Multi-platform content strategist working from a brand guidelines folder and a library of past campaigns.",
    version: "draft",
    author: "ForgeAI",
    tags: ["content", "campaigns", "brand-voice"],
    brief:
      "I need an assistant that drafts social and newsletter copy from our brand guidelines and our archive of past campaigns. It should answer questions about tone of voice, approved claims and channel formats, and reuse phrasing we have already published. It must not invent product claims or statistics that are not in the archive, and it must not give legal or regulatory sign-off on advertising copy.",
    sampleQuestions: [],
  },
  {
    id: "brief-image-prompt-engineer",
    name: "Image Prompt Engineer",
    category: "Design",
    avatar: "IP",
    iconKey: "camera",
    avatarBg: "bg-gradient-to-br from-sky-500/15 to-blue-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30",
    description:
      "Generative-image prompt specialist grounded in a house style guide and a catalogue of approved reference shots.",
    version: "draft",
    author: "ForgeAI",
    tags: ["prompting", "image-gen", "style-guide"],
    brief:
      "Build an assistant that writes image-generation prompts in our house photographic style. It should answer from the style guide — lighting, lens, colour grade, composition rules — and from the captioned reference shots we have approved. It must refuse requests for styles the guide does not cover rather than improvising, and it must not imitate a named living artist.",
    sampleQuestions: [],
  },
  {
    id: "brief-visual-storyteller",
    name: "Visual Storyteller",
    category: "Design",
    avatar: "VS",
    iconKey: "story",
    avatarBg: "bg-gradient-to-br from-purple-500/15 to-indigo-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
    description:
      "Turns technical material into storyboards and explanatory diagrams, working from a diagram component library.",
    version: "draft",
    author: "ForgeAI",
    tags: ["storyboard", "diagrams", "explainer"],
    brief:
      "I want an assistant that helps turn engineering write-ups into storyboards for non-technical audiences. It should work from our diagram component library and our past explainer decks, answer questions about which visual pattern fits which kind of content, and suggest panel sequences. It must not claim a diagram pattern exists if it is not in the library.",
    sampleQuestions: [],
  },
  {
    id: "brief-video-editing-coach",
    name: "Short-Video Editing Coach",
    category: "Content Creation",
    avatar: "VC",
    iconKey: "video",
    avatarBg: "bg-gradient-to-br from-teal-500/15 to-emerald-500/20 text-teal-600 dark:text-teal-400 border-teal-500/30",
    description:
      "Post-production coach over an internal editing handbook and retention analytics exports.",
    version: "draft",
    author: "ForgeAI",
    tags: ["video", "post-production", "retention"],
    brief:
      "Build a coach for our short-video editors. It should answer from the editing handbook — pacing, cut rhythm, caption rules, export settings — and from the retention analytics exports, so it can say which structures held attention on our own channel. It must not give advice about platform algorithms that the analytics cannot evidence.",
    sampleQuestions: [],
  },
  {
    id: "brief-frontend-developer",
    name: "Frontend Developer",
    category: "Engineering",
    avatar: "FE",
    iconKey: "code",
    avatarBg: "bg-gradient-to-br from-pink-500/15 to-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30",
    description:
      "Front-end assistant grounded in a design-system reference and the repository's component conventions.",
    version: "draft",
    author: "ForgeAI",
    tags: ["frontend", "design-system", "conventions"],
    brief:
      "I need an assistant that answers questions about our front-end conventions from the design-system reference and the component README files: which token to use, which component already exists, how state is expected to flow, and what our accessibility baseline requires. It must not invent a component that is not in the system, and it must refuse questions about backend services it has no documents for.",
    sampleQuestions: [],
  },
  {
    id: "brief-training-designer",
    name: "Corporate Training Designer",
    category: "Education",
    avatar: "CT",
    iconKey: "education",
    avatarBg: "bg-gradient-to-br from-violet-500/15 to-purple-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30",
    description:
      "Curriculum designer working from a competency framework and existing course outlines.",
    version: "draft",
    author: "ForgeAI",
    tags: ["curriculum", "onboarding", "competency"],
    brief:
      "Build an assistant for our learning team that answers from the competency framework and the existing course outlines: which competencies a role requires, what modules already cover them, and where the gaps are. It should help sequence a curriculum. It must not assess an individual employee's performance or make claims about certification that the framework does not state.",
    sampleQuestions: [],
  },
  {
    id: "brief-pitch-deck-builder",
    name: "Pitch Deck Builder",
    category: "Finance",
    avatar: "PD",
    iconKey: "chart",
    avatarBg: "bg-gradient-to-br from-indigo-500/15 to-blue-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    description:
      "Fundraising assistant over an internal metrics pack, past decks and a market research folder.",
    version: "draft",
    author: "ForgeAI",
    tags: ["fundraising", "metrics", "narrative"],
    brief:
      "I need an assistant that helps assemble investor material from our metrics pack, previous decks and the market research folder. It should answer questions about our own numbers, how we have framed the story before, and what the research says about the market. It must never estimate a metric that is not in the pack, and it must refuse to give investment advice or valuation opinions.",
    sampleQuestions: [],
  },
  {
    id: "brief-study-abroad-advisor",
    name: "Study Abroad Advisor",
    category: "Education",
    avatar: "SA",
    iconKey: "globe",
    avatarBg: "bg-gradient-to-br from-amber-500/15 to-yellow-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
    description:
      "Admissions assistant over university prospectuses and published visa guidance.",
    version: "draft",
    author: "ForgeAI",
    tags: ["admissions", "visa", "prospectus"],
    brief:
      "Build an advisor that answers from a folder of university prospectuses and official visa guidance: entry requirements, deadlines, tuition, and post-study work rules as published. It must cite the document behind every requirement, must refuse to predict an admissions outcome, and must not give immigration advice beyond quoting the published guidance.",
    sampleQuestions: [],
  },
  {
    id: "brief-growth-ads-operator",
    name: "Growth Ads Operator",
    category: "Content Creation",
    avatar: "GA",
    iconKey: "growth",
    avatarBg: "bg-gradient-to-br from-red-500/15 to-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30",
    description:
      "Paid-acquisition assistant over campaign exports and the channel playbook.",
    version: "draft",
    author: "ForgeAI",
    tags: ["paid-media", "attribution", "playbook"],
    brief:
      "I want an assistant for our paid acquisition desk that answers from campaign exports and the channel playbook: what a campaign actually spent and returned, which creative variants ran, and what the playbook says about budget pacing and naming conventions. It must not forecast performance for a channel we have no data on, and it must not claim causation from the attribution exports.",
    sampleQuestions: [],
  },
  {
    id: "brief-bug-analysis",
    name: "Bug Analysis Agent",
    category: "Engineering",
    avatar: "BA",
    iconKey: "bug",
    avatarBg: "bg-gradient-to-br from-emerald-500/15 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    description:
      "Triage assistant over runbooks, past incident write-ups and the service catalogue.",
    version: "draft",
    author: "ForgeAI",
    tags: ["triage", "incidents", "runbooks"],
    brief:
      "Build a triage assistant for on-call engineers. It should answer from the runbooks, the service catalogue and past incident write-ups: which service owns a symptom, whether this failure has been seen before, and what the documented first response is. It must not guess a root cause that no runbook or write-up supports, and it must not recommend a production action that is not in a runbook.",
    sampleQuestions: [],
  },
  {
    id: "brief-data-engineer",
    name: "Data Engineer",
    category: "Data Analysis",
    avatar: "DE",
    iconKey: "database",
    avatarBg: "bg-gradient-to-br from-cyan-500/15 to-blue-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    description:
      "Warehouse assistant over schema documentation, dbt model descriptions and data contracts.",
    version: "draft",
    author: "ForgeAI",
    tags: ["warehouse", "lineage", "contracts"],
    brief:
      "I need an assistant that answers questions about our warehouse from the schema documentation, dbt model descriptions and data contracts: what a column means, which model produces a table, what the freshness guarantee is, and who owns a dataset. It must refuse to speculate about lineage the documentation does not record, and it must not give an answer about personal data handling beyond quoting the contract.",
    sampleQuestions: [],
  },
  {
    id: "brief-ai-engineer",
    name: "AI Engineer",
    category: "Engineering",
    avatar: "AI",
    iconKey: "cpu",
    avatarBg: "bg-gradient-to-br from-blue-500/15 to-violet-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
    description:
      "Model-platform assistant over evaluation reports, model cards and deployment runbooks.",
    version: "draft",
    author: "ForgeAI",
    tags: ["evaluation", "model-cards", "deployment"],
    brief:
      "Build an assistant for our ML platform team that answers from model cards, evaluation reports and deployment runbooks: how a model scored on which suite, what its documented limitations are, and what the rollout procedure is. It must quote the evaluation report for every score it states, and it must refuse to compare two models on a benchmark neither card reports.",
    sampleQuestions: [],
  },
  {
    id: "brief-prompt-engineer",
    name: "Prompt Engineer",
    category: "Engineering",
    avatar: "PE",
    iconKey: "bolt",
    avatarBg: "bg-gradient-to-br from-fuchsia-500/15 to-pink-500/20 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30",
    description:
      "Prompt-library assistant over versioned prompts and their recorded eval deltas.",
    version: "draft",
    author: "ForgeAI",
    tags: ["prompts", "versioning", "eval-deltas"],
    brief:
      "I want an assistant over our prompt library that answers from the versioned prompt files and the eval deltas recorded for each change: what a prompt is for, what changed between versions, and whether a change measurably helped. It must not claim a prompt change improved anything unless a recorded delta says so, and it must refuse to score a prompt it has no eval data for.",
    sampleQuestions: [],
  },
  {
    id: "brief-model-qa",
    name: "Model QA Specialist",
    category: "IT & Security",
    avatar: "QA",
    iconKey: "audit",
    avatarBg: "bg-gradient-to-br from-slate-500/15 to-zinc-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30",
    description:
      "Assurance assistant over test plans, release gates and the risk register.",
    version: "draft",
    author: "ForgeAI",
    tags: ["assurance", "release-gates", "risk"],
    brief:
      "Build an assurance assistant that answers from our test plans, release gate definitions and the risk register: which gate a release must clear, what a test plan covers, and which risks are accepted. It must not declare a release safe; it should state which gates are documented as passed and which are not, citing the plan.",
    sampleQuestions: [],
  },
  {
    id: "brief-treasury-analyst",
    name: "Treasury Policy Analyst",
    category: "Investment",
    avatar: "TA",
    iconKey: "tax",
    avatarBg: "bg-gradient-to-br from-emerald-500/15 to-green-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    description:
      "Policy assistant over the treasury mandate, counterparty limits and approved instrument lists.",
    version: "draft",
    author: "ForgeAI",
    tags: ["treasury", "mandate", "limits"],
    brief:
      "I need an assistant for our treasury desk that answers from the investment mandate, counterparty limit schedules and the approved instrument list: whether an instrument is permitted, what the concentration limit for a counterparty is, and what approval a deviation needs. It must never recommend a trade, express a market view, or give investment advice — only state what the mandate permits, with the clause.",
    sampleQuestions: [],
  },
  {
    id: "brief-growth-mentor",
    name: "Personal Growth Mentor",
    category: "Life",
    avatar: "GM",
    iconKey: "sparkles",
    avatarBg: "bg-gradient-to-br from-pink-500/15 to-rose-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30",
    description:
      "Development assistant over a career framework and the internal coaching handbook.",
    version: "draft",
    author: "ForgeAI",
    tags: ["coaching", "career-framework", "habits"],
    brief:
      "Build an assistant that answers from our career framework and coaching handbook: what the expectations are at each level, which development activities the handbook suggests for a given gap, and how to structure a growth conversation. It must refuse to give therapeutic or medical advice, and it must not comment on a named colleague.",
    sampleQuestions: [],
  },
  {
    id: "brief-compliance-advisor",
    name: "Legal & Compliance Advisor",
    category: "Legal",
    avatar: "CA",
    iconKey: "policy",
    avatarBg: "bg-gradient-to-br from-sky-500/15 to-indigo-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30",
    description:
      "Contract assistant over standard templates, the clause library and the vendor risk matrix.",
    version: "draft",
    author: "ForgeAI",
    tags: ["contracts", "clause-library", "vendor-risk"],
    brief:
      "I want an assistant that answers from our contract templates, clause library and vendor risk matrix: what our standard position on a clause is, which fallback wording is pre-approved, and what risk tier a vendor falls into. It must state plainly that it does not give legal advice, must refuse to interpret a counterparty's paper as binding, and must escalate anything the clause library does not cover.",
    sampleQuestions: [],
  },
];

export const AGENT_TEAMS: AgentTeamItem[] = [
  {
    id: "shore-and-vessel-desk",
    name: "Shore & Vessel Desk",
    category: "Customer Support",
    badge: "2 built members",
    description:
      "Both built agents in one room. A leave question goes to the HR corpus, a parts question to the catalogue, and the routing table shows which documents won and by how much.",
    tags: ["routing", "hr-policy", "procurement"],
    members: [
      { agentId: "hr_policy_live", role: "Policy, leave, expenses, grievance" },
      { agentId: "ship_spares_live", role: "Parts, prices, lead times, supplier terms" },
    ],
    outputArtifact: "Routed answer with the member's own citations",
  },
  {
    id: "maritime-procurement-cell",
    name: "Maritime Spares & Safety Cell",
    category: "Engineering",
    badge: "1 built member",
    description:
      "Routes a procurement question to the desk that holds the documents: catalogue and supplier terms, contract position, or warehouse lineage.",
    tags: ["procurement", "maritime", "compliance"],
    members: [
      { agentId: "ship_spares_live", role: "Catalogue, pricing and supplier terms" },
      { agentId: "brief-compliance-advisor", role: "Contract position and vendor risk" },
      { agentId: "brief-data-engineer", role: "Inventory lineage and data contracts" },
    ],
    outputArtifact: "Routed answer with the member's own citations",
  },
  {
    id: "enterprise-hr-cell",
    name: "Enterprise HR & Training Cell",
    category: "Customer Support",
    badge: "1 built member",
    description:
      "Policy questions go to the built HR agent and its committed documents; curriculum and development questions go to the drafted briefs.",
    tags: ["hr-policy", "training", "development"],
    members: [
      { agentId: "hr_policy_live", role: "Policy interpretation with citations" },
      { agentId: "brief-training-designer", role: "Curriculum and onboarding" },
      { agentId: "brief-growth-mentor", role: "Career framework and coaching" },
    ],
    outputArtifact: "Routed answer with the member's own citations",
  },
  {
    id: "release-delivery-guild",
    name: "Release & Delivery Guild",
    category: "Engineering",
    badge: "0 built members",
    description:
      "Front-end conventions, incident triage and release gates in one room. Every member is a brief, so this room can route but cannot yet answer.",
    tags: ["delivery", "triage", "release-gates"],
    members: [
      { agentId: "brief-frontend-developer", role: "UI conventions and design system" },
      { agentId: "brief-bug-analysis", role: "Triage and runbooks" },
      { agentId: "brief-model-qa", role: "Release gates and risk" },
      { agentId: "brief-prompt-engineer", role: "Prompt versions and eval deltas" },
    ],
    outputArtifact: "Routing decision only — nothing here was built",
  },
  {
    id: "growth-narrative-guild",
    name: "Growth & Narrative Guild",
    category: "Content Creation",
    badge: "0 built members",
    description:
      "Campaign copy, visual direction and investor narrative. Every member is a brief, so this room can route but cannot yet answer.",
    tags: ["growth", "narrative", "campaigns"],
    members: [
      { agentId: "brief-content-creator", role: "Copy and brand voice" },
      { agentId: "brief-visual-storyteller", role: "Storyboards and diagrams" },
      { agentId: "brief-pitch-deck-builder", role: "Investor narrative and metrics" },
      { agentId: "brief-growth-ads-operator", role: "Paid channels and attribution" },
    ],
    outputArtifact: "Routing decision only — nothing here was built",
  },
];

export const CATEGORIES: string[] = [
  "All",
  ...[...new Set(AGENTS.map((a) => a.category))].sort(),
];

export const AUTHORS: string[] = [
  "All",
  ...[...new Set(AGENTS.map((a) => a.author))].sort(),
];

/** Members of a team that the factory actually built, in roster order. */
export function builtMembers(team: AgentTeamItem, agents: AgentItem[]): AgentItem[] {
  return team.members
    .map((m) => agents.find((a) => a.id === m.agentId))
    .filter((a): a is AgentItem => Boolean(a?.runId));
}
