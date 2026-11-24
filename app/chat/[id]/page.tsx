import Link from "next/link";
import { notFound } from "next/navigation";
import { listRunIds, loadRun } from "@/lib/runs";
import { Pill } from "@/components/ui";
import { ChatClient } from "./chat-client";

export async function generateStaticParams() {
  return (await listRunIds()).map((id) => ({ id }));
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await loadRun(id);
  if (!run?.definition) notFound();

  const d = run.definition;
  const cases = run.suite?.cases ?? [];
  const suggestions = [
    ...cases.filter((c) => c.kind === "answerable").slice(0, 2),
    ...cases.filter((c) => c.should_refuse).slice(0, 1),
  ].map((c) => c.question);

  return (
    <main className="relative">
      <div className="wash wash-cool" aria-hidden />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href={`/runs/${id}`} className="text-sm text-muted transition hover:text-ink">
          ← {id.replace(/^_/, "").replace(/_/g, " ")}
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <span className="mono-nums font-mono text-[13px] font-bold text-accent">08</span>
          <span className="h-px w-10 bg-ink/20" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
            Runnable product
          </span>
        </div>

        <h1 className="display mt-4 text-[clamp(1.7rem,3.6vw,2.3rem)]">{d.name}</h1>
        <p className="lede mt-4">{d.description}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
        <Pill tone="accent">v{d.version}</Pill>
        <Pill>{d.tools.length ? d.tools.map((t) => t.name).join(", ") : "no tools"}</Pill>
        <Pill>top_k {d.retrieval.top_k}</Pill>
          {run.synthetic && <Pill tone="warn">fixture corpus</Pill>}
        </div>

        <p className="mt-6 rounded-xl border border-warn/30 bg-warn/[0.06] p-4 text-[12.5px] leading-relaxed text-muted">
        <strong className="text-warn">This runtime is reduced.</strong> Two
          differences from the CLI, both stated rather than hidden. Retrieval
          here is BM25 over the same committed chunks, because dense{" "}
          <code className="font-mono">bge-small</code> embeddings cannot run
          inside a Vercel function. And attached tools are not executed here —
          the CLI runs one tool call per question through the registry, which
          this route does not. The agent definition and corpus are identical,
          and every score on the run page was measured with the CLI, which is
          the reference implementation.</p>

        <ChatClient runId={id} suggestions={suggestions} />
      </div>
    </main>
  );
}
