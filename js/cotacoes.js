/**
 * cotacoes.js
 * -----------------------------------------------------------------------
 * Integração com APIs públicas de cotação. Mantido separado para o resto
 * do sistema continuar funcionando 100% offline: se não houver internet
 * ou a API falhar, as funções rejeitam a Promise e a interface mantém o
 * último preço conhecido (com a indicação "atualizado manualmente").
 *
 *   buscarDolar()                 -> { valor, variacaoPct, atualizadoEm }
 *   buscarCotacoes(tickers, token) -> { cotacoes: { PETR4: { preco, variacaoPct, nome } }, erros: { XPTO3: 'motivo' } }
 *
 * Dólar: AwesomeAPI (economia.awesomeapi.com.br) — gratuita, sem chave.
 * Ações: brapi.dev — gratuita; alguns limites exigem token (criado de
 * graça em brapi.dev). O token fica salvo só no localStorage do usuário.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var URL_DOLAR = "https://economia.awesomeapi.com.br/last/USD-BRL";
  var URL_DOLAR_SERIE = "https://economia.awesomeapi.com.br/json/daily/USD-BRL/";
  var URL_BRAPI = "https://brapi.dev/api/quote/";

  function comTimeout(promessa, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error("Tempo esgotado")); }, ms);
      promessa.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  function buscarDolar() {
    return comTimeout(fetch(URL_DOLAR, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var d = j && j.USDBRL;
      if (!d) throw new Error("Resposta inesperada");
      return { valor: Number(d.bid), variacaoPct: Number(d.pctChange), atualizadoEm: d.create_date || new Date().toISOString() };
    }), 8000);
  }

  // Série histórica do dólar (fechamento diário), usada no gráfico da
  // tela de detalhe. A mesma API, sem chave; devolve do mais recente
  // para o mais antigo, então invertemos a ordem.
  function buscarSerieDolar(dias) {
    return comTimeout(fetch(URL_DOLAR_SERIE + (dias || 90), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (lista) {
      if (!Array.isArray(lista)) throw new Error("Resposta inesperada");
      return lista.map(function (d) {
        return { data: new Date(Number(d.timestamp) * 1000).toISOString().slice(0, 10), preco: Number(d.bid) };
      }).filter(function (p) { return p.preco > 0; }).reverse();
    }), 10000);
  }

  // O plano gratuito da brapi aceita só 1 ativo por chamada, então
  // consultamos um ticker de cada vez (em sequência, para não estourar
  // o limite de requisições). Um ticker que falhar não derruba os outros.
  function buscarUm(ticker, token) {
    var url = URL_BRAPI + encodeURIComponent(ticker) + (token ? "?token=" + encodeURIComponent(token) : "");
    var opts = { cache: "no-store", headers: token ? { Authorization: "Bearer " + token } : {} };
    return comTimeout(fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var msg = (j && (j.message || j.error)) ? String(j.message || j.error) : "HTTP " + r.status;
          if (r.status === 401 || r.status === 402) msg = "token inválido ou ausente (crie um grátis em brapi.dev)";
          if (r.status === 404) msg = "ticker não encontrado";
          throw new Error(msg);
        }
        var q = j && j.results && j.results[0];
        if (!q || q.regularMarketPrice == null) throw new Error("sem preço na resposta");
        return { preco: Number(q.regularMarketPrice), variacaoPct: Number(q.regularMarketChangePercent || 0), nome: q.longName || q.shortName || "" };
      });
    }), 12000);
  }

  function buscarCotacoes(tickers, token) {
    var mapa = {}, erros = {};
    var fila = (tickers || []).map(function (t) { return String(t).toUpperCase().trim(); }).filter(Boolean);
    function proximo() {
      if (!fila.length) return Promise.resolve({ cotacoes: mapa, erros: erros });
      var t = fila.shift();
      return buscarUm(t, token).then(function (q) { mapa[t] = q; }, function (e) { erros[t] = e.message; }).then(proximo);
    }
    return proximo();
  }

  global.Cotacoes = { buscarDolar: buscarDolar, buscarSerieDolar: buscarSerieDolar, buscarCotacoes: buscarCotacoes };
})(window);
