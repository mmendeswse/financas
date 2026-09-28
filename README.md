# Muller Mendes

Sistema de gerenciamento de finanças pessoais — 100% local, sem servidor,
sem cadastro e sem mensalidade. Feito com HTML5, CSS3 e JavaScript puro
(mais Chart.js e SheetJS, incluídos no projeto para funcionar offline).

## Como usar

Basta abrir o arquivo `index.html` no navegador (duplo clique, ou
"Abrir com" → seu navegador). Não precisa instalar nada, não precisa de
internet, não precisa de servidor.

Na primeira vez que você abrir, o sistema carrega alguns dados de
demonstração (bancos, ações, despesas fictícias) só para você ver o
programa funcionando. Vá em **Configurações → Dados de demonstração**
para apagá-los e começar do zero com os seus dados reais.

## Onde ficam os seus dados

Tudo é salvo no armazenamento local do seu próprio navegador
(`localStorage`). Nada é enviado para nenhum servidor — o sistema nem tem
um servidor. Isso também quer dizer que:

- Os dados ficam ligados àquele navegador específico, naquele computador.
  Se você abrir em outro navegador ou computador, vai ver os dados de
  demonstração de novo.
- Limpar o cache/dados de navegação do navegador apaga os seus dados.
- Para levar seus dados para outro lugar (ou simplesmente ter uma cópia
  de segurança), use **Configurações → Exportar backup**. Isso baixa um
  arquivo `.json` que pode ser importado depois em qualquer navegador,
  em **Configurações → Importar backup**.

## O que o sistema faz

- Cadastro de bancos, com saldo sempre calculado (nunca digitado)
- Entradas e despesas por categoria, banco e cartão
- Cartões de crédito com limite usado/disponível calculado pela fatura
- Contas a pagar com status automático (pendente/pago/atrasado)
- Histórico completo com busca, filtros e ordenação
- Investimentos (renda fixa, tesouro, fundos, cripto)
- Carteira de ações, FIIs e ETFs, com preço **atualizado manualmente**
  (não há cotação automática nesta versão — veja "Limitações" abaixo)
- Metas financeiras com barra de progresso
- Relatórios por período com gráficos
- Importação de lançamentos a partir de uma planilha Excel (.xlsx)
- Backup e restauração completos via arquivo `.json`

## Limitações desta versão (de propósito)

- **Sem cotações automáticas.** Os preços de ações, FIIs e ETFs são
  digitados por você. O sistema deixa isso claro na tela ("preço
  atualizado manualmente") para nunca fingir uma informação em tempo
  real que não existe.
- **Sem sincronização entre dispositivos.** Os dados moram no navegador.
  Use o backup para mover dados entre computadores.
- **Sem senha ou login.** É um arquivo local, não um serviço — qualquer
  pessoa com acesso ao computador e ao navegador vê os dados. Nunca
  digite senhas de banco, cartão ou tokens de acesso em lugar nenhum do
  sistema; ele nunca pede isso.

## Estrutura do projeto

```
investidor-mestre/
├── index.html              # estrutura da página (sidebar, topbar, modal)
├── css/
│   └── style.css           # tema visual (escuro, estilo terminal financeiro)
├── js/
│   ├── armazenamento.js    # salvar/carregar/exportar/importar dados
│   ├── financeiro.js       # cálculos de bancos, entradas, despesas, cartões
│   ├── investimentos.js    # cálculos de investimentos, ações e patrimônio
│   ├── graficos.js         # todos os gráficos (Chart.js)
│   ├── app.js              # interface: navegação, telas, modais, eventos
│   └── vendor/              # bibliotecas de terceiros incluídas offline
│       ├── chart.umd.min.js
│       └── xlsx.full.min.js
└── assets/
    ├── icons/               # reservada (ícones atuais são SVG embutido)
    └── images/              # reservada (sem imagens nesta versão)
```

Cada arquivo JavaScript tem uma responsabilidade única: `armazenamento.js`
não sabe nada sobre a tela, `financeiro.js` e `investimentos.js` só fazem
contas a partir dos dados, `graficos.js` só desenha gráficos, e `app.js` é
o único arquivo que toca no HTML.

## Próximos passos possíveis

A arquitetura já foi pensada para receber, no futuro: integração com Open
Finance, cotações automáticas de ações, importação automática de
extratos bancários, análises mais inteligentes, e um aplicativo desktop.
Nenhuma dessas coisas está implementada agora — são só o caminho natural
de evolução do projeto.
