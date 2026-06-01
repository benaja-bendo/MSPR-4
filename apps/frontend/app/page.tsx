import { LoginForm } from "./components/LoginForm";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <main className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-3xl font-semibold text-zinc-900">COFRAP</h1>
        <p className="mb-8 text-zinc-600">
          Frontend Next.js connecté aux types partagés du monorepo.
        </p>
        <LoginForm />
      </main>
    </div>
  );
}
