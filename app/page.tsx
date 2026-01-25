import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

export default async function Home() {
  const user = await currentUser();

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Minimal header */}
      <header className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-lg font-bold tracking-tight text-black dark:text-white">
          AirDrop Web
        </h1>
        <UserButton afterSignOutUrl="/" />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero - Swiss style: bold typography, minimal */}
        <div className="mb-16">
          <h2 className="text-5xl md:text-6xl font-bold text-black dark:text-white tracking-tight mb-6">
            Bonjour,
            <br />
            {user?.firstName || "Utilisateur"}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-md">
            Partagez vos fichiers instantanément entre vos appareils.
          </p>
        </div>

        {/* Action cards - Clean grid */}
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/upload"
            className="group block p-8 bg-black dark:bg-white text-white dark:text-black rounded-none hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-between mb-12">
              <span className="text-sm font-medium uppercase tracking-wider opacity-60">
                01
              </span>
              <svg
                className="w-6 h-6 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Envoyer</h3>
            <p className="text-sm opacity-60">
              Photos, documents, fichiers
            </p>
          </Link>

          <Link
            href="/gallery"
            className="group block p-8 border-2 border-black dark:border-white text-black dark:text-white rounded-none hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
          >
            <div className="flex items-center justify-between mb-12">
              <span className="text-sm font-medium uppercase tracking-wider opacity-60">
                02
              </span>
              <svg
                className="w-6 h-6 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Mes fichiers</h3>
            <p className="text-sm opacity-60">
              Visualiser et télécharger
            </p>
          </Link>
        </div>

        {/* Footer info - Minimal */}
        <div className="mt-24 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-600 font-mono">
            ID: {user?.id?.slice(0, 8)}...
          </p>
        </div>
      </main>
    </div>
  );
}
