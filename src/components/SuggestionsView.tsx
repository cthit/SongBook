'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { useLanguage, useToast } from '@/components/Providers'
import {
  Button,
  Chip,
  ConfirmDialog,
  buttonClass,
  callApi,
  cardClass,
  inputClass,
} from '@/components/ui'
import { diffLines } from '@/lib/diff'
import { errorMessage, tagLabel, type Language, type Texts } from '@/lib/i18n'
import type { Song, Suggestion, Tag } from '@/lib/types'

function tagNames(ids: string[], tagsById: Map<string, Tag>, language: Language) {
  return ids
    .map((id) => tagsById.get(id))
    .filter((tag): tag is Tag => tag !== undefined)
    .map((tag) => tagLabel(tag, language))
    .join(', ')
}

function FieldChange({
  label,
  before,
  after,
  texts,
}: {
  label: string
  before: string
  after: string
  texts: Texts
}) {
  if (before === after) return null
  return (
    <div className="text-sm">
      <span className="font-medium">{label}: </span>
      <del className="bg-red-50 text-red-700">{before || texts.Unknown}</del>
      {' → '}
      <ins className="bg-green-50 text-green-800 no-underline">{after || texts.Unknown}</ins>
    </div>
  )
}

/** "Diff-ish" preview of what approving the suggestion would change */
function SuggestionPreview({
  suggestion,
  song,
  tagsById,
}: {
  suggestion: Suggestion
  song: Song | undefined
  tagsById: Map<string, Tag>
}) {
  const { texts, language } = useLanguage()

  if (suggestion.kind === 'new' || !song) {
    return (
      <div className="space-y-1 text-sm">
        <p>
          <span className="font-medium">{texts.Author}:</span> {suggestion.author || texts.Unknown}
        </p>
        <p>
          <span className="font-medium">{texts.Melody}:</span> {suggestion.melody || texts.Unknown}
        </p>
        <p>
          <span className="font-medium">{texts.Tags}:</span>{' '}
          {tagNames(suggestion.tags, tagsById, language)}
        </p>
        <Markdown className="mt-2 rounded border border-gray-100 bg-gray-50 p-3">
          {suggestion.text}
        </Markdown>
      </div>
    )
  }

  const lines = diffLines(song.text, suggestion.text)
  const textChanged = lines.some((line) => line.type !== 'same')
  const tagsBefore = tagNames(song.tags, tagsById, language)
  const tagsAfter = tagNames(suggestion.tags, tagsById, language)
  const unchanged =
    !textChanged &&
    song.title === suggestion.title &&
    song.author === suggestion.author &&
    song.melody === suggestion.melody &&
    tagsBefore === tagsAfter

  return (
    <div className="space-y-1">
      {unchanged && <p className="text-sm text-gray-500">{texts.NoChanges}</p>}
      <FieldChange label={texts.Title} before={song.title} after={suggestion.title} texts={texts} />
      <FieldChange
        label={texts.Author}
        before={song.author}
        after={suggestion.author}
        texts={texts}
      />
      <FieldChange
        label={texts.Melody}
        before={song.melody}
        after={suggestion.melody}
        texts={texts}
      />
      <FieldChange label={texts.Tags} before={tagsBefore} after={tagsAfter} texts={texts} />
      {textChanged && (
        <pre className="mt-2 max-h-80 overflow-auto rounded border border-gray-100 bg-gray-50 p-3 text-xs leading-5">
          {lines.map((line, index) => (
            <div
              key={index}
              className={
                line.type === 'added'
                  ? 'bg-green-100 text-green-900'
                  : line.type === 'removed'
                    ? 'bg-red-100 text-red-900'
                    : ''
              }
            >
              {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
              {line.text}
            </div>
          ))}
        </pre>
      )}
    </div>
  )
}

function SuggestionTitle({ suggestion, song }: { suggestion: Suggestion; song: Song | undefined }) {
  const { texts } = useLanguage()
  return (
    <h3 className="font-semibold">
      {suggestion.kind === 'new' ? (
        <>
          {texts.NewSongSuggestion}: {suggestion.title}
        </>
      ) : (
        <>
          {texts.EditSuggestion}{' '}
          {song ? (
            <Link className="underline" href={`/${song.song_id}`}>
              {song.number}. {song.title}
            </Link>
          ) : (
            suggestion.title
          )}
        </>
      )}
    </h3>
  )
}

const statusTone = { pending: 'amber', approved: 'turquoise', rejected: 'gray' } as const

export function SuggestionsView({
  mine,
  pending,
  songs,
  tags,
  isAdmin,
}: {
  mine: Suggestion[]
  pending: Suggestion[]
  songs: Song[]
  tags: Tag[]
  isAdmin: boolean
}) {
  const { texts } = useLanguage()
  const showToast = useToast()
  const router = useRouter()
  const [comments, setComments] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState<Suggestion | null>(null)

  const songsById = new Map(songs.map((song) => [song.song_id, song]))
  const tagsById = new Map(tags.map((tag) => [tag.tag_id, tag]))

  const review = async (suggestion: Suggestion, action: 'approve' | 'reject') => {
    setBusy(suggestion.id)
    const result = await callApi<{ song_id?: string }>(
      `/api/suggestions/${suggestion.id}/${action}`,
      {
        method: 'POST',
        body: { comment: comments[suggestion.id] ?? '' },
      },
    )
    setBusy(null)
    if (!result.ok) {
      showToast(errorMessage(texts, result.code), 'error')
      return
    }
    showToast(action === 'approve' ? texts.SuggestionApproved : texts.SuggestionRejected)
    router.refresh()
  }

  const withdraw = async () => {
    if (!withdrawing) return
    setBusy(withdrawing.id)
    const result = await callApi(`/api/suggestions/${withdrawing.id}`, { method: 'DELETE' })
    setBusy(null)
    setWithdrawing(null)
    if (!result.ok) {
      showToast(errorMessage(texts, result.code), 'error')
      return
    }
    showToast(texts.SuggestionDeleted)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{texts.Suggestions}</h1>
        <Link href="/suggestions/new" className={buttonClass('primary')}>
          {texts.SuggestSong}
        </Link>
      </div>
      <p className="text-sm text-gray-600">{texts.SuggestionsHelp}</p>

      {isAdmin && (
        <section className="space-y-3" data-testid="pending-suggestions">
          <h2 className="text-lg font-semibold">{texts.PendingSuggestions}</h2>
          {pending.length === 0 && <p className="text-sm text-gray-500">{texts.NoSuggestions}</p>}
          {pending.map((suggestion) => (
            <article
              key={suggestion.id}
              className={`${cardClass} space-y-3 p-4`}
              data-testid="pending-suggestion"
            >
              <SuggestionTitle
                suggestion={suggestion}
                song={songsById.get(suggestion.song_id ?? '')}
              />
              <p className="text-xs text-gray-500">
                {texts.SuggestedBy} {suggestion.suggested_by_name} ({suggestion.suggested_by_cid}) ·{' '}
                {new Date(suggestion.created_at).toLocaleString()}
              </p>
              <SuggestionPreview
                suggestion={suggestion}
                song={songsById.get(suggestion.song_id ?? '')}
                tagsById={tagsById}
              />
              <input
                className={inputClass}
                placeholder={texts.ReviewComment}
                aria-label={texts.ReviewComment}
                value={comments[suggestion.id] ?? ''}
                onChange={(event) =>
                  setComments({ ...comments, [suggestion.id]: event.target.value })
                }
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="danger"
                  onClick={() => review(suggestion, 'reject')}
                  disabled={busy === suggestion.id}
                >
                  {texts.Reject}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => review(suggestion, 'approve')}
                  disabled={busy === suggestion.id}
                >
                  {texts.Approve}
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="space-y-3" data-testid="my-suggestions">
        <h2 className="text-lg font-semibold">{texts.MySuggestions}</h2>
        {mine.length === 0 && <p className="text-sm text-gray-500">{texts.NoSuggestions}</p>}
        {mine.map((suggestion) => (
          <article
            key={suggestion.id}
            className={`${cardClass} space-y-2 p-4`}
            data-testid="my-suggestion"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SuggestionTitle
                suggestion={suggestion}
                song={songsById.get(suggestion.song_id ?? '')}
              />
              <Chip tone={statusTone[suggestion.status]}>
                {texts[`Status_${suggestion.status}`]}
              </Chip>
            </div>
            <p className="text-xs text-gray-500">
              {new Date(suggestion.created_at).toLocaleString()}
            </p>
            {suggestion.review_comment && (
              <p className="text-sm italic text-gray-700">“{suggestion.review_comment}”</p>
            )}
            {suggestion.status === 'pending' && (
              <div className="flex justify-end gap-2">
                <Link
                  href={`/suggestions/${suggestion.id}/edit`}
                  className={buttonClass('secondary')}
                >
                  {texts.Edit}
                </Link>
                <Button
                  variant="danger"
                  onClick={() => setWithdrawing(suggestion)}
                  disabled={busy === suggestion.id}
                >
                  {texts.Withdraw}
                </Button>
              </div>
            )}
          </article>
        ))}
      </section>

      {withdrawing && (
        <ConfirmDialog
          message={texts.WithdrawConfirm}
          confirmLabel={texts.Withdraw}
          cancelLabel={texts.Cancel}
          onConfirm={withdraw}
          onCancel={() => setWithdrawing(null)}
          busy={busy !== null}
        />
      )}
    </div>
  )
}
