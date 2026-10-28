'use client'

import { useEffect } from 'react'
import { ErrorCard } from '@/components/ErrorCard'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => console.error(error), [error])
  return <ErrorCard status={500} onRetry={reset} />
}
