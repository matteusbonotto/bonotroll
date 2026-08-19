// Chave PÚBLICA do par VAPID usado pra Web Push (ver js/services/push.js).
// É segura de ficar no client — só a chave PRIVADA correspondente (que never
// entra neste repositório) consegue de fato assinar/enviar notificações; ela
// vive só como secret da Edge Function no Supabase (ver
// supabase/NOTIFICACOES.md pra gerar um par novo e configurar as duas).
export const VAPID_PUBLIC_KEY = 'BP6sCx58hUU_pPD1H01CbiGb2PFwgMfn01J9TY-HYUrU4WHTxVB2qZPfCqx6goh0GIew1-g0Tz9D3o053akkH3M';
