"use client"
import { motion } from "framer-motion"

/**
 * Vignettes "vous reconnaissez ?" — court, ciselé, émotionnel.
 * 3 scènes très concrètes de la vie d'un patron électricien.
 */
const VIGNETTES = [
  {
    when: "Vendredi · 23h17",
    body:
      "Vous tapez encore le devis Martin. Madame s'est couchée sans vous embrasser. Vous avez raté le match.",
    after: "Avec DEP : 2 minutes en vocal pendant le trajet retour.",
    color: "#e63946",
  },
  {
    when: "Lundi · 9h12",
    body:
      "Le client vous appelle. \"Vous m'avez envoyé le devis ?\" Vous regardez dans 4 dossiers, 2 boîtes mail, 1 cahier. Rien.",
    after: "Avec DEP : ouvert sur le téléphone, signé en 30 secondes.",
    color: "#2f6fff",
  },
  {
    when: "Fin du mois",
    body:
      "3 factures impayées. Vous n'osez pas relancer. Vous n'aimez pas insister. La trésorerie se serre.",
    after: "Avec DEP : les relances partent toutes seules, sans vous.",
    color: "#10b981",
  },
]

export function Vignettes() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {VIGNETTES.map((v, i) => (
        <motion.figure
          key={v.when}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="glass rounded-2xl border border-border p-6"
        >
          <figcaption className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[0.16em]" style={{ color: v.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.color }} />
            {v.when}
          </figcaption>
          <blockquote className="mt-4 font-display text-lg sm:text-xl font-semibold leading-snug">
            « {v.body} »
          </blockquote>
          <figcaption className="mt-4 text-sm text-electric font-medium">
            {v.after}
          </figcaption>
        </motion.figure>
      ))}
    </div>
  )
}
