import {
  Scale, Landmark, Shield, Gavel, Heart, BookOpen, Monitor, Star,
  Search, Crosshair, Footprints, Swords, Siren, Dumbbell, Brain, Car, Users,
  type LucideIcon,
} from 'lucide-react'

export type Materia = {
  slug: string
  nome: string
  descricao: string
  icon: LucideIcon
  assuntos: string[]
}

export const MATERIAS: Materia[] = [
  {
    slug: 'direito-constitucional',
    nome: 'Direito Constitucional',
    descricao: 'CF/88, direitos e garantias, organização do Estado.',
    icon: Landmark,
    assuntos: [
      'Princípios fundamentais da CF/88', 'Direitos e garantias fundamentais',
      'Direitos sociais', 'Direitos políticos', 'Organização do Estado',
      'Organização dos Poderes', 'Defesa do Estado e das Instituições Democráticas',
      'Tributação e orçamento', 'Ordem econômica e financeira', 'Ordem social',
    ],
  },
  {
    slug: 'direito-penal',
    nome: 'Direito Penal',
    descricao: 'Parte geral e crimes em espécie do CP.',
    icon: Scale,
    assuntos: [
      'Princípios do Direito Penal', 'Lei penal no tempo e no espaço',
      'Crime — conceito e elementos', 'Tipicidade, ilicitude e culpabilidade',
      'Iter criminis', 'Concurso de agentes', 'Penas — espécies e aplicação',
      'Crimes contra a pessoa', 'Crimes contra o patrimônio',
      'Crimes contra a administração pública',
    ],
  },
  {
    slug: 'direito-penal-militar',
    nome: 'Direito Penal Militar',
    descricao: 'CPM e crimes propriamente militares.',
    icon: Shield,
    assuntos: [
      'Aplicação da lei penal militar', 'Crime militar — conceito e espécies',
      'Crimes propriamente militares', 'Crimes impropriamente militares',
      'Hierarquia e disciplina', 'Desacato e desobediência', 'Abandono de posto',
      'Violência contra superior', 'Motim e conspiração', 'Insubordinação',
    ],
  },
  {
    slug: 'direito-processual-penal',
    nome: 'Direito Processual Penal',
    descricao: 'Inquérito, prisões, provas e nulidades.',
    icon: Gavel,
    assuntos: [
      'Inquérito policial', 'Ação penal', 'Competência', 'Provas em geral',
      'Prisão em flagrante', 'Prisão preventiva', 'Prisão temporária',
      'Habeas corpus', 'Nulidades', 'Recursos',
    ],
  },
  {
    slug: 'direitos-humanos',
    nome: 'Direitos Humanos',
    descricao: 'Tratados internacionais e atuação policial.',
    icon: Heart,
    assuntos: [
      'Declaração Universal dos Direitos Humanos', 'Pacto de San José da Costa Rica',
      'Uso proporcional da força', 'Código de Conduta para Policiais',
      'Princípios Básicos sobre uso da força', 'Tortura — proibição e consequências',
      'Grupos vulneráveis', 'Violência doméstica — Lei Maria da Penha',
      'Criança e adolescente — ECA', 'Ética policial',
    ],
  },
  {
    slug: 'portugues',
    nome: 'Português',
    descricao: 'Gramática, interpretação e redação.',
    icon: BookOpen,
    assuntos: [
      'Interpretação de texto', 'Coesão e coerência', 'Ortografia oficial',
      'Acentuação gráfica', 'Classes de palavras', 'Concordância nominal e verbal',
      'Regência nominal e verbal', 'Crase', 'Pontuação', 'Redação oficial',
    ],
  },
  {
    slug: 'informatica',
    nome: 'Informática',
    descricao: 'Windows, Office, internet e segurança.',
    icon: Monitor,
    assuntos: [
      'Windows 10/11 — configurações e recursos', 'Microsoft Word', 'Microsoft Excel',
      'Microsoft PowerPoint', 'Navegadores e internet', 'Correio eletrônico',
      'Segurança da informação — conceitos', 'Vírus, malware e proteção',
      'Backup e recuperação', 'Redes — conceitos básicos',
    ],
  },
  {
    slug: 'legislacao-pmpr',
    nome: 'Legislação PM-PR',
    descricao: 'Estatuto, regulamentos e história da PM-PR.',
    icon: Star,
    assuntos: [
      'História da Polícia Militar do Paraná', 'Estatuto dos Servidores Militares (Lei 1.943/54)',
      'Regulamento de Ética Profissional', 'Regulamento Disciplinar do Exército (aplicado à PM)',
      'Lei de Organização Básica (LOB)', 'Promoções e carreiras',
      'Vencimentos e vantagens', 'Regime disciplinar', 'Missão e valores da PMPR',
      'Direitos e deveres do militar estadual',
    ],
  },
  {
    slug: 'tecnicas-abordagem',
    nome: 'Técnicas de Abordagem Policial',
    descricao: 'Abordagem a pessoas, veículos e procedimentos de busca.',
    icon: Search,
    assuntos: [
      'Abordagem a pedestres', 'Abordagem a veículos', 'Busca pessoal',
      'Busca veicular', 'Imobilização e algemas', 'Condução de detidos',
      'Posicionamento tático', 'Comunicação na abordagem', 'Uso proporcional da força',
      'Documentação do procedimento',
    ],
  },
  {
    slug: 'armamento-tiro',
    nome: 'Armamento, Munição e Tiro Policial',
    descricao: 'Manuseio seguro, técnicas de tiro e armamento menos letal.',
    icon: Crosshair,
    assuntos: [
      'Pistola .40 — partes e funcionamento', 'Manutenção e limpeza de armamento',
      'Munição — tipos e características', 'Regras de segurança no manuseio',
      'Tiro instintivo e técnico', 'Posições de tiro', 'Armamento menos letal',
      'Spray de pimenta (OC)', 'Bastão policial', 'Legislação sobre porte e uso',
    ],
  },
  {
    slug: 'policiamento-ostensivo',
    nome: 'Policiamento Ostensivo',
    descricao: 'Patrulhamento a pé, motorizado e preservação da ordem.',
    icon: Footprints,
    assuntos: [
      'Patrulhamento a pé', 'Patrulhamento motorizado', 'Ronda e área de responsabilidade',
      'Preservação da ordem pública', 'Atendimento de ocorrências', 'Boletim de ocorrência',
      'Policiamento comunitário', 'Conselho Comunitário de Segurança',
      'Uso do rádio e comunicações', 'Registro e documentação policial',
    ],
  },
  {
    slug: 'defesa-pessoal',
    nome: 'Defesa Pessoal',
    descricao: 'Imobilização, contenção e artes marciais aplicadas.',
    icon: Swords,
    assuntos: [
      'Princípios da defesa pessoal policial', 'Quedas e rolamentos',
      'Imobilizações básicas', 'Técnicas de algemamento', 'Defesa contra agressões',
      'Controle de resistência', 'Técnicas de contenção no solo',
      'Defesa contra facas e objetos', 'Condicionamento para defesa pessoal',
      'Legislação sobre uso da força',
    ],
  },
  {
    slug: 'gerenciamento-crises',
    nome: 'Gerenciamento de Crises',
    descricao: 'Mediação de conflitos e primeiras intervenções em crises.',
    icon: Siren,
    assuntos: [
      'Conceito de crise', 'Tipologia de crises', 'Negociação em crises',
      'Comunicação em situações de crise', 'Sequestro e refém',
      'Suicídio — abordagem e prevenção', 'Estrutura do gerenciamento de crises na PMPR',
      'Tomada de decisão sob pressão', 'Fases da crise', 'Pós-crise e debriefing',
    ],
  },
  {
    slug: 'educacao-fisica',
    nome: 'Educação Física e TAF',
    descricao: 'Condicionamento físico, TAF e prontidão operacional.',
    icon: Dumbbell,
    assuntos: [
      'Teste de Aptidão Física (TAF) — critérios', 'Corrida — treino e avaliação',
      'Barra fixa e flexão de braços', 'Abdominal e força de tronco',
      'Natação aplicada à PM', 'Periodização do treinamento',
      'Fisiologia do exercício básica', 'Prevenção de lesões', 'Nutrição para atleta',
      'Prontidão operacional e saúde',
    ],
  },
  {
    slug: 'etica-humanidades',
    nome: 'Ética e Humanidades',
    descricao: 'Ética profissional, cidadania e Direitos Humanos aplicados.',
    icon: Brain,
    assuntos: [
      'Ética e moral — conceitos', 'Ética profissional do policial militar',
      'Código de Ética da PMPR', 'Cidadania e democracia',
      'Policiamento e diversidade', 'Racismo e discriminação — legislação',
      'Violência de gênero', 'Psicologia aplicada à segurança pública',
      'Relações interpessoais na corporação', 'Saúde mental do policial',
    ],
  },
  {
    slug: 'ctb',
    nome: 'Código de Trânsito Brasileiro',
    descricao: 'CTB, infrações, crimes de trânsito e fiscalização.',
    icon: Car,
    assuntos: [
      'Princípios do CTB', 'Sistema Nacional de Trânsito', 'Habilitação — categorias e validade',
      'Infrações de trânsito — classificação', 'Penalidades e suspensão',
      'Crimes de trânsito (art. 302 ao 312 CTB)', 'Embriaguez ao volante',
      'Fiscalização de veículos e documentos', 'Blitz e abordagem veicular',
      'Acidentes de trânsito — procedimentos',
    ],
  },
  {
    slug: 'ordem-unida',
    nome: 'Ordem Unida',
    descricao: 'Instrução de ordem unida, formaturas e movimentos.',
    icon: Users,
    assuntos: [
      'Posição de sentido e descanso', 'Saudações militares', 'Formatura e alinhamento',
      'Marcha — passo cadenciado e de forma', 'Voltas — direita, esquerda, meia-volta',
      'Rompimento e reagrupamento', 'Hasteamento e arreamento de bandeira',
      'Continência individual e coletiva', 'Comando de voz', 'Parada militar',
    ],
  },
]

export const getMateria = (slug: string) => MATERIAS.find((m) => m.slug === slug)
