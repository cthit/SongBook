'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useLanguage } from '@/components/Providers'
import { SongCard } from '@/components/SongCard'
import { SongDialog } from '@/components/SongDialog'
import { TagSelect } from '@/components/TagSelect'
import { Button, cardClass, inputClass, labelClass } from '@/components/ui'
import { filterSongs } from '@/lib/search'
import type { Song, Tag } from '@/lib/types'

const SONG_PATH = /^\/([a-z]{4})$/

/**
 * The list page. `/{song_id}` opens the song in a dialog on top of the list; opening and closing
 * only pushes history entries so the filters and scroll position survive.
 */
export function SongBrowser({ songs, tags }: { songs: Song[]; tags: Tag[] }) {
  const { texts } = useLanguage()
  const pathname = usePathname()
  const [filterText, setFilterText] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const deferredText = useDeferredValue(filterText)

  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.tag_id, tag])), [tags])
  const songsById = useMemo(() => new Map(songs.map((song) => [song.song_id, song])), [songs])
  const filtered = useMemo(
    () => filterSongs(songs, deferredText, filterTags),
    [songs, deferredText, filterTags],
  )

  const openSongId = SONG_PATH.exec(pathname)?.[1]
  const openSong = openSongId ? songsById.get(openSongId) : undefined

  const open = useCallback((songId: string) => window.history.pushState(null, '', `/${songId}`), [])
  const close = useCallback(() => window.history.pushState(null, '', '/'), [])

  const resetFilters = () => {
    setFilterText('')
    setFilterTags([])
  }

  return (
    <div>
      <section className={`${cardClass} mb-6 p-4`}>
        <h1 className="mb-3 text-2xl font-semibold">{texts.Browse}</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
          <div>
            <label htmlFor="song-search" className={labelClass}>
              {texts.FilterSearch}
            </label>
            <input
              id="song-search"
              type="search"
              className={inputClass}
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              autoComplete="off"
            />
          </div>
          <TagSelect
            label={texts.FilterTag}
            tags={tags}
            value={filterTags}
            onChange={setFilterTags}
          />
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className={`${cardClass} mx-auto mt-8 max-w-sm p-4`} data-testid="no-songs">
          <p>{texts.NoMatchingSongs}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={resetFilters}>{texts.ResetFilters}</Button>
          </div>
        </div>
      ) : (
        <div className="gap-4 md:columns-2 xl:columns-3">
          {filtered.map((song) => (
            <SongCard key={song.song_id} song={song} tagsById={tagsById} onOpen={open} />
          ))}
        </div>
      )}

      {openSong && <SongDialog song={openSong} tagsById={tagsById} onClose={close} />}
    </div>
  )
}
