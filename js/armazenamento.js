/**
 * armazenamento.js
 * -----------------------------------------------------------------------
 * Camada de persistência do Investidor Mestre.
 *
 * Tudo é guardado em uma única chave do localStorage, como um objeto
 * JSON. Este arquivo não sabe nada sobre a interface — só sabe salvar,
 * carregar, exportar, importar e apagar dados, e oferece um pequeno
 * barramento de eventos para que a interface saiba quando os dados
 * mudaram e precise se redesenhar.
 *
 * Funções públicas (todas em window.Armazenamento):
 *   carregarDados()      -> objeto de dados atual (nunca null)
 *   salvarDados(dados)   -> grava no localStorage e notifica ouvintes
 *   exportarDados()      -> dispara o download de um backup .json
 *   importarDados(file)  -> Promise<void>, lê um backup e substitui os dados
 *   limparDados()        -> apaga tudo e recomeça do zero (sem exemplo)
 *   carregarExemplo()    -> repõe os dados de demonstração
 *   novoId()             -> gera um identificador único simples
 *   aoMudar(fn)           -> registra um ouvinte chamado após cada gravação
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var CHAVE = "investidorMestre:v1";
  var ouvintes = [];

  // -------------------------------------------------------------------
  // camada física: banco em arquivo (programa instalado, via Electron)
  // ou localStorage (quando aberto no navegador). A interface não sabe
  // a diferença — só chama carregarDados()/salvarDados().
  // -------------------------------------------------------------------
  var BD = global.bancoDados && global.bancoDados.ehDesktop ? global.bancoDados : null;
  function lerBruto() {
    if (BD) return BD.ler();
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function gravarBruto(texto) {
    if (BD) { if (!BD.gravar(texto)) throw new Error("gravação em arquivo falhou"); return; }
    localStorage.setItem(CHAVE, texto);
  }

  // ---------------------------------------------------------------------
  // utilidades
  // ---------------------------------------------------------------------
  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function hoje(offsetDias) {
    var d = new Date();
    if (offsetDias) d.setDate(d.getDate() + offsetDias);
    return d.toISOString().slice(0, 10);
  }

  function aoMudar(fn) {
    if (typeof fn === "function") ouvintes.push(fn);
  }

  function notificar() {
    ouvintes.forEach(function (fn) {
      try { fn(); } catch (e) { console.error("Erro em ouvinte de dados:", e); }
    });
  }

  // ---------------------------------------------------------------------
  // esquema vazio (usuário que zera tudo cai aqui)
  // ---------------------------------------------------------------------
  function esquemaVazio() {
    return {
      versao: 1,
      demo: false,
      bancos: [],
      entradas: [],
      despesas: [],
      cartoes: [],
      contasPagar: [],
      investimentos: [],
      acoes: [],
      metas: [],
      historicoPatrimonio: [],
      notificacoesLidas: [],
      atualizadoEm: null,
      config: { ultimoBackup: null }
    };
  }

  // ---------------------------------------------------------------------
  // dados de demonstração — claramente marcados (demo:true) para que a
  // interface possa avisar o usuário e oferecer removê-los com um clique
  // ---------------------------------------------------------------------
  function dadosDemo() {
    var d = esquemaVazio();
    d.demo = true;

    var bcoNu = novoId(), bcoItau = novoId(), bcoInter = novoId(), bcoCaixa = novoId();
    d.bancos = [
      { id: bcoNu, nome: "Nubank", tipo: "Conta corrente", agencia: "0001", conta: "12345-6", saldoInicial: 2500, cor: "#8A2BE2", obs: "" },
      { id: bcoItau, nome: "Itaú", tipo: "Conta corrente", agencia: "0872", conta: "88213-1", saldoInicial: 6000, cor: "#FF7A00", obs: "" },
      { id: bcoInter, nome: "Inter", tipo: "Conta digital", agencia: "0001", conta: "55201-9", saldoInicial: 1800, cor: "#FF7A00", obs: "" },
      { id: bcoCaixa, nome: "Caixa", tipo: "Poupança", agencia: "1234", conta: "00998-2", saldoInicial: 900, cor: "#0057B8", obs: "" }
    ];

    var cartaoNu = novoId();
    d.cartoes = [
      { id: cartaoNu, nome: "Nubank Ultravioleta", bancoId: bcoNu, limite: 10000, diaFechamento: 22, diaVencimento: 5 }
    ];

    d.entradas = [
      { id: novoId(), data: hoje(-25), descricao: "Salário", categoria: "Salário", bancoId: bcoItau, valor: 9800, tipo: "Fixa", recorrente: true, obs: "" },
      { id: novoId(), data: hoje(-25), descricao: "Salário mês anterior", categoria: "Salário", bancoId: bcoItau, valor: 9800, tipo: "Fixa", recorrente: true, obs: "" },
      { id: novoId(), data: hoje(-10), descricao: "Freelance - site institucional", categoria: "Freelance", bancoId: bcoNu, valor: 1500, tipo: "Variável", recorrente: false, obs: "" },
      { id: novoId(), data: hoje(-4), descricao: "Dividendos ITSA4", categoria: "Dividendos", bancoId: bcoInter, valor: 84.30, tipo: "Variável", recorrente: false, obs: "" }
    ];

    d.despesas = [
      { id: novoId(), data: hoje(-27), descricao: "Aluguel", categoria: "Moradia", bancoId: bcoItau, cartaoId: "", valor: 2400, formaPagamento: "Débito automático", recorrente: true, obs: "" },
      { id: novoId(), data: hoje(-20), descricao: "Supermercado", categoria: "Alimentação", bancoId: bcoNu, cartaoId: cartaoNu, valor: 680.40, formaPagamento: "Cartão de crédito", recorrente: false, obs: "" },
      { id: novoId(), data: hoje(-18), descricao: "Combustível", categoria: "Transporte", bancoId: bcoNu, cartaoId: cartaoNu, valor: 260, formaPagamento: "Cartão de crédito", recorrente: false, obs: "" },
      { id: novoId(), data: hoje(-15), descricao: "Plano de saúde", categoria: "Saúde", bancoId: bcoItau, cartaoId: "", valor: 590, formaPagamento: "Débito automático", recorrente: true, obs: "" },
      { id: novoId(), data: hoje(-9), descricao: "Streaming (assinaturas)", categoria: "Assinaturas", bancoId: bcoNu, cartaoId: cartaoNu, valor: 79.70, formaPagamento: "Cartão de crédito", recorrente: true, obs: "" },
      { id: novoId(), data: hoje(-6), descricao: "Restaurante", categoria: "Lazer", bancoId: bcoNu, cartaoId: cartaoNu, valor: 165, formaPagamento: "Cartão de crédito", recorrente: false, obs: "" },
      { id: novoId(), data: hoje(-2), descricao: "Farmácia", categoria: "Saúde", bancoId: bcoInter, cartaoId: "", valor: 98.50, formaPagamento: "Débito", recorrente: false, obs: "" }
    ];

    d.contasPagar = [
      { id: novoId(), descricao: "Condomínio", categoria: "Moradia", vencimento: hoje(3), valor: 680, status: "Pendente" },
      { id: novoId(), descricao: "Fatura do cartão Nubank", categoria: "Cartão de crédito", vencimento: hoje(5), valor: 1185.10, status: "Pendente" },
      { id: novoId(), descricao: "IPVA parcela 2/3", categoria: "Impostos", vencimento: hoje(-4), valor: 420, status: "Atrasado" },
      { id: novoId(), descricao: "Internet", categoria: "Moradia", vencimento: hoje(-15), valor: 120, status: "Pago" }
    ];

    d.investimentos = [
      { id: novoId(), categoria: "Tesouro Direto", nome: "Tesouro Selic 2029", tipoAtivo: "Tesouro Selic", emissor: "Tesouro Nacional",
        liquidez: "Liquidez diária", valorInvestido: 15000, valorAtual: 15980, quantidade: 1.02, dataAplicacao: hoje(-200),
        dataVencimento: hoje(1200), indexador: "Selic +", taxaContratada: 0.1, isentoIR: false, obs: "" },
      { id: novoId(), categoria: "Renda fixa", nome: "CDB 110% CDI", tipoAtivo: "CDB", emissor: "Banco Inter",
        liquidez: "Liquidez diária", valorInvestido: 10000, valorAtual: 10540, quantidade: 0, dataAplicacao: hoje(-160),
        dataVencimento: hoje(560), indexador: "% do CDI", taxaContratada: 110, isentoIR: false, obs: "" },
      { id: novoId(), categoria: "Renda fixa", nome: "LCI 95% CDI", tipoAtivo: "LCI", emissor: "Banco do Brasil",
        liquidez: "No vencimento", valorInvestido: 8000, valorAtual: 8380, quantidade: 0, dataAplicacao: hoje(-300),
        dataVencimento: hoje(45), indexador: "% do CDI", taxaContratada: 95, isentoIR: true, obs: "isento de IR" },
      { id: novoId(), categoria: "Fundos", nome: "Fundo Multimercado XP", tipoAtivo: "Fundo multimercado", emissor: "XP",
        liquidez: "Sem liquidez diária", valorInvestido: 5000, valorAtual: 5210, quantidade: 3210.55, dataAplicacao: hoje(-90),
        dataVencimento: "", indexador: "Não se aplica", taxaContratada: 0, isentoIR: false, obs: "" }
    ];

    d.acoes = [
      { id: novoId(), ticker: "PETR4", empresa: "Petrobras PN", categoria: "Ação", quantidade: 300, precoMedio: 33.10, precoAtual: 36.42, atualizadoEm: hoje(-1),
        historicoPrecos: gerarHistoricoPreco(36.42, 33.10, 60), dividendos: 412.50, obs: "" },
      { id: novoId(), ticker: "VALE3", empresa: "Vale ON", categoria: "Ação", quantidade: 150, precoMedio: 62.80, precoAtual: 59.17, atualizadoEm: hoje(-1),
        historicoPrecos: gerarHistoricoPreco(59.17, 62.80, 60), dividendos: 298.00, obs: "" },
      { id: novoId(), ticker: "ITUB4", empresa: "Itaú Unibanco PN", categoria: "Ação", quantidade: 200, precoMedio: 24.10, precoAtual: 27.63, atualizadoEm: hoje(-1),
        historicoPrecos: gerarHistoricoPreco(27.63, 24.10, 60), dividendos: 180.00, obs: "" },
      { id: novoId(), ticker: "BBAS3", empresa: "Banco do Brasil ON", categoria: "Ação", quantidade: 220, precoMedio: 24.15, precoAtual: 27.41, atualizadoEm: hoje(-1),
        historicoPrecos: gerarHistoricoPreco(27.41, 24.15, 60), dividendos: 356.20, obs: "" },
      { id: novoId(), ticker: "WEGE3", empresa: "WEG ON", categoria: "Ação", quantidade: 120, precoMedio: 38.20, precoAtual: 41.85, atualizadoEm: hoje(-1),
        historicoPrecos: gerarHistoricoPreco(41.85, 38.20, 60), dividendos: 64.30, obs: "" },
      { id: novoId(), ticker: "MXRF11", empresa: "Maxi Renda FII", categoria: "FII", quantidade: 900, precoMedio: 9.98, precoAtual: 10.24, atualizadoEm: hoje(-1),
        historicoPrecos: gerarHistoricoPreco(10.24, 9.98, 60), dividendos: 540.00, obs: "" }
    ];

    d.metas = [
      { id: novoId(), nome: "Reserva de emergência", objetivo: 30000, atual: 18500, prazo: hoje(180), cor: "#22E08A" },
      { id: novoId(), nome: "Viagem para o Chile", objetivo: 8000, atual: 2300, prazo: hoje(120), cor: "#3FC1E0" },
      { id: novoId(), nome: "Entrada do apartamento", objetivo: 60000, atual: 21000, prazo: hoje(540), cor: "#FFB020" }
    ];

    d.investimentos.forEach(function (inv) {
      inv.historicoValores = gerarHistoricoValor(inv.valorAtual, inv.valorInvestido, 6);
    });

    d.historicoPatrimonio = gerarHistoricoPatrimonio(d);
    return d;
  }

  // série mensal do valor de um investimento, terminando no valor atual
  function gerarHistoricoValor(valorAtual, valorAplicado, meses) {
    var pontos = [];
    for (var m = meses; m >= 0; m--) {
      var t = 1 - m / meses;
      var dt = new Date();
      dt.setMonth(dt.getMonth() - m);
      pontos.push({ data: dt.toISOString().slice(0, 10), valor: Number((valorAplicado + (valorAtual - valorAplicado) * t).toFixed(2)) });
    }
    pontos[pontos.length - 1].valor = valorAtual;
    return pontos;
  }

  // gera uma série de preços com leve ruído terminando no preço atual —
  // só para a demonstração ter um gráfico de evolução para mostrar.
  function gerarHistoricoPreco(precoAtual, precoMedio, dias) {
    var base = precoMedio * 0.97;
    var alvo = precoAtual;
    var pontos = [];
    var seed = precoAtual * 1000 % 97;
    for (var i = dias; i >= 0; i--) {
      var t = 1 - i / dias;
      var ruido = (pseudoAleatorio(seed + i) - 0.5) * (precoAtual * 0.02);
      var valor = base + (alvo - base) * t + ruido;
      var d = new Date();
      d.setDate(d.getDate() - i);
      pontos.push({ data: d.toISOString().slice(0, 10), preco: Math.max(0.01, Number(valor.toFixed(2))) });
    }
    pontos[pontos.length - 1].preco = precoAtual;
    return pontos;
  }
  function pseudoAleatorio(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // gera uma série de patrimônio dos últimos 6 meses terminando no valor
  // atual real calculado a partir dos dados de demonstração acima.
  function gerarHistoricoPatrimonio(d) {
    var totalBancos = d.bancos.reduce(function (s, b) { return s + b.saldoInicial; }, 0);
    var totalInvest = d.investimentos.reduce(function (s, i) { return s + i.valorAtual; }, 0);
    var totalAcoes = d.acoes.reduce(function (s, a) { return s + a.quantidade * a.precoAtual; }, 0);
    var alvo = totalBancos + totalInvest + totalAcoes;
    var pontos = [];
    for (var m = 5; m >= 0; m--) {
      var fator = 0.82 + (5 - m) * 0.036;
      var dt = new Date();
      dt.setMonth(dt.getMonth() - m);
      pontos.push({ data: dt.toISOString().slice(0, 10), valor: Math.round(alvo * fator) });
    }
    pontos[pontos.length - 1].valor = Math.round(alvo);
    return pontos;
  }

  // ---------------------------------------------------------------------
  // carregar / salvar
  // ---------------------------------------------------------------------
  function migrar(d) {
    var base = esquemaVazio();
    Object.keys(base).forEach(function (k) {
      if (d[k] === undefined) d[k] = base[k];
    });
    return d;
  }

  function carregarDados() {
    var bruto = lerBruto();
    if (!bruto) {
      var demo = dadosDemo();
      salvarDados(demo, true);
      return demo;
    }
    try {
      return migrar(JSON.parse(bruto));
    } catch (e) {
      console.error("Dados corrompidos, recomeçando com exemplo.", e);
      var reset = dadosDemo();
      salvarDados(reset, true);
      return reset;
    }
  }

  function salvarDados(dados, semNotificar, semCarimbo) {
    if (!semCarimbo) dados.atualizadoEm = new Date().toISOString();
    try {
      gravarBruto(JSON.stringify(dados));
    } catch (e) {
      console.error("Não foi possível salvar os dados:", e);
      if (global.UI && global.UI.toast) global.UI.toast("Não consegui salvar — armazenamento cheio ou bloqueado.");
    }
    if (!semNotificar) notificar();
  }

  function limparDados() {
    var vazio = esquemaVazio();
    salvarDados(vazio);
    return vazio;
  }

  function carregarExemplo() {
    var demo = dadosDemo();
    salvarDados(demo);
    return demo;
  }

  // ---------------------------------------------------------------------
  // backup
  // ---------------------------------------------------------------------
  function exportarDados() {
    var dados = carregarDados();
    dados.config.ultimoBackup = new Date().toISOString();
    salvarDados(dados);
    var carimboArq = new Date().toISOString().slice(0, 10);
    if (BD && BD.salvarArquivo) { BD.salvarArquivo("muller-mendes-backup-" + carimboArq + ".json", JSON.stringify(dados, null, 2)); return; }
    var blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var carimbo = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "muller-mendes-backup-" + carimbo + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importarDados(arquivo) {
    return new Promise(function (resolve, reject) {
      var leitor = new FileReader();
      leitor.onload = function () {
        try {
          var obj = JSON.parse(leitor.result);
          if (!obj || !Array.isArray(obj.bancos)) {
            reject(new Error("Esse arquivo não parece ser um backup do Muller Mendes."));
            return;
          }
          salvarDados(migrar(obj));
          resolve(obj);
        } catch (e) {
          reject(new Error("Não consegui ler esse arquivo. Verifique se é o JSON exportado pelo próprio sistema."));
        }
      };
      leitor.onerror = function () { reject(new Error("Falha ao ler o arquivo.")); };
      leitor.readAsText(arquivo);
    });
  }

  global.Armazenamento = {
    carregarDados: carregarDados,
    salvarDados: salvarDados,
    limparDados: limparDados,
    carregarExemplo: carregarExemplo,
    exportarDados: exportarDados,
    importarDados: importarDados,
    novoId: novoId,
    hoje: hoje,
    aoMudar: aoMudar,
    ehDesktop: !!BD,
    caminhoBanco: function () { return BD ? BD.caminho() : Promise.resolve("localStorage do navegador"); },
    abrirPastaBanco: function () { if (BD) BD.abrirPasta(); }
  };
})(window);
