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
  // eixo do valor sempre com a mesma largura nos gráficos mês a mês, para os
  // meses de um gráfico ficarem bem embaixo dos do outro
  function larguraEixoY(eixo) { eixo.width = 64; }
  function eixoY(extra) {
    return Object.assign({ grid: { color: CORES.grade }, border: { display: false, dash: [3, 3] }, ticks: { color: CORES.texto, font: fonte(10.5), callback: function (v) { return abreviaK(v); } } }, extra || {});
  }
  // escala com folga em cima (para os valores escritos acima das barras e dos
  // pontos não serem cortados), sempre a partir de zero e em números redondos
  // (R$ 5k, 10k, 20k…): o Chart.js arredondava a folga para baixo
  // os valores cabem na horizontal? (espaço de cada barra ou ponto, em px:
  // "R$ 9,4 mil" ocupa ~55 px) — senão ficam inclinados
  function espacoPorValor(grafico, porMes) {
    var largura = grafico.chartArea ? grafico.chartArea.right - grafico.chartArea.left : (grafico.width || 300) - 80;
    return largura / Math.max(1, grafico.data.labels.length * porMes);
  }
  // na horizontal com ≥ 34 px por valor (os que se encostariam sobem uma
  // linha, em escada); abaixo disso (celular) ficam inclinados
  function cabeHorizontal(grafico, porMes) { return espacoPorValor(grafico, porMes) >= 34; }
  // escreve os valores na horizontal, centralizados em x; quando um encostaria
  // num já escrito, sobe uma linha (até 4 vezes)
  function escreverSemEncostar(ctx, itens, area, alturaLinha) {
    // 1º tenta tudo numa linha só: no lugar; depois afastando a receita e a
    // despesa do mesmo mês para lados opostos (na mesma altura); depois com a
    // letra um pouco menor. Só se nada disso couber, um valor sobe uma linha.
    var fonteBase = ctx.font, tamanho = parseFloat((/(\d+(?:\.\d+)?)px/.exec(fonteBase) || [0, 10])[1]);
    var comFonte = function (px) { ctx.font = fonteBase.replace(/\d+(?:\.\d+)?px/, px + "px"); };
    var tentar = function (px, espalhar) {
      comFonte(px);
      var pos = itens.map(function (it) { return { it: it, x: it.x, y: it.y, w: ctx.measureText(it.txt).width }; });
      if (espalhar) {
        var grupos = {};
        pos.forEach(function (p) { if (p.it.grupo != null) (grupos[p.it.grupo] = grupos[p.it.grupo] || []).push(p); });
        Object.keys(grupos).forEach(function (g) {
          var par = grupos[g]; if (par.length !== 2) return;
          par.sort(function (a, b) { return a.x - b.x; });
          var esq = par[0], dir = par[1], meio = (esq.x + dir.x) / 2, y = Math.min(esq.y, dir.y);
          esq.y = dir.y = y;
          esq.x = Math.min(esq.x, meio - 2 - esq.w / 2);
          dir.x = Math.max(dir.x, meio + 2 + dir.w / 2);
        });
      }
      var rets = pos.map(function (p) { return { x0: p.x - p.w / 2 - 1, x1: p.x + p.w / 2 + 1, y0: p.y - alturaLinha, y1: p.y }; });
      for (var i = 0; i < rets.length; i++) for (var j = i + 1; j < rets.length; j++) {
        var r = rets[i], q = rets[j];
        if (r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0) return null;
      }
      return pos;
    };
    var ok = tentar(tamanho, false) || tentar(tamanho, true) || tentar(tamanho - 1, true) || tentar(tamanho - 1.5, true);
    if (ok) { ok.forEach(function (p) { ctx.fillStyle = p.it.cor; ctx.fillText(p.it.txt, p.x, p.y); }); comFonte(tamanho); return; }
    // sem espaço nem assim: em escada (quem encostaria sobe uma linha)
    comFonte(tamanho - 1);
    var postos = [];
    itens.slice().sort(function (a, b) { return a.x - b.x; }).forEach(function (it) {
      var larg = ctx.measureText(it.txt).width, y = it.y;
      for (var k = 0; k < 5; k++) {
        var r = { x0: it.x - larg / 2 - 2, x1: it.x + larg / 2 + 2, y0: y - alturaLinha, y1: y };
        var bate = postos.some(function (p) { return r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0; });
        if (!bate) break;
        y -= alturaLinha + 1;
      }
      postos.push({ x0: it.x - larg / 2 - 2, x1: it.x + larg / 2 + 2, y0: y - alturaLinha, y1: y });
      ctx.fillStyle = it.cor;
      ctx.fillText(it.txt, it.x, y);
    });
    comFonte(tamanho);
  }
  // porMes: quantos valores por mês (2 nas barras de receitas x despesas, 1 na linha)
  function topoComFolga(fracao, porMes) {
    var passoRedondo = function (bruto) {
      var pot = Math.pow(10, Math.floor(Math.log10(bruto))), n = bruto / pot;
      return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot;
    };
    return {
      bounds: "data",
      afterDataLimits: function (sc) {
        var min = Math.min(0, sc.min), max = Math.max(0, sc.max);
        if (!(max > min)) return;
        // em gráfico baixo, a folga em pixels precisa caber o valor inclinado
        // (~58 px de altura): a fração cresce o quanto for preciso
        var plot = Math.max(40, (sc.chart.height || 200) - 46);
        var esp = espacoPorValor(sc.chart, porMes || 1);
        // na horizontal precisa de pouco (uma linha, ou algumas em escada); inclinado, mais
        var PRECISA = esp >= 60 ? 18 : esp >= 34 ? 40 : plot < 150 ? 44 : 58;
        if (plot > PRECISA + 10) fracao = Math.max(fracao, PRECISA / (plot - PRECISA));
        var alvo = max + (max - min) * fracao, passo = passoRedondo((alvo - min) / 5);
        sc.min = Math.floor(min / passo) * passo;
        sc.max = Math.ceil(alvo / passo) * passo;
        sc._passoRedondo = passo;
      },
      afterBuildTicks: function (sc) {
        var passo = sc._passoRedondo; if (!passo) return;
        var t = [];
        for (var v = sc.min; v <= sc.max + passo / 1000; v += passo) t.push({ value: Math.round(v * 100) / 100 });
        sc.ticks = t;
      }
    };
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
  // valor de cada barra escrito logo acima dela, inclinado, na cor da barra
  // (forma curta: 9,8 mil · 750), para caber mesmo com 12 meses lado a lado
  // sempre com "R$" (também abaixo de mil): R$ 775 · R$ 9,4 mil · R$ 1,2 mi
  function valorCurto(v) {
    var a = Math.abs(v);
    if (a >= 1e6) return "R$ " + (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",").replace(/,0$/, "") + " mi";
    if (a >= 1e3) return "R$ " + (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(".", ",").replace(/,0$/, "") + " mil";
    return "R$ " + Math.round(v);
  }
  var valoresRD = {
    id: "valoresRD",
    afterDatasetsDraw: function (grafico) {
      var ctx = grafico.ctx, area = grafico.chartArea;
      // colunas estreitas (celular): letra menor e texto mais em pé
      // na horizontal quando cabe; senão inclinado (mais em pé em colunas estreitas)
      var deitado = cabeHorizontal(grafico, 2);
      var estreito = (area.right - area.left) / Math.max(1, grafico.data.labels.length) < 40 || area.bottom - area.top < 110;
      var angulo = estreito ? -Math.PI * 0.42 : -Math.PI / 3;
      ctx.save();
      ctx.font = "700 " + (estreito || (deitado && espacoPorValor(grafico, 2) < 60) ? 9 : 10) + "px 'Segoe UI', Roboto, Inter, sans-serif";
      ctx.textBaseline = deitado ? "bottom" : "middle"; ctx.textAlign = deitado ? "center" : "left";
      var itens = [];
      [0, 1].forEach(function (ds) {
        var meta = grafico.getDatasetMeta(ds);
        if (!meta || meta.hidden) return;
        var dados = grafico.data.datasets[ds].data || [];
        ctx.fillStyle = ds === 0 ? CORES.up : CORES.down;
        meta.data.forEach(function (b, i) {
          var v = Number(dados[i]);
          if (!b || !(v > 0)) return;
          if (deitado) { itens.push({ x: b.x, y: Math.max(area.top + 12, b.y - 4), txt: valorCurto(v), cor: ds === 0 ? CORES.up : CORES.down, grupo: i }); return; }
          ctx.save();
          ctx.translate(b.x, Math.max(area.top + 2, b.y - 5));
          ctx.rotate(angulo);   // inclinado (60°; 75° em colunas estreitas)
          ctx.fillText(valorCurto(v), 0, 0);
          ctx.restore();
        });
      });
      if (itens.length) escreverSemEncostar(ctx, itens, area, 11);
      ctx.restore();
    }
  };

  // Receitas x despesas: as duas colunas de cada mês juntinhas e no meio do
  // mês (em cima do nome), em vez de cada uma no canto da sua metade.
  // A largura do grupo é a de duas colunas mais um respiro de ~6 px.
  var colunasJuntasRD = {
    id: "colunasJuntasRD",
    beforeUpdate: function (g) {
      var n = Math.max(1, (g.data.labels || []).length), faixa = Math.max(1, ((g.width || 0) - 70) / n);
      var cat = Math.min(0.8, (2 * 26 / 0.94 + 6) / faixa);
      g.data.datasets.forEach(function (ds) { ds.barPercentage = 0.94; ds.categoryPercentage = cat; });
    }
  };

  // nome do mês no eixo: inteiro e com maiúscula (Janeiro) quando cabe; senão
  // a forma curta com maiúscula (Jan) — no celular, por exemplo
  var MESES_INTEIROS = { jan: "Janeiro", fev: "Fevereiro", mar: "Março", abr: "Abril", mai: "Maio", jun: "Junho", jul: "Julho", ago: "Agosto", set: "Setembro", out: "Outubro", nov: "Novembro", dez: "Dezembro" };
  function nomeMesEixo(eixo, value) {
    var rot = String(eixo.getLabelForValue(value));
    var chave = rot.toLowerCase();
    if (!MESES_INTEIROS[chave]) return rot;   // datas (dd/mm/aaaa) ficam como estão
    var g = eixo.chart, n = Math.max(1, Math.min(g.data.labels.length, eixo.options.ticks.maxTicksLimit || 99));
    // pela largura atual do gráfico (g.width já vem certa no redimensionamento;
    // a chartArea ainda é a do desenho anterior e deixava "Jan" na tela larga)
    var espaco = Math.max(0, (g.width || 0) - 70) / n;
    return espaco >= 76 ? MESES_INTEIROS[chave] : chave.charAt(0).toUpperCase() + chave.slice(1);
  }

  // nomes dos meses embaixo do gráfico desenhados como botões (fundo e contorno
  // ciano), para ficar claro que dá para tocar e ver o mês; o que está sob o
  // mouse fica mais forte
  var botoesMesRD = {
    id: "botoesMesRD",
    beforeDraw: function (grafico) {   // antes dos eixos: o nome do mês fica por cima do botão
      var eixo = grafico.scales.x, ctx = grafico.ctx;
      if (!eixo || !eixo.ticks || !eixo.ticks.length) return;
      var fonteTick = Chart.helpers.toFont(eixo.options.ticks.font);
      ctx.save();
      ctx.font = fonteTick.string;
      var passo = eixo.ticks.length > 1 ? Math.abs(eixo.getPixelForTick(1) - eixo.getPixelForTick(0)) : 60;
      // posição real de cada texto (o Chart.js já calculou onde vai desenhar)
      var itens = eixo.getLabelItems ? eixo.getLabelItems() : [];
      eixo.ticks.forEach(function (t, i) {
        var rot = String(t.label != null ? t.label : eixo.getLabelForValue(t.value));
        var it = itens[i], ty = it ? it.options.translation[1] : eixo.top + eixo.options.ticks.padding;
        var base = it ? it.options.textBaseline : "top";
        // no eixo de baixo o Chart.js desenha o texto meia linha abaixo do ponto informado
        var meioY = (base === "bottom" ? ty - fonteTick.lineHeight / 2 : ty) + fonteTick.lineHeight / 2;
        var larg = Math.min(passo - 3, ctx.measureText(rot).width + 12), alt = fonteTick.lineHeight + 6;
        var x = eixo.getPixelForTick(i) - larg / 2, y = meioY - alt / 2;
        var forte = grafico._mesHover === t.value, atual = grafico.$mesAtual === t.value;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, larg, alt, 6); else ctx.rect(x, y, larg, alt);
        // mês atual em dourado; os outros em ciano
        var rgb = atual ? "255,198,74" : "0,229,255";
        ctx.fillStyle = "rgba(" + rgb + "," + (forte ? 0.24 : atual ? 0.14 : 0.07) + ")";
        ctx.strokeStyle = "rgba(" + rgb + "," + (forte ? 0.95 : atual ? 0.75 : 0.35) + ")";
        ctx.lineWidth = 1;
        ctx.fill(); ctx.stroke();
      });
      ctx.restore();
    }
  };

  // o que está embaixo do toque: { indice do mês, tipo: "receitas" | "despesas" | null }
  // — a barra conta com uma folga em volta (barras baixas são difíceis de acertar no toque);
  // o nome do mês embaixo do gráfico e o resto da coluna dão tipo null (as duas)
  function alvoRD(evt, grafico) {
    if (!grafico || !grafico.chartArea || !evt) return null;
    var x = evt.x, y = evt.y, area = grafico.chartArea, eixo = grafico.scales.x;
    if (x == null || y == null || x < area.left || x > area.right) return null;
    var FOLGA = 6, ALTURA_MIN = 18;
    for (var ds = 0; ds < 2; ds++) {
      var meta = grafico.getDatasetMeta(ds);
      if (!meta || meta.hidden) continue;
      for (var i = 0; i < meta.data.length; i++) {
        var b = meta.data[i], valor = (grafico.data.datasets[ds].data || [])[i];
        if (!b || !(Number(valor) > 0)) continue;
        var meia = (b.width || 0) / 2 + FOLGA, topo = Math.min(b.y, b.base - ALTURA_MIN) - FOLGA;
        if (x >= b.x - meia && x <= b.x + meia && y >= topo && y <= b.base + 2) return { indice: i, tipo: ds === 0 ? "receitas" : "despesas" };
      }
    }
    // nome do mês (embaixo da área do gráfico) ou espaço vazio da coluna
    if (y > area.bottom + 2 && y > eixo.bottom + 4) return null;
    var idx = Math.round(eixo.getValueForPixel(x));
    if (!(idx >= 0 && idx < grafico.data.labels.length)) return null;
    return { indice: idx, tipo: null };
  }
  // nomes dos meses clicáveis embaixo de um gráfico de linha (o Chart.js só
  // avisa cliques dentro da área do gráfico): toque no nome → aoClicar(índice)
  function ligarBotoesMes(canvasId, aoClicar) {
    var g0 = instancias[canvasId]; if (!g0) return;
    var tela = g0.canvas;
    ["_bmClique", "_bmMove", "_bmSai"].forEach(function (k, n) { if (tela[k]) tela.removeEventListener(["click", "mousemove", "mouseleave"][n], tela[k]); });
    var indice = function (e) {
      var g = instancias[canvasId]; if (!g || !g.chartArea) return null;
      var r = tela.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, a = g.chartArea, eixo = g.scales.x;
      if (y <= a.bottom || y > eixo.bottom + 4 || x < a.left - 10 || x > a.right + 10) return null;
      var i = Math.round(eixo.getValueForPixel(x));
      return i >= 0 && i < g.data.labels.length ? i : null;
    };
    tela._bmClique = function (e) { var i = indice(e); if (i != null && aoClicar) aoClicar(i); };
    tela._bmMove = function (e) {
      var g = instancias[canvasId]; if (!g) return;
      var i = indice(e), antes = g._mesHover; g._mesHover = i;
      if (antes !== i) g.draw();
      var r = tela.getBoundingClientRect(); if (e.clientY - r.top > g.chartArea.bottom) tela.style.cursor = i != null && aoClicar ? "pointer" : "default";
    };
    tela._bmSai = function () { var g = instancias[canvasId]; if (g && g._mesHover != null) { g._mesHover = null; g.draw(); } };
    tela.addEventListener("click", tela._bmClique);
    tela.addEventListener("mousemove", tela._bmMove);
    tela.addEventListener("mouseleave", tela._bmSai);
  }

  function renderReceitasDespesas(canvasId, serie, opcoes) {
    opcoes = opcoes || {};
    // posição do mês atual no gráfico (o botão dele fica em dourado)
    var hojeD = new Date(), mesHoje = hojeD.getFullYear() + "-" + String(hojeD.getMonth() + 1).padStart(2, "0");
    var mesAtualIdx = serie.findIndex(function (s) { return s.mes === mesHoje; });
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    instancias[canvasId] = new Chart(ctx, {
      type: "bar",
      plugins: [botoesMesRD, valoresRD, colunasJuntasRD],
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
        // barra verde → só as receitas do mês; barra vermelha → só as despesas;
        // o nome do mês (ou o espaço vazio da coluna) → as duas, como antes
        onClick: function (evt, elementos, grafico) {
          if (!opcoes.aoClicar) return;
          var alvo = alvoRD(evt, grafico || this);
          if (alvo) opcoes.aoClicar(serie[alvo.indice], alvo.tipo);
        },
        onHover: function (evt, elementos, grafico) {
          if (evt && evt.native && evt.native.target) evt.native.target.style.cursor = (opcoes.aoClicar && alvoRD(evt, grafico || this)) ? "pointer" : "default";
        },
        // nomes dos meses como botões (ver botoesMesRD): na horizontal, com espaço em volta
        layout: { padding: { bottom: 4 } },
        scales: { x: eixoX({ ticks: { color: function (c) { return (c.tick ? c.tick.value : c.index) === mesAtualIdx ? "#FFC64A" : CORES.cy; }, font: fonte(10.5), maxRotation: 0, autoSkip: false, padding: 9, callback: function (v) { return nomeMesEixo(this, v); } } }),
          // folga em cima para o valor inclinado da barra mais alta (valoresRD)
          y: eixoY(Object.assign(topoComFolga(0.12, 2), { afterFit: larguraEixoY })) },
        plugins: {
          legend: { display: !(opcoes && opcoes.semLegenda), position: "top", align: "end", labels: { color: CORES.texto, font: fonte(10.5), boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle" } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": " + moeda(c.parsed.y); } } })
        }
      }
    });
    // o Chart.js só avisa cliques dentro da área das barras: o nome do mês,
    // embaixo, é tratado aqui (abre receitas e despesas do mês, como antes)
    instancias[canvasId].$mesAtual = mesAtualIdx;
    instancias[canvasId].draw();
    var tela = instancias[canvasId].canvas;
    if (tela._rdClique) tela.removeEventListener("click", tela._rdClique);
    if (tela._rdMove) tela.removeEventListener("mousemove", tela._rdMove);
    var foraDaArea = function (e) {
      var g = instancias[canvasId]; if (!g || !g.chartArea) return null;
      var r = tela.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (y <= g.chartArea.bottom) return null;   // dentro da área: o onClick do gráfico cuida
      return alvoRD({ x: x, y: y }, g);
    };
    tela._rdClique = function (e) { if (!opcoes.aoClicar) return; var a = foraDaArea(e); if (a) opcoes.aoClicar(serie[a.indice], a.tipo); };
    tela._rdMove = function (e) {
      var r = tela.getBoundingClientRect(); var g = instancias[canvasId]; if (!g || !g.chartArea) return;
      var a = e.clientY - r.top > g.chartArea.bottom ? foraDaArea(e) : null;
      var antes = g._mesHover; g._mesHover = a ? a.indice : null;
      if (antes !== g._mesHover) g.draw();   // realça o botão do mês sob o mouse
      if (e.clientY - r.top <= g.chartArea.bottom) return;
      tela.style.cursor = opcoes.aoClicar && a ? "pointer" : "default";
    };
    if (tela._rdSai) tela.removeEventListener("mouseleave", tela._rdSai);
    tela._rdSai = function () { var g = instancias[canvasId]; if (g && g._mesHover != null) { g._mesHover = null; g.draw(); } };
    tela.addEventListener("mouseleave", tela._rdSai);
    tela.addEventListener("click", tela._rdClique);
    tela.addEventListener("mousemove", tela._rdMove);
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

  // pico da Evolução patrimonial em verde (o dourado é do mês atual)
  var COR_PICO = "#2EE59D";
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
    var hojeD = new Date(), mesHoje = hojeD.getFullYear() + "-" + String(hojeD.getMonth() + 1).padStart(2, "0");
    var mesAtualIdx = porData ? -1 : serie.findIndex(function (p) { return String(p.data || "").slice(0, 7) === mesHoje; });
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
          // pico em verde (maior ponto); os demais pontos em verde quando o patrimônio subiu
          // em relação ao mês anterior e em vermelho quando caiu
          pointRadius: serie.map(function (p, i) { return i === iPico ? 7 : (serie.length <= 14 ? 4.5 : 2.5); }),
          pointHoverRadius: 8,
          pointBackgroundColor: serie.map(function (p, i) { return i === iPico ? COR_PICO : (i === 0 ? "#FFFFFF" : (p.valor >= serie[i - 1].valor ? CORES.up : CORES.down)); }),
          pointBorderColor: serie.map(function (p, i) { return i === iPico ? COR_PICO : "#0B1420"; }),
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
        // nomes dos meses como botões (botoesMesRD), o do mês atual em dourado;
        // folga à direita para o valor inclinado do último mês
        // meses no meio de cada coluna (offset), como no Receitas x despesas,
        // e eixo do valor com a mesma largura: os meses dos dois gráficos ficam alinhados
        layout: { padding: { bottom: 4 }, autoPadding: false },
        scales: { x: eixoX({ offset: true, ticks: { color: function (c) { return (c.tick ? c.tick.value : c.index) === mesAtualIdx ? "#FFC64A" : CORES.cy; }, font: fonte(10.5), maxTicksLimit: 12, maxRotation: 0, padding: 9, callback: function (v) { return nomeMesEixo(this, v); } } }),
          // folga em cima para o valor inclinado do ponto mais alto (valoresEvolucao)
          y: eixoY(Object.assign(topoComFolga(0.12, 1), { afterFit: larguraEixoY })) },
        plugins: { legend: { display: false }, tooltip: tooltipPadrao({ callbacks: {
          label: function (c) { return " Patrimônio: " + moeda(c.parsed.y) + (c.dataIndex === iPico ? "  🏆 pico" : ""); },
          afterLabel: function (c) {
            if (c.dataIndex === 0) return " Clique para ver os detalhes";
            var dif = serie[c.dataIndex].valor - serie[c.dataIndex - 1].valor;
            var pct = serie[c.dataIndex - 1].valor ? (dif / Math.abs(serie[c.dataIndex - 1].valor)) * 100 : 0;
            return " No mês: " + (dif >= 0 ? "+" : "−") + moeda(Math.abs(dif)) + " (" + (dif >= 0 ? "+" : "−") + Math.abs(pct).toFixed(1).replace(".", ",") + "%)\n Clique para ver os detalhes";
          } } }) }
      },
      plugins: [botoesMesRD, {
        // valor de cada mês escrito acima do ponto, inclinado, na cor do ponto
        // (verde subiu, vermelho caiu); o pico já tem a etiqueta verde
        id: "valoresEvolucao",
        afterDatasetsDraw: function (grafico) {
          var meta = grafico.getDatasetMeta(0), area = grafico.chartArea, c = grafico.ctx;
          if (!meta || meta.data.length < 2) return;
          var passo = (area.right - area.left) / (meta.data.length - 1);
          if (passo < 20) return;   // muitos meses ("Tudo"): ficaria embolado
          var deitado = cabeHorizontal(grafico, 1);
          var estreito = passo < 40 || area.bottom - area.top < 110;
          c.save();
          c.font = "700 " + (estreito || (deitado && espacoPorValor(grafico, 1) < 60) ? 9 : 10) + "px 'Segoe UI', Roboto, Inter, sans-serif";
          c.textBaseline = deitado ? "bottom" : "middle"; c.textAlign = deitado ? "center" : "left";
          var itensEvo = [];
          meta.data.forEach(function (pt, i) {
            if (i === iPico || !pt) return;
            var v = serie[i].valor;
            c.fillStyle = i === 0 ? "#FFFFFF" : (v >= serie[i - 1].valor ? CORES.up : CORES.down);
            var txt = (v < 0 ? "−" : "") + valorCurto(Math.abs(v));
            if (deitado) {
              // na horizontal, sem sair pelas bordas do gráfico
              var meia = c.measureText(txt).width / 2, x = Math.min(area.right + 30 - meia, Math.max(area.left - 20 + meia, pt.x));
              itensEvo.push({ x: x, y: Math.max(area.top + 12, pt.y - 8), txt: txt, cor: c.fillStyle });
              return;
            }
            c.save();
            c.translate(pt.x + 2, Math.max(area.top + 2, pt.y - 9));
            c.rotate(estreito ? -Math.PI * 0.42 : -Math.PI / 3);
            c.fillText((v < 0 ? "−" : "") + valorCurto(Math.abs(v)), 0, 0);   // −R$ 9,7 mil
            c.restore();
          });
          if (itensEvo.length) escreverSemEncostar(c, itensEvo, area, 11);
          c.restore();
        }
      }, {
        // etiqueta verde em cima do pico
        id: "rotuloPico",
        afterDatasetsDraw: function (grafico) {
          var pt = grafico.getDatasetMeta(0).data[iPico]; if (!pt) return;
          var c = grafico.ctx, txt = "🏆 Pico " + moeda(serie[iPico].valor), ca = grafico.chartArea;
          c.save(); c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif";
          var larg = c.measureText(txt).width + 12, alt = 19;
          var x = Math.min(ca.right - larg, Math.max(ca.left, pt.x - larg / 2));
          var y = pt.y - 14 - alt; if (y < ca.top) y = pt.y + 12;
          c.fillStyle = "#0B1420"; c.fillRect(x, y, larg, alt);
          c.fillStyle = "rgba(46,229,157,0.16)"; c.fillRect(x, y, larg, alt);
          c.strokeStyle = COR_PICO; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, larg - 1, alt - 1);
          c.fillStyle = COR_PICO; c.textBaseline = "middle"; c.fillText(txt, x + 6, y + alt / 2 + 0.5);
          c.restore();
        }
      }]
    });
    instancias[canvasId].$mesAtual = mesAtualIdx;
    instancias[canvasId].draw();
    ligarBotoesMes(canvasId, opcoes.aoClicar ? function (i) { opcoes.aoClicar(serie[i], serie, iPico); } : null);
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
          // o valor em reais alinhado à esquerda, em branco, no começo da barra
          // (barras negativas: logo depois do zero, do lado direito)
          var val = moeda(v);
          c.font = "700 11.5px 'Segoe UI', Roboto, sans-serif";
          c.fillStyle = "#FFFFFF";
          c.textAlign = "left";
          c.shadowColor = "rgba(0,0,0,.55)"; c.shadowBlur = 3;   // legível sobre barras claras
          var zero = grafico.scales.x.getPixelForValue(0);
          c.fillText(val, (v < 0 ? zero : Math.max(zero, grafico.chartArea.left)) + 8, barra.y);
          c.shadowBlur = 0;
          c.font = "800 11px 'Segoe UI', Roboto, sans-serif";
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

  // Resultado (preço atual × preço de compra): traço pontilhado vertical
  // ligando as duas linhas, com uma caixa no meio mostrando o lucro/prejuízo
  // total (diferença × cotas) e a diferença por cota. Usado no gráfico de
  // linha e no de velas das ações.
  // ordem das legendas dos gráficos de preço: Preço Atual, Preço Compra, Resultado
  function ordemLegenda(rotulo) {
    var ordem = ["Preço Atual", "Valor Atual", "Preço Compra", "Resultado"];
    var i = ordem.indexOf(rotulo);
    return i < 0 ? -1 : i;   // outros itens (ex.: "Preço" do dólar) ficam na frente
  }

  // soTotal: só o valor total, numa caixa cheia igual às etiquetas de
  // Preço Atual e Preço Compra no eixo (gráfico de velas)
  // obstaculos (velas): retângulos { x1, x2, y1, y2 } em pixels que a caixa não
  // pode cobrir — a posição do traço e da caixa é escolhida para evitá-los
  function desenharDiferencaCompra(grafico, precoAtual, precoMedio, qtd, soTotal, obstaculos) {
    var ca = grafico.chartArea, esc = grafico.scales.y;
    var yA = esc.getPixelForValue(precoAtual), yC = esc.getPixelForValue(precoMedio);
    var topo = Math.max(ca.top, Math.min(yA, yC)), base = Math.min(ca.bottom, Math.max(yA, yC));
    var dif = precoAtual - precoMedio, pctDif = precoMedio ? (dif / precoMedio) * 100 : 0;
    var cor = dif >= 0 ? CORES.up : CORES.down;
    var sinal = dif >= 0 ? "+" : "−";
    var pctTxt = " (" + sinal + Math.abs(pctDif).toFixed(1).replace(".", ",") + "%)";
    // 1ª linha: resultado total (diferença × cotas); 2ª: diferença por cota × quantidade
    // ícone de destaque na frente, como nos marcos da Evolução patrimonial
    var icone = dif >= 0 ? "📈 " : "📉 ";
    var txt = icone + (qtd > 0 ? sinal + moeda(Math.abs(dif * qtd)) + pctTxt : sinal + moeda(Math.abs(dif)) + pctTxt);
    var txt2 = qtd > 0 ? sinal + moeda(Math.abs(dif)) + " por cota × " + qtd.toLocaleString("pt-BR") + (qtd === 1 ? " cota" : " cotas") : "";
    var c = grafico.ctx;
    if (soTotal) {
      // mesmo formato das etiquetas do eixo (ex.: "36.42"): sinal + número com ponto, sem "R$".
      // Fica um pouco à frente da coluna de valores (dentro do gráfico, perto
      // da borda direita), entre o Preço Atual e o Preço Compra
      var xs = 0, total = sinal + Math.abs(qtd > 0 ? dif * qtd : dif).toFixed(2);
      c.save();
      c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif";
      var lt = c.measureText(total).width + 10;
      xs = Math.round(ca.right - lt / 2 - 8) + 0.5;   // encostada na borda, sem entrar na coluna de valores
      var yMeio = Math.min(ca.bottom - 9, Math.max(ca.top + 9, Math.round((topo + base) / 2)));
      var yt = yMeio;
      if (obstaculos && obstaculos.length) {
        // se ali a caixa cobrir uma vela (corpo ou pavio) ou um "N", procura o
        // ponto livre mais perto, preferindo o traço passando entre as velas
        var yMin = Math.max(ca.top + 9, topo + 9), yMax = Math.min(ca.bottom - 9, base - 9);
        if (yMax < yMin) { yMin = yMax = yMeio; }
        var melhor = null, folgaX = 3, folgaY = 3;
        for (var x = ca.left + lt / 2 + 2; x <= ca.right - lt / 2 - 2; x += 3) {
          var bloq = [], cruza = false;
          for (var k = 0; k < obstaculos.length; k++) {
            var o = obstaculos[k];
            if (o.x2 + folgaX < x - lt / 2 || o.x1 - folgaX > x + lt / 2) continue;
            bloq.push([o.y1 - 9 - folgaY, o.y2 + 9 + folgaY]);
            if (x >= o.x1 - 1 && x <= o.x2 + 1) cruza = true;
          }
          // o ponto livre (para o centro da caixa) mais perto do meio do traço
          bloq.sort(function (a, b) { return a[0] - b[0]; });
          var livres = [], ini = yMin;
          bloq.forEach(function (b) { if (b[0] > ini) livres.push([ini, Math.min(b[0], yMax)]); ini = Math.max(ini, b[1]); });
          if (ini <= yMax) livres.push([ini, yMax]);
          var yBom = null;
          livres.forEach(function (f) {
            if (f[1] < f[0]) return;
            var y = Math.min(f[1], Math.max(f[0], yMeio));
            if (yBom === null || Math.abs(y - yMeio) < Math.abs(yBom - yMeio)) yBom = y;
          });
          if (yBom === null) continue;
          var nota = Math.abs(x - xs) / ca.width + Math.abs(yBom - yMeio) / ca.height * 0.6 + (cruza ? 0.25 : 0);
          if (!melhor || nota < melhor.nota) melhor = { nota: nota, x: x, y: yBom };
        }
        if (melhor) { xs = melhor.x; yt = Math.round(melhor.y); }
      }
      // pontilhado vertical entre as duas linhas, com um ponto em cada ponta
      c.strokeStyle = cor; c.lineWidth = 1.2; c.setLineDash([3, 3]);
      c.beginPath(); c.moveTo(xs, topo); c.lineTo(xs, base); c.stroke(); c.setLineDash([]);
      c.fillStyle = cor;
      [topo, base].forEach(function (yy) { c.beginPath(); c.arc(xs, yy, 2.5, 0, Math.PI * 2); c.fill(); });
      // caixa cheia na cor do resultado, texto escuro (como "36.42" e "33.10" no eixo)
      c.fillRect(Math.round(xs - lt / 2), yt - 9, lt, 18);
      c.fillStyle = "#0B1420"; c.textBaseline = "middle"; c.textAlign = "center"; c.fillText(total, xs, yt + 0.5);
      c.restore();
      return;
    }
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
              }).sort(function (a, b) { return ordemLegenda(a.text) - ordemLegenda(b.text); });
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
        afterDatasetsDraw: function (grafico) { desenharDiferencaCompra(grafico, precoAtual, precoMedio, Number(opcoes.quantidade) || 0); }
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
    var corAtual = opcoes.corAtual || CORES.cy;
    // legenda (à esquerda do "Notícias"): as linhas do gráfico e o resultado
    // mesma ordem do gráfico de linha: Preço Atual, Preço Compra, Resultado
    // ("curto" é usado quando a legenda inteira não cabe ao lado do Abr/Máx/Mín/Fch)
    var legenda = [];
    if (opcoes.linhaAtual > 0) legenda.push({ rotulo: opcoes.rotuloAtual || "Preço Atual", curto: "Atual", cor: corAtual });
    if (opcoes.linhaCompra > 0) legenda.push({ rotulo: "Preço Compra", curto: "Compra", cor: CORES.laranja });
    if (opcoes.linhaAtual > 0 && opcoes.linhaCompra > 0) legenda.push({ rotulo: "Resultado", curto: "Result.", cor: opcoes.linhaAtual >= opcoes.linhaCompra ? CORES.up : CORES.down });
    var fimOHLC = 0;   // onde termina o texto Abr/Máx/Mín/Fch (a legenda não pode passar dele)
    // em telas estreitas (iPad em pé) o cabeçalho vira duas linhas:
    // Abr/Máx/Mín/Fch em cima e a legenda + Notícias embaixo
    var duasLinhas = false;
    var f4 = function (v) { return Number(v).toFixed(casas); };
    var rotulo = function (p) { return new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); };

    // janela visível [ini, fim) — o zoom e o arrasto mudam só a janela;
    // a escala de preço (eixo Y) acompanha as velas que estão na tela
    var total = serieTotal.length;
    var MIN_VELAS = Math.min(5, total);
    var fim = total;
    var ini = Math.max(0, total - Math.max(MIN_VELAS, Math.min(total, opcoes.visiveis || total)));
    var serie = [];        // velas visíveis (usadas pelos plugins e pelo tooltip)
    var cursor = null;     // posição do mouse para a cruz
    var ultimoToque = 0;   // hora do último toque na tela (iPad)
    var noticiasPorVela = {};   // índice da vela (na série toda) → notícias do dia
    var marcas = [];            // posição dos "N" desenhados (para o clique)

    function escala() {
      // a escala cobre as velas na tela e, nas ações, também o preço de
      // compra, para o Resultado (atual × compra) ficar sempre visível
      var extras = opcoes.linhaCompra > 0 ? [opcoes.linhaCompra] : [];
      // indicadores sobre as velas (médias, Bollinger) também cabem na escala
      (opcoes.sobreposicoes || []).forEach(function (o) {
        for (var k = ini; k < fim; k++) { var v = o.valores[k]; if (v != null && isFinite(v)) extras.push(v); }
      });
      var mn = Math.min.apply(null, serie.map(function (p) { return p.minima; }).concat(extras));
      var mx = Math.max.apply(null, serie.map(function (p) { return p.maxima; }).concat(extras));
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
          // tocar no "N" abre o resumo; tocar de novo no mesmo "N" fecha
          if (m) { if (popover && popoverIdx === m.idx) fecharNoticia(); else abrirNoticia(m); return; }
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
        // decide se o cabeçalho cabe numa linha só, pela largura do gráfico
        id: "cabecalhoDuasLinhas",
        beforeLayout: function (g) {
          duasLinhas = g.width < 720;
          g.options.layout.padding = { top: duasLinhas ? 40 : 22 };
        }
      }, {
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
          var c = g.ctx, x = g.chartArea.left + 4, y = g.chartArea.top - (duasLinhas ? 30 : 12);
          var partes = [["Abertura", p.abertura], ["Máxima", p.maxima], ["Mínima", p.minima], ["Fechamento", p.preco]];
          c.save();
          c.textBaseline = "middle";
          partes.forEach(function (par) {
            c.font = "600 10.5px 'Segoe UI', Roboto, sans-serif"; c.fillStyle = CORES.texto;
            c.fillText(par[0], x, y); x += c.measureText(par[0] + " ").width;
            c.font = "700 10.5px 'Segoe UI', Roboto, sans-serif"; c.fillStyle = cor(p);
            var v = f4(par[1]); c.fillText(v, x, y); x += c.measureText(v).width + 10;
          });
          fimOHLC = x;
          c.restore();
        }
      },
      // valor atual em azul e, nas ações, o preço de compra em laranja
      // mesmas cores do gráfico de linha: ação = Preço Atual em ciano e
      // Preço Compra em laranja; dólar = Valor Atual em amarelo
      linhaComEtiqueta("linhaValorAtual", opcoes.linhaAtual, corAtual, opcoes.corAtual ? [3, 4] : [6, 4]),
      linhaComEtiqueta("linhaCompra", opcoes.linhaCompra, CORES.laranja, [6, 4]),
      opcoes.linhaAtual > 0 && opcoes.linhaCompra > 0 ? {
        // Resultado: pontilhado entre o preço atual e o de compra, com a caixa do valor
        id: "diferencaCompraVelas",
        afterDatasetsDraw: function (g) {
          var y = g.scales.y, ca = g.chartArea;
          var yA = y.getPixelForValue(opcoes.linhaAtual), yC = y.getPixelForValue(opcoes.linhaCompra);
          // só quando ao menos uma das linhas está na tela (com zoom, podem sair)
          if (Math.max(yA, yC) < ca.top || Math.min(yA, yC) > ca.bottom) return;
          // as velas na tela (corpo + pavio) são obstáculos para a caixa
          var meta = g.getDatasetMeta(0), obst = [];
          meta.data.forEach(function (barra, i) {
            var p = serie[i]; if (!p) return;
            var meia = Math.max(2, (barra.width || 0) / 2);
            obst.push({ x1: barra.x - meia, x2: barra.x + meia, y1: y.getPixelForValue(p.maxima), y2: y.getPixelForValue(p.minima) });
            // o "N" de notícias acima da vela também é obstáculo (mesma posição
            // usada no desenho do "N": 14 px acima da máxima, raio 7,5)
            if (noticiasPorVela[ini + i]) {
              var yn = Math.max(ca.top - 6, y.getPixelForValue(p.maxima) - 14);
              obst.push({ x1: barra.x - 8, x2: barra.x + 8, y1: yn - 8, y2: yn + 8 });
            }
          });
          desenharDiferencaCompra(g, opcoes.linhaAtual, opcoes.linhaCompra, Number(opcoes.quantidade) || 0, true, obst);
        }
      } : { id: "semDiferenca" },
      {
        // indicadores sobre as velas: médias móveis e Bandas de Bollinger
        // (valores alinhados com a série toda; null onde não há cálculo)
        id: "sobreposicoes",
        afterDatasetsDraw: function (g) {
          var lista = opcoes.sobreposicoes || []; if (!lista.length) return;
          var meta = g.getDatasetMeta(0), y = g.scales.y, c = g.ctx, ca = g.chartArea;
          c.save();
          c.beginPath(); c.rect(ca.left, ca.top, ca.right - ca.left, ca.bottom - ca.top); c.clip();
          lista.forEach(function (o) {
            c.strokeStyle = o.cor; c.lineWidth = o.largura || 1.4; c.setLineDash(o.traco || []);
            c.beginPath(); var comecou = false;
            meta.data.forEach(function (barra, i) {
              var v = o.valores[ini + i];
              if (v == null || !isFinite(v)) { comecou = false; return; }
              var py = y.getPixelForValue(v);
              if (!comecou) { c.moveTo(barra.x, py); comecou = true; } else c.lineTo(barra.x, py);
            });
            c.stroke();
          });
          // legenda dos indicadores no canto inferior esquerdo
          c.setLineDash([]); c.font = "700 10px 'Segoe UI', Roboto, sans-serif"; c.textBaseline = "middle";
          var x = ca.left + 6, yl = ca.bottom - 10;
          lista.filter(function (o) { return o.rotulo; }).forEach(function (o) {
            c.fillStyle = o.cor; c.fillRect(x, yl - 1, 10, 2); x += 14;
            c.fillText(o.rotulo, x, yl); x += c.measureText(o.rotulo).width + 12;
          });
          c.restore();
        }
      },
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
          var status = g.$statusNoticias || "";
          var xLeg = ca.right;   // onde a legenda das linhas termina (à direita)
          if (algum || status) {
            // legenda "Notícias" no canto direito do cabeçalho
            var xr = ca.right, yl = ca.top - 12;
            var txt = "Notícias" + (status ? " · " + status : "");
            c.font = "600 10.5px 'Segoe UI', Roboto, sans-serif"; c.textAlign = "right";
            c.fillStyle = CORES.texto; c.fillText(txt, xr, yl);
            var xc = xr - c.measureText(txt).width - 11;
            c.fillStyle = "#1E88FF"; c.beginPath(); c.arc(xc, yl, 6.5, 0, Math.PI * 2); c.fill();
            c.font = "800 8.5px 'Segoe UI', Roboto, sans-serif"; c.textAlign = "center";
            c.fillStyle = "#FFFFFF"; c.fillText("N", xc, yl + 0.5);
            xLeg = xc - 6.5 - 14;
          }
          // Preço Atual · Preço Compra · Resultado, no mesmo estilo da legenda
          // do gráfico de linha (bolinha translúcida com contorno na cor)
          var yLeg = ca.top - 12, limite = duasLinhas ? ca.left : Math.max(ca.left, fimOHLC + 6);   // não cobre o Abr/Máx/Mín/Fch
          c.font = "600 10.5px 'Segoe UI', Roboto, sans-serif"; c.textBaseline = "middle";
          // se os nomes completos não couberem, usa os curtos (Result., Atual, Compra)
          var largura = function (chave) { return legenda.reduce(function (t, it) { return t + c.measureText(it[chave]).width + 9 + 5 + 14; }, 0); };
          var chave = largura("rotulo") <= xLeg - limite ? "rotulo" : "curto";
          for (var k = legenda.length - 1; k >= 0; k--) {
            var it = { rotulo: legenda[k][chave], cor: legenda[k].cor }, lt = c.measureText(it.rotulo).width;
            var xTexto = xLeg - lt, xBola = xTexto - 9;
            if (xBola - 5 < limite) break;
            c.textAlign = "left"; c.fillStyle = CORES.texto; c.fillText(it.rotulo, xTexto, yLeg);
            var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(it.cor);
            c.fillStyle = m ? "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + ",0.28)" : it.cor;
            c.strokeStyle = it.cor; c.lineWidth = 1.5;
            c.beginPath(); c.arc(xBola, yLeg, 4, 0, Math.PI * 2); c.fill(); c.stroke();
            xLeg = xBola - 5 - 14;
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
          // a cruz é só para o mouse: no iPad o Safari imita um "mousemove"
          // depois de cada toque, e a cruz ficava presa em cima de uma vela
          else if (e.type === "mousemove") cursor = Date.now() - ultimoToque > 1000 && dentroDaArea(g, e) ? { x: e.x, y: e.y } : null;
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
    var popover = null, popoverIdx = null;   // resumo aberto e a vela dele
    function fecharNoticia() {
      if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
      popover = null; popoverIdx = null;
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
      popoverIdx = m.idx;
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
    // muda a quantidade de velas na tela, mantendo no lugar a vela sob xPixel
    function zoomPara(qtdDesejada, xPixel) {
      var ca = grafico.chartArea, qtd = fim - ini;
      var nova = Math.round(Math.max(MIN_VELAS, Math.min(total, qtdDesejada)));
      if (nova === qtd) return;
      var frac = Math.max(0, Math.min(1, (xPixel - ca.left) / (ca.right - ca.left)));
      var ancora = ini + frac * qtd;
      ini = Math.round(ancora - frac * nova);
      ini = Math.max(0, Math.min(total - nova, ini));
      fim = ini + nova;
      fecharNoticia();
      aplicarJanela(grafico); grafico.update("none");
      avisarJanela();
    }
    function zoom(fator, xPixel) { zoomPara((fim - ini) * fator, xPixel); }
    // avisa o app qual intervalo está na tela depois do zoom (para marcar a
    // aba de período); a abertura do gráfico já vem da aba escolhida
    function avisarJanela() {
      if (opcoes.aoMudarJanela && serie.length) opcoes.aoMudarJanela(serie[0].data, serie[serie.length - 1].data, ini === 0 && fim === total);
    }
    function deslocar(velas) {
      var qtd = fim - ini;
      var novoIni = Math.max(0, Math.min(total - qtd, ini + velas));
      if (novoIni === ini) return;
      ini = novoIni; fim = ini + qtd;
      fecharNoticia();
      aplicarJanela(grafico); grafico.update("none");
      avisarJanela();
    }
    // arrasto lateral: move uma vela a cada "largura de vela" percorrida
    function arrastarPara(x) {
      var ca = grafico.chartArea, porVela = (ca.right - ca.left) / Math.max(1, fim - ini);
      var dx = x - arrasto.x + arrasto.sobra;
      var velas = Math.trunc(dx / porVela);
      if (velas) { deslocar(-velas); arrasto.sobra = dx - velas * porVela; arrasto.x = x; }
    }
    function soltouArrasto() {
      // o clique que vem logo depois do arrasto/pinça não troca para a linha
      if (arrastou) setTimeout(function () { arrastou = false; }, 350);
    }

    var antigos = canvas._velasEventos;
    if (antigos) Object.keys(antigos).forEach(function (k) { canvas.removeEventListener(k, antigos[k]); });
    var arrasto = null, pinca = null, toque = null, animacao = null;
    // área que rola: o primeiro "pai" com rolagem, ou a própria página
    function areaRolavel() {
      for (var el = canvas.parentNode; el && el !== document.body; el = el.parentNode) {
        var oy = getComputedStyle(el).overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) return el;
      }
      return document.scrollingElement || document.documentElement;
    }
    function rolarPagina(dy) { areaRolavel().scrollTop += dy; }
    function pararInercia() { if (animacao) cancelAnimationFrame(animacao); animacao = null; }
    function inercia(vel) {
      var antes = Date.now();
      var passo = function () {
        var agora = Date.now(), dt = agora - antes; antes = agora;
        vel *= Math.pow(0.995, dt);                   // desacelera aos poucos
        if (Math.abs(vel) < 0.02) { animacao = null; return; }
        rolarPagina(vel * dt);
        animacao = requestAnimationFrame(passo);
      };
      animacao = requestAnimationFrame(passo);
    }
    var rect = function () { return canvas.getBoundingClientRect(); };
    var posX = function (e) { return e.clientX - rect().left; };
    // dois dedos: distância real entre eles (em qualquer direção) e o ponto do meio
    var medirPinca = function (t) {
      var r = rect(), dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return { dist: Math.max(1, Math.sqrt(dx * dx + dy * dy)), meio: (t[0].clientX + t[1].clientX) / 2 - r.left };
    };
    var eventos = {
      // ---- web: roda do mouse = zoom; arrastar com o mouse = mover no tempo
      wheel: function (e) {
        if (instancias[canvasId] !== grafico) return;
        e.preventDefault();
        zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, posX(e));
      },
      pointerdown: function (e) {
        if (e.pointerType === "touch") return;          // toque é tratado abaixo
        try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* sem suporte */ }
        arrastou = false;
        arrasto = { x: posX(e), inicio: posX(e), sobra: 0 };
      },
      pointermove: function (e) {
        if (e.pointerType === "touch" || !arrasto) return;
        if (Math.abs(posX(e) - arrasto.inicio) > 4) arrastou = true;
        arrastarPara(posX(e));
      },
      pointerup: function (e) {
        if (e.pointerType === "touch") return;
        arrasto = null; soltouArrasto();
      },
      // ---- iPad: dois dedos afastando/aproximando = zoom (pinça);
      // um dedo deslizando para o lado = mover no tempo; na vertical, a
      // página rola normalmente
      touchstart: function (e) {
        ultimoToque = Date.now();
        if (cursor) { cursor = null; grafico.draw(); }
        if (e.touches.length === 2) {
          var m = medirPinca(e.touches);
          pinca = { dist0: m.dist, qtd0: fim - ini };
          arrasto = null; toque = null; arrastou = true;
          e.preventDefault();
        } else if (e.touches.length === 1) {
          arrastou = false;
          pararInercia();
          var t = e.touches[0];
          toque = { x0: t.clientX, y0: t.clientY, yAnt: t.clientY, tAnt: Date.now(), vel: 0, decidido: null };
          arrasto = { x: t.clientX - rect().left, sobra: 0 };
        }
      },
      touchmove: function (e) {
        if (pinca && e.touches.length >= 2) {
          e.preventDefault();
          var m = medirPinca(e.touches);
          // afastar os dedos aproxima (menos velas, maiores); juntar afasta
          zoomPara(pinca.qtd0 * pinca.dist0 / m.dist, m.meio);
          return;
        }
        if (!toque || e.touches.length !== 1) return;
        var t = e.touches[0], dx = t.clientX - toque.x0, dy = t.clientY - toque.y0;
        if (!toque.decidido && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) toque.decidido = Math.abs(dx) > Math.abs(dy) ? "lado" : "vertical";
        if (!toque.decidido) return;
        e.preventDefault();
        arrastou = true;
        if (toque.decidido === "lado") { arrastarPara(t.clientX - rect().left); return; }
        // vertical: o gráfico não deixa o navegador rolar sozinho (senão ele
        // "rouba" a pinça com os dedos inclinados), então rola a página aqui
        var agora = Date.now(), passo = toque.yAnt - t.clientY;
        rolarPagina(passo);
        toque.vel = passo / Math.max(1, agora - toque.tAnt);
        toque.yAnt = t.clientY; toque.tAnt = agora;
      },
      touchend: function (e) {
        ultimoToque = Date.now();
        if (e.touches.length < 2) pinca = null;
        if (!e.touches.length) {
          // solta a rolagem vertical com o embalo do dedo, como no iOS
          if (toque && toque.decidido === "vertical" && Math.abs(toque.vel) > 0.2) inercia(toque.vel);
          arrasto = null; toque = null; soltouArrasto();
        }
      },
      // Safari do iPad: impede o zoom da página inteira durante a pinça
      gesturestart: function (e) { e.preventDefault(); },
      gesturechange: function (e) { e.preventDefault(); }
    };
    eventos.pointercancel = eventos.pointerup;
    eventos.touchcancel = eventos.touchend;
    var passivo = { wheel: 1, touchstart: 1, touchmove: 1, gesturestart: 1, gesturechange: 1 };
    Object.keys(eventos).forEach(function (k) { canvas.addEventListener(k, eventos[k], passivo[k] ? { passive: false } : false); });
    canvas._velasEventos = eventos;
    // no iPad o gráfico cuida de todos os toques: pinça em qualquer ângulo
    // (inclusive com os dedos na vertical/inclinados), arrasto lateral e a
    // rolagem vertical da página com um dedo
    canvas.style.touchAction = "none";
  }

  // ---------------------------------------------------------------------
  // Linhas suaves múltiplas: Renda / Despesas / Poupança por mês
  // series = [{ rotulo, valores, cor }]; opcoes.formato(v) troca o R$ do
  // eixo e da dica (ex.: variação em %); opcoes.aoClicar(índice do ponto)
  // ---------------------------------------------------------------------
  // Oscilador abaixo das velas: linhas (IFR, MACD e sinal) e barras
  // (histograma do MACD, volume), com linhas de referência (70/30, zero)
  // series = [{ rotulo, valores, cor, tipo: "linha" | "barra", cores? }]
  function renderOscilador(canvasId, rotulos, series, opcoes) {
    opcoes = opcoes || {};
    destruir(canvasId);
    var ctx = ctxOf(canvasId); if (!ctx) return;
    var fmt = opcoes.formato || function (v) { return Number(v).toFixed(1); };
    var refs = opcoes.referencias || [];
    instancias[canvasId] = new Chart(ctx, {
      data: { labels: rotulos, datasets: series.map(function (s) {
        return s.tipo === "barra"
          ? { type: "bar", label: s.rotulo, data: s.valores, backgroundColor: s.cores || s.cor, borderWidth: 0, barPercentage: 0.7, categoryPercentage: 0.9, order: 2 }
          : { type: "line", label: s.rotulo, data: s.valores, borderColor: s.cor, borderWidth: 1.4, pointRadius: 0, tension: 0.2, spanGaps: true, order: 1 };
      }) },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 14 } },
        scales: {
          x: eixoX({ ticks: { display: false } }),
          y: eixoY({ position: "right", min: opcoes.min, max: opcoes.max, ticks: { color: CORES.texto, font: fonte(9.5), maxTicksLimit: 4, callback: function (v) { return fmt(v); } },
            // mesma largura do eixo do gráfico de cima, para os dias ficarem alinhados
            afterFit: function (eixo) { if (opcoes.larguraEixo > 0) eixo.width = opcoes.larguraEixo; } })
        },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: "#111", titleFont: fonte(10), bodyFont: fonte(10), callbacks: { label: function (c) { return c.dataset.label + ": " + (c.raw == null ? "—" : fmt(c.raw)); } } }
        }
      },
      plugins: [{
        id: "refsOscilador",
        beforeDatasetsDraw: function (g) {
          var c = g.ctx, ca = g.chartArea, y = g.scales.y;
          c.save(); c.strokeStyle = "rgba(200,200,200,.35)"; c.setLineDash([3, 3]); c.lineWidth = 1;
          refs.forEach(function (r) { var py = Math.round(y.getPixelForValue(r)) + 0.5; if (py < ca.top || py > ca.bottom) return; c.beginPath(); c.moveTo(ca.left, py); c.lineTo(ca.right, py); c.stroke(); });
          c.restore();
        },
        afterDatasetsDraw: function (g) {
          // nome do oscilador e o último valor de cada série no topo
          var c = g.ctx, ca = g.chartArea, x = ca.left + 4;
          c.save(); c.font = "700 10px 'Segoe UI', Roboto, sans-serif"; c.textBaseline = "middle";
          c.fillStyle = "#E6E7EA"; c.fillText(opcoes.titulo || "", x, ca.top - 7); x += c.measureText(opcoes.titulo || "").width + 10;
          series.forEach(function (s) {
            var ult = null; for (var k = s.valores.length - 1; k >= 0; k--) if (s.valores[k] != null) { ult = s.valores[k]; break; }
            if (ult == null || s.semLegenda) return;
            c.fillStyle = s.cor; var t = s.rotulo + " " + fmt(ult); c.fillText(t, x, ca.top - 7); x += c.measureText(t).width + 10;
          });
          c.restore();
        }
      }]
    });
  }

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
        onClick: function (evt, elementos) {
          if (opcoes.aoClicar && elementos && elementos.length) opcoes.aoClicar(elementos[0].index);
        },
        onHover: function (evt, elementos) {
          if (evt && evt.native && evt.native.target) evt.native.target.style.cursor = (opcoes.aoClicar && elementos.length) ? "pointer" : "default";
        },
        scales: { x: eixoX(), y: opcoes.formato ? eixoY({ ticks: { color: CORES.texto, font: fonte(10.5), callback: function (v) { return opcoes.formato(v); } } }) : eixoY() },
        plugins: {
          legend: { display: !opcoes.semLegenda, position: "top", align: "start", labels: { color: CORES.texto, font: fonte(11), boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle" } },
          tooltip: tooltipPadrao({ callbacks: { label: function (c) { return " " + c.dataset.label + ": " + (opcoes.formato ? opcoes.formato(c.parsed.y) : moeda(c.parsed.y)); } } })
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
    // texto curto ao lado da legenda "Notícias" (ex.: "sem conexão com as fontes")
    statusNoticias: function (canvasId, texto) {
      var g = instancias[canvasId];
      if (!g || !g.$definirNoticias || g.$statusNoticias === texto) return;
      g.$statusNoticias = texto;
      g.update("none");
    },
    renderLinhaMultipla: renderLinhaMultipla,
    renderOscilador: renderOscilador,
    renderBarrasObjetivo: renderBarrasObjetivo,
    renderVariacaoDiaria: renderVariacaoDiaria,
    renderEvolucaoValor: renderEvolucaoValor
  };
})(window);
