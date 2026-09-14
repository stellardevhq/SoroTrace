import Link from "next/link";

const GITHUB_URL = "https://github.com/stellardevhq/SoroTrace";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-black dark:text-zinc-50"
        >
          SoroTrace
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <span className="cursor-default">Explorer</span>
          <span className="cursor-default">Docs</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-black dark:hover:text-zinc-50"
          >
            GitHub
          </a>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          In development
        </span>
        <h1 className="text-5xl font-semibold tracking-tight text-black sm:text-6xl dark:text-zinc-50">
          SoroTrace
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Soroban contract event indexer and explorer for the Stellar ecosystem.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex h-12 items-center rounded-full bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          View on GitHub
        </a>
      </main>
    </div>
  );
}