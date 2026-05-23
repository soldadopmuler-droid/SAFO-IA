import ReactMarkdown from "react-markdown";
import { Fragment, type ReactNode } from "react";
import { MindMap, parseMindMap } from "./MindMap";
import { Infographic, parseInfographic } from "./Infographic";

/** Slugifica texto para uso como id de heading (compatível com TOC clicável). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function headingChildrenToText(children: unknown): string {
  if (children == null) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(headingChildrenToText).join("");
  if (typeof children === "object" && children && "props" in (children as Record<string, unknown>)) {
    const props = (children as { props?: { children?: unknown } }).props;
    return headingChildrenToText(props?.children);
  }
  return "";
}

function makeHeading(Tag: "h1" | "h2" | "h3") {
  return function Heading({ children, ...rest }: { children?: React.ReactNode }) {
    const text = headingChildrenToText(children);
    const id = slugify(text);
    return <Tag id={id} data-toc-text={text} {...rest}>{children}</Tag>;
  };
}

const PROSE_CLASSES = `prose prose-invert prose-sm max-w-none
  prose-headings:font-display prose-headings:text-foreground
  prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
  prose-p:text-foreground/90 prose-li:text-foreground/90
  prose-strong:text-primary-glow prose-strong:font-semibold
  prose-a:text-primary hover:prose-a:text-primary-glow
  prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-primary-glow prose-code:before:content-none prose-code:after:content-none
  prose-blockquote:border-l-primary prose-blockquote:text-beige
  prose-table:text-sm prose-th:text-foreground prose-td:text-foreground/90
  prose-hr:border-border`;

const MD_COMPONENTS = {
  h1: makeHeading("h1"),
  h2: makeHeading("h2"),
  h3: makeHeading("h3"),
};

/** Extrai blocos visuais (Mapa Mental) e devolve uma lista alternada de
 *  trechos de markdown e nodes React para renderizar em ordem. */
function splitVisualBlocks(source: string): Array<{ kind: "md"; content: string } | { kind: "node"; node: ReactNode }> {
  const out: Array<{ kind: "md"; content: string } | { kind: "node"; node: ReactNode }> = [];
  // (1) Bloco fenced ```mindmap ... ```
  const fenced = /```mindmap\s*\n([\s\S]*?)```/g;
  // (2) Seção "## Mapa Mental" (com/sem emoji) até o próximo "## "
  const section = /^##\s+(?:🗺️\s*)?Mapa\s+Mental[^\n]*\n([\s\S]*?)(?=^##\s|\Z)/gim;
  // (3) Bloco fenced ```infographic ... ``` (JSON)
  const info = /```infographic\s*\n([\s\S]*?)```/g;

  type Hit = { start: number; end: number; body: string; kind: "mind" | "info" };
  const hits: Hit[] = [];
  for (const m of source.matchAll(fenced)) {
    hits.push({ start: m.index!, end: m.index! + m[0].length, body: m[1], kind: "mind" });
  }
  for (const m of source.matchAll(section)) {
    hits.push({ start: m.index!, end: m.index! + m[0].length, body: m[1], kind: "mind" });
  }
  for (const m of source.matchAll(info)) {
    hits.push({ start: m.index!, end: m.index! + m[0].length, body: m[1], kind: "info" });
  }
  hits.sort((a, b) => a.start - b.start);

  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) out.push({ kind: "md", content: source.slice(cursor, h.start) });
    if (h.kind === "info") {
      const data = parseInfographic(h.body);
      if (data && data.columns.length > 0) {
        out.push({ kind: "node", node: <Infographic data={data} /> });
      } else {
        out.push({ kind: "md", content: source.slice(h.start, h.end) });
      }
      cursor = h.end;
      continue;
    }
    const parsed = parseMindMap(h.body);
    if (parsed && parsed.branches.length > 0) {
      out.push({
        kind: "node",
        node: (
          <Fragment>
            <h2 id={slugify("Mapa Mental")} data-toc-text="Mapa Mental">🗺️ Mapa Mental</h2>
            <MindMap title={parsed.title} branches={parsed.branches} />
          </Fragment>
        ),
      });
    } else {
      // Não conseguiu parsear: mantém o texto original
      out.push({ kind: "md", content: source.slice(h.start, h.end) });
    }
    cursor = h.end;
  }
  if (cursor < source.length) out.push({ kind: "md", content: source.slice(cursor) });
  return out.length > 0 ? out : [{ kind: "md", content: source }];
}

export function Markdown({ children }: { children: string }) {
  const blocks = splitVisualBlocks(children);
  return (
    <div className={PROSE_CLASSES}>
      {blocks.map((b, i) =>
        b.kind === "md" ? (
          <ReactMarkdown key={i} components={MD_COMPONENTS}>{b.content}</ReactMarkdown>
        ) : (
          <Fragment key={i}>{b.node}</Fragment>
        ),
      )}
    </div>
  );
}
