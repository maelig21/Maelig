"use client"
import { Zap, Shield, Sparkles, Languages, Clock4, BrainCircuit } from "lucide-react"

const items = [
  { Icon: Languages, label: "Vos employés enfin compris" },
  { Icon: Clock4, label: "1 journée gagnée par semaine" },
  { Icon: BrainCircuit, label: "Mémoire articles intelligente" },
  { Icon: Zap, label: "Devis vocal en 90 secondes" },
  { Icon: Sparkles, label: "Clarification IA avant validation" },
  { Icon: Shield, label: "Données hébergées en Europe" },
]

export function MarqueeTrust() {
  const loop = [...items, ...items]
  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/40 py-5">
      <div className="marquee flex gap-12 whitespace-nowrap">
        {loop.map(({ Icon, label }, i) => (
          <span
            key={`${label}-${i}`}
            className="flex items-center gap-2.5 text-[15px] text-foreground/85"
          >
            <Icon className="h-4 w-4 text-electric" />
            {label}
          </span>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </div>
  )
}
