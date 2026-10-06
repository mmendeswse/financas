/**
 * financeiro.js
 * -----------------------------------------------------------------------
 * Regras de negócio da parte "bancária" do sistema: contas, entradas,
 * despesas, cartões de crédito e contas a pagar.
 *
 * Este módulo não toca no DOM — ele lê o objeto de dados (via
 * Armazenamento.carregarDados) e devolve números e listas já calculados.
 * Quem desenha a tela é o app.js.
 *
 * Tudo aqui é CALCULADO, nunca armazenado como valor fixo: o saldo de um
 * banco é sempre "saldo inicial + entradas − despesas daquele banco"
 * (incluindo contas a pagar e repetições marcadas como pagas).
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var A = global.Armazenamento;

  // ---------------------------------------------------------------------
  // helpers de data
  // ---------------------------------------------------------------------
  function mesDe(dataStr) { return dataStr ? dataStr.slice(0, 7) : ""; } // "AAAA-MM"
  function mesAtual() { return new Date().toISOString().slice(0, 7); }
  function mesAnterior() {
    var d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }
  function diasEntre(dataStr) {
    var alvo = new Date(dataStr + "T00:00:00");
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return Math.round((alvo - hoje) / 86400000);
  }

  // ---------------------------------------------------------------------
  // BANCOS
  // ---------------------------------------------------------------------
  function entradasDoBanco(d, bancoId) {
    return d.entradas.filter(function (e) { return e.bancoId === bancoId; });
  }
  function despesasDoBanco(d, bancoId) {
    // despesas pagas em cartão não saem direto do banco; só débito/pix/dinheiro
    return d.despesas.filter(function (x) { return x.bancoId === bancoId && !x.cartaoId; });
  }

  // Movimentos que não estão em entradas/despesas, mas mexem no saldo:
  //  - contas a pagar marcadas como "Pago" (saem do banco escolhido);
  //  - repetições de lançamentos recorrentes marcadas como pagas no mês
  //    (calculadas pelo app.js, que conhece as regras de repetição).
  // Cada item: { bancoId, valor (positivo entra, negativo sai), data }.
  var movimentosExtras = null;
  function definirMovimentosExtras(fn) { movimentosExtras = fn; }

  function outrosMovimentos(d) {
    var lista = (d.contasPagar || [])
      .filter(function (c) { return c.status === "Pago" && c.bancoId && !c.cartaoId; })
      .map(function (c) { return { bancoId: c.bancoId, valor: -Number(c.valor || 0), data: c.vencimento }; });
    return movimentosExtras ? lista.concat(movimentosExtras(d) || []) : lista;
  }

  function movimentosDoBanco(d, bancoId) {
    return outrosMovimentos(d).filter(function (m) { return m.bancoId === bancoId; });
  }

  // saldo da própria conta, sem cobertura de outros bancos
  function saldoProprio(d, banco, extras) {
    // entradas ainda previstas não entram no saldo da conta
    var totalEntradas = entradasDoBanco(d, banco.id).filter(function (e) { return !e.previsto; })
      .reduce(function (s, e) { return s + Number(e.valor || 0); }, 0);
    var totalDespesas = despesasDoBanco(d, banco.id).reduce(function (s, x) { return s + Number(x.valor || 0); }, 0);
    var totalExtras = (extras || outrosMovimentos(d))
      .filter(function (m) { return m.bancoId === banco.id; })
      .reduce(function (s, m) { return s + Number(m.valor || 0); }, 0);
    return Number(banco.saldoInicial || 0) + totalEntradas - totalDespesas + totalExtras;
  }

  var centavos = function (v) { return Math.round(v * 100) / 100; };

  // Saldo de cada banco. Quando uma conta fica negativa (ex.: a fatura do
  // cartão Nubank paga pelo Nubank, mas o salário caiu no Banco do Brasil),
  // a falta é coberta pelo dinheiro positivo dos outros bancos, começando
  // pelo maior saldo — como uma transferência para pagar a conta. O total
  // em bancos não muda; só a divisão entre as contas.
  function listaBancosComSaldo(d) {
    var extras = outrosMovimentos(d);
    var lista = d.bancos.map(function (b) {
      var proprio = centavos(saldoProprio(d, b, extras));
      return Object.assign({}, b, { saldoProprio: proprio, saldoAtual: proprio, coberturas: [] });
    });
    lista.filter(function (b) { return b.saldoAtual < 0; }).forEach(function (neg) {
      lista.filter(function (b) { return b.saldoAtual > 0; })
        .sort(function (a, b) { return b.saldoAtual - a.saldoAtual; })
        .forEach(function (doador) {
          if (neg.saldoAtual >= 0) return;
          var v = centavos(Math.min(doador.saldoAtual, -neg.saldoAtual));
          doador.saldoAtual = centavos(doador.saldoAtual - v);
          neg.saldoAtual = centavos(neg.saldoAtual + v);
          neg.coberturas.push({ bancoId: doador.id, nome: doador.nome, valor: v });       // recebeu
          doador.coberturas.push({ bancoId: neg.id, nome: neg.nome, valor: -v });        // cedeu
        });
    });
    return lista;
  }

  function saldoBanco(d, banco) {
    var b = listaBancosComSaldo(d).filter(function (x) { return x.id === banco.id; })[0];
    return b ? b.saldoAtual : saldoProprio(d, banco);
  }

  function totalBancos(d) {
    var extras = outrosMovimentos(d);
    return d.bancos.reduce(function (s, b) { return s + saldoProprio(d, b, extras); }, 0);
  }

  function nomeBanco(d, bancoId) {
    var b = d.bancos.filter(function (x) { return x.id === bancoId; })[0];
    return b ? b.nome : "—";
  }

  // ---------------------------------------------------------------------
  // ENTRADAS / DESPESAS — totais e filtros por período
  // ---------------------------------------------------------------------
  function entradasNoMes(d, mes) {
    mes = mes || mesAtual();
    return d.entradas.filter(function (e) { return mesDe(e.data) === mes; });
  }
  function despesasNoMes(d, mes) {
    mes = mes || mesAtual();
    return d.despesas.filter(function (x) { return mesDe(x.data) === mes; });
  }
  function totalEntradasMes(d, mes) {
    return entradasNoMes(d, mes).filter(function (e) { return !e.previsto; })
      .reduce(function (s, e) { return s + Number(e.valor || 0); }, 0);
  }
  function totalEntradasPrevistasMes(d, mes) {
    return entradasNoMes(d, mes).filter(function (e) { return e.previsto; })
      .reduce(function (s, e) { return s + Number(e.valor || 0); }, 0);
  }
  function totalDespesasMes(d, mes) {
    return despesasNoMes(d, mes).reduce(function (s, x) { return s + Number(x.valor || 0); }, 0);
  }
  function resultadoMes(d, mes) {
    return totalEntradasMes(d, mes) - totalDespesasMes(d, mes);
  }

  function variacaoPercentual(atual, anterior) {
    if (!anterior) return atual > 0 ? 100 : 0;
    return ((atual - anterior) / Math.abs(anterior)) * 100;
  }

  function despesasPorCategoria(d, mes) {
    var mapa = {};
    despesasNoMes(d, mes).forEach(function (x) {
      var c = x.categoria || "Outros";
      mapa[c] = (mapa[c] || 0) + Number(x.valor || 0);
    });
    return Object.keys(mapa)
      .map(function (c) { return { categoria: c, valor: mapa[c] }; })
      .sort(function (a, b) { return b.valor - a.valor; });
  }

  function maiorCategoriaDeGasto(d, mes) {
    var lista = despesasPorCategoria(d, mes);
    return lista.length ? lista[0] : null;
  }

  function maiorDespesa(d, mes) {
    var lista = despesasNoMes(d, mes);
    if (!lista.length) return null;
    return lista.reduce(function (a, b) { return Number(b.valor) > Number(a.valor) ? b : a; });
  }

  function mediaDiariaDespesas(d, mes) {
    mes = mes || mesAtual();
    var total = totalDespesasMes(d, mes);
    var hoje = new Date();
    var ehMesAtual = mes === mesAtual();
    var dia = ehMesAtual ? hoje.getDate() : new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
    return dia > 0 ? total / dia : 0;
  }

  // série dos últimos N meses (para o gráfico receitas x despesas)
  function serieMensal(d, meses) {
    meses = meses || 6;
    var out = [];
    for (var i = meses - 1; i >= 0; i--) {
      var dt = new Date();
      dt.setDate(1);
      dt.setMonth(dt.getMonth() - i);
      var chave = dt.toISOString().slice(0, 7);
      out.push({
        mes: chave,
        rotulo: dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        entradas: totalEntradasMes(d, chave),
        despesas: totalDespesasMes(d, chave)
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // CARTÕES DE CRÉDITO
  // ---------------------------------------------------------------------
  // fatura em aberto = despesas lançadas nesse cartão desde o último
  // fechamento até hoje (aproximação simples baseada no dia de fechamento)
  function inicioFaturaAtual(cartao) {
    var hoje = new Date();
    var fech = Number(cartao.diaFechamento) || 1;
    var ref = new Date(hoje.getFullYear(), hoje.getMonth(), fech);
    if (hoje.getDate() <= fech) ref.setMonth(ref.getMonth() - 1);
    return ref;
  }

  function despesasDoCartao(d, cartaoId) {
    return d.despesas.filter(function (x) { return x.cartaoId === cartaoId; });
  }

  function limiteUsadoCartao(d, cartao) {
    var inicio = inicioFaturaAtual(cartao);
    return despesasDoCartao(d, cartao.id)
      .filter(function (x) { return new Date(x.data + "T00:00:00") > inicio; })
      .reduce(function (s, x) { return s + Number(x.valor || 0); }, 0);
  }

  function faturaAtualCartao(d, cartao) {
    // total de tudo lançado no cartão que ainda não foi marcado como pago
    // via "Contas a pagar" — aqui mostramos o total do ciclo em aberto
    return limiteUsadoCartao(d, cartao);
  }

  function listaCartoesComUso(d) {
    return d.cartoes.map(function (c) {
      var usado = limiteUsadoCartao(d, c);
      return Object.assign({}, c, {
        limiteUsado: usado,
        limiteDisponivel: Number(c.limite || 0) - usado,
        percentualUso: c.limite > 0 ? (usado / c.limite) * 100 : 0,
        bancoNome: nomeBanco(d, c.bancoId)
      });
    });
  }

  // ---------------------------------------------------------------------
  // CONTAS A PAGAR
  // ---------------------------------------------------------------------
  function statusReal(conta) {
    // "Pago" é definitivo; senão, comparamos a data para achar atraso
    if (conta.status === "Pago") return "Pago";
    return diasEntre(conta.vencimento) < 0 ? "Atrasado" : "Pendente";
  }

  function listaContasPagarComStatus(d) {
    return d.contasPagar.map(function (c) {
      return Object.assign({}, c, { statusReal: statusReal(c), diasParaVencer: diasEntre(c.vencimento) });
    });
  }

  function contasVencendoEm(d, dias) {
    return listaContasPagarComStatus(d).filter(function (c) {
      return c.statusReal !== "Pago" && c.diasParaVencer >= 0 && c.diasParaVencer <= dias;
    });
  }

  function contasAtrasadas(d) {
    return listaContasPagarComStatus(d).filter(function (c) { return c.statusReal === "Atrasado"; });
  }

  function totalAPagar(d) {
    return d.contasPagar
      .filter(function (c) { return c.status !== "Pago"; })
      .reduce(function (s, c) { return s + Number(c.valor || 0); }, 0);
  }

  function totalAReceber(d) {
    // não há cadastro próprio de "a receber" no formulário — tratamos
    // entradas futuras (data > hoje) como valores a receber
    var hj = A.hoje(0);
    return d.entradas
      .filter(function (e) { return e.data > hj; })
      .reduce(function (s, e) { return s + Number(e.valor || 0); }, 0);
  }

  // ---------------------------------------------------------------------
  // exportação
  // ---------------------------------------------------------------------

  // =========================================================================
  // DIAS ÚTEIS E DATA DE PAGAMENTO ("Mensal – 4º dia útil")
  // =========================================================================
  // Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário gregoriano)
  function pascoa(ano) {
    var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  }
  function isoLocal(dt) {
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }
  // feriados nacionais do ano: fixos + Sexta-feira Santa (Páscoa − 2 dias)
  var cacheFeriados = {};
  function feriadosNacionais(ano) {
    if (cacheFeriados[ano]) return cacheFeriados[ano];
    var fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
    var lista = {};
    fixos.forEach(function (md) { lista[ano + "-" + md] = true; });
    var p = pascoa(ano);
    lista[isoLocal(new Date(p.getFullYear(), p.getMonth(), p.getDate() - 2))] = true;
    cacheFeriados[ano] = lista;
    return lista;
  }
  function ehFeriado(dt) { return !!feriadosNacionais(dt.getFullYear())[isoLocal(dt)]; }

  // enésimo dia do mês que passa no filtro (dias da semana aceitos, sem feriados)
  function enesimoDia(ano, mes, n, diasAceitos) {
    var cont = 0;
    for (var dia = 1; dia <= 31; dia++) {
      var dt = new Date(ano, mes - 1, dia);
      if (dt.getMonth() !== mes - 1) break;
      if (diasAceitos.indexOf(dt.getDay()) === -1 || ehFeriado(dt)) continue;
      if (++cont === n) return dt;
    }
    return null;
  }

  // Data de pagamento de um mês (mes = 1..12):
  //  - data: 4º dia útil (segunda a sexta, sem feriados nacionais)
  //  - alertaSabado: contando de segunda a sábado (sem domingos e feriados),
  //    se o 4º dia cair num sábado, o dinheiro já pode ser resgatado nesse sábado
  function calcularDataPagamento(ano, mes) {
    return calcularDataRegra(ano, mes, { tipo: "diaUtil", n: 4 });
  }

  var ehDiaUtil = function (dt) { var s = dt.getDay(); return s >= 1 && s <= 5 && !ehFeriado(dt); };

  // Data de um mês segundo uma regra de repetição "Personalizar":
  //  { tipo: "diaUtil", n }        → n-ésimo dia útil (seg–sex, sem feriados);
  //                                  alerta de sábado se, contando seg–sáb, o n-ésimo cair num sábado
  //  { tipo: "ultimoDiaUtil" }     → último dia útil do mês
  //  { tipo: "diaFixo", n, ajuste } → dia n do mês (ou o último, se o mês for mais curto);
  //                                  se cair em fim de semana/feriado: "proximo" dia útil,
  //                                  "anterior" dia útil ou "manter" a data
  function calcularDataRegra(ano, mes, regra) {
    regra = regra || { tipo: "diaUtil", n: 4 };
    var n = Math.max(1, Number(regra.n) || 1);
    var ultimoDia = new Date(ano, mes, 0).getDate();
    if (regra.tipo === "ultimoDiaUtil") {
      for (var d = ultimoDia; d >= 1; d--) { var dt = new Date(ano, mes - 1, d); if (ehDiaUtil(dt)) return { data: isoLocal(dt), alertaSabado: false, dataSabado: null }; }
    }
    if (regra.tipo === "diaFixo") {
      var alvo = new Date(ano, mes - 1, Math.min(n, ultimoDia));
      var passo = regra.ajuste === "anterior" ? -1 : 1;
      if (regra.ajuste !== "manter") { while (!ehDiaUtil(alvo)) alvo.setDate(alvo.getDate() + passo); }
      return { data: isoLocal(alvo), alertaSabado: false, dataSabado: null };
    }
    // "diaUtil" (padrão); se o mês não tiver n dias úteis, usa o último
    var util = enesimoDia(ano, mes, n, [1, 2, 3, 4, 5]);
    if (!util) return calcularDataRegra(ano, mes, { tipo: "ultimoDiaUtil" });
    var comSabado = enesimoDia(ano, mes, n, [1, 2, 3, 4, 5, 6]);
    var alerta = !!comSabado && comSabado.getDay() === 6;
    return { data: isoLocal(util), alertaSabado: alerta, dataSabado: alerta ? isoLocal(comSabado) : null };
  }

  global.Financeiro = {
    calcularDataPagamento: calcularDataPagamento,
    calcularDataRegra: calcularDataRegra,
    feriadosNacionais: feriadosNacionais,
    mesAtual: mesAtual,
    mesAnterior: mesAnterior,
    mesDe: mesDe,
    diasEntre: diasEntre,

    saldoBanco: saldoBanco,
    definirMovimentosExtras: definirMovimentosExtras,
    movimentosDoBanco: movimentosDoBanco,
    listaBancosComSaldo: listaBancosComSaldo,
    totalBancos: totalBancos,
    nomeBanco: nomeBanco,

    entradasNoMes: entradasNoMes,
    despesasNoMes: despesasNoMes,
    totalEntradasMes: totalEntradasMes,
    totalEntradasPrevistasMes: totalEntradasPrevistasMes,
    totalDespesasMes: totalDespesasMes,
    resultadoMes: resultadoMes,
    variacaoPercentual: variacaoPercentual,
    despesasPorCategoria: despesasPorCategoria,
    maiorCategoriaDeGasto: maiorCategoriaDeGasto,
    maiorDespesa: maiorDespesa,
    mediaDiariaDespesas: mediaDiariaDespesas,
    serieMensal: serieMensal,

    listaCartoesComUso: listaCartoesComUso,
    limiteUsadoCartao: limiteUsadoCartao,

    statusReal: statusReal,
    listaContasPagarComStatus: listaContasPagarComStatus,
    contasVencendoEm: contasVencendoEm,
    contasAtrasadas: contasAtrasadas,
    totalAPagar: totalAPagar,
    totalAReceber: totalAReceber
  };
})(window);
