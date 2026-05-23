import { supabase } from "@/integrations/supabase/client";

export async function invokeFunction<T = unknown>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Tenta extrair mensagem do corpo de erro
    const msg = (data as { error?: string } | null)?.error ?? error.message ?? "Erro na função";
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}