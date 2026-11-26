/**
 * A tiny TTL + LRU cache.
 *
 * WHAT IT IS AND IS NOT: this lives in one serverless instance's memory. Vercel
 * may run several instances and will discard them when idle, so a hit is a
 * best-effort saving and never a guarantee. That is still worth having — a
 * reviewer clicking the same suggested question three times usually lands on
 * the same warm instance, and each miss costs real tokens from a daily budget
 * that is already the binding constraint on this project.
 *
 * It is NOT a correctness mechanism. Nothing here may change an answer: the
 * cache is keyed on everything that determines the result, so a hit returns
 * what a miss would have computed.
 */

interface Entry<V> {
  value: V;
  expires: number;
}

export class TTLCache<V> {
  private map = new Map<string, Entry<V>>();
  // Explicit fields rather than constructor parameter properties: those are
  // one of the few TypeScript features that EMIT code rather than only
  // describing types, so Node's type stripping cannot run the file and the
  // tests could not import it.
  private readonly max: number;
  private readonly ttlMs: number;

  constructor(max: number, ttlMs: number) {
    this.max = max;
    this.ttlMs = ttlMs;
  }

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert so iteration order tracks recency: Map keeps insertion order,
    // which makes the oldest key the first one out.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

/** Stable key for a cached answer: everything that determines the result. */
export function answerKey(runId: string, question: string, model: string): string {
  return `${runId}\u0000${model}\u0000${question.trim().toLowerCase().replace(/\s+/g, " ")}`;
}
