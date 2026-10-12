# IRPF no BNTT Home — investigação tributária e técnica (Fase 5)

Feita em 2026-10-11. Cada número abaixo tem fonte oficial (gov.br/receitafederal ou lei). O que veio só de guias de terceiros aparece marcado **[a conferir no programa oficial]** e **não** é tratado como verdade pelo app.

## 1. Exercício x ano-calendário

| Exercício (ano da entrega) | Ano-calendário (ano dos rendimentos) | Situação em 2026-10-11 |
|---|---|---|
| **2026** | 2025 | Encerrado: entrega de 23/03 a 29/05/2026. Regras: IN RFB nº 2.312/2026. Tabelas, limites e P&R publicados. **É o exercício usado para construir e testar o app.** |
| **2027** | 2026 | Ainda não aberto. A **tabela anual** e o **redutor da Lei 15.270/2025** já estão publicados na página "Tributação de 2026" da Receita. A Instrução Normativa, o programa e a lista de fichas e códigos do exercício 2027 **ainda não existem** (saem em fev–mar/2027). |

O app guarda as regras **por exercício** (`js/irpf/regras/2026.js`, `2027.js`) e nunca supõe que o formato de um ano vale para o outro.

## 2. Números oficiais usados no cálculo

### Exercício 2026 (ano-calendário 2025)
Fonte: [Receita — Tributação de 2025](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2025) e [P&R IRPF 2026, pergunta 012](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirpf/p-r-irpf-2026-v1-00-2026-04-23.pdf).

| Base de cálculo anual (R$) | Alíquota | Parcela a deduzir (R$) |
|---|---|---|
| até 28.467,20 | — | — |
| 28.467,21 a 33.919,80 | 7,5% | 2.135,04 |
| 33.919,81 a 45.012,60 | 15% | 4.679,03 |
| 45.012,61 a 55.976,16 | 22,5% | 8.054,97 |
| acima de 55.976,16 | 27,5% | 10.853,78 |

- Dedução por dependente: **R$ 2.275,08**/ano.
- Limite de despesas com instrução: **R$ 3.561,50**/ano por pessoa.
- Desconto simplificado: **20%** dos rendimentos tributáveis, limitado a **R$ 16.754,34**. Substitui **todas** as deduções legais (P&R 012).
- Obrigatoriedade: rendimentos tributáveis acima de **R$ 35.584,00**; isentos ou exclusivos acima de R$ 200 mil; bens acima de R$ 800 mil; entre outros critérios. Fonte: [Receita — Quem deve declarar](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/quem) e IN RFB 2.312/2026.

### Exercício 2027 (ano-calendário 2026)
Fonte: [Receita — Tributação de 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026).

| Base de cálculo anual (R$) | Alíquota | Parcela a deduzir (R$) |
|---|---|---|
| até 29.145,60 | — | — |
| 29.145,61 a 33.919,80 | 7,5% | 2.185,92 |
| 33.919,81 a 45.012,60 | 15% | 4.729,91 |
| 45.012,61 a 55.976,16 | 22,5% | 8.105,85 |
| acima de 55.976,16 | 27,5% | 10.904,66 |

- **Redutor anual (Lei 15.270/2025):** com rendimentos tributáveis até R$ 60.000,00, a redução vai até R$ 2.694,15, de modo que o imposto fique zero. Entre R$ 60.000,01 e R$ 88.200,00, a redução é `8.429,73 − 0,095575 × rendimentos tributáveis`. Acima disso, não há redução.
- Dependente: R$ 2.275,08 · Instrução: R$ 3.561,50 · Desconto simplificado: limite **R$ 17.640,00**.
- **Fora do escopo do app:** tributação mínima de altas rendas (rendimentos anuais acima de R$ 600 mil) e retenção sobre dividendos. O app **avisa** e não calcula esses casos.
- Obrigatoriedade 2027: **ainda não publicada.** O app mostra "a confirmar".

## 3. Fichas e códigos oficiais

Os nomes das fichas abaixo aparecem literalmente no P&R IRPF 2026: "Rendimentos Tributáveis Recebidos de Pessoa Jurídica pelo Titular", "Rendimentos Isentos e Não Tributáveis", "Rendimentos Sujeitos à Tributação Exclusiva/Definitiva", "Pagamentos Efetuados", "Bens e Direitos" e "Dívidas e Ônus Reais".

**Códigos confirmados em documento oficial** (P&R IRPF 2026):

| Ficha | Código | Texto oficial |
|---|---|---|
| Bens e Direitos | Grupo 06, código 01 | Depósito em conta corrente ou conta pagamento |
| Bens e Direitos | Grupo 02, código 01 | Veículo automotor terrestre: caminhão, automóvel, moto etc. |
| Bens e Direitos | Grupo 08 | Criptoativos |
| Bens e Direitos | Grupo 99, código 05 | Consórcio não contemplado |
| Pagamentos Efetuados | 36 | Previdência Complementar (inclusive FAPI) |
| Pagamentos Efetuados | 71 | Administrador de imóveis |
| Rendimentos Isentos e Não Tributáveis | 14 | Transferências patrimoniais – doações e heranças |
| Tributação Exclusiva/Definitiva | 12 | Outros |

**Usados pelo app, mas confirmados só em guias de terceiros** **[a conferir no programa oficial]**: Isentos 12 (poupança, LCI/LCA); Pagamentos 01 (Instrução no Brasil), 21 (Médicos no Brasil) e 26 (Planos de saúde no Brasil); Bens Grupo 04, código 01 (poupança) e código 02 (outras aplicações/CDB). O app mostra esses códigos com o selo "confira no programa", nunca como certos.

**Pendência:** baixar o programa IRPF 2026 e transcrever a tabela de códigos completa da ajuda dele. A ajuda é distribuída dentro do programa, não como página aberta.

## 4. Importação e exportação oficiais

O que existe oficialmente:
- **Declaração pré-preenchida:** a própria Receita preenche, e é preciso conta gov.br prata/ouro. O BNTT **não** tem acesso a isso, e nem deve ter.
- **Importação da declaração do ano anterior** (arquivo `.DEC` gerado pelo próprio programa).
- **Importação do Carnê-Leão.**

O que **não** encontrei: nenhum layout publicado do `.DEC` nem especificação para software de terceiros gerar arquivo importável pelo programa da Receita. Os guias encontrados só ensinam a localizar e importar o `.DEC` gerado pelo próprio programa, e sistemas públicos (SISPATRI-SP, SAEP-SP) **leem** esse arquivo, mas não o geram.

**Decisão:** **não há exportador** para o programa da Receita. Gerar um arquivo "parecido" e apresentar como compatível seria inventar formato, o que o pedido proíbe. A saída do app é:
1. Resumo organizado **na ordem e com os nomes das fichas oficiais**.
2. **Guia de preenchimento** passo a passo (ficha → campo → valor → documento de origem).
3. Exportação CSV/JSON **do próprio BNTT** (rotulada assim, sem pretender ser oficial), para conferência ou para um contador.

A Fase 9 continua aberta: se a Receita publicar especificação e meio de validação, aí se implementa.

## 5. Gemini

- Os termos da API do Gemini dizem que **dados da camada gratuita podem ser usados pelo Google para melhorar produtos e lidos por revisores humanos**. Na camada **paga** (projeto com faturamento ativo), prompts, arquivos e respostas **não** são usados para isso. Fonte: [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms).
  → **Documento fiscal só com faturamento ativo.** A Edge Function recusa rodar se o secret `GEMINI_TIER_PAGO` não for `sim`, como lembrete operacional.
- Modelo: configurável pelo secret `GEMINI_MODEL`. Padrão: **`gemini-3.5-flash`** (estável desde 19/05/2026, segundo o [ciclo de vida de modelos do Google Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions)). A família 2.5 é aposentada em 20/10/2026 e por isso não é usada. **Conferir a lista de modelos em ai.google.dev na Fase 8, antes do deploy.**
- Uso: só extração e classificação, com **saída JSON validada por esquema** (`responseSchema`) e **sem ferramentas**. O texto do documento vai marcado como dado não confiável. O cálculo nunca é feito pela IA.

## 6. Arquitetura atual relevante (resumo)

- PF e PJ: mesmo app, `conta.tipo` = `'home' | 'business'`. A área IRPF aparece **só** quando `conta.tipo === 'home'`. As tabelas `irpf_*` (Fase 8) terão RLS **só do dono** (nem o grupo/casal vê; decisão D3 do plano) e um `check` da linha.
- Arquivos: o Storage do Supabase já é usado (avatares, comprovantes). O IRPF terá um bucket **privado** próprio na Fase 8. Até lá, no demo, os arquivos **não são guardados**: só o resultado extraído.
- Leitura de PDF e OCR já existem no aparelho (`js/services/pdf.js` com pdf.js, `js/services/ocr.js` com Tesseract). O texto é extraído **no aparelho**, e só o texto (não o PDF) seguiria para a IA.
- Privacidade: `privacidade.html` precisa de seção sobre documentos fiscais e IA antes de ligar o Gemini (Fase 8).

## 7. O que precisa de documento real autorizado ou de configuração externa

- Layouts reais de informes de cada banco, corretora e empregador (os testes usam **documentos sintéticos**).
- Qualidade do OCR em documento escaneado real.
- Precisão do Gemini em documentos reais (só na Fase 8, com conta paga).
- Tabela completa de códigos do programa IRPF 2026, e futuramente a do 2027.
