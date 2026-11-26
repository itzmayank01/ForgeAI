/**
 * The gallery's catalogue.
 *
 * Two kinds of entry live here and the difference is load-bearing:
 *
 *   - A BUILT agent has a `runId`. The factory produced it, its artifacts are
 *     committed under runs/, it has a measured pass rate and it can be talked
 *     to against its own documents.
 *   - A BRIEF has no `runId`. Nothing was built. It is a one-paragraph
 *     specification of an agent the factory could be pointed at, and the only
 *     thing the site will do with it is load it into the composer or run a
 *     lexical pre-flight against a corpus you choose.
 *
 * An earlier version let briefs "chat" by returning a canned string after a
 * setTimeout. That is a fake agent wearing a real one's clothes, on a site
 * whose entire argument is that it does not fabricate results, so it is gone.
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

/** Corpora committed under each run's web/chunks.json that a pre-flight can probe. */
export type CorpusId = "hr_policy_live" | "ship_spares_live";

export interface AgentItem {
  id: string;
  name: string;
  category: AgentCategory;
  avatar: string;
  avatarBg: string;
  description: string;
  /** Present only when the factory actually produced this agent. */
  runId?: string;
  version?: string;
  author: string;
  badge?: string;
  tags: string[];
  /**
   * The one-paragraph brief. For a built agent this is overwritten at render
   * time with the brief actually committed in its manifest, so the card can
   * never drift from what was really run.
   */
  brief: string;
  /** Closest committed corpus, used to pre-fill the pre-flight picker. */
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

export const AGENTS: AgentItem[] = [
  // ── built by the factory ────────────────────────────────────────────────
  {
    id: "hr_policy_live",
    name: "HR Policy Assistant",
    category: "Customer Support",
    avatar: "📋",
    avatarBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
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
    avatar: "⚓",
    avatarBg: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
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
    avatar: "🎨",
    avatarBg: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
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
    avatar: "📸",
    avatarBg: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
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
    avatar: "📖",
    avatarBg: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
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
    avatar: "🎬",
    avatarBg: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300",
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
    avatar: "💻",
    avatarBg: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
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
    avatar: "🎓",
    avatarBg: "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300",
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
    avatar: "📊",
    avatarBg: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
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
    avatar: "🌍",
    avatarBg: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
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
    avatar: "📈",
    avatarBg: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
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
    avatar: "🐛",
    avatarBg: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
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
    avatar: "🗄️",
    avatarBg: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
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
    avatar: "🤖",
    avatarBg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
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
    avatar: "⚡",
    avatarBg: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
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
    avatar: "🔬",
    avatarBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
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
    avatar: "🏦",
    avatarBg: "bg-slate-100 text-slate-800 dark:bg-slate-950/60 dark:text-slate-300",
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
    avatar: "🌱",
    avatarBg: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
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
    avatar: "⚖️",
    avatarBg: "bg-stone-100 text-stone-800 dark:bg-stone-900/60 dark:text-stone-300",
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

/**
 * Teams reference members by agent id, not by display name.
 *
 * The previous version stored loose name strings and the launch button looked
 * for an agent called "Atlas" that does not exist, so every team opened a chat
 * with whichever agent happened to be first in the array. Referencing ids means
 * a broken roster is a type error, not a silently wrong conversation.
 */
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

/**
 * Categories are derived, never hand-listed.
 *
 * The hand-written list carried three categories no agent belonged to, so
 * three filter pills reliably produced an empty gallery. Deriving them makes a
 * dead pill impossible.
 */
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
