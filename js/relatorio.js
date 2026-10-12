/**
 * relatorio.js
 * -----------------------------------------------------------------------
 * Lê o PDF do relatório diário de mercado ("Cobertura de Empresas") dentro
 * do próprio sistema, sem enviar nada para a internet:
 *
 *   Relatorio.lerPdf(arrayBuffer) -> {
 *     data, fechamento, colunas: [atual, anterior],
 *     grupos: [{ nome, ativos: [{ nome, atual, anterior, dia, mes, ano, taxa }] }],
 *     indicadores: [{ nome, valor }],            // CDI e IPCA
 *     altas: [{ ticker, pct }], quedas: [...], numAltas, numQuedas,
 *     resumo: "texto", noticias: [{ titulo, paragrafos: [...], tickers: [...] }]
 *   }
 *
 * Página da tabela: os pedaços de texto são agrupados em linhas pela altura
 * e cada linha é reconhecida pelo formato (rótulo + 5 números, rótulo +
 * número + rótulo + número…). Páginas seguintes: títulos (fonte maior) e
 * parágrafos (linha que começa recuada).
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var limpar = function (s) { return String(s || "").normalize("NFC").replace(/[\u200b\u200c\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim(); };
  // "204.302,33" → 204302.33 · "-0,74%" → -0.74
  function numero(txt) {
    var n = Number(String(txt).replace("%", "").replace(/\./g, "").replace(",", "."));
    return isFinite(n) ? n : null;
  }
  var ehNumero = function (t) { return /^-?[\d.]+(,\d+)?%?$/.test(t); };
  var ehTicker = function (t) { return /^[A-Z]{4}\d{1,2}$/.test(t); };

  // pedaços → linhas [{ y, itens: [{ x, t, h }] }], de cima para baixo
  function linhas(itens) {
    var lista = itens.map(function (it) { return { x: it.transform[4], y: it.transform[5], h: it.height, t: limpar(it.str) }; })
      .filter(function (i) { return i.t; })
      .sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var res = [];
    lista.forEach(function (i) {
      var l = res[res.length - 1];
      if (l && Math.abs(l.y - i.y) <= 2) l.itens.push(i);
      else res.push({ y: i.y, itens: [i] });
    });
    res.forEach(function (l) { l.itens.sort(function (a, b) { return a.x - b.x; }); });
    return res;
  }

  function lerTabela(ls, r) {
    var grupo = null, lista = null, resumoY = null;
    var resumo = [];
    ls.forEach(function (l) {
      var its = l.itens;
      // o quadro do resumo fica à direita das maiores altas/quedas
      if (resumoY != null && l.y < resumoY) {
        var dir = its.filter(function (i) { return i.x >= 280; });
        its = its.filter(function (i) { return i.x < 280; });
        dir.forEach(function (i) { if (!/^\*/.test(i.t)) resumo.push(i.t); });
      }
      var ts = its.map(function (i) { return i.t; });
      var txt = ts.join(" ");
      if (!ts.length) return;
      var m;
      if (/RESUMO DAS NOT/i.test(txt)) { resumoY = l.y + 1; return; }
      if (!r.data && (m = /^[A-ZÇÁÉ-]+-FEIRA|^(SÁBADO|DOMINGO)/i.exec(txt))) { r.data = txt; return; }
      if (/^DADOS DE FECHAMENTO/i.test(txt)) { r.fechamento = txt.replace(/^DADOS DE FECHAMENTO\s*/i, ""); return; }
      if (/FECHAMENTO EM/i.test(txt)) { r.colunas = (txt.match(/FECHAMENTO EM \d{2}\/\d{2}/gi) || []).map(function (s) { return s.slice(-5); }); return; }
      if (/MAIORES ALTAS/i.test(txt)) { lista = r.altas; return; }
      if (/MAIORES QUEDAS/i.test(txt)) { lista = r.quedas; return; }
      if ((m = /AÇÕES EM ALTA:?\s*(\d+)/i.exec(txt))) { r.numAltas = Number(m[1]); return; }
      if ((m = /AÇÕES EM QUEDA:?\s*(\d+)/i.exec(txt))) { r.numQuedas = Number(m[1]); return; }
      if (lista && ts.length >= 2 && ehTicker(ts[0]) && ehNumero(ts[1])) { lista.push({ ticker: ts[0], pct: numero(ts[1]) }); return; }
      // ativo: rótulo e cinco números (atual, anterior, dia, mês, ano)
      var nums = ts.filter(ehNumero), rot = ts.filter(function (t) { return !ehNumero(t); });
      if (rot.length === 1 && nums.length === 5 && !ehNumero(ts[0])) {
        if (!grupo) { grupo = { nome: "Índices", ativos: [] }; r.grupos.push(grupo); }
        grupo.ativos.push({ nome: rot[0].replace(/^AÇÃO\s+/i, ""), acao: /^AÇÃO\s+/i.test(rot[0]), atual: numero(nums[0]), anterior: numero(nums[1]),
          dia: numero(nums[2]), mes: numero(nums[3]), ano: numero(nums[4]), taxa: /%$/.test(nums[0]) });
        return;
      }
      // CDI / IPCA: pares rótulo + valor na mesma linha
      if (nums.length && rot.length === nums.length && !ehNumero(ts[0]) && ts.every(function (t, k) { return (k % 2 === 1) === ehNumero(t); })) {
        for (var k = 0; k < ts.length; k += 2) r.indicadores.push({ nome: ts[k], valor: numero(ts[k + 1]) });
        return;
      }
      // título de grupo (Índices, Moedas e Ouro, Futuros…): uma palavra só, antes das altas/quedas
      if (!lista && !r.indicadores.length && ts.length === 1 && !/^(CDI|IPCA|DESEMPENHO)/i.test(txt) && !/^\*/.test(txt)) {
        grupo = { nome: txt, ativos: [] }; r.grupos.push(grupo);
      }
    });
    r.grupos = r.grupos.filter(function (g) { return g.ativos.length; });
    r.resumo = resumo.join(" ").replace(/\s+/g, " ").trim();
  }

  // páginas de texto: título (fonte maior) e parágrafos (linha recuada)
  function lerNoticias(paginas, r) {
    var atual = null, fim = false;
    paginas.forEach(function (ls) {
      if (fim) return;
      var corpo = ls.length ? Math.min.apply(null, ls.map(function (l) { return Math.min.apply(null, l.itens.map(function (i) { return i.x; })); })) : 0;
      ls.forEach(function (l) {
        if (fim) return;
        var txt = l.itens.map(function (i) { return i.t; }).join(" ").replace(/\s+/g, " ").trim();
        var h = Math.max.apply(null, l.itens.map(function (i) { return i.h; }));
        if (/^DISCLAIMER/i.test(txt)) { fim = true; return; }
        if (h >= 13.5) {
          if (atual && !atual.paragrafos.length) atual.titulo += " " + txt;
          else { atual = { titulo: txt, paragrafos: [] }; r.noticias.push(atual); }
          return;
        }
        if (!atual) return;
        var recuo = l.itens[0].x - corpo > 15;
        if (recuo || !atual.paragrafos.length) atual.paragrafos.push(txt);
        else atual.paragrafos[atual.paragrafos.length - 1] += " " + txt;
        if (/^Bons investimentos/i.test(txt)) { atual.paragrafos.pop(); fim = true; }
      });
    });
    r.noticias.forEach(function (n) {
      var achados = {};
      n.paragrafos.join(" ").replace(/\(B3:\s*([A-Z]{4}\d{1,2})\)/g, function (_, t) { achados[t] = 1; });
      n.tickers = Object.keys(achados);
    });
  }

  function lerPdf(arrayBuffer) {
    var lib = global.pdfjsLib;
    if (!lib) return Promise.reject(new Error("leitor de PDF não carregado"));
    return lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise.then(function (doc) {
      var tarefas = [];
      for (var n = 1; n <= doc.numPages; n++) {
        tarefas.push(doc.getPage(n).then(function (pg) { return pg.getTextContent().then(function (tc) { return linhas(tc.items); }); }));
      }
      return Promise.all(tarefas);
    }).then(function (paginas) {
      var r = { data: "", fechamento: "", colunas: [], grupos: [], indicadores: [], altas: [], quedas: [], numAltas: null, numQuedas: null, resumo: "", noticias: [] };
      var idx = -1;
      paginas.forEach(function (ls, k) {
        if (idx < 0 && ls.some(function (l) { return /DADOS DE FECHAMENTO/i.test(l.itens.map(function (i) { return i.t; }).join(" ")); })) idx = k;
      });
      if (idx < 0) throw new Error("não encontrei a tabela de fechamento neste PDF");
      lerTabela(paginas[idx], r);
      if (!r.grupos.length) throw new Error("não consegui ler as cotações do relatório");
      lerNoticias(paginas.slice(idx + 1), r);
      return r;
    });
  }

  global.Relatorio = { lerPdf: lerPdf };
})(window);
