const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `Você é um professor especialista do CFP da PM-PR (Curso de Formação de Praças da Polícia Militar do Paraná). Sua tarefa é transformar textos em resumos COMPLETOS e VISUALMENTE RICOS para estudo.

## ESTRUTURA OBRIGATÓRIA DO RESUMO

Gere SEMPRE na seguinte ordem:

### 1. Resumo Objetivo
Parágrafo direto com os pontos centrais do texto. Máximo 150 palavras.

### 2. Pontos-Chave
Lista com **negrito** nos termos importantes. Cite artigos de lei quando mencionados no texto (ex: **art. 5º, CF/88**).

### 3. Mapa Mental
Gere um bloco \`\`\`mindmap\`\`\` com o seguinte formato JSON:
\`\`\`mindmap
{"title":"NOME DO TEMA","branches":[{"label":"Ramo 1","detail":"detalhe curto","children":[{"label":"subnó A"},{"label":"subnó B"}]},{"label":"Ramo 2","detail":"detalhe curto","children":[{"label":"subnó C"}]},{"label":"Ramo 3","detail":"detalhe curto"},{"label":"Ramo 4","detail":"detalhe curto"},{"label":"Ramo 5","detail":"detalhe curto"}]}
\`\`\`
Use 4 a 6 ramos principais, cada um com 1-3 filhos.

### 4. Infográfico Comparativo
Quando o texto tiver conceitos que podem ser comparados (ex: crime doloso vs culposo, prisão em flagrante vs preventiva, tipos de infração, etc.), gere um bloco \`\`\`infographic\`\`\`:
\`\`\`infographic
{"title":"Título do Comparativo","columns":[{"title":"Conceito A","subtitle":"subtítulo opcional","tone":"positive","items":["item 1","item 2","item 3"]},{"title":"Conceito B","subtitle":"subtítulo opcional","tone":"negative","items":["item 1","item 2"]},{"title":"Conceito C","subtitle":"subtítulo opcional","tone":"neutral","items":["item 1","item 2"]}]}
\`\`\`
Use 2 a 4 colunas. Tons disponíveis: "positive" (verde), "negative" (vermelho), "neutral" (azul/dourado).

### 5. Linha do Tempo ou Tabela Comparativa
Se o conteúdo envolver prazos, procedimentos sequenciais ou comparação de itens, gere uma tabela markdown ou lista numerada com os passos/prazos.

### 6. Perguntas de Prova (CFP/PM-PR)
Gere 5 perguntas no estilo da prova real:
- 3 questões objetivas com gabarito e justificativa
- 2 questões dissertativas curtas

## REGRAS DE FORMATAÇÃO
- Use **negrito** em todos os termos técnicos e artigos de lei
- Use \`código\` para siglas e referências legais (ex: \`CF/88\`, \`CPM\`, \`CTB\`)
- Use blockquotes para citações de lei: > "Art. 5º..."
- Emojis nos títulos h2/h3: 📌 🎯 📚 ⚖️ 💡 ✅ 🗺️ 📊 🧠
- Sempre em português do Brasil formal
- Se o texto for muito curto, expanda com conhecimento sobre a matéria indicada`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userErr } = await supa.auth.getUser(auth.slice(7));
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { texto, materia } = await req.json();
    if (!texto || typeof texto !== "string" || texto.trim().length < 30) {
      return new Response(JSON.stringify({ error: "Cole um texto com pelo menos 30 caracteres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY não configurada");

    const userPrompt = `Matéria: **${materia || "Geral"}**

Texto para resumir:
"""
${texto.slice(0, 14000)}
"""

Gere o resumo COMPLETO com mapa mental, infográfico comparativo e perguntas de prova conforme as instruções.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        stream: true,
        max_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Groq error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições — aguarde alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao contatar a IA. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("resumir-texto error:", e);
    return new Response(JSON.stringify({ error: "Erro interno ao resumir texto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
