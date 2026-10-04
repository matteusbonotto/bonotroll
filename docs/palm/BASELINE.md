# BASELINE — estado antes da reconstrução Palm Business (2026-10-04)

- **Commit:** `9c195fb` · **tag de segurança:** `pre-redesign` · **produção:** https://bnttapp.web.app
- **Testes:** 124 unitários (node --test) e 57 e2e (Playwright, modo demo) passando; e2e contra o build de produção com os cabeçalhos reais do firebase.json (`npm run test:dist`).
- **Build:** 711 KB → 636 KB de JS+CSS (minificado + obfuscado); varredura de segredos limpa.
- **Medição em 13 resoluções × 8 telas:** `docs/palm/medicao-resolucoes-baseline.txt`.
  - Nenhuma tela tem rolagem horizontal; a quebra relatada no celular é de outra natureza (densidade, sobreposição, hierarquia).
  - Alvos de toque < 44 px no celular: Transações 253–293, Caixinhas 8–10, Inventário 8, Início 6–7.
  - Texto < 12 px: Transações 48–66, Início 14–15 (vem de `style=` inline e de `small` dentro de `small`).
  - No desktop (≥1024 px) a barra do topo ultrapassa a largura em todas as telas.

## Como restaurar
`git checkout pre-redesign` (código). Deploy: `npm run build` e depois firebase deploy (ver docs/DEPLOY-FIREBASE.md).
