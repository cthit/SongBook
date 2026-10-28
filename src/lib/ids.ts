import { randomInt } from 'crypto'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
export const SHORT_ID_LENGTH = 4

/** Four random lowercase ascii letters, same format as the ids the Python backend generated */
export function generateShortId(): string {
  let id = ''
  for (let i = 0; i < SHORT_ID_LENGTH; i++) {
    id += ALPHABET[randomInt(ALPHABET.length)]
  }
  return id
}

export function isShortId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{4}$/.test(value)
}

/** Error code for an invalid short id, matching the old backend's codes */
export function shortIdError(value: string): 'ID_NOT_LENGTH_FOUR' | 'ID_NOT_LOWERCASE' | null {
  if (value.length !== SHORT_ID_LENGTH) return 'ID_NOT_LENGTH_FOUR'
  if (!isShortId(value)) return 'ID_NOT_LOWERCASE'
  return null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}
