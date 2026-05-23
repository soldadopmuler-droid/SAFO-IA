import type { jsPDF } from "jspdf";

/**
 * Cabeçalho e rodapé padrão "974 SAFO" inspirado no layout vertical da
 * Implacável Concursos (bloco de marca à esquerda + banner diagonal
 * preto/dourado à direita; rodapé com slogan central + página em badge dourado).
 *
 * Compartilhado entre Apostila, Tutor e Resumo para identidade visual única.
 */

export type PdfChromeOpts = {
  userName?: string;
  userEmail?: string;
  dataStr: string;
  pageNum?: number;
  total?: number;
  /** Subtítulo no banner direito do header (ex.: "APOSTILA · DIREITO PENAL") */
  eyebrow?: string;
  /** Logo opcional (PNG dataURL) — desenhado dentro do bloco de marca */
  logoData?: { data: string; w: number; h: number } | null;
  /** Slogan central do rodapé. Default: "JUNTOS SOMOS IMPLACÁVEIS" */
  slogan?: string;
};

const GOLD: [number, number, number] = [201, 162, 39];
const GOLD_DARK: [number, number, number] = [160, 124, 18];
const INK: [number, number, number] = [18, 20, 26];

export function drawSafoChrome(pdf: jsPDF, pdfW: number, pdfH: number, opts: PdfChromeOpts) {
  const {
    userName, userEmail, dataStr, pageNum, total,
    eyebrow, logoData, slogan = "JUNTOS SOMOS IMPLACÁVEIS",
  } = opts;

  // ====== HEADER ======
  const headerH = 22;

  // Bloco esquerdo (claro, com a marca)
  pdf.setFillColor(248, 248, 248);
  pdf.rect(0, 0, pdfW * 0.42, headerH, "F");

  // Logo (se houver) ou bullet dourado
  if (logoData) {
    try {
      const ratio = logoData.h / logoData.w;
      const lw = 12;
      pdf.addImage(logoData.data, "PNG", 10, (headerH - lw * ratio) / 2, lw, lw * ratio);
    } catch { /* ignore */ }
  } else {
    pdf.setFillColor(...GOLD);
    pdf.circle(14, headerH / 2, 2.4, "F");
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...INK);
  pdf.text("974 SAFO", logoData ? 26 : 20, headerH / 2 - 1);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120);
  pdf.text("PLATAFORMA DE ESTUDOS", logoData ? 26 : 20, headerH / 2 + 4);

  // Banner direito preto com chevron dourado
  const bx = pdfW * 0.42;
  const bw = pdfW - bx;
  pdf.setFillColor(...INK);
  pdf.rect(bx, 0, bw, headerH, "F");
  // Chevron dourado (paralelogramo) inspirado no modelo de referência
  pdf.setFillColor(...GOLD);
  pdf.triangle(bx, 0, bx + 14, 0, bx, headerH, "F");
  pdf.setFillColor(...GOLD_DARK);
  pdf.triangle(bx + 8, 0, bx + 22, 0, bx + 8, headerH, "F");

  // Texto do banner
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(220, 220, 220);
  pdf.text("974 SAFO · ESTUDOS", pdfW - 10, 8.5, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...GOLD);
  pdf.text((eyebrow || "MATERIAL DE ESTUDO").toUpperCase(), pdfW - 10, 15, { align: "right" });

  // Filete dourado abaixo do header
  pdf.setFillColor(...GOLD);
  pdf.rect(0, headerH, pdfW, 0.8, "F");

  // ====== FOOTER ======
  const footerH = 14;
  const fy = pdfH - footerH;

  // Filete dourado acima do rodapé
  pdf.setFillColor(...GOLD);
  pdf.rect(0, fy, pdfW, 0.8, "F");

  // Esquerda: ícones (placeholder em texto) e identificação do aluno
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120);
  if (userName) pdf.text(userName, 10, fy + 6);
  if (userEmail) pdf.text(userEmail, 10, fy + 10);

  // Centro: slogan
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...INK);
  pdf.text(slogan, pdfW / 2, fy + 8, { align: "center" });

  // Direita: badge dourado com número da página
  if (pageNum != null) {
    const label = total ? `${pageNum} / ${total}` : String(pageNum);
    pdf.setFillColor(...INK);
    const bw2 = 18, bh = 8;
    pdf.rect(pdfW - bw2 - 10, fy + 3, bw2, bh, "F");
    pdf.setFillColor(...GOLD);
    pdf.rect(pdfW - bw2 - 10, fy + 3, 2.2, bh, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...GOLD);
    pdf.text(label, pdfW - 10 - bw2 / 2 + 1.1, fy + 8.5, { align: "center" });
  } else {
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    pdf.text(dataStr, pdfW - 10, fy + 8, { align: "right" });
  }
}

/** Margens recomendadas (mm) para conteúdo entre o chrome desenhado por drawSafoChrome. */
export const SAFO_CHROME_MARGIN = {
  top: 26,    // headerH (22) + filete (0.8) + respiro
  bottom: 18, // footerH (14) + filete + respiro
  x: 14,
};
