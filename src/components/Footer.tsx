'use client'

import { useTexts } from '@/components/Providers'

export function Footer() {
  const texts = useTexts()
  return (
    <footer className="mt-12 border-t border-gray-200 py-6 text-center text-sm text-gray-500">
      <p>
        {'made with ❤️ by '}
        <a className="underline hover:text-gray-800" href="https://github.com/ericlp/">
          LP
        </a>
        {" (digIT'18)"}
      </p>
      <p className="mt-1 flex justify-center gap-4">
        <a className="underline hover:text-gray-800" href="https://github.com/cthit/SongBook/">
          Source on Github
        </a>
        <a className="underline hover:text-gray-800" href="/api/songs/export">
          {texts.Export}
        </a>
      </p>
    </footer>
  )
}
