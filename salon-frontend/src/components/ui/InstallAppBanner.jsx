import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { Card, Button } from './index'

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  if (!deferredPrompt || isDismissed || isInstalled) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 z-50 animate-slide-up">
      <Card className="p-4 shadow-glow-sm border-brand-500/20 bg-gradient-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Download className="w-4 h-4 text-brand-400" /> Install QueueCut App
            </h3>
            <p className="text-xs text-dark-100 leading-relaxed">
              Add QueueCut to your home screen for a faster, full-screen native experience.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={handleInstallClick} className="flex-1">
                Install
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setIsDismissed(true)}>
                Later
              </Button>
            </div>
          </div>
          <button 
            onClick={() => setIsDismissed(true)}
            className="text-dark-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </Card>
    </div>
  )
}
