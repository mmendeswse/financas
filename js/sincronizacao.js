/**
 * sincronizacao.js
 * -----------------------------------------------------------------------
 * Sincroniza o banco de dados entre aparelhos (computador, iPad, site)
 * usando um Gist PRIVADO do GitHub como cofre. Não há servidor para
 * manter: os dados ficam na conta do próprio usuário.
 *
 * Como funciona:
 *   - cada gravação local carimba a hora em dados.atualizadoEm;
 *   - ao abrir, o sistema compara a hora local com a do cofre e fica com
 *     a versão mais recente (last-write-wins);
 *   - depois de qualquer alteração, envia para o cofre (com atraso de
 *     alguns segundos, para não mandar a cada tecla);
 *   - a cada 2 minutos confere se outro aparelho enviou algo novo.
 *
 * O token fica salvo apenas no aparelho (nunca vai para o código do site).
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var API = "https://api.github.com";
  var ARQUIVO = "muller-mendes-dados.json";
  var DESCRICAO = "Muller Mendes Finanças — banco de dados (não apague)";

  function cabecalhos(token) {
    return { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "Content-Type": "application/json" };
  }

  function erroDeResposta(r) {
    if (r.status === 401) return new Error("token inválido ou sem permissão de gist");
    if (r.status === 403) return new Error("limite de uso do GitHub atingido; tente daqui a pouco");
    if (r.status === 404) return new Error("cofre não encontrado (verifique o código do cofre)");
    return new Error("erro de comunicação (HTTP " + r.status + ")");
  }

  // procura um cofre já criado por este usuário; devolve o id ou null
  function procurarCofre(token) {
    return fetch(API + "/gists?per_page=100", { headers: cabecalhos(token), cache: "no-store" }).then(function (r) {
      if (!r.ok) throw erroDeResposta(r);
      return r.json();
    }).then(function (lista) {
      var achado = (lista || []).filter(function (g) { return g.files && g.files[ARQUIVO]; })[0];
      return achado ? achado.id : null;
    });
  }

  function criarCofre(token, conteudo) {
    var corpo = { description: DESCRICAO, public: false, files: {} };
    corpo.files[ARQUIVO] = { content: conteudo };
    return fetch(API + "/gists", { method: "POST", headers: cabecalhos(token), body: JSON.stringify(corpo) }).then(function (r) {
      if (!r.ok) throw erroDeResposta(r);
      return r.json();
    }).then(function (g) { return g.id; });
  }

  function enviar(token, gistId, conteudo) {
    var corpo = { files: {} };
    corpo.files[ARQUIVO] = { content: conteudo };
    return fetch(API + "/gists/" + gistId, { method: "PATCH", headers: cabecalhos(token), body: JSON.stringify(corpo) }).then(function (r) {
      if (!r.ok) throw erroDeResposta(r);
      return true;
    });
  }

  function baixar(token, gistId) {
    return fetch(API + "/gists/" + gistId, { headers: cabecalhos(token), cache: "no-store" }).then(function (r) {
      if (!r.ok) throw erroDeResposta(r);
      return r.json();
    }).then(function (g) {
      var f = g.files && g.files[ARQUIVO];
      if (!f) throw new Error("o cofre não tem o arquivo de dados");
      if (f.truncated && f.raw_url) return fetch(f.raw_url, { cache: "no-store" }).then(function (r) { return r.text(); });
      return f.content;
    }).then(function (texto) {
      try { return JSON.parse(texto); } catch (e) { throw new Error("os dados do cofre estão corrompidos"); }
    });
  }

  function verificarToken(token) {
    return fetch(API + "/user", { headers: cabecalhos(token), cache: "no-store" }).then(function (r) {
      if (!r.ok) throw erroDeResposta(r);
      return r.json();
    }).then(function (u) { return u.login; });
  }

  global.Sincronizacao = {
    verificarToken: verificarToken,
    procurarCofre: procurarCofre,
    criarCofre: criarCofre,
    enviar: enviar,
    baixar: baixar
  };
})(window);
