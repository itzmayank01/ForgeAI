/**
 * BM25 lexical retrieval, in TypeScript.
 *
 * The CLI runtime retrieves with bge-small dense embeddings. That model cannot
 * run inside a Vercel function (torch is ~1-2GB against a 250MB limit), so the
 * hosted chat uses BM25 over the same committed chunks instead.
 *
 * This is a real divergence and the UI says so rather than hiding it: the same
 * agent definition, the same corpus, a different retrieval path. The CLI is the
 * reference implementation and the one every committed score was measured on.
 */

const STOP = new Set([
  "the","a","an","and","or","but","if","then","is","are","was","were","be","been",
  "of","to","in","on","at","for","with","by","from","as","that","this","these",
  "those","it","its","do","does","did","can","could","should","would","will",
  "what","which","who","whom","how","when","where","why","i","you","we","they",
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length > 1 && !STOP.has(t),
  );
}

export interface Scored<T> { item: T; score: number }

export function bm25<T extends { text: string }>(
  query: string, docs: T[], topK = 5, k1 = 1.5, b = 0.75,
): Scored<T>[] {
  if (docs.length === 0) return [];
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const tokenized = docs.map((d) => tokenize(d.text));
  const lengths = tokenized.map((t) => t.length);
  const avgLen = lengths.reduce((a, n) => a + n, 0) / docs.length || 1;

  // Document frequency per query term.
  const df = new Map<string, number>();
  for (const term of new Set(terms)) {
    df.set(term, tokenized.filter((t) => t.includes(term)).length);
  }

  const scored = docs.map((item, i) => {
    const counts = new Map<string, number>();
    for (const t of tokenized[i]) counts.set(t, (counts.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of terms) {
      const f = counts.get(term) ?? 0;
      if (f === 0) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * lengths[i]) / avgLen)));
    }
    return { item, score };
  });

  const max = Math.max(...scored.map((s) => s.score), 0);
  return scored
    .filter((s) => s.score > 0)
    .map((s) => ({ ...s, score: max > 0 ? s.score / max : 0 }))
    .sort((a, b2) => b2.score - a.score)
    .slice(0, topK);
}
