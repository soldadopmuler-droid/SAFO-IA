import { useEffect, useRef, useState, useCallback } from "react";
import {
  Scale, FileUp, Loader2, Trash2, FileText, Sparkles, Layers,
  ClipboardList, RefreshCw, AlertCircle, Search, BookOpen, Scroll,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/study/PageHeader";
import { Markdown } from "@/components/study/Markdown";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Material = {
  id: string; nome_arquivo: string; storage_path: string; tipo_arquivo: string;
  tamanho_bytes: number | null; materia: string | null; resumo: string | null;
  status: string; erro: string | null; podcast_id: string | null; categoria: string;
  questoes_geradas: unknown; created_at: string;
};

const MIME_OK: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};

const CATEGORIAS = [
  { value: "lei",        label: "Lei" },
  { value: "decreto",    label: "Decreto" },
  { value: "manual",     label: "Manual" },
  { value: "regulamento",label: "Regulamento" },
  { value: "norma",      label: "Norma / Portaria" },
];

const MATERIAS_LEI = [
  "Legislacao PM-PR",
  "Direito Constitucional",
  "Direito Penal",
  "Direito Penal Militar",
  "Direito Processual Penal",
  "Codigo de Transito Brasileiro",
  "Direitos Humanos",
  "Ordem Unida",
  "Instrucao Militar",
  "Armamento e Tiro",
  "Defesa Pessoal",
  "Etica e Disciplina Militar",
  "Legislacao de Transito",
];

const TABS = [
  { value: "todos",       label: "Todos",        icon: Scale },
  { value: "lei",         label: "Leis",         icon: Scale },
  { value: "decreto",     label: "Decretos",     icon: Scroll },
  { value: "manual",      label: "Manuais",      icon: BookOpen },
  { value: "regulamento", label: "Regulamentos", icon: Scroll },
  { value: "norma",       label: "Normas",       icon: FileText },
];

const labelCategoria: Record<string, string> = {
  lei: "Lei", decreto: "Decreto", norma: "Norma / Portaria",
  manual: "Manual", regulamento: "Regulamento",
};

const corCategoria: Record<string, string> = {
  lei:         "border-blue-400/40 bg-blue-400/10 text-blue-400",
  decreto:     "border-amber-400/40 bg-amber-400/10 text-amber-400",
  norma:       "border-purple-400/40 bg-purple-400/10 text-purple-400",
  manual:      "border-green-400/40 bg-green-400/10 text-green-400",
  regulamento: "border-orange-400/40 bg-orange-400/10 text-orange-400",
};

export default function Legislacao() {
  const { user } = useAuth();
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState("lei");
  const [materia, setMateria] = useState(MATERIAS_LEI[0]);
  const [uploading, setUploading] = useState(false);
  const [tabAtiva, setTabAtiva] = useState("todos");
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [verResumo, setVerResumo] = useState<Material | null>(null);
  const [acoes, setAcoes] = useState<Record<string, { resumo: boolean; flashcards: boolean; questoes: boolean; loading: boolean }>>({});

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("materiais") as any)
      .select("*")
      .in("categoria", ["lei", "decreto", "norma", "manual", "regulamento"])
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems(((data as unknown) as Material[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const onFile = useCallback(async (file: File) => {
    if (!user) { toast.error("Faca login"); return; }
    if (!MIME_OK[file.type]) { toast.error("Use PDF, DOCX ou TXT"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Maximo 25 MB"); return; }
    setUploading(true);
    try {
      const path = user.id + "/" + Date.now() + "-" + file.name.replace(/[^\w.-]/g, "_");
      const { error: upErr } = await supabase.storage.from("materiais").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await (supabase.from("materiais") as any).insert({
        user_id: user.id, nome_arquivo: file.name, storage_path: path,
        tipo_arquivo: file.type, tamanho_bytes: file.size,
        materia, status: "enviado", categoria,
      });
      if (insErr) throw insErr;
      toast.success("Documento enviado!");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [user, categoria, materia]);

  // Drag & drop handlers
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setArrastando(true); };
  const onDragLeave = () => setArrastando(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const apagar = async (m: Material) => {
    await supabase.storage.from("materiais").remove([m.storage_path]);
    const { error } = await supabase.from("materiais").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Apagado"); await carregar(); }
  };

  const setAcao = (id: string, patch: Partial<{ resumo: boolean; flashcards: boolean; questoes: boolean; loading: boolean }>) =>
    setAcoes((prev) => ({ ...prev, [id]: { resumo: true, flashcards: false, questoes: false, loading: false, ...prev[id], ...patch } }));

  const processar = async (m: Material, forcar = false) => {
    const a = acoes[m.id] ?? { resumo: true, flashcards: false, questoes: false, loading: false };
    const acoesIA = (["resumo", "flashcards", "questoes"] as const).filter((k) => a[k]);
    if (acoesIA.length === 0) { toast.error("Selecione ao menos uma acao"); return; }
    setAcao(m.id, { loading: true });
    try {
      if (forcar) {
        await supabase.from("materiais").update({ status: "enviado", texto_extraido: null, erro: null }).eq("id", m.id);
      }
      toast.info("Processando documento...");
      await invokeFunction("processar-material", { material_id: m.id, acoes: acoesIA });
      toast.success("Processado com sucesso!");
      await carregar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao processar";
      toast.error(msg);
      try {
        await supabase.from("materiais").update({ status: "erro", erro: msg }).eq("id", m.id);
      } catch { /* silencioso */ }
      await carregar();
    } finally {
      setAcao(m.id, { loading: false });
    }
  };

  const itensFiltrados = items.filter((m) => {
    const porTab = tabAtiva === "todos" || m.categoria === tabAtiva;
    const porBusca = !busca || m.nome_arquivo.toLowerCase().includes(busca.toLowerCase()) ||
      (m.materia ?? "").toLowerCase().includes(busca.toLowerCase());
    return porTab && porBusca;
  });

  const contarPorCategoria = (cat: string) =>
    cat === "todos" ? items.length : items.filter((i) => i.categoria === cat).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        icon={Scale}
        title="Legislação e Manuais"
        description="Envie leis, decretos, manuais e regulamentos. A IA usa como base ao responder no Tutor."
      />

      {/* Upload zone com drag & drop */}
      <div
        ref={dropRef}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`mt-6 rounded-2xl border-2 border-dashed p-6 transition-colors ${
          arrastando
            ? "border-primary bg-primary/5"
            : "border-border bg-card/50"
        }`}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <Scale className={`h-10 w-10 ${arrastando ? "text-primary" : "text-primary"}`} />
          <div>
            <p className="font-semibold">
              {arrastando ? "Solte o arquivo aqui!" : "Envie um documento"}
            </p>
            <p className="text-xs text-muted-foreground">
              Arraste e solte ou selecione · PDF, DOCX ou TXT até 25 MB
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap justify-center">
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={materia} onValueChange={setMateria}>
              <SelectTrigger className="sm:w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATERIAS_LEI.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              <span className="ml-2">{uploading ? "Enviando..." : "Selecionar arquivo"}</span>
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>
      </div>

      {/* Abas + busca */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList className="flex-wrap h-auto gap-1">
            {TABS.map((t) => {
              const count = contarPorCategoria(t.value);
              return (
                <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                  {t.label}
                  {count > 0 && (
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar documento..."
            className="pl-8 w-full sm:w-[220px]"
          />
        </div>
      </div>

      {/* Lista de documentos */}
      <section className="mt-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : itensFiltrados.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center">
            <Scale className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {busca ? "Nenhum documento encontrado para esta busca." : "Nenhum documento nesta categoria. Envie um acima."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {itensFiltrados.map((m) => {
              const a = acoes[m.id] ?? { resumo: true, flashcards: false, questoes: false, loading: false };
              const falhou = m.status === "erro";
              return (
                <div
                  key={m.id}
                  className={"rounded-2xl border bg-card p-4 shadow-elegant " + (falhou ? "border-destructive/40" : "border-border")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={corCategoria[m.categoria] ?? ""}>
                          {labelCategoria[m.categoria] ?? m.categoria}
                        </Badge>
                        <Badge variant="outline" className="border-primary/30 text-primary">
                          {MIME_OK[m.tipo_arquivo] ?? "?"}
                        </Badge>
                        {m.materia && <Badge variant="secondary">{m.materia}</Badge>}
                        {m.status === "pronto" && (
                          <Badge variant="outline" className="border-success/40 text-success">Processado</Badge>
                        )}
                        {falhou && (
                          <Badge variant="outline" className="border-destructive/40 text-destructive">Falhou</Badge>
                        )}
                        {!["enviado", "pronto", "erro"].includes(m.status) && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> {m.status}
                          </span>
                        )}
                      </div>
                      <p className="truncate font-medium text-foreground">{m.nome_arquivo}</p>
                      {falhou && m.erro && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                          <p className="text-xs text-destructive">{m.erro}</p>
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => apagar(m)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={a.resumo} onCheckedChange={(v) => setAcao(m.id, { resumo: !!v })} />
                      <FileText className="h-3.5 w-3.5" /> Resumo
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={a.flashcards} onCheckedChange={(v) => setAcao(m.id, { flashcards: !!v })} />
                      <Layers className="h-3.5 w-3.5" /> Flashcards
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={a.questoes} onCheckedChange={(v) => setAcao(m.id, { questoes: !!v })} />
                      <ClipboardList className="h-3.5 w-3.5" /> Questoes
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => processar(m)}
                      disabled={a.loading}
                      className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                    >
                      {a.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      <span className="ml-2">Processar</span>
                    </Button>
                    {(falhou || m.status === "pronto") && (
                      <Button size="sm" variant="outline" onClick={() => processar(m, true)} disabled={a.loading}>
                        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reprocessar
                      </Button>
                    )}
                    {m.resumo && (
                      <Button size="sm" variant="outline" onClick={() => setVerResumo(m)}>
                        Ver resumo
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={!!verResumo} onOpenChange={(o) => !o && setVerResumo(null)}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{verResumo?.nome_arquivo}</DialogTitle></DialogHeader>
          {verResumo?.resumo && <Markdown>{verResumo.resumo}</Markdown>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
