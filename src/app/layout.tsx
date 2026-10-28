import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Providers } from '@/components/Providers'
import { getCurrentUser } from '@/lib/auth'
import { gammaConfig } from '@/lib/gamma'
import { LANGUAGE_COOKIE, isLanguage } from '@/lib/i18n'
import { toPublicUser } from '@/lib/session'
import { countPendingSuggestions } from '@/lib/suggestions'

export const metadata: Metadata = {
  title: 'Songbook',
  description: 'The digital songbook of the IT student division at Chalmers',
  icons: { icon: '/favicon.ico' },
}

export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()])
  const languageCookie = cookieStore.get(LANGUAGE_COOKIE)?.value
  // An explicit choice wins, then the language from the gamma profile, then English
  const language = isLanguage(languageCookie) ? languageCookie : user?.locale === 'sv' ? 'sv' : 'en'

  let pendingSuggestions = 0
  if (user?.isAdmin) {
    pendingSuggestions = await countPendingSuggestions().catch(() => 0)
  }

  return (
    <html lang={language}>
      <body className="flex min-h-screen flex-col bg-gray-100 text-gray-900 antialiased">
        <Providers
          initialLanguage={language}
          languageFromCookie={isLanguage(languageCookie)}
          user={user ? toPublicUser(user) : null}
        >
          <Header gammaUrl={gammaConfig().gammaUrl} pendingSuggestions={pendingSuggestions} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
