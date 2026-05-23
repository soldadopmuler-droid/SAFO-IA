import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supa = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: userErr } = await supa.auth.getUser(auth.slice(7));
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const conteudo = typeof body?.conteudo === "string" ? body.conteudo : "";
    if (!conteudo.trim() || conteudo.length < 50) {
      return new Response(JSON.stringify({ error: "Conteúdo muito curto para revisar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (conteudo.length > 80_000) {
      return new Response(JSON.stringify({ error: "Conteúdo excede 80k caracteres." }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um revisor profissional de português do Brasil para apostilas jurídicas e policiais (CFP/PM-PR). Aja como copidesque rigoroso: revise FRASE A FRASE, sem pular nenhum parágrafo.

TAREFA: receber um texto em **markdown** e devolver o MESMO texto, COM A MESMA ESTRUTURA MARKDOWN (headings #, ##, ###, listas, tabelas, blockquotes, negritos **, itálicos *, código \`), mas:

- Corrija TODOS os erros de ortografia, acentuação, crase, concordância nominal/verbal, regência verbal/nominal, pontuação e colocação pronominal.
- ERROS COMUNS A CAÇAR (lista não exaustiva): "concerteza" → "com certeza"; "previlégio" → "privilégio"; "houveram pessoas" → "houve pessoas"; "a nível de" → "em nível de"; "menas" → "menos"; "mediante a" → "mediante"; "fazem dois anos" → "faz dois anos"; "afim de" (finalidade) → "a fim de"; "haja visto" → "haja vista"; "para mim fazer" → "para eu fazer"; "entre eu e você" → "entre mim e você"; "se eu ver" → "se eu vir"; "se eu por" → "se eu puser"; "meio-dia e meio" → "meio-dia e meia"; "venda à vista" (correto), "à medida que" (proporção), "na medida em que" (causa); evite "onde" para coisas (use "em que"); "porque/por que/porquê/por quê" (use cada um na função certa); "mas/mais", "mau/mal", "tampouco/tão pouco", "senão/se não", "acerca/há cerca/a cerca", "ao invés de/em vez de".
- ERROS FREQUENTES NO CONTEXTO POLICIAL/MILITAR: "Polícia Militar" (não "policia"), "patrulhamento" (não "patrulamento"), "abordagem" (não "abordajem"), "viatura" (não "viátura"), "ostensivo" (não "hostensivo"), "detenção/detensão" → "detenção", "porte/porti" → "porte", "apreensão" (não "apreenção"), "infração" (não "infração" sem til é erro; sempre "infração"), "trânsito" (sempre com til), "condução coercitiva" (não "condução cohersitiva"), "nexo causal", "tipicidade", "antijuridicidade", "culpabilidade" (escritas exatas), "habeas corpus" (em itálico, sem hífen).
- PADRONIZAÇÃO MILITAR: nomes de patentes em maiúscula apenas quando antecederem nome próprio ("Sd. Silva", "Cb. Souza", "Cap. Lima"); siglas sempre em maiúscula sem ponto (PMPR, CFP, BPM, COPOM, CIOSP, ROTAM); "Polícia Militar do Paraná" por extenso na primeira menção, depois "PM-PR" ou "PMPR".
- LEGISLAÇÃO: cite sempre "art. 5º, XXXIX, CF/88" (com º e vírgula, sem espaço extra); "Lei nº 9.503/97 (CTB)"; "Decreto-Lei nº 1.001/69 (CPM)"; "súmula nº 711 do STF". Nunca abrevie "artigo" como "Art." ou "ART." dentro do texto corrido.
- Garanta acentuação correta: "também", "público", "código", "polícia", "exército", "última", "será", "está", "porém", "três", "país", "ônibus", "tórax", "júri", "açúcar", "saída", "saúde". Reescreva sem trema.
- Crase: use SEMPRE em "às" + horas definidas, "à medida que", "à vista", "à mão", "à noite". Nunca use crase antes de verbo, pronome pessoal, masculino ou artigo indefinido.
- Aplique vírgulas e pontuação conforme a norma culta. Quebre frases longas demais (acima de 30 palavras).
- Padronize números: "art. 5º" (com º), "§ 2º", "inciso II", "parágrafo único". Datas: "22 de outubro de 2025".
- Mantenha termos técnicos jurídicos (dolo, culpa stricto sensu, in dubio pro reo, habeas corpus em itálico).
- NÃO invente conteúdo novo. NÃO remova seções. NÃO troque artigos de lei. NÃO traduza siglas (PM-PR, CFP, CTB, CF/88, STF, STJ).
- REFORCE O **negrito** em palavras-chave de cada parágrafo: termos técnicos centrais, números de artigos, prazos legais, requisitos cumulativos, palavras "obrigatório/proibido/permitido/exclusivo/somente/apenas". Aplique em 2-4 termos por parágrafo (sem exagerar — não negrite frases inteiras).
- DESTAQUE TEMAS PRINCIPAIS: quando um parágrafo introduzir um conceito-chave (definição, classificação, princípio), inicie com o termo em **negrito**. Ex.: "**Crime militar próprio** é aquele que..."
- Preserve emojis dos headings (🎯 📚 ⚠️ ⚖️ 💡 ✅ 📌 🗺️ 🧠 📊 📝 🔑 📖 🚦 🛑 📑 🚨 🛂 🚗 🧒).
- Preserve INTEGRALMENTE blocos de código fenced (\`\`\`mindmap ... \`\`\`, \`\`\`json ... \`\`\`) — NÃO altere uma vírgula sequer dentro deles.
- Preserve a numeração e a ordem das questões e o gabarito.

SAÍDA: apenas o markdown revisado, sem comentários, sem cercas \`\`\`, sem prefácio. Comece pela primeira linha do texto original já corrigida.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: conteudo },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let revisado: string = data?.choices?.[0]?.message?.content ?? "";
    // Remove eventuais cercas ```markdown que o modelo possa ter adicionado
    revisado = revisado.replace(/^```(?:markdown|md)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    if (!revisado || revisado.length < 50) {
      return new Response(JSON.stringify({ error: "Revisão veio vazia." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ conteudo: revisado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("revisar-apostila error:", e);
    return new Response(JSON.stringify({ error: "Erro interno na revisão" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});