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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/runs/${id}`} className="text-sm text-muted hover:text-ink">
        ← {id.replace(/^_/, "").replace(/_/g, " ")}
      </Link>

      <h1 className="display mt-4 text-[clamp(1.6rem,3.6vw,2.2rem)]">{d.name}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{d.description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill tone="accent">v{d.version}</Pill>
        <Pill>{d.tools.length ? d.tools.map((t) => t.name).join(", ") : "no tools"}</Pill>
        <Pill>top_k {d.retrieval.top_k}</Pill>
        {run.synthetic && <Pill tone="warn">fixture corpus</Pill>}
      </div>

      <p className="mt-5 rounded-xl border border-warn/30 bg-warn/[0.06] p-3.5 text-xs leading-relaxed text-muted">
        <strong className="text-warn">Retrieval differs here.</strong> The CLI runtime retrieves
        with dense <code className="font-mono">bge-small</code> embeddings, which cannot run
        inside a Vercel function. This hosted chat uses BM25 over the same committed chunks and
        the same agent definition. Every score on the run page was measured with the CLI, which
        is the reference implementation.
      </p>

      <ChatClient runId={id} suggestions={suggestions} />
    </main>
  );
}
