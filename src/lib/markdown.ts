/** First ~100 characters of the lyrics, completed to the end of that line, for song cards */
export function startOfText(text: string): string {
  const start = text.slice(0, 100)
  const [restOfLine] = text.slice(100).split('\n', 1)
  return `${start}${restOfLine ?? ''}\n\n...`
}

/** Links in lyrics may only point to http(s) and mailto, everything else is dropped */
export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://songbook.invalid')
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return url
  } catch {
    // fall through
  }
  return ''
}
