import type { Song, Tag } from '@/lib/types'

// Same lines as the seed parser reads (`MELODY` / `AUTHOR` in seed.ts), as whole lines
const MELODY_LINE = /^(\*?[mM][eE][lL]:)([^*]+)(.*)$/
const AUTHOR_LINE = /^(\*?[tT][eE][xX][tT]: )([^*]+)(.*)$/
const UNTAGGED = 'Övrigt'

const underline = (title: string, char: '=' | '-') => char.repeat(Math.max(3, title.length))
const oneLine = (value: string) => value.replace(/\s*\n\s*/g, ' ').trim()

/** `lines` without `lines[index]`, and without an empty line next to it if it stood alone */
function removeLine(lines: string[], index: number): string[] {
  const blankAfter = index + 1 < lines.length && lines[index + 1].trim() === ''
  const blankBefore = index === 0 || lines[index - 1].trim() === ''
  return lines.toSpliced(index, blankAfter && blankBefore ? 2 : 1)
}

/**
 * Seeded songs contain their `Mel:` / `Text:` line in the lyrics, which is what the seed parser
 * reads. The song's fields are authoritative: the first such line (the one the parser reads) gets
 * the current value, keeping its formatting, and when the field is empty every such line is
 * removed so the parser doesn't pick up another one. Returns null when there is no such line.
 */
function replaceLine(
  lines: string[],
  pattern: RegExp,
  value: string,
  format: (label: string, value: string, rest: string) => string,
): string[] | null {
  let index = lines.findIndex((line) => pattern.test(line))
  if (index === -1) return null
  if (value) {
    const [, label, current, rest] = pattern.exec(lines[index])!
    // Unchanged lines are kept exactly as they are, e.g. `Mel:Snickerboa`
    return current.trim() === value ? lines : lines.with(index, format(label, value, rest))
  }
  let result = lines
  for (; index !== -1; index = result.findIndex((line) => pattern.test(line))) {
    result = removeLine(result, index)
  }
  return result
}

function songToMarkdown(song: Song): string {
  const melody = oneLine(song.melody)
  const author = song.author === 'Unknown' ? '' : oneLine(song.author)
  let lines = song.text.trim().split('\n')
  const withMelody = replaceLine(
    lines,
    MELODY_LINE,
    melody,
    (label, v, rest) => `${label} ${v}${rest}`,
  )
  const withAuthor = replaceLine(
    withMelody ?? lines,
    AUTHOR_LINE,
    author,
    (label, v, rest) => `${label}${v}${rest}`,
  )
  lines = withAuthor ?? withMelody ?? lines

  const result = [song.title, underline(song.title, '-'), '']
  if (melody && !withMelody) result.push(`*Mel: ${melody}*`, '')
  result.push(lines.join('\n').trim(), '')
  if (author && !withAuthor) result.push(`*Text: ${author}*`, '')
  return result.join('\n')
}

/**
 * The whole songbook in the format `parseSongbookMarkdown` reads: one `===` heading per tag and a
 * `---` heading per song. Songs with several tags are listed under their first tag (by song order),
 * songs without tags end up under "Övrigt".
 */
export function songbookToMarkdown(songs: Song[], tags: Tag[]): string {
  const tagById = new Map(tags.map((tag) => [tag.tag_id, tag]))
  const groups = new Map<string, Song[]>()

  for (const song of [...songs].sort((a, b) => a.number - b.number)) {
    const tag = song.tags.map((id) => tagById.get(id)).find((t) => t !== undefined)
    const name = tag?.name ?? UNTAGGED
    const group = groups.get(name) ?? []
    group.push(song)
    groups.set(name, group)
  }

  // Map keeps insertion order, i.e. categories appear in the order of their first song
  const sections = [...groups].map(([name, groupSongs]) =>
    [name, underline(name, '='), '', ...groupSongs.map(songToMarkdown)].join('\n'),
  )
  return `${sections.join('\n')}\n`
}
