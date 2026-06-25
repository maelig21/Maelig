"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { InstallBanner } from "@/components/app/install-banner"
import {
  FilePlus2, AlertTriangle, Users, CalendarDays,
  FileCheck, Receipt, Settings, LogOut, PackageSearch
} from "lucide-react"

type Tile = {
  href: string
  icon: React.ReactNode
  label: string
  color: string
  permission?: string
}

export function MobileHome({
  userName,
  isOwner,
  permissions,
}: {
  userName: string
  isOwner: boolean
  permissions: Record<string, boolean>
}) {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function logout() {
    await supabase.auth.signOut()
    router.push("/connexion")
  }

  const allTiles: (Tile & { show: boolean })[] = [
    {
      href: "/app/devis/nouveau",
      icon: <FilePlus2 className="h-8 w-8" />,
      label: "Nouveau devis",
      color: "bg-blue-500",
      show: isOwner || permissions.devis_create === true,
    },
    {
      href: "/app/devis/signes",
      icon: <FileCheck className="h-8 w-8" />,
      label: "Chantiers en cours",
      color: "bg-purple-500",
      show: isOwner,
    },
    {
      href: "/app/devis/factures-en-attente",
      icon: <Receipt className="h-8 w-8" />,
      label: "Factures",
      color: "bg-red-500",
      show: isOwner,
    },
    {
      href: "/app/planning",
      icon: <CalendarDays className="h-8 w-8" />,
      label: "Planning",
      color: "bg-green-500",
      show: true,
    },
    {
      href: "/app/incidents/nouveau",
      icon: <AlertTriangle className="h-8 w-8" />,
      label: "Signaler un problème",
      color: "bg-orange-500",
      show: true,
    },
    {
      href: "/app/incidents",
      icon: <AlertTriangle className="h-8 w-8" />,
      label: "Problèmes chantier",
      color: "bg-amber-500",
      show: isOwner || permissions.incidents_read === true,
    },
    {
      href: "/app/clients",
      icon: <Users className="h-8 w-8" />,
      label: "Clients",
      color: "bg-teal-500",
      show: isOwner,
    },
    {
      href: "/app/catalogue",
      icon: <PackageSearch className="h-8 w-8" />,
      label: "Catalogue",
      color: "bg-indigo-500",
      show: isOwner || permissions.catalogue_write === true,
    },
    {
      href: "/app/parametres",
      icon: <Settings className="h-8 w-8" />,
      label: "Paramètres",
      color: "bg-gray-500",
      show: isOwner,
    },
  ]

  const tiles = allTiles.filter((t) => t.show)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-gray-900">⚡ DEP</div>
          <div className="text-xs text-gray-500">Bonjour, {userName.split(" ")[0] || "vous"} 👋</div>
        </div>
        <button onClick={logout} className="p-2 rounded-xl text-gray-400 hover:text-gray-600">
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {/* Grille de tuiles */}
      <div className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-4">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className={`${tile.color} rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-white shadow-md active:scale-95 transition-transform min-h-[120px]`}
            >
              {tile.icon}
              <span className="text-sm font-semibold text-center leading-tight">{tile.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Installer l'app */}
      <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="text-2xl">📲</div>
        <div className="flex-1">
          <div className="text-sm font-bold text-blue-900">Installer DEP sur votre téléphone</div>
          <div className="text-xs text-blue-600 mt-0.5">
            iPhone : appuyez sur <strong>□↑</strong> → "Sur l'écran d'accueil"
          </div>
          <div className="text-xs text-blue-600">
            Android : menu <strong>⋮</strong> → "Ajouter à l'écran d'accueil"
          </div>
        </div>
      </div>
      <InstallBanner />
    </div>
  )
}
