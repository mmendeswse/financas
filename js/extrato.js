/**
 * extrato.js
 * -----------------------------------------------------------------------
 * Lê o PDF do "Extrato de Custódia" do Nubank dentro do próprio sistema
 * (sem enviar nada para a internet) e transforma em investimentos e ações.
 *
 * 1. pdf.js extrai os pedaços de texto com a posição de cada um;
 * 2. os pedaços são agrupados em linhas pela altura na página;
 * 3. cada seção (Caixinhas, Renda Fixa, Tesouro Direto, Bolsa) é
 *    interpretada pelo formato das suas colunas.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  // "1.234,56" → 1234.56
  function numero(txt) {
    if (txt == null) return 0;
    return Number(String(txt).replace(/\./g, "").replace(",", ".")) || 0;
  }
  // "14/02/2030" → "2030-02-14"
  function dataISO(txt) {
    var m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(txt || "");
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
  }
  // "BANCO DIGIMAIS" → "Banco Digimais"
  function titulo(txt) {
    return String(txt || "").toLowerCase().replace(/(^|\s)(\S)/g, function (t, a, b) { return a + b.toUpperCase(); });
  }

  // ---- 1 e 2: PDF → páginas → linhas de texto ----
  function montarLinhas(itens) {
    var grupos = {};
    itens.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var y = Math.round(it.transform[5]);
      (grupos[y] = grupos[y] || []).push({ x: it.transform[4], t: it.str });
    });
    return Object.keys(grupos).map(Number).sort(function (a, b) { return b - a; }).map(function (y) {
      return grupos[y].sort(function (a, b) { return a.x - b.x; })
        .map(function (i) { return i.t; }).join(" ").replace(/\s+/g, " ").trim();
    });
  }

  function lerPdf(arrayBuffer) {
    var lib = global.pdfjsLib;
    if (!lib) return Promise.reject(new Error("leitor de PDF não carregado"));
    var doc;
    return lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise.then(function (d) {
      doc = d;
      var tarefas = [];
      for (var n = 1; n <= doc.numPages; n++) {
        tarefas.push(doc.getPage(n).then(function (pg) {
          return pg.getTextContent().then(function (tc) { return montarLinhas(tc.items); });
        }));
      }
      return Promise.all(tarefas);
    });
  }

  // ---- 3: linhas → investimentos e ações ----
  var N = "([\\d.]+,\\d+)";   // número no formato brasileiro
  var D = "(\\d{2}\\/\\d{2}\\/\\d{4})";

  var RX_CAIXINHA = new RegExp("^(RDB .+?) " + N + " " + N + " " + N + " " + N + "(?: (.*))?$");
  var RX_RENDA_FIXA = new RegExp("^(.+?) " + D + " (.+?) " + N + " " + D + " " + N + " " + N + " " + N + " " + N);
  var RX_TESOURO = new RegExp("^(Tesouro .+?) " + D + " " + N + " " + N + " " + N + " " + N);
  var RX_BOLSA = /^(Ação brasileira|FII|Fundo imobiliário|ETF|BDR)\s+(.+?)\s*\(([A-Z0-9]{4,7})\)\s+([\d.]+,\d+)\s+([\d.]+,\d+)/i;

  function interpretar(paginas) {
    var resultado = { banco: "Nubank", data: "", investimentos: [], acoes: [], avisos: [] };
    var todas = [].concat.apply([], paginas);

    var cab = todas.filter(function (l) { return /^Custódia em: /.test(l); })[0];
    resultado.data = cab ? dataISO(cab) : "";
    if (!/Extrato de Custódia/i.test(todas.join(" "))) {
      resultado.avisos.push("O arquivo não parece ser um Extrato de Custódia do Nubank.");
      return resultado;
    }

    var secao = "";
    todas.forEach(function (l) {
      var s = /^Custódia em (Caixinhas|Renda Fixa|Tesouro Direto|Bolsa de Valores)/.exec(l);
      if (s) { secao = s[1]; return; }
      if (/^Total /.test(l) || /^Tipo de Ativo/.test(l)) return;
      var m;

      if (secao === "Caixinhas" && (m = RX_CAIXINHA.exec(l))) {
        resultado.investimentos.push({
          nome: m[1] + " (Caixinha)", categoria: "Renda fixa", tipoAtivo: "RDB", emissor: "Nubank",
          liquidez: /mesmo dia/i.test(m[6] || "") ? "Liquidez diária" : "No vencimento",
          valorAtual: numero(m[2]), ir: numero(m[3]), liquido: numero(m[5]),
          indexador: "% do CDI"
        });
      } else if (secao === "Renda Fixa" && (m = RX_RENDA_FIXA.exec(l))) {
        // "CDB Pós-fixado BANCO DIGIMAIS": o emissor são as palavras finais em maiúsculas
        var partes = /^(.*?)\s+([A-ZÀ-Ú0-9&.\- ]{3,})$/.exec(m[1]) || [null, m[1], ""];
        var tipo = partes[1].trim(), taxa = m[3].trim();
        var numTaxa = numero((/([\d.,]+)/.exec(taxa) || [])[1]);
        resultado.investimentos.push({
          nome: tipo + " " + taxa, categoria: "Renda fixa",
          tipoAtivo: /^(CDB|LCI|LCA|LC|RDB|CRI|CRA|Debênture)/i.exec(tipo) ? /^(CDB|LCI|LCA|LC|RDB|CRI|CRA|Debênture)/i.exec(tipo)[1].toUpperCase() : "Outro",
          emissor: titulo(partes[2]), dataVencimento: dataISO(m[2]),
          indexador: /CDI/i.test(taxa) ? (/\+/.test(taxa) ? "CDI +" : "% do CDI") : (/IPCA/i.test(taxa) ? "IPCA +" : "Prefixado"),
          taxaContratada: numTaxa, valorInvestido: numero(m[4]), dataAplicacao: dataISO(m[5]),
          valorAtual: numero(m[6]), ir: numero(m[7]), liquido: numero(m[9]),
          liquidez: "Liquidez diária", isentoIR: /^(LCI|LCA|CRI|CRA)/i.test(tipo)
        });
      } else if (secao === "Tesouro Direto" && (m = RX_TESOURO.exec(l))) {
        var tipoT = /IPCA/i.test(m[1]) ? "Tesouro IPCA+" : (/Prefixado/i.test(m[1]) ? "Tesouro Prefixado" : "Tesouro Selic");
        resultado.investimentos.push({
          nome: m[1].trim(), categoria: "Tesouro Direto", tipoAtivo: tipoT, emissor: "Tesouro Nacional",
          dataVencimento: dataISO(m[2]), quantidade: numero(m[3]),
          valorInvestido: numero(m[4]), valorAtual: numero(m[5]), ir: numero(m[6]),
          indexador: tipoT === "Tesouro IPCA+" ? "IPCA +" : (tipoT === "Tesouro Selic" ? "Selic +" : "Prefixado"),
          liquidez: "Liquidez diária"
        });
      } else if (secao === "Bolsa de Valores" && (m = RX_BOLSA.exec(l))) {
        var qtd = numero(m[4]), bruto = numero(m[5]);
        resultado.acoes.push({
          ticker: m[3].toUpperCase(), empresa: m[2].trim(),
          categoria: /FII|imobili/i.test(m[1]) ? "FII" : (/ETF/i.test(m[1]) ? "ETF" : "Ação"),
          quantidade: qtd, precoAtual: qtd > 0 ? Math.round((bruto / qtd) * 100) / 100 : 0, valorAtual: bruto
        });
      }
    });

    if (!resultado.investimentos.length && !resultado.acoes.length) {
      resultado.avisos.push("Nenhum investimento ou ação foi reconhecido no arquivo.");
    }
    return resultado;
  }

  global.Extrato = { lerPdf: lerPdf, interpretar: interpretar, montarLinhas: montarLinhas };
})(typeof window !== "undefined" ? window : globalThis);
