import {
  Scale, Landmark, Shield, Gavel, Heart, BookOpen, Monitor, Star,
  Search, Crosshair, Footprints, Swords, Siren, Dumbbell, Brain, Car, Users,
  type LucideIcon,
} from "lucide-react";

export type Materia = {
  slug: string;
  nome: string;
  descricao: string;
  icon: LucideIcon;
};

export const MATERIAS: Materia[] = [
  { slug: "direito-constitucional", nome: "Direito Constitucional", descricao: "CF/88, direitos e garantias, organização do Estado.", icon: Landmark },
  { slug: "direito-penal", nome: "Direito Penal", descricao: "Parte geral e crimes em espécie do CP.", icon: Scale },
  { slug: "direito-penal-militar", nome: "Direito Penal Militar", descricao: "CPM e crimes propriamente militares.", icon: Shield },
  { slug: "direito-processual-penal", nome: "Direito Processual Penal", descricao: "Inquérito, prisões, provas e nulidades.", icon: Gavel },
  { slug: "direitos-humanos", nome: "Direitos Humanos", descricao: "Tratados internacionais e atuação policial.", icon: Heart },
  { slug: "portugues", nome: "Português", descricao: "Gramática, interpretação e redação.", icon: BookOpen },
  { slug: "informatica", nome: "Informática", descricao: "Windows, Office, internet e segurança.", icon: Monitor },
  { slug: "legislacao-pmpr", nome: "Legislação PM-PR", descricao: "Estatuto, regulamentos e história da PM-PR.", icon: Star },
  { slug: "tecnicas-abordagem", nome: "Técnicas de Abordagem Policial", descricao: "Abordagem a pessoas, veículos e procedimentos de busca pessoal e veicular.", icon: Search },
  { slug: "armamento-tiro", nome: "Armamento, Munição e Tiro Policial", descricao: "Manuseio seguro, técnicas de tiro e armamento menos letal.", icon: Crosshair },
  { slug: "policiamento-ostensivo", nome: "Policiamento Ostensivo", descricao: "Patrulhamento a pé e motorizado, preservação da ordem pública.", icon: Footprints },
  { slug: "defesa-pessoal", nome: "Defesa Pessoal", descricao: "Imobilização, contenção e artes marciais aplicadas à segurança.", icon: Swords },
  { slug: "gerenciamento-crises", nome: "Gerenciamento de Crises", descricao: "Mediação de conflitos e primeiras intervenções em situações de crise.", icon: Siren },
  { slug: "educacao-fisica", nome: "Educação Física e TAF", descricao: "Condicionamento físico, TAF e prontidão operacional.", icon: Dumbbell },
  { slug: "etica-humanidades", nome: "Ética e Humanidades", descricao: "Ética profissional, cidadania e Direitos Humanos aplicados.", icon: Brain },
  { slug: "ctb", nome: "Código de Trânsito Brasileiro", descricao: "CTB (Lei 9.503/97), infrações, crimes de trânsito e fiscalização aplicada à PM-PR.", icon: Car },
  { slug: "ordem-unida", nome: "Ordem Unida", descricao: "Instrução de ordem unida, formaturas, marchas, voltas e movimentos conforme EB70-MC-10.308.", icon: Users },
];

export const getMateria = (slug: string) => MATERIAS.find((m) => m.slug === slug);