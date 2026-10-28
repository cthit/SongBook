'use client'

import Link from 'next/link'
import { useTexts } from '@/components/Providers'
import { buttonClass, cardClass } from '@/components/ui'
import type { TranslationKey } from '@/lib/i18n'

const VARIANTS = {
  401: { title: 'SignInRequired', body: 'SignInToContinue', image: '/images/403.gif' },
  403: { title: 'InsufficientAccess', body: 'YouDontHaveAccess', image: '/images/403.gif' },
  404: { title: 'PageNotFound', body: 'ContactDigit', image: '/images/404.jpg' },
  500: { title: 'SomethingWentWrong', body: 'Contact', image: '/images/500.jpg' },
} satisfies Record<number, { title: TranslationKey; body: TranslationKey; image: string }>

export function ErrorCard({
  status,
  onRetry,
}: {
  status: keyof typeof VARIANTS
  onRetry?: () => void
}) {
  const texts = useTexts()
  const variant = VARIANTS[status]
  return (
    <div
      className={`${cardClass} mx-auto mt-8 w-full max-w-sm overflow-hidden`}
      data-testid={`error-${status}`}
    >
      <h1 className="px-4 pt-4 text-lg font-semibold">{texts[variant.title]}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={variant.image} alt="" className="mt-3 w-full" />
      <p className="px-4 py-3 text-sm text-gray-700">{texts[variant.body]}</p>
      <div className="flex justify-end gap-2 px-4 pb-4">
        {status === 401 && (
          <a href="/auth/login" className={buttonClass('primary')}>
            {texts.SignInWithGamma}
          </a>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry} className={buttonClass('secondary')}>
            {texts.RefreshWebsite}
          </button>
        )}
        <Link href="/" className={buttonClass('secondary')}>
          {texts.Back}
        </Link>
      </div>
    </div>
  )
}
