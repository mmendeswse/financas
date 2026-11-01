/**
 * preload.js — ponte entre a página e o arquivo de dados no computador.
 * Cria window.bancoDados, que o armazenamento.js usa no lugar do
 * localStorage quando o sistema roda como programa instalado.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bancoDados", {
  ehDesktop: true,
  ler: () => ipcRenderer.sendSync("bd:ler"),
  gravar: (texto) => ipcRenderer.sendSync("bd:gravar", String(texto)),
  caminho: () => ipcRenderer.invoke("bd:caminho"),
  abrirPasta: () => ipcRenderer.send("bd:abrirPasta"),
  salvarArquivo: (nome, texto) => ipcRenderer.invoke("bd:salvarArquivo", String(nome), String(texto))
});
