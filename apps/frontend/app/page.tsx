import { LoginForm } from "./components/LoginForm";
import { RegisterFlow } from "./components/RegisterFlow";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12">
      <main className="grid w-full max-w-4xl gap-8 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-3xl font-semibold text-zinc-900">COFRAP</h1>
          <p className="mb-8 text-zinc-600">
            PoC MSPR — mot de passe généré, QR usage unique, 2FA obligatoire, expiration 6 mois.
          </p>
          <RegisterFlow />
        </section>
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <LoginForm />
        </section>
      </main>
    </div>
  );
}
