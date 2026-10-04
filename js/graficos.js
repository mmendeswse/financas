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
  function renderReceitasDespesas(canvasId, serie, opcoes) {
    opcoes = opcoes || {};
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
        onClick: function (evt, elementos) {
          if (opcoes.aoClicar && elementos && elementos.length) opcoes.aoClicar(serie[elementos[0].index]);
        },
        onHover: function (evt, elementos) {
          if (evt && evt.native && evt.native.target) evt.native.target.style.cursor = (opcoes.aoClicar && elementos.length) ? "pointer" : "default";
        },
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
        onClick: function (evt, elementos) {
          if (opcoes.aoClicar && elementos && elementos.length) opcoes.aoClicar(itens[elementos[0].index]);
        },
        onHover: function (evt, elementos) {
          if (evt && evt.native && evt.native.target) evt.native.target.style.cursor = (opcoes.aoClicar && elementos.length) ? "pointer" : "default";
        },
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
  // agrupa a série por mês, ficando com o último valor de cada mês, para
  // o eixo mostrar "abr, mai, jun…" como no gráfico de receitas x despesas
  function porMes(historico) {
    var mapa = {};
    historico.forEach(function (p) {
      var chave = String(p.data).slice(0, 7);
      if (!mapa[chave] || p.data >= mapa[chave].data) mapa[chave] = p;
    });
    return Object.keys(mapa).sort().map(function (k) { return mapa[k]; });
  }

  function rotuloMes(dataISO) {
    var d = new Date(dataISO + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  }

  function renderEvolucaoPatrimonio(canvasId, historico, opcoes) {
    opcoes = opcoes || {};
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    var serie = porMes(historico);
    // com menos de dois meses de registro, mantém os pontos originais
    var porData = serie.length < 2;
    if (porData) serie = historico;
    // posição do maior valor do período (o "pico")
    var iPico = 0;
    serie.forEach(function (p, i) { if (p.valor > serie[iPico].valor) iPico = i; });
    instancias[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: serie.map(function (p) {
          return porData
            ? new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
            : rotuloMes(p.data);
        }),
        datasets: [{
          label: "Patrimônio líquido",
          data: serie.map(function (p) { return p.valor; }),
          borderColor: CORES.azul, backgroundColor: gradiente(ctx, CORES.azul, 240), fill: true, tension: 0.3,
          borderWidth: 2.5,
          // pico em dourado; os demais pontos em verde quando o patrimônio subiu
          // em relação ao mês anterior e em vermelho quando caiu
          pointRadius: serie.map(function (p, i) { return i === iPico ? 7 : (serie.length <= 14 ? 4.5 : 2.5); }),
          pointHoverRadius: 8,
          pointBackgroundColor: serie.map(function (p, i) { return i === iPico ? "#FFD633" : (i === 0 ? "#FFFFFF" : (p.valor >= serie[i - 1].valor ? CORES.up : CORES.down)); }),
          pointBorderColor: serie.map(function (p, i) { return i === iPico ? "#FFD633" : "#0B1420"; }),
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        onClick: function (evt, elementos) {
          if (opcoes.aoClicar && elementos && elementos.length) opcoes.aoClicar(serie[elementos[0].index], serie, iPico);
        },
        onHover: function (evt, elementos) {
          if (evt && evt.native && evt.native.target) evt.native.target.style.cursor = (opcoes.aoClicar && elementos.length) ? "pointer" : "default";
        },
        scales: { x: eixoX({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 12 } }), y: eixoY() },
        plugins: { legend: { display: false }, tooltip: tooltipPadrao({ callbacks: {
          label: function (c) { return " Patrimônio: " + moeda(c.parsed.y) + (c.dataIndex === iPico ? "  🏆 pico" : ""); },
          afterLabel: function (c) {
            if (c.dataIndex === 0) return " Clique para ver os detalhes";
            var dif = serie[c.dataIndex].valor - serie[c.dataIndex - 1].valor;
            var pct = serie[c.dataIndex - 1].valor ? (dif / Math.abs(serie[c.dataIndex - 1].valor)) * 100 : 0;
            return " No mês: " + (dif >= 0 ? "+" : "−") + moeda(Math.abs(dif)) + " (" + (dif >= 0 ? "+" : "−") + Math.abs(pct).toFixed(1).replace(".", ",") + "%)\n Clique para ver os detalhes";
          } } }) }
      },
      plugins: [{
        // etiqueta dourada em cima do pico
        id: "rotuloPico",
        afterDatasetsDraw: function (grafico) {
          var pt = grafico.getDatasetMeta(0).data[iPico]; if (!pt) return;
          var c = grafico.ctx, txt = "🏆 Pico " + moeda(serie[iPico].valor), ca = grafico.chartArea;
          c.save(); c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif";
          var larg = c.measureText(txt).width + 12, alt = 19;
          var x = Math.min(ca.right - larg, Math.max(ca.left, pt.x - larg / 2));
          var y = pt.y - 14 - alt; if (y < ca.top) y = pt.y + 12;
          c.fillStyle = "#0B1420"; c.fillRect(x, y, larg, alt);
          c.fillStyle = "rgba(255,214,51,0.14)"; c.fillRect(x, y, larg, alt);
          c.strokeStyle = "#FFD633"; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, larg - 1, alt - 1);
          c.fillStyle = "#FFD633"; c.textBaseline = "middle"; c.fillText(txt, x + 6, y + alt / 2 + 0.5);
          c.restore();
        }
      }]
    });
  }

  // ---------------------------------------------------------------------
  // Barras horizontais (saldo por banco, gastos por banco)
  // ---------------------------------------------------------------------
  function renderSaldoBancos(canvasId, bancos, opcoes) {
    opcoes = opcoes || {};
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    var total = bancos.reduce(function (t, b) { return t + Math.abs(Number(b.saldoAtual || 0)); }, 0) || 1;
    // escreve a porcentagem dentro da barra, como nas barras do dashboard
    var pctDentro = {
      id: "pctDentro",
      afterDatasetsDraw: function (grafico) {
        var meta = grafico.getDatasetMeta(0), c = grafico.ctx;
        c.save();
        c.font = "800 11px 'Segoe UI', Roboto, sans-serif";
        c.textBaseline = "middle";
        // o percentual fica sempre no fim da faixa da coluna, em branco,
        // para ficar legível mesmo quando a barra é muito curta
        meta.data.forEach(function (barra, i) {
          var v = Number(bancos[i].saldoAtual) || 0;
          var txt = ((Math.abs(v) / total) * 100).toFixed(1).replace(".", ",") + "%";
          c.fillStyle = "#FFFFFF";
          if (v < 0) { c.textAlign = "left"; c.fillText(txt, grafico.chartArea.left + 6, barra.y); }
          else { c.textAlign = "right"; c.fillText(txt, grafico.chartArea.right - 6, barra.y); }
        });
        c.restore();
      }
    };
    instancias[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: bancos.map(function (b) { return b.nome; }),
        datasets: [{
          data: bancos.map(function (b) { return b.saldoAtual; }),
          backgroundColor: bancos.map(function (b) { return Number(b.saldoAtual) < 0 ? CORES.down : (b.cor || CORES.cy); }),
          borderColor: bancos.map(function (b) { return Number(b.saldoAtual) < 0 ? CORES.down : (b.cor || CORES.cy); }),
          borderWidth: 1, borderRadius: 3, maxBarThickness: 26
        }]
      },
      options: {
        indexAxis: "y",
        onClick: function (evt, elementos) {
          if (opcoes.aoClicar && elementos && elementos.length) opcoes.aoClicar(bancos[elementos[0].index]);
        },
        onHover: function (evt, elementos) {
          if (evt && evt.native && evt.native.target) evt.native.target.style.cursor = (opcoes.aoClicar && elementos.length) ? "pointer" : "default";
        }, responsive: true, maintainAspectRatio: false,
        scales: {
          x: eixoY({
            beginAtZero: true,
            // linha do zero destacada, para a barra negativa ficar clara
            grid: { color: function (c) { return c.tick && c.tick.value === 0 ? CORES.texto : CORES.grade; },
                    lineWidth: function (c) { return c.tick && c.tick.value === 0 ? 1.5 : 1; } }
          }),
          y: eixoX()
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + moeda(c.parsed.x) + " · " + ((c.parsed.x / total) * 100).toFixed(1).replace(".", ",") + "%"; } } })
        }
      },
      plugins: [pctDentro]
    });
  }

  // ---------------------------------------------------------------------
  // Preço de uma ação (detalhe do ativo)
  // ---------------------------------------------------------------------
  function renderPrecoAcao(canvasId, historicoPrecos, precoMedio, precoAtual, opcoes) {
    opcoes = opcoes || {};
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    // no gráfico de uma ação, a linha principal se chama "Resultado" e fica verde
    // (o gráfico do dólar, que usa esta mesma função, continua "Preço" em azul)
    // na ação, a legenda "Resultado" fica verde com lucro e vermelha com prejuízo
    // (preço atual contra o preço de compra) — a mesma regra da caixa de diferença
    var ehAcao = precoAtual > 0;
    var corLinha = !ehAcao ? CORES.cy : (precoMedio > 0 && precoAtual < precoMedio ? CORES.down : CORES.up);
    var datasets = [{
      label: ehAcao ? "Resultado" : "Preço", data: historicoPrecos.map(function (p) { return p.preco; }),
      borderColor: CORES.cy, backgroundColor: gradiente(ctx, CORES.cy, Math.max(260, (ctx.canvas.parentNode && ctx.canvas.parentNode.clientHeight) || 260)), fill: true,
      corLegenda: corLinha,   // bolinha da legenda "Resultado": verde com lucro, vermelha com prejuízo
      tension: 0.25, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
    }];
    if (opcoes.linhaAtual > 0) {
      // gráfico do dólar: linha pontilhada amarela na altura do valor atual
      datasets.push({ label: "Valor Atual", data: historicoPrecos.map(function () { return opcoes.linhaAtual; }), borderColor: "#FFD633", backgroundColor: "transparent", borderDash: [3, 4], borderWidth: 1.6, pointRadius: 0, pointHoverRadius: 0, fill: false });
    }
    if (precoAtual > 0) {
      // linha tracejada no preço atual, na mesma cor da linha de preço
      datasets.push({ label: "Preço Atual", data: historicoPrecos.map(function () { return precoAtual; }), borderColor: CORES.cy, backgroundColor: "transparent", borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false });
    }
    if (precoMedio > 0) {
      datasets.push({ label: "Preço Compra", data: historicoPrecos.map(function () { return precoMedio; }), borderColor: CORES.laranja, borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false });
    }
    instancias[canvasId] = new Chart(ctx, {
      type: "line",
      data: { labels: historicoPrecos.map(function (p) { return new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        // gráfico do dólar: tocar na área do gráfico troca para a visão em velas
        onClick: opcoes.aoClicar ? function (evt, el, ch) { if (dentroDaArea(ch, evt)) opcoes.aoClicar(); } : undefined,
        onHover: opcoes.aoClicar ? function (evt, el, ch) { evt.native.target.style.cursor = dentroDaArea(ch, evt) ? "pointer" : "default"; } : undefined,
        scales: { x: eixoX({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 6 } }), y: eixoY({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 14, callback: function (v) { return "R$ " + v.toFixed(2); } } }) },
        plugins: {
          legend: { position: "top", align: "end", labels: { color: CORES.texto, font: fonte(10.5), boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle",
            // a bolinha de cada item usa a cor da própria linha (a área azul não "vaza" para o Retorno)
            generateLabels: function (ch) {
              return Chart.defaults.plugins.legend.labels.generateLabels(ch).map(function (l) {
                var ds = ch.data.datasets[l.datasetIndex];
                // mesmo estilo da legenda de Receitas x despesas: bolinha com a cor
                // translúcida por dentro e contorno fino na cor que o item representa
                var cor = (ds && (ds.corLegenda || ds.borderColor)) || l.strokeStyle;
                var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(cor);
                l.fillStyle = m ? "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + ",0.28)" : cor;
                l.strokeStyle = cor; l.lineDash = []; l.lineWidth = 1.5;
                return l;
              });
            } } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": R$ " + c.parsed.y.toFixed(2); } } })
        }
      },
      plugins: (opcoes.linhaAtual > 0 ? [{
        // gráfico do dólar: caixa amarela com o valor atual, na ponta da linha pontilhada
        id: "rotuloValorAtual",
        afterDatasetsDraw: function (grafico) {
          var ca = grafico.chartArea;
          var y = grafico.scales.y.getPixelForValue(opcoes.linhaAtual);
          if (y < ca.top || y > ca.bottom) return;
          // logo acima da linha (ou abaixo, se não couber), sem cobrir o encontro das linhas
          y = (y - 24 >= ca.top) ? y - 16 : y + 16;
          var c = grafico.ctx, txt = "📍 Atual " + moeda(opcoes.linhaAtual);
          c.save();
          c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif";
          var larg = c.measureText(txt).width + 12, x = ca.right - larg - 18;
          c.fillStyle = "#0B1420"; c.fillRect(x, y - 10, larg, 20);
          c.fillStyle = "rgba(255,214,51,0.14)"; c.fillRect(x, y - 10, larg, 20);
          c.strokeStyle = "#FFD633"; c.lineWidth = 1; c.strokeRect(x + 0.5, y - 9.5, larg - 1, 19);
          c.fillStyle = "#FFD633"; c.textBaseline = "middle"; c.fillText(txt, x + 6, y + 0.5);
          c.restore();
        }
      }] : []).concat(precoMedio > 0 && precoAtual > 0 ? [{
        // caixa com a diferença entre o preço atual e o valor de compra,
        // entre as duas linhas tracejadas, ligada a elas por um traço vertical
        id: "diferencaCompra",
        afterDatasetsDraw: function (grafico) {
          var ca = grafico.chartArea, esc = grafico.scales.y;
          var yA = esc.getPixelForValue(precoAtual), yC = esc.getPixelForValue(precoMedio);
          var topo = Math.max(ca.top, Math.min(yA, yC)), base = Math.min(ca.bottom, Math.max(yA, yC));
          var dif = precoAtual - precoMedio, pctDif = precoMedio ? (dif / precoMedio) * 100 : 0;
          var cor = dif >= 0 ? CORES.up : CORES.down;
          var sinal = dif >= 0 ? "+" : "−";
          var pctTxt = " (" + sinal + Math.abs(pctDif).toFixed(1).replace(".", ",") + "%)";
          // 1ª linha: resultado total (diferença × cotas); 2ª: diferença por cota × quantidade
          var qtd = Number(opcoes.quantidade) || 0;
          // ícone de destaque na frente, como nos marcos da Evolução patrimonial
          var icone = dif >= 0 ? "📈 " : "📉 ";
          var txt = icone + (qtd > 0 ? sinal + moeda(Math.abs(dif * qtd)) + pctTxt : sinal + moeda(Math.abs(dif)) + pctTxt);
          var txt2 = qtd > 0 ? sinal + moeda(Math.abs(dif)) + " por cota × " + qtd.toLocaleString("pt-BR") + (qtd === 1 ? " cota" : " cotas") : "";
          var c = grafico.ctx;
          c.save();
          c.font = "700 11px 'Segoe UI', Roboto, sans-serif";
          var larg1 = c.measureText(txt).width;
          c.font = "600 9.5px 'Segoe UI', Roboto, sans-serif";
          var larg2 = txt2 ? c.measureText(txt2).width : 0;
          var larg = Math.max(larg1, larg2) + 16, alt = txt2 ? 34 : 22;
          var xc = ca.left + ca.width * 0.62;
          // traço vertical entre as linhas
          c.strokeStyle = cor; c.lineWidth = 1.2; c.setLineDash([3, 3]);
          c.beginPath(); c.moveTo(xc, topo); c.lineTo(xc, base); c.stroke(); c.setLineDash([]);
          c.fillStyle = cor;
          [topo, base].forEach(function (yy) { c.beginPath(); c.arc(xc, yy, 2.5, 0, Math.PI * 2); c.fill(); });
          // caixa no meio do caminho
          var ym = Math.min(ca.bottom - alt / 2, Math.max(ca.top + alt / 2, (topo + base) / 2));
          var x = xc - larg / 2;
          c.fillStyle = "#0B1420"; c.fillRect(x, ym - alt / 2, larg, alt);
          c.fillStyle = dif >= 0 ? "rgba(34,227,154,0.14)" : "rgba(255,77,122,0.16)"; c.fillRect(x, ym - alt / 2, larg, alt);
          c.strokeStyle = cor; c.lineWidth = 1; c.strokeRect(x + 0.5, ym - alt / 2 + 0.5, larg - 1, alt - 1);
          c.fillStyle = cor; c.textBaseline = "middle"; c.textAlign = "center";
          if (txt2) {
            c.font = "700 11px 'Segoe UI', Roboto, sans-serif"; c.fillText(txt, xc, ym - 6);
            c.font = "600 9.5px 'Segoe UI', Roboto, sans-serif"; c.globalAlpha = 0.85; c.fillText(txt2, xc, ym + 8); c.globalAlpha = 1;
          } else {
            c.font = "700 11px 'Segoe UI', Roboto, sans-serif"; c.fillText(txt, xc, ym + 0.5);
          }
          c.restore();
        }
      }] : []).concat(precoAtual > 0 ? [{
        id: "rotuloAtual",
        afterDatasetsDraw: function (grafico) {
          var ca = grafico.chartArea;
          var y = grafico.scales.y.getPixelForValue(precoAtual);
          if (y < ca.top || y > ca.bottom) return;
          // se a linha de compra estiver muito perto, afasta a etiqueta para não encavalar
          if (precoMedio > 0) {
            var yC = grafico.scales.y.getPixelForValue(precoMedio);
            if (Math.abs(y - yC) < 22) y = y <= yC ? yC - 22 : yC + 22;
            y = Math.max(ca.top + 10, Math.min(ca.bottom - 10, y));
          }
          var c = grafico.ctx, txt = "📍 Atual " + moeda(precoAtual);
          c.save();
          c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif";
          var larg = c.measureText(txt).width + 12, x = ca.right - larg - 4;
          c.fillStyle = "#0B1420"; c.fillRect(x, y - 10, larg, 20);
          c.fillStyle = "rgba(0,229,255,0.14)"; c.fillRect(x, y - 10, larg, 20);
          c.strokeStyle = CORES.cy; c.lineWidth = 1; c.strokeRect(x + 0.5, y - 9.5, larg - 1, 19);
          c.fillStyle = CORES.cy; c.textBaseline = "middle"; c.fillText(txt, x + 6, y + 0.5);
          c.restore();
        }
      }] : []).concat(precoMedio > 0 ? [{
        // etiqueta "Compra R$ x" encostada na linha, na borda direita
        id: "rotuloCompra",
        afterDatasetsDraw: function (grafico) {
          var y = grafico.scales.y.getPixelForValue(precoMedio);
          if (y < grafico.chartArea.top || y > grafico.chartArea.bottom) return;
          var c = grafico.ctx, txt = "🛒 Compra " + moeda(precoMedio);
          c.save();
          c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif";
          var larg = c.measureText(txt).width + 12, x = grafico.chartArea.right - larg - 4;
          // fundo opaco: a linha tracejada não passa por cima do texto
          c.fillStyle = "#0B1420"; c.fillRect(x, y - 10, larg, 20);
          c.fillStyle = "rgba(255,138,61,0.16)"; c.fillRect(x, y - 10, larg, 20);
          c.strokeStyle = CORES.laranja; c.lineWidth = 1; c.strokeRect(x + 0.5, y - 9.5, larg - 1, 19);
          c.fillStyle = CORES.laranja; c.textBaseline = "middle"; c.fillText(txt, x + 6, y + 0.5);
          c.restore();
        }
      }] : [])
    });
  }

  function dentroDaArea(ch, evt) {
    var ca = ch.chartArea;
    return ca && evt.x >= ca.left && evt.x <= ca.right && evt.y >= ca.top && evt.y <= ca.bottom;
  }

  // ---------------------------------------------------------------------
  // Velas diárias (candlestick) — visão alternativa do gráfico do dólar
  // serie = [{ data, abertura, maxima, minima, preco }]  (preco = fechamento)
  // Cada vela é uma barra flutuante [abertura, fechamento]; o pavio
  // (mínima → máxima) é desenhado por um plugin antes das barras.
  // ---------------------------------------------------------------------
  function renderVelas(canvasId, serieTotal, opcoes) {
    opcoes = opcoes || {};
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    var canvas = ctx.canvas;
    var alta = function (p) { return p.preco >= p.abertura; };
    var cor = function (p) { return alta(p) ? CORES.up : CORES.down; };
    var casas = opcoes.casas || 4;   // dólar com 4 casas, ações com 2
    var f4 = function (v) { return Number(v).toFixed(casas); };
    var rotulo = function (p) { return new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); };

    // janela visível [ini, fim) — o zoom e o arrasto mudam só a janela;
    // a escala de preço (eixo Y) acompanha as velas que estão na tela
    var total = serieTotal.length;
    var MIN_VELAS = Math.min(5, total);
    var fim = total;
    var ini = Math.max(0, total - Math.max(MIN_VELAS, Math.min(total, opcoes.visiveis || total)));
    var serie = [];        // velas visíveis (usadas pelos plugins e pelo tooltip)
    var cursor = null;     // posição do mouse/dedo para a cruz
    var noticiasPorVela = {};   // índice da vela (na série toda) → notícias do dia
    var marcas = [];            // posição dos "N" desenhados (para o clique)

    function escala() {
      var mn = Math.min.apply(null, serie.map(function (p) { return p.minima; }));
      var mx = Math.max.apply(null, serie.map(function (p) { return p.maxima; }));
      var folga = (mx - mn) * 0.08 || mx * 0.01;
      // com notícias, sobra mais espaço em cima para o "N" acima das velas
      var folgaTopo = Object.keys(noticiasPorVela).length ? folga * 2 : folga;
      return { min: mn - folga, max: mx + folgaTopo, faixa: mx - mn };
    }
    function corpos(faixa) {
      return serie.map(function (p) {
        // corpo mínimo visível quando abertura = fechamento (doji)
        var a = p.abertura, f = p.preco;
        if (Math.abs(a - f) < faixa * 0.004) f = a + faixa * 0.004;
        return [Math.min(a, f), Math.max(a, f)];
      });
    }
    function aplicarJanela(grafico) {
      fecharNoticia();
      serie = serieTotal.slice(ini, fim);
      var e = escala();
      grafico.data.labels = serie.map(rotulo);
      var ds = grafico.data.datasets[0];
      ds.data = corpos(e.faixa);
      ds.backgroundColor = serie.map(cor); ds.borderColor = serie.map(cor);
      grafico.options.scales.y.suggestedMin = e.min; grafico.options.scales.y.suggestedMax = e.max;
    }

    // linha pontilhada horizontal que vai da borda esquerda até encostar na
    // caixa do valor, na borda direita (como nos gráficos de corretora)
    function etiqueta(c, ca, y, txt, fundo, texto) {
      c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif";
      var larg = c.measureText(txt).width + 10;
      c.fillStyle = fundo; c.fillRect(ca.right + 2, y - 9.5, larg, 18);
      c.fillStyle = texto; c.textBaseline = "middle"; c.fillText(txt, ca.right + 7, y);
    }
    function linhaComEtiqueta(id, valor, corLinha, traco) {
      if (!(valor > 0)) return { id: id };
      var posicao = function (grafico) {
        var ca = grafico.chartArea, y = Math.round(grafico.scales.y.getPixelForValue(valor)) + 0.5;
        return (y < ca.top || y > ca.bottom) ? null : { ca: ca, y: y };
      };
      return {
        id: id,
        beforeDatasetsDraw: function (grafico) {
          var p = posicao(grafico); if (!p) return;
          var c = grafico.ctx;
          c.save();
          c.strokeStyle = corLinha; c.lineWidth = 1; c.setLineDash(traco);
          c.beginPath(); c.moveTo(p.ca.left, p.y); c.lineTo(p.ca.right + 2, p.y); c.stroke();
          c.restore();
        },
        afterDatasetsDraw: function (grafico) {
          var p = posicao(grafico); if (!p) return;
          var c = grafico.ctx;
          c.save(); etiqueta(c, p.ca, p.y, f4(valor), corLinha, "#0B1420"); c.restore();
        }
      };
    }

    var grafico = instancias[canvasId] = new Chart(ctx, {
      type: "bar",
      data: { labels: [], datasets: [{
        label: "Velas", data: [], backgroundColor: [], borderColor: [], borderWidth: 1,
        borderSkipped: false, barPercentage: 0.7, categoryPercentage: 0.9, maxBarThickness: 40
      }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 22 } },   // espaço para o cabeçalho Abr/Máx/Mín/Fch
        onClick: function (evt, el, ch) {
          if (arrastou) return;
          var m = marcaEm(evt.x, evt.y);
          if (m) { abrirNoticia(m); return; }      // tocar no "N" abre o resumo
          if (popover) { fecharNoticia(); return; }
          if (opcoes.aoClicar && dentroDaArea(ch, evt)) opcoes.aoClicar();
        },
        onHover: function (evt, el, ch) { evt.native.target.style.cursor = marcaEm(evt.x, evt.y) ? "pointer" : (dentroDaArea(ch, evt) ? "crosshair" : "default"); },
        scales: {
          x: eixoX({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 8, maxRotation: 0 } }),
          y: eixoY({ position: "right", beginAtZero: false,
            ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 12, callback: function (v) { return f4(v); } } })
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }   // os valores aparecem no cabeçalho e na cruz
        }
      },
      plugins: [{
        // pavio: linha fina da mínima à máxima, atrás do corpo da vela
        id: "pavios",
        beforeDatasetsDraw: function (g) {
          var meta = g.getDatasetMeta(0), y = g.scales.y, c = g.ctx;
          c.save();
          c.lineWidth = 1;
          meta.data.forEach(function (barra, i) {
            var p = serie[i]; if (!p) return;
            c.strokeStyle = cor(p);
            c.beginPath();
            c.moveTo(Math.round(barra.x) + 0.5, y.getPixelForValue(p.maxima));
            c.lineTo(Math.round(barra.x) + 0.5, y.getPixelForValue(p.minima));
            c.stroke();
          });
          c.restore();
        }
      }, {
        // cabeçalho com Abr / Máx / Mín / Fch da vela sob a cruz (ou da última)
        id: "cabecalhoOHLC",
        afterDatasetsDraw: function (g) {
          var i = cursor ? g.scales.x.getValueForPixel(cursor.x) : serie.length - 1;
          var p = serie[Math.max(0, Math.min(serie.length - 1, Math.round(i)))]; if (!p) return;
          var c = g.ctx, x = g.chartArea.left + 4, y = g.chartArea.top - 12;
          var partes = [["Abr", p.abertura], ["Máx", p.maxima], ["Mín", p.minima], ["Fch", p.preco]];
          c.save();
          c.textBaseline = "middle";
          partes.forEach(function (par) {
            c.font = "600 10.5px 'Segoe UI', Roboto, sans-serif"; c.fillStyle = CORES.texto;
            c.fillText(par[0], x, y); x += c.measureText(par[0] + " ").width;
            c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif"; c.fillStyle = cor(p);
            var v = f4(par[1]); c.fillText(v, x, y); x += c.measureText(v).width + 10;
          });
          c.restore();
        }
      },
      // valor atual em azul e, nas ações, o preço de compra em laranja
      linhaComEtiqueta("linhaValorAtual", opcoes.linhaAtual, "#38B6FF", [3, 3]),
      linhaComEtiqueta("linhaCompra", opcoes.linhaCompra, CORES.laranja, [6, 4]),
      {
        // "N" em cima das velas com variação forte que tiveram notícia no dia
        id: "marcasNoticias",
        afterDatasetsDraw: function (g) {
          marcas = [];
          var meta = g.getDatasetMeta(0), c = g.ctx, ca = g.chartArea, algum = false;
          c.save();
          c.font = "800 9.5px 'Segoe UI', Roboto, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
          meta.data.forEach(function (barra, i) {
            var lista = noticiasPorVela[ini + i]; if (!lista) return;
            algum = true;
            var x = Math.round(barra.x), y = Math.max(ca.top - 6, g.scales.y.getPixelForValue(serie[i].maxima) - 14);
            c.fillStyle = "#1E88FF"; c.beginPath(); c.arc(x, y, 7.5, 0, Math.PI * 2); c.fill();
            c.fillStyle = "#FFFFFF"; c.fillText("N", x, y + 0.5);
            marcas.push({ x: x, y: y, idx: ini + i });
          });
          if (algum) {
            // legenda no canto direito do cabeçalho
            var txt = "Notícias", xr = ca.right, yl = ca.top - 12;
            c.font = "600 10.5px 'Segoe UI', Roboto, sans-serif"; c.textAlign = "right";
            c.fillStyle = CORES.texto; c.fillText(txt, xr, yl);
            var xc = xr - c.measureText(txt).width - 11;
            c.fillStyle = "#1E88FF"; c.beginPath(); c.arc(xc, yl, 6.5, 0, Math.PI * 2); c.fill();
            c.font = "800 8.5px 'Segoe UI', Roboto, sans-serif"; c.textAlign = "center";
            c.fillStyle = "#FFFFFF"; c.fillText("N", xc, yl + 0.5);
          }
          c.restore();
        }
      },
      {
        // cruz: linhas tracejadas na posição do mouse, com o preço no eixo
        // da direita e a data embaixo (o valor acompanha o zoom)
        id: "cruz",
        afterEvent: function (g, args) {
          var e = args.event;
          if (e.type === "mouseout") cursor = null;
          else if (e.type === "mousemove") cursor = dentroDaArea(g, e) ? { x: e.x, y: e.y } : null;
          else return;
          args.changed = true;
        },
        afterDraw: function (g) {
          if (!cursor) return;
          var ca = g.chartArea, c = g.ctx;
          var i = Math.max(0, Math.min(serie.length - 1, Math.round(g.scales.x.getValueForPixel(cursor.x))));
          var x = Math.round(g.scales.x.getPixelForValue(i)) + 0.5, y = Math.round(cursor.y) + 0.5;
          c.save();
          c.strokeStyle = "rgba(143,163,179,0.7)"; c.lineWidth = 1; c.setLineDash([4, 4]);
          c.beginPath(); c.moveTo(ca.left, y); c.lineTo(ca.right + 2, y); c.moveTo(x, ca.top); c.lineTo(x, ca.bottom); c.stroke();
          c.setLineDash([]);
          etiqueta(c, ca, y, f4(g.scales.y.getValueForPixel(cursor.y)), "#3A4B5C", "#EDF2FA");
          if (serie[i]) {
            var txt = rotulo(serie[i]);
            c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif";
            var larg = c.measureText(txt).width + 10;
            var xl = Math.max(ca.left, Math.min(ca.right - larg, x - larg / 2));
            c.fillStyle = "#3A4B5C"; c.fillRect(xl, ca.bottom + 2, larg, 18);
            c.fillStyle = "#EDF2FA"; c.textBaseline = "middle"; c.fillText(txt, xl + 5, ca.bottom + 11);
          }
          c.restore();
        }
      }]
    });
    aplicarJanela(grafico);
    grafico.update("none");

    // ---- notícias ------------------------------------------------------
    function marcaEm(x, y) {
      for (var k = 0; k < marcas.length; k++) {
        if (Math.abs(marcas[k].x - x) <= 10 && Math.abs(marcas[k].y - y) <= 10) return marcas[k];
      }
      return null;
    }
    var popover = null;
    function fecharNoticia() {
      if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
      popover = null;
    }
    function escHtml(t) { return String(t).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
    function abrirNoticia(m) {
      fecharNoticia();
      var lista = noticiasPorVela[m.idx] || [];
      if (!lista.length || !canvas.parentNode) return;
      var quando = new Date(lista[0].quando);
      var dataTxt = quando.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }) + ", " +
        quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      popover = document.createElement("div");
      popover.className = "popover-noticias";
      popover.innerHTML = '<div class="pn-topo"><b>Notícias</b><span>' + escHtml(dataTxt) + '</span></div>' +
        lista.slice(0, 3).map(function (n) {
          return '<a href="' + escHtml(n.url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(n.titulo) +
            (n.fonte ? '<small>' + escHtml(n.fonte) + '</small>' : '') + '</a>';
        }).join("");
      popover.addEventListener("click", function (e) { e.stopPropagation(); });
      canvas.parentNode.appendChild(popover);
      // logo abaixo do "N", sem sair da área do gráfico
      var area = canvas.parentNode, larg = popover.offsetWidth, alt = popover.offsetHeight;
      var x = canvas.offsetLeft + m.x - larg / 2, y = canvas.offsetTop + m.y + 14;
      if (y + alt > area.clientHeight) y = Math.max(0, canvas.offsetTop + m.y - 14 - alt);
      popover.style.left = Math.max(4, Math.min(area.clientWidth - larg - 4, x)) + "px";
      popover.style.top = y + "px";
      // clicar fora (fora do gráfico) fecha o resumo
      var aberto = popover;
      setTimeout(function () {
        document.addEventListener("click", function fora(e) {
          if (popover !== aberto) { document.removeEventListener("click", fora, true); return; }
          if (e.target === canvas || aberto.contains(e.target)) return;
          document.removeEventListener("click", fora, true);
          fecharNoticia();
        }, true);
      }, 0);
    }
    // associa cada notícia à vela do mesmo dia (ou à próxima vela, até 3
    // dias depois — fim de semana e feriado); só ficam as velas que
    // variaram pelo menos "limiar" % em relação ao fechamento anterior
    grafico.$definirNoticias = function (artigos, limiar) {
      noticiasPorVela = {};
      var dia = function (iso) { return new Date(iso + "T00:00:00").getTime(); };
      (artigos || []).forEach(function (a) {
        for (var i = 0; i < total; i++) {
          if (serieTotal[i].data < a.data) continue;
          if ((dia(serieTotal[i].data) - dia(a.data)) / 86400000 > 3) break;
          var ant = i > 0 ? serieTotal[i - 1].preco : serieTotal[i].abertura;
          var pct = ant ? Math.abs(serieTotal[i].preco / ant - 1) * 100 : 0;
          if (pct >= (limiar || 0)) (noticiasPorVela[i] = noticiasPorVela[i] || []).push(a);
          break;
        }
      });
      Object.keys(noticiasPorVela).forEach(function (k) { noticiasPorVela[k].sort(function (a, b) { return a.quando < b.quando ? 1 : -1; }); });
      aplicarJanela(grafico); grafico.update("none");
    };

    // ---- zoom e arrasto ------------------------------------------------
    // roda do mouse: aproxima/afasta mantendo a vela sob o mouse no lugar;
    // pinça (2 dedos) no iPad faz o mesmo; arrastar move no tempo
    var arrastou = false;
    function zoom(fator, xPixel) {
      var ca = grafico.chartArea, qtd = fim - ini;
      var nova = Math.round(Math.max(MIN_VELAS, Math.min(total, qtd * fator)));
      if (nova === qtd) return;
      var frac = Math.max(0, Math.min(1, (xPixel - ca.left) / (ca.right - ca.left)));
      var ancora = ini + frac * qtd;
      ini = Math.round(ancora - frac * nova);
      ini = Math.max(0, Math.min(total - nova, ini));
      fim = ini + nova;
      aplicarJanela(grafico); grafico.update("none");
    }
    function deslocar(velas) {
      var qtd = fim - ini;
      var novoIni = Math.max(0, Math.min(total - qtd, ini + velas));
      if (novoIni === ini) return;
      ini = novoIni; fim = ini + qtd;
      aplicarJanela(grafico); grafico.update("none");
    }
    var antigos = canvas._velasEventos;
    if (antigos) Object.keys(antigos).forEach(function (k) { canvas.removeEventListener(k, antigos[k]); });
    var dedos = {}, pinca = null, arrasto = null;
    var posX = function (e) { return e.clientX - canvas.getBoundingClientRect().left; };
    var eventos = {
      wheel: function (e) {
        if (!instancias[canvasId] || instancias[canvasId] !== grafico) return;
        e.preventDefault();
        zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, posX(e));
      },
      pointerdown: function (e) {
        try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* sem suporte */ }
        dedos[e.pointerId] = posX(e);
        var ids = Object.keys(dedos);
        arrastou = false;
        if (ids.length === 2) { pinca = { dist: Math.abs(dedos[ids[0]] - dedos[ids[1]]) || 1 }; arrasto = null; }
        else if (ids.length === 1) arrasto = { x: posX(e), sobra: 0 };
      },
      pointermove: function (e) {
        if (!(e.pointerId in dedos)) return;
        dedos[e.pointerId] = posX(e);
        var ids = Object.keys(dedos);
        if (pinca && ids.length === 2) {
          var d = Math.abs(dedos[ids[0]] - dedos[ids[1]]) || 1;
          if (Math.abs(d - pinca.dist) > 12) {
            zoom(pinca.dist / d, (dedos[ids[0]] + dedos[ids[1]]) / 2);
            pinca.dist = d; arrastou = true;
          }
        } else if (arrasto) {
          var ca = grafico.chartArea, porVela = (ca.right - ca.left) / Math.max(1, fim - ini);
          var dx = posX(e) - arrasto.x + arrasto.sobra;
          var velas = Math.trunc(dx / porVela);
          if (Math.abs(posX(e) - arrasto.x) > 4) arrastou = true;
          if (velas) { deslocar(-velas); arrasto.sobra = dx - velas * porVela; arrasto.x = posX(e); }
        }
      },
      pointerup: function (e) {
        delete dedos[e.pointerId];
        if (Object.keys(dedos).length < 2) pinca = null;
        if (!Object.keys(dedos).length) arrasto = null;
        // o clique que vem logo depois do arrasto não troca para a linha
        if (arrastou) setTimeout(function () { arrastou = false; }, 50);
      }
    };
    eventos.pointercancel = eventos.pointerup;
    Object.keys(eventos).forEach(function (k) { canvas.addEventListener(k, eventos[k], k === "wheel" ? { passive: false } : false); });
    canvas._velasEventos = eventos;
    // no iPad, deixa a página rolar na vertical; o resto (arrasto lateral e
    // pinça) fica com o gráfico
    canvas.style.touchAction = "pan-y";
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


  // ---------------------------------------------------------------------
  // Variação diária em barras verdes/vermelhas (detalhe da ação)
  // ---------------------------------------------------------------------
  function renderVariacaoDiaria(canvasId, historicoPrecos) {
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    var rot = [], val = [];
    for (var i = 1; i < historicoPrecos.length; i++) {
      var ant = historicoPrecos[i - 1].preco, at = historicoPrecos[i].preco;
      rot.push(new Date(historicoPrecos[i].data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }));
      val.push(ant > 0 ? ((at / ant) - 1) * 100 : 0);
    }
    instancias[canvasId] = new Chart(ctx, {
      type: "bar",
      data: { labels: rot, datasets: [{ data: val, backgroundColor: val.map(function (v) { return v >= 0 ? CORES.up : CORES.down; }), borderRadius: 2, maxBarThickness: 14 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: eixoX({ ticks: { color: CORES.texto, font: fonte(10), maxTicksLimit: 8 } }), y: eixoY({ ticks: { color: CORES.texto, font: fonte(10), callback: function (v) { return v.toFixed(1) + "%"; } } }) },
        plugins: { legend: { display: false }, tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.parsed.y.toFixed(2).replace(".", ",") + "%"; } } }) }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Evolução do valor de um investimento (detalhe da aplicação), com
  // linha de referência no valor aplicado
  // ---------------------------------------------------------------------
  function renderEvolucaoValor(canvasId, historico, referencia, rotuloRef, opcoes) {
    opcoes = opcoes || {};
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    var datasets = [{
      label: "Valor Líquido", data: historico.map(function (p) { return p.valor; }),
      borderColor: CORES.azul, backgroundColor: gradiente(ctx, CORES.azul, Math.max(260, (ctx.canvas.parentNode && ctx.canvas.parentNode.clientHeight) || 260)), fill: true,
      tension: 0.25, pointRadius: historico.length <= 14 ? 4 : 0, pointHoverRadius: 5,
      pointBackgroundColor: "#FFFFFF", pointBorderColor: CORES.azul, pointBorderWidth: 2, borderWidth: 2
    }];
    if (referencia > 0) {
      datasets.push({
        label: rotuloRef || "Valor Aplicado",
        data: historico.map(function () { return referencia; }),
        borderColor: CORES.laranja, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false
      });
    }
    instancias[canvasId] = new Chart(ctx, {
      type: "line",
      data: { labels: historico.map(function (p) { return new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }), datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        onClick: function (evt, elementos) {
          if (opcoes.aoClicar && elementos && elementos.length) opcoes.aoClicar(historico[elementos[0].index], elementos[0].index, historico);
        },
        onHover: function (evt, elementos) {
          if (evt && evt.native && evt.native.target) evt.native.target.style.cursor = (opcoes.aoClicar && elementos.length) ? "pointer" : "default";
        },
        // valores completos no eixo (evita vários "R$ 16k" repetidos) e mais marcações
        scales: { x: eixoX({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 6 } }),
          y: eixoY({ ticks: { color: CORES.texto, font: fonte(10.5), maxTicksLimit: 14, callback: function (v) { return moeda(v); } } }) },
        plugins: {
          legend: { position: "top", align: "end", labels: { color: CORES.texto, font: fonte(10.5), boxWidth: 8, usePointStyle: true, pointStyle: "circle" } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": " + moeda(c.parsed.y); } } })
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
    renderVelas: renderVelas,
    // notícias nas velas: artigos = [{ data, quando, titulo, url, fonte }]
    definirNoticias: function (canvasId, artigos, limiar) {
      var g = instancias[canvasId];
      if (g && g.$definirNoticias) g.$definirNoticias(artigos, limiar);
    },
    renderLinhaMultipla: renderLinhaMultipla,
    renderBarrasObjetivo: renderBarrasObjetivo,
    renderVariacaoDiaria: renderVariacaoDiaria,
    renderEvolucaoValor: renderEvolucaoValor
  };
})(window);
