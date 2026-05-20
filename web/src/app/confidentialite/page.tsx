import Link from "next/link"
import { DepLogo } from "@/components/brand/dep-logo"

export const metadata = { title: "Confidentialité — DEP" }

export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/"><DepLogo size={32} withWordmark /></Link>
          <Link href="/connexion" className="text-sm text-muted hover:text-foreground">Connexion →</Link>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-6 py-12 prose prose-invert prose-headings:font-display prose-headings:tracking-tight prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-10 text-foreground">
        <h1>Politique de confidentialité</h1>
        <p className="text-muted text-sm">Dernière mise à jour : 20 mai 2026 — Conforme RGPD</p>

        <h2>1. Responsable du traitement</h2>
        <p>Maelig Goger, éditeur de DEP. Contact : <a href="mailto:privacy@dep-electrique.fr" className="text-electric hover:underline">privacy@dep-electrique.fr</a></p>

        <h2>2. Données collectées</h2>
        <ul>
          <li><strong>Compte</strong> : email, nom, société, mot de passe (hashé bcrypt)</li>
          <li><strong>Activité</strong> : devis, factures, incidents, clients que tu enregistres</li>
          <li><strong>Vocal</strong> : transcripts audio temporaires (supprimés après 30 jours)</li>
          <li><strong>Technique</strong> : adresse IP, user-agent (logs sécurité 90 jours)</li>
        </ul>

        <h2>3. Finalités</h2>
        <ul>
          <li>Fournir le service (création devis, facturation, gestion incidents)</li>
          <li>Améliorer la transcription multilingue (anonymisée)</li>
          <li>Facturer ton abonnement via Stripe</li>
          <li>Sécurité (détection abus, audit logs)</li>
        </ul>

        <h2>4. Hébergement</h2>
        <p>Données stockées en France :</p>
        <ul>
          <li><strong>Application</strong> : Vercel (régions UE)</li>
          <li><strong>Base de données</strong> : Supabase / OVH Roubaix</li>
          <li><strong>Transcription IA</strong> : DashScope Alibaba Cloud (singapour / régions UE)</li>
        </ul>

        <h2>5. Chiffrement</h2>
        <ul>
          <li>Au repos : AES-256</li>
          <li>En transit : TLS 1.3</li>
          <li>Mots de passe : bcrypt avec salt</li>
        </ul>

        <h2>6. Sous-traitants</h2>
        <ul>
          <li>Supabase (base de données + auth)</li>
          <li>Vercel (hébergement)</li>
          <li>Stripe (paiements)</li>
          <li>DashScope (transcription voix)</li>
          <li>Resend (emails transactionnels)</li>
        </ul>

        <h2>7. Tes droits</h2>
        <p>Tu peux à tout moment :</p>
        <ul>
          <li><strong>Accéder</strong> à tes données (export JSON depuis Paramètres)</li>
          <li><strong>Rectifier</strong> tes infos depuis ton profil</li>
          <li><strong>Supprimer</strong> ton compte (Paramètres → Compte → Supprimer)</li>
          <li><strong>Porter</strong> tes données (export complet en CSV/JSON)</li>
          <li><strong>T&apos;opposer</strong> à un traitement spécifique : <a href="mailto:privacy@dep-electrique.fr" className="text-electric hover:underline">privacy@dep-electrique.fr</a></li>
        </ul>

        <h2>8. Durée de conservation</h2>
        <ul>
          <li>Compte actif : tant que l&apos;abonnement est actif</li>
          <li>Après résiliation : 90 jours puis suppression définitive</li>
          <li>Documents comptables (factures) : 10 ans (obligation légale)</li>
          <li>Logs techniques : 90 jours</li>
        </ul>

        <h2>9. Cookies</h2>
        <p>DEP utilise uniquement des cookies essentiels (authentification, préférences). Aucun cookie marketing ou de tracking tiers (pas de Google Analytics, pas de Facebook Pixel).</p>

        <h2>10. CNIL</h2>
        <p>En cas de désaccord persistant, tu peux saisir la CNIL : <a href="https://www.cnil.fr" target="_blank" rel="noopener" className="text-electric hover:underline">www.cnil.fr</a></p>

        <hr className="my-12 border-border" />

        <p className="text-xs text-muted-2">⚠️ Document placeholder. À faire valider par un DPO ou avocat RGPD avant ouverture commerciale. <Link href="/" className="text-electric hover:underline">← Retour accueil</Link></p>
      </article>
    </main>
  )
}
