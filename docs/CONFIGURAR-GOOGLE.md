# Ligar "Continuar com o Google" no BNTT

O botão já está no app (`js/services/auth.js` → `signInWithGoogle`). Falta só a
configuração externa, feita uma vez. **Nenhum valor secreto vai para o
repositório nem para o `.env` do frontend** — o Client Secret fica só no painel
do Supabase.

## 1. Google Cloud Console (console.cloud.google.com)

1. Crie (ou escolha) um projeto, ex.: `bntt`.
2. **APIs e serviços → Tela de consentimento OAuth** (ou "Google Auth Platform → Branding"):
   - Tipo de usuário: **Externo**.
   - Nome do app: `BNTT` · E-mail de suporte: o e-mail do produto · Logo: `assets/logos/logo-colorida.svg` exportado em PNG 120×120.
   - Domínio autorizado: `web.app` (e o domínio próprio, quando houver).
   - Página inicial: `https://bnttapp.web.app` · Política de privacidade: `https://bnttapp.web.app/privacidade.html` · Termos: `https://bnttapp.web.app/termos.html`.
   - Escopos: só `openid`, `email` e `profile` (não exigem verificação do Google).
   - Publique o app ("Em produção"). Em "Teste", só os e-mails da lista de testadores conseguem entrar.
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**:
   - Origens JavaScript autorizadas: `https://bnttapp.web.app` e `http://localhost:5510`.
   - URIs de redirecionamento autorizados: `https://<REF-DO-PROJETO>.supabase.co/auth/v1/callback`
     (o REF é o `SB_PROJ_ID` do `.env`; confira em Supabase → Authentication → Providers → Google, que mostra o endereço exato).
   - Copie o **Client ID** e o **Client Secret**.

## 2. Supabase (projeto oficial do BNTT)

1. **Authentication → Sign In / Providers → Google** → ligar, colar Client ID e Client Secret, salvar.
2. **Authentication → URL Configuration**: Redirect URLs com `https://bnttapp.web.app/app`, `https://bnttapp.web.app/**` e `http://localhost:5510/**`.
3. Gatilho do perfil: aplicar a versão do `handle_new_user` que lê `full_name`/`name` (Fase 8 do `docs/PLANO-COMPLEMENTO-2026-10.md`). Até lá o app corrige o nome sozinho no primeiro login (ver `store.loadSession`).

## 3. Testar

1. Em `bnttapp.web.app/app` → **Continuar com o Google** → escolher conta → volta logado.
2. Conta nova pela LP com "Começar grátis" no Business → depois do Google, o app abre na linha Business (o tipo escolhido é gravado no 1º login).
3. E-mail que já tinha conta com senha → o Supabase liga as duas formas de entrar à mesma conta (o e-mail do Google é verificado).
4. Cancelar na tela do Google → volta para a entrada com "O acesso foi cancelado".

> A tela do Google mostra o endereço `<ref>.supabase.co` como destino. Para
> aparecer `bnttapp.web.app`, seria preciso domínio personalizado no Supabase
> (recurso pago) — opcional.
