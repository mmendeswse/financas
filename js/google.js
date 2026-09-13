/**
 * google.js
 * -----------------------------------------------------------------------
 * Backup dos dados na conta Google do usuário, usando o Google Drive.
 *
 * O arquivo é gravado na "pasta do aplicativo" do Drive (appDataFolder):
 * uma área reservada e invisível no Drive comum, que só este sistema
 * enxerga. Por isso pedimos apenas a permissão drive.appdata — nenhum
 * outro arquivo da conta pode ser lido ou alterado.
 *
 * Exige um ID de cliente OAuth criado gratuitamente pelo próprio usuário
 * no Google Cloud (o Google não permite usar um ID embutido em código
 * publicado). O ID fica salvo só no aparelho.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var ESCOPO = "https://www.googleapis.com/auth/drive.appdata";
  var ARQUIVO = "muller-mendes-backup.json";
  var GIS = "https://accounts.google.com/gsi/client";
  var token = null, expiraEm = 0, clienteToken = null;

  function carregarBiblioteca() {
    if (global.google && global.google.accounts && global.google.accounts.oauth2) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existente = document.querySelector('script[src="' + GIS + '"]');
      if (existente) { existente.addEventListener("load", function () { resolve(); }); existente.addEventListener("error", function () { reject(new Error("não consegui carregar o Google")); }); return; }
      var s = document.createElement("script");
      s.src = GIS; s.async = true; s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("não consegui carregar o Google (sem internet?)")); };
      document.head.appendChild(s);
    });
  }

  function temTokenValido() { return token && Date.now() < expiraEm - 60000; }

  // pedirSilencioso = true tenta renovar sem mostrar janela (quando o
  // usuário já autorizou antes)
  function autorizar(clientId, pedirSilencioso) {
    if (temTokenValido()) return Promise.resolve(token);
    return carregarBiblioteca().then(function () {
      return new Promise(function (resolve, reject) {
        try {
          clienteToken = global.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: ESCOPO,
            prompt: pedirSilencioso ? "" : "consent",
            callback: function (resp) {
              if (resp && resp.access_token) {
                token = resp.access_token;
                expiraEm = Date.now() + (Number(resp.expires_in || 3600) * 1000);
                resolve(token);
              } else {
                reject(new Error(resp && resp.error_description ? resp.error_description : "autorização não concluída"));
              }
            },
            error_callback: function (err) {
              reject(new Error(err && err.type === "popup_closed" ? "janela do Google fechada antes de concluir" : "não foi possível autorizar"));
            }
          });
          clienteToken.requestAccessToken();
        } catch (e) { reject(new Error("ID de cliente inválido ou origem não autorizada no Google Cloud")); }
      });
    });
  }

  function desconectar() {
    if (token && global.google && global.google.accounts && global.google.accounts.oauth2) {
      try { global.google.accounts.oauth2.revoke(token); } catch (e) {}
    }
    token = null; expiraEm = 0;
  }

  function cabec(extra) {
    return Object.assign({ "Authorization": "Bearer " + token }, extra || {});
  }

  function erro(r) {
    if (r.status === 401 || r.status === 403) return new Error("acesso negado pelo Google (autorize novamente)");
    return new Error("erro do Google Drive (HTTP " + r.status + ")");
  }

  // procura o arquivo de backup já existente na pasta do aplicativo
  function procurarArquivo() {
    var url = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=" + encodeURIComponent("name='" + ARQUIVO + "'");
    return fetch(url, { headers: cabec(), cache: "no-store" }).then(function (r) {
      if (!r.ok) throw erro(r);
      return r.json();
    }).then(function (j) { return (j.files && j.files[0]) || null; });
  }

  function enviar(conteudo) {
    return procurarArquivo().then(function (arq) {
      var limite = "-------muller" + Date.now();
      var meta = arq ? { name: ARQUIVO } : { name: ARQUIVO, parents: ["appDataFolder"] };
      var corpo =
        "--" + limite + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n" +
        "--" + limite + "\r\nContent-Type: application/json\r\n\r\n" + conteudo + "\r\n" +
        "--" + limite + "--";
      var url = "https://www.googleapis.com/upload/drive/v3/files" + (arq ? "/" + arq.id : "") + "?uploadType=multipart&fields=id,modifiedTime";
      return fetch(url, {
        method: arq ? "PATCH" : "POST",
        headers: cabec({ "Content-Type": "multipart/related; boundary=" + limite }),
        body: corpo
      }).then(function (r) { if (!r.ok) throw erro(r); return r.json(); });
    });
  }

  function baixar() {
    return procurarArquivo().then(function (arq) {
      if (!arq) throw new Error("nenhum backup encontrado nesta conta Google");
      return fetch("https://www.googleapis.com/drive/v3/files/" + arq.id + "?alt=media", { headers: cabec(), cache: "no-store" })
        .then(function (r) { if (!r.ok) throw erro(r); return r.text(); })
        .then(function (t) {
          var obj;
          try { obj = JSON.parse(t); } catch (e) { throw new Error("o backup do Google está corrompido"); }
          return { dados: obj, modificadoEm: arq.modifiedTime };
        });
    });
  }

  global.GoogleBackup = {
    autorizar: autorizar,
    desconectar: desconectar,
    conectado: temTokenValido,
    enviar: enviar,
    baixar: baixar,
    procurarArquivo: procurarArquivo
  };
})(window);
