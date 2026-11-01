# Muller Mendes Finanças no computador (Windows)

## Instalar
1. Baixe o arquivo `Muller-Mendes-Financas-Instalador-<versão>.exe`.
2. Dê dois cliques nele.
3. O Windows pode mostrar **"O Windows protegeu o computador"** (o instalador
   não tem assinatura digital paga). Clique em **Mais informações** →
   **Executar assim mesmo**.
4. Siga o instalador (pode escolher a pasta). No fim, o atalho
   **Muller Mendes Finanças** fica na Área de Trabalho e no menu Iniciar.

## Onde ficam os dados
Num arquivo no próprio computador:

    %APPDATA%\Muller Mendes Finanças\dados.json

A cada gravação, a versão anterior fica guardada em `dados.bak.json` (se o
arquivo principal estragar, o programa usa a cópia sozinho). Em
**Configurações → Backup Dados → Abrir pasta** você abre essa pasta.

Desinstalar o programa **não apaga** os dados.

## Levar os dados do navegador para o programa
O programa começa com os dados de demonstração. Para trazer os seus:

- **Pela sincronização (recomendado):** em Configurações → Sincronização,
  cole o mesmo token do GitHub usado no iPad e escolha ficar com os dados
  do cofre. Daí em diante, computador e iPad ficam iguais.
- **Pelo backup:** no navegador, Configurações → **Exportar Backup**; no
  programa, Configurações → **Importar Backup** e escolha o arquivo.

## Atualizar
O programa não se atualiza sozinho: cada versão nova é um instalador novo.
Instale por cima — os dados continuam.

## Gerar o instalador (para quem mexe no código)
Os arquivos do programa ficam em `desktop/`. Ele leva uma cópia dos arquivos
do site (index.html, css, js, assets), então o instalador sai sempre com a
versão atual do sistema.

    cd desktop
    npm install
    npm start        # abre o programa para testar
    npm run dist     # gera desktop/dist/Muller-Mendes-Financas-Instalador-<versão>.exe

No Windows funciona direto. No Linux, o passo do instalador precisa do Wine
(com suporte a 32 bits: `wine` e `wine32`).
