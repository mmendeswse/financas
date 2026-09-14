/**
 * investimentos.js
 * -----------------------------------------------------------------------
 * Regras de negócio de investimentos (renda fixa, fundos, tesouro, etc.)
 * e da carteira de ações/FIIs/ETFs.
 *
 * Assim como financeiro.js, este módulo só lê o objeto de dados e devolve
 * números prontos — quem desenha é o app.js.
 *
 * IMPORTANTE (item 29 do briefing): nenhuma cotação é inventada aqui.
 * O preço atual de cada ativo é o que o usuário digitou por último; junto
 * dele guardamos sempre "atualizadoEm" para a interface poder avisar
 * "preço atualizado manualmente em 12/09/2026".
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------------
  // INVESTIMENTOS "tradicionais" (renda fixa, tesouro, fundos, cripto...)
  // ---------------------------------------------------------------------
  function resultadoInvestimento(inv) {
    return Number(inv.valorAtual || 0) - Number(inv.valorInvestido || 0);
  }
  function rentabilidadeInvestimento(inv) {
    var investido = Number(inv.valorInvestido || 0);
    if (investido <= 0) return 0;
    return (Number(inv.valorAtual || 0) / investido - 1) * 100;
  }

  function totalInvestidoOutros(d) {
    return d.investimentos.reduce(function (s, i) { return s + Number(i.valorInvestido || 0); }, 0);
  }
  function totalAtualOutros(d) {
    return d.investimentos.reduce(function (s, i) { return s + Number(i.valorAtual || 0); }, 0);
  }

  function investimentosPorCategoria(d) {
    var mapa = {};
    d.investimentos.forEach(function (i) {
      var c = i.categoria || "Outros";
      mapa[c] = (mapa[c] || 0) + Number(i.valorAtual || 0);
    });
    return Object.keys(mapa)
      .map(function (c) { return { categoria: c, valor: mapa[c] }; })
      .sort(function (a, b) { return b.valor - a.valor; });
  }


  // ---------------------------------------------------------------------
  // RENDA FIXA — campos detalhados e imposto de renda
  //
  // Tabela regressiva do IR sobre o lucro (CDB, Tesouro, fundos comuns):
  //   até 180 dias .......... 22,5%
  //   de 181 a 360 dias ..... 20,0%
  //   de 361 a 720 dias ..... 17,5%
  //   acima de 720 dias ..... 15,0%
  // LCI, LCA, CRI, CRA, debênture incentivada e poupança são isentos.
  // (O IOF dos primeiros 30 dias não é calculado aqui.)
  // ---------------------------------------------------------------------
  var ISENTOS = ["LCI", "LCA", "CRI", "CRA", "Debênture incentivada", "Poupança"];

  function diasCorridos(inv) {
    if (!inv || !inv.dataAplicacao) return 0;
    var ini = new Date(inv.dataAplicacao + "T00:00:00");
    var fim = new Date();
    return Math.max(0, Math.round((fim - ini) / 86400000));
  }

  function diasAteVencimento(inv) {
    if (!inv || !inv.dataVencimento) return null;
    var venc = new Date(inv.dataVencimento + "T00:00:00");
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return Math.round((venc - hoje) / 86400000);
  }

  function ehIsento(inv) {
    if (!inv) return false;
    if (inv.isentoIR) return true;
    return ISENTOS.indexOf(inv.tipoAtivo) > -1;
  }

  function aliquotaIR(inv) {
    if (ehIsento(inv)) return 0;
    var d = diasCorridos(inv);
    if (d <= 180) return 22.5;
    if (d <= 360) return 20;
    if (d <= 720) return 17.5;
    return 15;
  }

  function lucroInvestimento(inv) {
    return Math.max(0, Number(inv.valorAtual || 0) - Number(inv.valorInvestido || 0));
  }

  function impostoInvestimento(inv) {
    return lucroInvestimento(inv) * (aliquotaIR(inv) / 100);
  }

  function valorLiquidoInvestimento(inv) {
    return Number(inv.valorAtual || 0) - impostoInvestimento(inv);
  }

  function rentabilidadeLiquida(inv) {
    var aplicado = Number(inv.valorInvestido || 0);
    if (aplicado <= 0) return 0;
    return (valorLiquidoInvestimento(inv) / aplicado - 1) * 100;
  }

  // rentabilidade equivalente ao ano, útil para comparar aplicações de
  // prazos diferentes
  function rentabilidadeAnualizada(inv, liquida) {
    var aplicado = Number(inv.valorInvestido || 0);
    var d = diasCorridos(inv);
    if (aplicado <= 0 || d < 30) return null;
    var final = liquida ? valorLiquidoInvestimento(inv) : Number(inv.valorAtual || 0);
    return (Math.pow(final / aplicado, 365 / d) - 1) * 100;
  }

  function precoUnitarioInvestimento(inv) {
    var q = Number(inv.quantidade || 0);
    return q > 0 ? Number(inv.valorInvestido || 0) / q : 0;
  }
  function precoAtualCota(inv) {
    var q = Number(inv.quantidade || 0);
    return q > 0 ? Number(inv.valorAtual || 0) / q : 0;
  }

  function listaInvestimentosComCalculo(d) {
    return d.investimentos.map(function (inv) {
      return Object.assign({}, inv, {
        dias: diasCorridos(inv),
        diasVenc: diasAteVencimento(inv),
        aliquota: aliquotaIR(inv),
        imposto: impostoInvestimento(inv),
        liquido: valorLiquidoInvestimento(inv),
        resultado: Number(inv.valorAtual || 0) - Number(inv.valorInvestido || 0),
        rentBruta: rentabilidadeInvestimento(inv),
        rentLiquida: rentabilidadeLiquida(inv),
        rentAno: rentabilidadeAnualizada(inv, true),
        pu: precoUnitarioInvestimento(inv),
        puAtual: precoAtualCota(inv)
      });
    }).sort(function (a, b) { return b.valorAtual - a.valorAtual; });
  }

  function totaisInvestimentos(d) {
    var t = { aplicado: 0, bruto: 0, imposto: 0, liquido: 0, resultado: 0 };
    d.investimentos.forEach(function (inv) {
      t.aplicado += Number(inv.valorInvestido || 0);
      t.bruto += Number(inv.valorAtual || 0);
      t.imposto += impostoInvestimento(inv);
    });
    t.liquido = t.bruto - t.imposto;
    t.resultado = t.bruto - t.aplicado;
    t.resultadoLiquido = t.liquido - t.aplicado;
    t.rentBruta = t.aplicado > 0 ? (t.resultado / t.aplicado) * 100 : 0;
    t.rentLiquida = t.aplicado > 0 ? (t.resultadoLiquido / t.aplicado) * 100 : 0;
    return t;
  }

  // vencimentos próximos (para avisar o usuário)
  function investimentosVencendoEm(d, dias) {
    return d.investimentos.filter(function (inv) {
      var v = diasAteVencimento(inv);
      return v !== null && v >= 0 && v <= dias;
    });
  }

  // ---------------------------------------------------------------------
  // AÇÕES / FIIs / ETFs
  // ---------------------------------------------------------------------
  function valorInvestidoAcao(a) { return Number(a.quantidade || 0) * Number(a.precoMedio || 0); }
  function valorAtualAcao(a) { return Number(a.quantidade || 0) * Number(a.precoAtual || 0); }
  function resultadoAcao(a) { return valorAtualAcao(a) - valorInvestidoAcao(a); }
  function rentabilidadeAcao(a) {
    var pm = Number(a.precoMedio || 0);
    if (pm <= 0) return 0;
    return (Number(a.precoAtual || 0) / pm - 1) * 100;
  }

  function totalCarteiraAcoes(d) {
    return d.acoes.reduce(function (s, a) { return s + valorAtualAcao(a); }, 0);
  }
  function totalInvestidoAcoes(d) {
    return d.acoes.reduce(function (s, a) { return s + valorInvestidoAcao(a); }, 0);
  }
  function resultadoCarteiraAcoes(d) {
    return totalCarteiraAcoes(d) - totalInvestidoAcoes(d);
  }
  function rentabilidadeCarteiraAcoes(d) {
    var investido = totalInvestidoAcoes(d);
    if (investido <= 0) return 0;
    return (resultadoCarteiraAcoes(d) / investido) * 100;
  }
  function totalDividendosAcoes(d) {
    return d.acoes.reduce(function (s, a) { return s + Number(a.dividendos || 0); }, 0);
  }

  function listaAcoesComCalculo(d) {
    var total = totalCarteiraAcoes(d);
    return d.acoes.map(function (a) {
      var atual = valorAtualAcao(a);
      return Object.assign({}, a, {
        valorInvestido: valorInvestidoAcao(a),
        valorAtual: atual,
        resultado: atual - valorInvestidoAcao(a),
        rentabilidade: rentabilidadeAcao(a),
        peso: total > 0 ? (atual / total) * 100 : 0
      });
    }).sort(function (x, y) { return y.valorAtual - x.valorAtual; });
  }

  function composicaoCarteira(d) {
    var lista = listaAcoesComCalculo(d);
    var total = totalCarteiraAcoes(d);
    var CORTE = 5; // agrupa o restante em "Outros" quando há muitos ativos
    if (lista.length <= CORTE || total <= 0) {
      return lista.map(function (a) { return { rotulo: a.ticker, valor: a.valorAtual, peso: a.peso }; });
    }
    var principais = lista.slice(0, CORTE);
    var restoValor = lista.slice(CORTE).reduce(function (s, a) { return s + a.valorAtual; }, 0);
    var saida = principais.map(function (a) { return { rotulo: a.ticker, valor: a.valorAtual, peso: a.peso }; });
    saida.push({ rotulo: "Outros", valor: restoValor, peso: total > 0 ? (restoValor / total) * 100 : 0 });
    return saida;
  }

  function precoMinMax(acao) {
    var hist = acao.historicoPrecos || [];
    if (!hist.length) return { min: acao.precoAtual, max: acao.precoAtual };
    var precos = hist.map(function (p) { return p.preco; });
    return { min: Math.min.apply(null, precos), max: Math.max.apply(null, precos) };
  }

  // variação do preço atual em relação ao ponto anterior do histórico
  // (funciona como "variação do dia" quando o usuário lança preços diários)
  function variacaoRecente(acao) {
    var hist = acao.historicoPrecos || [];
    if (hist.length < 2) return { valor: 0, pct: 0 };
    var atual = Number(acao.precoAtual || 0);
    var anterior = Number(hist[hist.length - 2].preco || 0);
    return { valor: atual - anterior, pct: anterior > 0 ? ((atual / anterior) - 1) * 100 : 0 };
  }

  // variação % do preço atual em relação ao ponto mais próximo de N dias atrás
  function variacaoDias(acao, dias) {
    var hist = acao.historicoPrecos || [];
    if (!hist.length) return null;
    var alvo = new Date(); alvo.setDate(alvo.getDate() - dias);
    var alvoStr = alvo.toISOString().slice(0, 10);
    var ref = null;
    for (var i = 0; i < hist.length; i++) { if (hist[i].data <= alvoStr) ref = hist[i]; }
    if (!ref) ref = hist[0];
    if (!ref || !ref.preco) return null;
    return ((Number(acao.precoAtual || 0) / ref.preco) - 1) * 100;
  }

  // ---------------------------------------------------------------------
  // PATRIMÔNIO (junta bancos + investimentos + ações − dívidas)
  // ---------------------------------------------------------------------
  function patrimonio(d) {
    var F = global.Financeiro;
    var bancos = F.totalBancos(d);
    var investOutros = totalAtualOutros(d);
    var acoes = totalCarteiraAcoes(d);
    var dividas = F.totalAPagar(d); // contas ainda não pagas = dívidas em aberto
    return {
      bancos: bancos,
      investimentos: investOutros,
      acoes: acoes,
      dividas: dividas,
      liquido: bancos + investOutros + acoes - dividas,
      bruto: bancos + investOutros + acoes
    };
  }

  function percentualInvestido(d) {
    var p = patrimonio(d);
    return p.bruto > 0 ? ((p.investimentos + p.acoes) / p.bruto) * 100 : 0;
  }

  // adiciona (ou atualiza, se já existir hoje) um ponto no histórico de
  // patrimônio guardado nos dados — chamado sempre que a página é aberta
  // ou algo muda, para o gráfico de evolução crescer sozinho com o uso.
  function registrarPontoPatrimonio(d) {
    var hj = new Date().toISOString().slice(0, 10);
    var p = patrimonio(d);
    var hist = d.historicoPatrimonio;
    var ultimo = hist[hist.length - 1];
    if (ultimo && ultimo.data === hj) {
      ultimo.valor = Math.round(p.liquido);
    } else {
      hist.push({ data: hj, valor: Math.round(p.liquido) });
      if (hist.length > 366) hist.shift();
    }
    return d;
  }

  global.Investimentos = {
    resultadoInvestimento: resultadoInvestimento,
    rentabilidadeInvestimento: rentabilidadeInvestimento,
    diasCorridos: diasCorridos,
    diasAteVencimento: diasAteVencimento,
    aliquotaIR: aliquotaIR,
    ehIsento: ehIsento,
    impostoInvestimento: impostoInvestimento,
    valorLiquidoInvestimento: valorLiquidoInvestimento,
    rentabilidadeLiquida: rentabilidadeLiquida,
    rentabilidadeAnualizada: rentabilidadeAnualizada,
    listaInvestimentosComCalculo: listaInvestimentosComCalculo,
    totaisInvestimentos: totaisInvestimentos,
    investimentosVencendoEm: investimentosVencendoEm,
    ISENTOS: ISENTOS,
    totalInvestidoOutros: totalInvestidoOutros,
    totalAtualOutros: totalAtualOutros,
    investimentosPorCategoria: investimentosPorCategoria,

    valorInvestidoAcao: valorInvestidoAcao,
    valorAtualAcao: valorAtualAcao,
    resultadoAcao: resultadoAcao,
    rentabilidadeAcao: rentabilidadeAcao,
    totalCarteiraAcoes: totalCarteiraAcoes,
    totalInvestidoAcoes: totalInvestidoAcoes,
    resultadoCarteiraAcoes: resultadoCarteiraAcoes,
    rentabilidadeCarteiraAcoes: rentabilidadeCarteiraAcoes,
    totalDividendosAcoes: totalDividendosAcoes,
    listaAcoesComCalculo: listaAcoesComCalculo,
    composicaoCarteira: composicaoCarteira,
    precoMinMax: precoMinMax,
    variacaoRecente: variacaoRecente,
    variacaoDias: variacaoDias,

    patrimonio: patrimonio,
    percentualInvestido: percentualInvestido,
    registrarPontoPatrimonio: registrarPontoPatrimonio
  };
})(window);
