import type { Song, Tag } from '@/lib/types'

const HAS_MELODY_LINE = /(^|\n)\*?[mM][eE][lL]:/
const HAS_AUTHOR_LINE = /(^|\n)\*?[tT][eE][xX][tT]: /
const UNTAGGED = 'Övrigt'

const underline = (title: string, char: '=' | '-') => char.repeat(Math.max(3, title.length))

function songToMarkdown(song: Song): string {
  const lines = [song.title, underline(song.title, '-'), '']
  // Seeded songs already contain their Mel:/Text: lines, only add them when missing
  if (song.melody && !HAS_MELODY_LINE.test(song.text)) {
    lines.push(`*Mel: ${song.melody}*`, '')
  }
  lines.push(song.text.trim(), '')
  if (song.author && song.author !== 'Unknown' && !HAS_AUTHOR_LINE.test(song.text)) {
    lines.push(`*Text: ${song.author}*`, '')
  }
  return lines.join('\n')
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
