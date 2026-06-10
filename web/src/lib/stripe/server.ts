import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY missing — configure Stripe in env first")
  }
  _stripe = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: { name: "DEP", version: "0.1.0" },
  })
  return _stripe
}

export const STRIPE_TRIAL_DAYS = 14

export const PRICE_IDS = {
  main: process.env.STRIPE_PRICE_MAIN || "",
  slave: process.env.STRIPE_PRICE_SLAVE || "",
}
