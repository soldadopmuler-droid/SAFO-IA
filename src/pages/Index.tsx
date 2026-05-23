import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Contrast, BookOpen } from "lucide-react";
import { MATERIAS } from "@/lib/materias";
import divisaSoldado from "@/assets/divisa-soldado-pmpr.jpg";
import pmprRelevo from "@/assets/pmpr-relevo.jpg";
import { Button } from "@/components/ui/button";

function MateriasSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-muted/50" />
      ))}
    </div>
  );
}

export default function Index() {
  const [altoContraste, setAltoContraste] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("praca-ai:hero-alto-contraste") === "1";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("high-contrast", altoContraste);
    try {
      localStorage.setItem("praca-ai:hero-alto-contraste", altoContraste ? "1" : "0");
      window.dispatchEvent(new CustomEvent("praca-ai:hero-alto-contraste-change"));
    } catch {}
  }, [altoContraste]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      {/* Hero */}
      <section className="animate-fade-in-up relative isolate grid items-center gap-8 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-elegant sm:p-10 transition-[background-color,border-color,box-shadow] duration-500 ease-out md:grid-cols-[1fr_auto]">
        <img
          src={divisaSoldado}
          alt=""
          aria-hidden
          className="hero-watermark pointer-events-none absolute -right-16 -top-10 -z-20 h-[120%] w-auto select-none object-contain opacity-[0.07] transition-[opacity,filter] duration-500 ease-out sm:opacity-[0.09] lg:opacity-[0.11] [filter:grayscale(1)_contrast(1.15)_blur(0.6px)]"
        />
        <div aria-hidden className="hero-overlay pointer-events-none absolute inset-0 -z-10 bg-[image:var(--hero-overlay-light)] transition-opacity duration-500 ease-out dark:opacity-0" />
        <div aria-hidden className="hero-overlay pointer-events-none absolute inset-0 -z-10 bg-[image:var(--hero-overlay-dark)] opacity-0 transition-opacity duration-500 ease-out dark:opacity-100" />
        <div aria-hidden className="hero-overlay pointer-events-none absolute inset-0 -z-10 bg-[image:var(--hero-vignette-light)] transition-opacity duration-500 ease-out dark:opacity-0" />
        <div aria-hidden className="hero-overlay pointer-events-none absolute inset-0 -z-10 bg-[image:var(--hero-vignette-dark)] opacity-0 transition-opacity duration-500 ease-out dark:opacity-100" />

        <div className="relative min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Praça IA · focado no cronograma do CFP
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAltoContraste((p) => !p)}
              aria-pressed={altoContraste}
              title={altoContraste ? "Desativar alto contraste" : "Ativar alto contraste"}
              className="h-7 gap-1.5 border-primary/30 bg-background/60 px-2.5 text-xs text-foreground backdrop-blur hover:bg-background"
            >
              <Contrast className="h-3.5 w-3.5" aria-hidden />
              <span>{altoContraste ? "Contraste alto" : "Alto contraste"}</span>
            </Button>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Estudo <span className="text-gradient-gold">focado e ajustado</span> ao cronograma do CFP da PM-PR.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Plano de estudos alinhado às semanas do CFP: tutor IA, questões, flashcards com revisão espaçada,
            apostilas e resumos — cada conteúdo no momento certo do cronograma para você chegar pronto à prova.
          </p>

          <div className="mt-6">
            <Link
              to="/materias"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-gold transition-smooth hover:opacity-90"
            >
              <BookOpen className="h-4 w-4" />
              Ver Cronograma Previsto
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative mx-auto hidden md:block">
          <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <img
            src={pmprRelevo}
            alt="Brasão da Polícia Militar do Paraná em alto-relevo"
            width={320}
            height={320}
            className="h-64 w-64 rounded-2xl object-cover shadow-gold ring-1 ring-primary/30 lg:h-72 lg:w-72"
          />
        </div>
      </section>

      {/* Cronograma Previsto */}
      <section className="mt-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Cronograma Previsto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione uma matéria para gerar apostila, questões, flashcards ou pedir ao Tutor IA.
            </p>
          </div>
          <Link
            to="/materias"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-smooth hover:bg-primary/5"
          >
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {MATERIAS.length === 0 ? (
          <MateriasSkeleton />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MATERIAS.map((m, idx) => (
              <Link
                key={m.slug}
                to={`/apostila?materia=${encodeURIComponent(m.nome)}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-smooth hover:border-primary/40 hover:bg-card hover:shadow-gold"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-smooth group-hover:bg-primary/15">
                  <m.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{m.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.descricao}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground/60">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-smooth group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-4 sm:hidden">
          <Link
            to="/materias"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground transition-smooth hover:border-primary/30 hover:bg-card"
          >
            Ver todos os materiais <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
