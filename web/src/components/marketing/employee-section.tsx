"use client"
import { motion } from "framer-motion"
import { ShieldCheck, KeyRound, Eye, Sparkles } from "lucide-react"

/**
 * Section employés : l'IA qui ne fait pas chier vos esclaves, et qui vous protège.
 */
export function EmployeeSection() {
  const points = [
    {
      Icon: KeyRound,
      title: "Vos prix restent les vôtres",
      body:
        "L'employé saisit, l'IA propose le prix mémorisé. Impossible de modifier. Verrouillé au niveau base de données.",
    },
    {
      Icon: Sparkles,
      title: "L'IA fait ce qu'on lui dit",
      body:
        "Pas de question stupide, pas de \"vous voulez vraiment ?\". L'employé parle, ça passe. Si c'est ambigu, l'IA résume avant pour confirmer.",
    },
    {
      Icon: Eye,
      title: "Vous voyez tout, tout le temps",
      body:
        "Chaque devis, chaque modif, chaque envoi : journal d'audit complet. Plus de \"je sais plus qui a fait quoi\".",
    },
    {
      Icon: ShieldCheck,
      title: "Vous ajoutez quand vous voulez",
      body:
        "+5 €/mois par employé. Vous coupez en 1 clic. Le compte se débranche sans toucher à vos données.",
    },
  ]
  return (
    <div className="grid md:grid-cols-2 gap-5">
      {points.map((p, i) => (
        <motion.div
          key={p.title}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: i * 0.08, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="flex gap-4 glass rounded-2xl border border-border p-6"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-electric/10 text-electric border border-electric/30">
            <p.Icon className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight">{p.title}</h3>
            <p className="mt-1 text-[15px] text-muted leading-relaxed">{p.body}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
