/**
 * copiar-web.js — copia os arquivos do sistema (a mesma versão do site)
 * para desktop/web, que vai dentro do programa instalado.
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const DESTINO = path.join(__dirname, "web");

const ITENS = ["index.html", "manifest.json", "manifest.webmanifest", "css", "js", "assets"];

fs.rmSync(DESTINO, { recursive: true, force: true });
fs.mkdirSync(DESTINO, { recursive: true });
ITENS.forEach((item) => fs.cpSync(path.join(RAIZ, item), path.join(DESTINO, item), { recursive: true }));
// ícones da raiz que o index.html referencia
fs.readdirSync(RAIZ).filter((f) => /^apple-touch-icon.*\.png$/.test(f))
  .forEach((f) => fs.copyFileSync(path.join(RAIZ, f), path.join(DESTINO, f)));

// versão do programa = versão do sistema (VERSAO_APP no app.js)
const appJs = fs.readFileSync(path.join(RAIZ, "js", "app.js"), "utf8");
const versao = (/const VERSAO_APP = "([0-9.]+)"/.exec(appJs) || [])[1];
if (!versao) throw new Error("Não achei VERSAO_APP no js/app.js");
console.log("Arquivos do sistema copiados para desktop/web (versão " + versao + ").");
module.exports = { versao };
