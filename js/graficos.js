/**
 * graficos.js
 * -----------------------------------------------------------------------
 * Toda a comunicação com o Chart.js fica isolada aqui. O app.js só chama
 * Graficos.renderX(idDoCanvas, dados) — não sabe nada sobre a biblioteca.
 *
 * Cada gráfico é registrado por id de canvas e destruído antes de ser
 * recriado (as telas são recriadas via innerHTML ao trocar de seção).
 *
 * Paleta: laranja como cor de marca (patrimônio / destaque), verde para
 * renda e valores positivos, rosa/vermelho para despesas e negativos,
 * azul para poupança e informação — como nos painéis de referência.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var CORES = {
    laranja: "#FFA726",
    up: "#2EE59D",
    down: "#FF5C6A",
    azul: "#38B6FF",
    cy: "#00E5FF",
    vi: "#A66BFF",
    acc: "#FFA726",
    dim: "#6E8494",
    grade: "rgba(110,132,148,0.14)",
    texto: "#8FA3B3",
    painel: "#0B141C"
  };
  var PALETA_CATEGORIAS = [CORES.laranja, CORES.azul, CORES.cy, CORES.acc, CORES.vi, CORES.up, CORES.down, CORES.dim];

  var instancias = {};

  function moeda(v) { return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function fonte(tam) { return { family: "'Segoe UI', Roboto, Inter, sans-serif", size: tam || 11, weight: "600" }; }
  function abreviaK(v) {
    var a = Math.abs(v);
    if (a >= 1000000) return "R$ " + (v / 1000000).toFixed(1).replace(".", ",") + "M";
    if (a >= 1000) return "R$ " + Math.round(v / 1000) + "k";
    return "R$ " + Math.round(v);
  }

  function destruir(id) {
    if (instancias[id]) { instancias[id].destroy(); delete instancias[id]; }
  }
  function ctxOf(canvasId) {
    var el = document.getElementById(canvasId);
    return el ? el.getContext("2d") : null;
  }
  function tooltipPadrao(extra) {
    return Object.assign({
      backgroundColor: "#0F1B26", borderColor: "#1F3440", borderWidth: 1,
      titleColor: "#EDF2FA", bodyColor: "#EDF2FA", padding: 10,
      titleFont: fonte(11), bodyFont: fonte(11), displayColors: true, boxPadding: 4
    }, extra || {});
  }
  function eixoX(extra) {
    return Object.assign({ grid: { display: false }, border: { display: false }, ticks: { color: CORES.texto, font: fonte(10.5) } }, extra || {});
  }
  function eixoY(extra) {
    return Object.assign({ grid: { color: CORES.grade }, border: { display: false, dash: [3, 3] }, ticks: { color: CORES.texto, font: fonte(10.5), callback: function (v) { return abreviaK(v); } } }, extra || {});
  }
  function gradiente(ctx, cor, altura) {
    var g = ctx.createLinearGradient(0, 0, 0, altura || 220);
    g.addColorStop(0, cor + "66");
    g.addColorStop(1, cor + "00");
    return g;
  }

  // ---------------------------------------------------------------------
  // Receitas x despesas por mês (barras agrupadas — verde x rosa)
  // ---------------------------------------------------------------------
  function renderReceitasDespesas(canvasId, serie) {
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    instancias[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: serie.map(function (s) { return s.rotulo; }),
        datasets: [
          { label: "Receitas", data: serie.map(function (s) { return s.entradas; }), backgroundColor: "rgba(46,229,157,0.28)", borderColor: CORES.up, borderWidth: 1.5, borderRadius: 2, maxBarThickness: 26 },
          { label: "Despesas", data: serie.map(function (s) { return s.despesas; }), backgroundColor: "rgba(255,92,106,0.28)", borderColor: CORES.down, borderWidth: 1.5, borderRadius: 2, maxBarThickness: 26 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: { x: eixoX(), y: eixoY() },
        plugins: {
          legend: { position: "top", align: "end", labels: { color: CORES.texto, font: fonte(10.5), boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle" } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": " + moeda(c.parsed.y); } } })
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Rosca genérica (composição, categorias)
  // ---------------------------------------------------------------------
  function renderDoughnutGenerico(canvasId, itens, opcoes) {
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    opcoes = opcoes || {};
    var cores = itens.map(function (it, i) { return it.cor || PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length]; });
    instancias[canvasId] = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: itens.map(function (i) { return i.rotulo || i.categoria; }),
        datasets: [{ data: itens.map(function (i) { return i.valor; }), backgroundColor: cores, borderColor: CORES.painel, borderWidth: 3, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "72%",
        plugins: {
          legend: { display: false },
          tooltip: tooltipPadrao({
            callbacks: {
              label: function (c) {
                var total = c.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                var p = total > 0 ? (c.parsed / total) * 100 : 0;
                return " " + c.label + ": " + moeda(c.parsed) + " (" + p.toFixed(1).replace(".", ",") + "%)";
              }
            }
          })
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Evolução do patrimônio (linha laranja com área e pontos brancos)
  // ---------------------------------------------------------------------
  function renderEvolucaoPatrimonio(canvasId, historico) {
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    var maxIdx = 0;
    historico.forEach(function (p, i) { if (p.valor > historico[maxIdx].valor) maxIdx = i; });
    instancias[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: historico.map(function (p) { return new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""); }),
        datasets: [{
          label: "Patrimônio líquido",
          data: historico.map(function (p) { return p.valor; }),
          borderColor: CORES.up, backgroundColor: gradiente(ctx, CORES.up, 240), fill: true, tension: 0.3,
          borderWidth: 2.5, pointRadius: historico.length <= 14 ? 4 : 0, pointHoverRadius: 5,
          pointBackgroundColor: "#FFFFFF", pointBorderColor: CORES.up, pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: { x: eixoX({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 8 } }), y: eixoY() },
        plugins: { legend: { display: false }, tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + moeda(c.parsed.y); } } }) }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Barras horizontais (saldo por banco, gastos por banco)
  // ---------------------------------------------------------------------
  function renderSaldoBancos(canvasId, bancos) {
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    instancias[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: bancos.map(function (b) { return b.nome; }),
        datasets: [{ data: bancos.map(function (b) { return b.saldoAtual; }), backgroundColor: "rgba(0,229,255,0.22)", borderColor: bancos.map(function (b) { return b.cor || CORES.cy; }), borderWidth: 1.5, borderRadius: 2, maxBarThickness: 22 }]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        scales: { x: eixoY({ grid: { color: CORES.grade } }), y: eixoX() },
        plugins: { legend: { display: false }, tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + moeda(c.parsed.x); } } }) }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Preço de uma ação (detalhe do ativo)
  // ---------------------------------------------------------------------
  function renderPrecoAcao(canvasId, historicoPrecos, precoMedio) {
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    var datasets = [{
      label: "Preço", data: historicoPrecos.map(function (p) { return p.preco; }),
      borderColor: CORES.cy, backgroundColor: gradiente(ctx, CORES.cy, 260), fill: true,
      tension: 0.25, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
    }];
    if (precoMedio > 0) {
      datasets.push({ label: "Preço médio", data: historicoPrecos.map(function () { return precoMedio; }), borderColor: CORES.laranja, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false });
    }
    instancias[canvasId] = new Chart(ctx, {
      type: "line",
      data: { labels: historicoPrecos.map(function (p) { return new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""); }), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        scales: { x: eixoX({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 6 } }), y: eixoY({ ticks: { color: CORES.texto, font: fonte(10.5), callback: function (v) { return "R$ " + v.toFixed(2); } } }) },
        plugins: {
          legend: { position: "top", align: "end", labels: { color: CORES.texto, font: fonte(10.5), boxWidth: 8, usePointStyle: true, pointStyle: "circle" } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": R$ " + c.parsed.y.toFixed(2); } } })
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Linhas suaves múltiplas: Renda / Despesas / Poupança por mês
  // series = [{ rotulo, valores, cor }]
  // ---------------------------------------------------------------------
  function renderLinhaMultipla(canvasId, rotulos, series, opcoes) {
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    opcoes = opcoes || {};
    instancias[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: rotulos,
        datasets: series.map(function (s) {
          return {
            label: s.rotulo, data: s.valores, borderColor: s.cor, backgroundColor: opcoes.area ? gradiente(ctx, s.cor, 200) : "transparent",
            fill: !!opcoes.area, tension: 0.45, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4,
            pointBackgroundColor: "#FFFFFF", pointBorderColor: s.cor, borderDash: s.tracejado ? [5, 4] : []
          };
        })
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        scales: { x: eixoX(), y: eixoY() },
        plugins: {
          legend: { display: !opcoes.semLegenda, position: "top", align: "start", labels: { color: CORES.texto, font: fonte(11), boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle" } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": " + moeda(c.parsed.y); } } })
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Barras com linhas de objetivo (ex.: poupança % da renda vs metas)
  // ---------------------------------------------------------------------
  function renderBarrasObjetivo(canvasId, rotulos, valores, objInf, objSup, cor) {
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    var datasets = [{ type: "bar", label: "Poupança % da renda", data: valores, backgroundColor: cor || CORES.azul, borderRadius: 3, maxBarThickness: 26, order: 2 }];
    if (objSup != null) datasets.push({ type: "line", label: "obj. sup. " + objSup + "%", data: valores.map(function () { return objSup; }), borderColor: CORES.texto, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, order: 1 });
    if (objInf != null) datasets.push({ type: "line", label: "obj. inf. " + objInf + "%", data: valores.map(function () { return objInf; }), borderColor: CORES.texto, borderDash: [2, 3], borderWidth: 1.5, pointRadius: 0, order: 1 });
    instancias[canvasId] = new Chart(ctx, {
      data: { labels: rotulos, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        scales: { x: eixoX(), y: eixoY({ ticks: { color: CORES.texto, font: fonte(10.5), callback: function (v) { return v + "%"; } }, beginAtZero: true }) },
        plugins: {
          legend: { position: "top", align: "end", labels: { color: CORES.texto, font: fonte(10.5), boxWidth: 8, usePointStyle: true, pointStyle: "circle" } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": " + Number(c.parsed.y).toFixed(1).replace(".", ",") + "%"; } } })
        }
      }
    });
  }

  global.Graficos = {
    CORES: CORES,
    PALETA_CATEGORIAS: PALETA_CATEGORIAS,
    destruir: destruir,
    renderReceitasDespesas: renderReceitasDespesas,
    renderDoughnutGenerico: renderDoughnutGenerico,
    renderEvolucaoPatrimonio: renderEvolucaoPatrimonio,
    renderSaldoBancos: renderSaldoBancos,
    renderPrecoAcao: renderPrecoAcao,
    renderLinhaMultipla: renderLinhaMultipla,
    renderBarrasObjetivo: renderBarrasObjetivo
  };
})(window);
