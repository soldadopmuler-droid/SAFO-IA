import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Sparkles, Loader2, Download, FileText, Eye, Palette } from "lucide-react";
import { drawSafoChrome } from "@/lib/pdfChrome";
/** Temas de capa (paleta + nome) */
type CoverThemeId = "gold" | "midnight" | "blood" | "marble" | "forest";
const COVER_THEMES: Record<CoverThemeId, {
  id: CoverThemeId; nome: string;
  bg: [number, number, number]; accent: [number, number, number];
  accentDark: [number, number, number]; text: [number, number, number]; muted: [number, number, number];
  cssBg: string; cssAccent: string;
}> = {
  gold:     { id: "gold",     nome: "Onyx & Gold",  bg: [8, 10, 14],     accent: [201, 162, 39],  accentDark: [155, 124, 28], text: [248, 248, 248], muted: [190, 190, 190], cssBg: "#080a0e", cssAccent: "#c9a227" },
  midnight: { id: "midnight", nome: "Midnight Blue", bg: [10, 18, 38],   accent: [120, 168, 255], accentDark: [70, 110, 200], text: [240, 244, 255], muted: [180, 195, 220], cssBg: "#0a1226", cssAccent: "#78a8ff" },
  blood:    { id: "blood",    nome: "Tactical Red", bg: [18, 8, 10],     accent: [200, 50, 60],   accentDark: [140, 30, 40],  text: [248, 240, 240], muted: [200, 180, 180], cssBg: "#12080a", cssAccent: "#c8323c" },
  marble:   { id: "marble",   nome: "Marble White", bg: [245, 244, 240], accent: [40, 40, 40],    accentDark: [120, 120, 120],text: [20, 20, 20],    muted: [100, 100, 100], cssBg: "#f5f4f0", cssAccent: "#202020" },
  forest:   { id: "forest",   nome: "Forest Ops",   bg: [10, 22, 18],    accent: [120, 200, 140], accentDark: [60, 130, 90],  text: [240, 250, 244], muted: [180, 210, 195], cssBg: "#0a1612", cssAccent: "#78c88c" },
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldCheck, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/study/PageHeader";
import { Markdown } from "@/components/study/Markdown";
import { slugify } from "@/components/study/Markdown";
import { MATERIAS } from "@/lib/materias";
import { streamSSE } from "@/lib/streamSSE";
import { invokeFunction } from "@/lib/invokeFunction";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import logo974 from "@/assets/logo-974-safo.webp";
import iluDireito from "@/assets/ilustra-direito.png";
import iluPolicial from "@/assets/ilustra-policial.png";
import iluArmamento from "@/assets/ilustra-armamento.png";
import iluTransito from "@/assets/ilustra-transito.png";
import iluLivro from "@/assets/ilustra-livro.png";
import iluFisico from "@/assets/ilustra-fisico.png";
import {
  DIVISA_MAIN_MM,
  DIVISA_BADGE_MM,
  DIVISA_PREVIEW_PCT,
  divisaOpacityForTheme,
  isLightTheme,
  verifyDivisaParity,
} from "@/lib/coverDivisaSpec";
import { useAuth } from "@/contexts/AuthContext";

type TocEntry = { level: 1 | 2 | 3; text: string; pageInPdf: number };

/** Pool de fallback rotacionado deterministicamente — evita repetir sempre a mesma imagem genérica. */
const FALLBACK_POOL = [iluPolicial, iluLivro, iluDireito, iluFisico, iluArmamento, iluTransito];
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
/** Fallback determinístico baseado no texto — mesma string sempre gera a mesma figura,
 *  mas strings diferentes recebem figuras diferentes do pool. */
export function pickFallbackIlustracao(seed: string): string {
  const key = (seed || "974safo").trim().toLowerCase();
  return FALLBACK_POOL[hashString(key) % FALLBACK_POOL.length];
}

/** Escolhe ilustração temática conforme matéria/tópico.
 *  Quando nenhuma regra casa, usa um fallback rotacionado por hash do texto,
 *  garantindo que nunca fique em branco e que capítulos diferentes recebam
 *  figuras diferentes em vez de repetir a mesma genérica. */
function pickIlustracao(materia: string, topico?: string): string {
  const k = `${materia} ${topico ?? ""}`.toLowerCase();
  if (/tr[âa]nsito|ctb|ve[íi]culo/.test(k)) return iluTransito;
  if (/armament|tiro|muni/.test(k)) return iluArmamento;
  if (/f[íi]sic|taf|defesa pessoal/.test(k)) return iluFisico;
  if (/portugu[eê]s|reda[cç][ãa]o|interpreta|gram[áa]tic|literatura/.test(k)) return iluLivro;
  if (/direito|penal|constituc|processual|jur[íi]d|gavel|lei|c[óo]digo/.test(k)) return iluDireito;
  if (/policial|opera[cç][ãa]o|patrulha|abordagem|t[áa]tic|seguran[çc]a/.test(k)) return iluPolicial;
  return pickFallbackIlustracao(k);
}

/** Desenha cantoneiras estilo "L" nos quatro cantos da página (estilo Caveira) */
function drawCorners(pdf: jsPDF, pdfW: number, pdfH: number, m = 8, len = 14) {
  pdf.setDrawColor(160, 160, 160);
  pdf.setLineWidth(0.4);
  // top-left
  pdf.line(m, m, m + len, m);
  pdf.line(m, m, m, m + len);
  // top-right
  pdf.line(pdfW - m, m, pdfW - m - len, m);
  pdf.line(pdfW - m, m, pdfW - m, m + len);
  // bottom-left
  pdf.line(m, pdfH - m, m + len, pdfH - m);
  pdf.line(m, pdfH - m, m, pdfH - m - len);
  // bottom-right
  pdf.line(pdfW - m, pdfH - m, pdfW - m - len, pdfH - m);
  pdf.line(pdfW - m, pdfH - m, pdfW - m, pdfH - m - len);
}

/** Cabeçalho/rodapé com cantoneiras estilo Caveira (3 colunas no topo, marca + página + data no rodapé) */
function drawPageChrome(
  pdf: jsPDF,
  pdfW: number,
  pdfH: number,
  opts: {
    userName: string;
    userEmail: string;
    dataStr: string;
    marginX: number;
    footerH: number;
    pageNum?: number;
    pageLabel?: string;
    logoData?: { data: string; w: number; h: number } | null;
  },
) {
  // Delega para o chrome compartilhado "974 SAFO" (estilo Implacável Concursos).
  drawSafoChrome(pdf, pdfW, pdfH, {
    userName: opts.userName,
    userEmail: opts.userEmail,
    dataStr: opts.dataStr,
    pageNum: opts.pageNum,
    eyebrow: opts.pageLabel || "APOSTILA",
    logoData: opts.logoData ?? null,
  });
}

/** Carrega uma imagem importada e devolve um dataURL (necessário pro jsPDF.addImage) */
async function imgToDataURL(src: string): Promise<{ data: string; w: number; h: number }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Falha ao carregar imagem"));
  });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return { data: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight };
}

export default function Apostila() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [materia, setMateria] = useState(MATERIAS[0].nome);
  const [topico, setTopico] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [etapa, setEtapa] = useState("");
  const [previewAberto, setPreviewAberto] = useState(false);
  const [coverTheme, setCoverTheme] = useState<CoverThemeId>("gold");
  const [showLogo, setShowLogo] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [highlightMisalign, setHighlightMisalign] = useState(true);
  const [tituloCustom, setTituloCustom] = useState("");
  const [eyebrow, setEyebrow] = useState("APOSTILA · CFP · PM-PR");
  const [autorCustom, setAutorCustom] = useState("");
  const [autoSalvar, setAutoSalvar] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("apostila:auto-pdf") === "1";
  });
  const [revisando, setRevisando] = useState(false);
  const [revisarAntesPdf, setRevisarAntesPdf] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("apostila:revisar-pdf") !== "0";
  });
  useEffect(() => {
    try {
      localStorage.setItem("apostila:revisar-pdf", revisarAntesPdf ? "1" : "0");
    } catch {}
  }, [revisarAntesPdf]);

  // ===== Preferências de exportação do PDF =====
  const [pdfMargin, setPdfMargin] = useState<"compact" | "normal" | "wide">(() => {
    if (typeof window === "undefined") return "normal";
    const v = localStorage.getItem("apostila:pdf-margin");
    return v === "compact" || v === "wide" ? v : "normal";
  });
  const [pdfMode, setPdfMode] = useState<"conservador" | "compacto">(() => {
    if (typeof window === "undefined") return "conservador";
    return localStorage.getItem("apostila:pdf-mode") === "compacto" ? "compacto" : "conservador";
  });
  useEffect(() => {
    try { localStorage.setItem("apostila:pdf-margin", pdfMargin); } catch {}
  }, [pdfMargin]);
  useEffect(() => {
    try { localStorage.setItem("apostila:pdf-mode", pdfMode); } catch {}
  }, [pdfMode]);

  // Títulos que foram compactados na última exportação (texto normalizado).
  // Usado para marcar visualmente os headings correspondentes no preview.
  const [compactedTitles, setCompactedTitles] = useState<Set<string>>(new Set());

  // Aplica/remove marcadores visuais nos headings do preview que foram
  // compactados durante a última exportação. Permite revisar o resultado.
  useEffect(() => {
    const root = conteudoRef.current;
    if (!root) return;
    const norm = (s: string) => s
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    // Limpa marcadores anteriores
    root.querySelectorAll<HTMLElement>("[data-compacted='1']").forEach((el) => {
      el.removeAttribute("data-compacted");
      el.classList.remove("apostila-compactado");
      el.querySelector(".apostila-compactado-badge")?.remove();
    });
    if (compactedTitles.size === 0) return;
    root.querySelectorAll<HTMLElement>("h1, h2, h3").forEach((h) => {
      if (!compactedTitles.has(norm(h.textContent || ""))) return;
      h.dataset.compacted = "1";
      h.classList.add("apostila-compactado");
      const badge = document.createElement("span");
      badge.className = "apostila-compactado-badge";
      badge.textContent = "✂ compactado";
      badge.title = "Espaçamento superior reduzido para evitar página em branco";
      h.appendChild(badge);
    });
  }, [compactedTitles, conteudo]);
  // Override local da prévia da divisa (quando presente, pode divergir do spec).
  // O botão "Aplicar valores esperados" zera este override para restaurar a paridade.
  const [divisaOverride, setDivisaOverride] = useState<{
    mainWidthPct: number;
    mainTopPct: number;
    badgeWidthPct: number;
    badgeRightPct: number;
    badgeBottomPct: number;
    opacity?: number;
  } | null>(null);
  const divisaPreview = divisaOverride ?? {
    mainWidthPct: DIVISA_PREVIEW_PCT.main.widthPct,
    mainTopPct: DIVISA_PREVIEW_PCT.main.topPct,
    badgeWidthPct: DIVISA_PREVIEW_PCT.badge.widthPct,
    badgeRightPct: DIVISA_PREVIEW_PCT.badge.rightPct,
    badgeBottomPct: DIVISA_PREVIEW_PCT.badge.bottomPct,
  };
  // Recalcula a paridade a cada render — usado pelo aviso e pelo destaque visual.
  const divisaExpectedOpacity = divisaOpacityForTheme(coverTheme);
  const divisaPreviewOpacity = divisaOverride?.opacity ?? divisaExpectedOpacity;
  const divisaIssues = verifyDivisaParity({
    themeId: coverTheme,
    preview: { ...divisaPreview, opacity: divisaPreviewOpacity },
    pdf: {
      mainWidthMm: DIVISA_MAIN_MM.width,
      mainTopMm: DIVISA_MAIN_MM.topY,
      badgeWidthMm: DIVISA_BADGE_MM.width,
      badgeRightMm: DIVISA_BADGE_MM.marginRight,
      badgeBottomMm: DIVISA_BADGE_MM.marginBottom,
      opacity: divisaExpectedOpacity,
    },
  });
  const divisaMainMisaligned = divisaIssues.some((i) => i.startsWith("main."));
  const divisaBadgeMisaligned = divisaIssues.some((i) => i.startsWith("badge."));
  const showMisalignOverlay = highlightMisalign && divisaIssues.length > 0;
  // Renderiza o aviso de paridade. Recalculado a cada render — basta alterar
  // tema/opções da capa para ver o resultado atualizado, mesmo fora do diálogo.
  const renderParityAlert = () => {
    const opacity = divisaExpectedOpacity;
    const issues = divisaIssues;
    if (issues.length === 0) {
      return (
        <Alert className="mt-3 border-emerald-500/40 bg-emerald-500/5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <AlertTitle className="text-xs font-semibold text-emerald-500">
            Paridade verificada — divisa idêntica em prévia e PDF
          </AlertTitle>
          <AlertDescription className="text-[11px] text-muted-foreground">
            Tema <span className="font-mono">{coverTheme}</span> · principal {DIVISA_MAIN_MM.width}mm
            (≈{DIVISA_PREVIEW_PCT.main.widthPct.toFixed(2)}%) · selo {DIVISA_BADGE_MM.width}mm
            (≈{DIVISA_PREVIEW_PCT.badge.widthPct.toFixed(2)}%) · opacidade {opacity}
            {isLightTheme(coverTheme) ? " (claro)" : " (escuro)"}.
          </AlertDescription>
        </Alert>
      );
    }
    return (
      <Alert variant="destructive" className="mt-3">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="text-xs">
          Divergência de paridade — prévia ≠ PDF
        </AlertTitle>
        <AlertDescription className="mt-1 text-[11px]">
          Tema <span className="font-mono">{coverTheme}</span>: {issues.length} divergência(s)
          encontrada(s). Os valores abaixo precisam ser corrigidos para alinhar a prévia
          ao PDF (mm/% ou opacidade):
          <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono">
            {issues.map((i, k) => (
              <li key={k}>{i}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 gap-1.5 text-[11px]"
              onClick={() => {
                setDivisaOverride(null);
                toast.success("Paridade restaurada", {
                  description: `Valores esperados aplicados ao tema ${coverTheme}.`,
                });
              }}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Aplicar valores esperados
            </Button>
            <span className="text-[10px] opacity-80">
              Restaura mm↔% e opacidade {opacity} do spec central.
            </span>
          </div>
        </AlertDescription>
      </Alert>
    );
  };
  const conteudoRef = useRef<HTMLDivElement | null>(null);
  const jaExportadoRef = useRef(false);
  // Marca quando entramos via /materias?abrir=1 sem cache: ao terminar a
  // geração, abrimos a prévia automaticamente e rolamos até ela.
  const autoOpenAfterGenRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem("apostila:auto-pdf", autoSalvar ? "1" : "0");
    } catch {}
  }, [autoSalvar]);

  // Persiste o conteúdo gerado por usuário/matéria/tópico para reabertura rápida.
  // A chave inclui o user.id para isolar o cache entre contas no mesmo navegador,
  // e o payload guarda materia/topico/userId para validação ao ler.
  const CACHE_VERSION = 2;
  const normalize = (s: string) => s.trim().toLowerCase();
  const storageKey = (uid: string, mat: string, top: string) =>
    `apostila:cache:v${CACHE_VERSION}:${uid || "anon"}::${mat}::${normalize(top)}`;

  type CachePayload = {
    v: number;
    userId: string;
    materia: string;
    topico: string;
    conteudo: string;
    savedAt: number;
  };

  const readCache = (uid: string, mat: string, top: string): string | null => {
    try {
      const raw = localStorage.getItem(storageKey(uid, mat, top));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CachePayload>;
      // Validação estrita: versão, usuário, matéria e tópico devem casar exatamente.
      if (
        parsed?.v !== CACHE_VERSION ||
        parsed.userId !== (uid || "anon") ||
        parsed.materia !== mat ||
        normalize(parsed.topico ?? "") !== normalize(top) ||
        typeof parsed.conteudo !== "string" ||
        parsed.conteudo.trim().length === 0
      ) {
        return null;
      }
      return parsed.conteudo;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!conteudo) return;
    const uid = user?.id ?? "anon";
    try {
      const payload: CachePayload = {
        v: CACHE_VERSION,
        userId: uid,
        materia,
        topico: topico.trim(),
        conteudo,
        savedAt: Date.now(),
      };
      localStorage.setItem(storageKey(uid, materia, topico), JSON.stringify(payload));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteudo]);

  // Abre direto a prévia quando vindo de /materias com ?materia=...&abrir=1
  useEffect(() => {
    const m = searchParams.get("materia");
    const t = searchParams.get("topico") ?? "";
    const abrir = searchParams.get("abrir");
    if (m && MATERIAS.some((x) => x.nome === m)) {
      setMateria(m);
      setTopico(t);
      const uid = user?.id ?? "anon";
      const cached = readCache(uid, m, t);
      if (cached) {
        setConteudo(cached);
        if (abrir === "1") {
          setPreviewAberto(true);
          // Garante que a prévia entre em cena com scroll suave
          requestAnimationFrame(() => {
            conteudoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          toast.success("Apostila carregada do cache", {
            description: "Abrindo prévia para visualização e impressão.",
          });
        }
      } else {
        // Não há cache válido — se veio com abrir=1, dispara geração automática.
        setConteudo("");
        if (abrir === "1") {
          const tid = toast.loading("Gerando apostila pela primeira vez…", {
            description: `${m}${t ? " — " + t : ""}`,
          });
          // Marca para abrir prévia + scroll assim que terminar
          autoOpenAfterGenRef.current = true;
          // dispara geração em microtask (o estado já foi setado acima)
          queueMicrotask(() => {
            gerar()
              .finally(() => toast.dismiss(tid));
          });
        }
      }
      // limpa params para não reabrir ao navegar
      const next = new URLSearchParams(searchParams);
      next.delete("abrir");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Ao trocar matéria/tópico/usuário manualmente, recarrega cache válido (ou limpa).
  useEffect(() => {
    const uid = user?.id ?? "anon";
    const cached = readCache(uid, materia, topico);
    setConteudo(cached ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materia, topico, user?.id]);

  const gerar = async () => {
    setLoading(true); setConteudo("");
    jaExportadoRef.current = false;
    let buffer = "";
    try {
      await streamSSE("gerar-apostila", { materia, topico: topico.trim() || undefined }, (c) => {
        buffer += c;
        setConteudo((p) => p + c);
      });
      // Se veio da página de Matérias com ?abrir=1 e não havia cache, ao
      // terminar a geração: abrir prévia automaticamente e rolar até ela.
      if (autoOpenAfterGenRef.current && buffer.trim().length > 0) {
        autoOpenAfterGenRef.current = false;
        await new Promise<void>((res) =>
          requestAnimationFrame(() => requestAnimationFrame(() => res())),
        );
        setPreviewAberto(true);
        conteudoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        toast.success("Apostila pronta", {
          description: "Use Prévia & Download para ver ou imprimir.",
        });
      }
      // Auto-salvar PDF ao concluir o streaming
      if (autoSalvar && buffer.trim().length > 0 && !jaExportadoRef.current) {
        jaExportadoRef.current = true;
        setLoading(false);
        // Aguarda o React/Markdown pintar o conteúdo final no DOM
        await new Promise<void>((res) =>
          requestAnimationFrame(() => requestAnimationFrame(() => res()))
        );
        try {
          await exportarPDF();
          toast.success("PDF salvo automaticamente");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Falha ao salvar PDF automaticamente");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar apostila");
    } finally { setLoading(false); }
  };

  /** Revisa ortografia/consistência do markdown atual via edge function. */
  const revisarTexto = async (opts?: { silencioso?: boolean }): Promise<boolean> => {
    if (!conteudo.trim() || revisando) return false;
    setRevisando(true);
    const tid = opts?.silencioso
      ? toast.loading("Revisando ortografia…", { description: "Aplicando padrão culto PT-BR." })
      : toast.loading("Revisando texto…");
    try {
      const { conteudo: revisado } = await invokeFunction<{ conteudo: string }>(
        "revisar-apostila",
        { conteudo },
      );
      if (revisado && revisado.trim() && revisado !== conteudo) {
        setConteudo(revisado);
        toast.success("Texto revisado", { id: tid });
        return true;
      }
      toast.success("Sem alterações necessárias", { id: tid });
      return false;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao revisar", { id: tid });
      return false;
    } finally {
      setRevisando(false);
    }
  };

  const exportarPDF = async () => {
    if (!conteudoRef.current || !conteudo) return;
    // Revisão automática (se ligada). Aguarda pintar antes de capturar.
    if (revisarAntesPdf && !revisando) {
      const ok = await revisarTexto({ silencioso: true });
      if (ok) {
        await new Promise<void>((res) =>
          requestAnimationFrame(() => requestAnimationFrame(() => res())),
        );
      }
    }
    setExportando(true);
    setProgresso(2);
    setEtapa("Preparando layout…");
    const theme = COVER_THEMES[coverTheme];
    const tituloPDF = (tituloCustom.trim() || (topico.trim() || materia));
    const titulo = topico.trim() ? `${materia} — ${topico.trim()}` : materia;
    const dataStr = new Date().toLocaleDateString("pt-BR");
    const userEmail = user?.email ?? "";
    const userName =
      autorCustom.trim() ||
      (user?.user_metadata as { display_name?: string; full_name?: string } | undefined)
        ?.display_name ||
      (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
      (userEmail ? userEmail.split("@")[0] : "Aluno 974 SAFO");

    // Container offscreen — só o conteúdo
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    // Largura útil = 210mm − 2·marginX(15mm) = 180mm → 680px @ 96dpi
    // Assim o HTML é renderizado já no exato tamanho impresso, sem reflow.
    wrapper.style.width = "680px";
    wrapper.style.padding = "0";
    wrapper.style.boxSizing = "border-box";
    wrapper.style.background = "#ffffff";
    wrapper.style.color = "#080808";
    wrapper.style.fontFamily = "'Helvetica Neue', Arial, Helvetica, sans-serif";
    wrapper.style.fontSize = "15px";
    wrapper.style.lineHeight = "1.85";

    // ===== CSS de apresentação (callouts, accent bars, tabelas, ilustrações) =====
    const styleTag = document.createElement("style");
    styleTag.textContent = `
      .pdf-doc { color:#080808; }
      .pdf-doc * { box-sizing:border-box; max-width:100%; word-wrap:break-word; overflow-wrap:anywhere; }
      .pdf-doc h1 {
        font-size: 28px; font-weight: 900; letter-spacing:-.02em;
        color:#050505; margin: 34px 0 16px;
        padding: 18px 90px 18px 26px;
        background: linear-gradient(90deg, #f7ecbf 0%, #fffaea 60%, #fff 100%);
        border-left: 6px solid #c9a227;
        border-radius: 6px;
        box-shadow: 0 1px 0 #e6c769 inset, 0 6px 12px -8px rgba(201,162,39,.45);
        position: relative;
        page-break-after: avoid; break-inside: avoid;
      }
      .pdf-doc h1 .pdf-h1-ilu {
        position:absolute; right:14px; top:50%; transform: translateY(-50%);
        width: 60px; height:60px; opacity:.9;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.15));
      }
      .pdf-doc h2 {
        font-size: 21px; font-weight: 800; color:#0a0a0a;
        margin: 26px 0 12px; padding: 5px 0 9px 14px;
        border-bottom: 2px solid #e6c769;
        border-left: 4px solid #c9a227;
        page-break-after: avoid; break-inside: avoid;
        position: relative; padding-right: 40px;
      }
      .pdf-doc h2 .pdf-h2-ilu {
        position:absolute; right:6px; top:50%; transform: translateY(-50%);
        width: 28px; height:28px; opacity:.7;
      }
      .pdf-doc h3 {
        font-size: 16.5px; font-weight: 800; color:#3d2e00;
        margin: 18px 0 8px; text-transform: uppercase; letter-spacing:.05em;
        page-break-after: avoid; break-inside: avoid;
      }
      .pdf-doc p { margin: 0 0 12px; text-align: justify; hyphens: auto; color:#080808; }
      .pdf-doc strong {
        color: #050505; font-weight: 900;
      }
      /* Termo-chave: <strong> no início de parágrafo — apenas reforço tipográfico */
      .pdf-doc .key-term {
        color:#1a1a1a; font-weight: 900;
        letter-spacing:.01em; margin-right: 4px;
      }
      /* Caixa de definição: parágrafo iniciado por "Conceito:", "Definição:", etc. */
      .pdf-doc .def-box {
        background: linear-gradient(180deg,#fffaea,#fff5d2);
        border:1px solid #e6c769; border-left:5px solid #c9a227;
        border-radius:8px; padding:12px 14px; margin: 12px 0 14px;
        page-break-inside: avoid; break-inside: avoid;
        position: relative;
      }
      .pdf-doc .def-box::before {
        content: "📖 DEFINIÇÃO";
        position:absolute; top:-9px; left:12px;
        background:#c9a227; color:#1a1a1a;
        font-size: 9.5px; font-weight: 800; letter-spacing:.06em;
        padding: 2px 7px; border-radius: 3px;
      }
      .pdf-doc .alert-box {
        background:#fff2e6; border:1px solid #f0b070; border-left:5px solid #e07b00;
        border-radius:8px; padding:12px 14px 12px 40px; margin: 12px 0 14px;
        page-break-inside: avoid; break-inside: avoid;
        position: relative;
      }
      .pdf-doc .alert-box::before {
        content: "⚠"; position:absolute; left:12px; top:10px;
        font-size: 20px; color:#e07b00;
      }
      .pdf-doc .law-box {
        background:#eef2fb; border:1px solid #b8c6e8; border-left:5px solid #2c54a8;
        border-radius:8px; padding:12px 14px 12px 40px; margin: 12px 0 14px;
        page-break-inside: avoid; break-inside: avoid;
        position: relative; font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 12.5px; color:#1a2548;
      }
      .pdf-doc .law-box::before {
        content: "§"; position:absolute; left:14px; top:6px;
        font-size: 26px; color:#2c54a8; font-weight:900;
      }
      /* Pílula de número (mnemônicos / passos) */
      .pdf-doc ol.steps { list-style: none; padding-left: 0; counter-reset: step; }
      .pdf-doc ol.steps > li {
        counter-increment: step;
        position: relative; padding: 6px 6px 6px 38px;
        margin: 6px 0; border-radius: 6px;
        background: #faf7ee;
      }
      .pdf-doc ol.steps > li::before {
        content: counter(step);
        position:absolute; left:8px; top:50%; transform: translateY(-50%);
        width: 22px; height: 22px; border-radius: 50%;
        background:#c9a227; color:#1a1a1a;
        font-weight:900; font-size: 12px;
        display:flex; align-items:center; justify-content:center;
        box-shadow: 0 0 0 2px #fffaea, 0 0 0 3px #c9a227;
      }
      /* Tag inline (ex.: art. 121) */
      .pdf-doc .tag-art {
        display:inline-block; background:#eef2fb; color:#1a2548;
        border:1px solid #b8c6e8; border-radius: 10px;
        padding: 0 7px; font-size: .82em; font-weight: 700;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        margin: 0 2px;
      }
      .pdf-doc em { color:#0a0a0a; font-style: italic; font-weight: 600; }
      .pdf-doc mark { background:transparent; color:#050505; font-weight:700; }
      .pdf-doc ul, .pdf-doc ol { padding-left: 24px; margin: 10px 0 16px; }
      .pdf-doc li { margin: 6px 0; color:#080808; }
      .pdf-doc li::marker { color:#c9a227; font-weight:800; }
      .pdf-doc table {
        border-collapse: collapse; width:100%; margin: 14px 0 20px;
        font-size: 13px; page-break-inside: avoid; break-inside: avoid;
      }
      .pdf-doc th {
        background:#0a0a0a; color:#f5e8b8; text-align:left;
        padding:9px 11px; font-weight:800; letter-spacing:.02em; font-size:13px;
      }
      .pdf-doc td { padding:8px 11px; border-bottom:1px solid #d6d0c6; vertical-align: top; color:#080808; font-size:13px; }
      .pdf-doc tr:nth-child(even) td { background:#faf7ee; }

      .pdf-doc blockquote {
        margin: 12px 0; padding: 12px 14px 12px 16px;
        border-left: 4px solid #c9a227;
        background:#fbf6df;
        border-radius: 6px;
        page-break-inside: avoid; break-inside: avoid;
        box-shadow: 0 1px 0 rgba(0,0,0,.04);
      }
      .pdf-doc blockquote p { margin: 0; }
      .pdf-doc blockquote.callout-warn   { background:#fff2e6; border-left-color:#e07b00; }
      .pdf-doc blockquote.callout-tip    { background:#eef9f0; border-left-color:#3aa55b; }
      .pdf-doc blockquote.callout-law    { background:#eef2fb; border-left-color:#2c54a8; }
      .pdf-doc blockquote.callout-ok     { background:#eef9f0; border-left-color:#3aa55b; }
      .pdf-doc blockquote.callout-info   { background:#fff8e0; border-left-color:#c9a227; }

      .pdf-doc hr { border:none; border-top:1px dashed #c9a227; margin: 18px 0; }
      .pdf-doc code {
        background:#f3efe1; color:#7a5e0d; padding:1px 5px; border-radius:3px;
        font-size:.92em; font-family: ui-monospace, Menlo, Consolas, monospace;
      }
      .pdf-doc img { max-width:100%; height:auto; }
      .pdf-doc img, .pdf-doc figure {
        page-break-inside: avoid; break-inside: avoid;
      }
      .pdf-doc p, .pdf-doc li { orphans: 3; widows: 3; }
      .pdf-doc .wide-table-ref {
        background:#eef2fb; border:1px solid #b8c6e8; border-left:5px solid #2c54a8;
        border-radius:8px; padding:10px 14px; margin: 12px 0 14px;
        font-size: 12.5px; color:#1a2548;
        page-break-inside: avoid; break-inside: avoid;
      }
      .pdf-doc .wide-table-ref strong { color:#1a2548; font-weight:800; }
      .pdf-doc .wide-table-ref em { font-style: italic; color:#1a2548; }
    `;
    wrapper.appendChild(styleTag);

    const cloneConteudo = conteudoRef.current.cloneNode(true) as HTMLElement;
    cloneConteudo.classList.add("pdf-doc");
    cloneConteudo.style.color = "#111";
    // Remove qualquer prose dark do app (vamos pintar tudo via CSS .pdf-doc)
    cloneConteudo.querySelectorAll<HTMLElement>("[class*='prose']").forEach((el) => {
      el.removeAttribute("class");
    });
    // Limpa estilos inline herdados que poderiam vir escuros
    cloneConteudo.querySelectorAll<HTMLElement>("*").forEach((el) => {
      el.style.background = "transparent";
      el.style.color = "";
    });
    // Remove a TOC clicável da prévia (não precisamos no PDF)
    cloneConteudo.querySelector('nav[aria-label="Sumário"]')?.remove();
    // Remove badges visuais de "compactado" do clone — são apenas para o preview.
    cloneConteudo.querySelectorAll(".apostila-compactado-badge").forEach((b) => b.remove());
    cloneConteudo.querySelectorAll<HTMLElement>(".apostila-compactado").forEach((el) => {
      el.classList.remove("apostila-compactado");
      el.removeAttribute("data-compacted");
    });

    // ----- Detecta tipo de blockquote pelo conteúdo (emoji-based callouts) -----
    cloneConteudo.querySelectorAll<HTMLElement>("blockquote").forEach((bq) => {
      const t = (bq.textContent || "").trim();
      if (/^⚠️|Pegadinha|Atenção/i.test(t)) bq.classList.add("callout-warn");
      else if (/^💡|Exemplo|Dica/i.test(t)) bq.classList.add("callout-tip");
      else if (/^⚖️|STF|STJ|Súmula|Jurispr/i.test(t)) bq.classList.add("callout-law");
      else if (/^✅|Gabarito|Resposta/i.test(t)) bq.classList.add("callout-ok");
      else if (/^📌|📚|📖/i.test(t)) bq.classList.add("callout-info");
    });

    // ----- Realces extras para termos-chave e caixas especiais -----
    // 1) Caixas de Definição / Atenção / Lei a partir de prefixos no parágrafo
    cloneConteudo.querySelectorAll<HTMLParagraphElement>("p").forEach((p) => {
      const txt = (p.textContent || "").trim();
      if (/^(Definição|Conceito|Em síntese|Em resumo)\s*[:\-—]/i.test(txt)) {
        p.classList.add("def-box");
      } else if (/^(Importante|Atenção|Cuidado|Observação)\s*[:\-—]/i.test(txt)) {
        p.classList.add("alert-box");
      } else if (/^(Art\.?\s*\d+|Artigo\s*\d+|Súmula\s*\d+)/i.test(txt)) {
        p.classList.add("law-box");
      }
    });

    // 2) Termo-chave: <strong> no início absoluto do parágrafo/item vira badge
    cloneConteudo.querySelectorAll<HTMLElement>("li, p").forEach((el) => {
      if (el.classList.contains("def-box") || el.classList.contains("alert-box") || el.classList.contains("law-box")) return;
      const first = el.firstElementChild as HTMLElement | null;
      if (!first || first.tagName !== "STRONG") return;
      const txt = (first.textContent || "").trim();
      // Apenas termos curtos (até ~30 chars) viram badge
      if (txt.length === 0 || txt.length > 30) return;
      // Evita transformar quando já há ":" dentro do strong (provável frase inteira)
      if (/[.!?]$/.test(txt)) return;
      first.classList.add("key-term");
    });

    // 3) Tags inline para artigos de lei: "art. 121", "art 5º", "Súmula 711"
    cloneConteudo.querySelectorAll<HTMLElement>("p, li, td").forEach((el) => {
      if (el.classList.contains("law-box")) return;
      // Não mexer se contém HTML complexo já marcado
      if (el.querySelector(".tag-art")) return;
      const html = el.innerHTML;
      const novo = html.replace(
        /(?<![\w>])(art\.?\s*\d+[ºo]?(?:\s*,\s*[IVX]+)?|súmula\s*\d+|cf\/88|c[óo]digo\s+penal)/gi,
        '<span class="tag-art">$1</span>'
      );
      if (novo !== html) el.innerHTML = novo;
    });

    // 4) Listas ordenadas curtas (≤6 itens) com "passos" → estilo .steps
    cloneConteudo.querySelectorAll<HTMLOListElement>("ol").forEach((ol) => {
      const items = ol.querySelectorAll(":scope > li");
      if (items.length === 0 || items.length > 6) return;
      // Heurística: parent anterior é H2/H3 com palavras tipo "passos", "etapas", "como"
      const prev = ol.previousElementSibling;
      const cue = (prev?.textContent || "").toLowerCase();
      if (/passo|etapa|como|procediment|fase/.test(cue)) {
        ol.classList.add("steps");
      }
    });

    // 5) Tabelas largas — extraídas para apêndice em paisagem.
    // Critério: muitas colunas (>=5) OU palavras longas que estouram a largura.
    // Substituímos a tabela inline por uma "chamada" para o anexo.
    const wideTables: Array<{ html: string; titulo: string; index: number }> = [];
    cloneConteudo.querySelectorAll<HTMLTableElement>("table").forEach((tbl) => {
      const firstRow = tbl.querySelector("tr");
      const colCount = firstRow ? firstRow.children.length : 0;
      // Texto mais "denso" por célula sugere tabela larga
      let maxCellLen = 0;
      tbl.querySelectorAll("td, th").forEach((c) => {
        const t = (c.textContent || "").trim().length;
        if (t > maxCellLen) maxCellLen = t;
      });
      const isWide = colCount >= 5 || (colCount >= 4 && maxCellLen > 35);
      if (!isWide) return;

      // Tenta achar um título contextual (heading anterior mais próximo)
      let prevH: Element | null = tbl.previousElementSibling;
      while (prevH && !/^H[123]$/.test(prevH.tagName)) prevH = prevH.previousElementSibling;
      const titulo = (prevH?.textContent || "Tabela").trim().replace(/\s+/g, " ").slice(0, 80);

      const idx = wideTables.length + 1;
      wideTables.push({ html: tbl.outerHTML, titulo, index: idx });

      const ref = document.createElement("div");
      ref.className = "wide-table-ref";
      ref.innerHTML = `<strong>📐 Tabela ${idx} — ${titulo}</strong><span> · versão ampliada disponível no <em>Anexo (orientação paisagem)</em>, ao final desta apostila.</span>`;
      tbl.replaceWith(ref);
    });

    // ----- Insere ilustração temática contextual por capítulo/seção -----
    // A figura é escolhida pelo TEXTO de cada heading (caindo para matéria/tópico),
    // de modo que diferentes capítulos exibam ilustrações distintas conforme o tema.
    cloneConteudo.querySelectorAll<HTMLHeadingElement>("h1").forEach((h1) => {
      const headingText = (h1.textContent || "").trim();
      const img = document.createElement("img");
      img.src = pickIlustracao(materia, `${headingText} ${topico}`);
      img.className = "pdf-h1-ilu";
      img.alt = "";
      h1.appendChild(img);
    });
    // Também coloca uma pequena ilustração discreta ao lado de H2 quando o
    // texto do subtítulo bate com um tema específico distinto da matéria.
    cloneConteudo.querySelectorAll<HTMLHeadingElement>("h2").forEach((h2) => {
      const headingText = (h2.textContent || "").trim();
      const src = pickIlustracao(materia, headingText);
      // Só insere se a heurística achou algo específico ao texto do H2
      // (evita repetir a mesma figura genérica em todos os subtítulos).
      const fallback = pickIlustracao(materia, "");
      if (src === fallback) return;
      const img = document.createElement("img");
      img.src = src;
      img.className = "pdf-h2-ilu";
      img.alt = "";
      h2.appendChild(img);
    });

    // Captura headings para o sumário
    const headingsInfo: { el: HTMLElement; level: 1 | 2 | 3; text: string }[] = [];
    cloneConteudo.querySelectorAll<HTMLElement>("h1, h2, h3").forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const level = (tag === "h1" ? 1 : tag === "h2" ? 2 : 3) as 1 | 2 | 3;
        // Limpa emojis, símbolos diversos e marcadores comuns do texto da entrada
        const raw = (el.textContent || "").trim();
        const text = raw
          // Remove emojis (planos comuns) e pictogramas
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}]/gu, "")
          // Remove marcadores como "►", "●", "•", "▶", "→", "—" iniciais/finais
          .replace(/^[\s\-–—•●►▶→·#>*_]+/, "")
          .replace(/[\s\-–—•●►▶→·#>*_]+$/, "")
          // Espaços múltiplos
          .replace(/\s{2,}/g, " ")
          .trim();
      if (!text) return;
      headingsInfo.push({ el, level, text });
    });
    wrapper.appendChild(cloneConteudo);
    document.body.appendChild(wrapper);

    try {
      // Posição em px de cada heading (no DOM, antes do html2canvas)
      const wrapperTop = wrapper.getBoundingClientRect().top;
      const headingPositionsPx = headingsInfo.map((h) => {
        const rect = h.el.getBoundingClientRect();
        return { ...h, yPx: rect.top - wrapperTop };
      });
      let wrapperHeightPx = wrapper.offsetHeight;

      // ===== Boundaries "seguras" para corte de página =====
      // Coletamos posições onde é OK quebrar (final de blocos atômicos:
      // parágrafos, itens, blockquotes, tabelas, hr) e posições onde NÃO
      // se pode quebrar no meio (headings, blockquote, table, h1).
      const safeBreakYsPx: number[] = [0];
      const avoidRanges: Array<[number, number]> = [];
      // Rastreia separadamente blocos visuais "críticos" (figuras/tabelas)
      // para podermos avisar quando um corte ainda assim os atravessar.
      const criticalRanges: Array<{ kind: "figura" | "tabela"; top: number; bottom: number }> = [];
      const collectFrom = (sel: string, opts?: { atomic?: boolean; critical?: "figura" | "tabela" }) => {
        wrapper.querySelectorAll<HTMLElement>(sel).forEach((el) => {
          const r = el.getBoundingClientRect();
          const top = r.top - wrapperTop;
          const bottom = r.bottom - wrapperTop;
          if (opts?.atomic) avoidRanges.push([top, bottom]);
          if (opts?.critical) criticalRanges.push({ kind: opts.critical, top, bottom });
          safeBreakYsPx.push(bottom + 4); // logo após o elemento é zona segura
        });
      };
      collectFrom("p");
      collectFrom("li");
      collectFrom("hr");
      collectFrom("blockquote", { atomic: true });
      collectFrom("table", { atomic: true, critical: "tabela" });
      collectFrom("img", { atomic: true, critical: "figura" });
      collectFrom("figure", { atomic: true, critical: "figura" });
      collectFrom(".def-box", { atomic: true });
      collectFrom(".alert-box", { atomic: true });
      collectFrom(".law-box", { atomic: true });
      collectFrom("ol.steps", { atomic: true });

      // Headings: ficam "grudados" ao próximo bloco — evita órfão (título no
      // pé da página). O range atômico vai do topo do heading até o fim do
      // PRÓXIMO elemento irmão (ou ao menos +120px de respiro).
      wrapper.querySelectorAll<HTMLElement>("h1, h2, h3").forEach((el) => {
        const r = el.getBoundingClientRect();
        const top = r.top - wrapperTop;
        const next = el.nextElementSibling as HTMLElement | null;
        const bottom = next
          ? next.getBoundingClientRect().bottom - wrapperTop
          : r.bottom - wrapperTop + 120;
        avoidRanges.push([top, bottom]);
        safeBreakYsPx.push(r.bottom - wrapperTop + 4);
      });
      safeBreakYsPx.push(wrapperHeightPx);
      safeBreakYsPx.sort((a, b) => a - b);

      // ===== Compactação adaptativa de espaçamento =====
      // Antes do html2canvas (caro), simulamos a paginação usando apenas as
      // posições no DOM e estimamos quanto espaço sobra ao final de cada
      // página. Quando uma página termina com muito espaço em branco porque
      // um título h2/h3 foi empurrado para a próxima (órfão), reduzimos a
      // margem superior desse título e remedimos. Iteramos até 4 vezes.
      const ratioPxPerMM_DOM = 680 / (210 - 15 * 2); // wrapper 680px = 180mm
      const pageHeightDomPx = Math.floor((297 - 16 - 14) * ratioPxPerMM_DOM);
      const headings = Array.from(
        cloneConteudo.querySelectorAll<HTMLElement>("h1, h2, h3"),
      );
      const originalMarginTop = new Map<HTMLElement, string>();
      headings.forEach((h) => originalMarginTop.set(h, h.style.marginTop));

      const recomputeBoundaries = () => {
        const wt = wrapper.getBoundingClientRect().top;
        const safe: number[] = [0];
        const avoid: Array<[number, number]> = [];
        const collect = (sel: string, atomic = false) => {
          wrapper.querySelectorAll<HTMLElement>(sel).forEach((el) => {
            const r = el.getBoundingClientRect();
            const top = r.top - wt;
            const bottom = r.bottom - wt;
            if (atomic) avoid.push([top, bottom]);
            safe.push(bottom + 4);
          });
        };
        collect("p"); collect("li"); collect("hr");
        collect("blockquote", true); collect("table", true);
        collect("img", true); collect("figure", true);
        collect(".def-box", true); collect(".alert-box", true);
        collect(".law-box", true); collect("ol.steps", true);
        wrapper.querySelectorAll<HTMLElement>("h1, h2, h3").forEach((el) => {
          const r = el.getBoundingClientRect();
          const top = r.top - wt;
          const next = el.nextElementSibling as HTMLElement | null;
          const bottom = next
            ? next.getBoundingClientRect().bottom - wt
            : r.bottom - wt + 120;
          avoid.push([top, bottom]);
          safe.push(r.bottom - wt + 4);
        });
        safe.push(wrapper.offsetHeight);
        safe.sort((a, b) => a - b);
        return { safe, avoid, height: wrapper.offsetHeight };
      };

      const simulatePages = (
        safe: number[],
        avoid: Array<[number, number]>,
        totalH: number,
      ) => {
        const inside = (y: number) => avoid.some(([a, b]) => y > a && y < b);
        const cuts: number[] = [0];
        let cursor = 0;
        while (cursor < totalH) {
          const ideal = cursor + pageHeightDomPx;
          if (ideal >= totalH) { cuts.push(totalH); break; }
          const lower = cursor + Math.floor(pageHeightDomPx * 0.4);
          let best = -1;
          for (const y of safe) {
            if (y <= cursor) continue;
            if (y > ideal) break;
            if (y >= lower && !inside(y)) best = y;
          }
          const next = best > 0 ? best : ideal;
          cuts.push(next);
          cursor = next;
        }
        return cuts;
      };

      // Headings empurrados que criam grandes vazios no fim da página
      const findHeadingPushers = (cuts: number[]) => {
        const pushers: { el: HTMLElement; gapPx: number }[] = [];
        for (let i = 1; i < cuts.length; i++) {
          const pageStart = cuts[i - 1];
          const pageEnd = cuts[i];
          const used = pageEnd - pageStart;
          const gap = pageHeightDomPx - used;
          if (gap < pageHeightDomPx * 0.18) continue; // página razoavelmente cheia
          // procura heading cujo TOP está logo após pageEnd e cujo BOTTOM está
          // dentro da próxima página: candidato a ter sido empurrado
          const wt = wrapper.getBoundingClientRect().top;
          for (const h of headings) {
            const r = h.getBoundingClientRect();
            const top = r.top - wt;
            if (top >= pageEnd - 8 && top <= pageEnd + 80) {
              pushers.push({ el: h, gapPx: gap });
              break;
            }
          }
        }
        return pushers;
      };

      // Loop de compactação
      let { safe, avoid, height } = recomputeBoundaries();
      let cutsSim = simulatePages(safe, avoid, height);
      let paginasIniciais = cutsSim.length - 1;
      let paginasFinais = paginasIniciais;
      const ajustados: HTMLElement[] = [];
      // Modo conservador: zero passes (preserva o espaçamento original).
      // Modo compacto: até 4 passes, reduzindo margens de títulos órfãos.
      const maxPasses = pdfMode === "compacto" ? 4 : 0;
      for (let pass = 0; pass < maxPasses; pass++) {
        const pushers = findHeadingPushers(cutsSim);
        if (pushers.length === 0) break;
        for (const { el } of pushers) {
          const cs = window.getComputedStyle(el);
          const cur = parseFloat(cs.marginTop) || 0;
          // Reduz margem superior em até 70% (mínimo 4px)
          const novo = Math.max(4, Math.round(cur * 0.4));
          if (novo < cur - 1) {
            el.style.marginTop = `${novo}px`;
            ajustados.push(el);
          }
        }
        const r = recomputeBoundaries();
        safe = r.safe; avoid = r.avoid; height = r.height;
        cutsSim = simulatePages(safe, avoid, height);
        paginasFinais = cutsSim.length - 1;
        if (paginasFinais >= paginasIniciais && pass >= 1) break;
      }
      if (ajustados.length > 0) {
        console.info(
          `[Apostila] Compactação: ${paginasIniciais} → ${paginasFinais} páginas (${ajustados.length} títulos ajustados)`,
        );
      }
      // Expõe os títulos ajustados para marcação visual no preview.
      const normTitle = (s: string) => s
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      const ajustadosTextos = new Set(
        ajustados.map((el) => normTitle(el.textContent || "")).filter(Boolean),
      );
      setCompactedTitles(ajustadosTextos);
      // Atualiza arrays usados pelo restante do fluxo (já refletem o estado final)
      safeBreakYsPx.length = 0;
      safeBreakYsPx.push(...safe);
      avoidRanges.length = 0;
      avoidRanges.push(...avoid);
      // Recalcula posições dos headings (usadas no Sumário) após compactação
      const wrapperTopFinal = wrapper.getBoundingClientRect().top;
      headingPositionsPx.forEach((h) => {
        h.yPx = h.el.getBoundingClientRect().top - wrapperTopFinal;
      });
      wrapperHeightPx = wrapper.offsetHeight;

      setEtapa("Renderizando conteúdo…");
      setProgresso(15);
      const canvas = await html2canvas(wrapper, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        imageTimeout: 10000,
      });
      setProgresso(40);
      setEtapa("Calculando paginação…");

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();   // 210
      const pdfH = pdf.internal.pageSize.getHeight();  // 297

      // Margens em mm — escolhidas pelo usuário (compact/normal/wide).
      const marginX = pdfMargin === "compact" ? 10 : pdfMargin === "wide" ? 20 : 15;
      // Reservas para o chrome compartilhado "974 SAFO" (header 22mm + filete + respiro;
      // footer 14mm + filete + respiro). Mantemos o seletor compact/normal para o respiro.
      const headerH = pdfMargin === "compact" ? 26 : 28;
      const footerH = pdfMargin === "compact" ? 18 : 20;
      const contentTopMM = headerH;
      const contentH_MM = pdfH - headerH - footerH;
      const contentW_MM = pdfW - marginX * 2;

      // Conversões mm <-> px do canvas
      const pxPerMM = canvas.width / contentW_MM;
      const pageHeightPx = Math.floor(contentH_MM * pxPerMM);
      // Escala DOM(px) -> canvas(px)
      const domToCanvas = canvas.height / wrapperHeightPx;
      // Converte boundaries DOM -> canvas px
      const safeBreaksCanvas = safeBreakYsPx.map((y) => Math.round(y * domToCanvas));
      const avoidRangesCanvas: Array<[number, number]> = avoidRanges.map(
        ([a, b]) => [Math.round(a * domToCanvas), Math.round(b * domToCanvas)],
      );
      const isInsideAtomic = (y: number): [number, number] | null => {
        for (const [a, b] of avoidRangesCanvas) {
          if (y > a && y < b) return [a, b];
        }
        return null;
      };

      // Pré-calcula brilho médio por linha pra detectar cortes "em branco"
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const lineLuma = new Float32Array(canvas.height);
      if (ctx) {
        const chunk = 1024;
        for (let y0 = 0; y0 < canvas.height; y0 += chunk) {
          const h = Math.min(chunk, canvas.height - y0);
          const data = ctx.getImageData(0, y0, canvas.width, h).data;
          for (let y = 0; y < h; y++) {
            let sum = 0;
            const rowOff = y * canvas.width * 4;
            for (let x = 0; x < canvas.width; x += 8) {
              const i = rowOff + x * 4;
              sum += data[i] + data[i + 1] + data[i + 2];
            }
            lineLuma[y0 + y] = sum;
          }
        }
      }

      const findCutLine = (idealEnd: number, minStart: number): number => {
        // 1) Tenta um safe break (final de elemento atômico) próximo do ideal
        const maxBack = Math.floor(pageHeightPx * 0.35); // pode voltar até 35% da página
        const lowerBound = Math.max(minStart + Math.floor(pageHeightPx * 0.4), idealEnd - maxBack);
        let bestSafe = -1;
        for (const y of safeBreaksCanvas) {
          if (y <= minStart) continue;
          if (y > idealEnd) break;
          // Não pode cair dentro de um bloco atômico
          if (y >= lowerBound && !isInsideAtomic(y)) bestSafe = y;
        }
        if (bestSafe > 0) return bestSafe;

        // 2) Se não houver safe break aceitável, evita cortar dentro de elementos atômicos:
        // recua até o início do elemento atômico que cobre idealEnd.
        const inside = isInsideAtomic(idealEnd);
        if (inside) {
          const startOfAtomic = inside[0];
          const atomicH = inside[1] - inside[0];
          // Se o bloco atômico for MAIOR que uma página inteira, não dá para
          // empurrar — corta na linha mais branca (fallback abaixo).
          if (atomicH < pageHeightPx - 20 && startOfAtomic > minStart + Math.floor(pageHeightPx * 0.25)) {
            return startOfAtomic;
          }
        }

        // 3) Fallback: linha mais "branca" próxima do ideal
        const window = Math.min(160, Math.floor(pageHeightPx * 0.1));
        const lo = Math.max(minStart + 1, idealEnd - window);
        const hi = Math.min(canvas.height, idealEnd);
        if (!ctx || hi <= lo) return idealEnd;
        let bestY = idealEnd;
        let bestVal = -1;
        for (let y = hi - 1; y >= lo; y--) {
          const v = lineLuma[y];
          if (v > bestVal) { bestVal = v; bestY = y; }
        }
        return bestY;
      };

      // Calcula cuts (uma vez)
      const cuts: number[] = [0];
      {
        let cursor = 0;
        while (cursor < canvas.height) {
          const ideal = cursor + pageHeightPx;
          if (ideal >= canvas.height) { cuts.push(canvas.height); break; }
          const cut = findCutLine(ideal, cursor);
          const next = cut > cursor + 50 ? cut : cursor + pageHeightPx;
          cuts.push(next);
          cursor = next;
        }
      }
      const totalPaginasConteudo = cuts.length - 1;

      // ===== Detecção de figuras/tabelas cortadas =====
      // Converte os cortes (em px de canvas) para px do DOM original e checa
      // se algum range crítico é atravessado por uma linha de quebra.
      const canvasToDom = wrapperHeightPx / canvas.height;
      const offsetPaginasPreview = 3; // capa + contracapa + sumário
      const cortesDetectados: Array<{ pagina: number; tipo: "figura" | "tabela"; alturaMM: number }> = [];
      for (let i = 1; i < cuts.length; i++) {
        const cutDom = cuts[i] * canvasToDom;
        for (const cr of criticalRanges) {
          // Margem de 2px para tolerar arredondamento
          if (cutDom > cr.top + 2 && cutDom < cr.bottom - 2) {
            cortesDetectados.push({
              pagina: offsetPaginasPreview + i, // página final do PDF onde o corte ocorre
              tipo: cr.kind,
              alturaMM: Math.round((cr.bottom - cr.top) / pxPerMM),
            });
          }
        }
      }
      if (cortesDetectados.length > 0) {
        const resumo = cortesDetectados
          .slice(0, 4)
          .map((c) => `${c.tipo} (~${c.alturaMM}mm) na p.${c.pagina}`)
          .join(" · ");
        const extra = cortesDetectados.length > 4 ? ` (+${cortesDetectados.length - 4})` : "";
        toast.warning("Possíveis cortes detectados no PDF", {
          description: `${cortesDetectados.length} bloco(s) atravessam quebras de página: ${resumo}${extra}.`,
          duration: 9000,
        });
        console.warn("[Apostila] Cortes detectados:", cortesDetectados);
      }

      setProgresso(55);
      setEtapa("Montando capa e sumário…");

      // ===== Carrega capas/logos =====
      let logoData: { data: string; w: number; h: number } | null = null;
      try {
        logoData = await imgToDataURL(logo974);
      } catch { /* segue sem capa rica */ }
      let iluData: { data: string; w: number; h: number } | null = null;
      try {
        iluData = await imgToDataURL(pickIlustracao(materia, topico));
      } catch { /* sem ilustração */ }
      // Símbolo da capa: usa a ilustração temática da matéria/tópico
      const simboloData = iluData;

      // Mapa heading -> página final no PDF
      const offsetPaginas = 3; // capa + contracapa + sumário
      // Filtra: somente H1/H2 no sumário, remove duplicatas e seções vazias
      const seenToc = new Set<string>();
      const toc: TocEntry[] = headingPositionsPx
        .filter((h) => h.level <= 2)
        .filter((h) => {
          const key = `${h.level}::${h.text.toLowerCase()}`;
          if (seenToc.has(key)) return false;
          seenToc.add(key);
          return true;
        })
        .map((h) => {
        const yCanvas = h.yPx * domToCanvas;
        let pageIdx = totalPaginasConteudo - 1;
        for (let i = 0; i < cuts.length - 1; i++) {
          if (yCanvas >= cuts[i] && yCanvas < cuts[i + 1]) { pageIdx = i; break; }
        }
        return { level: h.level, text: h.text, pageInPdf: pageIdx + 1 + offsetPaginas };
      });

      // ============ PÁGINA 1: CAPA EDITORIAL (tema dinâmico) ============
      const isLight = theme.id === "marble";
      pdf.setFillColor(...theme.bg);
      pdf.rect(0, 0, pdfW, pdfH, "F");

      // Painel lateral esquerdo (acento)
      pdf.setFillColor(...theme.accent);
      pdf.rect(0, 0, 6, pdfH, "F");
      pdf.setFillColor(...theme.accentDark);
      pdf.rect(6, 0, 1.5, pdfH, "F");

      // Textura sutil de pontos
      const dotShade: [number, number, number] = isLight ? [220, 215, 200] : [35, 38, 46];
      pdf.setFillColor(...dotShade);
      for (let gx = 20; gx < pdfW - 14; gx += 6) {
        for (let gy = 22; gy < pdfH - 60; gy += 6) {
          pdf.circle(gx, gy, 0.18, "F");
        }
      }

      // Cantoneiras (estilo Caveira)
      pdf.setDrawColor(isLight ? 60 : 220, isLight ? 60 : 220, isLight ? 60 : 220);
      pdf.setLineWidth(0.5);
      const m = 10, len = 22;
      pdf.line(m, m, m + len, m); pdf.line(m, m, m, m + len);
      pdf.line(pdfW - m, m, pdfW - m - len, m); pdf.line(pdfW - m, m, pdfW - m, m + len);
      pdf.line(m, pdfH - m, m + len, pdfH - m); pdf.line(m, pdfH - m, m, pdfH - m - len);
      pdf.line(pdfW - m, pdfH - m, pdfW - m - len, pdfH - m); pdf.line(pdfW - m, pdfH - m, pdfW - m, pdfH - m - len);

      // Marca topo-esquerda
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...theme.text);
      pdf.text("974 SAFO", 20, 22);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...theme.muted);
      pdf.text("PLATAFORMA DE ESTUDOS · CFP/PM-PR", 20, 27);

      // Identificador de volume (canto superior direito)
      pdf.setDrawColor(...theme.accent);
      pdf.setLineWidth(0.3);
      pdf.line(pdfW - 60, 22, pdfW - 20, 22);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...theme.muted);
      pdf.text("VOLUME ÚNICO", pdfW - 20, 27, { align: "right" });
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(...theme.accent);
      pdf.text(dataStr, pdfW - 20, 32, { align: "right" });

      // Símbolo oficial (divisa PMPR) grande à direita, em auto-relevo
      const simboloCapa = simboloData || iluData;
      if (simboloCapa && showWatermark) {
        try {
          const divisaOpacity = divisaOpacityForTheme(theme.id);
          const gs = (pdf as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState
            ? new (pdf as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: divisaOpacity })
            : null;
          if (gs && (pdf as unknown as { setGState?: (g: unknown) => void }).setGState) {
            (pdf as unknown as { setGState: (g: unknown) => void }).setGState(gs);
          }
          const ratio = simboloCapa.h / simboloCapa.w;
          // Spec central: src/lib/coverDivisaSpec.ts (single source of truth)
          const big = DIVISA_MAIN_MM.width;
          const bigH = big * ratio;
          const bigX = (pdfW - big) / 2;
          const bigY = DIVISA_MAIN_MM.topY;
          pdf.addImage(simboloCapa.data, "PNG", bigX, bigY, big, bigH);
          const gsR = (pdf as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState
            ? new (pdf as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 1 })
            : null;
          if (gsR && (pdf as unknown as { setGState?: (g: unknown) => void }).setGState) {
            (pdf as unknown as { setGState: (g: unknown) => void }).setGState(gsR);
          }
          // Selo nítido no rodapé direito
          const sw = DIVISA_BADGE_MM.width;
          const sh = sw * ratio;
          pdf.addImage(
            simboloCapa.data,
            "PNG",
            pdfW - sw - DIVISA_BADGE_MM.marginRight,
            pdfH - sh - DIVISA_BADGE_MM.marginBottom,
            sw,
            sh,
          );
        } catch { /* ignore */ }
      }

      // Bloco de título (à esquerda, sobre fundo escuro com barra dourada)
      const titleX = 20;
      const titleTop = pdfH * 0.42;

      // Eyebrow / categoria
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...theme.accent);
      pdf.text((eyebrow || "APOSTILA · CFP · PM-PR").toUpperCase(), titleX, titleTop - 14);

      // Barra fina dourada antes do título
      pdf.setDrawColor(...theme.accent);
      pdf.setLineWidth(0.8);
      pdf.line(titleX, titleTop - 8, titleX + 18, titleTop - 8);

      // Título principal grande
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(36);
      pdf.setTextColor(...theme.text);
      const tituloLines = pdf.splitTextToSize(tituloPDF.toUpperCase(), pdfW - 50);
      pdf.text(tituloLines, titleX, titleTop);
      const baseY = titleTop + tituloLines.length * 12 + 2;

      // Subtítulo (matéria) se houver tópico
      if (topico.trim() && tituloCustom.trim() === "") {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(...theme.muted);
        pdf.text(materia.toUpperCase(), titleX, baseY + 6);
      }

      // Linha de assinatura dourada
      pdf.setDrawColor(...theme.accent);
      pdf.setLineWidth(0.4);
      pdf.line(titleX, pdfH - 62, pdfW - 20, pdfH - 62);

      // Bloco de identificação inferior (3 colunas: aluno · curso · data)
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...theme.muted);
      pdf.text("ALUNO", titleX, pdfH - 54);
      pdf.text("CURSO", pdfW / 2 - 10, pdfH - 54);
      pdf.text("EMISSÃO", pdfW - 20, pdfH - 54, { align: "right" });

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...theme.text);
      pdf.text(userName, titleX, pdfH - 47);
      pdf.text("CFP · PM-PR", pdfW / 2 - 10, pdfH - 47);
      pdf.text(dataStr, pdfW - 20, pdfH - 47, { align: "right" });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...theme.muted);
      if (userEmail) pdf.text(userEmail, titleX, pdfH - 41);
      pdf.text("Material protegido por lei · Conteúdo gerado por IA", pdfW / 2 - 10, pdfH - 41);

      // Marca / logo no rodapé (canto inferior ESQUERDO — longe do selo da divisa)
      if (logoData && showLogo) {
        const ratio = logoData.h / logoData.w;
        const sz = 16;
        pdf.addImage(logoData.data, "PNG", titleX, pdfH - sz - 16, sz, sz * ratio);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...theme.muted);
        pdf.text("974SAFO.COM", titleX + sz + 4, pdfH - 22);
      } else {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...theme.muted);
        pdf.text("974SAFO.COM", titleX, pdfH - 22);
      }

      // ============ PÁGINA 2: CONTRACAPA (institucional) ============
      pdf.addPage();
      // ---- Mantém a identidade visual da CAPA ----
      pdf.setFillColor(...theme.bg);
      pdf.rect(0, 0, pdfW, pdfH, "F");
      // Painel lateral de acento (espelhado à direita p/ diferenciar da capa)
      pdf.setFillColor(...theme.accent);
      pdf.rect(pdfW - 6, 0, 6, pdfH, "F");
      pdf.setFillColor(...theme.accentDark);
      pdf.rect(pdfW - 7.5, 0, 1.5, pdfH, "F");

      // Textura de pontos idêntica à capa
      pdf.setFillColor(...dotShade);
      for (let gx = 14; gx < pdfW - 20; gx += 6) {
        for (let gy = 22; gy < pdfH - 60; gy += 6) {
          pdf.circle(gx, gy, 0.18, "F");
        }
      }

      // Cantoneiras
      pdf.setDrawColor(isLight ? 60 : 220, isLight ? 60 : 220, isLight ? 60 : 220);
      pdf.setLineWidth(0.5);
      const m2 = 10, len2 = 22;
      pdf.line(m2, m2, m2 + len2, m2); pdf.line(m2, m2, m2, m2 + len2);
      pdf.line(pdfW - m2, m2, pdfW - m2 - len2, m2); pdf.line(pdfW - m2, m2, pdfW - m2, m2 + len2);
      pdf.line(m2, pdfH - m2, m2 + len2, pdfH - m2); pdf.line(m2, pdfH - m2, m2, pdfH - m2 - len2);
      pdf.line(pdfW - m2, pdfH - m2, pdfW - m2 - len2, pdfH - m2); pdf.line(pdfW - m2, pdfH - m2, pdfW - m2, pdfH - m2 - len2);

      // Divisa em marca d'água (suave, centralizada no topo)
      if (simboloCapa && showWatermark) {
        try {
          const gs = (pdf as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState
            ? new (pdf as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: isLight ? 0.05 : 0.08 })
            : null;
          if (gs && (pdf as unknown as { setGState?: (g: unknown) => void }).setGState) {
            (pdf as unknown as { setGState: (g: unknown) => void }).setGState(gs);
          }
          const ratio = simboloCapa.h / simboloCapa.w;
          const w = 110;
          pdf.addImage(simboloCapa.data, "PNG", (pdfW - w) / 2, 38, w, w * ratio);
          const gsR = (pdf as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState
            ? new (pdf as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 1 })
            : null;
          if (gsR && (pdf as unknown as { setGState?: (g: unknown) => void }).setGState) {
            (pdf as unknown as { setGState: (g: unknown) => void }).setGState(gsR);
          }
        } catch { /* ignore */ }
      }

      // Marca topo-esquerda (igual à capa)
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...theme.text);
      pdf.text("974 SAFO", 20, 22);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...theme.muted);
      pdf.text("PLATAFORMA DE ESTUDOS · CFP/PM-PR", 20, 27);

      // Selo de página
      pdf.setDrawColor(...theme.accent);
      pdf.setLineWidth(0.3);
      pdf.line(pdfW - 60, 22, pdfW - 20, 22);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...theme.muted);
      pdf.text("CONTRACAPA · APRESENTAÇÃO", pdfW - 20, 27, { align: "right" });

      // Eyebrow + título central
      const cTitleY = 96;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...theme.accent);
      pdf.text("SOBRE ESTA APOSTILA", marginX, cTitleY);
      pdf.setDrawColor(...theme.accent);
      pdf.setLineWidth(0.8);
      pdf.line(marginX, cTitleY + 3, marginX + 18, cTitleY + 3);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(...theme.text);
      const cTituloLines = pdf.splitTextToSize(tituloPDF.toUpperCase(), pdfW - marginX * 2);
      pdf.text(cTituloLines, marginX, cTitleY + 14);
      let yC = cTitleY + 14 + cTituloLines.length * 9 + 4;

      // Texto institucional
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...((isLight ? [60, 60, 60] : [210, 210, 210]) as [number, number, number]));
      const intro = `Este material foi elaborado pela plataforma 974 SAFO para apoiar candidatos do CFP da PM-PR no estudo de ${titulo}. O conteúdo é gerado com auxílio de inteligência artificial, revisado conforme a doutrina, a legislação vigente e o estilo da banca NC-UFPR, com foco em clareza, profundidade e retenção.`;
      const introLines = pdf.splitTextToSize(intro, pdfW - marginX * 2);
      pdf.text(introLines, marginX, yC);
      yC += introLines.length * 5.6 + 8;

      // Como estudar — caixas compactas
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...theme.accent);
      pdf.text("COMO APROVEITAR AO MÁXIMO", marginX, yC);
      yC += 6;

      const passos: Array<[string, string]> = [
        ["1. Leia ativamente", "Sublinhe os termos em negrito, escreva pequenas anotações na margem e refaça os mnemônicos com suas próprias palavras."],
        ["2. Resolva as questões", "Antes de ver o gabarito, tente responder. Em seguida, leia o comentário e relacione com o artigo de lei citado."],
        ["3. Revise em ciclos", "Volte ao Quadro-Resumo e aos Pontos-chave a cada 7 dias. Repetição espaçada fixa o conteúdo na memória de longo prazo."],
      ];
      for (const [t, d] of passos) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(...theme.text);
        pdf.text(t, marginX, yC);
        yC += 4.5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        pdf.setTextColor(...((isLight ? [80, 80, 80] : [180, 180, 180]) as [number, number, number]));
        const dl = pdf.splitTextToSize(d, pdfW - marginX * 2 - 4);
        pdf.text(dl, marginX + 2, yC);
        yC += dl.length * 4.8 + 3;
      }

      // Legenda dos callouts
      yC += 4;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...theme.accent);
      pdf.text("LEGENDA DOS DESTAQUES", marginX, yC);
      yC += 6;
      const legend: Array<[string, string, [number, number, number]]> = [
        ["💡 Exemplo", "Aplicação prática no policiamento ostensivo.", [58, 165, 91]],
        ["⚠️ Pegadinha", "Detalhe da banca que costuma derrubar candidatos.", [224, 123, 0]],
        ["⚖️ STF/STJ", "Jurisprudência ou súmula relevante para a prova.", [44, 84, 168]],
        ["✅ Gabarito", "Resposta correta com fundamentação completa.", [58, 165, 91]],
        ["📌 Apresentação", "Visão geral e contextualização do tema.", [201, 162, 39]],
      ];
      for (const [tag, desc, cor] of legend) {
        pdf.setFillColor(...cor);
        pdf.rect(marginX, yC - 3, 1.6, 4.2, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(...cor);
        pdf.text(tag, marginX + 4, yC);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(...((isLight ? [70, 70, 70] : [200, 200, 200]) as [number, number, number]));
        pdf.text(desc, marginX + 36, yC);
        yC += 6;
      }

      // ---- Bloco de CRÉDITOS / FICHA TÉCNICA ----
      yC += 6;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...theme.accent);
      pdf.text("FICHA TÉCNICA & CRÉDITOS", marginX, yC);
      yC += 6;

      const credCol1X = marginX;
      const credCol2X = pdfW / 2 + 4;
      const labelColor: [number, number, number] = isLight ? [120, 120, 120] : [150, 150, 150];
      const valueColor: [number, number, number] = isLight ? [40, 40, 40] : [230, 230, 230];
      const creditos: Array<[string, string, "L" | "R"]> = [
        ["EDIÇÃO", "974 SAFO · Plataforma de Estudos", "L"],
        ["CURSO", "CFP · Polícia Militar do Paraná", "R"],
        ["MATÉRIA", materia, "L"],
        ["TÓPICO", topico || "Volume completo", "R"],
        ["ALUNO", userName, "L"],
        ["E-MAIL", userEmail || "—", "R"],
        ["EMISSÃO", dataStr, "L"],
        ["VERSÃO", "1.0 · IA + revisão humana", "R"],
      ];
      const startY = yC;
      let yL = startY;
      let yR = startY;
      const maxCredY = pdfH - 42; // não invadir o rodapé/aviso legal
      for (const [label, value, side] of creditos) {
        const x = side === "L" ? credCol1X : credCol2X;
        const yy = side === "L" ? yL : yR;
        if (yy > maxCredY) continue;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(...labelColor);
        pdf.text(label, x, yy);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(...valueColor);
        const v = pdf.splitTextToSize(value, pdfW / 2 - marginX - 6);
        pdf.text(v, x, yy + 4);
        const consumed = 4 + v.length * 4.2 + 2.5;
        if (side === "L") yL += consumed; else yR += consumed;
      }
      yC = Math.max(yL, yR) + 2;

      // ---- Epígrafe motivacional (entre créditos e rodapé) ----
      const epigrafes = [
        ["A disciplina é a alma do exército; faz com que pequenos números pareçam formidáveis.", "George Washington"],
        ["A glória maior não está em jamais cair, mas em sempre se levantar.", "Confúcio"],
        ["Servir e proteger não é profissão, é vocação.", "Doutrina PM"],
        ["O conhecimento é a única arma que ninguém pode tirar do soldado.", "Provérbio militar"],
        ["A excelência não é um ato, é um hábito.", "Aristóteles"],
      ];
      const epIdx = hashString(`${materia}${topico ?? ""}`) % epigrafes.length;
      const [epTexto, epAutor] = epigrafes[epIdx];
      if (yC < pdfH - 60) {
        const epY = Math.max(yC + 4, pdfH - 58);
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(10);
        pdf.setTextColor(...((isLight ? [70, 70, 70] : [200, 200, 200]) as [number, number, number]));
        const epLines = pdf.splitTextToSize(`"${epTexto}"`, pdfW - marginX * 2 - 16);
        pdf.text(epLines, pdfW / 2, epY, { align: "center" });
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...theme.accent);
        pdf.text(`— ${epAutor}`, pdfW / 2, epY + epLines.length * 4.6 + 2, { align: "center" });
      }

      // Rodapé contracapa: aviso legal + assinatura
      pdf.setDrawColor(...theme.accent);
      pdf.setLineWidth(0.4);
      pdf.line(marginX, pdfH - 36, pdfW - marginX, pdfH - 36);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(...((isLight ? [120, 120, 120] : [160, 160, 160]) as [number, number, number]));
      const aviso = "AVISO: material de apoio gerado por IA. Sempre confira a redação original dos dispositivos legais e súmulas em fontes oficiais (Planalto, STF, STJ, PM-PR).";
      const avisoLines = pdf.splitTextToSize(aviso, pdfW - marginX * 2);
      pdf.text(avisoLines, marginX, pdfH - 30);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...theme.accent);
      pdf.text("974SAFO.COM · CFP/PM-PR", marginX, pdfH - 14);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...theme.muted);
      pdf.text(dataStr, pdfW - marginX, pdfH - 14, { align: "right" });

      // ============ PÁGINA 3: SUMÁRIO ============
      pdf.addPage();
      drawPageChrome(pdf, pdfW, pdfH, {
        userName, userEmail, dataStr, marginX, footerH,
        pageLabel: "Sumário",
        logoData,
      });

      // ===== Cabeçalho do Sumário =====
      // Eyebrow dourado
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(201, 162, 39);
      pdf.text("ÍNDICE GERAL · 974 SAFO", marginX, 30);

      // Título
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(28);
      pdf.setTextColor(20, 20, 20);
      pdf.text("SUMÁRIO", marginX, 42);

      // Subtítulo (matéria/tópico do material)
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(120, 120, 120);
      const subt = (topico.trim() ? `${materia} — ${topico.trim()}` : materia);
      pdf.text(subt, marginX, 49);

      // Linha dourada divisora
      pdf.setDrawColor(201, 162, 39);
      pdf.setLineWidth(0.8);
      pdf.line(marginX, 54, pdfW - marginX, 54);

      // Cabeçalho de colunas
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(140, 140, 140);
      pdf.text("SEÇÃO", marginX, 60);
      pdf.text("PÁG.", pdfW - marginX, 60, { align: "right" });

      // Lista
      let yToc = 70;
      let h1Count = 0;
      let h2Count = 0;
      if (toc.length === 0) {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(11);
        pdf.setTextColor(120, 120, 120);
        pdf.text("Esta apostila não possui seções com títulos.", marginX, yToc);
      } else {
        for (const entry of toc) {
          // Quebra de página automática no sumário
          if (yToc > pdfH - 22) {
            pdf.addPage();
            drawPageChrome(pdf, pdfW, pdfH, {
              userName, userEmail, dataStr, marginX, footerH,
              pageLabel: "Sumário (cont.)",
              logoData,
            });
            yToc = 30;
          }

          const isH1 = entry.level === 1;
          const isH2 = entry.level === 2;

          // Numeração hierárquica (1., 1.1, 1.1.1)
          if (isH1) { h1Count++; h2Count = 0; }
          else if (isH2) { h2Count++; }
          const numLabel = isH1
            ? `${h1Count}.`
            : isH2
              ? `${h1Count}.${h2Count}`
              : `   •`;

          // Espaço extra acima de capítulos H1
          if (isH1 && yToc > 70) yToc += 4;

          // Faixa de fundo sutil para H1
          if (isH1) {
            pdf.setFillColor(248, 244, 230);
            pdf.rect(marginX - 2, yToc - 5, pdfW - marginX * 2 + 4, 8, "F");
            pdf.setFillColor(201, 162, 39);
            pdf.rect(marginX - 2, yToc - 5, 1.5, 8, "F");
          }

          const indent = isH1 ? 0 : isH2 ? 8 : 16;
          const x = marginX + indent;
          const fontSize = isH1 ? 11 : isH2 ? 10 : 9;
          pdf.setFont("helvetica", isH1 ? "bold" : isH2 ? "normal" : "normal");
          pdf.setFontSize(fontSize);
          const cor = isH1 ? 25 : isH2 ? 70 : 110;
          pdf.setTextColor(cor, cor, cor);

          // Numeração à esquerda
          pdf.setFont("helvetica", isH1 ? "bold" : "normal");
          pdf.setTextColor(isH1 ? 201 : 160, isH1 ? 162 : 160, isH1 ? 39 : 160);
          pdf.setFontSize(fontSize - 1);
          const numW = pdf.getTextWidth(numLabel);
          pdf.text(numLabel, x, yToc);

          // Texto da seção
          pdf.setFont("helvetica", isH1 ? "bold" : "normal");
          pdf.setFontSize(fontSize);
          pdf.setTextColor(cor, cor, cor);
          const labelStartX = x + numW + 3;

          const numStr = String(entry.pageInPdf);
          const numStrW = pdf.getTextWidth(numStr);
          const maxLabelW = (pdfW - marginX) - labelStartX - numStrW - 8;

          let label = entry.text;
          while (pdf.getTextWidth(label) > maxLabelW && label.length > 4) {
            label = label.slice(0, -2);
          }
          if (label !== entry.text) label = label.replace(/\s+\S*$/, "") + "…";
          pdf.text(label, labelStartX, yToc);
          const labelW = pdf.getTextWidth(label);

          // Pontilhados (apenas para H2/H3)
          if (!isH1) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.setTextColor(200, 200, 200);
            const dotsStartX = labelStartX + labelW + 2;
            const dotsEndX = pdfW - marginX - numStrW - 2;
            if (dotsEndX > dotsStartX) {
              const dotsWidth = dotsEndX - dotsStartX;
              const dotW = pdf.getTextWidth(".");
              const nDots = Math.max(0, Math.floor(dotsWidth / (dotW + 0.6)));
              if (nDots > 0) pdf.text(".".repeat(nDots), dotsStartX, yToc);
            }
          }

          // Número de página (à direita, dourado para H1)
          pdf.setFont("helvetica", isH1 ? "bold" : "normal");
          pdf.setFontSize(fontSize);
          if (isH1) pdf.setTextColor(201, 162, 39);
          else pdf.setTextColor(40, 40, 40);
          pdf.text(numStr, pdfW - marginX, yToc, { align: "right" });

          // Link clicável: cobre toda a linha da entrada do sumário e navega
          // até a página de destino. (jspdf navega para o topo da página alvo)
          try {
            const linkH = isH1 ? 9 : isH2 ? 6 : 5;
            const linkY = yToc - (linkH - 1.5);
            pdf.link(marginX - 2, linkY, pdfW - marginX * 2 + 4, linkH, {
              pageNumber: entry.pageInPdf,
            });
          } catch { /* link opcional */ }

          yToc += isH1 ? 11 : isH2 ? 7 : 6;
        }
      }

      // ============ CONTEÚDO ============
      const sliceCanvas = document.createElement("canvas");
      const sliceCtx = sliceCanvas.getContext("2d")!;

      for (let p = 0; p < totalPaginasConteudo; p++) {
        const sliceStart = cuts[p];
        const sliceEnd = cuts[p + 1];
        const sliceH = sliceEnd - sliceStart;

        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        sliceCtx.fillStyle = "#ffffff";
        sliceCtx.fillRect(0, 0, canvas.width, sliceH);
        sliceCtx.drawImage(
          canvas,
          0, sliceStart, canvas.width, sliceH,
          0, 0, canvas.width, sliceH,
        );
        const sliceData = sliceCanvas.toDataURL("image/png");

        // Sempre nova página (capa + sumário já existem)
        pdf.addPage();

        drawPageChrome(pdf, pdfW, pdfH, {
          userName, userEmail, dataStr, marginX, footerH,
          pageNum: p + 1 + offsetPaginas,
          logoData,
        });

        // Imagem
        const imgH_MM = sliceH / pxPerMM;
        pdf.addImage(sliceData, "PNG", marginX, contentTopMM, contentW_MM, imgH_MM);
        const pct = 65 + Math.round(((p + 1) / Math.max(1, totalPaginasConteudo)) * 30);
        setProgresso(pct);
        setEtapa(`Compondo página ${p + 1} de ${totalPaginasConteudo}…`);
      }

      const slug = titulo
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // ============ ANEXO: TABELAS LARGAS EM PAISAGEM ============
      if (wideTables.length > 0) {
        setEtapa("Renderizando anexo de tabelas largas…");
        const lpdfW = pdfH; // 297
        const lpdfH = pdfW; // 210
        const lMarginX = 15;
        const lHeaderH = 16;
        const lFooterH = 14;
        const lContentW = lpdfW - lMarginX * 2;
        const lContentH = lpdfH - lHeaderH - lFooterH;

        // Capa do anexo
        pdf.addPage("a4", "landscape");
        drawPageChrome(pdf, lpdfW, lpdfH, {
          userName, userEmail, dataStr, marginX: lMarginX, footerH: lFooterH,
          pageLabel: "ANEXO · TABELAS",
          logoData,
        });
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(22);
        pdf.setTextColor(20, 20, 20);
        pdf.text("ANEXO · TABELAS AMPLIADAS", lMarginX, lHeaderH + 18);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10.5);
        pdf.setTextColor(80, 80, 80);
        pdf.text(
          "As tabelas a seguir foram destacadas em orientação paisagem para preservar a legibilidade.",
          lMarginX, lHeaderH + 28,
        );
        let yIdx = lHeaderH + 40;
        pdf.setFontSize(10);
        wideTables.forEach((t) => {
          pdf.setTextColor(201, 162, 39);
          pdf.setFont("helvetica", "bold");
          pdf.text(`Tabela ${t.index}`, lMarginX, yIdx);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(40, 40, 40);
          pdf.text(t.titulo, lMarginX + 22, yIdx);
          yIdx += 6;
          if (yIdx > lpdfH - lFooterH - 6) yIdx = lHeaderH + 40;
        });

        // Renderiza cada tabela em uma página paisagem
        for (let i = 0; i < wideTables.length; i++) {
          const t = wideTables[i];
          // Wrapper temporário com largura paisagem (≈ 1064px = 282mm @ 96dpi)
          const lWrapper = document.createElement("div");
          lWrapper.style.position = "fixed";
          lWrapper.style.left = "-100000px";
          lWrapper.style.top = "0";
          lWrapper.style.width = `${Math.round(lContentW * (680 / 180))}px`;
          lWrapper.style.background = "#ffffff";
          lWrapper.style.color = "#080808";
          lWrapper.style.padding = "0";
          lWrapper.style.fontFamily = "'Helvetica Neue', Arial, Helvetica, sans-serif";
          lWrapper.style.fontSize = "14px";
          lWrapper.style.lineHeight = "1.75";
          // Reaproveita os estilos .pdf-doc
          const lStyle = styleTag.cloneNode(true);
          lWrapper.appendChild(lStyle);
          const lDoc = document.createElement("div");
          lDoc.className = "pdf-doc";
          lDoc.innerHTML = `<h2 style="margin:0 0 14px;">Tabela ${t.index} — ${t.titulo}</h2>${t.html}`;
          lWrapper.appendChild(lDoc);
          document.body.appendChild(lWrapper);
          try {
            const lCanvas = await html2canvas(lWrapper, {
              scale: 3, backgroundColor: "#ffffff", useCORS: true, logging: false, imageTimeout: 10000,
            });
            const lPxPerMM = lCanvas.width / lContentW;
            const lPageHpx = Math.floor(lContentH * lPxPerMM);
            // Pagina a tabela (cortes só em linhas "brancas" se necessário)
            const lCtx = lCanvas.getContext("2d", { willReadFrequently: true });
            const computeWhitestCut = (start: number, end: number): number => {
              if (!lCtx || end <= start) return end;
              const win = Math.min(120, Math.floor((end - start) * 0.15));
              const lo = Math.max(start + Math.floor((end - start) * 0.6), end - win);
              let bestY = end, bestVal = -1;
              for (let y = end - 1; y >= lo; y--) {
                const data = lCtx.getImageData(0, y, lCanvas.width, 1).data;
                let sum = 0;
                for (let x = 0; x < lCanvas.width; x += 8) {
                  sum += data[x * 4] + data[x * 4 + 1] + data[x * 4 + 2];
                }
                if (sum > bestVal) { bestVal = sum; bestY = y; }
              }
              return bestY;
            };
            const lCuts: number[] = [0];
            let lCursor = 0;
            while (lCursor < lCanvas.height) {
              const ideal = lCursor + lPageHpx;
              if (ideal >= lCanvas.height) { lCuts.push(lCanvas.height); break; }
              const next = computeWhitestCut(lCursor, ideal);
              lCuts.push(next > lCursor + 50 ? next : ideal);
              lCursor = lCuts[lCuts.length - 1];
            }
            const lSlice = document.createElement("canvas");
            const lSctx = lSlice.getContext("2d")!;
            for (let p = 0; p < lCuts.length - 1; p++) {
              const s = lCuts[p], e = lCuts[p + 1], h = e - s;
              lSlice.width = lCanvas.width;
              lSlice.height = h;
              lSctx.fillStyle = "#ffffff";
              lSctx.fillRect(0, 0, lCanvas.width, h);
              lSctx.drawImage(lCanvas, 0, s, lCanvas.width, h, 0, 0, lCanvas.width, h);
              const data = lSlice.toDataURL("image/png");
              pdf.addPage("a4", "landscape");
              drawPageChrome(pdf, lpdfW, lpdfH, {
                userName, userEmail, dataStr, marginX: lMarginX, footerH: lFooterH,
                pageLabel: `Tabela ${t.index} · ${p + 1}/${lCuts.length - 1}`,
                logoData,
              });
              pdf.addImage(data, "PNG", lMarginX, lHeaderH, lContentW, h / lPxPerMM);
            }
          } finally {
            lWrapper.remove();
          }
        }
      }

      setProgresso(98);
      setEtapa("Salvando arquivo…");
      pdf.save(`974safo-apostila-${slug}.pdf`);
      setProgresso(100);
      const total = totalPaginasConteudo + offsetPaginas;
      toast.success(`PDF exportado (${total} ${total === 1 ? "página" : "páginas"})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar PDF");
    } finally {
      document.body.removeChild(wrapper);
      setExportando(false);
      setTimeout(() => { setProgresso(0); setEtapa(""); }, 800);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        icon={BookOpen}
        title="Apostila"
        description="Material de estudo gerado por matéria ou tópico específico."
      />

      <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[200px_1fr_auto]">
        <Select value={materia} onValueChange={setMateria}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MATERIAS.map((m) => (<SelectItem key={m.slug} value={m.nome}>{m.nome}</SelectItem>))}
          </SelectContent>
        </Select>
        <Input
          value={topico}
          onChange={(e) => setTopico(e.target.value)}
          placeholder="Tópico específico (opcional) — ex: princípio da legalidade"
        />
        <Button onClick={gerar} disabled={loading} className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="ml-2">Gerar</span>
        </Button>
        <div className="flex items-center justify-end gap-2 sm:col-span-3">
          <Switch
            id="auto-pdf"
            checked={autoSalvar}
            onCheckedChange={setAutoSalvar}
          />
          <Label htmlFor="auto-pdf" className="text-sm text-muted-foreground cursor-pointer">
            Salvar PDF ao concluir
          </Label>
        </div>
      </div>

      {conteudo && !loading && (
        <div className="mt-6 flex flex-col gap-3">
          {/* Aviso de paridade sempre visível e recalculado em tempo real */}
          {renderParityAlert()}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2 sm:mr-auto">
            <Switch id="rev-pdf" checked={revisarAntesPdf} onCheckedChange={setRevisarAntesPdf} />
            <Label htmlFor="rev-pdf" className="text-xs text-muted-foreground cursor-pointer">
              Revisar antes do PDF
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={revisando || exportando}
            onClick={() => revisarTexto()}
            className="border-2 border-primary/40 hover:border-primary"
          >
            {revisando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            <span className="ml-2 font-semibold tracking-wide uppercase text-xs">
              {revisando ? "Revisando…" : "Revisar texto"}
            </span>
          </Button>
          <Button
            onClick={exportarPDF}
            disabled={exportando || !conteudo}
            size="sm"
            className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
            title={`Margens ${pdfMargin === "compact" ? "compactas (10mm)" : pdfMargin === "wide" ? "amplas (20mm)" : "normais (15mm)"} · Modo ${pdfMode}`}
          >
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="ml-2 font-semibold tracking-wide uppercase text-xs">
              {exportando ? "Gerando…" : "Exportar PDF"}
            </span>
          </Button>
          <Dialog open={previewAberto} onOpenChange={setPreviewAberto}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={exportando}
                className="group relative overflow-hidden border-2 border-primary/40 bg-background text-foreground hover:border-primary"
              >
                <Eye className="h-4 w-4" />
                <span className="ml-2 font-semibold tracking-wide uppercase text-xs">Prévia & Download</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl border-2 border-primary/30 bg-card p-0 overflow-hidden">
              {/* Cantoneiras estilo Caveira */}
              <div className="pointer-events-none absolute inset-3">
                <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-primary/60" />
                <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-primary/60" />
                <span className="absolute left-0 bottom-0 h-4 w-4 border-l-2 border-b-2 border-primary/60" />
                <span className="absolute right-0 bottom-0 h-4 w-4 border-r-2 border-b-2 border-primary/60" />
              </div>

              <div className="relative p-6 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-bold tracking-wide uppercase text-foreground">
                    974 SAFO · Apostila
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Personalize sua capa Caveira e baixe o PDF.
                  </DialogDescription>
                </DialogHeader>

                {/* Verificador de paridade da divisa PMPR (prévia ↔ PDF) */}
                {renderParityAlert()}

                {/* Layout: Prévia + Controles */}
                {(() => {
                  const t = COVER_THEMES[coverTheme];
                  const lightTheme = t.id === "marble";
                  const userNameMock =
                    autorCustom.trim() ||
                    (user?.user_metadata as { display_name?: string; full_name?: string } | undefined)?.display_name ||
                    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
                    (user?.email ? user.email.split("@")[0] : "Aluno 974 SAFO");
                  const tituloMock = (tituloCustom.trim() || (topico.trim() || materia));
                  return (
                    <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_1.1fr]">
                      {/* Prévia */}
                      <div
                        className="relative aspect-[210/297] w-full overflow-hidden rounded-md border border-border shadow-elegant"
                        style={{ background: t.cssBg, color: lightTheme ? "#111" : "#f5f5f5" }}
                      >
                        {/* Faixa lateral */}
                        <div className="absolute left-0 top-0 h-full w-[3%]" style={{ background: t.cssAccent }} />
                        <div className="absolute left-[3%] top-0 h-full w-[0.7%] opacity-70" style={{ background: t.cssAccent }} />

                        {/* Textura sutil de pontos (espelha dot-grid do PDF) */}
                        <div
                          className="absolute inset-0 opacity-40 pointer-events-none"
                          style={{
                            backgroundImage: `radial-gradient(${lightTheme ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.10)"} 0.6px, transparent 0.7px)`,
                            backgroundSize: "6px 6px",
                            backgroundPosition: "4px 8px",
                            maskImage: "linear-gradient(180deg, #000 0%, #000 70%, transparent 92%)",
                            WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 70%, transparent 92%)",
                          }}
                        />

                        {/* Cantoneiras */}
                        <span className="absolute left-2 top-2 h-5 w-5 border-l border-t" style={{ borderColor: lightTheme ? "#444" : "rgba(255,255,255,0.6)" }} />
                        <span className="absolute right-2 top-2 h-5 w-5 border-r border-t" style={{ borderColor: lightTheme ? "#444" : "rgba(255,255,255,0.6)" }} />
                        <span className="absolute left-2 bottom-2 h-5 w-5 border-l border-b" style={{ borderColor: lightTheme ? "#444" : "rgba(255,255,255,0.6)" }} />
                        <span className="absolute right-2 bottom-2 h-5 w-5 border-r border-b" style={{ borderColor: lightTheme ? "#444" : "rgba(255,255,255,0.6)" }} />

                        {/* Marca topo-esquerda (espelha PDF: 974 SAFO + subtítulo) */}
                        <div className="absolute left-4 top-4">
                          <div className="text-[10px] font-bold tracking-widest leading-none">974 SAFO</div>
                          <div className="mt-1 text-[7px] tracking-wider opacity-60 uppercase">Plataforma de estudos · CFP/PM-PR</div>
                        </div>
                        {/* Identificador volume topo-direita */}
                        <div className="absolute right-4 top-4 text-right">
                          <div className="ml-auto h-[1px] w-16" style={{ background: t.cssAccent }} />
                          <div className="mt-1 text-[7px] tracking-wider opacity-60 uppercase">Volume único</div>
                          <div className="text-[7px] font-bold tracking-wider" style={{ color: t.cssAccent }}>
                            {new Date().toLocaleDateString("pt-BR")}
                          </div>
                        </div>

                        {/* Ilustração watermark */}
                        {showWatermark && (
                          <>
                            {/* Ilustração temática principal — derivada do spec mm */}
                            <img
                              src={pickIlustracao(materia, topico)}
                              alt=""
                              loading="eager"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback !== "1") {
                                  img.dataset.fallback = "1";
                                  img.src = pickFallbackIlustracao(`${materia}-main`);
                                } else {
                                  img.style.visibility = "hidden";
                                }
                              }}
                              className={`absolute left-1/2 -translate-x-1/2 ${
                                showMisalignOverlay && divisaMainMisaligned
                                  ? "outline outline-2 outline-destructive ring-2 ring-destructive/40 animate-pulse"
                                  : ""
                              }`}
                              style={{
                                width: `${divisaPreview.mainWidthPct}%`,
                                top: `${divisaPreview.mainTopPct}%`,
                                opacity: divisaOverride?.opacity ?? divisaOpacityForTheme(t.id),
                              }}
                            />
                            {/* Selo nítido — derivado do spec mm */}
                            <img
                              src={pickIlustracao(materia, topico)}
                              alt=""
                              loading="eager"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback !== "1") {
                                  img.dataset.fallback = "1";
                                  img.src = pickFallbackIlustracao(`${materia}-badge`);
                                } else {
                                  img.style.visibility = "hidden";
                                }
                              }}
                              className={`absolute ${
                                showMisalignOverlay && divisaBadgeMisaligned
                                  ? "outline outline-2 outline-destructive ring-2 ring-destructive/40 animate-pulse"
                                  : ""
                              }`}
                              style={{
                                width: `${divisaPreview.badgeWidthPct}%`,
                                right: `${divisaPreview.badgeRightPct}%`,
                                bottom: `${divisaPreview.badgeBottomPct}%`,
                                opacity: 1,
                              }}
                            />
                            {/* Contorno do alvo esperado quando há divergência */}
                            {showMisalignOverlay && divisaMainMisaligned && (
                              <div
                                className="pointer-events-none absolute left-1/2 -translate-x-1/2 border-2 border-dashed border-emerald-400 rounded-sm"
                                style={{
                                  width: `${DIVISA_PREVIEW_PCT.main.widthPct}%`,
                                  top: `${DIVISA_PREVIEW_PCT.main.topPct}%`,
                                  aspectRatio: "1 / 1",
                                }}
                                title="Posição esperada (PDF)"
                              />
                            )}
                            {showMisalignOverlay && divisaBadgeMisaligned && (
                              <div
                                className="pointer-events-none absolute border-2 border-dashed border-emerald-400 rounded-sm"
                                style={{
                                  width: `${DIVISA_PREVIEW_PCT.badge.widthPct}%`,
                                  right: `${DIVISA_PREVIEW_PCT.badge.rightPct}%`,
                                  bottom: `${DIVISA_PREVIEW_PCT.badge.bottomPct}%`,
                                  aspectRatio: "1 / 1",
                                }}
                                title="Posição esperada (PDF)"
                              />
                            )}
                            {showMisalignOverlay && (
                              <div className="pointer-events-none absolute left-2 bottom-10 rounded bg-destructive/90 px-1.5 py-0.5 text-[8px] font-bold text-destructive-foreground shadow">
                                DESALINHADO · contorno verde = esperado
                              </div>
                            )}
                          </>
                        )}

                        <div className="absolute left-4 right-4 top-[42%] -translate-y-1/2">
                          <div className="text-[8px] font-bold uppercase" style={{ color: t.cssAccent }}>
                            {eyebrow || "APOSTILA · CFP · PM-PR"}
                          </div>
                          <div className="mt-1 h-[2px] w-8" style={{ background: t.cssAccent }} />
                          <h3 className="mt-2 text-lg font-bold leading-tight uppercase line-clamp-3">
                            {tituloMock}
                          </h3>
                          {topico.trim() && tituloCustom.trim() === "" && (
                            <p className="mt-1 text-[10px] uppercase opacity-70">{materia}</p>
                          )}
                        </div>

                        <div
                          className="absolute bottom-10 left-4 right-4 border-t pt-1.5 text-[8px]"
                          style={{ borderColor: t.cssAccent }}
                        >
                          <div className="grid grid-cols-3 gap-2 opacity-70 uppercase tracking-wider">
                            <span>Aluno</span><span className="text-center">Curso</span><span className="text-right">Emissão</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-bold text-[9px] mt-0.5">
                            <span className="truncate">{userNameMock}</span>
                            <span className="text-center">CFP · PM-PR</span>
                            <span className="text-right">{new Date().toLocaleDateString("pt-BR")}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-0.5 text-[6.5px] opacity-60">
                            <span className="truncate">{user?.email ?? ""}</span>
                            <span className="text-center">Material protegido por lei · Conteúdo gerado por IA</span>
                            <span />
                          </div>
                        </div>

                        <div className="absolute bottom-3 left-4 text-[8px] font-bold opacity-80">974SAFO.COM</div>
                        {showLogo && (
                          <img
                            src={logo974}
                            alt="974 SAFO"
                            className="absolute bottom-3 right-4 h-6 w-auto object-contain"
                            style={{ filter: lightTheme ? "none" : "brightness(0) invert(1)" }}
                          />
                        )}
                      </div>

                      {/* Controles */}
                      <div className="space-y-4">
                        <div>
                          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Palette className="h-3 w-3" /> Tema da capa
                          </Label>
                          <div className="mt-2 grid grid-cols-5 gap-2">
                            {(Object.values(COVER_THEMES)).map((th) => (
                              <button
                                key={th.id}
                                type="button"
                                onClick={() => setCoverTheme(th.id)}
                                title={th.nome}
                                className={`relative h-10 rounded-md border-2 transition-all ${
                                  coverTheme === th.id ? "border-primary ring-2 ring-primary/30 scale-105" : "border-border hover:border-primary/50"
                                }`}
                                style={{ background: th.cssBg }}
                              >
                                <span
                                  className="absolute inset-y-1 left-1 w-1 rounded-sm"
                                  style={{ background: th.cssAccent }}
                                />
                              </button>
                            ))}
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">{COVER_THEMES[coverTheme].nome}</p>
                        </div>

                        <div>
                          <Label htmlFor="titulo-custom" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Título da capa (opcional)
                          </Label>
                          <Input
                            id="titulo-custom"
                            value={tituloCustom}
                            onChange={(e) => setTituloCustom(e.target.value)}
                            placeholder={topico.trim() || materia}
                            className="mt-1 h-9 text-sm"
                          />
                        </div>

                        <div>
                          <Label htmlFor="eyebrow" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Etiqueta superior
                          </Label>
                          <Input
                            id="eyebrow"
                            value={eyebrow}
                            onChange={(e) => setEyebrow(e.target.value)}
                            placeholder="APOSTILA · CFP · PM-PR"
                            className="mt-1 h-9 text-sm"
                          />
                        </div>

                        <div>
                          <Label htmlFor="autor-custom" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Nome do aluno (opcional)
                          </Label>
                          <Input
                            id="autor-custom"
                            value={autorCustom}
                            onChange={(e) => setAutorCustom(e.target.value)}
                            placeholder={user?.email?.split("@")[0] ?? "Seu nome"}
                            className="mt-1 h-9 text-sm"
                          />
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                          <Label htmlFor="show-logo" className="text-xs cursor-pointer">Mostrar logo 974 SAFO</Label>
                          <Switch id="show-logo" checked={showLogo} onCheckedChange={setShowLogo} />
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                          <Label htmlFor="show-wm" className="text-xs cursor-pointer">Ilustração temática</Label>
                          <Switch id="show-wm" checked={showWatermark} onCheckedChange={setShowWatermark} />
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                          <div className="flex flex-col">
                            <Label htmlFor="show-misalign" className="text-xs cursor-pointer">
                              Destacar desalinhamento da divisa
                            </Label>
                            <span className="text-[10px] text-muted-foreground">
                              Mostra contorno vermelho no item divergente e contorno verde tracejado na posição esperada.
                            </span>
                          </div>
                          <Switch
                            id="show-misalign"
                            checked={highlightMisalign}
                            onCheckedChange={setHighlightMisalign}
                          />
                        </div>

                        {/* Margens do PDF */}
                        <div className="rounded-md border border-border p-2.5">
                          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Margens do PDF
                          </Label>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {([
                              { id: "compact", label: "Compactas", hint: "10 mm" },
                              { id: "normal",  label: "Normais",   hint: "15 mm" },
                              { id: "wide",    label: "Amplas",    hint: "20 mm" },
                            ] as const).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setPdfMargin(opt.id)}
                                className={`rounded-md border-2 px-2 py-1.5 text-left transition-all ${
                                  pdfMargin === opt.id
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                <div className="text-xs font-semibold text-foreground">{opt.label}</div>
                                <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Modo de paginação */}
                        <div className="rounded-md border border-border p-2.5">
                          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Modo de paginação
                          </Label>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {([
                              { id: "conservador", label: "Conservador", hint: "Mantém o espaçamento original" },
                              { id: "compacto",    label: "Compacto",    hint: "Reduz vazios e títulos órfãos" },
                            ] as const).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setPdfMode(opt.id)}
                                className={`rounded-md border-2 px-2 py-1.5 text-left transition-all ${
                                  pdfMode === opt.id
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                <div className="text-xs font-semibold text-foreground">{opt.label}</div>
                                <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {exportando && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        {etapa || "Gerando PDF…"}
                      </span>
                      <span className="font-mono text-primary">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="h-2" />
                  </div>
                )}

                <DialogFooter className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Layout Caveira · A4 · Capa + Sumário + Conteúdo
                  </div>
                  <Button
                    onClick={exportarPDF}
                    disabled={exportando}
                    className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
                  >
                    {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    <span className="ml-2">{exportando ? "Gerando…" : "Baixar PDF"}</span>
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      )}

      {exportando && (
        <div className="fixed bottom-6 right-6 z-50 w-72 rounded-xl border border-primary/30 bg-card p-3 shadow-elegant">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-semibold text-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              Gerando PDF
            </span>
            <span className="font-mono text-primary">{progresso}%</span>
          </div>
          <Progress value={progresso} className="mt-2 h-1.5" />
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{etapa}</p>
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-border bg-card p-6 shadow-elegant min-h-[300px]">
        {!conteudo && !loading && (
          <p className="text-center text-sm text-muted-foreground">Selecione a matéria e clique em Gerar para criar sua apostila.</p>
        )}
        {loading && !conteudo && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (<div key={i} className="h-4 rounded shimmer" style={{ width: `${60 + i * 8}%` }} />))}
          </div>
        )}
        {conteudo && (
          <div ref={conteudoRef}>
            {(() => {
              // Extrai headings (H1/H2) do markdown para criar TOC clicável
              const headings: { level: 1 | 2; text: string; id: string }[] = [];
              const seen = new Set<string>();
              for (const raw of conteudo.split("\n")) {
                const m = /^(#{1,2})\s+(.+?)\s*$/.exec(raw);
                if (!m) continue;
                const level = m[1].length as 1 | 2;
                const text = m[2].replace(/[*_`]/g, "").trim();
                if (!text) continue;
                const id = slugify(text);
                const key = `${level}::${id}`;
                if (seen.has(key)) continue;
                seen.add(key);
                headings.push({ level, text, id });
              }
              if (headings.length < 2) return null;
              return (
                <nav
                  aria-label="Sumário"
                  className="mb-6 rounded-xl border border-primary/20 bg-card/60 p-4 not-prose"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    <BookOpen className="h-3.5 w-3.5" />
                    Sumário
                  </div>
                  <ol className="space-y-1 text-sm">
                    {(() => {
                      let h1 = 0, h2 = 0;
                      return headings.map((h, i) => {
                        if (h.level === 1) { h1++; h2 = 0; } else { h2++; }
                        const num = h.level === 1 ? `${h1}.` : `${h1}.${h2}`;
                        return (
                          <li
                            key={`${h.id}-${i}`}
                            className={h.level === 2 ? "pl-5" : ""}
                          >
                            <a
                              href={`#${h.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                                history.replaceState(null, "", `#${h.id}`);
                              }}
                              className={`group flex items-baseline gap-2 rounded px-1.5 py-1 hover:bg-primary/10 ${
                                h.level === 1 ? "font-semibold text-foreground" : "text-foreground/80"
                              }`}
                            >
                              <span className="font-mono text-xs text-primary">{num}</span>
                              <span className="group-hover:text-primary">{h.text}</span>
                            </a>
                          </li>
                        );
                      });
                    })()}
                  </ol>
                </nav>
              );
            })()}
            <Markdown>{conteudo}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
