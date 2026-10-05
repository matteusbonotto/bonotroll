# Política de Privacidade — BNTT (RASCUNHO, não publicado)

> **Antes de publicar, o responsável precisa:** (1) preencher os campos `[[...]]`; (2) revisar com um profissional de direito; (3) atualizar a seção 7 quando a criptografia ponta a ponta for ativada (hoje ela **ainda não está** em produção). Este texto descreve o que o app faz em 04/10/2026.

**Última atualização:** [[data da publicação]]

## 1. Quem somos
O BNTT ("nós") é um aplicativo de organização financeira e doméstica. O **controlador** dos seus dados é [[nome completo ou razão social]], [[CPF/CNPJ]], [[endereço]]. **Encarregado de dados (DPO):** [[nome]] — [[e-mail de contato]].

## 2. Quais dados tratamos
| Dado | Exemplo | De onde vem |
|---|---|---|
| Conta | nome, e-mail, senha (guardada só como hash pelo provedor de autenticação) | você, no cadastro |
| Perfil | foto, cor | você |
| Finanças | lançamentos (título, valor, datas, categoria, empresa, observações), parcelas, cartões, caixinhas | você ou importação de planilha |
| Compras e inventário | itens, quantidades, preços, validade, fotos | você, câmera ou código de barras |
| Comprovantes e notas | foto ou PDF do comprovante, código do boleto/Pix, link e chave da nota fiscal (NFC-e) | você |
| Grupo (casa) | quem faz parte, papel (admin/membro) | você e quem convidou |
| Notificações | avisos do app e inscrição de push do aparelho | o app, com sua permissão |
| Técnicos | endereço IP e dados do navegador nos registros dos provedores | automático |

Não coletamos dados de localização. As **fichas de saúde** (tipo sanguíneo, alergias, remédios, condições, contato de emergência) são **criptografadas no seu aparelho** antes de sair dele: o servidor guarda só texto embaralhado e ninguém do BNTT consegue ler.

**Pagamento (planos pagos):** e-mail, nome e dados de cobrança são tratados pelo **Stripe**. O BNTT recebe só a confirmação do plano e um identificador do cliente — nunca o número do cartão.

## 3. Para que usamos (e com qual base legal — LGPD, art. 7º)
- Prestar o serviço que você pediu: guardar, calcular e mostrar suas informações (execução de contrato, art. 7º, V).
- Compartilhar com as pessoas do **seu** grupo o que pertence ao grupo (execução de contrato).
- Enviar notificações push (consentimento, art. 7º, I — você pode desligar a qualquer momento).
- Segurança, prevenção de fraude e abuso (legítimo interesse, art. 7º, IX).
- Cumprir obrigações legais (art. 7º, II).

Não vendemos seus dados. Não usamos seus dados para publicidade.

## 4. Com quem compartilhamos
- **Supabase** (banco de dados, autenticação, arquivos, funções) — operador que guarda os dados.
- **Google Firebase Hosting** — entrega o site (vê o IP de acesso).
- **Stripe** — processa os pagamentos dos planos (operador; recebe e-mail e dados de cobrança).
- Serviços consultados quando você usa um recurso específico (recebem só o que é necessário, sem identificar você):
  - **Open Food Facts**: o código de barras lido;
  - **BrasilAPI**: o CNPJ da loja da nota fiscal;
  - **Frankfurter / CoinGecko**: só a cotação da moeda;
  - **esm.sh / jsDelivr / Google Fonts**: bibliotecas e fontes (veem o IP).
- Autoridades, quando a lei exigir.

## 5. Transferência internacional
Os provedores acima podem armazenar ou processar dados fora do Brasil ([[região do projeto Supabase]]). Isso ocorre com as garantias do art. 33 da LGPD (cláusulas contratuais dos provedores).

## 6. Por quanto tempo guardamos
Enquanto sua conta existir. Você mesmo exclui a conta em **Configurações → Excluir minha conta**: os dados são apagados na hora (a assinatura, se houver, é cancelada), salvo o que a lei obrigar a guardar (ex.: registros fiscais de pagamento, mantidos pelo Stripe).

## 7. Como protegemos
- Conexão sempre criptografada (HTTPS/TLS).
- Dados criptografados em repouso pelo provedor.
- Cada pessoa só acessa os próprios dados e os do seu grupo (regras de segurança no banco, RLS).
- Política de segurança de conteúdo (CSP) no site.
- Varredura para impedir que chaves secretas cheguem ao navegador.
- **Fichas de saúde com criptografia ponta a ponta** (AES-256-GCM): a chave nasce no seu aparelho e só vai ao servidor protegida pela senha da família ou pelo código de recuperação. Nem a equipe do BNTT consegue ler.
- **Em implantação:** a mesma proteção para valores e descrições dos lançamentos.

## 8. Seus direitos (LGPD, art. 18)
Confirmar o tratamento, acessar, corrigir, levar seus dados (portabilidade — já disponível: **Configurações → Exportar meus dados**), anonimizar ou excluir (já disponível: **Configurações → Excluir minha conta**), saber com quem compartilhamos, revogar o consentimento e pedir revisão. Peça por [[e-mail do encarregado]]; respondemos em até 15 dias. Você também pode reclamar à ANPD (gov.br/anpd).

## 9. Crianças e adolescentes
O BNTT é feito para maiores de 18 anos. Dados de crianças da casa (ex.: na ficha de saúde) só podem ser registrados pelo responsável legal, no melhor interesse da criança (art. 14).

## 10. Cookies e armazenamento local
Usamos o armazenamento do navegador para manter você conectado e lembrar preferências (tema, tamanho do texto, lista aberta). Não usamos cookies de rastreamento nem de publicidade.

## 11. Mudanças nesta política
Avisaremos no app antes de mudanças relevantes.
