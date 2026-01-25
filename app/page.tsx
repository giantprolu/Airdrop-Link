import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

export default async function Home() {
  const user = await currentUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <header className="flex items-center justify-between p-4 border-b bg-white/80 backdrop-blur dark:bg-gray-900/80">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          AirDrop Web
        </h1>
        <UserButton afterSignOutUrl="/" />
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-12 mt-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Bienvenue, {user?.firstName || "Utilisateur"} !
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Partagez vos fichiers instantanément entre vos appareils
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link
            href="/upload"
            className="block p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700"
          >
            <div className="text-4xl mb-4">📤</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Envoyer
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Uploadez photos, documents et fichiers
            </p>
          </Link>

          <Link
            href="/gallery"
            className="block p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700"
          >
            <div className="text-4xl mb-4">📁</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Mes fichiers
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Visualisez et téléchargez vos fichiers
            </p>
          </Link>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>User ID: {user?.id}</p>
        </div>
      </main>
    </div>
  );
}
