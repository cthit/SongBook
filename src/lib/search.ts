import fuzzysort from 'fuzzysort'
import type { Song } from '@/lib/types'

const KEYS = ['number', 'title', 'melody', 'author', 'text'] as const
/** Minimum fuzzysort score (0..1), tuned so a single word doesn't match half the songbook */
export const SEARCH_THRESHOLD = 0.35

/**
 * Same behaviour as the old filter worker: tags are OR-ed and applied first, then a fuzzy search
 * over number, title, melody, author and lyrics. With a search text the results keep fuzzysort's
 * relevance ranking (like the old app); with only tags, or nothing, songs are sorted by number.
 */
export function filterSongs(songs: Song[], filterText: string, filterTags: string[]): Song[] {
  let result = [...songs].sort((a, b) => a.number - b.number)
  if (filterTags.length > 0) {
    result = result.filter((song) => song.tags.some((tag) => filterTags.includes(tag)))
  }
  const search = filterText.trim()
  if (search === '') return result

  const targets = result.map((song) => ({
    song,
    number: String(song.number),
    title: song.title,
    melody: song.melody,
    author: song.author,
    text: song.text,
  }))
  return fuzzysort
    .go(search, targets, { keys: KEYS, limit: 0, threshold: SEARCH_THRESHOLD })
    .map((match) => match.obj.song)
}
