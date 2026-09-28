# Muller Mendes Finanças no iPad (e iPhone)

No iOS não existe instalador como no Windows. O Safari instala o sistema como um
aplicativo (PWA): fica na Tela de Início com ícone próprio, abre em tela cheia,
funciona sem internet e guarda os dados no próprio iPad.

## 1) Publicar os arquivos (uma vez só, gratuito)
O iPad precisa abrir o sistema por um endereço https. Duas opções fáceis:

**Opção A — Netlify Drop (mais simples, sem cadastro obrigatório)**
1. No computador, acesse https://app.netlify.com/drop
2. Arraste a pasta `muller-mendes-ipad` (descompactada) para a página.
3. Copie o endereço gerado (ex.: https://nome-aleatorio.netlify.app).

**Opção B — GitHub Pages**
1. Crie um repositório no GitHub e envie os arquivos desta pasta.
2. Em Settings → Pages, escolha a branch principal → Save.
3. O endereço fica https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/

## 2) Instalar no iPad
1. Abra o endereço no **Safari** (tem que ser o Safari).
2. Toque no botão **Compartilhar** (quadrado com seta para cima).
3. Toque em **Adicionar à Tela de Início** e confirme.
4. Pronto: o ícone "Finanças" aparece na tela inicial. Abra por ele — não pelo Safari.

## Onde ficam os dados
No próprio iPad (armazenamento do app instalado). Eles NÃO são compartilhados com o
computador automaticamente. Para levar dados de um para o outro, use
Configurações → Exportar backup em um e Importar backup no outro (o arquivo .json
pode ir por AirDrop, e-mail ou iCloud Drive).

Dica: faça backups periódicos — se o app for removido da Tela de Início, os dados
locais vão junto.

## Cotações
Dólar e ações são atualizados pela internet quando o iPad estiver conectado;
offline o app segue funcionando com os últimos preços.

## Se aparecer a letra "F" em vez do ícone
Isso acontece quando o iPad guardou uma versão antiga da página. Faça assim:
1. Segure o ícone na Tela de Início → **Remover app**.
2. No iPad: Ajustes → Safari → **Limpar histórico e dados dos sites**.
3. Abra o endereço no Safari de novo e repita **Compartilhar → Adicionar à Tela de Início**.
Se você atualizou os arquivos no servidor, aguarde alguns segundos após abrir a página
antes de adicionar — o app precisa baixar o ícone novo primeiro.

## O ícone continua aparecendo como letra — o que fazer
O iPad guarda o ícone ligado ao endereço, e não troca nem limpando o Safari.
Force um endereço novo:
1. Abra `verificar.html` no Safari e toque em **Limpar cache do app neste iPad**.
2. Remova o app da Tela de Início (segurar o ícone → Remover app).
3. Abra o endereço que a página mostra (com `?v=...` no final), **espere carregar por completo**.
4. Compartilhar → **Adicionar à Tela de Início**. Confira se a miniatura do ícone já
   aparece na própria tela de confirmação — se aparecer, vai instalar certo.

Se ainda assim vier a letra, tente adicionar usando uma **aba anônima** do Safari, ou
reinicie o iPad antes do passo 3 (o iOS mantém os ícones em memória até reiniciar).
