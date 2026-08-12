/**
 * Renders an assistant reply.
 *
 * The old chat put the model's output in a `whitespace-pre-wrap` paragraph, so a
 * comparison of five offices arrived as a wall of pipe characters. Analysis has
 * structure — tables, emphasis on the number that matters — and throwing that away
 * makes the answer harder to read than the dashboard it was meant to explain.
 *
 * Links to app routes are handed to the router instead of the browser, so following
 * the assistant's own advice does not reload the SPA. External links are opened in a
 * new tab with `noreferrer`, since their text is model-generated.
 */

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

/** In-app routes look like `/source/abc`; anything else is treated as external. */
function isInternal(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

export const AssistantMarkdown = memo(function AssistantMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-sm leading-relaxed text-foreground',
        // Spacing is set per element rather than through a prose plugin: replies are
        // short and typographic defaults leave far too much air between two sentences.
        '[&>*+*]:mt-3',
        '[&_p]:leading-relaxed',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1',
        '[&_li]:pl-0.5',
        '[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-4',
        '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4',
        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const target = href ?? '';
            if (isInternal(target)) {
              return (
                <Link
                  to={target}
                  className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={target}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                {children}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            );
          },
          // Tables are the assistant's main comparison device and routinely exceed a
          // narrow column, so each one scrolls inside itself rather than stretching
          // the conversation.
          table({ children }) {
            return (
              <div className="-mx-1 overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full border-collapse text-xs">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-muted/50">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border-b border-border/60 px-3 py-2 text-left font-medium text-muted-foreground">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border-b border-border/40 px-3 py-2 align-top">{children}</td>;
          },
          pre({ children }) {
            return (
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{children}</pre>
            );
          },
          hr() {
            return <hr className="border-border/60" />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
