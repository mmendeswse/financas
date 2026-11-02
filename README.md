# Muller Mendes

Sistema de gerenciamento de finanças pessoais — 100% local, sem servidor,
sem cadastro e sem mensalidade. Feito com HTML5, CSS3 e JavaScript puro
(mais Chart.js e PDF.js, incluídos no projeto para funcionar offline).

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
- Carteira de ações, FIIs e ETFs, com cotações buscadas da internet
  (e preço manual quando não há conexão)
- Guia Bolsa com índices, dólar, criptomoedas e notícias do mercado
- Metas financeiras com barra de progresso
- Relatórios por período com gráficos
- Importação de investimentos a partir do extrato/relatório em PDF
- Backup e restauração completos via arquivo `.json`
- Sincronização opcional entre aparelhos: conta com código (texto e QR
  code), dados criptografados num Gist privado do GitHub
- Perfil com avatar (foto, personagens de anime ou emoji), como no Meu Controle
- Senha numérica e Face ID / Touch ID para abrir o app

## Cuidados

- **Cotações dependem da internet.** Sem conexão, o app mostra o último
  preço guardado, com a data em que foi atualizado.
- **Sincronização usa o seu GitHub — basta a chave, sem repositório.** Em
  Configurações → Sincronização, "Criar conta" pede uma chave do GitHub
  (token *classic* só com a permissão **gist**). O sistema cria sozinho um
  Gist privado com os dados **criptografados** (AES-GCM 256) e gera o
  **código da conta** (texto e QR code). Nos outros aparelhos: "Entrar com
  código" (ou ler o QR code com a câmera). O código funciona como uma
  senha: quem tem o código vê e altera os dados.
  - Alterações feitas em dois aparelhos são juntadas registro a registro.
  - "Aparelhos conectados": renomear, remover (com opção de apagar os dados
    do aparelho removido) e desconectar. "Trocar código" cria um Gist e uma
    chave novos e apaga o antigo — use se um aparelho for perdido.
  - A chave nova do GitHub (antes de vencer) vai sozinha para os outros
    aparelhos. O token fica só no aparelho, fora do backup.
  - Quem usava a sincronização antiga (sem código): o primeiro aparelho
    atualizado transforma o cofre na conta criptografada; nos outros, é
    preciso entrar com o código.
- **A senha impede o acesso casual, não criptografa os dados.** Quem abrir
  as ferramentas do navegador ainda consegue ver o que está guardado.
  Nunca digite senhas de banco ou de cartão no sistema; ele nunca pede isso.

## Estrutura do projeto

```
financas/
├── index.html              # estrutura da página (sidebar, topbar, modal)
├── sw.js                   # service worker (abre sem internet no iPad)
├── css/
│   └── style.css           # tema visual (escuro, estilo terminal financeiro)
├── js/
│   ├── bloqueio.js         # senha numérica e Face ID / Touch ID
│   ├── armazenamento.js    # salvar/carregar/exportar/importar dados
│   ├── financeiro.js       # cálculos de bancos, entradas, despesas, cartões
│   ├── investimentos.js    # cálculos de investimentos, ações e patrimônio
│   ├── graficos.js         # todos os gráficos
│   ├── extrato.js          # leitura do extrato de investimentos em PDF
│   ├── relatorio.js        # leitura do relatório em PDF
│   ├── cotacoes.js         # cotações, indicadores e notícias (internet)
│   ├── sincronizacao.js    # conta de sincronização (Gist criptografado, código e QR code)
│   ├── avatar.js           # perfil e tela "Editar avatar"
│   ├── emojis.js           # emojis das categorias
│   ├── app.js              # interface: navegação, telas, modais, eventos
│   └── vendor/             # bibliotecas de terceiros incluídas offline
│       ├── chart.umd.min.js
│       ├── qrcode.js       # gera o QR code do código da conta
│       ├── jsQR.js         # lê o QR code pela câmera
│       ├── pdf.min.js
│       └── pdf.worker.min.js
├── assets/icons/           # ícones do app e dos bancos
└── assets/dados/personagens.json  # galeria de personagens do avatar (mesma do Meu Controle)

desktop/                    # programa para Windows (Electron) — veja INSTALAR-NO-COMPUTADOR.md
```

Cada arquivo JavaScript tem uma responsabilidade única: `armazenamento.js`
não sabe nada sobre a tela, `financeiro.js` e `investimentos.js` só fazem
contas a partir dos dados, `graficos.js` só desenha gráficos, e `app.js` é
o único arquivo que toca no HTML.

## Próximos passos possíveis

Integração com Open Finance, importação automática de extratos bancários e
análises mais inteligentes são o caminho natural de evolução do projeto.
