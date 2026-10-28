import ReactMarkdown from 'react-markdown'
import { safeUrl } from '@/lib/markdown'

/**
 * Renders untrusted markdown (lyrics). Raw HTML is dropped, link targets are restricted to
 * http(s)/mailto and images are not rendered at all. With `links={false}` links are rendered as
 * plain text, for previews inside an element that is a link itself (`<a>` can't be nested).
 */
export function Markdown({
  children,
  className = '',
  links = true,
}: {
  children: string
  className?: string
  links?: boolean
}) {
  return (
    <div className={`prose prose-sm max-w-none prose-p:my-2 ${className}`}>
      <ReactMarkdown
        skipHtml
        urlTransform={safeUrl}
        disallowedElements={['img']}
        components={{
          a: ({ href, children: linkChildren }) =>
            links ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {linkChildren}
              </a>
            ) : (
              <span>{linkChildren}</span>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
