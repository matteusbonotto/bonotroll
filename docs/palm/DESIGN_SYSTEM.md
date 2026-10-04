# DESIGN SYSTEM — contrato (implementação na fase 4)

**Tokens** (`css/tokens.css`): cores semânticas, espaço (4, 8, 12, 16, 24, 32), raio (8, 12, 16, pílula), sombra (2 níveis), z-index nomeados (base, sticky, barra, folha, modal, aviso), movimento (150/250 ms; `prefers-reduced-motion` zera), **breakpoints oficiais: 600 e 992**.

**Componentes** (prefixo `cg-`, mantido por compatibilidade): `cg-nav-inferior`, `cg-folha` (bottom sheet), `cg-lista` + `cg-linha` (linha de 2 níveis, ≥ 56 px), `cg-estado` (vazio/erro/carregando com ação), `cg-atencao` (item de alerta com ícone + texto + ação), `cg-numero` (valor grande com rótulo), `cg-abas`. Botão, campo, select, switch, aviso e badge reaproveitam Bootstrap com tokens.

**Estados obrigatórios:** padrão, hover, foco visível (3 px), ativo, desabilitado, carregando, erro; alvo ≥ 44 px (48 px na barra inferior).

**Responsividade como contrato:** cada componente declara o comportamento até 600, de 600 a 992 e a partir de 992 px. Sem breakpoints novos fora desses dois.
