'use client'

import { memo } from 'react'
import { Markdown } from '@/components/Markdown'
import { useLanguage } from '@/components/Providers'
import { Chip, cardClass } from '@/components/ui'
import { tagLabel } from '@/lib/i18n'
import { startOfText } from '@/lib/markdown'
import type { Song, Tag } from '@/lib/types'

export function SongTags({ song, tagsById }: { song: Song; tagsById: Map<string, Tag> }) {
  const { language, texts } = useLanguage()
  return (
    <div className="flex flex-wrap gap-1">
      {song.hidden && <Chip tone="amber">{texts.Hidden}</Chip>}
      {song.tags.map((tagId) => {
        const tag = tagsById.get(tagId)
        return tag ? <Chip key={tagId}>{tagLabel(tag, language)}</Chip> : null
      })}
    </div>
  )
}

function SongCardComponent({
  song,
  tagsById,
  onOpen,
}: {
  song: Song
  tagsById: Map<string, Tag>
  onOpen: (songId: string) => void
}) {
  const { texts } = useLanguage()
  return (
    <a
      href={`/${song.song_id}`}
      data-testid="song-card"
      onClick={(event) => {
        // Keep middle click / ctrl click opening a new tab
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return
        event.preventDefault()
        onOpen(song.song_id)
      }}
      className={`${cardClass} mb-4 block break-inside-avoid p-4 transition hover:border-turquoise-600 hover:shadow-md`}
    >
      <h2 className="text-lg font-semibold text-gray-900">
        {song.number}. {song.title}
      </h2>
      <p className="mt-1 text-sm font-semibold text-gray-800">
        {texts.Author}: {song.author || texts.Unknown}
      </p>
      <p className="text-sm text-gray-700">Mel: {song.melody || texts.Unknown}</p>
      {/* The card is a link, so links in the lyrics are shown as text */}
      <Markdown className="mt-2 text-gray-700" links={false}>
        {startOfText(song.text)}
      </Markdown>
      <div className="mt-3">
        <SongTags song={song} tagsById={tagsById} />
      </div>
    </a>
  )
}

export const SongCard = memo(SongCardComponent)
