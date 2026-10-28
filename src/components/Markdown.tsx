import ReactMarkdown from 'react-markdown'
import { safeUrl } from '@/lib/markdown'

/**
 * Renders untrusted markdown (lyrics). Raw HTML is dropped, link targets are restricted to
 * http(s)/mailto and images are not rendered at all.
 */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose prose-sm max-w-none prose-p:my-2 ${className}`}>
      <ReactMarkdown
        skipHtml
        urlTransform={safeUrl}
        disallowedElements={['img']}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
