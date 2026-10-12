// Documentos repetidos — dois níveis, e o motivo sempre explicado:
//  1) mesmo ARQUIVO (hash SHA-256 dos bytes): baixou duas vezes;
//  2) mesmo CONTEÚDO (mesmo tipo + mesma fonte + mesmo ano): ex.: o informe
//     da empresa baixado do site e o recebido por e-mail. Pode ser versão
//     corrigida — a pessoa escolhe qual vale; só UM entra na conta.

export async function hashDoArquivo(bytes) {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function chaveDeConteudo(doc) {
  if (!doc || !doc.tipo || doc.tipo === 'nao_identificado' || doc.tipo === 'extrato_bancario') return null;
  const fonte = doc.instituicao?.documento;
  if (!fonte || !doc.anoCalendario) return null;
  // Recibos da mesma clínica no mesmo ano são normais (várias consultas):
  // só é repetido se também bate o valor.
  if (doc.tipo === 'recibo_despesa') {
    const total = (doc.itens || []).map((i) => `${i.campo}:${i.centavos}`).sort().join('|');
    return `${doc.tipo}|${fonte}|${doc.anoCalendario}|${total}`;
  }
  return `${doc.tipo}|${fonte}|${doc.anoCalendario}`;
}

// novo: { hash, documento } · existentes: [{ id, nome, hash, chave }]
export function verificarDuplicata(novo, existentes) {
  const mesmoArquivo = existentes.find((e) => e.hash && e.hash === novo.hash);
  if (mesmoArquivo) return { duplicado: true, tipo: 'arquivo', de: mesmoArquivo.id, motivo: `É o mesmo arquivo de "${mesmoArquivo.nome}" (conteúdo idêntico, byte a byte).` };
  const chave = chaveDeConteudo(novo.documento);
  const mesmoConteudo = chave && existentes.find((e) => e.chave === chave);
  if (mesmoConteudo) {
    return {
      duplicado: true,
      tipo: 'conteudo',
      de: mesmoConteudo.id,
      motivo: `Mesma fonte pagadora e mesmo ano de "${mesmoConteudo.nome}". Pode ser uma cópia ou uma versão corrigida — só um dos dois entra na conta. Escolha qual vale.`,
    };
  }
  return { duplicado: false, chave };
}
