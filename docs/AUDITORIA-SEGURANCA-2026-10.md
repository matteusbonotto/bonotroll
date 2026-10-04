# Auditoria de segurança — 2026-10-04 (somente leitura)

Nenhum SQL injection, XSS (`x-html`/`innerHTML`) ou segredo no repositório. Todas as 21 tabelas têm RLS ativo. As Edge Functions falham fechadas e comparam o segredo em tempo constante. Os problemas reais estão nas policies do banco.

| ID | Severidade | Problema | Onde | Precisa migração? | Status |
|---|---|---|---|---|---|
| C1 | Crítico | Qualquer usuário logado entra em qualquer grupo como `admin` (INSERT direto em `group_members`); um membro pode se promover a admin e apagar o grupo | schema.sql:621-625 | Sim | Migração pronta, aguardando acesso ao banco |
| C2 | Crítico | Código de convite de 6 hex, sem limite de tentativas; admin não consegue remover membro nem trocar o código | schema.sql:539-571 | Sim | Migração pronta |
| A1 | Alto | Trigger de orçamento insere `tipo='orcamento_estourado'`, fora do CHECK de `notifications.tipo` — pode impedir salvar a despesa | schema.sql:447 e 895-910 | Sim | Migração pronta |
| A2 | Alto | UPDATE permite mover linhas para o `group_id` de outra casa | categories, companies, banks, cartoes, transactions, resource_*, caixinhas, shopping_lists | Sim | Migração pronta |
| A3 | Alto | SSRF cego: `push_subscriptions.endpoint` livre, e as Edge Functions fazem POST nele | schema.sql:464 e 925; notify-* | Sim | Migração pronta |
| A4 | Alto | `.env-old` local com chaves `service_role` do banco antigo | raiz (fora do git) | Não | **Ação do usuário:** rotacionar ou excluir o projeto antigo e apagar o arquivo |
| A5 | Alto | CSP sem `script-src`/`connect-src` | firebase.json | Não | Corrigido nesta rodada |
| A6 | Alto | CDN sem SRI; dependências do esm.sh sem pin | index.html, imports | Não | Planejado: self-host em /vendor |
| M1 | Médio | `handle_new_user`/`is_group_member` (SECURITY DEFINER) sem `search_path` | schema.sql:475 e 495 | Sim | Migração pronta |
| M2 | Médio | Bucket `avatars` público, listável, sem limite de tipo e tamanho | schema.sql:987-993 | Sim | Migração pronta (limites) |
| M3 | Médio | Sem recuperação ou troca de senha, sem MFA; senha mínima de 6 só no cliente | auth | Painel + front | Planejado (card de autenticação) |
| M4 | Médio | URLs de imagem livres (pixel de rastreio) | perfil/logos | Sim + front | Planejado |
| M5 | Médio | `?demo=1` persiste a flag (engenharia social) | config.js | Não | Aceito por ora (o demo é um recurso público) |
| M6 | Médio | Dados financeiros em texto puro; sem excluir conta | schema | Sim | Fase 3 (cripto ponta a ponta + LGPD) |
| M7 | Médio | Sem limite de tamanho nas colunas de texto nem rate limit nas RPCs | schema | Sim | Migração pronta (limites principais) |
| B1–B8 | Baixo | Notificação duplicada (deduplicada), URL fixa, validação de payload, headers COOP, repo público, `npm install` no CI, JWT em localStorage | vários | — | COOP e `npm ci` corrigidos nesta rodada; o resto está planejado |

A proposta de CSP e os detalhes de cada exploit estão no relatório original desta rodada (resumo em docs/CHECKLIST-REBRAND.md).
