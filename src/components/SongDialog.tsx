'use client'

import Link from 'next/link'
import { Markdown } from '@/components/Markdown'
import { useLanguage, useUser } from '@/components/Providers'
import { SongTags } from '@/components/SongCard'
import { Button, Dialog, buttonClass } from '@/components/ui'
import type { Song, Tag } from '@/lib/types'

export function SongDialog({
  song,
  tagsById,
  onClose,
}: {
  song: Song
  tagsById: Map<string, Tag>
  onClose: () => void
}) {
  const { texts } = useLanguage()
  const user = useUser()

  return (
    <Dialog
      wide
      title={`${song.number}. ${song.title}`}
      onClose={onClose}
      actions={
        <>
          {user?.isAdmin && (
            <Link href={`/songs/edit/${song.song_id}`} className={buttonClass('primary')}>
              {texts.EditSong}
            </Link>
          )}
          {user && !user.isAdmin && (
            <Link
              href={`/suggestions/new?song=${song.song_id}`}
              className={buttonClass('secondary')}
            >
              {texts.SuggestEdit}
            </Link>
          )}
          <Button onClick={onClose}>{texts.Close}</Button>
        </>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {texts.Author}: {song.author || texts.Unknown}
          </p>
          <p>
            {texts.Melody}: {song.melody || texts.Unknown}
          </p>
        </div>
        <SongTags song={song} tagsById={tagsById} />
      </div>
      <hr className="my-4 border-gray-200" />
      <Markdown className="text-base">{song.text}</Markdown>
    </Dialog>
  )
}
