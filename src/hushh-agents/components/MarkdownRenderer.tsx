 /**
 * Hushh Agents — Markdown Renderer
 * 
 * Renders AI responses with proper markdown formatting.
 * Supports headings, bold, italic, lists, code blocks, links, hr, etc.
 * Two themes: 'dark' (CodePage) and 'light' (ChatPage).
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCallback, useState } from 'react';

interface MarkdownRendererProps {
  content: string;
  theme?: 'dark' | 'light';
  className?: string;
}

/** Copy button for code blocks — always visible */
const CopyButton = ({ text, theme }: { text: string; theme: 'dark' | 'light' }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  const isDark = theme === 'dark';

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
        copied
          ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
          : isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-900'
      }`}
      aria-label="Copy code"
    >
      <span className="material-symbols-outlined text-xs">
        {copied ? 'check' : 'content_copy'}
      </span>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

export default function MarkdownRenderer({ content, theme = 'dark', className = '' }: MarkdownRendererProps) {
  const isDark = theme === 'dark';

  // Color classes based on theme
  const colors = {
    text: isDark ? 'text-gray-300' : 'text-gray-700',
    heading: isDark ? 'text-white' : 'text-gray-900',
    link: isDark ? 'text-purple-400 hover:text-purple-300' : 'text-blue-600 hover:text-blue-500',
    code: isDark ? 'bg-gray-800 text-purple-300' : 'bg-gray-100 text-purple-700',
    codeBlock: isDark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200',
    codeBlockText: isDark ? 'text-gray-200' : 'text-gray-800',
    hr: isDark ? 'border-gray-700' : 'border-gray-200',
    blockquote: isDark ? 'border-purple-500/40 bg-purple-500/5 text-gray-400' : 'border-blue-400 bg-blue-50 text-gray-600',
    listMarker: isDark ? 'text-purple-400' : 'text-gray-500',
    strong: isDark ? 'text-white' : 'text-gray-900',
    table: isDark ? 'border-gray-700' : 'border-gray-200',
    tableHeader: isDark ? 'bg-gray-800/50 text-gray-200' : 'bg-gray-100 text-gray-800',
    tableCell: isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700',
  };

  return (
    <div className={`markdown-rendered overflow-hidden min-w-0 w-full ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          /* Headings */
          h1: ({ children }) => (
            <h1 className={`text-xl font-bold ${colors.heading} mt-4 mb-2 leading-tight`}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`text-lg font-semibold ${colors.heading} mt-4 mb-2 leading-tight`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-base font-semibold ${colors.heading} mt-3 mb-1.5 leading-tight`}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className={`text-sm font-semibold ${colors.heading} mt-3 mb-1`}>
              {children}
            </h4>
          ),

          /* Paragraph */
          p: ({ children }) => (
            <p className={`text-[13px] sm:text-sm leading-relaxed ${colors.text} mb-3 last:mb-0 break-words`}>
              {children}
            </p>
          ),

          /* Bold / Italic */
          strong: ({ children }) => (
            <strong className={`font-semibold ${colors.strong}`}>{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),

          /* Links */
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline underline-offset-2 ${colors.link} transition-colors`}
            >
              {children}
            </a>
          ),

          /* Lists */
          ul: ({ children }) => (
            <ul className={`list-disc list-outside ml-4 sm:ml-5 mb-3 space-y-1 ${colors.text} text-[13px] sm:text-sm`}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={`list-decimal list-outside ml-4 sm:ml-5 mb-3 space-y-1 ${colors.text} text-[13px] sm:text-sm`}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1">{children}</li>
          ),

          /* Inline code */
          code: ({ children, className: codeClassName }) => {
            // If it has a language class, it's a code block (handled by pre)
            const isBlock = codeClassName?.startsWith('language-');
            if (isBlock) {
              return (
                <code className={`text-sm font-mono ${colors.codeBlockText} leading-relaxed`}>
                  {children}
                </code>
              );
            }
            // Inline code
            return (
              <code className={`${colors.code} px-1.5 py-0.5 rounded text-xs font-mono`}>
                {children}
              </code>
            );
          },

          /* Code block wrapper with header bar + copy */
          pre: ({ children }) => {
            const codeText = extractTextFromChildren(children);
            // Try to extract language from child code element
            const lang = extractLanguageFromChildren(children);
            return (
              <div className={`rounded-xl border ${colors.codeBlock} my-3 overflow-hidden min-w-0`}>
                {/* Header bar with language + copy */}
                <div className={`flex items-center justify-between px-3 sm:px-4 py-2 border-b ${
                  isDark ? 'border-gray-800 bg-gray-900/60' : 'border-gray-200 bg-gray-100/80'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`material-symbols-outlined text-xs shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>code</span>
                    <span className={`text-[9px] sm:text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {lang || 'code'}
                    </span>
                  </div>
                  <CopyButton text={codeText} theme={theme} />
                </div>
                <pre className="p-3 sm:p-4 overflow-x-auto text-[12px] sm:text-sm font-mono leading-relaxed max-w-full">
                  {children}
                </pre>
              </div>
            );
          },

          /* Horizontal rule */
          hr: () => <hr className={`${colors.hr} my-4`} />,

          /* Blockquote */
          blockquote: ({ children }) => (
            <blockquote className={`border-l-3 ${colors.blockquote} pl-4 py-2 my-3 rounded-r-lg text-sm italic`}>
              {children}
            </blockquote>
          ),

          /* Table */
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg -mx-1 px-1">
              <table className={`w-full text-[11px] sm:text-sm border ${colors.table} border-collapse`}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className={colors.tableHeader}>{children}</thead>
          ),
          th: ({ children }) => (
            <th className={`px-3 py-2 text-left text-xs font-semibold border ${colors.table}`}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`px-3 py-2 border ${colors.tableCell} text-xs`}>
              {children}
            </td>
          ),

          /* Images */
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || ''}
              className="max-w-full rounded-lg my-3"
              loading="lazy"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Extract language from code element's className (e.g., "language-typescript" → "typescript") */
function extractLanguageFromChildren(children: React.ReactNode): string {
  if (children && typeof children === 'object' && 'props' in children) {
    const el = children as React.ReactElement;
    const className = el.props?.className as string | undefined;
    if (className) {
      const match = className.match(/language-(\w+)/);
      if (match) return match[1];
    }
  }
  if (Array.isArray(children)) {
    for (const child of children) {
      const result = extractLanguageFromChildren(child);
      if (result) return result;
    }
  }
  return '';
}

/** Recursively extract text from React children (for copy button) */
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return extractTextFromChildren((children as React.ReactElement).props.children);
  }
  return '';
}
