import type { Materia } from './materias'

export function baixarResumoMateria(m: Materia) {
  const linhas = [
    `PRAÇA IA — RESUMO DE MATÉRIA`,
    `CFP PM-PR | ${new Date().toLocaleDateString('pt-BR')}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `MATÉRIA: ${m.nome.toUpperCase()}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    m.descricao,
    ``,
    `TÓPICOS DO EDITAL:`,
    ``,
    ...m.assuntos.map((a, i) => `  ${String(i + 1).padStart(2, '0')}. ${a}`),
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Gerado por Praça IA — plataforma de estudos para o CFP PM-PR`,
    `Conteúdo educativo. Sempre confirme nas fontes oficiais.`,
  ]

  const conteudo = linhas.join('\n')
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `resumo-${m.slug}-cfp-pmpr.txt`
  link.click()
  URL.revokeObjectURL(url)
}
