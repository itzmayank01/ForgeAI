/**
 * Which member of a team should answer?
 *
 * A team room is only honest if the routing is a measurement rather than a
 * guess dressed up with an avatar. This scores the question against every
 * member corpus that actually exists and hands the question to the best one,
 * returning the whole table so the page can show why.
 *
 * The scoring pools every member's chunks into ONE document set before running
 * BM25. That matters: BM25's IDF term is computed over the document set it is
 * given, so scoring each corpus separately produces numbers from different
 * scales that cannot be compared. Pooling gives every corpus the same IDF and
 * the same length normalisation, so the totals mean the same thing.
 *
 * This is a lexical router. It knows nothing about meaning, so a question
 * phrased entirely in words none of the corpora use routes nowhere — which it
 * reports, rather than picking the first member and hoping.
 */

import { bm25 } from "./bm25";

export interface RouterCorpus {
  /** Agent id of the member that owns this corpus. */
  agentId: string;
  /** Run id whose committed chunks these are. */
  runId: string;
  chunks: { text: string; chunk_id: string; filename: string }[];
}

export interface RouterScore {
  agentId: string;
  runId: string;
  /** Summed BM25 mass of this corpus's hits in the pooled ranking. */
  score: number;
  /** Share of the total mass across all member corpora, 0..1. */
  share: number;
  /** Best-matching file in this corpus, for showing the reader. */
  topFile: string | null;
}

export interface RouterDecision {
  /** The member that should answer, or null when nothing matched. */
  winner: string | null;
  /**
   * True when the top two corpora are within AMBIGUOUS_MARGIN of each other.
   * The question still routes to the winner; the flag exists so the page can
   * say the margin was thin instead of implying a confident decision.
   */
  ambiguous: boolean;
  reason: "routed" | "no_lexical_overlap" | "no_built_members";
  scores: RouterScore[];
}

/**
 * How many of the pooled top hits are counted. Taking the single best hit
 * makes the decision turn on one chunk; taking all of them lets a large corpus
 * win on bulk. Ten is the same order as the agents' own top_k.
 */
export const POOL_DEPTH = 10;

/** Below this gap in share, the two leaders are reported as close. */
export const AMBIGUOUS_MARGIN = 0.1;

export function routeQuestion(
  question: string,
  corpora: RouterCorpus[],
): RouterDecision {
  if (corpora.length === 0) {
    return { winner: null, ambiguous: false, reason: "no_built_members", scores: [] };
  }

  // One pooled set, so every corpus is scored under the same IDF.
  const pooled = corpora.flatMap((c) =>
    c.chunks.map((ch) => ({ ...ch, __agentId: c.agentId })),
  );
  const hits = bm25(question, pooled, POOL_DEPTH, 1.5, 0.75, /* normalize */ false);

  const totals = new Map<string, { score: number; topFile: string | null }>();
  for (const c of corpora) totals.set(c.agentId, { score: 0, topFile: null });

  for (const h of hits) {
    const entry = totals.get(h.item.__agentId);
    if (!entry) continue;
    if (entry.topFile === null) entry.topFile = h.item.filename;
    entry.score += h.score;
  }

  const mass = [...totals.values()].reduce((n, e) => n + e.score, 0);
  const scores: RouterScore[] = corpora
    .map((c) => {
      const e = totals.get(c.agentId)!;
      return {
        agentId: c.agentId,
        runId: c.runId,
        score: Number(e.score.toFixed(4)),
        share: mass > 0 ? Number((e.score / mass).toFixed(4)) : 0,
        topFile: e.topFile,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (mass === 0) {
    return { winner: null, ambiguous: false, reason: "no_lexical_overlap", scores };
  }

  const ambiguous =
    scores.length > 1 && scores[0].share - scores[1].share < AMBIGUOUS_MARGIN;

  return { winner: scores[0].agentId, ambiguous, reason: "routed", scores };
}
