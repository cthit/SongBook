'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { useLanguage, useToast } from '@/components/Providers'
import { TagSelect } from '@/components/TagSelect'
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  buttonClass,
  callApi,
  cardClass,
  inputClass,
} from '@/components/ui'
import { errorMessage } from '@/lib/i18n'
import type { SongInput, Tag } from '@/lib/types'

export type SongFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; songId: string; number: number; title: string }
  | { kind: 'suggest-new' }
  | { kind: 'suggest-edit'; songId: string; number: number; title: string }
  | { kind: 'edit-suggestion'; suggestionId: string; songId: string | null }

type TagOption = Pick<Tag, 'tag_id' | 'name' | 'pretty_name_sv' | 'pretty_name_en'>

const EMPTY: SongInput = { title: '', author: '', melody: '', text: '', tags: [], hidden: false }

function NewTagInline({ onCreated }: { onCreated: (tag: TagOption) => void }) {
  const { texts } = useLanguage()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const create = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    const result = await callApi<{ tag_id: string }>('/api/tags', {
      method: 'POST',
      body: { name: trimmed, pretty_name_sv: trimmed, pretty_name_en: trimmed },
    })
    setBusy(false)
    if (!result.ok) {
      setError(errorMessage(texts, result.code))
      return
    }
    onCreated({
      tag_id: result.data.tag_id,
      name: trimmed,
      pretty_name_sv: trimmed,
      pretty_name_en: trimmed,
    })
    setName('')
    setError(null)
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          className={`${inputClass} py-1`}
          placeholder={texts.CreateNewTag}
          aria-label={texts.CreateNewTag}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void create()
            }
          }}
        />
        <Button
          variant="secondary"
          className="py-1"
          onClick={create}
          disabled={busy || !name.trim()}
        >
          {texts.CreateTag}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <Link href="/tags" className="mt-1 inline-block text-xs text-turquoise-800 underline">
        {texts.ManageTags}
      </Link>
    </div>
  )
}

export function SongForm({
  mode,
  initial,
  tags: initialTags,
}: {
  mode: SongFormMode
  initial?: Partial<SongInput>
  tags: TagOption[]
}) {
  const { texts } = useLanguage()
  const showToast = useToast()
  const router = useRouter()
  const [values, setValues] = useState<SongInput>({ ...EMPTY, ...initial })
  const [tags, setTags] = useState(initialTags)
  const [errors, setErrors] = useState<{ title?: string; text?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isAdminMode = mode.kind === 'create' || mode.kind === 'edit'
  const set = <K extends keyof SongInput>(key: K, value: SongInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  const heading = {
    create: texts.AddSong,
    edit: mode.kind === 'edit' ? `${texts.EditSongHeader}: Nr.${mode.number} ${mode.title}` : '',
    'suggest-new': texts.SuggestSong,
    'suggest-edit':
      mode.kind === 'suggest-edit'
        ? `${texts.SuggestEditHeader}: Nr.${mode.number} ${mode.title}`
        : '',
    'edit-suggestion': texts.Suggestions,
  }[mode.kind]

  const backHref =
    mode.kind === 'edit' || mode.kind === 'suggest-edit'
      ? `/${mode.songId}`
      : mode.kind === 'edit-suggestion'
        ? '/suggestions'
        : '/'

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    if (!values.title.trim()) nextErrors.title = texts.CantBeEmpty
    if (!values.text.trim()) nextErrors.text = texts.CantBeEmpty
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const body = {
      title: values.title,
      author: values.author,
      melody: values.melody,
      text: values.text,
      tags: values.tags,
      ...(isAdminMode ? { hidden: values.hidden ?? false } : {}),
    }

    setBusy(true)
    let result
    let success: string
    let target: string
    switch (mode.kind) {
      case 'create':
        result = await callApi<{ song_id: string }>('/api/songs', { method: 'POST', body })
        success = texts.AddSongSuccessful
        target = result.ok ? `/${result.data.song_id}` : '/'
        break
      case 'edit':
        result = await callApi(`/api/songs/${mode.songId}`, { method: 'PUT', body })
        success = texts.EditSongSuccessful
        target = `/${mode.songId}`
        break
      case 'suggest-new':
      case 'suggest-edit':
        result = await callApi('/api/suggestions', {
          method: 'POST',
          body: {
            ...body,
            kind: mode.kind === 'suggest-new' ? 'new' : 'edit',
            song_id: mode.kind === 'suggest-edit' ? mode.songId : null,
          },
        })
        success = texts.SuggestionSent
        target = '/suggestions'
        break
      case 'edit-suggestion':
        result = await callApi(`/api/suggestions/${mode.suggestionId}`, {
          method: 'PUT',
          body: { ...body, kind: mode.songId ? 'edit' : 'new', song_id: mode.songId },
        })
        success = texts.SuggestionSaved
        target = '/suggestions'
        break
    }
    setBusy(false)

    if (!result.ok) {
      const message = errorMessage(texts, result.code)
      if (result.code === 'SONG_TITLE_ALREADY_EXIST') setErrors({ title: message })
      else setErrors({ form: message })
      showToast(
        mode.kind === 'create'
          ? texts.AddSongFailed
          : mode.kind === 'edit'
            ? texts.EditSongFailed
            : message,
        'error',
      )
      return
    }
    showToast(success)
    router.push(target)
    router.refresh()
  }

  const remove = async () => {
    if (mode.kind !== 'edit') return
    setBusy(true)
    const result = await callApi(`/api/songs/${mode.songId}`, { method: 'DELETE' })
    setBusy(false)
    setConfirmDelete(false)
    if (!result.ok) {
      showToast(texts.DeleteSongFailed, 'error')
      return
    }
    showToast(texts.DeleteSongSuccessful)
    router.push('/')
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={submit} className={`${cardClass} space-y-4 p-6`} noValidate>
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className={buttonClass('ghost')}
            aria-label={texts.Back}
            title={texts.Back}
          >
            ←
          </Link>
          <h1 className="text-xl font-semibold">{heading}</h1>
        </div>

        {mode.kind.startsWith('suggest') && (
          <p className="text-sm text-gray-600">{texts.SuggestionsHelp}</p>
        )}

        <Field label={texts.Title} error={errors.title}>
          {(id) => (
            <input
              id={id}
              className={inputClass}
              value={values.title}
              onChange={(event) => set('title', event.target.value)}
              required
            />
          )}
        </Field>
        <Field label={texts.Author}>
          {(id) => (
            <input
              id={id}
              className={inputClass}
              value={values.author}
              onChange={(event) => set('author', event.target.value)}
            />
          )}
        </Field>
        <Field label={texts.Melody}>
          {(id) => (
            <input
              id={id}
              className={inputClass}
              value={values.melody}
              onChange={(event) => set('melody', event.target.value)}
            />
          )}
        </Field>
        <Field label={texts.Text} error={errors.text}>
          {(id) => (
            <textarea
              id={id}
              className={`${inputClass} min-h-[16rem] font-mono`}
              value={values.text}
              onChange={(event) => set('text', event.target.value)}
              required
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Markdown className="text-gray-600">{texts.MarkdownFormatSong}</Markdown>
          <Button onClick={() => setPreview(true)}>{texts.PreviewText}</Button>
        </div>

        <TagSelect
          label={texts.Tags}
          tags={tags}
          value={values.tags}
          onChange={(value) => set('tags', value)}
          footer={
            isAdminMode ? (
              <NewTagInline
                onCreated={(tag) => {
                  setTags((current) => [...current, tag])
                  set('tags', [...values.tags, tag.tag_id])
                }}
              />
            ) : undefined
          }
        />

        {isAdminMode && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-turquoise-800"
              checked={values.hidden ?? false}
              onChange={(event) => set('hidden', event.target.checked)}
            />
            <span className="font-medium">{texts.Hidden}</span>
            <span className="text-gray-500">({texts.HiddenHelp})</span>
          </label>
        )}

        {errors.form && (
          <p role="alert" className="text-sm text-red-600">
            {errors.form}
          </p>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <div>
            {mode.kind === 'edit' && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                {texts.DeleteSong}
              </Button>
            )}
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {mode.kind.startsWith('suggest') ? texts.SendSuggestion : texts.Save}
          </Button>
        </div>
      </form>

      {preview && (
        <Dialog
          wide
          title={texts.PreviewText}
          onClose={() => setPreview(false)}
          actions={<Button onClick={() => setPreview(false)}>{texts.Close}</Button>}
        >
          <Markdown>{texts.FormatSong}</Markdown>
          <hr className="my-4 border-gray-200" />
          <Markdown className="text-base">{values.text}</Markdown>
        </Dialog>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={texts.DeleteSongConfirm}
          confirmLabel={texts.DeleteSong}
          cancelLabel={texts.Cancel}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
          busy={busy}
        />
      )}
    </div>
  )
}
