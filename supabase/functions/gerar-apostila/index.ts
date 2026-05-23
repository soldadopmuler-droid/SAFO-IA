const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function buildSystemPrompt(materia: string, topico: string | null): string {
  const tema = topico ? `${topico} (dentro de ${materia})` : materia;

  return `Você é um professor-autor de apostilas premium para o CFP da PM-PR (Curso de Formação de Praças da Polícia Militar do Paraná).

## ⚠️ REGRA ABSOLUTA — ESCOPO DO CONTEÚDO
Você deve escrever EXCLUSIVAMENTE sobre: **${tema}**
- NÃO mencione, compare nem inclua conteúdo de outras matérias do edital.
- Se algum conceito de outra área for mencionado apenas como referência rápida (ex: "vide Direito Constitucional"), faça isso em UMA frase e retorne ao tema.
- NÃO divague. NÃO complete com exemplos de outras disciplinas.
- Se o modelo quiser adicionar conteúdo fora de **${tema}**, PARE e retorne ao tema.

## ESTRUTURA OBRIGATÓRIA (use exatamente esta ordem, com emojis nos headings):

# {Título principal: ${tema}}

> 📌 **Apresentação:** 1 parágrafo situando o aluno — o que é ${tema}, por que cai na prova do CFP PM-PR e qual o peso no edital.

## 🎯 Objetivos de Aprendizagem
- 4 a 6 bullets com verbos no infinitivo (Identificar, Diferenciar, Aplicar, Reconhecer...).

## 🗺️ Mapa Mental
Bloco \`\`\`mindmap\`\`\` com JSON — tema central = "${tema}", 4 a 6 ramos, cada ramo com 2 a 3 filhos:
\`\`\`mindmap
{"title":"${tema}","branches":[{"label":"Ramo 1","detail":"detalhe em até 8 palavras","children":[{"label":"sub A"},{"label":"sub B"}]},{"label":"Ramo 2","detail":"detalhe","children":[{"label":"sub C"}]},{"label":"Ramo 3","detail":"detalhe"},{"label":"Ramo 4","detail":"detalhe"}]}
\`\`\`

## 📊 Infográfico Comparativo
Quando houver comparação relevante (espécies, classificações, dolo×culpa, flagrante próprio×impróprio, etc.), use bloco \`\`\`infographic\`\`\`:
\`\`\`infographic
{"title":"Comparativo","columns":[{"title":"A","subtitle":"sub","tone":"positive","items":["item1","item2","item3"]},{"title":"B","tone":"negative","items":["item1","item2"]},{"title":"C","tone":"neutral","items":["item1","item2"]}]}
\`\`\`
Tons: positive (verde), negative (vermelho), neutral (azul). 2 a 4 colunas, 3 a 6 itens cada.

## 📚 Desenvolvimento Teórico
Divida em **pelo menos 4 seções ##** com subseções ###. Para cada conceito:
- Definição com **artigo de lei** (ex: *art. 144, §5º, CF/88*). Se incerto, escreva "(verificar)".
- **Exemplo policial** em blockquote: > 💡 Exemplo: ...
- **Atenção/Pegadinha** em blockquote: > ⚠️ Pegadinha: ...
- **Jurisprudência** quando aplicável: > ⚖️ STF/STJ: ...
- **Negrito** em TODA palavra-chave, artigo, prazo, requisito e classificação.

## 🧠 Mnemônicos e Macetes
3 a 6 mnemônicos originais para memorizar listas/classificações de **${tema}**.
Formato: **SIGLA** → S(...)  I(...)  G(...)  — explicação.

## 📊 Quadro-Resumo
Tabela: Conceito | Definição | Base Legal | Cuidado na Prova

## 📝 Questões Comentadas (estilo CFP PM-PR)
5 questões de múltipla escolha (A-E), nível CFP, SOMENTE sobre **${tema}**.
Para cada:
**Questão N.** Enunciado...
- A) ... B) ... C) ... D) ... E) ...
✅ **Gabarito:** Letra X
💬 **Comentário:** por que a correta está certa e cada errada está errada.

---

## 🔑 Pontos-chave para a prova
Lista numerada de 8 a 12 itens, palavras-chave em negrito, SOMENTE de **${tema}**.

## 📖 Para Aprofundar
**📚 Legislação:** artigos e dispositivos aplicáveis a ${tema}.
**🌐 Sites:** planalto.gov.br, stf.jus.br, pmpr.pr.gov.br.
**📺 Estudo:** termos de busca no YouTube para ${tema} + CFP PM-PR.

## REGRAS DE QUALIDADE
- Mínimo 2.500 palavras sobre ${tema} — sem enrolação, sem mistura de assunto.
- Português formal e impecável. NUNCA invente artigo de lei.
- Use **negrito forte** em palavras-chave — o leitor deve captar os pontos "varrendo" a página.
- Parágrafo "Conceito-chave:" em negrito vira caixa dourada no PDF — use quando definir institutos centrais.`;
}

const BLOCO_CTB = `

## 🚦 Princípios e Sistema Nacional de Trânsito (SNT)
Composição (CONTRAN, CETRAN, SENATRAN, DETRAN) e competências da PM no trânsito (art. 23, III).

## 🛑 Normas Gerais de Circulação
Preferência, ultrapassagem, parada/estacionamento (arts. 26-67), velocidades, luzes, cinto e capacete.

## 📑 Habilitação (CNH)
Categorias A/B/C/D/E/ACC, PPD, requisitos, validade, suspensão e cassação (arts. 140-160).

## ⚠️ Infrações de Trânsito
Leve/média/grave/gravíssima (arts. 161-255), pontuação, fator multiplicador, principais infrações cobradas.

## 🚨 Crimes de Trânsito (arts. 291-312)
Homicídio culposo (302), lesão corporal (303), embriaguez (306), racha (308), fuga (305), Lei Seca.

## 🛂 Fiscalização — Atuação PM-PR
Blitz, etilômetro, recusa, auto de infração, apreensão/remoção, recolhimento de CNH, cadeia de custódia.

## 🚗 Veículos e Documentação
CRV, CRLV-e, equipamentos obrigatórios, transporte de cargas e passageiros.

## 🧒 Pedestres, Ciclistas e Crianças
Direitos/deveres (arts. 68-71), cadeirinha (Res. CONTRAN), motofrete/mototáxi.`;

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

    const { materia, topico } = await req.json();
    if (!materia) {
      return new Response(JSON.stringify({ error: "Matéria é obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY não configurada");

    const isCTB = /ctb|tr[âa]nsito|c[óo]digo de tr[âa]nsito/i.test(materia) ||
      (topico && /ctb|tr[âa]nsito/i.test(topico));

    const systemPrompt = buildSystemPrompt(materia, topico || null);

    const userPrompt = topico
      ? `Gere a apostila completa sobre **${topico}** (matéria: **${materia}**) para o CFP PM-PR. Escreva SOMENTE sobre este tópico específico — não misture com outras matérias.${isCTB ? BLOCO_CTB : ""}`
      : `Gere a apostila completa de **${materia}** para o CFP PM-PR, cobrindo todos os tópicos cobrados nesta matéria. Escreva SOMENTE sobre ${materia} — não inclua conteúdo de outras disciplinas.${isCTB ? BLOCO_CTB : ""}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        stream: true,
        max_tokens: 8000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Groq error:", response.status, text);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições — aguarde alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "Chave da API inválida. Verifique GROQ_API_KEY." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Erro ao contatar a IA. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("gerar-apostila error:", e);
    return new Response(JSON.stringify({ error: "Erro interno ao gerar apostila" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
