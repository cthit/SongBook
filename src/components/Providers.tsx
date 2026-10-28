'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  LANGUAGE_COOKIE,
  LANGUAGE_STORAGE_KEY,
  getTexts,
  isLanguage,
  type Language,
  type Texts,
} from '@/lib/i18n'
import type { PublicUser } from '@/lib/types'

interface LanguageContextValue {
  language: Language
  texts: Texts
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside <Providers>')
  return value
}

export const useTexts = () => useLanguage().texts

const UserContext = createContext<PublicUser | null>(null)
export const useUser = () => useContext(UserContext)

type ToastKind = 'success' | 'error'
interface Toast {
  id: number
  message: string
  kind: ToastKind
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {})
export const useToast = () => useContext(ToastContext)

let nextToastId = 1

export function Providers({
  children,
  initialLanguage,
  languageFromCookie,
  user,
}: {
  children: React.ReactNode
  initialLanguage: Language
  /** Whether the user explicitly picked a language before */
  languageFromCookie: boolean
  user: PublicUser | null
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const [toasts, setToasts] = useState<Toast[]>([])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
  }, [])

  // Signed out visitors without the cookie may still have a language saved by the old frontend
  useEffect(() => {
    if (languageFromCookie || user) return
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (isLanguage(stored) && stored !== initialLanguage) {
      // localStorage only exists in the browser, so this has to happen after hydration
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguageState(stored)
    }
  }, [languageFromCookie, user, initialLanguage])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextToastId++
    setToasts((current) => [...current, { id, message, kind }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000)
  }, [])

  const languageValue = useMemo(
    () => ({ language, texts: getTexts(language), setLanguage }),
    [language, setLanguage],
  )

  return (
    <LanguageContext.Provider value={languageValue}>
      <UserContext.Provider value={user}>
        <ToastContext.Provider value={showToast}>
          {children}
          <div
            className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
            aria-live="polite"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                role={toast.kind === 'error' ? 'alert' : 'status'}
                className={`pointer-events-auto rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg ${
                  toast.kind === 'error' ? 'bg-red-600' : 'bg-gray-900'
                }`}
              >
                {toast.message}
              </div>
            ))}
          </div>
        </ToastContext.Provider>
      </UserContext.Provider>
    </LanguageContext.Provider>
  )
}
