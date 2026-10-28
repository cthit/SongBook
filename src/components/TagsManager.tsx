'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useLanguage, useToast } from '@/components/Providers'
import { Button, ConfirmDialog, callApi, cardClass, inputClass } from '@/components/ui'
import { errorMessage } from '@/lib/i18n'
import type { Tag, TagInput } from '@/lib/types'

const EMPTY: TagInput = { name: '', pretty_name_sv: '', pretty_name_en: '' }

function TagFields({
  value,
  onChange,
  idPrefix,
}: {
  value: TagInput
  onChange: (value: TagInput) => void
  idPrefix: string
}) {
  const { texts } = useLanguage()
  const fields = [
    ['name', texts.TagName],
    ['pretty_name_sv', texts.PrettyNameSv],
    ['pretty_name_en', texts.PrettyNameEn],
  ] as const
  return (
    <>
      {fields.map(([key, label]) => (
        <div key={key} className="flex-1">
          <label
            htmlFor={`${idPrefix}-${key}`}
            className="mb-1 block text-xs font-medium text-gray-600"
          >
            {label}
          </label>
          <input
            id={`${idPrefix}-${key}`}
            className={inputClass}
            value={value[key]}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          />
        </div>
      ))}
    </>
  )
}

export function TagsManager({ tags }: { tags: Tag[] }) {
  const { texts } = useLanguage()
  const showToast = useToast()
  const router = useRouter()
  const [draft, setDraft] = useState<TagInput>(EMPTY)
  const [editing, setEditing] = useState<{ tagId: string; value: TagInput } | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (request: Promise<{ ok: boolean; code?: string }>, success: string) => {
    setBusy(true)
    const result = await request
    setBusy(false)
    if (!result.ok) {
      setError(errorMessage(texts, result.code))
      return false
    }
    setError(null)
    showToast(success)
    router.refresh()
    return true
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim()) {
      setError(texts.CantBeEmpty)
      return
    }
    if (await run(callApi('/api/tags', { method: 'POST', body: draft }), texts.TagSaved))
      setDraft(EMPTY)
  }

  const save = async () => {
    if (!editing) return
    const ok = await run(
      callApi(`/api/tags/${editing.tagId}`, { method: 'PUT', body: editing.value }),
      texts.TagSaved,
    )
    if (ok) setEditing(null)
  }

  const remove = async () => {
    if (!deleting) return
    await run(callApi(`/api/tags/${deleting.tag_id}`, { method: 'DELETE' }), texts.TagDeleted)
    setDeleting(null)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">{texts.ManageTags}</h1>

      <form onSubmit={create} className={`${cardClass} p-4`}>
        <h2 className="mb-3 font-semibold">{texts.NewTag}</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TagFields value={draft} onChange={setDraft} idPrefix="new-tag" />
          <Button type="submit" variant="primary" disabled={busy}>
            {texts.CreateTag}
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <ul className={`${cardClass} divide-y divide-gray-100`}>
        {tags.map((tag) => (
          <li key={tag.tag_id} className="p-4" data-testid="tag-row">
            {editing?.tagId === tag.tag_id ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <TagFields
                  value={editing.value}
                  onChange={(value) => setEditing({ tagId: tag.tag_id, value })}
                  idPrefix={`tag-${tag.tag_id}`}
                />
                <div className="flex gap-2">
                  <Button variant="primary" onClick={save} disabled={busy}>
                    {texts.Save}
                  </Button>
                  <Button onClick={() => setEditing(null)}>{texts.Cancel}</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{tag.name}</p>
                  <p className="text-sm text-gray-600">
                    {texts.PrettyNameSv}: {tag.pretty_name_sv} · {texts.PrettyNameEn}:{' '}
                    {tag.pretty_name_en} · {texts.Songs}: {tag.song.length}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      setEditing({
                        tagId: tag.tag_id,
                        value: {
                          name: tag.name,
                          pretty_name_sv: tag.pretty_name_sv,
                          pretty_name_en: tag.pretty_name_en,
                        },
                      })
                    }
                  >
                    {texts.Edit}
                  </Button>
                  <Button variant="danger" onClick={() => setDeleting(tag)}>
                    {texts.Delete}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {deleting && (
        <ConfirmDialog
          message={`${texts.DeleteTagConfirm} (${deleting.name})`}
          confirmLabel={texts.Delete}
          cancelLabel={texts.Cancel}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
          busy={busy}
        />
      )}
    </div>
  )
}
