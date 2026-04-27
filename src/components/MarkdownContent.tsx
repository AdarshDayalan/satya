'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-[20px] font-medium text-white/90 mt-6 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[17px] font-medium text-white/85 mt-5 mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[15px] font-medium text-white/80 mt-4 mb-1">{children}</h3>,
        p: ({ children }) => <p className="text-white/70 text-[14px] leading-[1.8] mb-2">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-outside ml-5 space-y-0.5 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-outside ml-5 space-y-0.5 mb-2">{children}</ol>,
        li: ({ children }) => <li className="text-white/70 text-[14px] leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-white/[0.1] pl-4 my-3 text-white/50">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <pre className="bg-white/[0.03] rounded-lg p-3 my-3 overflow-x-auto">
                <code className="text-[13px] text-white/60 font-mono">{children}</code>
              </pre>
            )
          }
          return <code className="bg-white/[0.05] px-1 py-0.5 rounded text-[13px] text-white/70 font-mono">{children}</code>
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400/70 hover:text-blue-400 underline-offset-2 hover:underline transition-colors">
            {children}
          </a>
        ),
        hr: () => <hr className="border-white/[0.06] my-5" />,
        strong: ({ children }) => <strong className="text-white/90 font-medium">{children}</strong>,
        em: ({ children }) => <em className="text-white/60">{children}</em>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-[13px]">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="text-left text-white/60 font-medium py-1.5 px-2 border-b border-white/[0.06]">{children}</th>,
        td: ({ children }) => <td className="text-white/70 py-1.5 px-2 border-b border-white/[0.03]">{children}</td>,
        input: ({ checked, ...props }) => (
          <input type="checkbox" checked={checked} readOnly className="mr-2 accent-purple-400" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
