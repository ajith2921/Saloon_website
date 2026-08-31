import { useState, useEffect, useRef } from 'react'
import { Globe, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'ta', label: 'Tamil' },
  ]

  const currentLang = i18n.language || 'en'

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode)
    setIsOpen(false)
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
