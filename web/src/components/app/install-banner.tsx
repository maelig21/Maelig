"use client"
import { useState, useEffect } from "react"
import { X, Download } from "lucide-react"

export function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Détecter iOS
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const isStandalone = (window.navigator as any).standalone === true
    setIsIos(ios)

    // Si déjà installée, ne pas afficher
    if (isStandalone || window.matchMedia("(display-mode: standalone)").matches) return

    // Si déjà refusé, ne pas afficher
    if (localStorage.getItem("dep_install_dismissed")) return

    if (ios) {
      // Sur iOS, afficher après 3 secondes
      setTimeout(() => setShow(true), 3000)
    } else {
      // Sur Android/Chrome, écouter l'événement beforeinstallprompt
      window.addEventListener("beforeinstallprompt", (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setTimeout(() => setShow(true), 3000)
      })
    }
  }, [])

  function dismiss() {
    setShow(false)
    localStorage.setItem("dep_install_dismissed", "1")
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") setShow(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="text-3xl">⚡</div>
        <div className="flex-1">
          <div className="font-bold text-gray-900 text-sm">Installer DEP sur votre téléphone</div>
          {isIos ? (
            <div className="text-xs text-gray-500 mt-1">
              Appuyez sur <span className="font-semibold">□↑</span> puis <span className="font-semibold">"Sur l'écran d'accueil"</span>
            </div>
          ) : (
            <div className="text-xs text-gray-500 mt-1">
              Accédez rapidement à DEP comme une vraie application
            </div>
          )}
          {!isIos && (
            <button
              onClick={install}
              className="mt-2 flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
            >
              <Download className="h-3.5 w-3.5" />
              Installer l'application
            </button>
          )}
        </div>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
