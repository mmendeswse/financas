/**
 * drive.js
 * -----------------------------------------------------------------------
 * Salva o backup direto no Google Drive da pessoa, numa pasta
 * "Muller Mendes Finanças". Usa o login do Google com um ID de cliente
 * próprio (projeto onde a Drive API está ativada), com a permissão
 * "drive.file": o sistema só enxerga
 * os arquivos e pastas que ele mesmo criou — não tem acesso ao resto do Drive.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  // ID de cliente próprio do Drive: projeto "Google Agendas" (nº 951379835330),
  // onde a Google Drive API está ativada. O Google Agenda segue com o dele.
  const CLIENT_ID_PADRAO = "951379835330-gng7lqjlqbp75v119e9e7o582h3k2b3h.apps.googleusercontent.com";
  const idCliente = () => global.MM_DRIVE_CLIENT_ID || CLIENT_ID_PADRAO;
  const ESCOPO = "https://www.googleapis.com/auth/drive.file";
  const CHAVE = "mullerMendes:drive";
  const NOME_PASTA = "Muller Mendes Finanças";

  const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } };
  const gravarLocal = (s) => { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) { /* ignora */ } };
  // o login do Google não funciona no programa do Windows (abre de um arquivo)
  const disponivel = () => !!idCliente() && /^https?:$/.test(location.protocol) && !(global.bancoDados && global.bancoDados.ehDesktop);
  const tokenValido = () => { const s = lerLocal(); return s.token && s.exp && s.exp > Date.now() + 60000 ? s.token : null; };

  let gisP = null, cliente = null, pedido = null;
  function carregarGIS() {
    if (gisP) return gisP;
    gisP = new Promise((ok, erro) => {
      if (global.google && global.google.accounts && global.google.accounts.oauth2) { ok(); return; }
      const t = document.createElement("script");
      t.src = "https://accounts.google.com/gsi/client"; t.async = true;
      t.onload = () => ok(); t.onerror = () => { gisP = null; erro(new Error("Não consegui carregar o login do Google. Verifique a internet.")); };
      document.head.appendChild(t);
    });
    return gisP;
  }
  const gisPronto = () => !!(global.google && global.google.accounts && global.google.accounts.oauth2);
  // deixa o login do Google carregado: o pedido precisa sair dentro do toque
  function preparar() { if (disponivel()) carregarGIS().catch(() => {}); }
  function pedirToken() {
    const t = tokenValido();
    if (t) return Promise.resolve(t);
    return gisPronto() ? pedirAgora() : carregarGIS().then(pedirAgora);
  }
  function pedirAgora() {
    return new Promise((ok, erro) => {
      if (!cliente) {
        cliente = global.google.accounts.oauth2.initTokenClient({
          client_id: idCliente(), scope: ESCOPO,
          callback: (r) => {
            const p = pedido; pedido = null; if (!p) return;
            if (r && r.access_token) {
              gravarLocal(Object.assign(lerLocal(), { token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000, autorizado: true }));
              p.ok(r.access_token);
            } else p.erro(new Error(r && r.error === "access_denied" ? "Você não autorizou o acesso ao Google Drive." : "O Google não liberou o acesso ao Drive."));
          },
          error_callback: (e) => { const p = pedido; pedido = null; if (p) p.erro(new Error(e && e.type === "popup_closed" ? "A janela do Google foi fechada antes de terminar." : e && e.type === "popup_failed_to_open" ? "O navegador bloqueou a janela do Google. Permita pop-ups para este site." : "Não deu certo entrar no Google.")); }
        });
      }
      pedido = { ok, erro };
      cliente.requestAccessToken({ prompt: lerLocal().autorizado ? "" : "consent" });
    });
  }

  function api(token, url, opcoes) {
    return fetch(url, Object.assign({}, opcoes, { headers: Object.assign({ Authorization: "Bearer " + token }, (opcoes && opcoes.headers) || {}) }))
      .catch(() => { throw new Error(navigator.onLine ? "Não consegui falar com o Google Drive." : "Sem internet agora."); })
      .then((r) => r.json().catch(() => null).then((j) => {
        if (r.ok) return j;
        if (r.status === 401) { gravarLocal(Object.assign(lerLocal(), { token: null, exp: 0 })); }
        const motivo = j && j.error && j.error.message ? j.error.message : "";
        const e = new Error(r.status === 401 ? "O acesso ao Google Drive expirou. Tente de novo." :
          r.status === 403 && /has not been used|is disabled/i.test(motivo) ? "A API do Google Drive não está ativada no projeto do Google Cloud deste sistema" + (/project (\d+)/.exec(motivo) ? " (projeto nº " + /project (\d+)/.exec(motivo)[1] + ")" : "") + ". Se acabou de ativar, espere alguns minutos e tente de novo." :
          r.status === 403 ? "O Google Drive recusou (permissão ou limite de uso)." : "O Google Drive respondeu com erro " + r.status + ".");
        e.status = r.status;
        const proj = /project (\d+)/.exec(motivo);
        if (proj && /has not been used|is disabled/i.test(motivo)) e.linkAtivar = "https://console.cloud.google.com/apis/library/drive.googleapis.com?project=" + proj[1];
        throw e;
      }));
  }
  // pasta do sistema no Drive (criada na primeira vez)
  function pasta(token) {
    const s = lerLocal();
    const criar = () => api(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: NOME_PASTA, mimeType: "application/vnd.google-apps.folder" })
    }).then((j) => { gravarLocal(Object.assign(lerLocal(), { pastaId: j.id })); return j.id; });
    const procurar = () => {
      const q = encodeURIComponent(`name='${NOME_PASTA.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      return api(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`)
        .then((j) => j && j.files && j.files.length ? (gravarLocal(Object.assign(lerLocal(), { pastaId: j.files[0].id })), j.files[0].id) : criar());
    };
    if (!s.pastaId) return procurar();
    // a pasta guardada ainda existe (e não está na lixeira)?
    return api(token, `https://www.googleapis.com/drive/v3/files/${s.pastaId}?fields=id,trashed`)
      .then((j) => j && !j.trashed ? j.id : procurar())
      .catch((e) => { if (e.status === 404) return procurar(); throw e; });
  }
  // envia o arquivo; devolve { nome, link }
  function salvarArquivo(nome, texto) {
    return pedirToken().then((token) => pasta(token).then((idPasta) => {
      const limite = "mm" + Math.random().toString(36).slice(2);
      const meta = { name: nome, mimeType: "application/json", parents: [idPasta] };
      const corpo = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${limite}\r\nContent-Type: application/json\r\n\r\n${texto}\r\n--${limite}--`;
      return api(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
        method: "POST", headers: { "Content-Type": `multipart/related; boundary=${limite}` }, body: corpo
      }).then((j) => ({ nome: j.name, link: j.webViewLink, pasta: NOME_PASTA }));
    }));
  }

  // backups na pasta do sistema (os mais novos primeiro)
  function listarBackups() {
    return pedirToken().then((token) => pasta(token).then((idPasta) => {
      const q = encodeURIComponent(`'${idPasta}' in parents and trashed=false`);
      return api(token, `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,createdTime,size)&spaces=drive`)
        .then((j) => (j && j.files) || []);
    }));
  }
  // conteúdo de um backup (texto JSON)
  function baixarBackup(id) {
    return pedirToken().then((token) => api(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`))
      .then((obj) => JSON.stringify(obj));
  }

  global.Drive = { disponivel, preparar, salvarArquivo, listarBackups, baixarBackup, NOME_PASTA };
})(window);
