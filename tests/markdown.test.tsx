import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '@/components/Markdown'
import { Providers } from '@/components/Providers'
import { SongCard } from '@/components/SongCard'
import type { Song } from '@/lib/types'

const render = (source: string) => renderToStaticMarkup(<Markdown>{source}</Markdown>)

describe('Markdown', () => {
  it('renders lyrics markdown', () => {
    const html = render('*Alla:*\n\nFör nu glaset till din mun!')
    expect(html).toContain('<em>Alla:</em>')
    expect(html).toContain('<p>För nu glaset till din mun!</p>')
  })

  it('never renders raw HTML', () => {
    const html = render('Hej <script>alert(1)</script> <img src=x onerror=alert(1)> <b>fet</b>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('onerror')
  })

  it('drops unsafe links and images', () => {
    const html = render(
      '[klick](javascript:alert(1)) [ok](https://chalmers.it) ![bild](https://x/y.png)',
    )
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="https://chalmers.it"')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
    expect(html).not.toContain('<img')
  })
})

describe('SongCard', () => {
  const song: Song = {
    song_id: 'crsi',
    number: 3,
    title: 'LÄNKAD',
    author: 'Unknown',
    melody: '',
    text: 'Se [chalmers.it](https://chalmers.it) och <https://example.com> för mer',
    tags: [],
    hidden: false,
  }

  it('does not nest links when the lyrics contain links', () => {
    const html = renderToStaticMarkup(
      <Providers initialLanguage="en" languageFromCookie user={null}>
        <SongCard song={song} tagsById={new Map()} onOpen={() => {}} />
      </Providers>,
    )
    // Only the card itself is a link
    expect(html.match(/<a[\s>]/g)).toHaveLength(1)
    expect(html).toContain('href="/crsi"')
    expect(html).toContain('<span>chalmers.it</span>')
    expect(html).toContain('<span>https://example.com</span>')
  })
})
