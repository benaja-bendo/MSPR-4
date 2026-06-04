import { LoginForm } from "./components/LoginForm";
import { RegisterFlow } from "./components/RegisterFlow";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#e2e8f0] bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#0f172a] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 5V11M5 6.5L8 5L11 6.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <span className="text-[15px] font-semibold text-[#0f172a] tracking-tight">COFRAP</span>
              <span className="ml-2 text-xs text-[#64748b] hidden sm:inline">Portail de sécurité</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#065f46] bg-[#ecfdf5] border border-[#a7f3d0] px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] inline-block"></span>
              PoC v1.0
            </span>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-6 py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#0284c7] bg-[#e0f2fe] border border-[#bae6fd] px-3 py-1 rounded-full mb-4">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path fillRule="evenodd" d="M5 1a4 4 0 100 8A4 4 0 005 1zM0 5a5 5 0 1110 0A5 5 0 010 5zm5-1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm3.5 5.25a.75.75 0 00-1.06-1.06L6.5 9.62l-.94-.94a.75.75 0 00-1.06 1.06l1.47 1.47a.75.75 0 001.06 0l1.47-1.47z" clipRule="evenodd"/>
              </svg>
              Authentification sécurisée
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#0f172a] leading-tight tracking-tight mb-3">
              Gestion des comptes<br className="hidden md:block" />
              <span className="text-[#0ea5e9]"> sécurisés COFRAP</span>
            </h1>
            <p className="text-[#64748b] text-base leading-relaxed max-w-lg">
              Création automatique des identifiants, mot de passe de 24 caractères transmis par QR code à usage unique, et authentification à deux facteurs obligatoire.
            </p>
            <div className="flex flex-wrap gap-4 mt-5">
              {[
                { icon: "🔐", label: "Mot de passe 24 car." },
                { icon: "📱", label: "2FA obligatoire" },
                { icon: "🔄", label: "Rotation 6 mois" },
                { icon: "🔒", label: "QR usage unique" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-[#475569]">
                  <span className="text-base">{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 md:py-12">
        <div className="grid gap-6 lg:gap-8 md:grid-cols-2 max-w-5xl mx-auto">
          {/* Register */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_4px_16px_rgb(0,0,0,0.06)] overflow-hidden">
            <div className="px-6 pt-6 pb-5 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#0f172a] flex items-center justify-center flex-shrink-0">
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <path d="M8.5 2a3 3 0 100 6 3 3 0 000-6zM3.5 13.5C3.5 11.015 5.762 9 8.5 9c.78 0 1.52.17 2.18.47" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="13" cy="13" r="3" stroke="white" strokeWidth="1.4"/>
                    <path d="M13 11.5v1.5l1 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#0f172a] leading-tight">Nouveau compte</h2>
                  <p className="text-xs text-[#64748b] mt-0.5">Inscription en 3 étapes</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <RegisterFlow />
            </div>
          </div>

          {/* Login */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_4px_16px_rgb(0,0,0,0.06)] overflow-hidden">
            <div className="px-6 pt-6 pb-5 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#0ea5e9] flex items-center justify-center flex-shrink-0">
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <rect x="3" y="7" width="11" height="8" rx="2" stroke="white" strokeWidth="1.4"/>
                    <path d="M5.5 7V5a3 3 0 016 0v2" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="8.5" cy="11" r="1" fill="white"/>
                    <path d="M8.5 12v1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#0f172a] leading-tight">Connexion</h2>
                  <p className="text-xs text-[#64748b] mt-0.5">Accès à votre compte</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <LoginForm />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e2e8f0] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-[#94a3b8]">
            COFRAP — Compagnie Française de Réalisation d&apos;Applicatifs Professionnels
          </span>
          <span className="text-xs text-[#cbd5e1]">MSPR TPRE921 · PoC Serverless</span>
        </div>
      </footer>
    </div>
  );
}
