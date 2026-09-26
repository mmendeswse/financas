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
 * banco é sempre "saldo inicial + entradas − despesas daquele banco",
 * como pede o enunciado.
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

  function saldoBanco(d, banco) {
    // entradas ainda previstas não entram no saldo da conta
    var totalEntradas = entradasDoBanco(d, banco.id).filter(function (e) { return !e.previsto; })
      .reduce(function (s, e) { return s + Number(e.valor || 0); }, 0);
    var totalDespesas = despesasDoBanco(d, banco.id).reduce(function (s, x) { return s + Number(x.valor || 0); }, 0);
    return Number(banco.saldoInicial || 0) + totalEntradas - totalDespesas;
  }

  function listaBancosComSaldo(d) {
    return d.bancos.map(function (b) {
      return Object.assign({}, b, { saldoAtual: saldoBanco(d, b) });
    });
  }

  function totalBancos(d) {
    return d.bancos.reduce(function (s, b) { return s + saldoBanco(d, b); }, 0);
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
  global.Financeiro = {
    mesAtual: mesAtual,
    mesAnterior: mesAnterior,
    mesDe: mesDe,
    diasEntre: diasEntre,

    saldoBanco: saldoBanco,
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
