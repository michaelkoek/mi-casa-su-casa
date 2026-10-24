export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-16">
      <p className="text-sm text-ink-3">Fase 0</p>
      <h1 className="text-3xl font-semibold tracking-tight">Mi casa su casa</h1>
      <p className="max-w-[40ch] text-ink-2">
        Het fundament volgt in fase 1. Zie CLAUDE.md en docs/design.md.
      </p>
    </main>
  );
}
