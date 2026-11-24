/** Mirrors forgeai/models/*.py. Keep in sync: these are the same artifacts the
 *  factory writes, read straight off disk rather than through an API. */

export type Verdict = "supported" | "weak" | "unsupported";
export type CaseKind = "answerable" | "out_of_scope" | "edge";
export type FailureCategory =
  | "retrieval_miss" | "prompt_defect" | "hallucination" | "wrong_refusal";

export interface DocumentRef {
  doc_id: string; filename: string; kind: string; n_chars: number; sha256: string;
}

export interface Topic {
  name: string; description: string;
  support_score: number | null; supporting_chunks: string[]; verdict: Verdict | null;
}

export interface Assumption {
  question: string; assumed_answer: string;
  confidence: "high" | "medium" | "low"; basis: string;
}

export interface RequirementsDoc {
  brief: string; scope: string; audience: string; tone: string;
  must_answer: Topic[]; must_refuse: Topic[];
  questions_asked: string[]; assumptions: Assumption[];
  corpus_manifest: DocumentRef[]; mode: "interactive" | "unattended";
}

export interface GroundabilityReport {
  topics: Topic[]; unsupported: string[]; moved_to_refuse: string[];
  unsupported_ratio: number; aborted: boolean; abort_reason: string | null;
}

export interface RetrievalConfig {
  chunk_size: number; chunk_overlap: number; top_k: number;
  strategy: "dense" | "bm25" | "hybrid"; hybrid_alpha: number;
  query_rewrite: boolean; min_score: number;
}

export interface ToolBinding {
  name: string; reason: string; triggering_requirement: string;
}

export interface AgentDefinition {
  version: number; name: string; description: string; system_prompt: string;
  retrieval: RetrievalConfig; tools: ToolBinding[];
  output_contract: { refusal_message: string; require_citations: boolean };
  temperature: number;
  provenance: {
    corpus_hash?: string; n_documents?: number; must_answer?: string[];
    tools_proposed?: string[]; tools_rejected?: string[];
  };
}

export interface EvalCase {
  id: string; question: string; kind: CaseKind;
  edge_type: "ambiguous" | "multi_document" | null;
  expected_facts: string[]; source_documents: string[]; source_chunks: string[];
  should_refuse: boolean; difficulty: "easy" | "medium" | "hard";
}

export interface EvalSuite {
  cases: EvalCase[]; generated_by: string; generation_prompts: string[];
  gate_report: Record<string, number | string>;
}

export interface CaseVerdict {
  case_id: string; answer: string; refused: boolean; grounded: boolean;
  correct: boolean; citations_valid: boolean; fact_recall: number;
  unsupported_claim_rate: number; retrieved_chunks: string[]; passed: boolean;
  judge_path: "deterministic" | "llm_escalation"; notes: string;
  answer_length: number;
}

export interface Scorecard {
  iteration: number; total: number; passed: number; pass_rate: number;
  by_kind: Record<string, number>; by_difficulty: Record<string, number>;
  mean_answer_length: number; llm_escalation_rate: number;
}

export interface FixAction {
  category: FailureCategory; rung: string; rationale: string;
  targets_case_ids: string[];
  diff: { before?: Record<string, unknown>; after?: Record<string, unknown> };
}

export interface IterationLog {
  iteration: number; failures_by_category: Record<string, number>;
  diagnoses: { case_id: string; category: FailureCategory; evidence: string }[];
  fix: FixAction | null; score_before: number; score_after: number;
  kept: boolean; revert_reason: string | null; seconds: number; tokens: number;
}

export interface JudgeCalibration {
  n_cases: number; agreements: number; agreement_rate: number;
  cohens_kappa: number;
  disagreements: { case_id: string; judge: boolean; human: boolean }[];
}

export interface RunReport {
  run_id: string; brief: string; corpus_hash: string; final_pass_rate: number;
  scorecards: Scorecard[]; iterations: IterationLog[];
  residual_failures: { case_id: string; question: string; why: string }[];
  calibration: JudgeCalibration | null; stop_reason: string;
  budget: { tokens_used: number; max_tokens: number; max_iterations: number } | null;
  best_version: number;
}

export interface WebChunk {
  chunk_id: string; doc_id: string; filename: string; text: string; vector: number[];
}

export interface Run {
  id: string;
  synthetic: boolean;
  manifest: { brief: string; documents: DocumentRef[]; skipped: string[] };
  requirements: RequirementsDoc | null;
  groundability: GroundabilityReport | null;
  definitionV0: AgentDefinition | null;
  definition: AgentDefinition | null;
  suite: EvalSuite | null;
  report: RunReport | null;
  verdicts: Record<number, CaseVerdict[]>;
  reportMarkdown: string | null;
}
