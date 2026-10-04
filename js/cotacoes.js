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
      // além do fechamento, guarda abertura, máxima e mínima de cada dia
      // (para o gráfico de velas). A API não traz a abertura: usamos o
      // fechamento do dia anterior (bid − varBid), limitado à faixa do dia.
      return lista.map(function (d) {
        var fch = Number(d.bid), max = Number(d.high), min = Number(d.low);
        var abr = fch - Number(d.varBid || 0);
        if (!(abr > 0)) abr = fch;
        if (!(max > 0)) max = Math.max(abr, fch);
        if (!(min > 0)) min = Math.min(abr, fch);
        abr = Math.min(Math.max(abr, min), max);
        return { data: new Date(Number(d.timestamp) * 1000).toISOString().slice(0, 10), preco: fch,
                 abertura: abr, maxima: Math.max(max, fch, abr), minima: Math.min(min, fch, abr) };
      }).filter(function (p) { return p.preco > 0; }).reverse();
    }), 10000);
  }

  // O plano gratuito da brapi aceita só 1 ativo por chamada, então
  // consultamos um ticker de cada vez (em sequência, para não estourar
  // o limite de requisições). Um ticker que falhar não derruba os outros.
  // Pede também o histórico diário dos últimos 3 meses (range=3mo), para o
  // gráfico da ação mostrar a evolução do preço mesmo de um papel recém-cadastrado.
  // Se o plano da brapi não aceitar o histórico, repete a busca sem ele.
  function buscarUm(ticker, token) {
    return buscarUmComHistorico(ticker, token, true).catch(function (e) {
      if (/não encontrado/.test(e.message)) throw e;
      return buscarUmComHistorico(ticker, token, false);
    });
  }
  function buscarUmComHistorico(ticker, token, comHistorico) {
    var params = [];
    if (comHistorico) params.push("range=3mo", "interval=1d");
    if (token) params.push("token=" + encodeURIComponent(token));
    var url = URL_BRAPI + encodeURIComponent(ticker) + (params.length ? "?" + params.join("&") : "");
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
        var historico = (q.historicalDataPrice || []).map(function (h) {
          var dt = new Date(Number(h.date) * 1000);
          var iso = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
          // abertura, máxima e mínima do dia alimentam o gráfico de velas
          return { data: iso, preco: Number(h.close), abertura: Number(h.open) || 0, maxima: Number(h.high) || 0, minima: Number(h.low) || 0 };
        }).filter(function (h) { return h.preco > 0; });
        return { preco: Number(q.regularMarketPrice), variacaoPct: Number(q.regularMarketChangePercent || 0), nome: q.longName || q.shortName || "", historico: historico };
      });
    }), 12000);
  }


  // Séries oficiais do Banco Central (SGS): 12 = CDI diário (% a.d.),
  // 11 = Selic diária (% a.d.), 433 = IPCA mensal (% a.m.).
  function dataBR(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  // O Banco Central nem sempre responde direto ao navegador (bloqueio de
  // CORS ou demora fora do Brasil): se a chamada direta falhar, tenta pelos
  // mesmos repassadores com CORS usados nas notícias (codetabs, allorigins).
  function buscarSerieBCB(codigo, inicioISO, fimISO) {
    var url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs." + codigo + "/dados?formato=json&dataInicial=" +
      dataBR(inicioISO) + "&dataFinal=" + dataBR(fimISO);
    var ler = function (endereco, tempo) {
      return comTimeout(fetch(endereco, { headers: { Accept: "application/json" } }).then(function (r) {
        if (r.status === 404) return "[]";              // período sem dados (ex.: fim de semana)
        if (!r.ok) throw new Error("Banco Central respondeu " + r.status);
        return r.text();
      }).then(function (txt) {
        var lista;
        try { lista = JSON.parse(txt); } catch (e) { throw new Error("resposta inválida do Banco Central"); }
        // o BCB responde {"erro": …} quando não há dados no período
        if (!Array.isArray(lista)) { if (lista && (lista.erro || lista.error)) return []; throw new Error("resposta inesperada do Banco Central"); }
        return lista.map(function (x) {
          var p = String(x.data).split("/");
          return { data: p[2] + "-" + p[1] + "-" + p[0], valor: Number(String(x.valor).replace(",", ".")) };
        }).filter(function (x) { return isFinite(x.valor); });
      }), tempo);
    };
    return ler(url, 10000)
      .catch(function () { return ler("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url), 12000); })
      .catch(function () { return ler("https://api.allorigins.win/raw?url=" + encodeURIComponent(url), 12000); });
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

  // Notícias de UM dia, para os "N" das velas com variação forte.
  // 1º) Google Notícias (Brasil, português) lido pelo rss2json — gratuito,
  //     sem chave e liberado para o navegador (CORS); a busca aceita
  //     after:/before: para pegar só aquele dia.
  // 2º) Se falhar, GDELT DOC 2.0 no mesmo dia (também gratuito, mas costuma
  //     recusar consultas seguidas e responde erro como texto).
  // termos: { google: 'PETR4 OR "Petrobras"', gdelt: '(PETR4 OR "Petrobras")' }
  // Devolve [{ quando, titulo, url, fonte }] (até 5, mais recentes primeiro).
  function diaSeguinte(iso) {
    var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function diaAnterior(iso) {
    var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  // item do Google Notícias → { quando, titulo, url, fonte }
  // (o título termina com " - Nome do site")
  function itemGoogle(tituloBruto, pubDate, link, fonteBruta, dia) {
    var titulo = String(tituloBruto || ""), fonte = String(fonteBruta || "");
    var k = titulo.lastIndexOf(" - ");
    if (k > 20) { fonte = fonte || titulo.slice(k + 3).trim(); titulo = titulo.slice(0, k).trim(); }
    var quando = pubDate ? new Date(pubDate) : null;
    return { quando: quando && !isNaN(quando) ? quando.toISOString() : dia + "T12:00:00.000Z", titulo: titulo, url: String(link || ""), fonte: fonte };
  }
  // Lê uma busca do Google Notícias (RSS) pelos caminhos com CORS:
  // rss2json (JSON, até 10 itens), allorigins ou codetabs (XML inteiro, até
  // ~100 itens), cada um com tempo curto.
  var caminhoRss = 0;
  function rssXml(xml, diaRef) {
    var doc = new DOMParser().parseFromString(xml, "text/xml");
    var itens = Array.prototype.slice.call(doc.getElementsByTagName("item"));
    if (!itens.length && !/<rss/i.test(xml)) throw new Error("resposta inválida");
    var txt = function (el, tag) { var x = el.getElementsByTagName(tag)[0]; return x ? x.textContent : ""; };
    return itens.map(function (el) { return itemGoogle(txt(el, "title"), txt(el, "pubDate"), txt(el, "link"), txt(el, "source"), diaRef); });
  }
  function lerRssGoogle(consulta, diaRef, preferirCompleto) {
    var rss = "https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-419&q=" + encodeURIComponent(consulta);
    var caminhos = [
      function () {
        return comTimeout(fetch("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rss)).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }).then(function (j) {
          if (!j || j.status !== "ok") throw new Error((j && j.message) || "rss2json falhou");
          return (j.items || []).map(function (it) {
            return itemGoogle(it.title, it.pubDate ? String(it.pubDate).replace(" ", "T") + "Z" : "", it.link, it.author, diaRef);
          });
        }), 6000);
      },
      function () {
        return comTimeout(fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(rss)).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        }).then(function (xml) { return rssXml(xml, diaRef); }), 7000);
      },
      function () {
        return comTimeout(fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(rss)).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        }).then(function (xml) { return rssXml(xml, diaRef); }), 7000);
      }
    ];
    // um caminho de cada vez (os serviços gratuitos limitam pedidos por
    // segundo: disparar todos juntos estourava os limites), começando pelo
    // que funcionou da última vez. Numa busca de período, os caminhos que
    // trazem o RSS inteiro (até ~100 itens) vêm antes do rss2json (10 itens).
    var base = preferirCompleto ? [1, 2, 0] : [0, 1, 2];
    var primeiro = preferirCompleto && caminhoRss === 0 ? base[0] : caminhoRss;
    var ordem = [primeiro].concat(base.filter(function (x) { return x !== primeiro; }));
    var tentar = function (k) {
      if (k >= ordem.length) return Promise.reject(new Error("Google Notícias indisponível"));
      return caminhos[ordem[k]]().then(function (lista) {
        caminhoRss = ordem[k];
        return lista.filter(function (n) { return n.titulo && n.url; });
      }, function () { return tentar(k + 1); });
    };
    return tentar(0);
  }
  // O movimento de um dia costuma vir de notícia daquele dia ou da noite
  // anterior: a busca pega os dois dias (after: é o dia anterior).
  function noticiasGoogle(termo, dia) {
    return lerRssGoogle(termo + " after:" + diaAnterior(dia) + " before:" + diaSeguinte(dia), dia, false);
  }
  // Uma busca só para um período inteiro (até ~100 notícias): mostra a maior
  // parte dos "N" de uma vez, antes da busca dia a dia dos que faltarem.
  function buscarNoticiasPeriodo(termos, inicio, fim) {
    return lerRssGoogle(termos.google + " after:" + diaAnterior(inicio) + " before:" + diaSeguinte(fim), fim, true)
      .catch(function () { return noticiasGdelt(termos.gdelt, diaAnterior(inicio), fim); });
  }
  // GDELT de um dia (ou de um período, com "ate"): reserva quando o Google falha
  function noticiasGdelt(termo, dia, ate) {
    var d = dia.replace(/-/g, ""), f = (ate || dia).replace(/-/g, "");
    var url = "https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&" + (ate ? "sort=datedesc&maxrecords=250" : "sort=hybridrel&maxrecords=10") +
      "&startdatetime=" + d + "000000&enddatetime=" + f + "235959&query=" + encodeURIComponent(termo + " sourcelang:portuguese");
    return comTimeout(fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (txt) {
      var j;
      try { j = JSON.parse(txt); } catch (e) { throw new Error(txt.slice(0, 120) || "resposta inválida"); }
      return (j.articles || []).map(function (a) {
        var m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(a.seendate || "");
        var quando = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString() : dia + "T12:00:00.000Z";
        return { quando: quando, titulo: String(a.title || ""), url: String(a.url || ""), fonte: String(a.domain || "") };
      }).filter(function (n) { return n.titulo && n.url; });
    }), 8000);
  }
  function buscarNoticiasDia(termos, dia) {
    // notícias do próprio dia primeiro, depois as da véspera; as mais recentes no topo
    var ordenar = function (lista) {
      return lista.sort(function (a, b) {
        var da = a.quando.slice(0, 10) === dia ? 1 : 0, db = b.quando.slice(0, 10) === dia ? 1 : 0;
        return da !== db ? db - da : (a.quando < b.quando ? 1 : -1);
      }).slice(0, 5);
    };
    return noticiasGoogle(termos.google, dia).then(function (lista) {
      if (lista.length) return ordenar(lista);
      return noticiasGdelt(termos.gdelt, dia).then(ordenar).catch(function () { return []; });
    }, function () {
      // Google indisponível: tenta o GDELT; se também falhar, a busca falha
      // (e o dia é consultado de novo na próxima vez)
      return noticiasGdelt(termos.gdelt, dia).then(ordenar);
    });
  }

  global.Cotacoes = { buscarDolar: buscarDolar, buscarSerieDolar: buscarSerieDolar, buscarCotacoes: buscarCotacoes, buscarSerieBCB: buscarSerieBCB, buscarNoticiasDia: buscarNoticiasDia, buscarNoticiasPeriodo: buscarNoticiasPeriodo };
})(window);
