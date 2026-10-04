# Pesquisa: promoções de supermercado por região (2026-10-04)

Pedido do usuário: ver, para os itens da lista, ofertas nos mercados próximos (opções, promoções, lojas, mais barato), com imagem, preço, dados da loja, histórico e melhor dia para comprar.

## Conclusão honesta

Não existe no Brasil uma API pública, documentada e autorizada que devolva preço + loja + localização + imagem de supermercados.

- **Programas das SEFAZ** (Menor Preço/Nota Paraná – PR; Menor Preço Brasil – RS, BA, PE, RJ, DF e outros; Preço da Hora – BA/PB) têm o dado certo, mas só como app ou site para o consumidor. Automatizar sem convênio é risco jurídico; o Paraná proíbe consulta automatizada, segundo relato não confirmado na fonte oficial.
- **APIs comerciais** (Bluesoft Cosmos, SerpApi/Google Shopping, Mercado Livre) dão imagem, faixa de preço ou preço online, mas não "promoção no mercado perto de mim".
- **Encartes**: não há API; copiar encartes tem problema de direito autoral.
- **Open Food Facts**: dá imagem e nome por código de barras, é gratuito (ODbL / CC BY-SA, limite de 10 a 15 requisições por minuto), mas não tem preço.

## Recomendação (em ordem)

1. **Preços colaborativos a partir das notas fiscais (QR NFC-e) dos próprios usuários + Open Food Facts para as imagens.** Sem risco legal e sem custo, e cresce com o uso. Começa vazio; até lá, mostra o histórico da própria casa.
2. **Convênio ou dados abertos com as SEFAZ.** É o dado ideal, mas depende de autorização formal.
3. **Cosmos + Mercado Livre/SerpApi**, só como referência de preço online.

## O que dá para construir já, sem API externa

- Histórico de preços da casa (item, loja, data, valor), a partir das listas e despesas.
- Loja mais barata em que a casa já comprou cada produto.
- Alerta de "promoção" quando o preço atual fica abaixo da mediana do histórico.
- "Melhor dia para comprar", só depois de semanas de dados e de forma indicativa.
- Modelo de dados `price_observation` (gtin, nome, loja/CNPJ, cidade, preço, data, origem), para que as fontes 1 ou 2 entrem depois.

As fontes completas estão no relatório da pesquisa: Bem Paraná, TabNews, App Store/SEFAZ-PE, Legisweb, COAD, documentação do Open Food Facts, Bluesoft Cosmos, Mercado Livre Developers, SerpApi e Infosimples.
