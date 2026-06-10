"use client"
import { motion } from "framer-motion"
import { Clock4, Euro, HeartCrack } from "lucide-react"

/**
 * Section "coût d'opportunité" — convertit les heures perdues en argent + vie.
 * Lecture instantanée : 3 chiffres énormes, une vignette de vie sous chaque.
 */
export function CostOfOps() {
  const stats = [
    {
      big: "52",
      unit: "journées",
      bigSub: "par an",
      label: "à taper des devis",
      story: "C'est votre mois d'août. Plus 3 semaines.",
      color: "var(--electric)",
      Icon: Clock4,
    },
    {
      big: "29 120",
      unit: "€",
      bigSub: "par an",
      label: "que vous laissez sur la table",
      story: "1 jour/sem × 70 €/h × 8h × 52 sem.",
      color: "#10b981",
      Icon: Euro,
    },
    {
      big: "10",
      unit: "heures",
      bigSub: "chaque weekend",
      label: "que vos enfants ne récupèrent pas",
      story: "Et madame qui finit par ne plus rien dire.",
      color: "#e63946",
      Icon: HeartCrack,
    },
  ]
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {stats.map((s, i) => (
        <motion.article
          key={s.big}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="glass relative overflow-hidden rounded-2xl border border-border p-7"
        >
          <div
            className="absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl opacity-25"
            style={{ background: s.color }}
          />
          <s.Icon className="h-5 w-5 mb-6" style={{ color: s.color }} strokeWidth={1.7} />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-7xl font-extrabold tracking-tight leading-none" style={{ color: s.color }}>
              {s.big}
            </span>
            <span className="font-display text-2xl font-bold text-foreground/80">{s.unit}</span>
          </div>
          <div className="mt-2 text-base font-medium text-foreground">{s.label}</div>
          <div className="text-sm text-muted">{s.bigSub}</div>
          <p className="mt-5 text-[15px] text-foreground/85 leading-relaxed border-t border-border pt-4">
            {s.story}
          </p>
        </motion.article>
      ))}
    </div>
  )
}
