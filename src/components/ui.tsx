'use client'

import { useEffect, useId, useRef } from 'react'

export const cardClass = 'rounded-lg border border-gray-200 bg-white shadow-sm'
export const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-turquoise-700 focus:outline-none focus:ring-1 focus:ring-turquoise-700'
export const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-turquoise-800 text-white hover:bg-turquoise-900',
  secondary: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-gray-700 hover:bg-gray-100',
}

export function buttonClass(variant: ButtonVariant = 'secondary') {
  return `inline-flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]}`
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" className={`${buttonClass(variant)} ${className}`} {...props} />
}

export function Chip({
  children,
  tone = 'turquoise',
}: {
  children: React.ReactNode
  tone?: 'turquoise' | 'gray' | 'amber'
}) {
  const tones = {
    turquoise: 'bg-turquoise-200 text-turquoise-900',
    gray: 'bg-gray-200 text-gray-800',
    amber: 'bg-amber-200 text-amber-900',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string | null
  children: (id: string) => React.ReactNode
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children(id)}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

/** Modal dialog. Closes on Escape and on clicking the backdrop. */
export function Dialog({
  title,
  onClose,
  children,
  actions,
  wide = false,
}: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  actions?: React.ReactNode
  wide?: boolean
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`my-8 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-lg bg-white shadow-xl focus:outline-none`}
      >
        <div className="px-6 pt-5">
          <h2 id={titleId} className="text-xl font-semibold text-gray-900">
            {title}
          </h2>
        </div>
        <div className="px-6 py-4">{children}</div>
        {actions && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <Dialog
      title={message}
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {null}
    </Dialog>
  )
}

/** Calls one of our API routes and unwraps the `{ data, error }` envelope */
export async function callApi<T = Record<string, unknown>>(
  url: string,
  init: { method: string; body?: unknown },
): Promise<{ ok: true; data: T } | { ok: false; code: string; status: number }> {
  try {
    const response = await fetch(url, {
      method: init.method,
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    const json = (await response.json().catch(() => null)) as {
      data?: T
      error?: { isError: boolean; message: string }
    } | null
    if (!response.ok || !json || json.error?.isError) {
      return { ok: false, code: json?.error?.message ?? 'UNKNOWN', status: response.status }
    }
    return { ok: true, data: json.data as T }
  } catch {
    return { ok: false, code: 'NETWORK', status: 0 }
  }
}
