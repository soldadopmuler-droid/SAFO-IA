import { Brain } from "lucide-react";

export type MindNode = { label: string; detail?: string; children?: MindNode[] };

/** Mapa mental minimalista: árvore com linhas SVG suaves, sem cores fortes. */
export function MindMap({ title, branches }: { title: string; branches: MindNode[] }) {
  // Layout: tema central + ramos em duas colunas (esq/dir), conectados por curvas SVG.
  const left: MindNode[] = [];
  const right: MindNode[] = [];
  branches.forEach((b, i) => (i % 2 === 0 ? left : right).push(b));

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-border bg-card/40 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-center gap-2 text-center">
        <Brain className="h-4 w-4 text-primary" strokeWidth={2.2} />
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary/80">
          Mapa Mental
        </div>
      </div>

      <div className="relative grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-8">
        {/* Coluna esquerda */}
        <div className="flex flex-col gap-3 md:items-end">
          {left.map((n, i) => (
            <BranchNode key={`l-${i}`} node={n} side="left" />
          ))}
        </div>

        {/* Tema central */}
        <div className="flex items-center justify-center">
          <div className="relative rounded-xl border border-primary/40 bg-background px-5 py-3 text-center shadow-sm">
            <div className="text-base font-bold leading-tight text-foreground md:text-lg">
              {title}
            </div>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="flex flex-col gap-3 md:items-start">
          {right.map((n, i) => (
            <BranchNode key={`r-${i}`} node={n} side="right" />
          ))}
        </div>

        {/* Linhas SVG conectoras (apenas em md+) */}
        <SvgLines leftCount={left.length} rightCount={right.length} />
      </div>
    </div>
  );
}

function BranchNode({ node, side }: { node: MindNode; side: "left" | "right" }) {
  return (
    <div
      className={`w-full max-w-[260px] rounded-lg border border-border/70 bg-background/60 p-3 ${
        side === "left" ? "md:text-right" : "md:text-left"
      }`}
    >
      <h4 className="m-0 text-sm font-bold text-foreground">{node.label}</h4>
      {node.detail && (
        <p className="m-0 mt-0.5 text-[12px] leading-snug text-muted-foreground">{node.detail}</p>
      )}
      {node.children && node.children.length > 0 && (
        <ul
          className={`m-0 mt-1.5 list-none space-y-0.5 p-0 text-[12px] leading-snug text-foreground/80 ${
            side === "left" ? "md:text-right" : "md:text-left"
          }`}
        >
          {node.children.map((c, j) => (
            <li key={j} className="opacity-90">
              · {c.label}
              {c.detail && <span className="text-muted-foreground"> — {c.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Linhas conectoras SVG decorativas (opacidade baixa, sem interferir no texto). */
function SvgLines({ leftCount, rightCount }: { leftCount: number; rightCount: number }) {
  if (leftCount + rightCount === 0) return null;
  // SVG ocupa toda a área absoluta; usamos caminhos curvos partindo do centro horizontal
  // até cada lado. As coordenadas são percentuais — funciona como decoração visual.
  const make = (count: number, side: "left" | "right") => {
    if (count === 0) return null;
    return Array.from({ length: count }).map((_, i) => {
      const y = ((i + 0.5) / count) * 100;
      const startX = 50;
      const endX = side === "left" ? 12 : 88;
      const cX = side === "left" ? 30 : 70;
      return (
        <path
          key={`${side}-${i}`}
          d={`M ${startX} 50 C ${cX} 50, ${cX} ${y}, ${endX} ${y}`}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.25"
          strokeWidth="0.4"
        />
      );
    });
  };
  return (
    <svg
      className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {make(leftCount, "left")}
      {make(rightCount, "right")}
    </svg>
  );
}

/** Faz parse tolerante:
 *  - bloco JSON (linguagem mindmap) com {title,branches:[{label,detail?,children?:[...]}]}
 *  - formato ASCII com └─/├─ e indentação por espaços/2.
 */
export function parseMindMap(raw: string): { title: string; branches: MindNode[] } | null {
  const txt = raw.trim();
  if (!txt) return null;
  if (txt.startsWith("{")) {
    try {
      const j = JSON.parse(txt);
      if (j && typeof j.title === "string" && Array.isArray(j.branches)) return j;
    } catch { /* fallthrough */ }
  }
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/\s+$/g, "")).filter(Boolean);
  if (lines.length === 0) return null;
  type Row = { depth: number; label: string; detail?: string };
  const rows: Row[] = lines.map((line) => {
    const stripped = line.replace(/[│|]/g, " ");
    const m = stripped.match(/^(\s*)([├└─\-•·>]*\s*)?(.*)$/);
    const indent = m ? m[1].length : 0;
    const prefix = m ? (m[2] || "") : "";
    const rest = (m ? m[3] : line).trim();
    let label = rest, detail: string | undefined;
    const par = rest.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (par) { label = par[1].trim(); detail = par[2].trim(); }
    const depth = Math.floor((indent + prefix.length) / 2);
    return { depth, label, detail };
  }).filter((r) => r.label);
  if (rows.length === 0) return null;
  const minD = Math.min(...rows.map((r) => r.depth));
  rows.forEach((r) => (r.depth -= minD));
  const root: MindNode = { label: rows[0].label, detail: rows[0].detail, children: [] };
  const stack: { node: MindNode; depth: number }[] = [{ node: root, depth: 0 }];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    while (stack.length > 1 && stack[stack.length - 1].depth >= r.depth) stack.pop();
    const parent = stack[stack.length - 1].node;
    const node: MindNode = { label: r.label, detail: r.detail, children: [] };
    (parent.children ||= []).push(node);
    stack.push({ node, depth: r.depth });
  }
  return { title: root.label, branches: root.children || [] };
}