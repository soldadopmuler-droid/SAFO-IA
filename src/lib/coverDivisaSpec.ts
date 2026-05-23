/**
 * Single source of truth para o posicionamento da divisa PMPR na capa Caveira.
 *
 * Todas as medidas estão em milímetros (relativas a uma página A4 = 210x297 mm).
 * Os percentuais usados pela prévia HTML são DERIVADOS destes valores via
 * `previewPct(...)`, garantindo paridade matemática entre PDF e prévia em todos
 * os temas (claro/escuro). A opacidade muda apenas conforme tema (claro/escuro).
 */

export const A4_W_MM = 210;
export const A4_H_MM = 297;

/** Marca d'água principal (centralizada, em auto-relevo). */
export const DIVISA_MAIN_MM = {
  width: 118,
  topY: A4_H_MM * 0.10, // ~29.7 mm
} as const;

/** Selo nítido no rodapé direito da capa. */
export const DIVISA_BADGE_MM = {
  width: 22,
  marginRight: 18,
  marginBottom: 16,
} as const;

/** Opacidade da marca d'água principal por tipo de tema. */
export const DIVISA_OPACITY = {
  light: 0.5,
  dark: 0.32,
} as const;

/**
 * Registro central de temas suportados pela capa.
 *
 * Para adicionar um novo tema no futuro, basta acrescentar uma entrada aqui
 * informando o `mode` ("light" | "dark"). A suíte de testes em
 * `src/test/coverDivisa.test.ts` itera por este registro automaticamente,
 * garantindo que a paridade prévia↔PDF continue válida sem alterações.
 */
export type ThemeMode = "light" | "dark";
export type ThemeRegistryEntry = { id: string; mode: ThemeMode };

export const THEME_REGISTRY: ThemeRegistryEntry[] = [
  // Temas atualmente em uso pela capa Caveira
  { id: "gold",     mode: "dark"  },
  { id: "midnight", mode: "dark"  },
  { id: "blood",    mode: "dark"  },
  { id: "marble",   mode: "light" },
  { id: "forest",   mode: "dark"  },
  // Reservas para extensão (claro/escuro) — já cobertas pela suíte
  { id: "ivory",    mode: "light" },
  { id: "sand",     mode: "light" },
  { id: "obsidian", mode: "dark"  },
  { id: "navy",     mode: "dark"  },
];

export const LIGHT_THEMES = new Set<string>(
  THEME_REGISTRY.filter((t) => t.mode === "light").map((t) => t.id),
);

export function isLightTheme(themeId: string): boolean {
  return LIGHT_THEMES.has(themeId);
}

/** Permite registrar um novo tema em runtime (ex.: testes ou plugins). */
export function registerTheme(entry: ThemeRegistryEntry): void {
  const idx = THEME_REGISTRY.findIndex((t) => t.id === entry.id);
  if (idx >= 0) THEME_REGISTRY[idx] = entry;
  else THEME_REGISTRY.push(entry);
  if (entry.mode === "light") LIGHT_THEMES.add(entry.id);
  else LIGHT_THEMES.delete(entry.id);
}

export function divisaOpacityForTheme(themeId: string): number {
  return isLightTheme(themeId) ? DIVISA_OPACITY.light : DIVISA_OPACITY.dark;
}

/** Converte mm → percentual da largura A4. */
export const wPct = (mm: number) => (mm / A4_W_MM) * 100;
/** Converte mm → percentual da altura A4. */
export const hPct = (mm: number) => (mm / A4_H_MM) * 100;

/**
 * Specs prontas em percentual para a prévia HTML — derivadas das mesmas
 * constantes em mm usadas pelo gerador de PDF.
 */
export const DIVISA_PREVIEW_PCT = {
  main: {
    widthPct: wPct(DIVISA_MAIN_MM.width),
    topPct: hPct(DIVISA_MAIN_MM.topY),
  },
  badge: {
    widthPct: wPct(DIVISA_BADGE_MM.width),
    rightPct: wPct(DIVISA_BADGE_MM.marginRight),
    bottomPct: hPct(DIVISA_BADGE_MM.marginBottom),
  },
} as const;

/**
 * Verificador de paridade. Recebe os valores efetivamente usados pela prévia
 * (em %) e pelo PDF (em mm), e retorna a lista de divergências encontradas.
 * Uma diferença é tolerada se ficar abaixo de `tol` percentuais (default 0.05%).
 */
export type DivisaUsage = {
  preview: {
    mainWidthPct: number;
    mainTopPct: number;
    badgeWidthPct: number;
    badgeRightPct: number;
    badgeBottomPct: number;
    opacity: number;
  };
  pdf: {
    mainWidthMm: number;
    mainTopMm: number;
    badgeWidthMm: number;
    badgeRightMm: number;
    badgeBottomMm: number;
    opacity: number;
  };
  themeId: string;
};

export function verifyDivisaParity(usage: DivisaUsage, tol = 0.05): string[] {
  const issues: string[] = [];
  const expected = {
    mainWidthPct: wPct(usage.pdf.mainWidthMm),
    mainTopPct: hPct(usage.pdf.mainTopMm),
    badgeWidthPct: wPct(usage.pdf.badgeWidthMm),
    badgeRightPct: wPct(usage.pdf.badgeRightMm),
    badgeBottomPct: hPct(usage.pdf.badgeBottomMm),
    opacity: divisaOpacityForTheme(usage.themeId),
  };
  const checks: Array<[string, number, number]> = [
    ["main.widthPct", usage.preview.mainWidthPct, expected.mainWidthPct],
    ["main.topPct", usage.preview.mainTopPct, expected.mainTopPct],
    ["badge.widthPct", usage.preview.badgeWidthPct, expected.badgeWidthPct],
    ["badge.rightPct", usage.preview.badgeRightPct, expected.badgeRightPct],
    ["badge.bottomPct", usage.preview.badgeBottomPct, expected.badgeBottomPct],
  ];
  for (const [name, actual, exp] of checks) {
    if (Math.abs(actual - exp) > tol) {
      issues.push(`${name}: prévia=${actual.toFixed(3)}% ≠ esperado ${exp.toFixed(3)}% (PDF)`);
    }
  }
  if (Math.abs(usage.preview.opacity - expected.opacity) > 0.001) {
    issues.push(
      `opacity[${usage.themeId}]: prévia=${usage.preview.opacity} ≠ esperado ${expected.opacity}`,
    );
  }
  if (Math.abs(usage.pdf.opacity - expected.opacity) > 0.001) {
    issues.push(
      `opacity[${usage.themeId}]: pdf=${usage.pdf.opacity} ≠ esperado ${expected.opacity}`,
    );
  }
  return issues;
}