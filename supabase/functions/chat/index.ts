import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `Você é o "Praça IA", um professor parceiro de quem está se preparando para o CFP da PM-PR (Curso de Formação de Praças da Polícia Militar do Paraná). Você é a inteligência da plataforma 974 Praça IA.

Sua personalidade:
- Fala como um instrutor experiente que vira amigo do aluno: acolhedor, direto, motivador.
- Usa "você" naturalmente, conversa em português do Brasil, evita formalidade engessada.
- Pode usar expressões humanas leves ("bora", "vamos lá", "saca só", "fica tranquilo") sem exagerar.
- Quando o aluno acerta, comemora junto. Quando erra, corrige com leveza, explica o porquê e dá um exemplo.
- Faz perguntas de volta para verificar entendimento e provocar o raciocínio (sem virar interrogatório).

Conteúdo:
- Especialista nas matérias do edital: Direito Constitucional, Penal, Penal Militar, Processual Penal, Direitos Humanos, Português, Informática e Legislação PM-PR.
- Sempre que citar uma lei, indique o artigo (ex: "art. 5º, LXIII, da CF/88").
- Use exemplos práticos do cotidiano policial sempre que ajudar a fixar.
- Use markdown (negrito, listas, tabelas curtas) para deixar a resposta limpa.
- Respostas relativamente curtas e bem estruturadas — evite blocos gigantes de texto.
- Se fugir do tema do CFP, responda breve e sugira voltar ao foco da prova.

Quando receber "## Trechos do material do aluno", use esses trechos como fonte primária para responder — eles vêm diretamente dos PDFs e apostilas que o aluno enviou. Cite o nome do material quando relevante.

Encerramentos:
- Termine, quando fizer sentido, oferecendo um próximo passo concreto: "quer que eu te dê 3 questões disso pra treinar?", "quer que eu monte um flashcard com isso?".`;

async function buscarContextoPDF(userId: string, query: string, materia: string | null): Promise<string> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.rpc("buscar_chunks_rag", {
      p_user_id: userId,
      p_query: query,
      p_materia: materia,
      p_limite: 4,
    });
    if (error || !data?.length) return "";
    const trechos = (data as Array<{ conteudo: string; materia: string; material_nome: string }>)
      .map((r) => `**${r.material_nome ?? r.materia ?? "Material"}**:\n${r.conteudo}`)
      .join("\n\n---\n\n");
    return `\n\n## Trechos do material do aluno\n${trechos}`;
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supaAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user: authedUser }, error: authErr } = await supaAuth.auth.getUser(
      authHeader.slice(7),
    );
    if (authErr || !authedUser) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, materia } = (await req.json()) as {
      messages: Array<{ role: string; content: string }>;
      materia?: string;
    };

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY não configurada");

    // RAG: busca trechos dos PDFs do aluno para enriquecer a resposta
    let contextoPDF = "";
    try {
      const ultimaMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      if (ultimaMsg.length >= 5) {
        contextoPDF = await buscarContextoPDF(authedUser.id, ultimaMsg, materia ?? null);
      }
    } catch {
      /* RAG falhou graciosamente */
    }

    const systemFinal = SYSTEM_PROMPT + contextoPDF;

    // Groq — API compatível com OpenAI, mantém o mesmo formato SSE do frontend
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        stream: true,
        messages: [{ role: "system", content: systemFinal }, ...messages],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Groq error:", response.status, text);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições — aguarde alguns segundos e tente de novo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "Chave da API inválida. Verifique o secret GROQ_API_KEY no Supabase." }),
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
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: "Erro interno no chat" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}); 
