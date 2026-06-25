import Link from "next/link"
import { DepLogo } from "@/components/brand/dep-logo"

export const metadata = { title: "CGV — DEP" }

export default function CgvPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/"><DepLogo size={32} withWordmark /></Link>
          <Link href="/connexion" className="text-sm text-muted hover:text-foreground">Connexion →</Link>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-6 py-12 prose prose-invert prose-headings:font-display prose-headings:tracking-tight prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-10 text-foreground">
        <h1>Conditions Générales de Vente</h1>
        <p className="text-muted text-sm">Dernière mise à jour : 20 mai 2026</p>

        <h2>1. Objet</h2>
        <p>Les présentes conditions générales régissent l&apos;utilisation de la plateforme DEP, service en ligne de gestion d'entreprise (devis, factures, incidents chantier) édité par Maelig Goger.</p>

        <h2>2. Tarification</h2>
        <p>DEP Pro : 100 € HT / mois par patron. DEP Employé : 10 € HT / mois par employé connecté. Essai gratuit 14 jours sans CB. Facturation mensuelle, résiliation à tout moment depuis l&apos;application.</p>

        <h2>3. Données personnelles</h2>
        <p>Les données sont hébergées en France (OVH Roubaix), chiffrées AES-256 au repos et TLS 1.3 en transit. Voir <Link href="/confidentialite" className="text-electric hover:underline">notre politique de confidentialité</Link>.</p>

        <h2>4. Conformité Factur-X</h2>
        <p>DEP est conforme à la facturation électronique B2B obligatoire en septembre 2026 (Factur-X PDF/A-3 + XML CII).</p>

        <h2>5. Résiliation</h2>
        <p>Résiliation libre, prise d&apos;effet le mois suivant. Aucune pénalité. Données exportables 90 jours après résiliation.</p>

        <h2>6. Responsabilité</h2>
        <p>DEP est un outil d&apos;aide à la gestion. L&apos;utilisateur reste responsable de la validité juridique et fiscale des documents émis. DEP ne peut être tenu responsable d&apos;erreurs résultant d&apos;une utilisation non conforme.</p>

        <h2>7. Support</h2>
        <p>Support par email sous 24h ouvrées : <a href="mailto:support@dep-pro.fr" className="text-electric hover:underline">support@dep-pro.fr</a></p>

        <h2>8. Litiges</h2>
        <p>En cas de litige, les parties s&apos;efforceront de trouver une solution amiable. À défaut, les tribunaux de Paris seront seuls compétents.</p>

        <hr className="my-12 border-border" />

        <p className="text-xs text-muted-2">⚠️ Ces CGV sont un modèle placeholder. À faire valider par un avocat avant ouverture commerciale. <Link href="/" className="text-electric hover:underline">← Retour accueil</Link></p>
      </article>
    </main>
  )
}
