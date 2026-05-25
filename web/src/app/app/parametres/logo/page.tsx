import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Upload, Trash2, Check } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { Card, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

async function uploadLogo(formData: FormData) {
  "use server"
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle()
  if (!profile?.org_id || (profile.role !== "owner" && profile.role !== "admin_dep")) return

  const file = formData.get("logo") as File
  if (!file || file.size === 0) return

  // Validate: images only, max 2MB
  if (!file.type.startsWith("image/")) return
  if (file.size > 2 * 1024 * 1024) return

  const admin = supabaseAdmin()
  const ext = file.name.split(".").pop() ?? "png"
  const path = `org-logos/${profile.org_id}/logo.${ext}`

  const buf = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage.from("assets").upload(path, buf, {
    contentType: file.type,
    upsert: true,
  })
  if (upErr) throw new Error(upErr.message)

  // Get public URL
  const { data: pubUrl } = admin.storage.from("assets").getPublicUrl(path)

  // Update org record
  await admin.from("orgs").update({ logo_url: pubUrl.publicUrl }).eq("id", profile.org_id)

  revalidatePath("/app/parametres/logo")
  redirect("/app/parametres/logo?ok=1")
}

async function removeLogo() {
  "use server"
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle()
  if (!profile?.org_id || (profile.role !== "owner" && profile.role !== "admin_dep")) return

  const admin = supabaseAdmin()
  await admin.from("orgs").update({ logo_url: null }).eq("id", profile.org_id)

  // Try to remove old files
  await admin.storage.from("assets").remove([`org-logos/${profile.org_id}`]).catch(() => {})

  revalidatePath("/app/parametres/logo")
  redirect("/app/parametres/logo?deleted=1")
}

export default async function LogoPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user!.id).maybeSingle()
  const { data: org } = await supabase.from("orgs").select("nom, logo_url").eq("id", profile!.org_id!).maybeSingle()
  const isOwner = profile?.role === "owner" || profile?.role === "admin_dep"
  const hasLogo = Boolean(org?.logo_url)

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10 space-y-6">
      <Link href="/app/parametres" className="inline-flex items-center gap-1 text-xs text-muted hover:text-electric">
        <ArrowLeft className="h-3 w-3" /> Paramètres
      </Link>
      <CardTitle>Logo & branding</CardTitle>
      <p className="text-sm text-muted -mt-3">
        Votre logo apparaît en haut de chaque devis et facture.
      </p>

      <Card>
        {/* Current logo preview */}
        {hasLogo && (
          <div className="mb-6">
            <div className="text-xs uppercase tracking-wider text-muted mb-3">Logo actuel</div>
            <div className="inline-flex items-center justify-center rounded-xl border border-border bg-surface-2 p-6 max-w-xs">
              <Image
                src={org!.logo_url!}
                alt="Logo de l'entreprise"
                width={240}
                height={120}
                className="object-contain max-h-24"
                style={{ width: "auto", height: "auto", maxWidth: 240, maxHeight: 96 }}
              />
            </div>
            {isOwner && (
              <form action={removeLogo} className="mt-3">
                <Button variant="ghost" size="sm" className="text-danger gap-2" type="submit">
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer le logo
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Upload form */}
        {isOwner && (
          <form action={uploadLogo}>
            <div className="text-xs uppercase tracking-wider text-muted mb-3">
              {hasLogo ? "Remplacer le logo" : "Télécharger un logo"}
            </div>
            <label
              htmlFor="logo-upload"
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface-2 p-10 cursor-pointer hover:border-electric/50 hover:bg-surface-3 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-2" />
              <div className="text-center">
                <div className="text-sm font-medium">Cliquez pour choisir un fichier</div>
                <div className="text-xs text-muted-2 mt-1">PNG, JPG ou SVG · Max 2 Mo</div>
              </div>
            </label>
            <input
              id="logo-upload"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              required
            />
            <div className="mt-4 flex justify-end">
              <Button type="submit">
                <Upload className="h-4 w-4" /> Envoyer le logo
              </Button>
            </div>
          </form>
        )}
      </Card>

      {!isOwner && (
        <p className="text-sm text-warning">Seul le propriétaire peut modifier le logo.</p>
      )}
    </div>
  )
}
