/**
 * construir.js — gera o instalador do Windows em desktop/dist/
 *   npm run dist
 * A versão do instalador é a mesma do sistema (VERSAO_APP no js/app.js).
 */
const { versao } = require("./copiar-web");
const builder = require("electron-builder");
const pkg = require("./package.json");

builder.build({
  targets: builder.Platform.WINDOWS.createTarget(),
  publish: "never",   // sem atualização automática: cada versão nova é um instalador novo
  config: Object.assign({}, pkg.build, { extraMetadata: { version: versao } })
}).then((arquivos) => {
  console.log("Instalador pronto:\n  " + arquivos.filter((a) => a.endsWith(".exe")).join("\n  "));
}).catch((e) => { console.error(e); process.exit(1); });
