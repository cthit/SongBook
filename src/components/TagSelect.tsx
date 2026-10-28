'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '@/components/Providers'
import { Chip, inputClass, labelClass } from '@/components/ui'
import { tagLabel } from '@/lib/i18n'
import type { Tag } from '@/lib/types'

type TagOption = Pick<Tag, 'tag_id' | 'name' | 'pretty_name_sv' | 'pretty_name_en'>

/** Multi-select of tags: a button that opens a list of checkboxes, selected tags shown as chips */
export function TagSelect({
  label,
  tags,
  value,
  onChange,
  footer,
}: {
  label: string
  tags: TagOption[]
  value: string[]
  onChange: (value: string[]) => void
  /** Extra content at the bottom of the popover, e.g. "create a new tag" */
  footer?: React.ReactNode
}) {
  const { language, texts } = useLanguage()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const labelId = useId()

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const options = [...tags].sort((a, b) =>
    tagLabel(a, language).localeCompare(tagLabel(b, language), language),
  )
  const selected = options.filter((tag) => value.includes(tag.tag_id))
  const toggle = (tagId: string) =>
    onChange(value.includes(tagId) ? value.filter((id) => id !== tagId) : [...value, tagId])

  return (
    <div className="relative" ref={root}>
      <span id={labelId} className={labelClass}>
        {label}
      </span>
      <button
        type="button"
        className={`${inputClass} flex min-h-[2.5rem] items-center justify-between gap-2 text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex flex-wrap gap-1">
          {selected.length === 0 && <span className="text-gray-400">{texts.NoTagsSelected}</span>}
          {selected.map((tag) => (
            <Chip key={tag.tag_id}>{tagLabel(tag, language)}</Chip>
          ))}
        </span>
        <span aria-hidden className="text-gray-400">
          ▾
        </span>
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={labelId}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map((tag) => (
            <label
              key={tag.tag_id}
              role="option"
              aria-selected={value.includes(tag.tag_id)}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-turquoise-800"
                checked={value.includes(tag.tag_id)}
                onChange={() => toggle(tag.tag_id)}
              />
              {tagLabel(tag, language)}
            </label>
          ))}
          {footer && <div className="border-t border-gray-100 px-3 py-2">{footer}</div>}
        </div>
      )}
    </div>
  )
}
