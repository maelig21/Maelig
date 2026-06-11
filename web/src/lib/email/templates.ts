/**
 * Templates email HTML. Inline CSS, mobile-friendly, ton DEP.
 */
const BASE_CSS = `
  body { margin: 0; padding: 0; background: #07070b; color: #f4f4f5; font-family: Inter, -apple-system, Segoe UI, sans-serif; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px; }
  .card { background: #14141d; border: 1px solid #25252f; border-radius: 14px; padding: 28px; }
  .button {
    display: inline-block; padding: 12px 22px; background: #ffd500; color: #000;
    text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;
  }
  h1 { font-size: 26px; margin: 0 0 12px; font-weight: 800; }
  h2 { font-size: 18px; margin: 24px 0 8px; }
  p { line-height: 1.55; color: #d4d4d8; margin: 12px 0; }
  .muted { color: #a1a1aa; font-size: 12px; }
  .total { font-size: 32px; font-weight: 800; color: #ffd500; }
  .border-top { border-top: 1px solid #25252f; padding-top: 16px; margin-top: 16px; }
`

const wrap = (inner: string) => `
<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${BASE_CSS}</style>
  </head>
  <body>
    <div class="container">
      <div style="margin-bottom: 12px; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">⚡ <span style="color:#ffd500">DEP</span></div>
      <div class="card">${inner}</div>
      <p class="muted" style="margin-top: 20px;">Email envoyé via DEP, devis et gestion d'entreprise. <a style="color:#ffd500" href="https://dep-pro.fr">dep-pro.fr</a></p>
    </div>
  </body>
</html>`

export function devisEnvoiTemplate(opts: {
  clientName: string
  numero: string
  totalTtc: string
  signUrl: string
  patron: string
  patronEntreprise: string
}): { subject: string; html: string; text: string } {
  const subject = `${opts.patronEntreprise} — Devis n° ${opts.numero}`
  const html = wrap(`
    <h1>Bonjour ${opts.clientName.split(" ")[0] || ""}</h1>
    <p>Comme convenu, voici le devis n° <strong>${opts.numero}</strong> pour votre chantier.</p>
    <p>Total TTC : <span class="total">${opts.totalTtc}</span></p>
    <p style="text-align:center; margin: 28px 0;">
      <a class="button" href="${opts.signUrl}">Consulter et signer le devis</a>
    </p>
    <p>Le devis est joint en PDF. Si vous avez la moindre question, répondez simplement à ce mail.</p>
    <p class="border-top">Bien à vous,<br><strong>${opts.patron}</strong><br>${opts.patronEntreprise}</p>
  `)
  const text = `Bonjour,\n\nVoici le devis n° ${opts.numero} pour votre chantier.\nTotal TTC : ${opts.totalTtc}\n\nConsulter et signer : ${opts.signUrl}\n\nBien à vous,\n${opts.patron} — ${opts.patronEntreprise}`
  return { subject, html, text }
}

export function relanceTemplate(opts: {
  clientName: string
  numero: string
  totalTtc: string
  reste: string
  dateEcheance: string
  joursRetard: number
  payUrl: string
  patron: string
  patronEntreprise: string
  intensity: "hebdo" | "quotidienne" | "finale"
}): { subject: string; html: string; text: string } {
  const titles = {
    hebdo: `Rappel amical · facture ${opts.numero}`,
    quotidienne: `Facture ${opts.numero} · en attente depuis ${opts.joursRetard} jours`,
    finale: `URGENT · facture ${opts.numero} non réglée`,
  }
  const tones = {
    hebdo: `<p>Un petit rappel pour la facture <strong>${opts.numero}</strong> émise le ${opts.dateEcheance}.</p>
            <p>Le règlement n'est pas encore arrivé. Probablement un oubli ?</p>`,
    quotidienne: `<p>La facture <strong>${opts.numero}</strong> est en attente de paiement depuis ${opts.joursRetard} jours.</p>
                  <p>Merci de procéder au règlement dès que possible pour éviter l'application de pénalités.</p>`,
    finale: `<p><strong>La facture ${opts.numero} reste impayée à ce jour (${opts.joursRetard} jours de retard).</strong></p>
             <p>Sans règlement sous 8 jours, nous serons contraints de transmettre votre dossier à notre service contentieux. Nous préférons un règlement à l'amiable, alors n'hésitez pas à nous appeler.</p>`,
  }
  const html = wrap(`
    <h1>Bonjour ${opts.clientName.split(" ")[0] || ""}</h1>
    ${tones[opts.intensity]}
    <p>Reste à régler : <span class="total">${opts.reste}</span></p>
    <p style="text-align:center; margin: 28px 0;">
      <a class="button" href="${opts.payUrl}">Régler en ligne</a>
    </p>
    <p>Ou par virement (RIB sur la facture). Si vous l'avez déjà fait, merci d'ignorer ce message.</p>
    <p class="border-top">Cordialement,<br><strong>${opts.patron}</strong><br>${opts.patronEntreprise}</p>
  `)
  const text = `Bonjour,\n\nRappel pour la facture ${opts.numero} émise le ${opts.dateEcheance}.\nReste à régler : ${opts.reste}\nRégler : ${opts.payUrl}\n\nCordialement,\n${opts.patron} — ${opts.patronEntreprise}`
  return { subject: titles[opts.intensity], html, text }
}
