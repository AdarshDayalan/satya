'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-[22px] font-light text-white/90 mt-8 mb-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[18px] font-light text-white/85 mt-6 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[15px] font-medium text-white/80 mt-5 mb-2">{children}</h3>,
        p: ({ children }) => <p className="text-white/70 text-[14px] leading-[1.8] mb-3">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-outside ml-5 space-y-1 mb-3">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-outside ml-5 space-y-1 mb-3">{children}</ol>,
        li: ({ children }) => <li className="text-white/70 text-[14px] leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-400/30 pl-4 my-4 text-white/50 italic">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <pre className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 my-4 overflow-x-auto">
                <code className="text-[13px] text-green-400/80 font-mono">{children}</code>
              </pre>
            )
          }
          return <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px] text-amber-400/80 font-mono">{children}</code>
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400/70 hover:text-blue-400 underline underline-offset-2 transition-colors">
            {children}
          </a>
        ),
        hr: () => <hr className="border-white/[0.06] my-6" />,
        strong: ({ children }) => <strong className="text-white/90 font-medium">{children}</strong>,
        em: ({ children }) => <em className="text-white/60">{children}</em>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="w-full text-[13px] border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="text-left text-white/60 font-medium py-2 px-3 border-b border-white/[0.08]">{children}</th>,
        td: ({ children }) => <td className="text-white/70 py-2 px-3 border-b border-white/[0.04]">{children}</td>,
        input: ({ checked, ...props }) => (
          <input type="checkbox" checked={checked} readOnly className="mr-2 accent-purple-400" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
