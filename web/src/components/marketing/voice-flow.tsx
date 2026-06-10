"use client"
import { motion } from "framer-motion"
import { Mic, Sparkles, FileText, Send, ArrowRight } from "lucide-react"

const steps = [
  {
    Icon: Mic,
    label: "Vous parlez",
    sub: "90 secondes",
    color: "#e63946",
  },
  {
    Icon: Sparkles,
    label: "On corrige",
    sub: "Toutes langues → français",
    color: "#2f6fff",
  },
  {
    Icon: FileText,
    label: "Le devis est prêt",
    sub: "Articles + prix mémorisés",
    color: "#ffd500",
  },
  {
    Icon: Send,
    label: "Le client signe",
    sub: "Par email, en 1 clic",
    color: "#10b981",
  },
]

export function VoiceFlow() {
  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-3 md:gap-2">
        {steps.map((step, i) => (
          <div key={step.label} className="contents">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.12, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="glass relative rounded-2xl border border-border p-5 flex flex-col items-center text-center"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 grid h-7 w-7 place-items-center rounded-full bg-background border border-border text-[11px] font-mono font-bold" style={{ color: step.color }}>
                {(i + 1).toString().padStart(2, "0")}
              </div>
              <div
                className="mt-3 grid h-16 w-16 place-items-center rounded-2xl"
                style={{
                  background: `${step.color}22`,
                  color: step.color,
                  boxShadow: `inset 0 0 0 1px ${step.color}55, 0 12px 30px -12px ${step.color}66`,
                }}
              >
                <step.Icon className="h-8 w-8" strokeWidth={1.7} />
              </div>
              <div className="mt-4 font-display text-lg font-bold tracking-tight">{step.label}</div>
              <div className="mt-1 text-sm text-muted">{step.sub}</div>
            </motion.div>

            {i < steps.length - 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.12 + 0.25, duration: 0.45 }}
                className="hidden md:flex items-center justify-center"
                aria-hidden="true"
              >
                <Arrow color={step.color} nextColor={steps[i + 1].color} />
              </motion.div>
            )}
            {i < steps.length - 1 && (
              <div className="md:hidden flex items-center justify-center text-muted" aria-hidden="true">
                <ArrowRight className="h-5 w-5 rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Arrow({ color, nextColor }: { color: string; nextColor: string }) {
  return (
    <svg width="80" height="56" viewBox="0 0 80 56" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" x2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.9" />
          <stop offset="1" stopColor={nextColor} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path
        d="M 4 28 L 64 28"
        stroke={`url(#grad-${color.replace("#", "")})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M 56 18 L 70 28 L 56 38"
        stroke={nextColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
