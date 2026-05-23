import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, Send, Loader2, Plus, Paperclip, FileText, X, Upload, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/study/PageHeader";
import { Markdown } from "@/components/study/Markdown";
import { streamSSE } from "@/lib/streamSSE";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { extrairPdf, type PdfExtraido } from "@/lib/extrairPdf";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { drawSafoChrome, SAFO_CHROME_MARGIN } from "@/lib/pdfChrome";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Explique o princípio da legalidade penal com exemplos.",
  "Qual a diferença entre prisão em flagrante e prisão preventiva?",
  "Resuma os direitos fundamentais do art. 5º da CF/88.",
  "O que é crime propriamente militar? Cite exemplos.",
];

const MAX_PDFS = 3;

export default function Tutor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [pdfsAnexos, setPdfsAnexos] = useState<PdfExtraido[]>([]);
  const [enviandoPdf, setEnviandoPdf] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [exportando, setExportando] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [gerandoPreview, setGerandoPreview] = useState(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!user) { setCarregandoSessao(false); return; }
    (async () => {
      const { data } = await supabase
        .from("sessoes_tutor")
        .select("id, mensagens")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && Array.isArray(data.mensagens) && (data.mensagens as Msg[]).length > 0) {
        setMessages(data.mensagens as Msg[]);
        setSessaoId(data.id as string);
      }
      setCarregandoSessao(false);
    })();
  }, [user]);

  const salvarSessao = useCallback(async (msgs: Msg[], sId: string | null) => {
    if (!user || msgs.length === 0) return;
    const titulo = msgs.find((m) => m.role === "user")?.content.slice(0, 60) ?? "Conversa";
    try {
      if (sId) {
        await supabase.from("sessoes_tutor").update({ mensagens: msgs, titulo }).eq("id", sId);
      } else {
        const { data } = await supabase.from("sessoes_tutor").insert({
          user_id: user.id, titulo, mensagens: msgs,
        }).select("id").single();
        if (data) setSessaoId(data.id as string);
      }
    } catch { /* silencioso */ }
  }, [user]);

  const novaConversa = () => {
    setMessages([]);
    setSessaoId(null);
    setInput("");
    setPdfsAnexos([]);
  };

  /** Constrói o PDF jsPDF a partir do estado atual de mensagens. */
  const construirPDF = async (): Promise<jsPDF> => {
      const userName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Aluno";
      const userEmail = user?.email || "";
      const dataStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const tituloChat = messages.find((m) => m.role === "user")?.content.slice(0, 70).replace(/\n/g, " ") || "Conversa com Tutor IA";

      // Renderiza conversa em wrapper offscreen com largura de 180mm @ ~3.78px/mm = 680px
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:fixed;left:-99999px;top:0;width:680px;background:#fff;color:#0a0a0a;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;line-height:1.55;padding:0;";
      wrapper.innerHTML = messages.map((m) => {
        const isUser = m.role === "user";
        const safe = m.content.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
        const bg = isUser ? "#fff8e1" : "#f6f6f6";
        const border = isUser ? "#c9a227" : "#d4d4d4";
        const label = isUser ? "VOCÊ" : "TUTOR IA";
        const labelColor = isUser ? "#9b7c1c" : "#555";
        return `
          <div style="margin:0 0 16px 0;padding:14px 16px;background:${bg};border-left:3px solid ${border};border-radius:6px;page-break-inside:avoid;">
            <div style="font-size:9px;font-weight:700;letter-spacing:0.08em;color:${labelColor};margin-bottom:6px;">${label}</div>
            <div style="white-space:pre-wrap;word-wrap:break-word;">${safe}</div>
          </div>`;
      }).join("");
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
      document.body.removeChild(wrapper);

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const marginX = SAFO_CHROME_MARGIN.x;
      const headerH = SAFO_CHROME_MARGIN.top;
      const footerH = SAFO_CHROME_MARGIN.bottom;
      const contentW = pdfW - marginX * 2;
      const contentH = pdfH - headerH - footerH;
      const pxPerMM = canvas.width / contentW;
      const pageHeightPx = Math.floor(contentH * pxPerMM);

      // ---- CAPA ----
      pdf.setFillColor(8, 10, 14);
      pdf.rect(0, 0, pdfW, pdfH, "F");
      pdf.setFillColor(201, 162, 39);
      pdf.rect(0, 0, 6, pdfH, "F");
      // Cantoneiras
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.5);
      const m = 12, l = 24;
      pdf.line(m, m, m + l, m); pdf.line(m, m, m, m + l);
      pdf.line(pdfW - m, m, pdfW - m - l, m); pdf.line(pdfW - m, m, pdfW - m, m + l);
      pdf.line(m, pdfH - m, m + l, pdfH - m); pdf.line(m, pdfH - m, m, pdfH - m - l);
      pdf.line(pdfW - m, pdfH - m, pdfW - m - l, pdfH - m); pdf.line(pdfW - m, pdfH - m, pdfW - m, pdfH - m - l);
      // Marca
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(248, 248, 248);
      pdf.text("974 SAFO", 22, 26);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(190, 190, 190);
      pdf.text("PLATAFORMA DE ESTUDOS · CFP/PM-PR", 22, 31);
      // Eyebrow
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(201, 162, 39);
      pdf.text("CONVERSA · TUTOR IA", marginX, pdfH / 2 - 32);
      pdf.setDrawColor(201, 162, 39); pdf.setLineWidth(0.8);
      pdf.line(marginX, pdfH / 2 - 28, marginX + 22, pdfH / 2 - 28);
      // Título
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(26); pdf.setTextColor(248, 248, 248);
      const tLines = pdf.splitTextToSize(tituloChat, pdfW - marginX * 2);
      pdf.text(tLines, marginX, pdfH / 2 - 16);
      // Subtítulo
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(190, 190, 190);
      pdf.text(`${messages.length} mensagens · ${userName}`, marginX, pdfH / 2 + tLines.length * 9);
      pdf.text(dataStr, marginX, pdfH / 2 + tLines.length * 9 + 6);
      // Rodapé capa
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(190, 190, 190);
      pdf.text("974SAFO.COM", marginX, pdfH - 22);

      // ---- PÁGINAS DE CONTEÚDO ----
      let cursor = 0;
      let pageNum = 1;
      while (cursor < canvas.height) {
        pdf.addPage();
        pageNum++;
        drawSafoChrome(pdf, pdfW, pdfH, {
          userName, userEmail, dataStr,
          pageNum: pageNum - 1,
          eyebrow: "TUTOR IA · CONVERSA",
        });

        const sliceH = Math.min(pageHeightPx, canvas.height - cursor);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        slice.getContext("2d")!.drawImage(canvas, 0, cursor, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const imgData = slice.toDataURL("image/jpeg", 0.92);
        const sliceMM = sliceH / pxPerMM;
        pdf.addImage(imgData, "JPEG", marginX, headerH, contentW, sliceMM);
        cursor += sliceH;
      }
    return pdf;
  };

  /** Gera o PDF e abre a pré-visualização A4 num diálogo (sem baixar). */
  const previewPDF = async () => {
    if (messages.length === 0 || gerandoPreview) return;
    setGerandoPreview(true);
    const tid = toast.loading("Gerando pré-visualização…");
    try {
      const pdf = await construirPDF();
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      // Revoga URL anterior (se houver) para evitar leak
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewBlob(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
      toast.success("Pré-visualização pronta", { id: tid });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao gerar pré-visualização", { id: tid });
    } finally {
      setGerandoPreview(false);
    }
  };

  /** Baixa o PDF que está em pré-visualização (ou gera direto se não houver). */
  const baixarPDF = async () => {
    if (messages.length === 0 || exportando) return;
    setExportando(true);
    const tid = toast.loading("Preparando download…");
    try {
      const blob = previewBlob ?? (await construirPDF()).output("blob");
      const fname = `tutor-conversa-${new Date().toISOString().slice(0, 10)}.pdf`;
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PDF baixado!", { id: tid });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao baixar PDF", { id: tid });
    } finally {
      setExportando(false);
    }
  };

  // Limpa blob URL ao desmontar
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // Quando a conversa muda, invalida o preview anterior
  useEffect(() => {
    if (previewBlob) {
      setPreviewBlob(null);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const processarPdf = useCallback(async (file: File) => {
    if (!MIME_OK_PDF(file)) { toast.error("Use apenas arquivos PDF"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("PDF deve ter no máximo 25 MB"); return; }
    if (pdfsAnexos.length >= MAX_PDFS) { toast.error(`Máximo de ${MAX_PDFS} PDFs por vez`); return; }
    setEnviandoPdf(true);
    try {
      const res = await extrairPdf(file);
      setPdfsAnexos((prev) => [...prev, res]);
      toast.success(`PDF "${res.nome}" anexado${res.truncado ? " (truncado)" : ""}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ler o PDF");
    } finally {
      setEnviandoPdf(false);
    }
  }, [pdfsAnexos]);

  const onSelecionarPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files.slice(0, MAX_PDFS - pdfsAnexos.length)) {
      await processarPdf(file);
    }
  };

  // Drag & drop no chat
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setArrastando(true); };
  const onDragLeave = () => setArrastando(false);
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files.slice(0, MAX_PDFS - pdfsAnexos.length)) {
      await processarPdf(file);
    }
  }, [processarPdf, pdfsAnexos.length]);

  const removerPdf = (idx: number) => {
    setPdfsAnexos((prev) => prev.filter((_, i) => i !== idx));
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && pdfsAnexos.length === 0) || loading) return;

    let conteudoFinal = trimmed;
    if (pdfsAnexos.length > 0) {
      const pergunta = trimmed || "Analise este(s) PDF(s) e explique os pontos principais.";
      const anexos = pdfsAnexos
        .map((p) => `📎 **PDF: ${p.nome}**\n\n${p.texto}`)
        .join("\n\n---\n\n");
      conteudoFinal = `${pergunta}\n\n---\n${anexos}`;
    }

    const conteudoVisivel = pdfsAnexos.length > 0
      ? `${trimmed || "Analise este(s) PDF(s) e explique os pontos principais."}\n\n${pdfsAnexos.map((p) => `📎 *${p.nome}*`).join("\n")}`
      : trimmed;

    const userMsgVisivel: Msg = { role: "user", content: conteudoVisivel };
    const userMsgEnvio: Msg = { role: "user", content: conteudoFinal };
    const newHistory = [...messages, userMsgVisivel];
    setMessages(newHistory);
    const historicoEnvio = [...messages, userMsgEnvio];
    setInput("");
    setPdfsAnexos([]);
    setLoading(true);

    let acc = "";
    let finalMessages: Msg[] = newHistory;
    try {
      await streamSSE("chat", { messages: historicoEnvio }, (chunk) => {
        acc += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
          }
          return [...prev, { role: "assistant", content: acc }];
        });
      });
      finalMessages = [...newHistory, { role: "assistant", content: acc }];
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao consultar a IA");
    } finally {
      setLoading(false);
      if (acc) await salvarSessao(finalMessages, sessaoId);
    }
  };

  if (carregandoSessao) {
    return (
      <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-4xl items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-4xl flex-col px-4 py-6">
      <PageHeader
        icon={MessageCircle}
        title="Tutor IA"
        description="Faça perguntas sobre qualquer matéria do edital. Arraste PDFs para anexar."
        actions={
          messages.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={previewPDF} disabled={gerandoPreview || exportando} className="gap-1.5">
                {gerandoPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Pré-visualizar PDF
              </Button>
              <Button variant="outline" size="sm" onClick={novaConversa} className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova conversa
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Diálogo de pré-visualização A4 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl p-0 sm:max-w-[min(960px,95vw)]">
          <DialogHeader className="border-b border-border px-5 py-3">
            <DialogTitle className="text-base">Pré-visualização · A4</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/40 p-3">
            {previewUrl ? (
              <iframe
                title="Pré-visualização do PDF do Tutor IA"
                src={previewUrl}
                className="h-[70vh] w-full rounded-lg border border-border bg-white shadow-elegant"
              />
            ) : (
              <div className="flex h-[70vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 border-t border-border px-5 py-3">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button
              onClick={baixarPDF}
              disabled={exportando || !previewBlob}
              className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
            >
              {exportando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Área de mensagens com drag & drop */}
      <div
        ref={chatRef}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative mt-4 flex-1 space-y-4 overflow-y-auto rounded-2xl pr-1 transition-colors ${
          arrastando ? "ring-2 ring-primary ring-offset-2 bg-primary/5" : ""
        }`}
      >
        {/* Overlay de drag */}
        {arrastando && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-background/90 px-6 py-4 shadow-elegant ring-1 ring-primary/40">
              <Upload className="h-8 w-8 text-primary" />
              <p className="text-sm font-semibold text-foreground">Solte o PDF aqui</p>
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <div className="animate-fade-in-up rounded-2xl border border-dashed border-border bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">Comece com uma destas perguntas ou arraste um PDF:</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-left text-sm text-foreground transition-smooth hover:border-primary/40 hover:bg-card"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`animate-fade-in-up flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-elegant ${
                m.role === "user"
                  ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                  : "bg-card text-foreground ring-1 ring-border"
              }`}
            >
              {m.role === "assistant" ? <Markdown>{m.content || "…"}</Markdown> : m.content}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-card px-4 py-3 ring-1 ring-border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-4 rounded-2xl border border-border bg-card p-2"
      >
        {/* PDFs anexados */}
        {pdfsAnexos.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pdfsAnexos.map((pdf, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 ring-1 ring-primary/30"
              >
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="max-w-[180px] truncate text-xs text-foreground">
                  <strong>{pdf.nome}</strong>{" "}
                  <span className="text-muted-foreground">
                    · {pdf.caracteres.toLocaleString("pt-BR")} chars{pdf.truncado ? " (truncado)" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removerPdf(idx)}
                  className="rounded p-1 text-muted-foreground transition-smooth hover:bg-background hover:text-foreground"
                  aria-label="Remover PDF"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={onSelecionarPdf}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={enviandoPdf || loading || pdfsAnexos.length >= MAX_PDFS}
            onClick={() => fileInputRef.current?.click()}
            title={pdfsAnexos.length >= MAX_PDFS ? `Máximo ${MAX_PDFS} PDFs` : "Anexar PDF"}
            className="shrink-0"
          >
            {enviandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            placeholder={
              pdfsAnexos.length > 0
                ? "Pergunte algo sobre o(s) PDF(s) ou envie em branco para um resumo…"
                : "Faça sua pergunta… (Enter envia · Shift+Enter pula linha)"
            }
            className="min-h-[60px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
          />
          <Button
            type="submit"
            disabled={loading || (!input.trim() && pdfsAnexos.length === 0)}
            className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MIME_OK_PDF(file: File): boolean {
  return file.type === "application/pdf" || file.name.endsWith(".pdf");
}
