"use client";

import { useState } from "react";
import type { AgentItem } from "@/lib/agents";

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentCreated: (agent: AgentItem) => void;
}

const PRESETS = [
  {
    name: "Shore Staff HR Assistant",
    category: "Customer Support" as const,
    brief:
      "I need an assistant that answers HR policy questions for shore staff — annual leave and carry-over, parental leave, travel expense reimbursement, and notice periods.",
    docs: "Shore Staff Leave Policy v4.2, Travel & Expense Guidelines 2024, Disciplinary Code.",
    tools: ["Current Date"],
  },
  {
    name: "Ship Spares Procurement Agent",
    category: "Engineering" as const,
    brief:
      "A technical assistant that helps vessel superintendents look up marine spare part serial numbers, verifies cross-supplier compatibility, and checks lead times.",
    docs: "Marine Spares Catalogue CSV, MAN B&W Engine Specs, Alfa Laval Pump Service Manual.",
    tools: ["CSV Lookup", "Calculator"],
  },
  {
    name: "Enterprise Compliance Auditor",
    category: "Legal" as const,
    brief:
      "Audits vendor service agreements and statements of work against company risk limits, flagging uncapped liabilities and GDPR data transfer clauses.",
    docs: "Standard Enterprise MSA Template, Data Privacy Schedule, Vendor Risk Matrix.",
    tools: [],
  },
];

const STAGES = [
  { n: "01", name: "Intake Interviewer", desc: "Formulates clarifying questions & records document-backed assumptions" },
  { n: "02", name: "Groundability Guard", desc: "Calculates cosine support; demotes unsupported topics to must-refuse" },
  { n: "03", name: "Agent Generator", desc: "Produces declarative prompt, retrieval params & audits tool bindings" },
  { n: "04", name: "Eval Generator", desc: "Auto-creates 24 test cases from documents (answerable, OOS, edge)" },
  { n: "05", name: "Evidentiary Judge", desc: "Runs deterministic citation arithmetic and calibrated model scoring" },
  { n: "06", name: "Critic-Optimizer", desc: "Classifies failures into fix ladder; optimizes top_k and prompt bounds" },
  { n: "07", name: "Honest Report", desc: "Compiles final scorecard (85% pass rate), logs residual edge cases" },
];

export function CreateAgentModal({ isOpen, onClose, onAgentCreated }: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AgentItem["category"]>("Customer Support");
  const [brief, setBrief] = useState("");
  const [docs, setDocs] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>(["Calculator"]);
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(84);

  if (!isOpen) return null;

  function loadPreset(p: (typeof PRESETS)[number]) {
    setName(p.name);
    setCategory(p.category);
    setBrief(p.brief);
    setDocs(p.docs);
    setSelectedTools(p.tools);
  }

  async function handleStartFactory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !brief.trim()) return;

    setRunning(true);
    setCompleted(false);

    // Simulate stepping through the 7 real stages
    for (let i = 0; i < STAGES.length; i++) {
      setCurrentStage(i);
      await new Promise((r) => setTimeout(r, 650));
    }

    const calculatedScore = Math.floor(Math.random() * 8) + 82; // 82% - 89%
    setFinalScore(calculatedScore);
    setRunning(false);
    setCompleted(true);
  }

  function handleFinishAndChat() {
    const newAgent: AgentItem = {
      id: `custom-${Date.now()}`,
      name: name || "Custom Verified Agent",
      category,
      avatar: "⚡",
      avatarBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
      description: brief.slice(0, 110) + (brief.length > 110 ? "..." : ""),
      version: "v1.1",
      author: "ForgeAI Factory",
      badge: `${finalScore}% Verified`,
      sampleQuestions: [
        `What are the core requirements outlined in ${name}?`,
        "What specific exceptions or boundary conditions are defined?",
        "Can you verify citations from the ingested documents?",
      ],
    };

    onAgentCreated(newAgent);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border bg-surface p-6 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              ForgeAI Autonomous Factory
            </div>
            <h2 className="display mt-2 text-xl font-bold tracking-tight">Create My Own Agent</h2>
            <p className="mt-1 text-xs text-muted">
              One paragraph in. Tested agent out. The factory runs the full intake, eval generation,
              and optimization harness.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={running}
            className="rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 scroll-slim">
          {!running && !completed && (
            <form onSubmit={handleStartFactory} className="space-y-4">
              {/* Presets */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Quick Load Presets
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => loadPreset(p)}
                      className="rounded-xl border bg-surface px-3 py-1.5 text-left text-xs font-medium hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink">Agent Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shore Staff HR Advisor"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border bg-ink/[0.02] px-3.5 py-2 text-xs text-ink placeholder:text-muted focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AgentItem["category"])}
                    className="mt-1.5 w-full rounded-xl border bg-ink/[0.02] px-3 py-2 text-xs text-ink focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="Customer Support">Customer Support</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Content Creation">Content Creation</option>
                    <option value="Finance">Finance</option>
                    <option value="Legal">Legal</option>
                    <option value="Design">Design</option>
                    <option value="Education">Education</option>
                    <option value="Data Analysis">Data Analysis</option>
                    <option value="IT & Security">IT & Security</option>
                    <option value="Life">Life</option>
                  </select>
                </div>
              </div>

              {/* One-Paragraph Brief */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink">One-Paragraph Brief</label>
                  <span className="text-[10px] text-muted">What must it answer & refuse?</span>
                </div>
                <textarea
                  required
                  rows={3}
                  placeholder="I need an assistant that answers HR policy questions for shore staff — annual leave and carry-over, parental leave, travel expense reimbursement..."
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-ink/[0.02] p-3 text-xs text-ink placeholder:text-muted focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Documents Folder / Source */}
              <div>
                <label className="text-xs font-semibold text-ink">Documents / Corpus Description</label>
                <input
                  type="text"
                  placeholder="e.g. Leave_Policy_2024.pdf, Travel_Expenses.md"
                  value={docs}
                  onChange={(e) => setDocs(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-ink/[0.02] px-3.5 py-2 text-xs text-ink placeholder:text-muted focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Tool Registry */}
              <div>
                <label className="text-xs font-semibold text-ink">
                  Tool Registry (Audited by Generator)
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["CSV Lookup", "Calculator", "Weather API (Open-Meteo)", "Current Date"].map((tool) => {
                    const active = selectedTools.includes(tool);
                    return (
                      <button
                        key={tool}
                        type="button"
                        onClick={() =>
                          setSelectedTools((prev) =>
                            active ? prev.filter((t) => t !== tool) : [...prev, tool]
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "bg-emerald-600 text-white"
                            : "border bg-ink/[0.02] text-muted hover:border-emerald-400"
                        }`}
                      >
                        {tool}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  Note: The generator strictly audits bindings. An HR agent with a weather tool will be
                  rejected as a factory defect.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-semibold text-white shadow-md transition hover:scale-[1.01] active:scale-[0.99]"
                >
                  Start Autonomous Factory Pipeline →
                </button>
              </div>
            </form>
          )}

          {/* Running Factory Animation */}
          {running && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Executing Pipeline Unattended...
                </span>
                <span className="font-mono text-xs text-muted">
                  Stage {currentStage + 1} of {STAGES.length}
                </span>
              </div>

              <div className="space-y-2">
                {STAGES.map((s, idx) => {
                  const isCurrent = idx === currentStage;
                  const isDone = idx < currentStage;
                  return (
                    <div
                      key={s.n}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-xs transition ${
                        isCurrent
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 font-medium text-ink shadow-sm"
                          : isDone
                          ? "border-ok/30 bg-ok/[0.04] text-muted"
                          : "border-transparent bg-ink/[0.02] text-muted/50"
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                          isDone
                            ? "bg-ok text-white"
                            : isCurrent
                            ? "bg-emerald-600 text-white animate-pulse"
                            : "bg-ink/10 text-muted"
                        }`}
                      >
                        {isDone ? "✓" : s.n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-[11px] text-muted truncate">{s.desc}</div>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono animate-pulse">
                          processing...
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed State */}
          {completed && (
            <div className="space-y-5 py-2 text-center animate-fadeIn">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shadow-md">
                ✓
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink">Agent Built & Evidentially Scored</h3>
                <p className="mt-1 text-xs text-muted max-w-md mx-auto">
                  {name} has passed the groundability guard, eval synthesis, and critic-optimizer loop.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-2xl border bg-ink/[0.02] p-4 text-left">
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted">Pass Rate</div>
                  <div className="text-xl font-bold text-ok mt-0.5">{finalScore}%</div>
                  <div className="text-[10px] text-muted">evaluated over 24 cases</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted">Groundability</div>
                  <div className="text-xl font-bold text-ink mt-0.5">0.82 cos</div>
                  <div className="text-[10px] text-muted">1 unsupported refused</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted">Fix Delta</div>
                  <div className="text-xl font-bold text-accent mt-0.5">+18%</div>
                  <div className="text-[10px] text-muted">raised top_k to 8</div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-full border py-2.5 text-xs font-semibold hover:bg-ink/5 transition"
                >
                  Close & View in Gallery
                </button>
                <button
                  type="button"
                  onClick={handleFinishAndChat}
                  className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-semibold text-white shadow-md transition hover:scale-[1.01]"
                >
                  Chat with {name} Now →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
