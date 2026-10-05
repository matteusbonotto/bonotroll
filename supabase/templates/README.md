# Modelos de e-mail do BNTT

Cole cada um no Supabase (projeto **appbntt**) → **Authentication → Emails → Templates**:
escolha o modelo, cole o **assunto**, mude para o editor de código ("Source"),
apague o conteúdo e cole o arquivo. Salve.

| Modelo no Supabase | Assunto | Arquivo |
|---|---|---|
| Confirm signup | Confirme seu e-mail para começar no BNTT | `confirmar-cadastro.html` |
| Reset password *(é o "Esqueci minha senha")* | Crie uma nova senha do BNTT | `redefinir-senha.html` |
| Magic link | Seu link para entrar no BNTT | `link-magico.html` |
| Change email address | Confirme o seu novo e-mail no BNTT | `trocar-email.html` |
| Invite user | Você foi convidado para o BNTT | `convite.html` |
| Reauthentication | Seu código de confirmação do BNTT | `codigo-confirmacao.html` |

- Cores e textos de todos de uma vez: edite `scripts/gerar-emails.py` e rode `python scripts/gerar-emails.py`.
- Passo a passo completo do envio de e-mail (SMTP, endereços, testes): `docs/CONFIGURAR-EMAIL.md`.
