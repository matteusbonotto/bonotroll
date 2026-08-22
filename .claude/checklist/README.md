# Checklist Kanban — Bõnotto

Painel operacional visual do projeto: Kanban compacto + KPIs + gráficos pequenos, lendo/escrevendo `tasks.json`. É uma ferramenta interna de gestão do trabalho (deste `.claude/`), **não faz parte do app Bõnotto** e não é publicada no GitHub Pages.

## Como abrir

```bash
python -m http.server 5500   # a partir da raiz do repo (mesmo comando já usado pro app)
# abrir http://localhost:5500/.claude/checklist/
```

Também abre direto via `file://.claude/checklist/index.html`, mas nesse modo o carregamento automático de `tasks.json` (via `fetch`) não funciona (navegadores bloqueiam `fetch` de `file://`) — ele cai no cache do `localStorage` ou fica vazio até você clicar em **Importar**.

## Persistência (leia antes de confiar cegamente no board)

- **Ao abrir pela primeira vez**: tenta `fetch('./tasks.json')`. Se conseguir, é a fonte de verdade da sessão.
- **Toda edição** (arrastar card, criar/editar item, ações rápidas) grava imediatamente no `localStorage` do navegador — isso é cache, **não é o arquivo real**.
- **"Conectar arquivo"** (Chrome/Edge desktop, usa a File System Access API): abre um seletor de arquivo, você escolhe o `tasks.json` deste mesmo diretório, e a partir daí toda edição é salva **direto no arquivo de verdade**, sem precisar exportar manualmente. Precisa reconectar a cada sessão nova (a permissão não é lembrada entre recarregamentos de página, por limitação do navegador).
- **Sem "Conectar arquivo"** (Firefox/Safari, ou se você não clicar): use **Exportar** pra baixar o `tasks.json` atualizado e substituir o arquivo manualmente — o badge de sincronização no topo avisa quando o que está na tela ainda não foi salvo de verdade (`Sincronizado` / `Não sincronizado` / `Salvando…` / `Erro`), nunca finge que salvou se não salvou.
- **Importar** substitui os dados da tela (sempre pede confirmação antes, nunca sobrescreve silenciosamente) — não mexe no arquivo em disco até você exportar/salvar de novo.

## Estrutura de `tasks.json`

```json
{ "version": 1, "updatedAt": "ISO-8601", "tasks": [ { "id": "...", "title": "...", "status": "BACKLOG|PLANNED|IN_PROGRESS|BLOCKED|REVIEW|TESTING|DONE|DEPRECATED|REMOVED", "priority": "CRITICAL|HIGH|MEDIUM|LOW", "category": "...", "agent": "...", "tags": [], "dependencies": [], "history": [...] } ] }
```

`DEPRECATED`/`REMOVED` não aparecem nas 7 colunas principais — ficam atrás do toggle "Mostrar arquivados", pra não poluir o fluxo (nada é apagado de verdade, só arquivado com motivo registrado no histórico).

## Limitações conhecidas (honestidade, não vergonha)

- Responsivo por scroll horizontal das colunas no mobile — não tem um offcanvas de filtros dedicado (simplificação deliberada: é uma ferramenta interna de uso ocasional, não o app principal, que tem exigência de responsividade muito mais alta).
- Sem teste automatizado (é fora do escopo de `npm test`/`npm run test:unit`, que cobrem só o app Bõnotto). Testado por leitura cuidadosa do código, não por execução real num navegador — se algo não funcionar como esperado, é o primeiro lugar a checar.
- `nextId()` gera IDs únicos mas não numerados sequencialmente de forma bonita se você criar itens fora de ordem — não afeta funcionamento, só estética do ID.
