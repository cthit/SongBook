'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useLanguage, useUser } from '@/components/Providers'
import { Chip, buttonClass } from '@/components/ui'

function LanguageToggle() {
  const { language, setLanguage, texts } = useLanguage()
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'en' ? 'sv' : 'en')}
      className={buttonClass('ghost')}
      aria-label={texts.Language}
      title={texts.Language}
    >
      {language === 'en' ? 'SV' : 'EN'}
    </button>
  )
}

function Avatar({ picture, nickname }: { picture: string | null; nickname: string }) {
  const [failed, setFailed] = useState(false)
  if (!picture || failed) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-turquoise-700 text-sm font-semibold text-white">
        {nickname.slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={picture}
      alt=""
      className="h-8 w-8 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

export function Header({
  gammaUrl,
  pendingSuggestions,
}: {
  gammaUrl: string
  pendingSuggestions: number
}) {
  const { texts } = useLanguage()
  const user = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const signOut = async () => {
    await fetch('/api/signout', { method: 'POST' })
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  const menuItem = 'block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100'

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-gray-900">
          Songbook
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {!user && (
            <a
              href={`/auth/login?returnTo=${encodeURIComponent(pathname)}`}
              className={buttonClass('secondary')}
            >
              {texts.SignInWithGamma}
            </a>
          )}
          {user && (
            <div className="relative" ref={menu}>
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100"
                aria-haspopup="menu"
                aria-expanded={open}
                data-testid="user-menu"
              >
                <span className="hidden text-sm font-medium text-gray-900 sm:inline">
                  {user.nickname}
                </span>
                <span data-testid="role-badge">
                  <Chip tone={user.isAdmin ? 'turquoise' : 'gray'}>
                    {user.isAdmin ? texts.Admin : texts.Member}
                  </Chip>
                </span>
                {user.isAdmin && pendingSuggestions > 0 && (
                  <span
                    className="rounded-full bg-red-600 px-2 text-xs font-semibold text-white"
                    title={texts.PendingSuggestions}
                  >
                    {pendingSuggestions}
                  </span>
                )}
                <Avatar picture={user.picture} nickname={user.nickname} />
              </button>
              {open && (
                <div
                  role="menu"
                  onClick={() => setOpen(false)}
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                >
                  <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
                    {user.name}
                  </p>
                  {user.isAdmin && (
                    <>
                      <Link role="menuitem" href="/songs/create" className={menuItem}>
                        {texts.AddSong}
                      </Link>
                      <Link role="menuitem" href="/tags" className={menuItem}>
                        {texts.ManageTags}
                      </Link>
                    </>
                  )}
                  {!user.isAdmin && (
                    <Link role="menuitem" href="/suggestions/new" className={menuItem}>
                      {texts.SuggestSong}
                    </Link>
                  )}
                  <Link role="menuitem" href="/suggestions" className={menuItem}>
                    {texts.Suggestions}
                    {user.isAdmin && pendingSuggestions > 0 && ` (${pendingSuggestions})`}
                  </Link>
                  <a role="menuitem" href="/api/songs/export" className={menuItem}>
                    {texts.Export}
                  </a>
                  <a
                    role="menuitem"
                    href={gammaUrl}
                    className={menuItem}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {texts.ViewAccount}
                  </a>
                  <button role="menuitem" type="button" onClick={signOut} className={menuItem}>
                    {texts.SignOut}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
