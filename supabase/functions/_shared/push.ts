// Só envia Web Push para os serviços de push OFICIAIS (Google/FCM, Mozilla,
// Windows, Apple). O endpoint vem da tabela push_subscriptions, que o próprio
// usuário grava — sem esta checagem, alguém poderia salvar um endpoint
// qualquer (ex.: um serviço interno) e fazer o servidor mandar POST para ele
// (SSRF). A constraint endpoint_push_oficial do banco é NOT VALID (não
// revalida linhas antigas), então a função confere de novo aqui.
// Mesma regra de supabase/schema.sql (endpoint_push_oficial) — mantenha iguais.
const ENDPOINT_OFICIAL =
  /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)\//;

export function endpointPushOficial(endpoint: unknown): boolean {
  return typeof endpoint === 'string' && ENDPOINT_OFICIAL.test(endpoint);
}
