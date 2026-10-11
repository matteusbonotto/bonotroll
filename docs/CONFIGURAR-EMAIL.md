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

## Modelos de e-mail (cole cada um no Supabase)

Supabase → **Authentication → Emails → Templates**. Para cada linha: escolha o
modelo, cole o **assunto**, troque para o editor de código ("Source"), apague
tudo e cole o conteúdo do arquivo. Salve.

| Modelo no Supabase | Assunto | Arquivo |
|---|---|---|
| Confirm signup | Confirme seu e-mail para começar no BNTT | `supabase/templates/confirmar-cadastro.html` |
| Reset password *(é o "Esqueci minha senha")* | Crie uma nova senha do BNTT | `supabase/templates/redefinir-senha.html` |
| Magic link | Seu link para entrar no BNTT | `supabase/templates/link-magico.html` |
| Change email address | Confirme o seu novo e-mail no BNTT | `supabase/templates/trocar-email.html` |
| Invite user | Você foi convidado para o BNTT | `supabase/templates/convite.html` |
| Reauthentication | Seu código de confirmação do BNTT | `supabase/templates/codigo-confirmacao.html` |

Para mudar texto ou cor de todos de uma vez: edite `scripts/gerar-emails.py` e rode `python scripts/gerar-emails.py`.

> O modelo **Confirm signup** traz o link **e** um código de 6 dígitos
> (`{{ .Token }}`). O código é digitado na tela "Confirmar e-mail" do app — é o
> plano B quando o antivírus do provedor de e-mail "gasta" o link (que só vale
> uma vez) antes da pessoa tocar nele. Depois de colar o modelo novo, confira em
> **Authentication → Providers → Email** que "Email OTP Expiration" está em
> 3600 s (1 hora, o que o e-mail promete).

## Como saber se o e-mail está saindo (sem expor nada)

- **Authentication → Emails → SMTP Settings**: "Enable custom SMTP" precisa estar **ligado**. Desligado = só membros da equipe do projeto recebem (é a causa nº 1 do "não chega").
- **Logs → Auth** (filtro `mail`/`error`): procure `error sending confirmation email` (SMTP errado) ou `rate limit` (limite estourado).
- Nada disso é variável do `.env` — é configuração do projeto no painel.

## Testar (5 minutos)

1. Em bnttapp.web.app → Entrar → **Esqueci minha senha** → seu e-mail → deve chegar "Crie uma nova senha do BNTT".
2. Toque no link → o app abre em "Definir nova senha".
3. Em outra conta de e-mail: LP → Começar grátis → criar conta → deve chegar "Confirme seu e-mail no BNTT" → toque → entra no app.
4. Repita com outro e-mail, mas digite o **código** na tela "Confirmar e-mail" em vez de tocar no link → entra no app.
5. Tente criar conta de novo com um e-mail já cadastrado → a tela avisa "Já existe uma conta" (não promete um e-mail que não vai sair).

## Trocar a senha de alguém AGORA (sem e-mail)

No computador, na pasta do projeto:

    node scripts/definir-senha.mjs email-da-pessoa@exemplo.com

Digite a senha nova quando pedir (ela não aparece na tela nem fica salva).
Passe a senha para a pessoa por um canal seguro e peça para trocar depois em
"Esqueci minha senha".
