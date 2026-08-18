// Chave PÚBLICA do par VAPID usado pra Web Push (ver js/services/push.js).
// É segura de ficar no client — só a chave PRIVADA correspondente (que never
// entra neste repositório) consegue de fato assinar/enviar notificações; ela
// vive só como secret da Edge Function no Supabase (ver
// supabase/NOTIFICACOES.md pra gerar um par novo e configurar as duas).
export const VAPID_PUBLIC_KEY = 'BDgtDLSfDE2AeMKui1TSCaChqZY8SJttGnzzsMYQ_fhFV2jcxLz4j40LDxI-e9xw8OFl7Lyd1TwbObuWGNHnEBA';
