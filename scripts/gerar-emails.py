# Gera os modelos de e-mail do BNTT (supabase/templates/*.html) a partir de
# um único layout. Para colar no Supabase: Authentication -> Emails ->
# Templates (o assunto de cada um está no comentário do topo do arquivo).
#   python scripts/gerar-emails.py
#
# Regras de e-mail (Gmail/Outlook/celular): layout em <table>, estilos inline,
# largura máx. 560px, logo em PNG (Gmail não mostra SVG), botão "à prova de
# Outlook" (tabela + link) e o link escrito por extenso como plano B.
import io
import os

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DESTINO = os.path.join(RAIZ, "supabase", "templates")
SITE = "https://bnttapp.web.app"
# Logo hospedado no Storage do próprio Supabase (bucket público "marca"):
# o painel do Supabase só mostra na prévia imagens de *.supabase.co.
LOGO = "https://qlcrsclgtpjeqkmykqrs.supabase.co/storage/v1/object/public/marca/bntt-logo.png"
VERDE = "#0E9F6E"
VERDE_ESCURO = "#0A6E4D"
TINTA = "#10201A"
MUDO = "#5B6B65"
FUNDO = "#F3F6F4"

LAYOUT = """<!-- {nome_supabase} · Assunto: {assunto} -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{assunto}</title>
</head>
<body style="margin:0;padding:0;background:{fundo};-webkit-text-size-adjust:100%;">
<!-- Texto de pré-visualização (aparece ao lado do assunto na caixa de entrada) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{preheader}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{fundo};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <!-- Marca -->
        <tr>
          <td align="center" style="padding:0 0 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;"><img src="{logo}" width="40" height="40" alt="BNTT" style="display:block;border:0;border-radius:10px;"></td>
                <td style="vertical-align:middle;padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:{tinta};letter-spacing:.5px;">BNTT</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Cartão -->
        <tr>
          <td style="background:#FFFFFF;border-radius:16px;border:1px solid #E1E8E4;border-top:5px solid {verde};padding:36px 32px;font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:0 0 18px;">
                  <div style="width:64px;height:64px;line-height:64px;border-radius:32px;background:#E3F5EC;font-size:30px;text-align:center;">{emoji}</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="font-size:24px;line-height:1.25;font-weight:800;color:{tinta};padding:0 0 12px;">{titulo}</td>
              </tr>
              <tr>
                <td align="center" style="font-size:16px;line-height:1.6;color:{mudo};padding:0 0 28px;">{texto}</td>
              </tr>
{acao}
              <tr>
                <td style="padding:28px 0 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{fundo};border-radius:12px;">
                    <tr>
                      <td style="padding:14px 16px;font-size:13px;line-height:1.55;color:{mudo};">{aviso}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Rodapé -->
        <tr>
          <td align="center" style="padding:22px 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8A9A94;">
            BNTT · Seu dinheiro. Sua casa. Sob controle.<br>
            Você recebeu este e-mail porque ele foi usado no <a href="{site}" style="color:#8A9A94;text-decoration:underline;">bnttapp.web.app</a>.<br>
            E-mail automático — não precisa responder.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
"""

BOTAO = """              <tr>
                <td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" bgcolor="{verde}" style="border-radius:999px;background:{verde};">
                        <a href="{{{{ .ConfirmationURL }}}}" target="_blank" style="display:inline-block;padding:16px 36px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">{rotulo}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:22px 0 0;font-size:13px;line-height:1.5;color:{mudo};">
                  O botão não funcionou? Copie e cole este endereço no navegador:<br>
                  <a href="{{{{ .ConfirmationURL }}}}" style="color:{verde_escuro};word-break:break-all;">{{{{ .ConfirmationURL }}}}</a>
                </td>
              </tr>"""

CODIGO = """              <tr>
                <td align="center">
                  <div style="display:inline-block;padding:16px 28px;border-radius:14px;background:#E3F5EC;border:1px dashed {verde};font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:{tinta};">{{{{ .Token }}}}</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:16px 0 0;font-size:13px;line-height:1.5;color:{mudo};">Digite este código no BNTT para continuar.</td>
              </tr>"""

MODELOS = [
    {
        "arquivo": "confirmar-cadastro.html",
        "nome_supabase": "Confirm signup",
        "assunto": "Confirme seu e-mail para começar no BNTT",
        "preheader": "Falta só um toque para sua conta ficar pronta.",
        "emoji": "&#9993;&#65039;",
        "titulo": "Confirme seu e-mail",
        "texto": "Que bom ter você no BNTT! Toque no botão abaixo para confirmar este e-mail e entrar na sua conta.",
        "botao": "Confirmar meu e-mail",
        "aviso": "<strong>Não criou uma conta no BNTT?</strong> Pode ignorar este e-mail — nada será criado sem a confirmação.",
    },
    {
        "arquivo": "redefinir-senha.html",
        "nome_supabase": "Reset password (também é o \"Esqueci minha senha\")",
        "assunto": "Crie uma nova senha do BNTT",
        "preheader": "Recebemos um pedido para trocar a sua senha.",
        "emoji": "&#128273;",
        "titulo": "Vamos criar uma nova senha",
        "texto": "Recebemos um pedido para trocar a senha da sua conta. Toque no botão abaixo e escolha a nova senha. O link vale por 1 hora.",
        "botao": "Criar nova senha",
        "aviso": "<strong>Não pediu para trocar a senha?</strong> Ignore este e-mail — a sua senha atual continua valendo e ninguém entra na sua conta sem ela.",
    },
    {
        "arquivo": "link-magico.html",
        "nome_supabase": "Magic link",
        "assunto": "Seu link para entrar no BNTT",
        "preheader": "Entre na sua conta com um toque, sem digitar senha.",
        "emoji": "&#10024;",
        "titulo": "Seu link de acesso",
        "texto": "Toque no botão abaixo para entrar no BNTT. O link funciona uma vez só e vale por 1 hora.",
        "botao": "Entrar no BNTT",
        "aviso": "<strong>Não pediu para entrar?</strong> Ignore este e-mail. Sem tocar no link, ninguém acessa a sua conta.",
    },
    {
        "arquivo": "trocar-email.html",
        "nome_supabase": "Change email address",
        "assunto": "Confirme o seu novo e-mail no BNTT",
        "preheader": "Confirme a troca de e-mail da sua conta.",
        "emoji": "&#128231;",
        "titulo": "Confirme o novo e-mail",
        "texto": "Você pediu para trocar o e-mail da sua conta de <strong>{{ .Email }}</strong> para <strong>{{ .NewEmail }}</strong>. Toque no botão para confirmar.",
        "botao": "Confirmar novo e-mail",
        "aviso": "<strong>Não pediu essa troca?</strong> Não toque no botão e troque a sua senha no BNTT por segurança.",
    },
    {
        "arquivo": "convite.html",
        "nome_supabase": "Invite user",
        "assunto": "Você foi convidado para o BNTT",
        "preheader": "Aceite o convite e crie o seu acesso.",
        "emoji": "&#127881;",
        "titulo": "Você recebeu um convite",
        "texto": "Alguém convidou você para usar o BNTT — o app que organiza o dinheiro, as compras e a casa (ou a empresa) em um só lugar. Toque no botão para aceitar e criar o seu acesso.",
        "botao": "Aceitar convite",
        "aviso": "<strong>Não esperava este convite?</strong> Pode ignorar este e-mail — nenhuma conta é criada sem você aceitar.",
    },
    {
        "arquivo": "codigo-confirmacao.html",
        "nome_supabase": "Reauthentication",
        "assunto": "Seu código de confirmação do BNTT",
        "preheader": "Use este código para confirmar que é você.",
        "emoji": "&#128274;",
        "titulo": "Confirme que é você",
        "texto": "Para proteger a sua conta, precisamos confirmar uma ação importante. Use o código abaixo:",
        "codigo": True,
        "aviso": "<strong>Não foi você?</strong> Não passe este código para ninguém — nem para quem disser que é do BNTT. Troque a sua senha por segurança.",
    },
]

cores = dict(verde=VERDE, verde_escuro=VERDE_ESCURO, tinta=TINTA, mudo=MUDO, fundo=FUNDO)
os.makedirs(DESTINO, exist_ok=True)
for m in MODELOS:
    acao = CODIGO.format(**cores) if m.get("codigo") else BOTAO.format(rotulo=m["botao"], **cores)
    html = LAYOUT.format(acao=acao, logo=LOGO, site=SITE, **cores, **{k: v for k, v in m.items() if k not in ("arquivo", "botao", "codigo")})
    io.open(os.path.join(DESTINO, m["arquivo"]), "w", encoding="utf-8", newline="\n").write(html)
    print(f"{m['arquivo']:<26} -> {m['nome_supabase']} | Assunto: {m['assunto']}")
