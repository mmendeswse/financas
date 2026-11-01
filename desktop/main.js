/**
 * main.js — programa para Windows (Electron)
 * -----------------------------------------------------------------------
 * Abre o mesmo sistema do site numa janela própria. Os dados ficam num
 * arquivo no computador (dados.json), com uma cópia da versão anterior
 * (dados.bak.json), na pasta do usuário:
 *   %APPDATA%\Muller Mendes Finanças\
 *
 * O armazenamento.js já sabe usar esse arquivo: quando existe
 * window.bancoDados (criado pelo preload.js), ele lê e grava por aqui em
 * vez do localStorage do navegador.
 * -----------------------------------------------------------------------
 */
const { app, BrowserWindow, ipcMain, protocol, net, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

// endereço interno "app://financas/" — funciona como um site https (cotações,
// sincronização e o armazenamento do navegador se comportam igual ao site)
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

const WEB = path.join(__dirname, "web");
const pasta = () => app.getPath("userData");
const arquivo = () => path.join(pasta(), "dados.json");
const copia = () => path.join(pasta(), "dados.bak.json");

let janela = null;

// ---------------------------------------------------------------------
// banco de dados em arquivo
// ---------------------------------------------------------------------
function lerValido(caminho) {
  try {
    if (!fs.existsSync(caminho)) return null;
    const texto = fs.readFileSync(caminho, "utf8");
    JSON.parse(texto);              // só devolve se estiver íntegro
    return texto;
  } catch (e) { return null; }
}

ipcMain.on("bd:ler", (e) => {
  // arquivo principal estragado (queda de energia no meio da gravação, por
  // ex.): usa a cópia anterior em vez de recomeçar com os dados de exemplo
  e.returnValue = lerValido(arquivo()) || lerValido(copia());
});

ipcMain.on("bd:gravar", (e, texto) => {
  try {
    fs.mkdirSync(pasta(), { recursive: true });
    const tmp = arquivo() + ".tmp";
    fs.writeFileSync(tmp, String(texto), "utf8");
    if (lerValido(arquivo())) fs.copyFileSync(arquivo(), copia());   // guarda a versão anterior
    fs.renameSync(tmp, arquivo());   // troca de uma vez: nunca fica meio gravado
    e.returnValue = true;
  } catch (err) {
    console.error("Falha ao gravar:", err);
    e.returnValue = false;
  }
});

ipcMain.handle("bd:caminho", () => arquivo());
ipcMain.on("bd:abrirPasta", () => { shell.openPath(pasta()); });

// backup: pergunta onde salvar (padrão: Documentos)
ipcMain.handle("bd:salvarArquivo", async (e, nome, texto) => {
  const r = await dialog.showSaveDialog(janela, {
    title: "Salvar backup",
    defaultPath: path.join(app.getPath("documents"), path.basename(String(nome))),
    filters: [{ name: "Backup (JSON)", extensions: ["json"] }]
  });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, String(texto), "utf8");
  return true;
});

// ---------------------------------------------------------------------
// janela
// ---------------------------------------------------------------------
function ehLinkExterno(url) { return /^https?:\/\//i.test(url); }

function criarJanela() {
  janela = new BrowserWindow({
    width: 1366, height: 860, minWidth: 900, minHeight: 600,
    backgroundColor: "#070D14",
    title: "Muller Mendes",
    icon: path.join(WEB, "assets", "icons", "icon-512.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  janela.once("ready-to-show", () => { janela.maximize(); janela.show(); });

  // notícias e links externos abrem no navegador padrão, nunca dentro do programa
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (ehLinkExterno(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  janela.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith("app://")) return;
    e.preventDefault();
    if (ehLinkExterno(url)) shell.openExternal(url);
  });

  janela.loadURL("app://financas/index.html");
  janela.on("closed", () => { janela = null; });
}

// uma janela só: abrir o atalho de novo traz a que já está aberta
// (dois programas gravando o mesmo arquivo poderiam perder alterações)
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!janela) return;
    if (janela.isMinimized()) janela.restore();
    janela.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    // entrega os arquivos do sistema (pasta web) no endereço app://financas/
    protocol.handle("app", (req) => {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p === "/" || p === "") p = "/index.html";
      const completo = path.normalize(path.join(WEB, p));
      if (!completo.startsWith(WEB + path.sep)) return new Response("", { status: 403 });
      return net.fetch(pathToFileURL(completo).toString());
    });
    criarJanela();
    app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) criarJanela(); });
  });

  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
