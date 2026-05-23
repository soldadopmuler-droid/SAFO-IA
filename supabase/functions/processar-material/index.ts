import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import * as pdfjs from "https://esm.sh/pdfjs-serverless@0.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Divide o texto em chunks sobrepostos para RAG
function chunkarTexto(texto: string, tamChunk = 600, overlap = 100): string[] {
  const chunks: string[] = [];
  let inicio = 0;
  while (inicio < texto.length) {
    const fim = Math.min(inicio + tamChunk, texto.length);
    const chunk = texto.slice(inicio, fim).trim();
    if (chunk.length > 30) chunks.push(chunk);
    if (fim === texto.length) break;
    inicio = fim - overlap;
  }
  return chunks;
}

async function extrairPdf(bytes: Uint8Array): Promise<string> {
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  let texto = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((it: { str?: string }) => it.str ?? "").join(" ") + "\n\n";
  }
  return texto.trim();
}

async function extrairTexto(bytes: Uint8Array): Promise<string> {
  return new TextDecoder("utf-8").decode(bytes);
}

async function extrairDocx(bytes: Uint8Array): Promise<string> {
  const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
  const zip = await JSZip.loadAsync(bytes);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new Error("DOCX inválido");
  const paragrafos = docXml.split(/<\/w:p>/);
  const out: string[] = [];
  for (const p of paragrafos) {
    const matches = [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
    const txt = matches.map((m) => m[1]).join("");
    if (txt.trim()) out.push(txt);
  }
  return out.join("\n\n");
}

async function chamarIA(systemPrompt: string, userPrompt: string, jsonMode = false): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`IA [${r.status}]: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Não autenticado");
    const { data: u, error: uErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (uErr || !u.user) throw new Error("Sessão inválida");
    const userId = u.user.id;

    const { material_id, acoes } = (await req.json()) as {
      material_id: string;
      acoes: Array<"resumo" | "flashcards" | "questoes">;
    };
    if (!material_id) throw new Error("material_id obrigatório");

    const { data: mat, error: matErr } = await supabase
      .from("materiais")
      .select("*")
      .eq("id", material_id)
      .eq("user_id", userId)
      .single();
    if (matErr || !mat) throw new Error("Material não encontrado");

    let texto = mat.texto_extraido as string | null;

    if (!texto) {
      await supabase.from("materiais").update({ status: "extraindo" }).eq("id", material_id);
      const { data: file, error: dlErr } = await supabase.storage.from("materiais").download(mat.storage_path);
      if (dlErr) throw dlErr;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const tipo = mat.tipo_arquivo as string;

      if (tipo === "application/pdf") texto = await extrairPdf(bytes);
      else if (tipo === "text/plain") texto = await extrairTexto(bytes);
      else if (tipo.includes("wordprocessingml")) texto = await extrairDocx(bytes);
      else throw new Error("Tipo de arquivo não suportado");

      texto = texto.replace(/\s+/g, " ").trim();
      if (texto.length < 50) throw new Error("Texto extraído muito curto");
      const textoIA = texto.slice(0, 20000);

      await supabase.from("materiais").update({ texto_extraido: textoIA, status: "processando" }).eq("id", material_id);
      texto = textoIA;
    }

    // Salva chunks para RAG se ainda não existirem
    const { count: chunksExist } = await supabase
      .from("chunks_materiais")
      .select("id", { count: "exact", head: true })
      .eq("material_id", material_id);

    if (!chunksExist || chunksExist === 0) {
      const chunks = chunkarTexto(texto);
      if (chunks.length > 0) {
        await supabase.from("chunks_materiais").insert(
          chunks.map((c, i) => ({
            material_id,
            user_id: userId,
            materia: (mat.materia as string | null) ?? null,
            conteudo: c,
            chunk_index: i,
          })),
        );
      }
    }

    const materia = (mat.materia as string | null) ?? "Geral";
    const updates: Record<string, unknown> = {};

    if (acoes.includes("resumo")) {
      const resumo = await chamarIA(
        `Você resume materiais para alunos do CFP da PM-PR. Saída em markdown com:
# Resumo
(parágrafo curto)
## Pontos-chave
- ...
## Possíveis questões de prova
1. ...
Cite artigos de lei quando o texto mencionar.`,
        `Matéria: ${materia}\n\nTexto:\n"""\n${texto}\n"""`,
      );
      updates.resumo = resumo;
    }

    if (acoes.includes("flashcards")) {
      const fc = await chamarIA(
        `Gere flashcards (frente/verso) baseados no texto. Saída JSON: {"cards":[{"frente":"...","verso":"..."}]}. Mínimo 5, máximo 10 cards. Frente = pergunta curta. Verso = resposta direta com art. de lei se aplicável.`,
        `Matéria: ${materia}\n\nTexto:\n"""\n${texto.slice(0, 12000)}\n"""`,
        true,
      );
      try {
        const parsed = JSON.parse(fc) as { cards: Array<{ frente: string; verso: string }> };
        if (parsed.cards?.length) {
          await supabase.from("flashcards").insert(
            parsed.cards.map((c) => ({
              user_id: userId,
              materia,
              frente: c.frente,
              verso: c.verso,
            })),
          );
        }
      } catch (e) {
        console.error("flashcards parse err", e);
      }
    }

    if (acoes.includes("questoes")) {
      const q = await chamarIA(
        `Gere questões de múltipla escolha baseadas no texto. Saída JSON: {"questoes":[{"enunciado":"...","alternativas":{"A":"...","B":"...","C":"...","D":"..."},"gabarito":"A","explicacao":"..."}]}. Entre 3 e 5 questões. Estilo banca de concurso PM-PR.`,
        `Matéria: ${materia}\n\nTexto:\n"""\n${texto.slice(0, 12000)}\n"""`,
        true,
      );
      updates.questoes_geradas = q;
    }

    updates.status = "pronto";
    await supabase.from("materiais").update(updates).eq("id", material_id);

    return new Response(
      JSON.stringify({ ok: true, resumo: updates.resumo ?? null, questoes: updates.questoes_geradas ?? null }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("processar-material erro:", e);
    const errMsg = e instanceof Error ? e.message : "Erro desconhecido ao processar";
    const safeMessages = [
      "Não autenticado",
      "Sessão inválida",
      "material_id obrigatório",
      "Material não encontrado",
      "Tipo de arquivo não suportado",
      "Texto extraído muito curto",
    ];
    const clientMsg = safeMessages.includes(errMsg) ? errMsg : "Erro ao processar material";
    try {
      if (material_id) {
        await supabase.from("materiais").update({ status: "erro", erro: clientMsg }).eq("id", material_id);
      }
    } catch { /* silencioso */ }
    return new Response(JSON.stringify({ error: clientMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
