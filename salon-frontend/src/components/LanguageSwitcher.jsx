import { useState, useEffect, useRef } from 'react'
import { Globe, ChevronDown } from 'lucide-react'

export default function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState('en')
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'ta', label: 'Tamil' },
  ]

  // Detect the current language from the googtrans cookie on mount
  useEffect(() => {
    const getCookie = (name) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
      return match ? match[2] : null
    }
    const googtrans = getCookie('googtrans')
    if (googtrans) {
      const lang = googtrans.split('/').pop()
      if (['en', 'hi', 'ta'].includes(lang)) {
        setCurrentLang(lang)
      }
    }

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const changeLanguage = (langCode) => {
    setCurrentLang(langCode)
    setIsOpen(false)

    const setCookie = (name, value, days) => {
      const d = new Date()
      d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000))
      document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`
    }

    if (langCode === 'en') {
      // Clear cookie to revert to English
      setCookie('googtrans', '', -1)
      setCookie('googtrans', '', -1, '.vercel.app')
      setCookie('googtrans', '', -1, '.queuecut.app') // Assuming production domain
    } else {
      setCookie('googtrans', `/en/${langCode}`, 30)
    }

    // Reload the page to apply the translation immediately
    window.location.reload()
  }

  const currentLabel = languages.find(l => l.code === currentLang)?.label || 'English'

  return (
    <div className="relative inline-block text-left z-50" ref={menuRef}>
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-dark-100 hover:text-white bg-surface-secondary border border-white/[0.08] hover:bg-white/[0.05] rounded-lg transition-colors h-10"
          id="language-menu-button"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <Globe className="w-4 h-4 text-brand-400" />
          <span className="hidden sm:inline">{currentLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-32 origin-top-right rounded-xl bg-surface-secondary border border-white/[0.08] shadow-xl shadow-black/40 outline-none animate-slide-up overflow-hidden"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="language-menu-button"
        >
          <div className="py-1" role="none">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`flex w-full items-center px-4 py-2.5 text-sm transition-colors ${
                  currentLang === lang.code
                    ? 'bg-brand-500/10 text-brand-400 font-medium'
                    : 'text-dark-100 hover:bg-white/[0.05] hover:text-white'
                }`}
                role="menuitem"
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
