import { CheckCircle2, XCircle, Circle } from "lucide-react";

export type InfoColumn = {
  title: string;
  subtitle?: string;
  tone?: "positive" | "negative" | "neutral";
  items: string[];
};

export type InfographicData = {
  title?: string;
  columns: InfoColumn[];
};

const TONES = {
  positive: {
    border: "border-success/40",
    bg: "bg-success/5",
    chip: "bg-success/15 text-success",
    Icon: CheckCircle2,
  },
  negative: {
    border: "border-destructive/40",
    bg: "bg-destructive/5",
    chip: "bg-destructive/15 text-destructive",
    Icon: XCircle,
  },
  neutral: {
    border: "border-primary/30",
    bg: "bg-primary/5",
    chip: "bg-primary/15 text-primary",
    Icon: Circle,
  },
} as const;

/** Infográfico comparativo lado a lado (substitui tabelas longas). */
export function Infographic({ data }: { data: InfographicData }) {
  const cols = data.columns || [];
  if (cols.length === 0) return null;
  const gridCols =
    cols.length === 2 ? "md:grid-cols-2" : cols.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4";

  return (
    <div className="my-8 rounded-2xl border border-border bg-card/40 p-5 shadow-sm">
      {data.title && (
        <div className="mb-4 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary/80">
            Comparativo
          </div>
          <h3 className="m-0 mt-1 text-base font-bold text-foreground">{data.title}</h3>
        </div>
      )}
      <div className={`grid grid-cols-1 gap-3 ${gridCols}`}>
        {cols.map((c, i) => {
          const tone = TONES[c.tone || "neutral"];
          const Icon = tone.Icon;
          return (
            <div
              key={i}
              className={`rounded-xl border ${tone.border} ${tone.bg} p-4`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${tone.chip}`}>
                  <Icon className="h-4 w-4" strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <h4 className="m-0 text-sm font-bold leading-tight text-foreground">{c.title}</h4>
                  {c.subtitle && (
                    <p className="m-0 text-[11px] leading-snug text-muted-foreground">{c.subtitle}</p>
                  )}
                </div>
              </div>
              <ul className="m-0 list-none space-y-1.5 p-0 text-[12.5px] leading-snug text-foreground/85">
                {c.items.map((it, j) => (
                  <li key={j} className="flex gap-1.5">
                    <span className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${tone.chip}`} />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function parseInfographic(raw: string): InfographicData | null {
  const txt = raw.trim();
  if (!txt) return null;
  try {
    const j = JSON.parse(txt);
    if (j && Array.isArray(j.columns) && j.columns.every((c: unknown) =>
      typeof c === "object" && c !== null && "title" in c && "items" in c)) {
      return j as InfographicData;
    }
  } catch { /* ignore */ }
  return null;
}