// Modo offline (2026-10-11) — liga a fila pura (filaSync.js) ao IndexedDB
// (offlineIdb.js) e ao Supabase. Os services chamam só três coisas daqui:
//   comCacheOffline(tabela, chave, buscar)   — leitura: rede, ou cópia local
//   escreverOuEnfileirar(op, escreverAgora)  — escrita: agora, ou na fila
//   exigirConexao(acao)                      — ações que só valem online
// As telas não sabem se o dado veio da rede, do cache ou da fila — mesma
// regra do isDemoMode(). Em modo demonstração nada disto liga (o demo já é
// 100% local).
import { SUPABASE_URL, SUPABASE_ANON_KEY, isDemoMode } from './config.js';
import { getSupabase } from './supabaseClient.js';
import { criarFila, ehErroDeRede, houveConflito } from './filaSync.js';
import { abrirArmazenamento, apagarArmazenamento } from './offlineIdb.js';
import { comFallbackDeColuna } from '../utils/dbFallback.js';

let uidAtual = null;
let armazenamento = null;
let fila = null;
let sincronizando = false;
let timer = null;
let ouvintes = [];
let ligados = false;
// Última versão de cada registro VINDA DO SERVIDOR (ou da cópia dele), por
// tabela — é dela que sai a `base` de uma edição offline (ver baseDaEdicao).
const ultimaVersao = new Map();
// Servidor sabidamente fora até este instante: leituras usam a cópia local
// direto e escritas vão direto para a fila. Sem isto, cada consulta esperava
// as repetições automáticas do supabase-js (várias, com espera crescente) e
// o app levava dezenas de segundos para abrir sem servidor.
const JANELA_FORA_MS = 20_000;
let servidorForaAte = 0;

function servidorFora() {
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || Date.now() < servidorForaAte;
}
function marcarFora() {
  servidorForaAte = Date.now() + JANELA_FORA_MS;
}

// Estado mostrado na topbar: 'online' | 'offline' | 'sincronizando' |
// 'sincronizado' | 'erro' | 'conflito'.
let estado = { estado: 'online', pendentes: 0, conflitos: [], erros: [], dadosDe: null, ultimaSync: null };

function publicar(patch = {}) {
  const resumo = fila ? fila.resumo() : { pendentes: 0, conflitos: [], erros: [] };
  estado = { ...estado, ...resumo, ...patch };
  if (estado.estado !== 'sincronizando' && estado.estado !== 'offline') {
    if (resumo.conflitos.length) estado.estado = 'conflito';
    else if (resumo.erros.length) estado.estado = 'erro';
  }
  for (const fn of ouvintes) {
    try {
      fn({ ...estado });
    } catch { /* ouvinte com erro não derruba os outros */ }
  }
}

export function aoMudarEstado(fn) {
  ouvintes.push(fn);
  fn({ ...estado });
  return () => (ouvintes = ouvintes.filter((f) => f !== fn));
}

export function estadoAtual() {
  return { ...estado };
}

// "O navegador diz que voltou" não basta: pergunta ao servidor de verdade.
export async function servidorDisponivel() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) servidorForaAte = 0;
    else marcarFora();
    return r.ok;
  } catch {
    marcarFora();
    return false;
  }
}

// Envia UMA operação ao Supabase. Insert com id repetido (23505) = já foi
// enviado antes (resposta perdida) → sucesso. Update relê o registro e
// compara com a base para não sobrescrever algo mais novo.
async function executarNoSupabase(op) {
  const supabase = await getSupabase();
  if (op.tipo === 'insert') {
    try {
      await comFallbackDeColuna((obj) => supabase.from(op.tabela).insert(obj), { ...op.dados, id: op.registroId });
    } catch (e) {
      if (e?.code === '23505') return {};
      throw e;
    }
    return {};
  }
  const { data: atual, error } = await supabase.from(op.tabela).select('*').eq('id', op.registroId).maybeSingle();
  if (error) throw error;
  if (!op.forcar && (!atual || houveConflito(op.base, atual))) return { conflito: true, atual };
  if (!atual) {
    // "manter a minha" num registro que outra pessoa excluiu: recria.
    await comFallbackDeColuna((obj) => supabase.from(op.tabela).insert(obj), { ...op.dados, id: op.registroId });
    return {};
  }
  await comFallbackDeColuna((obj) => supabase.from(op.tabela).update(obj).eq('id', op.registroId), op.dados);
  return {};
}

function ligarGatilhos() {
  if (ligados || typeof window === 'undefined') return;
  ligados = true;
  window.addEventListener('online', aoVoltar);
  window.addEventListener('offline', aoCair);
  document.addEventListener('visibilitychange', aoVoltarParaATela);
}

function desligarGatilhos() {
  if (!ligados) return;
  ligados = false;
  window.removeEventListener('online', aoVoltar);
  window.removeEventListener('offline', aoCair);
  document.removeEventListener('visibilitychange', aoVoltarParaATela);
}

function aoVoltar() {
  sincronizar();
}
function aoCair() {
  publicar({ estado: 'offline' });
}
function aoVoltarParaATela() {
  if (document.visibilityState === 'visible') sincronizar();
}

// Liga o offline para este usuário (chamado no login). Não lança erro: sem
// IndexedDB, o app só continua funcionando como antes (só online).
export async function iniciarOffline(uid) {
  if (isDemoMode() || !uid) return;
  if (uidAtual === uid && fila) return;
  if (uidAtual && uidAtual !== uid) await encerrarOffline({ apagar: false });
  try {
    armazenamento = await abrirArmazenamento(uid);
    if (!armazenamento) return;
    uidAtual = uid;
    fila = criarFila({ armazenamento: armazenamento.fila, executor: executarNoSupabase });
    await fila.carregar();
    // Um ping rápido antes de buscar perfil/listas: se o servidor não
    // responde, o app já abre pela cópia local em vez de esperar repetições.
    await servidorDisponivel();
    ligarGatilhos();
    clearInterval(timer);
    // Com algo pendente, tenta de minuto em minuto (além dos eventos).
    // Offline, também confere se o servidor voltou (para sair do "Offline").
    timer = setInterval(async () => {
      if (fila?.resumo().pendentes) sincronizar();
      else if (estado.estado === 'offline' && (await servidorDisponivel())) publicar({ estado: 'online' });
    }, 60_000);
    publicar({ estado: navigator.onLine === false ? 'offline' : 'online' });
    sincronizar();
  } catch {
    armazenamento = null;
    fila = null;
    uidAtual = null;
  }
}

// Logout: apaga a cópia local deste usuário (dados financeiros não ficam no
// aparelho depois de sair). `apagar: false` só fecha (troca de usuário sem
// logout explícito).
export async function encerrarOffline({ apagar = true } = {}) {
  clearInterval(timer);
  timer = null;
  desligarGatilhos();
  const uid = uidAtual;
  armazenamento?.fechar();
  armazenamento = null;
  fila = null;
  uidAtual = null;
  ultimaVersao.clear();
  if (apagar && uid) await apagarArmazenamento(uid);
  estado = { estado: 'online', pendentes: 0, conflitos: [], erros: [], dadosDe: null, ultimaSync: null };
  publicar();
}

export function offlineAtivo() {
  return !!fila;
}

// Leitura: tenta a rede e guarda a cópia; sem rede, usa a cópia (se houver).
// `tabela` permite mostrar por cima o que ainda está na fila (null = não).
function lembrar(tabela, linhas) {
  if (!tabela || !Array.isArray(linhas)) return;
  const mapa = ultimaVersao.get(tabela) || new Map();
  for (const l of linhas) if (l?.id) mapa.set(l.id, l);
  ultimaVersao.set(tabela, mapa);
}

// Depois de uma escrita online que deu certo, a versão do servidor é a nova.
export function lembrarRegistro(tabela, linha) {
  if (linha?.id) lembrar(tabela, [linha]);
}

// Valor de cada campo editado ANTES da edição (para detectar conflito na
// hora de enviar). Sem versão conhecida → null (envia sem comparar).
export function baseDaEdicao(tabela, id, patch) {
  const atual = ultimaVersao.get(tabela)?.get(id);
  if (!atual) return null;
  return Object.fromEntries(Object.keys(patch).filter((k) => k !== 'id').map((k) => [k, atual[k] ?? null]));
}

export function versaoConhecida(tabela, id) {
  return ultimaVersao.get(tabela)?.get(id) || null;
}

export async function comCacheOffline(tabela, chave, buscar) {
  if (!armazenamento) return buscar();
  const nome = `${chave}`;
  // Devolve { valor } ou null (sem cópia) — a cópia pode ser null de verdade
  // (ex.: pessoa sem grupo), que é diferente de "não tem cópia".
  const usarCopia = async () => {
    const copia = await armazenamento.lerCache(nome).catch(() => null);
    if (!copia) return null;
    lembrar(tabela, copia.valor);
    publicar({ estado: 'offline', dadosDe: Math.min(estado.dadosDe || Infinity, copia.salvoEm) });
    return { valor: tabela ? fila.aplicarPendentes(tabela, copia.valor) : copia.valor };
  };
  // Estava offline e a janela passou: um ping rápido decide antes de tentar.
  if (!servidorFora() && estado.estado === 'offline') await servidorDisponivel();
  if (servidorFora()) {
    const r = await usarCopia();
    if (r) return r.valor;
  }
  try {
    const valor = await buscar();
    lembrar(tabela, valor);
    armazenamento.gravarCache(nome, valor).catch(() => {});
    if (estado.dadosDe) publicar({ dadosDe: null });
    return tabela ? fila.aplicarPendentes(tabela, valor) : valor;
  } catch (e) {
    if (!ehErroDeRede(e)) throw e;
    marcarFora();
    const r = await usarCopia();
    if (!r) throw e;
    return r.valor;
  }
}

// Escrita que pode esperar a internet. `op` = { tabela, tipo, registroId,
// dados, base?, otimista } — `otimista` é o que a tela recebe de volta
// enquanto a operação não sai.
export async function escreverOuEnfileirar(op, escreverAgora) {
  if (!fila) return escreverAgora();
  const enfileirar = async () => {
    await fila.enfileirar(op);
    publicar({ estado: 'offline' });
    return { ...op.otimista, id: op.registroId, _pendente: true };
  };
  if (servidorFora()) return enfileirar();
  // Registro com operação ainda na fila: a nova vai atrás (mantém a ordem).
  if (fila.listar().some((o) => o.registroId === op.registroId)) {
    const r = await enfileirar();
    sincronizar();
    return r;
  }
  try {
    return await escreverAgora();
  } catch (e) {
    if (!ehErroDeRede(e)) throw e;
    marcarFora();
    return enfileirar();
  }
}

// Exclusões e ações sensíveis só com conexão confirmada.
export function exigirConexao(acao) {
  if (fila && servidorFora()) {
    throw new Error(`Sem conexão: ${acao} só com internet. Tente de novo quando a conexão voltar.`);
  }
}

export function pendenteNoRegistro(registroId) {
  return !!fila?.listar().some((o) => o.registroId === registroId);
}

export async function sincronizar() {
  if (!fila || sincronizando) return;
  if (!fila.resumo().pendentes) {
    publicar({ estado: navigator.onLine === false ? 'offline' : 'online' });
    return;
  }
  sincronizando = true;
  publicar({ estado: 'sincronizando' });
  try {
    const r = await fila.processar({ disponivel: servidorDisponivel });
    if (r.semServidor) {
      marcarFora();
      publicar({ estado: 'offline' });
    }
    else publicar({ estado: 'sincronizado', ultimaSync: Date.now(), dadosDe: null });
    if (r.feitas > 0 && typeof window !== 'undefined') {
      // Telas abertas recarregam com o dado que agora está no servidor.
      window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
      window.dispatchEvent(new CustomEvent('cg:offline-sincronizado', { detail: r }));
    }
  } catch {
    publicar({ estado: 'erro' });
  } finally {
    sincronizando = false;
  }
}

export async function resolverConflito(id, escolha) {
  await fila?.resolverConflito(id, escolha);
  publicar({ estado: 'online' });
  await sincronizar();
}

export async function tentarDeNovo(id) {
  await fila?.tentarDeNovo(id);
  publicar({ estado: 'online' });
  await sincronizar();
}

export async function descartarOperacao(id) {
  await fila?.descartar(id);
  publicar({ estado: 'online' });
}
