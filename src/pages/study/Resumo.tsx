import { useRef, useState } from "react";
import { FileText, Sparkles, Loader2, Paperclip, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/study/PageHeader";
import { Markdown } from "@/components/study/Markdown";
import { MATERIAS } from "@/lib/materias";
import { streamSSE } from "@/lib/streamSSE";
import { extrairPdf } from "@/lib/extrairPdf";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { drawSafoChrome, SAFO_CHROME_MARGIN } from "@/lib/pdfChrome";

export default function Resumo() {
  const { user } = useAuth();
  const [materia, setMateria] = useState(MATERIAS[0].nome);
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviandoPdf, setEnviandoPdf] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [pdfNome, setPdfNome] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  const onSelecionarPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviandoPdf(true);
    try {
      const res = await extrairPdf(file);
      setTexto(res.texto);
      setPdfNome(res.nome);
      toast.success(`PDF "${res.nome}" carregado${res.truncado ? " (truncado)" : ""}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ler o PDF");
    } finally {
      setEnviandoPdf(false);
    }
  };

  const limparPdf = () => { setPdfNome(null); setTexto(""); };

  const resumir = async () => {
    if (texto.trim().length < 30) { toast.error("Cole um texto com pelo menos 30 caracteres."); return; }
    setLoading(true); setResultado("");
    try {
      await streamSSE("resumir-texto", { materia, texto }, (c) => setResultado((p) => p + c));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao resumir");
    } finally { setLoading(false); }
  };

  const exportarPDF = async () => {
    if (!resultado || !resultadoRef.current) return;
    setExportando(true);
    const tid = toast.loading("Gerando PDF do resumo…");

    try {
      const userName =
        (user?.user_metadata as { display_name?: string; full_name?: string } | undefined)?.display_name ||
        (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
        user?.email?.split("@")[0] || "Aluno 974 SAFO";
      const userEmail = user?.email ?? "";
      const dataStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

      // ===== Wrapper offscreen com CSS rico (igual Apostila) =====
      const wrapper = document.createElement("div");
      wrapper.style.cssText = [
        "position:fixed", "left:-99999px", "top:0",
        "width:680px", "padding:0", "box-sizing:border-box",
        "background:#ffffff", "color:#111111",
        "font-family:'Helvetica Neue',Arial,Helvetica,sans-serif",
        "font-size:13.5px", "line-height:1.7",
      ].join(";");

      const styleTag = document.createElement("style");
      styleTag.textContent = `
        .res-doc * { box-sizing:border-box; max-width:100%; word-wrap:break-word; }
        .res-doc h1 {
          font-size:24px; font-weight:900; color:#0c0c0c;
          margin:28px 0 12px; padding:14px 20px;
          background:linear-gradient(90deg,#f7ecbf 0%,#fffaea 60%,#fff 100%);
          border-left:6px solid #c9a227; border-radius:6px;
          box-shadow:0 6px 12px -8px rgba(201,162,39,.4);
          page-break-after:avoid; break-inside:avoid;
        }
        .res-doc h2 {
          font-size:18px; font-weight:800; color:#1a1a1a;
          margin:20px 0 8px; padding:4px 0 6px 12px;
          border-bottom:2px solid #e6c769; border-left:3px solid #c9a227;
          page-break-after:avoid; break-inside:avoid;
        }
        .res-doc h3 {
          font-size:14px; font-weight:800; color:#5a4408;
          margin:14px 0 5px; text-transform:uppercase; letter-spacing:.04em;
          page-break-after:avoid; break-inside:avoid;
        }
        .res-doc p { margin:0 0 10px; text-align:justify; hyphens:auto; }
        .res-doc strong { color:#1a1a1a; font-weight:800; }
        .res-doc em { font-style:italic; font-weight:600; }
        .res-doc ul, .res-doc ol { padding-left:22px; margin:8px 0 14px; }
        .res-doc li { margin:4px 0; }
        .res-doc li::marker { color:#c9a227; font-weight:800; }
        .res-doc table {
          border-collapse:collapse; width:100%; margin:12px 0 18px;
          font-size:12px; page-break-inside:avoid; break-inside:avoid;
        }
        .res-doc th {
          background:#1a1a1a; color:#f5e8b8; text-align:left;
          padding:8px 10px; font-weight:700; letter-spacing:.02em;
        }
        .res-doc td { padding:7px 10px; border-bottom:1px solid #e6e1d6; vertical-align:top; }
        .res-doc tr:nth-child(even) td { background:#faf7ee; }
        .res-doc blockquote {
          margin:12px 0; padding:12px 14px 12px 16px;
          border-left:4px solid #c9a227; background:#fbf6df;
          border-radius:6px; page-break-inside:avoid; break-inside:avoid;
        }
        .res-doc blockquote p { margin:0; }
        .res-doc hr { border:none; border-top:1px dashed #c9a227; margin:18px 0; }
        .res-doc code {
          background:#f3efe1; color:#7a5e0d; padding:1px 5px;
          border-radius:3px; font-size:.9em;
          font-family:ui-monospace,Menlo,Consolas,monospace;
        }
        /* Caixas especiais */
        .res-doc .def-box {
          background:linear-gradient(180deg,#fffaea,#fff5d2);
          border:1px solid #e6c769; border-left:5px solid #c9a227;
          border-radius:8px; padding:12px 14px; margin:12px 0 14px;
          page-break-inside:avoid; break-inside:avoid; position:relative;
        }
        .res-doc .def-box::before {
          content:"📖 DEFINIÇÃO"; position:absolute; top:-9px; left:12px;
          background:#c9a227; color:#1a1a1a; font-size:9px; font-weight:800;
          letter-spacing:.06em; padding:2px 7px; border-radius:3px;
        }
        .res-doc .alert-box {
          background:#fff2e6; border:1px solid #f0b070; border-left:5px solid #e07b00;
          border-radius:8px; padding:12px 14px 12px 40px; margin:12px 0 14px;
          page-break-inside:avoid; break-inside:avoid; position:relative;
        }
        .res-doc .alert-box::before {
          content:"⚠"; position:absolute; left:12px; top:10px;
          font-size:20px; color:#e07b00;
        }
        .res-doc .law-box {
          background:#eef2fb; border:1px solid #b8c6e8; border-left:5px solid #2c54a8;
          border-radius:8px; padding:12px 14px 12px 40px; margin:12px 0 14px;
          page-break-inside:avoid; break-inside:avoid; position:relative;
          font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12.5px; color:#1a2548;
        }
        .res-doc .law-box::before {
          content:"§"; position:absolute; left:14px; top:6px;
          font-size:26px; color:#2c54a8; font-weight:900;
        }
        /* Infográfico */
        .res-doc [class*="rounded-2xl"][class*="border"][class*="bg-card"] {
          background:#faf7ee !important; border:1px solid #e6c769 !important;
          border-radius:12px; padding:16px; margin:14px 0;
          page-break-inside:avoid; break-inside:avoid;
        }
        /* Mapa mental */
        .res-doc [class*="grid-cols"] { display:block !important; }
        .res-doc svg { display:none !important; }
      `;
      wrapper.appendChild(styleTag);

      const clone = resultadoRef.current.cloneNode(true) as HTMLElement;
      clone.className = "res-doc";
      clone.style.color = "#111";
      clone.querySelectorAll<HTMLElement>("[class*='prose']").forEach((el) => el.removeAttribute("class"));
      clone.querySelectorAll<HTMLElement>("*").forEach((el) => {
        if (!el.className.includes("res-doc") && !el.className.includes("def-box") &&
            !el.className.includes("alert-box") && !el.className.includes("law-box")) {
          el.style.background = "transparent";
          el.style.color = "";
        }
      });
      // Classifica caixas especiais pelos prefixos
      clone.querySelectorAll<HTMLParagraphElement>("p").forEach((p) => {
        const txt = (p.textContent || "").trim();
        if (/^(Definição|Conceito|Em síntese)\s*[:\-—]/i.test(txt)) p.classList.add("def-box");
        else if (/^(Importante|Atenção|Cuidado)\s*[:\-—]/i.test(txt)) p.classList.add("alert-box");
        else if (/^(Art\.?\s*\d+|Artigo\s*\d+|Súmula\s*\d+)/i.test(txt)) p.classList.add("law-box");
      });

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      // Captura de alta qualidade (scale 3 = 300 DPI equivalente)
      const canvas = await html2canvas(wrapper, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 8000,
      });
      document.body.removeChild(wrapper);

      // ===== Monta o PDF =====
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

      // ===== CAPA — estilo Apostila (preto/dourado) =====
      pdf.setFillColor(8, 10, 14);
      pdf.rect(0, 0, pdfW, pdfH, "F");
      // Faixa lateral dourada
      pdf.setFillColor(201, 162, 39);
      pdf.rect(0, 0, 6, pdfH, "F");
      // Cantoneiras
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.5);
      const cm = 12, cl = 24;
      pdf.line(cm, cm, cm + cl, cm); pdf.line(cm, cm, cm, cm + cl);
      pdf.line(pdfW - cm, cm, pdfW - cm - cl, cm); pdf.line(pdfW - cm, cm, pdfW - cm, cm + cl);
      pdf.line(cm, pdfH - cm, cm + cl, pdfH - cm); pdf.line(cm, pdfH - cm, cm, pdfH - cm - cl);
      pdf.line(pdfW - cm, pdfH - cm, pdfW - cm - cl, pdfH - cm); pdf.line(pdfW - cm, pdfH - cm, pdfW - cm, pdfH - cm - cl);
      // Marca 974 SAFO
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(248, 248, 248);
      pdf.text("974 SAFO", 20, 26);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(190, 190, 190);
      pdf.text("PLATAFORMA DE ESTUDOS · CFP/PM-PR", 20, 32);
      // Eyebrow dourado
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(201, 162, 39);
      pdf.text("RESUMO · " + materia.toUpperCase(), marginX, pdfH / 2 - 34);
      pdf.setDrawColor(201, 162, 39); pdf.setLineWidth(0.8);
      pdf.line(marginX, pdfH / 2 - 30, marginX + 22, pdfH / 2 - 30);
      // Título grande
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(28); pdf.setTextColor(248, 248, 248);
      const tLines = pdf.splitTextToSize(materia, pdfW - marginX * 2 - 10);
      pdf.text(tLines, marginX, pdfH / 2 - 18);
      // Autor e data
      const yMeta = pdfH / 2 + tLines.length * 10 + 4;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(190, 190, 190);
      pdf.text(userName, marginX, yMeta);
      pdf.setFontSize(9); pdf.setTextColor(140, 140, 140);
      pdf.text(dataStr, marginX, yMeta + 6);
      // Rodapé da capa
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(190, 190, 190);
      pdf.text("974SAFO.COM", marginX, pdfH - 20);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(140, 140, 140);
      pdf.text("Material gerado por IA — sempre confira nas fontes oficiais.", marginX, pdfH - 14);

      // ===== PÁGINAS DE CONTEÚDO =====
      let cursor = 0;
      let pageNum = 0;
      const totalPages = Math.ceil(canvas.height / pageHeightPx);

      while (cursor < canvas.height) {
        pdf.addPage();
        pageNum++;

        drawSafoChrome(pdf, pdfW, pdfH, {
          userName, userEmail, dataStr,
          pageNum: p + 1, total: totalPages,
          eyebrow: `RESUMO · ${materia.toUpperCase()}`,
        });

        // Cantoneiras finas
        const pm = 8, pl = 12;
        pdf.setDrawColor(180, 180, 180); pdf.setLineWidth(0.3);
        pdf.line(pm, pm, pm + pl, pm); pdf.line(pm, pm, pm, pm + pl);
        pdf.line(pdfW - pm, pm, pdfW - pm - pl, pm); pdf.line(pdfW - pm, pm, pdfW - pm, pm + pl);
        pdf.line(pm, pdfH - pm, pm + pl, pdfH - pm); pdf.line(pm, pdfH - pm, pm, pdfH - pm - pl);
        pdf.line(pdfW - pm, pdfH - pm, pdfW - pm - pl, pdfH - pm); pdf.line(pdfW - pm, pdfH - pm, pdfW - pm, pdfH - pm - pl);

        // Header
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(80, 80, 80);
        pdf.text(userName, marginX, 13);
        pdf.setFontSize(7); pdf.setTextColor(140, 140, 140);
        pdf.text(`Resumo IA · ${materia}`, pdfW / 2, 13, { align: "center" });
        if (userEmail) pdf.text(userEmail, pdfW - marginX, 13, { align: "right" });

        // Marca d'água diagonal com nome do aluno
        addWatermark(pdf, pdfW, pdfH, userName);

        // Fatia do canvas
        const sliceH = Math.min(pageHeightPx, canvas.height - cursor);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        slice.getContext("2d")!.drawImage(canvas, 0, cursor, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        pdf.addImage(slice.toDataURL("image/jpeg", 0.93), "JPEG", marginX, headerH, contentW, sliceH / pxPerMM);
        cursor += sliceH;

        // Footer
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(20, 20, 20);
        pdf.text("974SAFO.COM", marginX, pdfH - 8);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(60, 60, 60);
        pdf.text(`${pageNum} / ${totalPages}`, pdfW / 2, pdfH - 8, { align: "center" });
        pdf.setFontSize(8); pdf.setTextColor(120, 120, 120);
        pdf.text(dataStr, pdfW - marginX, pdfH - 8, { align: "right" });
      }

      const slug = materia.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
      pdf.save(`resumo-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exportado com sucesso!", { id: tid });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar PDF", { id: tid });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        icon={FileText}
        title="Resumos IA"
        description="Cole um texto ou anexe um PDF e receba resumo, pontos-chave e perguntas de prova."
      />

      <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={materia} onValueChange={setMateria}>
            <SelectTrigger className="sm:w-[260px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MATERIAS.map((m) => (<SelectItem key={m.slug} value={m.nome}>{m.nome}</SelectItem>))}
            </SelectContent>
          </Select>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onSelecionarPdf} />
          <Button type="button" variant="outline" disabled={enviandoPdf || loading} onClick={() => fileInputRef.current?.click()}>
            {enviandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            <span className="ml-2">Anexar PDF</span>
          </Button>
          <Button onClick={resumir} disabled={loading} className="ml-auto bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-2">Resumir</span>
          </Button>
        </div>
        {pdfNome && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 ring-1 ring-primary/30">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 truncate text-xs text-foreground">
              <strong>{pdfNome}</strong> <span className="text-muted-foreground">· texto carregado abaixo</span>
            </span>
            <button type="button" onClick={limparPdf} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Remover PDF">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui o texto que deseja resumir, ou clique em 'Anexar PDF'…" className="min-h-[180px] resize-y" />
        <p className="text-right text-xs text-muted-foreground">{texto.length} caracteres</p>
      </div>

      {(loading || resultado) && (
        <div className="mt-6 rounded-2xl border border-border bg-card shadow-elegant">
          {resultado && !loading && (
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Resultado · {materia}
              </p>
              <Button size="sm" variant="outline" onClick={exportarPDF} disabled={exportando} className="gap-2">
                {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Exportar PDF
              </Button>
            </div>
          )}
          <div ref={resultadoRef} className="p-6">
            {loading && !resultado ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (<div key={i} className="h-4 rounded shimmer" style={{ width: `${50 + i * 12}%` }} />))}
              </div>
            ) : (
              <Markdown>{resultado}</Markdown>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


