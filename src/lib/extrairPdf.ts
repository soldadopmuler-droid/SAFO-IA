import { supabase } from "@/integrations/supabase/client";

export type PdfExtraido = {
  texto: string;
  nome: string;
  caracteres: number;
  truncado: boolean;
};

/** Envia um PDF para a edge function `extrair-pdf` e retorna o texto extraído. */
export async function extrairPdf(file: File): Promise<PdfExtraido> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Faça login para enviar PDFs");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extrair-pdf`;
  const form = new FormData();
  form.append("file", file);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: form,
  });

  if (!resp.ok) {
    let msg = `Erro ${resp.status}`;
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return (await resp.json()) as PdfExtraido;
}