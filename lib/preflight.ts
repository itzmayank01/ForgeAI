/**
 * A retrieval pre-flight on a brief, before you spend a build on it.
 *
 * WHAT THIS IS NOT: the factory's groundability stage. That stage embeds every
 * topic the intake interviewer extracted with bge-small and takes the max
 * cosine against the chunk index, with cut-offs (0.68 / 0.78) derived against
 * that model. Neither the embedding model nor an API key is available in a
 * Vercel function, so none of that can run here, and reusing cosine cut-offs
 * on BM25 scores would be a borrowed number wearing a measurement's clothes.
 *
 * WHAT THIS IS: the brief is split into clauses, each clause is retrieved
 * against the corpus you picked, and you are shown the passage that came back.
 * No verdict. That is not modesty, it is the measurement:
 * scripts/calibrate-preflight.mjs scored topics the committed runs proved
 * covered against topics they proved absent, and the two distributions overlap
 * badly (5 of 8 positives fall at or below the top negative). A must-refuse
 * topic is written in the documents' own vocabulary -- "must not recommend a
 * supplier" against a folder of supplier agreements -- so lexical overlap is
 * highest exactly where support is absent.
 *
 * So the useful thing this can honestly do is show you the passage your agent
 * would actually retrieve for each clause of your brief. A reader can tell in
 * two seconds whether that passage answers the clause. A badge saying
 * "supported" could not, and the calibration artifact is checked at module
 * load so nobody can quietly add one back.
 */

import { bm25, tokenize } from "./bm25";
import calibration from "../data/preflight-calibration.json" with { type: "json" };

export interface Calibration {
  positives: { n: number; min: number; max: number; median: number };
  negatives: { n: number; min: number; max: number; median: number };
  separates: boolean;
  overlapping_positives: number;
  verdict: string;
}

export const CALIBRATION = calibration as Calibration;

/**
 * The pre-flight may only show a supported/unsupported verdict if the
 * committed calibration says the score separates the two. It does not, so
 * `probeTopics` returns no verdict field at all. If a future corpus makes the
 * signal separable, re-run the script, and this constant flips on its own.
 */
export const MAY_CLASSIFY = CALIBRATION.separates;

export interface ProbeResult {
  clause: string;
  /** A prohibition ("must not ...") -- deterministic, not a judgement. */
  prohibition: boolean;
  /** Raw BM25 of the best chunk, divided by clause length. No verdict attached. */
  score: number;
  topFile: string | null;
  topChunk: string | null;
  /** The passage itself. This is the output that is actually worth reading. */
  passage: string | null;
}

export interface PreflightResult {
  probes: ProbeResult[];
  /** How many clauses retrieved nothing at all from this corpus. */
  emptyClauses: number;
  classified: false;
}

const NEGATION =
  /\b(must not|should not|never|refuse|decline|don't|do not|cannot|not give|no legal)\b/i;

/**
 * Split a brief into clauses worth probing.
 *
 * Sentence boundaries first, then dash and semicolon segments, because a
 * brief's real topic list usually hides in an aside: "answers HR policy
 * questions - annual leave and carry-over, parental leave, travel expense
 * reimbursement" is one sentence and four topics.
 */
export function splitTopics(brief: string): string[] {
  const text = brief.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const segment of sentence.split(/\s[-–—]\s|;\s*/)) {
      // A long comma list after a dash is usually the topics themselves.
      const parts =
        segment.includes(",") && tokenize(segment).length > 8
          ? segment.split(/,\s*(?:and\s+)?/)
          : [segment];
      for (const part of parts) {
        const clause = part.replace(/^(and|or)\s+/i, "").replace(/[.,;]+$/, "").trim();
        if (tokenize(clause).length >= 2) out.push(clause);
      }
    }
  }
  return out;
}

export function probeTopics(
  clauses: string[],
  chunks: { text: string; chunk_id: string; filename: string }[],
): PreflightResult {
  const probes: ProbeResult[] = clauses.map((clause) => {
    // Normalised within the corpus, the best chunk for ANY clause scores 1.0,
    // which would make every clause look equally well covered. The raw score
    // carries the signal, scaled by clause length so a long clause does not
    // out-score a short one purely by having more terms to match.
    const raw = bm25(clause, chunks, 1, 1.5, 0.75, /* normalize */ false);
    const terms = Math.max(tokenize(clause).length, 1);
    const hit = raw[0];
    return {
      clause,
      prohibition: NEGATION.test(clause),
      score: hit ? Number((hit.score / terms).toFixed(4)) : 0,
      topFile: hit?.item.filename ?? null,
      topChunk: hit?.item.chunk_id ?? null,
      passage: hit ? hit.item.text.slice(0, 420) : null,
    };
  });

  return {
    probes,
    emptyClauses: probes.filter((p) => p.passage === null).length,
    classified: false,
  };
}
