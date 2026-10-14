/**
 * cotacoes.js
 * -----------------------------------------------------------------------
 * Integração com APIs públicas de cotação. Mantido separado para o resto
 * do sistema continuar funcionando 100% offline: se não houver internet
 * ou a API falhar, as funções rejeitam a Promise e a interface mantém o
 * último preço conhecido (com a indicação "atualizado manualmente").
 *
 *   buscarDolar()                 -> { valor, variacaoPct, atualizadoEm }
 *   buscarCripto()                -> { BTC: { valor, variacaoPct }, ETH: { valor, variacaoPct } }
 *   buscarCotacoes(tickers, token) -> { cotacoes: { PETR4: { preco, variacaoPct, nome } }, erros: { XPTO3: 'motivo' } }
 *   buscarMercado(simbolos, token) -> índices e ações (EUA e Brasil) com 3 meses de histórico
 *
 * Dólar: AwesomeAPI (economia.awesomeapi.com.br) — gratuita, sem chave.
 * Ações: brapi.dev — gratuita; alguns limites exigem token (criado de
 * graça em brapi.dev). O token fica salvo só no localStorage do usuário.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var URL_DOLAR = "https://economia.awesomeapi.com.br/last/USD-BRL";
  var URL_SERIE_MOEDA = "https://economia.awesomeapi.com.br/json/daily/";
  var URL_BRAPI = "https://brapi.dev/api/quote/";
  var URL_CRIPTO = "https://economia.awesomeapi.com.br/last/BTC-BRL,ETH-BRL";

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

  // Bitcoin e Ethereum em reais, na mesma AwesomeAPI do dólar.
  // -> { BTC: { valor, variacaoPct }, ETH: { valor, variacaoPct } }
  function buscarCripto() {
    return comTimeout(fetch(URL_CRIPTO, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var res = {};
      ["BTC", "ETH"].forEach(function (m) {
        var d = j && j[m + "BRL"];
        if (d && Number(d.bid) > 0) res[m] = { valor: Number(d.bid), variacaoPct: Number(d.pctChange) || 0 };
      });
      if (!res.BTC && !res.ETH) throw new Error("Resposta inesperada");
      return res;
    }), 8000);
  }

  // Série histórica do dólar (fechamento diário), usada no gráfico da
  // tela de detalhe. A mesma API, sem chave; devolve do mais recente
  // para o mais antigo, então invertemos a ordem.
  // O mesmo vale para o Bitcoin e o Ethereum (par "BTC-BRL", "ETH-BRL").
  function buscarSerieDolar(dias) { return buscarSerieMoeda("USD-BRL", dias); }
  function buscarSerieMoeda(par, dias) {
    return comTimeout(fetch(URL_SERIE_MOEDA + par + "/" + (dias || 90), { cache: "no-store" }).then(function (r) {
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
          return { data: iso, preco: Number(h.close), abertura: Number(h.open) || 0, maxima: Number(h.high) || 0, minima: Number(h.low) || 0, volume: Number(h.volume) || 0 };
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
      .catch(function () { return ler("https://corsproxy.io/?url=" + encodeURIComponent(url), 12000); })
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

  // Visão de mercado (guia Nasdaq): índices e ações dos EUA e do Brasil.
  // Yahoo Finance (gráfico diário de 3 meses, sem chave). O Yahoo nem sempre
  // aceita chamada direta do navegador (CORS): se falhar, tenta pelos mesmos
  // repassadores das notícias, começando pelo que funcionou da última vez.
  //   buscarMercado(["^IXIC", "AAPL", "PETR4.SA"], token)
  //     -> { cotacoes: { AAPL: { preco, variacaoPct, nome, moeda, historico: [{ data, preco }] } }, erros: { XPTO: 'motivo' } }
  // Os papéis brasileiros (".SA" e o Ibovespa) vão primeiro à brapi, que o
  // app já usa nas ações; o Yahoo fica de reserva.
  var caminhoYahoo = 0;
  function lerYahoo(simbolo) {
    var url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(simbolo) + "?range=3mo&interval=1d";
    var url2 = url.replace("query1", "query2");
    var caminhos = [
      function () { return url; },
      function () { return url2; },
      function () { return "https://corsproxy.io/?url=" + encodeURIComponent(url); },
      function () { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(url); },
      function () { return "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url2); }
    ];
    var ordem = [caminhoYahoo].concat([0, 1, 2, 3, 4].filter(function (x) { return x !== caminhoYahoo; }));
    var tentar = function (k) {
      if (k >= ordem.length) return Promise.reject(new Error("Yahoo Finance indisponível"));
      return comTimeout(fetch(caminhos[ordem[k]](), { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }), 7000).then(function (j) {
        var res = j && j.chart && j.chart.result && j.chart.result[0];
        if (!res || !res.meta || !(Number(res.meta.regularMarketPrice) > 0)) throw new Error("sem preço na resposta");
        caminhoYahoo = ordem[k];
        var m = res.meta, q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
        var historico = (res.timestamp || []).map(function (t, i) {
          var dt = new Date((Number(t) + Number(m.gmtoffset || 0)) * 1000);
          return { data: dt.toISOString().slice(0, 10), preco: Number((q.close || [])[i]),
                   abertura: Number((q.open || [])[i]) || 0, maxima: Number((q.high || [])[i]) || 0, minima: Number((q.low || [])[i]) || 0,
                   volume: Number((q.volume || [])[i]) || 0 };
        }).filter(function (h) { return h.preco > 0; });
        var preco = Number(m.regularMarketPrice);
        // o fechamento anterior de verdade é o penúltimo ponto da série
        // (chartPreviousClose é o fechamento de antes do início do gráfico)
        var ult = historico.length && historico[historico.length - 1];
        var hoje = new Date((Number(m.regularMarketTime || 0) + Number(m.gmtoffset || 0)) * 1000).toISOString().slice(0, 10);
        if (ult && ult.data === hoje) ult.preco = preco;
        else if (Number(m.regularMarketTime) > 0) historico.push({ data: hoje, preco: preco });
        var ant = historico.length > 1 ? historico[historico.length - 2].preco : Number(m.previousClose || m.chartPreviousClose);
        return { preco: preco, variacaoPct: ant > 0 ? (preco / ant - 1) * 100 : 0, nome: m.longName || m.shortName || "", moeda: m.currency || "", historico: historico };
      }).catch(function () { return tentar(k + 1); });
    };
    return tentar(0);
  }
  // Reserva para os EUA: cotação do dia na Stooq (sem histórico), direto ou
  // pelos repassadores. "^IXIC" → "^ndq", "AAPL" → "aapl.us".
  var STOOQ = { "^IXIC": "^ndq", "^NDX": "^ndx", "^GSPC": "^spx", "GC=F": "xauusd" };
  function lerStooq(simbolo) {
    var s = STOOQ[simbolo] || (simbolo.toLowerCase() + ".us");
    var url = "https://stooq.com/q/l/?s=" + encodeURIComponent(s) + "&f=sd2t2ohlcp&h&e=csv";
    var caminhos = [url, "https://corsproxy.io/?url=" + encodeURIComponent(url), "https://api.allorigins.win/raw?url=" + encodeURIComponent(url), "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url)];
    var tentar = function (k) {
      if (k >= caminhos.length) return Promise.reject(new Error("Stooq indisponível"));
      return comTimeout(fetch(caminhos[k], { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      }), 7000).then(function (csv) {
        // Symbol,Date,Time,Open,High,Low,Close,Prev
        var linhas = csv.trim().split(/\r?\n/), c = (linhas[1] || "").split(",");
        var fch = Number(c[6]), abr = Number(c[3]), ant = Number(c[7]);
        if (!(fch > 0)) throw new Error("sem preço na resposta");
        var base = ant > 0 ? ant : abr;
        return { preco: fch, variacaoPct: base > 0 ? (fch / base - 1) * 100 : 0, nome: "", moeda: "USD", historico: [] };
      }).catch(function () { return tentar(k + 1); });
    };
    return tentar(0);
  }

  // aoChegar(simbolo, cotação) é chamado a cada ativo que chega, para a tela
  // ir se preenchendo sem esperar a lista inteira. Uma fonte que falha três
  // vezes seguidas é pulada no resto da rodada (não trava a busca).
  function buscarMercado(simbolos, token, aoChegar) {
    var cotacoes = {}, erros = {}, falhasYahoo = 0, falhasStooq = 0;
    var yahoo = function (s) {
      if (falhasYahoo >= 3) return Promise.reject(new Error("Yahoo indisponível"));
      return lerYahoo(s).then(function (r) { falhasYahoo = 0; return r; }, function (e) { falhasYahoo++; throw e; });
    };
    var stooq = function (s) {
      if (falhasStooq >= 3) return Promise.reject(new Error("Stooq indisponível"));
      return lerStooq(s).then(function (r) { falhasStooq = 0; return r; }, function (e) { falhasStooq++; throw e; });
    };
    var umSimbolo = function (s) {
      var br = /\.SA$/.test(s) || s === "^BVSP";
      var p = br
        ? buscarUm(s.replace(/\.SA$/, ""), token).then(function (r) {
            return { preco: r.preco, variacaoPct: r.variacaoPct, nome: r.nome, moeda: "BRL", historico: r.historico };
          }).then(function (r) { if (r.historico.length < 2) throw new Error("sem histórico"); return r; })
            .catch(function () { return yahoo(s); })
        : yahoo(s).catch(function () { return stooq(s); });
      return p.then(function (r) { cotacoes[s] = r; if (aoChegar) { try { aoChegar(s, r); } catch (e) { /* tela */ } } },
        function (e) { erros[s] = e.message || "falhou"; });
    };
    // quatro de cada vez: os serviços gratuitos limitam pedidos por segundo
    var fila = simbolos.slice();
    var trabalhador = function () { var s = fila.shift(); return s ? umSimbolo(s).then(trabalhador) : Promise.resolve(); };
    return Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador()]).then(function () { return { cotacoes: cotacoes, erros: erros }; });
  }

  // Ouro em dólar por onça (XAU-USD) na AwesomeAPI — a mesma do dólar, que
  // responde no aparelho quando as fontes dos EUA (Yahoo, Stooq) não respondem
  function buscarOuro() {
    return comTimeout(fetch("https://economia.awesomeapi.com.br/last/XAU-USD", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var d = j && j.XAUUSD;
      if (!d || !(Number(d.bid) > 0)) throw new Error("Resposta inesperada");
      return { preco: Number(d.bid), variacaoPct: Number(d.pctChange) || 0 };
    }), 8000);
  }

  global.Cotacoes = { buscarDolar: buscarDolar, buscarCripto: buscarCripto, buscarSerieDolar: buscarSerieDolar, buscarSerieMoeda: buscarSerieMoeda, buscarCotacoes: buscarCotacoes, buscarSerieBCB: buscarSerieBCB, buscarNoticiasDia: buscarNoticiasDia, buscarNoticiasPeriodo: buscarNoticiasPeriodo, buscarMercado: buscarMercado, buscarOuro: buscarOuro };
})(window);
