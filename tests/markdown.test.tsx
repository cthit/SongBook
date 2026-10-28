import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '@/components/Markdown'

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
