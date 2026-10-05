# Ligar o envio de e-mails do BNTT (cadastro e recuperação de senha)

**Por que é preciso:** sem um servidor de e-mail próprio, o Supabase só envia
e-mails para os membros da equipe do projeto (e com limite de poucos por hora).
Para qualquer outro usuário, o e-mail de confirmação e o de "esqueci minha
senha" **não saem**. Isso é regra do Supabase, não defeito do app.

## Opção recomendada para começar já: Gmail (grátis, até 500 e-mails/dia)

1. Crie (ou use) um Gmail só do produto, ex.: `bntt.app@gmail.com`.
2. Ative a **verificação em duas etapas** nessa conta (myaccount.google.com → Segurança).
3. Em myaccount.google.com → Segurança → **Senhas de app**, crie uma senha de app chamada "BNTT Supabase" e copie os 16 caracteres.
4. No Supabase (projeto **appbntt**) → **Authentication → Emails → SMTP Settings** → ative **Enable custom SMTP** e preencha:
   - Sender email: `bntt.app@gmail.com`
   - Sender name: `BNTT`
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: `bntt.app@gmail.com`
   - Password: *(a senha de app do passo 3)*
5. **Authentication → Rate Limits**: "Rate limit for sending emails" = 30 por hora (o padrão é baixo demais).

> Quando o BNTT tiver domínio próprio (ex.: bntt.com.br), troque pelo Resend
> ou outro serviço transacional: melhor entrega e remetente `nao-responda@bntt.com.br`.

## Endereços (obrigatório)

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://bnttapp.web.app`
- **Redirect URLs:** adicione `https://bnttapp.web.app/app` e `https://bnttapp.web.app/**`

## Textos em português (recomendado)

Supabase → **Authentication → Emails → Templates**:
- **Confirm signup** → assunto `Confirme seu e-mail no BNTT` → cole o conteúdo de `supabase/templates/confirmar-cadastro.html`.
- **Reset password** → assunto `Crie uma nova senha do BNTT` → cole `supabase/templates/redefinir-senha.html`.

## Testar (5 minutos)

1. Em bnttapp.web.app → Entrar → **Esqueci minha senha** → seu e-mail → deve chegar "Crie uma nova senha do BNTT".
2. Toque no link → o app abre em "Definir nova senha".
3. Em outra conta de e-mail: LP → Começar grátis → criar conta → deve chegar "Confirme seu e-mail no BNTT" → toque → entra no app.

## Trocar a senha de alguém AGORA (sem e-mail)

No computador, na pasta do projeto:

    node scripts/definir-senha.mjs email-da-pessoa@exemplo.com

Digite a senha nova quando pedir (ela não aparece na tela nem fica salva).
Passe a senha para a pessoa por um canal seguro e peça para trocar depois em
"Esqueci minha senha".
