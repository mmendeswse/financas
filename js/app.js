/**
 * app.js — Investidor Mestre
 * -----------------------------------------------------------------------
 * Camada de interface. Este arquivo é o único que toca no DOM: lê os
 * dados através de Armazenamento/Financeiro/Investimentos e desenha cada
 * seção como uma string HTML injetada em #conteudo, sem recarregar a
 * página. Cliques dentro de #conteudo são tratados por delegação de
 * eventos (um único listener, ligado uma vez em iniciar()).
 * -----------------------------------------------------------------------
 */
(function () {
  "use strict";

  const A = window.Armazenamento;
  const F = window.Financeiro;
  const I = window.Investimentos;
  const G = window.Graficos;
  const C = window.Cotacoes;
  let dolar = null;            // { valor, variacaoPct, atualizadoEm }
  let cripto = null;           // { BTC: { valor, variacaoPct }, ETH: { valor, variacaoPct } }
  let buscandoCotacoes = false;

  // Categorias fixas usadas nos formulários (conforme especificação)
  // a cada atualização, suba este número junto com o ?v= do index.html e do sw.js:
  // é a mudança dele que faz o iPad baixar a versão nova
  const VERSAO_APP = "3.6.312";
  const CATS_ENTRADA = ["Salário", "13º salário", "Férias", "Bônus / PLR", "Benefícios (VR/VA)", "Pró-labore", "Freelance", "Venda", "Aluguel recebido",
    "Dividendos", "Juros", "Rendimentos", "Reembolso", "Restituição de IR", "Cashback", "Presente", "Outros"];
  const CATS_DESPESA = ["Alimentação", "Supermercado", "Restaurante", "Delivery", "Moradia", "Aluguel", "Condomínio", "Energia", "Água", "Gás",
    "Internet e telefone", "Transporte", "Combustível", "Estacionamento e pedágio", "Saúde", "Farmácia", "Plano de saúde", "Educação", "Lazer", "Viagem",
    "Compras", "Vestuário", "Beleza e cuidados", "Pets", "Filhos", "Presentes", "Doações", "Assinaturas", "Cartão de crédito", "Seguros", "Impostos",
    "Taxas bancárias", "Empréstimos", "Investimentos", "Outros"];
  // emoji mostrado na frente da descrição: o escolhido no lançamento ou,
  // se não houver, o da categoria
  const EMOJIS_ENTRADA = ["💼", "💰", "💵", "🪙", "🏦", "📈", "💹", "🧾", "💻", "🛍️", "🏷️", "🎁", "🤝", "🏠", "🚗", "💳", "🔁", "🎉", "⭐", "📦"];
  const EMOJIS_DESPESA = ["🛒", "🍽️", "🍔", "☕", "🏠", "💡", "💧", "🔥", "📶", "📱", "🚗", "⛽", "🚌", "✈️", "🩺", "💊", "🦷", "🏋️", "📚", "🎓",
    "🎬", "🎮", "🎵", "🍿", "👕", "🛍️", "🎁", "🐶", "👶", "💇", "🔧", "📺", "🤖", "🧾", "🏛️", "📈", "💳", "🏦", "❤️", "📦"];
  const EMOJI_CATEGORIA = {
    "Salário": "💼", "Freelance": "💻", "Venda": "🏷️", "Dividendos": "📈", "Juros": "🏦", "Cashback": "🔁",
    "Alimentação": "🍽️", "Moradia": "🏠", "Transporte": "🚗", "Saúde": "🩺", "Educação": "📚", "Lazer": "🎬",
    "Compras": "🛍️", "Assinaturas": "📺", "Cartão de crédito": "💳", "Impostos": "🧾", "Investimentos": "📈", "Outros": "📦",
    "13º salário": "💰", "Férias": "🏖️", "Bônus / PLR": "🎉", "Benefícios (VR/VA)": "🍱", "Pró-labore": "🧑‍💼", "Aluguel recebido": "🏘️",
    "Rendimentos": "💹", "Reembolso": "↩️", "Restituição de IR": "🏛️", "Presente": "🎁",
    "Supermercado": "🛒", "Restaurante": "🍴", "Delivery": "🛵", "Aluguel": "🔑", "Condomínio": "🏢", "Energia": "💡", "Água": "💧", "Gás": "🔥",
    "Internet e telefone": "📶", "Combustível": "⛽", "Estacionamento e pedágio": "🅿️", "Farmácia": "💊", "Plano de saúde": "🏥", "Viagem": "✈️",
    "Vestuário": "👕", "Beleza e cuidados": "💇", "Pets": "🐶", "Filhos": "👶", "Presentes": "🎁", "Doações": "❤️", "Seguros": "🛡️",
    "Taxas bancárias": "🏦", "Empréstimos": "💸"
  };
  const descEmoji = (x, padrao) => `<span class="emoji-desc">${emojiDe(x)}</span>${esc((x && x.descricao) || padrao || "")}`;
  // metas: o emoji escolhido ou um sugerido pelo nome
  const EMOJIS_META = ["🎯", "🏠", "🏡", "🚗", "🏍️", "✈️", "🏖️", "🛟", "💰", "🏦", "📈", "🎓", "📚", "💍", "👶", "🐶",
    "💻", "📱", "🎮", "🛋️", "🔧", "🩺", "🎁", "🎉", "⛵", "🌎", "🏋️", "🎸", "📷", "⭐"];
  const EMOJI_META_NOME = [[/apart|casa|im[oó]vel|reforma/i, "🏠"], [/carro|ve[ií]culo/i, "🚗"], [/moto/i, "🏍️"],
    [/viag|f[eé]rias|interc[aâ]mbio/i, "✈️"], [/reserva|emerg/i, "🛟"], [/aposent|invest/i, "📈"], [/estud|faculd|curso|educa/i, "🎓"],
    [/casament|noiv/i, "💍"], [/filh|beb[eê]/i, "👶"], [/computador|notebook/i, "💻"], [/celular|iphone/i, "📱"], [/sa[uú]de/i, "🩺"]];
  const emojiSugeridoMeta = (nome) => { const r = EMOJI_META_NOME.find(([re]) => re.test(nome || "")); return r ? r[1] : "🎯"; };
  const emojiMeta = (m) => (m && m.emoji) || emojiSugeridoMeta(m && m.nome);
  const nomeMeta = (m) => `<span class="emoji-desc">${emojiMeta(m)}</span>${esc(m.nome)}`;
  const emojiDe = (x) => (x && x.emoji) || EMOJI_CATEGORIA[x && x.categoria] || "📦";
  const TIPOS_CONTA_BANCO = ["Conta Corrente", "Conta Poupança", "Conta Digital", "Investimento", "Outro"];
  const FORMAS_PAGAMENTO = ["Débito", "Pix", "Dinheiro", "Cartão Crédito", "Boleto", "Transferência", "Débito Automático"];
  const CATS_INVESTIMENTO = ["Renda fixa", "Tesouro Direto", "Criptomoedas", "Fundos", "Outros"];
  const TIPOS_ATIVO_RF = ["CDB", "LCI", "LCA", "LC", "RDB", "CRI", "CRA", "Debênture", "Debênture incentivada",
    "Tesouro Selic", "Tesouro Prefixado", "Tesouro IPCA+", "Poupança", "Fundo DI", "Fundo multimercado",
    "Fundo imobiliário", "Criptomoeda", "Outro"];
  const INDEXADORES = ["Prefixado", "% do CDI", "CDI +", "IPCA +", "Selic +", "Poupança", "Não se aplica"];
  const LIQUIDEZ = ["Liquidez diária", "Sem liquidez diária", "No vencimento"];
  const CATS_ACAO = ["Ação", "FII", "ETF"];
  const FREQUENCIAS = ["Não se repete", "Semanal", "Quinzenal", "Mensal", "Anual"];
  // registros antigos guardavam só "recorrente: true", que equivalia a mensal
  function freqDe(reg) {
    if (reg && reg.recorrencia) return reg.recorrencia;
    return reg && reg.recorrente ? "Mensal" : FREQUENCIAS[0];
  }
  // Repetição "Personalizar" (entradas e despesas): a data de cada mês segue uma
  // regra (Nº dia útil, último dia útil ou dia fixo), a cada N meses, e o
  // lançamento do mês é criado sozinho quando o mês é aberto.
  const FREQ_PERS = "Personalizar";
  const FREQ_4DU_ANTIGA = "Mensal – 4º dia útil";           // versão anterior, convertida ao carregar
  const FREQUENCIAS_REP = [...FREQUENCIAS, FREQ_PERS];
  // nome mostrado na tela; o valor gravado nos lançamentos continua o mesmo
  const ROTULO_FREQ = { [FREQUENCIAS[0]]: "Única", [FREQ_PERS]: "Personalizada" };
  const REGRA_PADRAO = { tipo: "diaUtil", n: 4, ajuste: "proximo", intervalo: 1 };
  const ehPers = (reg) => !!reg && reg.recorrencia === FREQ_PERS;
  const regraDe = (reg) => ({ ...REGRA_PADRAO, ...((reg && reg.regraRep) || {}) });
  // número de parcela com dois dígitos: 1/16 → 01/16
  const dd = (n) => String(n).padStart(2, "0");
  const dataReg = (x) => String((x && (x.data || x.vencimento)) || "");
  const mesReg = (x) => dataReg(x).slice(0, 7);
  const dataDoMesRegra = (regra, mes) => { const [a, m] = mes.split("-").map(Number); return F.calcularDataRegra(a, m, regra).data; };
  function rotuloRegra(regra) {
    if (regra.tipo === "ultimoDiaUtil") return "último dia útil";
    if (regra.tipo === "diaFixo") return `dia ${regra.n}` + (regra.ajuste === "anterior" ? " (ou dia útil anterior)" : regra.ajuste === "manter" ? "" : " (ou próximo dia útil)");
    return `${regra.n}º dia útil`;
  }
  function rotuloIntervalo(n) {
    return ({ 1: "mensal", 2: "bimestral", 3: "trimestral", 6: "semestral", 12: "anual" })[Number(n) || 1] || `a cada ${n} meses`;
  }
  // Parcelas de uma série "Personalizar": regra.parcelas = total e
  // regra.primeiraParcela = mês (AAAA-MM) da parcela 1. Devolve o número da
  // parcela daquele mês (1, 2, …) ou 0 se a série não tiver parcelas.
  function numeroParcela(regra, mes) {
    if (!regra || !(Number(regra.parcelas) > 0) || !regra.primeiraParcela || !mes) return 0;
    const [a0, m0] = regra.primeiraParcela.split("-").map(Number), [a1, m1] = mes.split("-").map(Number);
    return Math.floor(((a1 - a0) * 12 + (m1 - m0)) / Math.max(1, Number(regra.intervalo) || 1)) + 1;
  }
  // semSabado: o aviso "⚠️ sábado" fica fora (as guias o mostram embaixo da data)
  function seloFreq(reg, semSabado) {
    const f = freqDe(reg);
    if (f === FREQ_PERS) {
      const regra = regraDe(reg);
      const n = numeroParcela(regra, mesReg(reg));
      if (n > 0) return ` <span class="selo-tag selo-cat" title="Parcela ${n} de ${regra.parcelas} · ${esc(rotuloRegra(regra))}">Parcela ${dd(n)}/${dd(regra.parcelas)}</span>${semSabado ? "" : seloSabado(reg)}`;
      return ` <span class="selo-tag selo-cat" title="Personalizada: ${esc(rotuloRegra(regra))}, ${esc(rotuloIntervalo(regra.intervalo))}">${esc(rotuloIntervalo(regra.intervalo))}</span>${semSabado ? "" : seloSabado(reg)}`;
    }
    return f === FREQUENCIAS[0] ? "" : ` <span class="selo-tag selo-cat">${esc(f.toLowerCase())}</span>`;
  }
  // selo "4/16" de um lançamento parcelado, achado pelo id (origem da série ou
  // lançamento do mês) e pela data daquele mês — usado nos painéis e listas
  // selo de repetição (mensal, 5/16…) de qualquer item de lista, achado pelo
  // id no lançamento original e calculado para a data mostrada
  function seloDe(x, data) {
    const orig = x && x.id ? [...DADOS.entradas, ...DADOS.despesas, ...(DADOS.contasPagar || [])].find((r) => r.id === x.id) : null;
    return orig ? seloFreq({ ...orig, data: data || dataReg(x) }) : "";
  }
  // "Categoria · Tipo", a linha de baixo da descrição
  function subDe(x) {
    const orig = x && x.id ? [...DADOS.entradas, ...DADOS.despesas, ...(DADOS.contasPagar || [])].find((r) => r.id === x.id) : null;
    return esc(x.categoria || (orig && orig.categoria) || "—") + " · " + esc(x.tipo || (orig && orig.tipo) || "Variável");
  }
  // descrição completa nos painéis, no padrão das guias: coluna Data, e emoji descrição selo com categoria · tipo embaixo
  function descPainel(x) {
    return `<span class="dp-data-col">${fmtDataCurta(x.data)}</span><span class="desc-painel"><span class="dp-nm"><span class="emoji-desc">${emojiDe(x)}</span><span class="dp-txt">${esc(x.descricao || "")}</span></span><span class="dp-sub">${subDe(x)}</span></span>`;
  }
  // célula da coluna Recorrência (selo MENSAL, 5/16…); lançamento que não se
  // repete ganha o selo ÚNICA (unica = true); o resto (transferências…) fica "—"
  const SELO_UNICA = '<span class="selo-tag selo-unica" title="Lançamento que não se repete">Única</span>';
  const celRep = (selo, unica) => selo ? selo.trim() : unica ? SELO_UNICA : '<span class="dim">—</span>';
  // a mesma célula achando o lançamento pelo id (painéis e listas)
  function repColuna(x, data) {
    const orig = x && x.id ? [...DADOS.entradas, ...DADOS.despesas, ...(DADOS.contasPagar || [])].find((r) => r.id === x.id) : null;
    return celRep(orig ? seloFreq({ ...orig, data: data || dataReg(x) }) : "", !!orig);
  }
  function seloParcela(id, data) {
    if (!id || !data) return "";
    const reg = [...DADOS.entradas, ...DADOS.despesas, ...(DADOS.contasPagar || [])].find((r) => r.id === id);
    if (!ehPers(reg)) return "";
    const regra = regraDe(reg), n = numeroParcela(regra, String(data).slice(0, 7));
    return n > 0 ? ` <span class="selo-tag selo-cat" title="Parcela ${n} de ${regra.parcelas}">Parcela ${dd(n)}/${dd(regra.parcelas)}</span>` : "";
  }
  // selo extra quando, na regra de dia útil, contando também os sábados, o dia cai num sábado
  // (só para entradas — em despesas e contas a pagar o aviso não interessa)
  function seloSabado(reg) {
    if (!ehPers(reg) || !dataReg(reg)) return "";
    if (reg.id && !(DADOS.entradas || []).some((e) => e.id === reg.id)) return "";
    const regra = regraDe(reg);
    if (regra.tipo !== "diaUtil") return "";
    const [a, m] = dataReg(reg).split("-").map(Number);
    const c = F.calcularDataRegra(a, m, regra);
    if (!c.alertaSabado) return "";
    const dm = c.dataSabado.slice(8, 10) + "/" + c.dataSabado.slice(5, 7);
    return ` <span class="selo-tag selo-sabado" title="É possível resgatar o dinheiro no sábado (${dm}).">⚠️ sábado</span>`;
  }
  // converte séries antigas "Mensal – 4º dia útil" para "Personalizar" com a mesma regra
  function migrarRecorrenciasAntigas() {
    let mudou = false;
    ["entradas", "despesas", "contasPagar"].forEach((col) => (DADOS[col] || []).forEach((x) => {
      if (x.recorrencia === FREQ_4DU_ANTIGA) { x.recorrencia = FREQ_PERS; x.regraRep = { ...REGRA_PADRAO }; mudou = true; }
    }));
    if (mudou) A.salvarDados(DADOS, true, true);
  }

  // Correção única: VR e VT eram despesas mensais, mas são só dinheiro do
  // salário separado para o Inter (alimentação e transporte). Viram
  // transferências automáticas "quando o salário cair", com o mesmo valor,
  // e as despesas param daqui pra frente (os meses que já passaram ficam
  // como estão). Quem usava o valor do VR/VT numa transferência automática
  // passa a usar o valor fixo, com os meses passados congelados no valor
  // que tinham. Devolve a mensagem para o aviso, ou "" se nada mudou.
  function migrarVrVtParaTransferencia() {
    const d = DADOS;
    d.config = d.config || {};
    if (d.config.migracaoVrVt) return "";
    const feitos = [], cur = F.mesAtual();
    ["VR", "VT"].forEach((nome) => {
      const reg = seriesRecorrentes(d.despesas).find((x) => descIgual(x.descricao, nome) && !(x.ateMes && x.ateMes < cur));
      if (!reg) return;
      const ref = { id: reg.id, desc: reg.descricao };
      // se o deste mês já foi pago, a troca começa no mês seguinte
      const ocAtual = ocorrenciaNoMes(d, ref, cur, "despesa");
      const desde = ocAtual && ocAtual.recebida ? proximoMes(cur) : cur;
      const valor = Math.round(valorDoMes(reg, desde) * 100) / 100;
      const paraBancoId = bancoDoMes(reg, desde);
      if (!(valor > 0) || !paraBancoId) return;
      // transferências automáticas que dependiam deste lançamento
      const usaValor = (r) => modoDe(r) === "lanc" && r.lanc && casaRef(r.lanc)(reg);
      const usaGatilho = (r) => condDe(r) === "despesa" && gatilhosDe(r).some((g) => casaRef(g)(reg));
      const dependentes = (d.transfAuto || []).filter((r) => usaValor(r) || usaGatilho(r));
      // congela os meses que já passaram no valor que tinham
      dependentes.forEach((r) => {
        for (let mes = r.desde || desde, n = 0; mes < desde && n < 240; mes = proximoMes(mes), n++) {
          const g = gatilhoDoMes(d, r, mes);
          if (!g) continue;
          r.meses = r.meses || {};
          if (!r.meses[mes] || r.meses[mes].valor === undefined) r.meses[mes] = Object.assign({}, r.meses[mes], { valor: valorTransfAuto(d, r, mes, g) });
        }
      });
      // o salário é a soma das entradas mensais de categoria Salário do mesmo
      // banco (Pagamento + Bonificação): a transferência acontece quando elas
      // caem. Se já houver uma transferência "quando cair a entrada", usa a mesma condição.
      const regraSalario = (d.transfAuto || []).find((r) => condDe(r) === "entrada" && gatilhosDe(r).length && r.deBancoId !== paraBancoId);
      const ehSalario = (e) => /sal[aá]rio/i.test(String(e.categoria || ""));
      const porBanco = {};
      entradasGatilho(d).filter((e) => ehSalario(e) && e.bancoId && e.bancoId !== paraBancoId && !(e.ateMes && e.ateMes < desde))
        .forEach((e) => { (porBanco[e.bancoId] = porBanco[e.bancoId] || []).push(e); });
      const somaSal = (lista) => lista.reduce((t, e) => t + valorDoMes(e, desde), 0);
      const bancoSal = Object.keys(porBanco).sort((a, b) => somaSal(porBanco[b]) - somaSal(porBanco[a]))[0];
      const condSalario = regraSalario ? { cond: "entrada", gatilhos: gatilhosDe(regraSalario).map((g) => ({ id: g.id, desc: g.desc })), deBancoId: regraSalario.deBancoId }
        : bancoSal ? { cond: "entrada", gatilhos: porBanco[bancoSal].map((e) => ({ id: e.id, desc: e.descricao })), deBancoId: bancoSal } : null;
      // reaproveita a transferência que já levava este valor para o Inter
      let regra = dependentes.find((r) => r.paraBancoId === paraBancoId && usaValor(r) && !usaGatilho(r));
      if (regra) Object.assign(regra, { modo: "fixo", valor, lanc: undefined, obs: regra.obs || reg.descricao });
      else if (condSalario) {
        d.transfAuto = d.transfAuto || [];
        regra = { id: A.novoId(), deBancoId: condSalario.deBancoId, paraBancoId, cond: condSalario.cond, gatilhos: condSalario.gatilhos,
          modo: "fixo", valor, desde, obs: reg.descricao, meses: {} };
        d.transfAuto.push(regra);
      } else return;   // sem o salário para disparar: deixa a despesa como está
      // as outras que dependiam dele: valor fixo e, se o VR/VT era a condição, passam a cair com o salário
      dependentes.filter((r) => r !== regra).forEach((r) => {
        if (usaValor(r)) Object.assign(r, { modo: "fixo", valor, lanc: undefined });
        if (usaGatilho(r) && condSalario) Object.assign(r, { cond: "entrada", gatilhos: condSalario.gatilhos });
      });
      // a despesa para no mês anterior à troca (o histórico fica)
      const fim = mesAnterior(desde);
      d.despesas = d.despesas.filter((x) => !((x.id === reg.id && String(x.data || "").slice(0, 7) >= desde) ||
        (x.origemRecorrente === reg.id && String(x.data || "").slice(0, 7) >= desde)));
      reg.ateMes = fim;
      feitos.push(`${reg.descricao} (${brl(valor)})`);
    });
    d.config.migracaoVrVt = true;
    return feitos.length ? `${feitos.join(" e ")} agora ${feitos.length === 1 ? "é transferência automática" : "são transferências automáticas"} do salário para o ${F.nomeBanco(d, (d.transfAuto || []).slice(-1)[0].paraBancoId)}.` : "";
  }

  // Correção única: as despesas VR e VT (Nubank) já vêm com o Inter marcado em
  // "Enviar" — ao marcar como paga, o valor entra no Inter.
  // Só vale dali em diante: os meses já pagos não mudam.
  function migrarVrVtDestinoInter() {
    const d = DADOS;
    d.config = d.config || {};
    if (d.config.migracaoVrVtDestino) return "";
    const inter = d.bancos.find((b) => /\binter\b/i.test(String(b.nome || "")));
    const feitos = [];
    if (inter) {
      seriesRecorrentes([...d.despesas, ...(d.contasPagar || [])])
        .filter((x) => ["VR", "VT"].some((n) => descIgual(x.descricao, n)) && !(x.ateMes && x.ateMes < F.mesAtual()) && !x.cartaoId && x.bancoId !== inter.id && !x.destinoBancoId)
        .forEach((x) => { x.destinoBancoId = inter.id; feitos.push(x.descricao); });
    }
    d.config.migracaoVrVtDestino = true;
    return feitos.length ? `Ao marcar ${feitos.join(" e ")} como pag${feitos.length === 1 ? "a" : "as"}, o valor vai para o ${inter.nome}.` : "";
  }

  // legenda dos gráficos Receitas x despesas, no cabeçalho do quadro (no celular fica no gráfico)
  const LEGENDA_RD = `<span class="leg-graf"><span><i class="leg-receitas"></i>Receitas</span><span><i class="leg-despesas"></i>Despesas</span></span>`;
  const COR_META_PADRAO = "#00E5FF";

  // Estado da interface (não persistido — só a sessão atual)
  let DADOS = null;
  let ROTA = { secao: "dashboard", param: null };
  let editandoPrecos = false;
  let periodoGrafico = "tudo";
  let anoMetas = null;    // quadro de metas: ano de referência (o atual = hoje; anos passados = 31/12)
  let periodoMetas = 0;   // quadro de metas: 0 = Atual (sempre abre assim), -1 = Início, 3/6/12 = meses atrás
  let anoRD = null;    // ano escolhido no quadro Receitas x despesas
  let anoEvo = null;   // ano escolhido no quadro Evolução patrimonial
  let mesesRD = 6;        // meses no gráfico receitas x despesas
  let mesesEvo = 12;      // meses no gráfico de evolução patrimonial   // período mostrado no gráfico do ativo
  let filtrosHistorico = { periodo: "3m", banco: "", categoria: "", tipo: "todos", busca: "", ordenarPor: "data", ordemAsc: false };
  // cada quadro de relatório tem o seu próprio intervalo de datas
  // mês selecionado nas guias Entradas e Despesas (começa no mês atual)
  let mesEntradas = null;
  let mesDespesas = null;
  const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  // anos com lançamentos (mais o ano atual), para o seletor
  function anosDisponiveis(d) {
    const anos = new Set([String(new Date().getFullYear())]);
    [...d.entradas, ...d.despesas].forEach((m) => { if (m.data) anos.add(String(m.data).slice(0, 4)); });
    (d.contasPagar || []).forEach((c) => { if (c.vencimento) anos.add(String(c.vencimento).slice(0, 4)); });
    return faixaAnos([...anos]);
  }

  function abasMeses12(acao, selecionado, idAno, anos) {
    const ano = selecionado.slice(0, 4);
    const mesSel = Number(selecionado.slice(5, 7));
    const lista = (anos && anos.length ? anos : [ano]).slice();
    if (lista.indexOf(ano) === -1) { lista.push(ano); lista.sort(); }
    const seletorAno = `<select class="sel-ano" id="${idAno}" title="Ano">${lista.map((a) =>
      `<option value="${a}" ${a === ano ? "selected" : ""}>${a}</option>`).join("")}</select>`;
    const abas = `<div class="abas abas-periodo abas-mes">${NOMES_MES.map((nome, i) => {
      const chave = `${ano}-${String(i + 1).padStart(2, "0")}`;
      return `<button class="${mesSel === i + 1 ? "ativo" : ""}" data-acao="${acao}" data-mes="${chave}" title="${nome}/${ano}">${nome}</button>`;
    }).join("")}</div>`;
    return `<div class="filtro-mes">${seletorAno}${abas}</div>`;
  }

  // ordenação das tabelas de Entradas e Despesas
  const ORDEM_ENTRADAS_PADRAO = { campo: "cronologica", dir: "asc" };   // por data (do dia 1 ao fim do mês), sem coluna destacada
  const ORDEM_DESPESAS_PADRAO = { campo: "cronologica", dir: "asc" };   // por data (do dia 1 ao fim do mês), sem coluna destacada
  let ordemEntradas = { ...ORDEM_ENTRADAS_PADRAO };
  let filtroEntradas = null, filtroDespesas = null;   // status escolhido nas caixas do resumo (null = todos)
  let ordemDespesas = { ...ORDEM_DESPESAS_PADRAO };

  // título de coluna que ordena ao ser clicado
  function thOrdem(acao, campo, rotulo, ordem, classe) {
    const ativo = ordem.campo === campo;
    const seta = ativo ? (ordem.dir === "asc" ? " ▲" : " ▼") : "";
    return `<button class="hd-ordem${ativo ? " ativo" : ""}${classe ? " " + classe : ""}" data-acao="${acao}" data-campo="${campo}" title="Ordenar por ${rotulo.toLowerCase()}">${rotulo}${seta}</button>`;
  }

  function comparar(a, b, campo, dir) {
    const mult = dir === "asc" ? 1 : -1;
    let x, y;
    if (campo === "valor") { x = Number(a.valor || 0); y = Number(b.valor || 0); }
    else if (campo === "data") { x = a.data || ""; y = b.data || ""; }
    else if (campo === "status") {
      const ordem = { "Atrasado": 0, "Prevista": 1, "Pago": 2 };
      x = ordem[a.status] !== undefined ? ordem[a.status] : 9;
      y = ordem[b.status] !== undefined ? ordem[b.status] : 9;
    }
    else if (campo === "banco") { x = String(a.banco || "").toLowerCase(); y = String(b.banco || "").toLowerCase(); }
    else { x = String(a.descricao || "").toLowerCase(); y = String(b.descricao || "").toLowerCase(); }
    if (x < y) return -1 * mult;
    if (x > y) return 1 * mult;
    return 0;
  }

  // Entradas e Despesas usam exatamente as mesmas larguras de coluna
  // colunas proporcionais: a descrição não "empurra" banco, status e valor para a borda
  const GRID_LANCAMENTOS = "grid-template-columns:90px minmax(200px,1fr) 128px 104px 150px 120px";   // repetição, status, banco e valor juntos, encostados à direita

  let mesesBancos = 0;
  let anoBancos = null;   // período do gráfico da guia Bancos (0 = saldo atual)
  let mesesRelA = 12;   // período do quadro Receitas x despesas
  let mesesRelB = 12;   // período do quadro Evolução patrimonial (abre em 12 meses)
  let anoRelA = null;
  let anoRelB = null;

  // intervalo correspondente ao período escolhido; 0 = todo histórico
  function intervaloRel(meses, ano) {
    const fim = new Date().toISOString().slice(0, 10);
    if (!meses) return { ini: "0000-01-01", fim };   // "Tudo"
    return intervaloAnoMeses(ano || String(new Date().getFullYear()), meses);
  }
  let demoBannerOculto = false;

  // =========================================================================
  // FORMATAÇÃO
  // =========================================================================
  const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const brl = (v) => fmtBRL.format(Number(v) || 0);
  const brlSinal = (v) => { const n = Number(v) || 0; return (n > 0 ? "+" : n < 0 ? "−" : "") + fmtBRL.format(Math.abs(n)); };
  const pct = (v) => { const n = Number(v) || 0; return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(1).replace(".", ",") + "%"; };
  // cor do valor: verde se positivo, vermelho se negativo e branco (sem cor) quando é zero
  const corSinal = (v) => { const n = Math.round((Number(v) || 0) * 100); return n > 0 ? "up" : n < 0 ? "down" : ""; };
  // todas as datas do sistema no formato dia/mês/ano (ex.: 03/04/2026)
  const OPCOES_DATA = { day: "2-digit", month: "2-digit", year: "numeric" };
  const fmtData = (iso) => !iso ? "—" : new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", OPCOES_DATA);
  const fmtDataCurta = fmtData;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function numIn(v) {
    if (typeof v === "number") return v;
    let t = String(v || "").trim().replace(/[R$\s]/g, "");
    if (t.indexOf(",") > -1) t = t.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(t);
    return isFinite(n) ? n : 0;
  }
  const achar = (lista, id) => lista.find((x) => x.id === id) || null;
  const hojeISO = () => new Date().toISOString().slice(0, 10);

  // sparkline embutida (SVG leve, sem depender do Chart.js)
  function sparklineSVG(valores, cor) {
    if (!valores || valores.length < 2) return "";
    const w = 240, h = 30, pad = 3;
    const min = Math.min(...valores), max = Math.max(...valores);
    const faixa = max - min || 1;
    const passo = (w - pad * 2) / (valores.length - 1);
    const pontos = valores.map((v, i) => [pad + i * passo, h - pad - ((v - min) / faixa) * (h - pad * 2)]);
    const linha = pontos.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const area = `${pad},${h - pad} ${linha} ${w - pad},${h - pad}`;
    const subiu = valores[valores.length - 1] >= valores[0];
    const corLinha = cor || (subiu ? "var(--up)" : "var(--down)");
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polygon points="${area}" fill="${corLinha}" opacity="0.12"></polygon>
      <polyline points="${linha}" fill="none" stroke="${corLinha}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>`;
  }

  // medidor radial (gauge) — percentual de 0 a 100
  function gaugeSVG(percentual, cor, tamanho) {
    const p = Math.max(0, Math.min(100, percentual || 0));
    const t = tamanho || 84;
    const r = t / 2 - 8;
    const c = 2 * Math.PI * r;
    const offset = c - (p / 100) * c;
    const meio = t / 2;
    return `<svg width="${t}" height="${t}" viewBox="0 0 ${t} ${t}">
      <circle class="gauge-fundo" cx="${meio}" cy="${meio}" r="${r}" stroke-width="8"></circle>
      <circle class="gauge-valor" cx="${meio}" cy="${meio}" r="${r}" stroke-width="8" stroke="${cor}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
    </svg>`;
  }

  // a lista de categorias com a do lançamento, se ela não estiver na lista
  // (categoria antiga ou importada), para não trocar sem querer ao editar
  const comAtual = (lista, atual) => (atual && lista.indexOf(atual) === -1 ? [...lista.filter((c) => c !== "Outros"), atual, "Outros"] : lista);
  function opcoes(lista, atual, comVazio) {
    let html = comVazio ? '<option value="">Selecione…</option>' : "";
    html += lista.map((v) => `<option value="${esc(v)}" ${v === atual ? "selected" : ""}>${esc(ROTULO_FREQ[v] || v)}</option>`).join("");
    return html;
  }
  function opcoesBancos(bancos, atual, comVazio) {
    let html = comVazio ? '<option value="">Selecione um banco…</option>' : "";
    html += bancos.map((b) => `<option value="${b.id}" ${b.id === atual ? "selected" : ""}>${esc(b.nome)}</option>`).join("");
    return html;
  }


  // ---------------------------------------------------------------------
  // CAMPOS DE DINHEIRO — o usuário digita só os números e o campo já
  // aparece formatado como moeda ("R$ 1.234,56"). Na hora de salvar,
  // numIn() converte de volta para número.
  // ---------------------------------------------------------------------
  function valorCampoMoeda(v) {                 // valor inicial já formatado
    return (v === "" || v == null || isNaN(Number(v))) ? "" : brl(Number(v));
  }
  function campoMoeda(id, valor, placeholder) { // gera o <input> pronto
    return `<input id="${id}" class="moeda" type="text" inputmode="decimal" autocomplete="off" value="${valorCampoMoeda(valor)}" placeholder="${placeholder || "R$ 0,00"}">`;
  }
  function formatarEnquantoDigita(el) {
    const digitos = String(el.value).replace(/\D/g, "");
    if (!digitos) { el.value = ""; return; }
    el.value = brl(Number(digitos) / 100);
    // mantém o cursor no fim (o texto é reescrito a cada tecla)
    const fim = el.value.length;
    try { el.setSelectionRange(fim, fim); } catch (e) {}
  }
  function ligarMascaraMoeda(raiz) {
    raiz.addEventListener("input", (e) => {
      if (e.target.classList && e.target.classList.contains("moeda")) formatarEnquantoDigita(e.target);
    });
  }


  function montarAreaBiometria() {
    const area = document.getElementById("areaBiometria");
    if (!area || !window.Bloqueio) return;
    Bloqueio.biometriaDisponivel().then((tem) => {
      if (!tem) {
        area.innerHTML = `<p class="campo ajuda" style="margin:0">Este aparelho não oferece leitor de digital ou Face ID para aplicativos da web (ou o sistema não está aberto por um endereço https).</p>`;
        return;
      }
      area.innerHTML = Bloqueio.biometriaAtiva()
        ? `<p style="font-size:13px;margin:0 0 8px">Digital / Face ID <b class="up">ativado</b> — a senha continua valendo como alternativa.</p>
           <button class="btn perigo" data-acao="remover-biometria">Desativar digital / Face ID</button>`
        : `<p style="font-size:13px;margin:0 0 8px">Você pode desbloquear com a digital (Touch ID) ou com o Face ID, em vez de digitar a senha.</p>
           <button class="btn primario" data-acao="ativar-biometria">Ativar digital / Face ID</button>`;
    });
  }


  // =========================================================================
  // SINCRONIZAÇÃO ENTRE APARELHOS (cofre = Gist privado do GitHub)
  // =========================================================================
  const S = window.Sincronizacao;
  let sincronizando = false, timerEnvio = null, statusSync = "";

  // nome curto deste aparelho, gravado junto com cada alteração
  function rotuloAparelho() {
    if (A.ehDesktop) return "Windows";
    const ua = navigator.userAgent || "";
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
    if (/iPhone/.test(ua)) return "iPhone";
    if (/Android/.test(ua)) return "Android";
    return "Navegador";
  }
  function descreverAlteracao(d) {
    if (!d || !d.atualizadoEm) return "";
    const quando = new Date(d.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return `última alteração: ${d.alteradoPor || "outro aparelho"} · ${quando}`;
  }

  function cfgSync() {
    const c = (DADOS.config && DADOS.config.sync) || {};
    return { token: c.token || "", cofre: c.cofre || "", ultima: c.ultima || null, ligada: !!c.token };
  }
  function gravarCfgSync(novo) {
    DADOS.config = DADOS.config || {};
    DADOS.config.sync = Object.assign({}, DADOS.config.sync || {}, novo);
    A.salvarDados(DADOS, true, true);   // não muda o carimbo: isso não é dado financeiro
  }
  function mostrarStatusSync(texto) {
    statusSync = texto;
    const el = document.getElementById("statusSync");
    if (el) el.textContent = texto;
  }

  // o que vai para o cofre: os dados, sem o token de acesso deste aparelho
  function dadosParaCofre() {
    const copia = JSON.parse(JSON.stringify(DADOS));
    if (copia.config) delete copia.config.sync;
    return JSON.stringify(copia, null, 2);
  }

  // aplica os dados vindos do cofre, preservando a configuração deste aparelho
  function aplicarRemoto(remoto) {
    const meuSync = (DADOS.config && DADOS.config.sync) || {};
    remoto.config = Object.assign({}, remoto.config || {}, { sync: meuSync });
    A.salvarDados(remoto, true, true);
    DADOS = A.carregarDados();
    renderRota();
  }

  function sincronizar(silencioso) {
    const cfg = cfgSync();
    if (!S || !cfg.token || sincronizando || typeof fetch !== "function") return Promise.resolve();
    sincronizando = true;
    mostrarStatusSync("sincronizando…");

    const garantirCofre = cfg.cofre
      ? Promise.resolve(cfg.cofre)
      : S.procurarCofre(cfg.token).then((id) => id || S.criarCofre(cfg.token, dadosParaCofre()))
         .then((id) => { gravarCfgSync({ cofre: id }); return id; });

    return garantirCofre.then((cofre) => S.baixar(cfg.token, cofre).then((remoto) => {
      syncBaixado = true;   // o cofre respondeu: os dados locais já são os mais novos
      const hrLocal = DADOS.atualizadoEm || "";
      const hrRemoto = (remoto && remoto.atualizadoEm) || "";
      if (hrRemoto && hrRemoto > hrLocal) {
        aplicarRemoto(remoto);
        gravarCfgSync({ ultima: new Date().toISOString() });
        mostrarStatusSync(descreverAlteracao(remoto));
        toast(`Dados atualizados pelo ${remoto.alteradoPor || "outro aparelho"}.`);
      } else if (hrLocal && hrLocal !== hrRemoto) {
        return S.enviar(cfg.token, cofre, dadosParaCofre()).then(() => {
          gravarCfgSync({ ultima: new Date().toISOString() });
          mostrarStatusSync(descreverAlteracao(DADOS));
          if (!silencioso) toast("Dados enviados para o cofre.");
        });
      } else {
        mostrarStatusSync(descreverAlteracao(DADOS));
      }
    })).catch((e) => {
      mostrarStatusSync("não sincronizado: " + e.message);
      if (!silencioso) toast("Sincronização: " + e.message);
    }).then(() => { sincronizando = false; });
  }

  let syncBaixado = false;

  function agendarEnvioSync() {                       // chamado após cada alteração
    if (!cfgSync().token) return;
    clearTimeout(timerEnvio);
    timerEnvio = setTimeout(() => sincronizar(true), 2000);
  }

  // Ao ligar um aparelho, se já existe um cofre com dados, o usuário
  // escolhe de que lado ficam os dados. Sem isso, um aparelho novo (vazio
  // ou com o exemplo) pareceria "mais recente" e apagaria o cofre.
  function conectarSync() {
    const token = (document.getElementById("cfgSyncToken").value || "").trim();
    if (!token) { toast("Cole o token do GitHub para ativar."); return; }
    mostrarStatusSync("verificando token…");
    let login = "";
    S.verificarToken(token)
      .then((l) => { login = l; return S.procurarCofre(token); })
      .then((cofre) => {
        if (!cofre) {
          // primeiro aparelho: cria o cofre com os dados daqui
          gravarCfgSync({ token, cofre: "" });
          mostrarStatusSync("conectado como " + login + " · criando o cofre…");
          return sincronizar(false).then(() => renderRota());
        }
        return S.baixar(token, cofre).then((remoto) => escolherLadoDoCofre(token, cofre, login, remoto));
      })
      .catch((e) => { mostrarStatusSync("falhou: " + e.message); toast("Não consegui conectar: " + e.message); });
  }

  function escolherLadoDoCofre(token, cofre, login, remoto) {
    const cont = (d) => d ? `${plural((d.entradas || []).length + (d.despesas || []).length, "lançamento")}, ${plural((d.bancos || []).length, "banco")}` : "vazio";
    const quando = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
    abrirModal(`
      <h3>Já existe um cofre nesta conta</h3>
      <p style="margin-top:0;font-size:13px">Conectado como <b>${esc(login)}</b>. Escolha quais dados ficam valendo:</p>
      <div class="explica-lista">
        <div class="kv"><span class="dim">No cofre</span><b>${cont(remoto)} · ${quando(remoto && remoto.atualizadoEm)}</b></div>
        <div class="kv"><span class="dim">Neste aparelho</span><b>${cont(DADOS)} · ${quando(DADOS.atualizadoEm)}</b></div>
      </div>
      <p class="campo ajuda" style="margin-top:12px">Na maioria dos casos, use os dados do cofre: é o que acontece ao ligar um segundo aparelho seu.</p>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnUsarCofre">Usar dados do cofre</button>
        <button class="btn perigo" id="btnEnviarAparelho">Enviar deste aparelho</button>
      </div>`);
    document.getElementById("btnUsarCofre").onclick = () => {
      fecharModal();
      gravarCfgSync({ token, cofre });
      if (remoto) aplicarRemoto(remoto);
      gravarCfgSync({ ultima: new Date().toISOString() });
      mostrarStatusSync("dados trazidos do cofre · " + new Date().toLocaleTimeString("pt-BR"));
      renderRota();
      toast("Aparelho conectado com os dados do cofre.");
    };
    document.getElementById("btnEnviarAparelho").onclick = () => {
      confirmarExclusao("Substituir TUDO o que está no cofre pelos dados deste aparelho? Isso apaga o que estava lá — inclusive se pertencer a outra pessoa que usa o mesmo token — e todos os outros aparelhos ligados a este cofre passam a ver só os dados daqui.", () => {
        gravarCfgSync({ token, cofre });
        S.enviar(token, cofre, dadosParaCofre()).then(() => {
          gravarCfgSync({ ultima: new Date().toISOString() });
          mostrarStatusSync("dados enviados ao cofre · " + new Date().toLocaleTimeString("pt-BR"));
          renderRota();
          toast("Cofre atualizado com os dados deste aparelho.");
        }).catch((e) => toast("Não consegui enviar: " + e.message));
      });
    };
  }

  function desligarSync() {
    confirmarExclusao("Desligar a sincronização neste aparelho? Os dados continuam aqui e no cofre.", () => {
      gravarCfgSync({ token: "", cofre: "" });
      mostrarStatusSync("desligada");
      renderRota();
      toast("Sincronização desligada neste aparelho.");
    });
  }


  // =========================================================================
  // BARRA DE GUIAS — mede a largura real e vai compactando por níveis até
  // todas as guias caberem numa linha só (sem rolagem lateral), qualquer
  // que seja o aparelho, a fonte do sistema ou a orientação da tela.
  // =========================================================================
  const ROTULOS_CURTOS = {
    investimentos: "INVEST.", configuracoes: "CONFIG.", relatorios: "RELAT.",
    dashboard: "PAINEL", entradas: "ENTR.", despesas: "DESP."
  };
  function aplicarRotulos(curto) {
    document.querySelectorAll("#navPrincipal button[data-secao]").forEach((b) => {
      const no = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (!no) return;
      if (!b.dataset.rotulo) b.dataset.rotulo = no.textContent;
      const curtoTxt = ROTULOS_CURTOS[b.dataset.secao];
      no.textContent = (curto && curtoTxt) ? curtoTxt : b.dataset.rotulo;
    });
  }

  function ajustarBarraGuias() {
    const barra = document.getElementById("sidebar");
    const nav = document.getElementById("navPrincipal");
    if (!barra || !nav) return;
    const NIVEIS = 6;
    // a última guia (Configurações) precisa aparecer inteira: nada de
    // tolerância, senão o fim da palavra fica cortado embaixo da data/hora
    // (no iPad a fonte do sistema é mais larga que no computador)
    const cabe = () => {
      if (nav.scrollWidth > nav.clientWidth + 0.5 || barra.scrollWidth > barra.clientWidth + 0.5) return false;
      const ult = [...nav.querySelectorAll("button[data-secao]")].filter((b) => b.offsetParent).pop();
      const ferr = barra.querySelector(".nav-ferramentas");
      if (!ult) return true;
      const r = ult.getBoundingClientRect(), rn = nav.getBoundingClientRect();
      if (r.right > rn.right + 0.5) return false;
      // espaço entre "Configurações" e a data/hora quando estão na mesma linha
      if (ferr) { const rf = ferr.getBoundingClientRect(); if (rf.top < r.bottom && rf.bottom > r.top && r.right > rf.left - 8) return false; }
      return true;
    };
    aplicarRotulos(false);
    let coube = false;
    for (let n = 0; n <= NIVEIS; n++) {
      barra.dataset.compacta = String(n);
      if (cabe()) { coube = true; break; }
    }
    // último recurso: abreviar os nomes das guias (INVESTIMENTOS → INVEST.)
    if (!coube) {
      aplicarRotulos(true);
      for (let n = 3; n <= NIVEIS + 1; n++) {   // o nível extra esconde a data/hora
        barra.dataset.compacta = String(n);
        if (cabe()) break;
      }
    }
  }


  // ---------------------------------------------------------------------
  // Lista de bancos usada nos campos de nome de banco / emissor.
  // É uma lista de sugestões: quem precisar de outro banco escolhe
  // "Outro" e digita o nome.
  // ---------------------------------------------------------------------
  const BANCOS_SUGERIDOS = ["Banco do Brasil", "Nubank", "Itaú", "Mercado Pago", "Caixa", "Banco Inter"];

  function campoBanco(id, valorAtual, rotuloVazio) {
    const atual = (valorAtual || "").trim();
    const naLista = BANCOS_SUGERIDOS.indexOf(atual) > -1;
    const ehOutro = !!atual && !naLista;
    const opcoesHtml = `<option value="">${rotuloVazio || "Selecione…"}</option>` +
      BANCOS_SUGERIDOS.map((b) => `<option value="${esc(b)}" ${b === atual ? "selected" : ""}>${esc(b)}</option>`).join("") +
      `<option value="__outro" ${ehOutro ? "selected" : ""}>Outro…</option>`;
    return `<select id="${id}" class="sel-banco" data-alvo="${id}_outro">${opcoesHtml}</select>
      <input id="${id}_outro" class="campo-outro" placeholder="Digite o nome do banco"
        value="${ehOutro ? esc(atual) : ""}" style="margin-top:8px;${ehOutro ? "" : "display:none"}">`;
  }

  function lerCampoBanco(id) {
    const sel = document.getElementById(id);
    if (!sel) return "";
    if (sel.value === "__outro") {
      const outro = document.getElementById(id + "_outro");
      return outro ? outro.value.trim() : "";
    }
    return sel.value;
  }

  // mostra/esconde o campo de digitação quando escolhem "Outro…"
  function ligarCamposBanco(raiz) {
    raiz.addEventListener("change", (e) => {
      const sel = e.target.closest(".sel-banco");
      if (!sel) return;
      const outro = document.getElementById(sel.dataset.alvo);
      if (!outro) return;
      const mostrar = sel.value === "__outro";
      outro.style.display = mostrar ? "" : "none";
      if (mostrar) outro.focus();
    });
  }



  // ---------------------------------------------------------------------
  // IMPORTAR BANCO — traz investimentos e ações de um arquivo .json
  // (aceita tanto um backup completo quanto um arquivo só com essas duas
  // listas). Nada fora das guias Investimentos e Ações é tocado.
  // ---------------------------------------------------------------------
  function importarBanco(arquivo) {
    const leitor = new FileReader();
    leitor.onload = () => {
      let obj;
      try { obj = JSON.parse(leitor.result); }
      catch (e) { toast("Arquivo inválido: não é um JSON."); return; }
      const invs = Array.isArray(obj.investimentos) ? obj.investimentos : [];
      const acs = Array.isArray(obj.acoes) ? obj.acoes : [];
      if (!invs.length && !acs.length) { toast("O arquivo não tem investimentos nem ações."); return; }

      abrirModal(`
        <h3>Importar banco</h3>
        <p style="margin-top:0;font-size:13px">O arquivo tem <b>${plural(invs.length, "investimento")}</b> e <b>${plural(acs.length, "ativo")} de bolsa</b>.</p>
        <p class="campo ajuda">Só as guias Investimentos e Ações são afetadas. Bancos, entradas, despesas, contas e metas ficam como estão.</p>
        <div class="explica-lista">
          <div class="kv"><span class="dim">Hoje você tem</span><b>${plural(DADOS.investimentos.length, "investimento")} · ${plural(DADOS.acoes.length, "ativo")}</b></div>
        </div>
        <div class="modal-acoes" style="margin-top:16px">
          <button class="btn primario salvar" id="btnAcrescentar">Acrescentar aos atuais</button>
          <button class="btn perigo" id="btnSubstituir">Substituir os atuais</button>
        </div>`);

      const aplicar = (substituir) => {
        const novosInv = invs.map((i) => Object.assign({ categoria: "Renda fixa", quantidade: 0, isentoIR: false, obs: "" }, i, { id: A.novoId() }));
        const novasAcoes = acs.map((a) => {
          const preco = Number(a.precoAtual || 0);
          return Object.assign({
            categoria: "Ação", dividendos: 0, obs: "", atualizadoEm: hojeISO(),
            historicoPrecos: preco > 0 ? [{ data: hojeISO(), preco }] : []
          }, a, { id: A.novoId() });
        });
        DADOS.investimentos = substituir ? novosInv : [...DADOS.investimentos, ...novosInv];
        DADOS.acoes = substituir ? novasAcoes : [...DADOS.acoes, ...novasAcoes];
        fecharModal();
        salvarEAtualizar(`${substituir ? "Substituído" : "Importado"}: ${plural(novosInv.length, "investimento")} e ${plural(novasAcoes.length, "ativo")}.`);
      };
      document.getElementById("btnAcrescentar").onclick = () => aplicar(false);
      document.getElementById("btnSubstituir").onclick = () => {
        confirmarExclusao("Substituir todos os investimentos e ações atuais pelos do arquivo?", () => aplicar(true));
      };
    };
    leitor.onerror = () => toast("Não consegui ler o arquivo.");
    leitor.readAsText(arquivo);
  }


  // ---------------------------------------------------------------------
  // IMPORTAR PDF — lê o Extrato de Custódia do banco dentro do sistema e
  // alimenta as guias Investimentos e Ações. Nada sai do aparelho.
  // ---------------------------------------------------------------------
  // Carrega o leitor de PDF só na primeira importação. O "worker" do
  // pdf.js é carregado como script comum, para rodar na própria página:
  // assim funciona também a partir de arquivos locais (Windows e iPad),
  // onde o navegador bloqueia processos em segundo plano.
  function carregarScript(src, pronto) {
    return new Promise((ok, falha) => {
      if (pronto()) { ok(); return; }
      const el = document.createElement("script");
      el.src = src;
      el.onload = () => ok();
      el.onerror = () => falha(new Error("não encontrei " + src));
      document.head.appendChild(el);
    });
  }
  function prepararLeitorPdf() {
    return carregarScript("js/vendor/pdf.min.js", () => !!window.pdfjsLib)
      .then(() => carregarScript("js/vendor/pdf.worker.min.js", () => !!window.pdfjsWorker));
  }

  function importarPdf(arquivo) {
    if (!window.Extrato) { toast("O leitor de PDF não foi carregado."); return; }
    toast("Lendo o extrato…");
    prepararLeitorPdf()
      .then(() => arquivo.arrayBuffer())
      .then((buf) => window.Extrato.lerPdf(buf))
      .then((paginas) => mostrarPreviaExtrato(window.Extrato.interpretar(paginas)))
      .catch((e) => toast("Não consegui ler o PDF: " + (e && e.message ? e.message : e)));
  }

  function mostrarPreviaExtrato(r) {
    if (r.avisos.length && !r.investimentos.length && !r.acoes.length) { toast(r.avisos[0]); return; }
    const dataRef = r.data || hojeISO();
    const total = r.investimentos.reduce((t, i) => t + i.valorAtual, 0) + r.acoes.reduce((t, a) => t + a.valorAtual, 0);
    const linha = (rot, val, c) => `<div class="kv"><span class="dim">${rot}</span><b class="${c || ""}">${val}</b></div>`;
    abrirModal(`
      <h3>Importar PDF — ${esc(r.banco)} · ${fmtData(dataRef)}</h3>
      <div class="explica-lista">
        ${r.investimentos.map((i) => linha(esc(i.nome), brlSinal(i.valorAtual), corSinal(i.valorAtual))).join("")}
        ${r.acoes.map((a) => linha(`${esc(a.ticker)} · ${a.quantidade} un.`, brlSinal(a.valorAtual))).join("")}
        ${linha("Total do extrato", brlSinal(total), corSinal(total))}
      </div>
      <p class="campo ajuda" style="margin-top:12px"><b>Atualizar</b> mantém o que você já tem e renova os valores dos ativos do extrato (os novos são acrescentados). <b>Substituir</b> troca tudo das guias Investimentos e Ações pelo conteúdo do PDF.</p>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnAtualizarPdf">Atualizar</button>
        <button class="btn perigo" id="btnSubstituirPdf">Substituir</button>
      </div>`);
    document.getElementById("btnAtualizarPdf").onclick = () => aplicarExtrato(r, dataRef, false);
    document.getElementById("btnSubstituirPdf").onclick = () =>
      confirmarExclusao("Substituir todos os investimentos e ações pelos do extrato?", () => aplicarExtrato(r, dataRef, true));
  }

  function aplicarExtrato(r, dataRef, substituir) {
    const pontoValor = (hist, valor) => {
      const h = (hist || []).filter((p) => p.data !== dataRef);
      h.push({ data: dataRef, valor }); h.sort((a, b) => a.data.localeCompare(b.data));
      return h;
    };
    const pontoPreco = (hist, preco) => {
      const h = (hist || []).filter((p) => p.data !== dataRef);
      h.push({ data: dataRef, preco }); h.sort((a, b) => a.data.localeCompare(b.data));
      return h;
    };
    if (substituir) { DADOS.investimentos = []; DADOS.acoes = []; }
    else {
      // transição para o extrato com caixinhas nomeadas: a aplicação antiga
      // "RDB ... (Caixinha)" passa a se chamar como a caixinha correspondente
      // (a de maior valor com o mesmo tipo), mantendo o histórico do gráfico
      const novosNomes = new Set(r.investimentos.map((i) => i.nome.toLowerCase()));
      const temNomeadas = r.investimentos.some((i) => /\(Caixinha .+\)$/.test(i.nome));
      if (temNomeadas) {
        const usados = new Set();
        DADOS.investimentos.filter((x) => /^RDB .+ \(Caixinha\)$/.test(x.nome) && !novosNomes.has(x.nome.toLowerCase())).forEach((antiga) => {
          const tipo = antiga.nome.replace(/ \(Caixinha\)$/, "").replace(/\s+Nubank$/i, "");   // inclui o nome gravado pela importação com erro
          const alvo = r.investimentos.filter((i) => i.nome.startsWith(tipo + " (Caixinha ") && !usados.has(i.nome)
              && !DADOS.investimentos.some((x) => x.nome.toLowerCase() === i.nome.toLowerCase()))
            .sort((a, b) => b.valorAtual - a.valorAtual)[0];
          if (alvo) { antiga.nome = alvo.nome; usados.add(alvo.nome); }
        });
      }
    }
    let novos = 0, atualizados = 0;

    r.investimentos.forEach((i) => {
      const atual = DADOS.investimentos.find((x) => String(x.nome).toLowerCase() === i.nome.toLowerCase());
      if (atual) {
        // só um extrato igual ou mais recente muda o valor atual;
        // um extrato antigo apenas completa o histórico do gráfico
        const ultima = (atual.historicoValores || []).reduce((m, p) => (p.data > m ? p.data : m), "");
        if (dataRef >= ultima) {
          atual.valorAtual = i.valorAtual;
          // o banco informa o IR e o líquido exatos — usamos esses valores
          // em vez de recalcular, para bater certinho com o extrato
          if (i.ir !== undefined) atual.irBanco = i.ir; else delete atual.irBanco;
          if (i.liquido !== undefined) atual.liquidoBanco = i.liquido; else delete atual.liquidoBanco;
        }
        if (i.valorInvestido) atual.valorInvestido = i.valorInvestido;
        if (r.banco && !atual.banco) atual.banco = r.banco;   // não sobrescreve se o usuário já preencheu diferente
        ["dataAplicacao", "dataVencimento", "quantidade", "taxaContratada", "indexador", "emissor", "tipoAtivo", "liquidez"]
          .forEach((k) => { if (i[k]) atual[k] = i[k]; });
        atual.historicoValores = pontoValor(atual.historicoValores, i.valorAtual);
        atualizados++;
      } else {
        DADOS.investimentos.push({
          id: A.novoId(), nome: i.nome, categoria: i.categoria, tipoAtivo: i.tipoAtivo, emissor: i.emissor || "",
          liquidez: i.liquidez || "Liquidez diária", valorInvestido: i.valorInvestido || 0, quantidade: i.quantidade || 0,
          dataAplicacao: i.dataAplicacao || "", dataVencimento: i.dataVencimento || "", indexador: i.indexador || "Não se aplica",
          taxaContratada: i.taxaContratada || 0, valorAtual: i.valorAtual, isentoIR: !!i.isentoIR,
          irBanco: i.ir, liquidoBanco: i.liquido, banco: r.banco || "",
          obs: `Importado do extrato de ${fmtData(dataRef)}.`, historicoValores: [{ data: dataRef, valor: i.valorAtual }]
        });
        novos++;
      }
    });

    r.acoes.forEach((a) => {
      const atual = DADOS.acoes.find((x) => String(x.ticker).toUpperCase() === a.ticker);
      if (atual) {
        const ultimaP = (atual.historicoPrecos || []).reduce((m, p) => (p.data > m ? p.data : m), "");
        if (dataRef >= ultimaP) {
          atual.quantidade = a.quantidade;
          atual.precoAtual = a.precoAtual;
          atual.atualizadoEm = dataRef;
        }
        if (r.banco && !atual.banco) atual.banco = r.banco;
        atual.historicoPrecos = pontoPreco(atual.historicoPrecos, a.precoAtual);
        atualizados++;
      } else {
        DADOS.acoes.push({
          id: A.novoId(), ticker: a.ticker, empresa: a.empresa, categoria: a.categoria,
          quantidade: a.quantidade, precoMedio: a.precoAtual, precoAtual: a.precoAtual, dividendos: 0,
          atualizadoEm: dataRef, historicoPrecos: [{ data: dataRef, preco: a.precoAtual }],
          obs: `Importado do extrato de ${fmtData(dataRef)}. Ajuste o preço médio de compra.`, banco: r.banco || ""
        });
        novos++;
      }
    });

    fecharModal();
    salvarEAtualizar(`Extrato importado: ${plural(atualizados, "ativo atualizado", "ativos atualizados")} e ${plural(novos, "novo", "novos")}.`);
  }


  // =========================================================================
  // PUXAR PARA ATUALIZAR (iPad/iPhone, app instalado na tela de início)
  // Arrastar a página para baixo estando no topo busca os dados do cofre,
  // como nos aplicativos do iOS. No Safari comum o próprio navegador já
  // tem esse gesto (recarrega a página, que também sincroniza).
  // =========================================================================

  // Atualização automática: quando o app volta a ficar visível (ou ao puxar
  // para atualizar), confere se o index.html publicado já aponta para uma
  // versão mais nova do código; se sim, recarrega a página uma única vez.
  // Sem isso, o app instalado no iPad pode continuar rodando o código antigo
  // por dias, porque fica aberto em segundo plano.
  let verificandoVersao = false;
  function verificarVersaoNova() {
    if (verificandoVersao || location.protocol.indexOf("http") !== 0 || !navigator.onLine) return Promise.resolve(false);
    verificandoVersao = true;
    return fetch("index.html?_=" + Date.now(), { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((html) => {
        const m = /js\/app\.js\?v=([0-9.]+)/.exec(html);
        let jaTentou = "";
        try { jaTentou = sessionStorage.getItem("mm-recarregou-para") || ""; } catch (e) {}
        if (m && m[1] !== VERSAO_APP && jaTentou !== m[1]) {   // só tenta uma vez por versão (evita recarregar em laço)
          try { sessionStorage.setItem("mm-recarregou-para", m[1]); } catch (e) {}
          toast("Nova versão encontrada — atualizando…");
          if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
            navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update()).catch(() => {});
          }
          setTimeout(() => location.reload(), 600);
          return true;
        }
        return false;
      })
      .catch(() => false)
      .then((achou) => { verificandoVersao = false; return achou; });
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") verificarVersaoNova(); });
  window.addEventListener("focus", () => verificarVersaoNova());
  setTimeout(() => verificarVersaoNova(), 4000);

  function ligarPuxarParaAtualizar() {
    const ehApp = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    const shell = document.querySelector(".shell");
    if (!ehApp || !("ontouchstart" in window) || !shell) return;

    // Modelo clássico: a TELA inteira desce junto com o dedo, revelando o
    // ícone acima dela — como no Mail, Twitter etc. Ao soltar, tudo sobe de
    // volta ao lugar; o ícone só some quando essa subida termina.
    const ind = document.createElement("div");
    ind.id = "puxarAtualizar";
    ind.setAttribute("aria-hidden", "true");
    ind.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>`;
    document.body.appendChild(ind);
    const svg = ind.querySelector("svg");

    const LIMITE = 70, MAXIMO = 110, REPOUSO_CARREGANDO = 58;
    let inicioY = null, puxado = 0, atualizando = false, travaSeguranca = null;
    // pequena tolerância: no iPad, o próprio elástico do sistema pode deixar
    // o scroll a 1-2px do topo por um instante depois de soltar
    const noTopo = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 2 &&
      ((document.querySelector(".scroll") || {}).scrollTop || 0) <= 2;

    // enquanto o dedo está na tela, a tela acompanha 1:1 (sem suavização);
    // ao soltar, uma transição cuidadosa leva tudo de volta ao lugar
    const semTransicao = () => { shell.style.transition = "none"; };
    const comTransicao = () => { shell.style.transition = ""; };

    const posicionar = (dist, pronto) => {
      shell.style.transform = `translateY(${Math.min(dist, MAXIMO)}px)`;
      ind.style.opacity = Math.min(1, dist / LIMITE);
      svg.style.transform = `rotate(${Math.min(dist, MAXIMO) * 3}deg)`;
      ind.classList.toggle("pronto", pronto);
    };

    // volta tudo ao lugar (tela sobe, ícone some) — só chega aqui quando o
    // gesto termina de verdade: soltou sem atingir o limite, ou a
    // sincronização acabou (sucesso, erro ou trava de segurança)
    const resetar = () => {
      clearTimeout(travaSeguranca); travaSeguranca = null;
      inicioY = null; puxado = 0; atualizando = false;
      comTransicao();
      shell.style.transform = "";
      ind.classList.remove("girando", "pronto");
      ind.style.opacity = "0";
      svg.style.transform = "";
    };

    document.addEventListener("touchstart", (e) => {
      if (atualizando || e.touches.length !== 1 || !noTopo()) { inicioY = null; return; }
      const modal = document.getElementById("modal");
      if (modal && modal.classList.contains("on")) { inicioY = null; return; }
      inicioY = e.touches[0].clientY; puxado = 0;
      semTransicao();
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (inicioY === null || atualizando) return;
      // dois dedos (pinça no gráfico de velas): não é "puxar para atualizar"
      if (e.touches.length > 1) { puxado = 0; inicioY = null; comTransicao(); shell.style.transform = ""; ind.style.opacity = "0"; svg.style.transform = ""; ind.classList.remove("pronto"); return; }
      const dy = e.touches[0].clientY - inicioY;
      if (dy <= 0 || !noTopo()) { puxado = 0; inicioY = null; comTransicao(); shell.style.transform = ""; ind.style.opacity = "0"; svg.style.transform = ""; ind.classList.remove("pronto"); return; }
      puxado = dy * 0.55;                       // resistência, como no iOS
      if (e.cancelable) e.preventDefault();
      posicionar(puxado, puxado >= LIMITE);
    }, { passive: false });

    const soltar = () => {
      if (inicioY === null || atualizando) { inicioY = null; return; }
      inicioY = null;
      comTransicao();                            // a partir daqui, tudo anima suavemente
      if (puxado < LIMITE) { shell.style.transform = ""; ind.classList.remove("pronto"); ind.style.opacity = "0"; svg.style.transform = ""; return; }
      atualizando = true;
      // a tela para num respiro menor, só o suficiente para mostrar o ícone
      // girando, em vez de ficar no ponto máximo onde o dedo soltou
      shell.style.transform = `translateY(${REPOUSO_CARREGANDO}px)`;
      ind.style.opacity = "1";
      ind.classList.add("girando");
      verificarVersaoNova();
      const antes = DADOS.atualizadoEm;
      const tarefa = cfgSync().token
        ? sincronizar(true).then(() => { if (DADOS.atualizadoEm === antes) toast("Tudo atualizado."); })
        : Promise.resolve().then(() => { renderRota(); toast("Sincronização desligada — ligue em Configurações."); });
      const minimo = new Promise((ok) => setTimeout(ok, 700));   // tempo mínimo para o giro ser visível
      // se a sincronização travar (rede lenta, wi-fi cativo), o gesto se
      // libera sozinho depois de um tempo — sem isso, um travamento aqui
      // impediria o gesto de funcionar de novo nas próximas vezes
      travaSeguranca = setTimeout(resetar, 8000);
      Promise.race([Promise.all([tarefa, minimo]), new Promise((ok) => setTimeout(ok, 8000))])
        .then(resetar, resetar);
    };
    document.addEventListener("touchend", soltar, { passive: true });
    document.addEventListener("touchcancel", () => { if (!atualizando) resetar(); }, { passive: true });
  }

  // =========================================================================
  // CICLO DE VIDA
  // =========================================================================
  function iniciar() {
    if (A.definirAparelho) A.definirAparelho(rotuloAparelho());
    DADOS = A.carregarDados();
    migrarRecorrenciasAntigas();
    I.registrarPontoPatrimonio(DADOS);
    A.salvarDados(DADOS, true, true);   // automático: não conta como alteração sua
    A.aoMudar(() => { DADOS = A.carregarDados(); migrarRecorrenciasAntigas(); renderRota(); });

    ligarTopbar();
    ligarSidebar();
    ligarModalGlobal();
    ligarCliqueNotificacoes();
    // a faixa de cotações e a pílula do dólar ficam fora da área principal,
    // então precisam do seu próprio tratador de clique
    document.addEventListener("click", (e) => {
      const bq = e.target.closest("[data-cripto-qtd]");
      if (bq) { e.preventDefault(); e.stopPropagation(); abrirModalCripto(bq.dataset.criptoQtd); return; }
      const cr = e.target.closest("[data-cripto]");
      if (cr) { e.preventDefault(); e.stopPropagation(); navegarPara("detalhe-cripto", cr.dataset.cripto); return; }
      const alvo = e.target.closest('[data-acao="ir-dolar"]');
      if (alvo) { e.preventDefault(); navegarPara("detalhe-dolar"); return; }
      const acao = e.target.closest('#tickerTape [data-acao="ir-acao"]');
      if (acao) { e.preventDefault(); navegarPara("detalhe-acao", acao.dataset.id); }
    });
    ligarDelegacaoConteudo();
    ligarPuxarParaAtualizar();
    ligarMascaraMoeda(document.getElementById("conteudo"));
    iniciarRelogio();
    ajustarBarraGuias();
    // mede de novo quando as fontes terminam de carregar e quando a
    // data/hora muda de largura (a barra pode ter ficado apertada)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarBarraGuias);
    setTimeout(ajustarBarraGuias, 800);
    if (window.ResizeObserver) {
      let agendado = false, largAnt = 0;
      const sv = document.getElementById("statusVivo");
      if (sv) new ResizeObserver(() => {
        const l = Math.round(sv.getBoundingClientRect().width);
        if (Math.abs(l - largAnt) < 2 || agendado) return;
        largAnt = l; agendado = true;
        requestAnimationFrame(() => { agendado = false; ajustarBarraGuias(); });
      }).observe(sv);
    }
    window.addEventListener("resize", ajustarBarraGuias);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", ajustarBarraGuias);
    window.addEventListener("orientationchange", () => setTimeout(ajustarBarraGuias, 300));

    navegarPara("dashboard");
    // depois de buscar as cotações (histórico atualizado), procura as
    // notícias em segundo plano; e de novo a cada 30 minutos
    atualizarCotacoesAutomaticas(true).then(() => setTimeout(buscarNoticiasEmSegundoPlano, 3000));
    setInterval(buscarNoticiasEmSegundoPlano, 30 * 60 * 1000);
    setInterval(() => atualizarCotacoesAutomaticas(true), 5 * 60 * 1000);
    // ao abrir/atualizar a página; a correção do VR/VT só roda depois de
    // trazer os dados do cofre, para nunca mexer numa cópia velha
    sincronizar(true).then(() => {
      if (cfgSync().token && !syncBaixado) return;
      const msg = migrarVrVtParaTransferencia();
      const msgDestino = migrarVrVtDestinoInter();
      if (msg || msgDestino) { salvarEAtualizar([msg, msgDestino].filter(Boolean).join(" ")); renderRota(); }
    });
    setInterval(() => { if (document.visibilityState !== "hidden") sincronizar(true); }, 30 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") sincronizar(true);   // voltou para a aba/app
      else if (cfgSync().token) { clearTimeout(timerEnvio); sincronizar(true); }  // saiu: envia já
    });
    window.addEventListener("focus", () => sincronizar(true));
    window.addEventListener("online", () => sincronizar(true));
  }

  function salvarEAtualizar(mensagem) {
    A.salvarDados(DADOS);
    if (mensagem) toast(mensagem);
    agendarEnvioSync();
    // a entrada que dispara uma transferência automática pode ter acabado de cair
    setTimeout(conferirTransfAutoNovas, 0);
  }

  function navegarPara(secao, param) {
    ROTA = { secao, param: param || null };
    // cada abertura do gráfico do dólar/ação procura notícias novas
    if (secao === "detalhe-dolar" || secao === "detalhe-acao" || secao === "detalhe-cripto" || secao === "detalhe-mercado") aberturaGrafico++;
    else chaveNaTela = null;   // saiu do gráfico: a busca dele deixa de ter prioridade
    // ao entrar na guia, o filtro volta sempre para o mês e o ano atuais
    if (secao === "entradas") { mesEntradas = F.mesAtual(); ordemEntradas = { ...ORDEM_ENTRADAS_PADRAO }; filtroEntradas = null; }
    if (secao === "despesas") { mesDespesas = F.mesAtual(); ordemDespesas = { ...ORDEM_DESPESAS_PADRAO }; filtroDespesas = null; }
    // o período dos gráficos abre sempre no padrão, em vez de guardar a
    // escolha anterior: ações e moeda (USD/BRL) em "3 meses"; investimentos em "Tudo"
    if (["acoes", "detalhe-acao", "detalhe-dolar", "detalhe-cripto", "detalhe-mercado"].includes(secao)) periodoGrafico = "90d";
    if (["investimentos", "detalhe-investimento"].includes(secao)) periodoGrafico = "tudo";
    // a guia Nasdaq busca as cotações ao abrir (se o retrato tiver mais de 10 min)
    if (secao === "nasdaq") {
      atualizarMercado(false);
      atualizarIndicadoresBCB(false);
      // séries do bitcoin e do ethereum para os minigráficos das caixas
      ["BTC", "ETH"].forEach((m) => { if (!seriesCripto[m]) carregarSerieCripto(m).then(() => { if (ROTA.secao === "nasdaq") renderRota(); }).catch(() => {}); });
      // sem notícias (ou com mais de 15 min): busca agora, sem esperar o relógio
      if (!(mercado.noticias && mercado.noticias.length) || Date.now() - (mercado.noticiasEm || 0) > 15 * 60 * 1000) atualizarNoticiasMercado();
    }
    // o gráfico do dólar e o de cada ação abrem sempre em velas (candles);
    // tocar no gráfico alterna para a linha e de volta
    if (secao === "detalhe-dolar" || secao === "detalhe-cripto") velasDolar = true;
    if (secao === "detalhe-acao" || secao === "detalhe-mercado") velasAcao = true;
    // a guia Bancos sempre abre mostrando o saldo atual ("Tudo")
    if (secao === "bancos") { mesesBancos = 0; anoBancos = String(new Date().getFullYear()); }
    // Dashboard e Relatórios abrem sempre no ano atual: receitas x despesas
    // em 12 meses e evolução patrimonial em "Tudo"
    if (secao === "dashboard") {
      anoRD = String(new Date().getFullYear()); mesesRD = 12;
      anoMetas = String(new Date().getFullYear()); periodoMetas = 0;
      anoEvo = String(new Date().getFullYear()); mesesEvo = 12;
    }
    if (secao === "relatorios") {
      anoRelA = String(new Date().getFullYear()); mesesRelA = 12;
      anoRelB = String(new Date().getFullYear()); mesesRelB = 12;
    }
    document.querySelectorAll("#navPrincipal button").forEach((b) => b.classList.toggle("ativo", b.dataset.secao === secao));
    fecharSidebarMobile();
    renderRota();
    // toda troca de guia começa no topo da página
    const area = document.querySelector(".scroll");
    if (area) area.scrollTop = 0;
    if (typeof window.scrollTo === "function") window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  const TITULOS = {
    dashboard: ["Dashboard", "Visão geral das suas finanças"],
    financas: ["Finanças", "Resumo patrimonial e composição do seu patrimônio"],
    bancos: ["Meus Bancos", "Contas cadastradas e saldo calculado automaticamente"],
    entradas: ["Entradas", "Receitas, salário e outras entradas de dinheiro"],
    despesas: ["Despesas", "Gastos lançados e contas a pagar"],
    cartoes: ["Cartões de crédito", "Limite, uso e disponibilidade de cada cartão"],
    contas: ["Despesas", "Gastos lançados e contas a pagar"],
    historico: ["Histórico financeiro", "Todas as movimentações em um só lugar"],
    investimentos: ["Investimentos", "Renda fixa, tesouro, fundos e criptomoedas"],
    acoes: ["Ações", "Ações, FIIs e ETFs — preços atualizados manualmente"],
    nasdaq: ["Bolsa", "Relatório diário e mercado: Nasdaq e bolsa brasileira"],
    "detalhe-mercado": ["Detalhe do ativo", "Cotação, histórico e notícias"],
    "detalhe-investimento": ["Detalhe da aplicação", "Histórico, imposto e rentabilidade"],
    "detalhe-dolar": ["Dólar comercial", "USD/BRL — cotação e histórico"],
    "detalhe-cripto": ["Criptomoeda", "Cotação, histórico e a quantidade que você tem"],
    "detalhe-acao": ["Detalhe do ativo", "Histórico e composição da posição"],
    carteira: ["Carteira de ações", "Composição e rentabilidade da carteira"],
    relatorios: ["Relatórios", "Análises por período"],
    metas: ["Metas financeiras", "Objetivos e progresso"],
    configuracoes: ["Configurações", "Backup, importação e privacidade"]
  };

  function renderRota() {
    const t = TITULOS[ROTA.secao] || TITULOS.dashboard;
    document.getElementById("tituloSecao").textContent = t[0];
    document.getElementById("subtituloSecao").textContent = t[1];

    const mapa = {
      dashboard: renderDashboard, financas: renderFinancas, bancos: renderBancos,
      entradas: renderEntradas, despesas: renderDespesas, cartoes: renderCartoes,
      contas: renderDespesas, historico: renderHistorico, investimentos: renderInvestimentos,
      acoes: renderAcoes, nasdaq: renderNasdaq, "detalhe-mercado": renderDetalheMercado, "detalhe-acao": renderDetalheAcao, "detalhe-investimento": renderDetalheInvestimento, "detalhe-dolar": renderDetalheDolar, "detalhe-cripto": renderDetalheCripto, carteira: renderCarteira,
      relatorios: renderRelatorios, metas: renderMetas, configuracoes: renderConfiguracoes
    };
    const fn = mapa[ROTA.secao] || renderDashboard;
    document.getElementById("conteudo").innerHTML = fn(DADOS, ROTA.param);
    if (ROTA.secao === "configuracoes") montarAreaBiometria();
    if (ROTA.secao === "configuracoes" && A.ehDesktop) A.caminhoBanco().then((c) => { const el = document.getElementById("caminhoBanco"); if (el) el.textContent = "Local do banco: " + c; });
    montarGraficosDaRota();
    atualizarBadgeNotificacoes();
    atualizarTicker();
    atualizarSidebarMeta();
    atualizarRodape();
    renderDolar();
    renderCripto();
  }

  // =========================================================================
  // TOAST + MODAL
  // =========================================================================
  let timerToast = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => el.classList.remove("on"), 2400);
  }

  function abrirModal(html, largo) {
    const m = document.getElementById("modal");
    m.className = "modal on" + (largo ? " largo" : "");
    m.style.width = "";   // a largura ajustada de um histórico não passa para o próximo quadro
    m.innerHTML = html;
    ligarSetasNumero(m);
    document.getElementById("scrim").classList.add("on");
    const primeiro = m.querySelector("input, select, textarea");
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
    ajustarComoCalcula(m);
    ajustarDescricoesPainel(m);
    alinharValoresPainel(m);
  }
  // Campos de número inteiro (dia do mês, dia útil, parcelas…): setas para
  // cima e para baixo dentro do campo, como as das listas — a de cima soma 1,
  // a de baixo tira 1, sem passar do mínimo/máximo. Num campo que aceita
  // vazio (Parcelas: min 0), descer até 0 volta a deixar vazio.
  const SETA_CIMA = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 7.5L6 4.5l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SETA_BAIXO = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5L6 7.5l3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function ligarSetasNumero(raiz) {
    raiz.querySelectorAll('input[type="number"][min][max]:not([step])').forEach((inp) => {
      if (inp.parentNode.classList.contains("campo-setas")) return;
      const caixa = document.createElement("div");
      caixa.className = "campo-setas";
      inp.parentNode.insertBefore(caixa, inp);
      caixa.appendChild(inp);
      caixa.insertAdjacentHTML("beforeend", `<span class="setas-num"><button type="button" tabindex="-1" data-passo="1" aria-label="Aumentar">${SETA_CIMA}</button><button type="button" tabindex="-1" data-passo="-1" aria-label="Diminuir">${SETA_BAIXO}</button></span>`);
      caixa.querySelectorAll("[data-passo]").forEach((bt) => {
        bt.onmousedown = (e) => e.preventDefault();   // não tira o foco nem abre o teclado
        bt.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          const min = Number(inp.min), max = Number(inp.max), passo = Number(bt.dataset.passo);
          const atual = inp.value === "" ? (passo > 0 ? Math.max(min, 0) : min) : Math.round(Number(inp.value) || 0);
          const novo = Math.min(max, Math.max(min, atual + passo));
          inp.value = min <= 0 && novo <= 0 ? "" : String(novo);
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
        };
      });
    });
  }
  // nome do lançamento e "Categoria · Tipo" na mesma linha: o quadro fica mais
  // largo o quanto for preciso (até o limite da tela); se não couber, quebra linha
  function ajustarDescricoesPainel(m) {
    const descs = [...m.querySelectorAll(".desc-painel")];
    if (!descs.length || window.innerWidth <= 600) return;
    const falta = Math.max(0, ...descs.map((d) => {
      const nm = d.querySelector(".dp-nm"), sub = d.querySelector(".dp-sub");
      if (!nm || !sub) return 0;
      const r = document.createRange(); r.selectNodeContents(nm); const wNm = r.getBoundingClientRect().width;
      r.selectNodeContents(sub); const wSub = r.getBoundingClientRect().width;
      return Math.ceil(wNm + 8 + wSub + 2 - d.getBoundingClientRect().width);
    }));
    if (!falta) return;
    const largura = Math.ceil(m.getBoundingClientRect().width + falta);
    m.style.width = Math.min(largura, window.innerWidth - 24) + "px";
  }
  // "Como é calculado: …" numa linha só: o quadro fica mais largo o quanto for
  // preciso (até o limite da tela); se não couber, a frase quebra linha como antes
  function ajustarComoCalcula(m) {
    const p = m.querySelector("p.campo.ajuda");
    if (!p) return;
    p.style.whiteSpace = "nowrap";
    const falta = p.scrollWidth - p.clientWidth;
    if (falta <= 0) return;
    const largura = Math.ceil(m.getBoundingClientRect().width + falta + 2);
    if (largura <= window.innerWidth - 24) m.style.width = largura + "px";
    else p.style.whiteSpace = "";
  }
  // quadros de detalhe: a coluna dos valores fica com a largura do maior valor,
  // encostada à direita do quadro, e cada valor começa no mesmo ponto (à esquerda)
  function alinharValoresPainel(m) {
    const vals = [...m.querySelectorAll(".explica-lista > .kv:not(.kv-cab):not(.kv-total):not(.kv-previsto) > b")]
      .filter((b) => !b.parentElement.querySelector(".desc-painel"));
    if (!vals.length) return;
    vals.forEach((b) => { b.style.minWidth = ""; });
    const largura = Math.max(...vals.map((b) => b.getBoundingClientRect().width));
    const limite = (m.querySelector(".explica-lista") || m).getBoundingClientRect().width * 0.6;
    if (largura > 0 && largura <= limite) vals.forEach((b) => { b.style.minWidth = Math.ceil(largura) + "px"; });
  }
  function fecharModal() {
    painelReabrir = null;
    document.getElementById("modal").classList.remove("on");
    document.getElementById("scrim").classList.remove("on");
  }
  function ligarModalGlobal() {
    ligarMascaraMoeda(document.getElementById("modal"));
    ligarCamposBanco(document.getElementById("modal"));
    document.getElementById("scrim").addEventListener("click", fecharModal);
    // selo de status clicável dentro dos painéis "Receitas/Despesas do mês"
    document.getElementById("modal").addEventListener("click", (e) => {
      const st = e.target.closest("[data-acao-status]");
      if (st) {
        e.stopPropagation();
        // se abriu a escolha do banco, o painel é redesenhado depois dela
        if (alternarStatusLancamento(st.dataset.acaoStatus, st.dataset.id, st.dataset.mes)) return;
        if (painelReabrir) painelReabrir();   // redesenha com o status novo
        return;
      }
      const bc = e.target.closest("[data-acao-banco]");
      if (bc) {
        e.stopPropagation();
        alternarBancoLancamento(bc.dataset.acaoBanco, bc.dataset.id);
        if (painelReabrir) painelReabrir();   // redesenha com o banco novo
        return;
      }
      const ab = e.target.closest("[data-abrir-banco]");
      if (ab) { e.stopPropagation(); explicarBanco(ab.dataset.abrirBanco); return; }
      const hc = e.target.closest("[data-historico-classe]");
      if (hc) { e.stopPropagation(); origemHistorico = painelKpiAberto || "patrimonio"; explicarHistoricoClasse(hc.dataset.historicoClasse); return; }
      const ta = e.target.closest("[data-transf-auto]");
      if (ta) { e.stopPropagation(); abrirModalTransfAutoMes(ta.dataset.transfAuto, ta.dataset.mes); return; }
      const tm = e.target.closest("[data-transf-id]");
      if (tm) { e.stopPropagation(); abrirModalTransferencia(tm.dataset.transfId); return; }
      const aj = e.target.closest("[data-ajuste-id]");
      if (aj) { e.stopPropagation(); abrirModalAjusteSaldo(aj.dataset.ajusteId); return; }
      const ir = e.target.closest("[data-ir-secao]");
      if (ir) { e.stopPropagation(); irParaLancamento(ir.dataset.irSecao, ir.dataset.irId, ir.dataset.irData); return; }
      const ln = e.target.closest("[data-acao-editar]");
      if (ln) {
        e.stopPropagation();
        abrirEdicaoLancamento(ln.dataset.acaoEditar, ln.dataset.id, ln.dataset.data);
      }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharModal(); });
  }

  // leva da linha do histórico da conta até o lançamento na guia Entradas ou
  // Despesas: abre o mês dele, rola até a linha e a destaca por um instante
  function irParaLancamento(secao, id, data) {
    fecharModal();
    navegarPara(secao);
    const mes = String(data || "").slice(0, 7);
    if (mes) { if (secao === "entradas") mesEntradas = mes; else mesDespesas = mes; renderRota(); }
    const linhas = [...document.querySelectorAll(`#conteudo .rw[data-id="${CSS.escape(String(id))}"]`)];
    const alvo = linhas.find((l) => l.dataset.data === data) || linhas[0];
    if (!alvo) { toast("Não encontrei esse lançamento na lista."); return; }
    alvo.scrollIntoView({ behavior: "smooth", block: "center" });
    alvo.classList.remove("linha-destaque"); void alvo.offsetWidth; alvo.classList.add("linha-destaque");
    setTimeout(() => alvo.classList.remove("linha-destaque"), 2600);
  }

  function confirmarExclusao(mensagem, aoConfirmar) {
    if (window.confirm(mensagem)) aoConfirmar();
  }

  // =========================================================================
  // TOPBAR + SIDEBAR
  // =========================================================================
  function ligarTopbar() {
    const btnExp = document.getElementById("btnBackupExportar");
    if (btnExp) btnExp.addEventListener("click", () => { A.exportarDados(); toast("Backup exportado — verifique seus downloads."); });

    const btnNotif = document.getElementById("btnNotificacoes");
    const dropNotif = document.getElementById("dropdownNotificacoes");
    const popDataEl = document.getElementById("popData");
    btnNotif.addEventListener("click", (e) => {
      e.stopPropagation();
      dropNotif.classList.toggle("on");
      // abrir as notificações fecha o quadro da data (e vice-versa, abaixo)
      if (dropNotif.classList.contains("on")) { if (popDataEl) popDataEl.classList.remove("on"); preencherNotificacoes(); }
    });
    document.addEventListener("click", (e) => {
      if (!dropNotif.contains(e.target) && !btnNotif.contains(e.target)) dropNotif.classList.remove("on");
    });

    // data e hora: um toque abre o quadro com a data completa, outro toque esconde
    const caixaData = document.getElementById("statusVivo"), popData = document.getElementById("popData");
    if (caixaData && popData) {
      caixaData.addEventListener("click", (e) => {
        e.stopPropagation();
        popData.classList.toggle("on");
        if (popData.classList.contains("on")) { dropNotif.classList.remove("on"); preencherPopData(new Date()); }
      });
      document.addEventListener("click", (e) => {
        if (!popData.contains(e.target) && !caixaData.contains(e.target)) popData.classList.remove("on");
      });
    }
  }

  // quadro da data completa (aberto pelo relógio do topo)
  const NOMES_FERIADOS = { "01-01": "Confraternização Universal", "04-21": "Tiradentes", "05-01": "Dia do Trabalho", "09-07": "Independência do Brasil",
    "10-12": "Nossa Senhora Aparecida", "11-02": "Finados", "11-15": "Proclamação da República", "11-20": "Dia da Consciência Negra", "12-25": "Natal" };
  // "Brasília · UTC−3" (o nome da cidade vem do fuso do aparelho)
  function fusoHorario(agora) {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").split("/").pop().replace(/_/g, " ");
    const off = -agora.getTimezoneOffset(), h = Math.floor(Math.abs(off) / 60), m = Math.abs(off) % 60;
    const utc = "UTC" + (off ? (off > 0 ? "+" : "−") + h + (m ? ":" + String(m).padStart(2, "0") : "") : "");
    const cidade = tz === "Sao Paulo" ? "Brasília" : tz;
    return cidade && cidade !== "UTC" ? `${cidade} · ${utc}` : utc;
  }
  function preencherPopData(agora) {
    const el = document.getElementById("popData");
    if (!el || !el.classList.contains("on")) return;
    const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const feriado = (dt) => F.feriadosNacionais(dt.getFullYear())[iso(dt)] ? (NOMES_FERIADOS[iso(dt).slice(5)] || "Sexta-feira Santa") : "";
    const util = (dt) => dt.getDay() >= 1 && dt.getDay() <= 5 && !feriado(dt);
    const fer = feriado(agora);
    const tipoDia = fer ? `Feriado · ${fer}` : util(agora) ? "Dia Útil" : "Fim de Semana";
    const clsDia = fer ? "pd-chip-fer" : util(agora) ? "pd-chip-util" : "pd-chip-fds";
    // pregão da B3: das 9 às 18 horas nos dias úteis
    const ABRE = 9 * 60, FECHA = 18 * 60;
    const min = agora.getHours() * 60 + agora.getMinutes() + agora.getSeconds() / 60;
    const aberto = util(agora) && min >= ABRE && min < FECHA;
    // próxima abertura: hoje (antes das 9 horas) ou o próximo dia útil
    const proxAbertura = () => {
      const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 9, 0, 0);
      if (util(agora) && min < ABRE) return d;
      do { d.setDate(d.getDate() + 1); } while (!util(d));
      return d;
    };
    const duracao = (ms) => {
      const totalMin = Math.max(0, Math.round(ms / 60000)), dias = Math.floor(totalMin / 1440), h = Math.floor((totalMin % 1440) / 60), m = totalMin % 60;
      const partes = [];
      if (dias) partes.push(`${dias} ${dias === 1 ? "dia" : "dias"}`);
      if (h) partes.push(`${h} ${h === 1 ? "hora" : "horas"}`);
      if (m || !partes.length) partes.push(`${m} ${m === 1 ? "minuto" : "minutos"}`);
      return partes.length > 1 ? partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1] : partes[0];
    };
    const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 18, 0, 0);
    const prox = proxAbertura();
    const contagem = aberto ? `Fechamento às 18 horas<small>em ${duracao(fim - agora)}</small>`
      : `Abertura ${prox.toDateString() === agora.toDateString() ? "hoje" : (() => { const d = prox.toLocaleDateString("pt-BR", { weekday: "long" }); return d.charAt(0).toUpperCase() + d.slice(1); })()} às 9 horas<small>em ${duracao(prox - agora)}</small>`;
    // andamento do pregão de hoje (0% às 9 horas, 100% às 18 horas)
    const pct = util(agora) ? Math.max(0, Math.min(100, (min - ABRE) / (FECHA - ABRE) * 100)) : 0;
    const hora = agora.toLocaleTimeString("pt-BR"), [hh, mm, ss] = hora.split(":");
    el.innerHTML = `
      <div class="pd-topo">
        <div class="pd-esq"><div class="pd-semana">${agora.toLocaleDateString("pt-BR", { weekday: "long" })}</div>
          <div class="pd-data">${agora.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</div>
          <span class="pd-chip ${clsDia}">${esc(tipoDia)}</span></div>
        <div class="pd-direita"><div class="pd-hora">${hh}:${mm}<small>:${ss}</small></div><div class="pd-fuso">${fusoHorario(agora)}</div></div>
      </div>
      <div class="pd-mercado">
        <div class="pd-merc-topo"><b>Bolsa de Valores · B3</b><span class="pd-status ${aberto ? "pd-aberto" : "pd-fechado"}"><i></i>${aberto ? "Mercado Aberto" : "Mercado Fechado"}</span></div>
        <div class="pd-barra${aberto ? "" : " pd-barra-off"}" title="Andamento do pregão de hoje"><span style="width:${pct.toFixed(1)}%"></span>${util(agora) && min >= ABRE && min <= FECHA ? `<em style="left:${pct.toFixed(1)}%"></em>` : ""}</div>
        <div class="pd-horarios"><span>Abertura · 9 horas</span><span>Fechamento · 18 horas</span></div>
        <div class="pd-contagem">${contagem}</div>
      </div>`;
  }

  function ligarSidebar() {
    document.getElementById("navPrincipal").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-secao]");
      if (b) navegarPara(b.dataset.secao);
    });
    const logo = document.getElementById("btnLogo");
    if (logo) logo.addEventListener("click", () => navegarPara("dashboard"));
    const sbMeta = document.getElementById("sidebarMeta");
    if (sbMeta) sbMeta.addEventListener("click", (e) => {
      const b = e.target.closest("[data-acao='ir']");
      if (b) navegarPara(b.dataset.secao);
    });
    const hamb = document.getElementById("btnHamburguer");
    const sidebar = document.getElementById("sidebar");
    const scrimMenu = document.getElementById("scrimMenu");
    if (hamb) hamb.addEventListener("click", () => { sidebar.classList.add("aberta"); scrimMenu.classList.add("on"); });
    if (scrimMenu) scrimMenu.addEventListener("click", fecharSidebarMobile);
  }
  function fecharSidebarMobile() {
    const sb = document.getElementById("sidebar"), sc = document.getElementById("scrimMenu");
    if (sb) sb.classList.remove("aberta");
    if (sc) sc.classList.remove("on");
  }

  // =========================================================================
  // ALERTAS / NOTIFICAÇÕES (calculados a partir dos dados reais)
  // =========================================================================
  // dia do pagamento no mês, tirado da guia Entradas: a data do salário daquele mês,
  // já lançado ou previsto pela repetição configurada (ex.: "4º dia útil").
  // Usa a entrada com "Salário" na descrição; se não houver, a de categoria Salário.
  function diaPagamentoMes(d, mes) {
    const doMes = listaEntradasTodasMes(d, mes).filter((e) => e.data);
    const porNome = doMes.filter((e) => /sal[aá]rio/i.test(e.descricao || ""));
    const lista = porNome.length ? porNome : doMes.filter((e) => e.categoria === "Salário");
    return lista.length ? lista.map((e) => String(e.data)).sort()[0] : null;
  }
  // a partir do dia do pagamento, avisa as metas que ainda não têm o "Guardar Mês" completo
  function alertaMetasPagamento(d) {
    const mes = F.mesAtual(), pagamento = diaPagamentoMes(d, mes);
    if (!pagamento || isoLocal(new Date()) < pagamento) return null;
    const pendentes = d.metas.filter((m) => situacaoMeta(m).chave !== "ok");
    if (!pendentes.length) return null;
    const nenhum = pendentes.some((m) => situacaoMeta(m).chave === "nada");
    // todas as metas, cada uma com o emoji e o valor do "Guardar Mês"
    // atrasada: o valor para ficar em dia; as outras: o "Guardar Mês"
    const partes = metasPorStatus(d.metas).map((m) => { const st = situacaoMeta(m);
      return `${emojiMeta(m)} ${esc(m.nome)}${st.atrasado ? ` ${brl(st.deposito)} (atrasada)` : Number(m.aporteMensal || 0) > 0 ? ` ${brl(m.aporteMensal)}` : ""}`; });
    return { tipo: nenhum ? "perigo" : "aviso", rota: "metas",
      texto: `Seu salário foi pago (${fmtData(pagamento)}):<span class="notif-lista">${partes.map((x) => `<span class="notif-item">${x}</span>`).join("")}</span>` };
  }

  // metas devendo depósitos de meses anteriores: avisa sempre (não só depois
  // do salário), com o valor para cada uma ficar em dia
  function alertaMetasAtrasadas(d) {
    const atrasadas = metasPorStatus(d.metas).map((m) => ({ m, st: situacaoMeta(m) })).filter((x) => x.st.atrasado);
    if (!atrasadas.length) return null;
    if (atrasadas.length === 1) {
      const { m, st } = atrasadas[0];
      return { tipo: "perigo", rota: "metas", texto: `A meta ${emojiMeta(m)} ${esc(m.nome)} está atrasada (${brl(atrasoMeta(m))}): deposite ${brl(st.deposito)} para ficar em dia.` };
    }
    const total = atrasadas.reduce((t, x) => t + x.st.deposito, 0);
    return { tipo: "perigo", rota: "metas",
      texto: `${atrasadas.length} metas estão atrasadas, ${brl(total)} para ficar em dia:<span class="notif-lista">${atrasadas.map(({ m, st }) =>
        `<span class="notif-item">${emojiMeta(m)} ${esc(m.nome)} ${brl(st.deposito)}</span>`).join("")}</span>` };
  }

  function gerarAlertas(d) {
    const alertas = [];
    const avisoAtraso = alertaMetasAtrasadas(d);
    if (avisoAtraso) alertas.push(avisoAtraso);
    const avisoMetas = alertaMetasPagamento(d);
    if (avisoMetas) alertas.push(avisoMetas);

    const atrasadas = F.contasAtrasadas(d);
    if (atrasadas.length) {
      const total = atrasadas.reduce((s, c) => s + Number(c.valor || 0), 0);
      alertas.push({ tipo: "perigo", rota: "despesas", texto: atrasadas.length === 1
        ? `A conta "${atrasadas[0].descricao}" está atrasada (${brl(atrasadas[0].valor)}).`
        : `${atrasadas.length} contas estão atrasadas, somando ${brl(total)}.` });
    }

    const vencendo = contasPendentesMes(d, F.mesAtual()).filter((c) => c.statusReal === "Pendente");
    if (vencendo.length) {
      alertas.push({ tipo: "aviso", rota: "despesas", texto: `${vencendo.length === 1 ? "Existe 1 conta pendente" : `Existem ${vencendo.length} contas pendentes`} no mês atual.` });
    }

    // categorias de despesa com alta em relação à média dos últimos 3 meses
    const catsAtual = despesasPorCategoriaPagas(d, F.mesAtual());
    let avisosCategorias = 0;
    for (const c of catsAtual) {
      if (avisosCategorias >= 2) break;
      let soma = 0, meses = 0;
      for (let i = 1; i <= 3; i++) {
        const dt = new Date(); dt.setMonth(dt.getMonth() - i);
        const chave = dt.toISOString().slice(0, 7);
        const v = (despesasPorCategoriaPagas(d, chave).find((x) => x.categoria === c.categoria) || {}).valor || 0;
        if (v > 0) { soma += v; meses++; }
      }
      if (meses > 0) {
        const media = soma / meses;
        const variacao = ((c.valor - media) / media) * 100;
        if (variacao > 15) {
          alertas.push({ tipo: "aviso", rota: "despesas", texto: `Você gastou ${variacao.toFixed(0)}% a mais com ${c.categoria} este mês, comparado à sua média.` });
          avisosCategorias++;
        }
      }
    }

    // cartões perto do limite
    F.listaCartoesComUso(d).forEach((c) => {
      if (c.limite > 0 && c.percentualUso >= 80) {
        alertas.push({ tipo: c.percentualUso >= 100 ? "perigo" : "aviso", rota: "cartoes", texto: `O cartão ${c.nome} já usou ${c.percentualUso.toFixed(0)}% do limite.` });
      }
    });

    // gasto do mês projetado acima da média
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const gastoAtual = totalDespesasPagasMes(d, F.mesAtual());
    let somaAnt = 0, mesesAnt = 0;
    for (let i = 1; i <= 3; i++) {
      const dt = new Date(); dt.setMonth(dt.getMonth() - i);
      const total = totalDespesasPagasMes(d, dt.toISOString().slice(0, 7));
      if (total > 0) { somaAnt += total; mesesAnt++; }
    }
    if (mesesAnt > 0 && diaAtual >= 5) {
      const mediaAnt = somaAnt / mesesAnt;
      const projecao = (gastoAtual / diaAtual) * diasNoMes;
      if (projecao > mediaAnt * 1.1) {
        alertas.push({ tipo: "aviso", rota: "despesas", texto: "No ritmo atual, você deve fechar o mês gastando acima da sua média." });
      }
    }

    // carteira de ações
    // metas cujo prazo passou sem atingir o objetivo
    const metasVencidas = (d.metas || []).filter((m) => m.prazo && F.diasEntre(m.prazo) < 0 && Number(m.atual || 0) < Number(m.objetivo || 0));
    metasVencidas.forEach((m) => {
      const falta = Number(m.objetivo || 0) - Number(m.atual || 0);
      alertas.push({
        tipo: "perigo", rota: "metas",
        texto: `A meta "${esc(m.nome)}" passou do prazo (${fmtData(m.prazo)}) e ainda faltam ${brl(falta)}.`
      });
    });

    if (d.acoes.length) {
      const rent = I.rentabilidadeCarteiraAcoes(d);
      alertas.push({ tipo: rent >= 0 ? "sucesso" : "info", rota: "acoes", texto: `Sua carteira de ações acumula ${pct(rent)} em relação ao preço médio.` });
    }

    return alertas;
  }

  const ICONE_ALERTA = {
    perigo: '<path d="M10 6v5M10 14h.01" stroke-linecap="round"/><path d="M8.6 3.4 2.4 15a1.5 1.5 0 0 0 1.3 2.2h12.6a1.5 1.5 0 0 0 1.3-2.2L11.4 3.4a1.5 1.5 0 0 0-2.8 0z"/>',
    aviso: '<circle cx="10" cy="10" r="7"/><path d="M10 6.5v4M10 13.2h.01"/>',
    sucesso: '<path d="M4 10.5l3.5 3.5L16 5"/>',
    info: '<circle cx="10" cy="10" r="7"/><path d="M10 9v4.5M10 6.6h.01"/>'
  };
  const COR_ALERTA = { perigo: "var(--down)", aviso: "var(--acc)", sucesso: "var(--up)", info: "var(--cy)" };

  function chaveAlerta(a) { return a.tipo + "|" + a.texto; }
  function alertasNaoLidos(d) {
    const lidas = d.notificacoesLidas || [];
    return gerarAlertas(d).filter((a) => lidas.indexOf(chaveAlerta(a)) === -1);
  }

  function preencherNotificacoes() {
    const pendentes = alertasNaoLidos(DADOS);
    const el = document.getElementById("dropdownNotificacoes");
    const topo = '<div class="dropdown-topo"><strong>Notificações</strong></div>';
    if (!pendentes.length) {
      el.innerHTML = topo + '<div class="dropdown-vazio">Nenhum alerta pendente. Tudo em ordem.</div>';
      return;
    }
    el.innerHTML = topo + pendentes.map((a) => `
      <button class="dropdown-item" data-chave="${esc(chaveAlerta(a))}" data-secao="${esc(a.rota || "dashboard")}">
        <span class="ic" style="background:${COR_ALERTA[a.tipo]}22;color:${COR_ALERTA[a.tipo]}">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONE_ALERTA[a.tipo]}</svg>
        </span>
        <p>${a.texto}</p>
      </button>`).join("");
  }

  // clicar num alerta: abre a tela correspondente e marca aquele como lido
  function ligarCliqueNotificacoes() {
    const drop = document.getElementById("dropdownNotificacoes");
    if (!drop) return;
    drop.addEventListener("click", (e) => {
      const item = e.target.closest(".dropdown-item[data-chave]");
      if (!item) return;
      e.stopPropagation();
      const chave = item.dataset.chave;
      const lidas = DADOS.notificacoesLidas || [];
      if (lidas.indexOf(chave) === -1) {
        DADOS.notificacoesLidas = [...lidas, chave];
        A.salvarDados(DADOS, true, true);
      }
      drop.classList.remove("on");
      navegarPara(item.dataset.secao || "dashboard");
    });
  }

  function atualizarBadgeNotificacoes() {
    const n = alertasNaoLidos(DADOS).length;
    const badge = document.getElementById("badgeNotificacoes");
    badge.style.display = n ? "flex" : "none";
    badge.textContent = n > 9 ? "9+" : String(n);
  }

  // =========================================================================
  // COMPONENTES REUTILIZÁVEIS
  // =========================================================================
  function card(span, titulo, sub, acoesHtml, corpoHtml, footHtml, id) {
    return `<section class="card ${span}"${id ? ` id="${id}"` : ""}>
      <header><div><h2>${titulo}</h2>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
      ${acoesHtml ? `<div class="acoes">${acoesHtml}</div>` : ""}</header>
      <div class="body">${corpoHtml}</div>
      ${footHtml ? `<div class="foot">${footHtml}</div>` : ""}
    </section>`;
  }
  function metricCard(rotulo, valor, iconePath, corVar, variacaoHtml, legenda, sparklineValores, viewBox, chave) {
    const spark = sparklineValores && sparklineValores.length > 1
      ? `<div class="sparkline">${sparklineSVG(sparklineValores, corVar)}</div>` : "";
    const tag = chave ? "button" : "div";
    const clic = chave ? ` data-acao="explicar-relatorio" data-chave="${chave}" title="Ver detalhes"` : "";
    return `<${tag} class="metric${chave ? " clicavel" : ""}"${clic}>
      <div class="topo"><span class="selo" style="background:${corVar}22;color:${corVar}">
        <svg viewBox="${viewBox || "0 0 20 20"}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${iconePath}</svg>
      </span><span class="rotulo">${rotulo}</span></div>
      <div class="valor">${valor}</div>
      ${variacaoHtml || ""}
      ${spark}
      ${legenda ? `<div class="legenda">${legenda}</div>` : ""}
    </${tag}>`;
  }
  function variacaoPill(v, rotulo) {
    const boa = v >= 0;
    return `<span class="variacao ${boa ? "pos" : "neg"}">${boa ? "▲" : "▼"} ${Math.abs(v).toFixed(1).replace(".", ",")}%</span> <span class="dim" style="font-size:11px">${rotulo || ""}</span>`;
  }


  // ícones próprios dos indicadores do rodapé do dashboard, desenhados
  // no mesmo traço (1.6) e na mesma caixa de 24x24 para ficarem uniformes

  // ---------------------------------------------------------------------
  // Marcas dos bancos — desenhadas como SVG (não são os logotipos oficiais,
  // e sim marcas próprias com a cor e a inicial de cada banco). Assim não
  // há imagem para pixelar nem distorcer, e o sistema segue funcionando
  // offline, sem depender de arquivos externos.
  // ---------------------------------------------------------------------
  const MARCAS_BANCO = {
    // bancos com logotipo próprio (arquivos em assets/icons/bancos)
    "nubank":          { arquivo: "nubank.svg" },
    "itaú":            { arquivo: "itau.svg" },
    "itau":            { arquivo: "itau.svg" },
    "inter":           { arquivo: "inter.svg" },
    "banco inter":     { arquivo: "inter.svg" },
    "banco do brasil": { arquivo: "banco-do-brasil.svg" },
    "bb":              { arquivo: "banco-do-brasil.svg" },
    "banco brasil":    { arquivo: "banco-do-brasil.svg" },
    "caixa":           { arquivo: "caixa.svg" },
    "caixa tem":       { arquivo: "caixa.svg" },
    "caixa econômica federal": { arquivo: "caixa.svg" },
    "mercado pago":    { arquivo: "mercado-pago.svg" },
    // demais bancos: marca com a cor e a inicial
    "bradesco":        { cor: "#CC092F", letra: "B" },
    "santander":       { cor: "#EC0000", letra: "S" },
    "c6 bank":         { cor: "#242424", letra: "C6" },
    "picpay":          { cor: "#21C25E", letra: "P" },
    "xp":              { cor: "#0F0F0F", letra: "XP" },
    "banco digimais":  { cor: "#0B7A3B", letra: "D" },
    "tesouro nacional": { cor: "#1B5E20", letra: "TN" }
  };

  // Mostra o logotipo do banco quando existe o arquivo; senão, um círculo
  // com a cor e a inicial. Os logotipos são SVG, então ficam nítidos em
  // qualquer tamanho e não distorcem (a altura manda, a largura é livre).
  function marcaBanco(nome, tamanho) {
    const t = tamanho || 22;
    const chave = String(nome || "").trim().toLowerCase();
    const m = MARCAS_BANCO[chave];
    if (m && m.arquivo) {
      // todo logo ocupa o mesmo quadrado (largura = altura), do tamanho do do Itaú
      const azulejo = /itau|banco-do-brasil|nubank|mercado-pago|inter|caixa/.test(m.arquivo) ? "" : " marca-azulejo";   // todos os logos têm o quadrado próprio (o branco fica para algum novo)
      return `<span class="marca-logo${azulejo}" style="width:${t}px;height:${t}px"><img src="assets/icons/bancos/${m.arquivo}?v=3.6.280" alt="" loading="lazy"></span>`;
    }
    const f = m || { cor: "var(--linha-2)", letra: (chave[0] || "?").toUpperCase() };
    const fonte = f.letra.length > 1 ? t * 0.42 : t * 0.52;
    return `<span class="marca-banco" style="width:${t}px;height:${t}px;background:${f.cor};color:${f.texto || "#fff"};font-size:${fonte}px" aria-hidden="true">${esc(f.letra)}</span>`;
  }

  const ICONES_REL = {
    receitas: '<path d="M3.5 19.5h17"/><path d="M12 16.5V4.5"/><path d="M7.5 9l4.5-4.5L16.5 9"/><path d="M6 19.5v-3M18 19.5v-5"/>',
    despesas: '<path d="M3.5 19.5h17"/><path d="M12 4.5v12"/><path d="M7.5 12l4.5 4.5L16.5 12"/><path d="M6 19.5v-5M18 19.5v-3"/>',
    resultado: '<path d="M4 18.5h16"/><path d="M4 14.5l4.5-4.5 3.5 3L20 5.5"/><path d="M15.5 5.5H20v4.5"/><circle cx="8.5" cy="10" r="1.3"/>',
    rentabilidade: '<circle cx="12" cy="12" r="8.5"/><path d="M9 15l6-6"/><circle cx="9.6" cy="9.6" r="1.4"/><circle cx="14.4" cy="14.4" r="1.4"/>'
  };

  const ICONES_STRIP = {
    // cofrinho: taxa de poupança
    poupanca: '<path d="M3.5 12.5c0-3.6 3.4-6.5 7.5-6.5 1 0 2 .2 2.9.5l2.6-1.8v2.9c1.2.9 2.1 2 2.6 3.4h1.4v3.4h-1.7c-.4.7-1 1.4-1.7 1.9V19h-2.6v-1.3c-.5.1-1 .2-1.5.2H11c-.5 0-1-.1-1.5-.2V19H6.9v-2.7c-2-1-3.4-2.8-3.4-3.8z"/><circle cx="14.6" cy="11" r=".9" fill="currentColor" stroke="none"/><path d="M8 7.2c.3-1.4 1.6-2.4 3-2.2"/>',
    // gráfico com seta de tendência: projeção de despesas
    projecao: '<path d="M3.5 19.5h17"/><path d="M4 16.5l4.5-4.5 3.5 3 6-7"/><path d="M14.5 8h3.5v3.5"/><path d="M4 12.5v4M8.5 14v2.5M12 13v3.5M18 9.5v7" opacity=".45"/>',
    // etiqueta de preço: maior gasto
    maiorgasto: '<path d="M11.4 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.6c0 .4-.2.8-.4 1.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0l-7.2-7.2a1.5 1.5 0 0 1 0-2.1l6.4-6.4c.3-.3.7-.4 1.1-.4z"/><circle cx="16.2" cy="7.8" r="1.4"/>',
    // troféu: melhor ativo
    melhorativo: '<path d="M8 4h8v4.5a4 4 0 0 1-8 0V4z"/><path d="M8 5.5H5.5v1.2A3.3 3.3 0 0 0 8 9.8M16 5.5h2.5v1.2a3.3 3.3 0 0 1-2.5 3.1"/><path d="M12 12.5V16"/><path d="M8.5 20h7"/><path d="M9.8 20c0-1.3.9-2.3 2.2-2.3s2.2 1 2.2 2.3"/>',
    // calendário com alerta: contas a vencer
    avencer: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3.5v3M16 3.5v3"/><path d="M12 12.5V16"/><circle cx="12" cy="18.2" r=".8" fill="currentColor" stroke="none"/>'
  };

  // caixa eletrônico 24h (botão Depositar dos bancos) e lápis (Editar):
  // vetoriais, ficam nítidos em qualquer tela
  const ICONE_CAIXA_24H = '<svg class="ic-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3.5" y="2" width="17" height="20" rx="2.5"/>' +
    '<rect x="6.2" y="4.6" width="11.6" height="7.4" rx="1.2"/>' +
    '<text x="12" y="10.35" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="5.6" font-weight="900" fill="currentColor" stroke="none" letter-spacing="-.2">24h</text>' +
    '<path d="M7 14.6h10"/><path d="M9 14.6v4.6h6v-4.6"/><path d="M11 17h2"/></svg>';
  const ICONE_EDITAR = '<svg class="ic-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
  // =========================================================================
  // ÍCONES DOS BOTÕES — um ícone por função, igual em todo o programa
  // (Depositar sempre com o caixa 24h, Editar com o lápis, Fechar com o X…).
  // A rotina abaixo coloca o ícone em todo botão .btn que ainda não tem um,
  // inclusive nas janelas abertas depois, sem precisar mexer em cada tela.
  // =========================================================================
  const svgIc = (miolo) => `<svg class="ic-btn ic-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${miolo}</svg>`;
  const ICONES_BOTAO = {
    depositar: ICONE_CAIXA_24H.replace('class="ic-btn"', 'class="ic-btn ic-auto"'),
    editar: ICONE_EDITAR.replace('class="ic-btn"', 'class="ic-btn ic-auto"'),
    fechar: svgIc('<path d="M6 6l12 12M18 6L6 18"/>'),
    salvar: svgIc('<path d="M5 3.5h11l3.5 3.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M7.5 3.5v5h8v-5"/><rect x="7" y="13" width="10" height="7.5" rx="1"/>'),
    excluir: svgIc('<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>'),
    buscar: svgIc('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4.5V9h-4.5"/>'),
    transferir: svgIc('<path d="M4 8h14l-3.5-3.5"/><path d="M20 16H6l3.5 3.5"/>'),
    novo: svgIc('<path d="M12 5v14M5 12h14"/>'),
    voltar: svgIc('<path d="M19 12H5.5"/><path d="M11 6l-6 6 6 6"/>'),
    sincronizar: svgIc('<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>'),
    desligar: svgIc('<path d="M12 3.5v8"/><path d="M6.8 6.5a7.5 7.5 0 1 0 10.4 0"/>'),
    exportar: svgIc('<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M4 14.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4.5"/>'),
    importar: svgIc('<path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5"/><path d="M4 14.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4.5"/>'),
    pdf: svgIc('<path d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5z"/><path d="M14 3.5v5h5"/><path d="M8.5 13h7M8.5 16.5h5"/>'),
    pago: svgIc('<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.7 2.7L16 9.5"/>'),
    saldo: svgIc('<path d="M12 4v16M8 20h8M4.5 7h15"/><path d="M4.5 7L2 13a2.5 2.5 0 0 0 5 0z"/><path d="M19.5 7L17 13a2.5 2.5 0 0 0 5 0z"/>'),
    pagar: svgIc('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>'),
    substituir: svgIc('<path d="M17 3.5l3 3-3 3"/><path d="M4 11V9.5a3 3 0 0 1 3-3h13"/><path d="M7 20.5l-3-3 3-3"/><path d="M20 13v1.5a3 3 0 0 1-3 3H4"/>'),
    senha: svgIc('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>'),
    biometria: svgIc('<path d="M7.5 5.5A8 8 0 0 1 20 12v1.5"/><path d="M4 12a8 8 0 0 1 1.2-4.2"/><path d="M8 12a4 4 0 0 1 8 0v2.5a9 9 0 0 1-1 4"/><path d="M12 12v3a7 7 0 0 1-2.2 5"/><path d="M4.5 16.5a11 11 0 0 0 .5-3"/>'),
    calendario: svgIc('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
    nuvemBaixar: svgIc('<path d="M7 18.5A4.5 4.5 0 0 1 6.5 9.6 6 6 0 0 1 18 8.5a4 4 0 0 1-.5 8"/><path d="M12 11v9M9 17l3 3 3-3"/>'),
    nuvemEnviar: svgIc('<path d="M7 18.5A4.5 4.5 0 0 1 6.5 9.6 6 6 0 0 1 18 8.5a4 4 0 0 1-.5 8"/><path d="M12 20v-9M9 14l3-3 3 3"/>'),
    pasta: svgIc('<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.5l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/>'),
    abrir: svgIc('<path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"/>')
  };
  // qual ícone combina com o botão: pela ação/id e pelo texto (ordem importa)
  const REGRAS_ICONE = [
    [(b, t) => b.id === "btnFecharPainel" || /^(fechar|cancelar)\b/.test(t), "fechar"],
    [(b, t) => /digital|face id/.test(t), "biometria"],
    [(b, t) => /senha/.test(t) || b.dataset.acao === "criar-senha", "senha"],
    [(b, t) => /^(excluir|apagar|remover)/.test(t), "excluir"],
    [(b, t) => /^(depositar|adicionar)\b/.test(t), "depositar"],
    [(b, t) => /^salvar\b/.test(t), "salvar"],
    [(b, t) => /^voltar\b/.test(t), "voltar"],
    [(b, t) => /^editar\b/.test(t), "editar"],
    [(b, t) => /^(buscar|atualizar)\b/.test(t), "buscar"],
    [(b, t) => /^transferir\b/.test(t), "transferir"],
    [(b, t) => /^desligar\b/.test(t), "desligar"],
    [(b, t) => /^(sincronizar|ligar)\b/.test(t), "sincronizar"],
    [(b, t) => /^exportar/.test(t), "exportar"],
    [(b, t) => /pdf/.test(t), "pdf"],
    [(b, t) => /^importar/.test(t), "importar"],
    [(b, t) => /^pagar\b/.test(t), "pagar"],
    [(b, t) => b.id === "btnSaldoReal", "saldo"],
    [(b, t) => /pago/.test(t), "pago"],
    [(b, t) => /^substituir/.test(t), "substituir"],
    [(b, t) => /este e os próximos|somente este mês/.test(t), "calendario"],
    [(b, t) => /cofre/.test(t), "nuvemBaixar"],
    [(b, t) => /^enviar/.test(t), "nuvemEnviar"],
    [(b, t) => /pasta/.test(t), "pasta"],
    [(b, t) => /^(novo|nova|criar|acrescentar)\b/.test(t), "novo"],
    [(b, t) => /^(abrir|continuar)\b/.test(t), "abrir"]
  ];
  function iconizarBotoes(raiz) {
    (raiz || document).querySelectorAll("button.btn:not([data-ic])").forEach((b) => {
      b.dataset.ic = "1";
      if (b.querySelector("svg") || b.dataset.extratoMeses || b.dataset.acao === "ordenar-historico") return;
      // tira o símbolo de texto antigo (+ ✎ ↻ ⇄): o ícone de verdade entra no lugar
      const prim = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (prim) prim.textContent = prim.textContent.replace(/^\s*[+✎↻⇄]\s*/, "");
      const t = b.textContent.trim().toLowerCase();
      if (!t) return;
      const regra = REGRAS_ICONE.find(([teste]) => teste(b, t));
      if (regra) b.insertAdjacentHTML("afterbegin", ICONES_BOTAO[regra[1]]);
    });
  }
  // qualquer tela, janela ou painel desenhado depois também ganha os ícones
  if (typeof MutationObserver === "function") {
    let agendado = false;
    new MutationObserver(() => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(() => { agendado = false; iconizarBotoes(document); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  const ICONES = {
    patrimonio: '<path d="M3 6.2A2.2 2.2 0 0 1 5.2 4h8.6A2.2 2.2 0 0 1 16 6.2v1H6a2 2 0 0 0 0 4h10v2.6A2.2 2.2 0 0 1 13.8 16H5.2A2.2 2.2 0 0 1 3 13.8V6.2z"/><circle cx="12.6" cy="9.2" r=".9" fill="currentColor" stroke="none"/>',
    banco: '<path d="M3 8l7-4 7 4"/><path d="M4 8h12v1H4z"/><path d="M5 9v6M9 9v6M13 9v6"/><path d="M3 16h14"/>',
    investimento: '<path d="M3 13l4.5-4.5L11 12l6-6"/><path d="M13 6h4v4"/>',
    entrada: '<path d="M10 15V6M6 10l4-4 4 4"/><path d="M4 16h12"/>',
    saida: '<path d="M10 5v9M6 10l4 4 4-4"/><path d="M4 16h12"/>',
    resultado: '<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r=".6" fill="currentColor" stroke="none"/>',
    editar: '<path d="M4 15.5V13l8.5-8.5a1.5 1.5 0 0 1 2 2L6 15H4v-2z"/>',
    excluir: '<path d="M4.5 5.5h11M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6 5.5 6.6 15a1 1 0 0 0 1 1h4.8a1 1 0 0 0 1-1l.6-9.5"/>',
    mais: '<path d="M10 4v12M4 10h12"/>',
    voltar: '<path d="M12 15l-5-5 5-5"/>'
  };

  function linhaAcoes(editarAcao, editarId, excluirAcao, excluirId) {
    return `<button class="btn fantasma" data-acao="${editarAcao}" data-id="${editarId}" title="Editar" aria-label="Editar">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONES.editar}</svg>
      </button>
      <button class="btn fantasma" data-acao="${excluirAcao}" data-id="${excluirId}" title="Excluir" aria-label="Excluir" style="color:var(--down)">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONES.excluir}</svg>
      </button>`;
  }

  function faixaDemo(d) {
    if (!d.demo || demoBannerOculto) return "";
    return `<div class="faixa-demo">
      <div><b>Dados de demonstração.</b> Estes valores são fictícios só para você ver o sistema funcionando.</div>
      <div class="acoes">
        <button class="btn pequeno" data-acao="manter-demo">Continuar explorando</button>
        <button class="btn pequeno perigo" data-acao="remover-demo">Apagar exemplo e começar do zero</button>
      </div>
      <button class="fechar" data-acao="manter-demo" title="Fechar este aviso" aria-label="Fechar aviso">×</button>
    </div>`;
  }

  // =========================================================================
  // WIDGETS — KPI com anel, gauge semicircular, barras, alertas, ticker
  // =========================================================================
  const EMOJI_KPI = { "Patrimônio líquido": "💎", "Saldo bancário": "🏦", "Bolsa Líquido": "📈", "Receitas mês": "💰", "Despesas mês": "💸" };
  function kpiCard(rotulo, valor, gaugePct, cor, deltaHtml, sub, chave) {
    const clicavel = chave ? ` data-acao="explicar-kpi" data-kpi="${chave}" title="Ver como este percentual é calculado"` : "";
    const gauge = gaugePct == null ? "" :
      `<button class="kpi-gauge${chave ? " clicavel" : ""}"${clicavel}>${gaugeSVG(gaugePct, cor, 66)}<span class="kpi-gauge-txt">${Math.round(Math.max(0, Math.min(100, gaugePct)))}%</span></button>`;
    return `<div class="kpi">
      <div class="kpi-rotulo">${EMOJI_KPI[rotulo] ? `<span class="kpi-emoji">${EMOJI_KPI[rotulo]}</span>` : ""}<span class="kpi-rotulo-txt">${rotulo}</span></div>
      <div class="kpi-corpo">${gauge}<div class="kpi-info">
        <div class="kpi-valor">${valor}</div>
        ${deltaHtml ? `<div class="kpi-delta">${deltaHtml}</div>` : ""}
        ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
      </div></div>
    </div>`;
  }
  function delta(v, texto, inverter) {
    const n = Number(v) || 0;
    const boa = inverter ? n <= 0 : n >= 0;
    return `<b class="${boa ? "up" : "down"}">${n >= 0 ? "↑" : "↓"} ${Math.abs(n).toFixed(1).replace(".", ",")}%</b> <span class="dim">${texto || ""}</span>`;
  }

  // gauge semicircular com marcador de limite (estilo Finanstat)
  function semiGaugeSVG(pct, limite, cor) {
    const p = Math.max(0, Math.min(100, pct || 0));
    const r = 50, cx = 60, cy = 58, comp = Math.PI * r;
    const ang = (v) => Math.PI - Math.PI * (v / 100);
    const px = (v, rr) => (cx + rr * Math.cos(ang(v))).toFixed(1);
    const py = (v, rr) => (cy - rr * Math.sin(ang(v))).toFixed(1);
    const arco = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    let marcador = "";
    if (limite != null) {
      marcador = `<line x1="${px(limite, r - 11)}" y1="${py(limite, r - 11)}" x2="${px(limite, r + 9)}" y2="${py(limite, r + 9)}" stroke="${cor}" stroke-width="2.5" stroke-linecap="round"></line>
        <text x="${px(limite, r + 20)}" y="${py(limite, r + 20)}" fill="${cor}" font-size="9" font-weight="700" text-anchor="middle" dominant-baseline="middle">${limite}%</text>`;
    }
    return `<svg viewBox="0 0 120 70" class="semi-gauge">
      <path d="${arco}" fill="none" stroke="var(--linha-2)" stroke-width="12" stroke-linecap="round"></path>
      <path d="${arco}" fill="none" stroke="${cor}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${comp.toFixed(1)}" stroke-dashoffset="${(comp - comp * p / 100).toFixed(1)}"></path>
      ${marcador}
      <text x="60" y="52" fill="${cor}" font-size="20" font-weight="700" text-anchor="middle" font-family="ui-monospace, Menlo, monospace">${Math.round(p)}%</text>
      <text x="10" y="68" fill="var(--dim)" font-size="8" text-anchor="middle">0%</text>
      <text x="110" y="68" fill="var(--dim)" font-size="8" text-anchor="middle">100%</text>
    </svg>`;
  }

  // lista de barras horizontais com % dentro (estilo "Regional Sales")
  function barList(itens, cor) {
    if (!itens.length) return `<div class="empty">Sem dados ainda.</div>`;
    const soma = itens.reduce((t, i) => t + Math.abs(i.valor), 0) || 1;
    return `<div class="barlist">` + itens.map((i) => {
      const p = Math.max(0, (i.valor / soma) * 100);   // quanto este item representa do total
      const clic = i.id ? ` data-acao="explicar-banco" data-id="${i.id}" title="Ver detalhes deste banco"` : "";
      return `<${i.id ? "button" : "div"} class="barlist-linha${i.id ? " clicavel" : ""}"${clic}>
        <span class="barlist-nome">${i.id ? marcaBanco(i.nome, 26) : ""}${esc(i.nome)}</span>
        <span class="barlist-trilho"><i style="width:${p.toFixed(1)}%;background:${i.cor || cor || "var(--azul)"}"></i><b class="barlist-pct">${p.toFixed(1).replace(".", ",")}%</b></span>
        <b class="barlist-valor ${i.valor < 0 ? "down" : ""}">${brlSinal(i.valor)}</b>
      </${i.id ? "button" : "div"}>`;
    }).join("") + `</div>`;
  }

  // tabela comparativa de despesas por categoria (mês anterior x atual)
  function tabelaCategoriasComparativa(d) {
    const atual = despesasPorCategoriaPagas(d, F.mesAtual());
    const antMap = {};
    despesasPorCategoriaPagas(d, F.mesAnterior()).forEach((c) => { antMap[c.categoria] = c.valor; });
    if (!atual.length) return `<div class="empty">Nenhuma despesa neste mês ainda.</div>`;
    const totalAtual = atual.reduce((s, c) => s + c.valor, 0);
    const totalAnt = Object.keys(antMap).reduce((s, k) => s + antMap[k], 0);
    const max = atual[0].valor || 1;
    const grid = "grid-template-columns:1fr 92px 120px 78px 56px";
    let html = `<div class="hd" style="${grid}"><i>Categoria</i><i class="r">Mês ant.</i><i class="r">Mês atual</i><i class="r">Var.</i><i class="r">Share</i></div>`;
    html += atual.map((c, i) => {
      const ant = antMap[c.categoria] || 0;
      const varPct = ant > 0 ? ((c.valor - ant) / ant) * 100 : (c.valor > 0 ? 100 : 0);
      return `<div class="rw comp" style="${grid}">
        <div class="comp-nome"><span class="legenda-ponto" style="background:${G.PALETA_CATEGORIAS[i % G.PALETA_CATEGORIAS.length]}"></span>${esc(c.categoria)}</div>
        <div class="r big dim">${brl(ant)}</div>
        <div class="r comp-barra"><i style="width:${((c.valor / max) * 100).toFixed(0)}%"></i><b>${brl(c.valor)}</b></div>
        <div class="r big ${varPct > 0 ? "down" : "up"}">${varPct > 0 ? "+" : ""}${varPct.toFixed(1).replace(".", ",")}% ${varPct > 0 ? "↑" : "↓"}</div>
        <div class="r big">${((c.valor / totalAtual) * 100).toFixed(1).replace(".", ",")}%</div>
      </div>`;
    }).join("");
    const varTot = totalAnt > 0 ? ((totalAtual - totalAnt) / totalAnt) * 100 : 0;
    html += `<div class="rw comp total" style="${grid}">
      <div>TOTAL</div><div class="r big">${brl(totalAnt)}</div><div class="r big acc-laranja">${brl(totalAtual)}</div>
      <div class="r big ${varTot > 0 ? "down" : "up"}">${varTot > 0 ? "+" : ""}${varTot.toFixed(1).replace(".", ",")}%</div><div class="r big">100%</div>
    </div>`;
    return html;
  }

  function alertasCards(d, limite) {
    const alertas = gerarAlertas(d).slice(0, limite || 4);
    if (!alertas.length) return `<div class="alerta-card sucesso"><span class="ic"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONE_ALERTA.sucesso}</svg></span><div><b>Tudo em ordem</b><p>Nenhum alerta no momento.</p></div></div>`;
    return alertas.map((a) => `<div class="alerta-card ${a.tipo}">
      <span class="ic"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONE_ALERTA[a.tipo]}</svg></span>
      <div><b>${TITULO_ALERTA[a.tipo]}</b><p>${a.texto}</p></div>
    </div>`).join("");
  }
  const TITULO_ALERTA = { perigo: "Atenção imediata", aviso: "Aviso", sucesso: "Bom sinal", info: "Informação" };

  // situação da meta: concluída, prazo vencido, ou se o "Guardar Mês" dá
  // conta do que falta até o prazo (sem prazo, basta ter um valor por mês)
  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // quanto entrou na meta no mês corrente: soma dos depósitos feitos com "Depositar"
  // (metas sem nenhum depósito registrado usam a diferença do histórico de valores)
  function guardadoNoMes(m) {
    const mes = isoLocal(new Date()).slice(0, 7);
    if (Array.isArray(m.depositos) && m.depositos.length) {
      return m.depositos.filter((x) => String(x.data).slice(0, 7) === mes).reduce((t, x) => t + Number(x.valor || 0), 0);
    }
    const h = new Date();
    return Number(m.atual || 0) - valorMetaEm(m, isoLocal(new Date(h.getFullYear(), h.getMonth(), 0)));
  }
  // situação da meta pela bolinha, comparando o que entrou no mês com o "Guardar Mês":
  // verde = soma do mês igual ou maior (ou meta concluída), amarela = já houve depósito
  // no mês mas ainda falta, vermelha = nenhum depósito no mês
  // metas na ordem do status: vermelho (nada guardado no mês), amarelo
  // (guardou parte) e verde (em dia ou concluída); empate fica na ordem cadastrada
  const ORDEM_STATUS_META = { nada: 0, atencao: 1, ok: 2 };
  const metasPorStatus = (lista) => lista.map((m, i) => ({ m, i, o: ORDEM_STATUS_META[situacaoMeta(m).chave] }))
    .sort((a, b) => a.o - b.o || a.i - b.i).map((x) => x.m);
  // mês em que a meta começou a valer (o "Guardar Mês" é cobrado a partir dele):
  // a data de criação ou, nas metas antigas, o 1º registro do histórico — se
  // ele for o último dia de um mês (valor de antes, gravado no fim do mês
  // anterior), a cobrança começa no mês seguinte
  function mesInicioMeta(m) {
    if (m.criadoEm) return String(m.criadoEm).slice(0, 7);
    const h = Array.isArray(m.historico) && m.historico[0];
    if (!h || !h.data) return null;
    const [a, me, di] = String(h.data).split("-").map(Number);
    return di === new Date(a, me, 0).getDate() ? proximoMes(String(h.data).slice(0, 7)) : String(h.data).slice(0, 7);
  }
  const fimDoMes = (mes) => { const [a, me] = mes.split("-").map(Number); return `${mes}-${String(new Date(a, me, 0).getDate()).padStart(2, "0")}`; };
  // o que ficou faltando dos meses anteriores: o "Guardar Mês" de cada mês
  // desde o início da meta até o mês passado, menos o que entrou nesses meses
  // (um mês com depósito a mais compensa outro com depósito a menos)
  function atrasoMeta(m) {
    const mensal = Number(m.aporteMensal || 0), inicio = mesInicioMeta(m), atual = isoLocal(new Date()).slice(0, 7);
    if (!(mensal > 0) || !inicio || inicio >= atual) return 0;
    let meses = 0;
    for (let x = inicio; x < atual && meses < 600; x = proximoMes(x)) meses++;
    const entrou = valorMetaEm(m, fimDoMes(mesAnterior(atual))) - valorMetaEm(m, fimDoMes(mesAnterior(inicio)));
    return Math.max(0, Math.round((meses * mensal - entrou) * 100) / 100);
  }
  function situacaoMeta(m) {
    const atual = Number(m.atual || 0), objetivo = Number(m.objetivo || 0);
    if (objetivo > 0 && atual >= objetivo) return { chave: "ok", rotulo: "Meta concluída" };
    const mensal = Number(m.aporteMensal || 0), noMes = guardadoNoMes(m);
    // devendo de meses anteriores: vermelho até depositar o atrasado e o do mês
    const atraso = atrasoMeta(m);
    if (atraso > 0) {
      const falta = objetivo > 0 ? objetivo - atual : Infinity;
      const paraFicarEmDia = Math.min(falta, atraso + mensal - noMes);
      if (paraFicarEmDia > 0.005) return { chave: "nada", atrasado: true, deposito: paraFicarEmDia,
        rotulo: `Atrasado ${brl(atraso)} · deposite ${brl(paraFicarEmDia)} para ficar em dia` };
      return { chave: "ok", rotulo: `Em dia · guardou ${brl(noMes)} este mês` };
    }
    if (noMes <= 0) return { chave: "nada", deposito: mensal, rotulo: mensal > 0 ? `Nenhum depósito este mês · guardar ${brl(mensal)}` : "Nenhum depósito este mês" };
    if (!(mensal > 0) || noMes >= mensal - 0.005) return { chave: "ok", rotulo: `Guardou ${brl(noMes)} este mês` };
    return { chave: "atencao", deposito: mensal - noMes, rotulo: `Guardou ${brl(noMes)} · falta ${brl(mensal - noMes)} este mês` };
  }

  const ICONE_GUARDAR_MES = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M12 13.2v5M9.8 15.4h4.4"/></svg>';
  const brlCurto = (v) => brl(v).replace(/,00$/, "");   // sem centavos quando o valor é redondo
  // Histórico do valor guardado em cada meta ({ data, valor }), gravado a cada
  // mudança do "Atual" — é dele que sai a evolução por período do quadro.
  // Metas antigas, sem histórico, começam a ser registradas a partir de agora.
  // valorAnterior: o que havia antes desta mudança. Se a meta ainda não tem histórico,
  // ele é gravado no fim do mês passado, para o valor de agora contar como guardado no mês.
  function registrarHistMeta(m, valorAnterior) {
    const hoje = hojeISO(), valor = Number(m.atual || 0);
    const hist = Array.isArray(m.historico) ? m.historico : (m.historico = []);
    if (!hist.length && valorAnterior !== undefined && Number(valorAnterior) !== valor) {
      const h = new Date(), f = new Date(h.getFullYear(), h.getMonth(), 0);
      hist.push({ data: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`, valor: Number(valorAnterior || 0) });
    }
    const ultimo = hist[hist.length - 1];
    if (ultimo && ultimo.data === hoje && hist.length > 1) ultimo.valor = valor;
    else if (!ultimo || ultimo.valor !== valor) hist.push({ data: hoje, valor });
  }
  // valor guardado na meta numa data (antes do 1º registro, vale o 1º registro)
  function valorMetaEm(m, iso) {
    const hist = Array.isArray(m.historico) ? m.historico : [];
    if (!hist.length) return Number(m.atual || 0);
    let v = hist[0].valor;
    hist.forEach((h) => { if (h.data <= iso) v = h.valor; });
    return Number(v || 0);
  }
  // data de referência do ano escolhido: hoje no ano corrente, 31/12 nos anos passados
  function dataRefAnoMetas() {
    const anoAtual = String(new Date().getFullYear());
    return !anoMetas || anoMetas === anoAtual ? hojeISO() : `${anoMetas}-12-31`;
  }
  // data cujo valor o quadro mostra: Início = 1º registro; 3/6/12m = meses antes da referência do ano
  function dataInicioPeriodoMetas(m) {
    if (periodoMetas === -1) return (Array.isArray(m.historico) && m.historico.length) ? m.historico[0].data : hojeISO();
    const d = new Date(dataRefAnoMetas() + "T12:00:00"); d.setMonth(d.getMonth() - periodoMetas);
    return d.toISOString().slice(0, 10);
  }

  function metasMini(d) {
    if (!d.metas.length) return `<div class="empty" style="padding:14px">Nenhuma meta cadastrada.</div>`;
    // todas as metas; a lista mostra 3 de cada vez (mesma altura do quadro
    // Receitas x despesas) e rola dentro do quadro para ver as outras
    return `<div class="metas-lista${d.metas.length > 3 ? " metas-rolagem" : ""}">` + metasPorStatus(d.metas).map(itemMetaHtml).join("") + `</div>`;
  }

  // uma meta como no quadro Metas do Dashboard (usado também nos quadros da guia Metas)
  // sempreAtual: na guia Metas (sem filtro de período) mostra sempre o valor de hoje
  function itemMetaHtml(m, sempreAtual) {
    {
      // fora de "Atual", os valores e a barra mostram como a meta estava no começo do período escolhido
      const naHoje = sempreAtual === true || (periodoMetas === 0 && dataRefAnoMetas() === hojeISO());
      const valor = naHoje ? Number(m.atual || 0) : valorMetaEm(m, dataInicioPeriodoMetas(m));
      const objetivo = Number(m.objetivo || 0);
      const p = objetivo > 0 ? Math.min(100, (valor / objetivo) * 100) : 0;
      const st = situacaoMeta(m);
      // situação do mês ("Guardou R$ 1.000,00 este mês") no meio, entre o guardado e o que falta
      const diasPrazo = m.prazo ? F.diasEntre(m.prazo) : null;
      const vencida = diasPrazo !== null && diasPrazo < 0 && Number(m.atual || 0) < objetivo;
      const situacao = vencida ? `<span class="down">prazo vencido há ${plural(Math.abs(diasPrazo), "dia")}</span>` : esc(st.rotulo);
      return `<button class="meta-item clicavel st-${st.chave}" style="--meta-cor:${esc(m.cor || "var(--up)")}" data-acao="explicar-meta" data-id="${m.id}" title="Ver detalhes da meta">
        <div class="meta-topo meta-topo-linha"><span class="meta-bolinha st-${st.chave}" title="${st.rotulo}"></span><span class="meta-nome">${nomeMeta(m)}</span><span class="meta-selos"><span class="meta-st meta-falta" title="Guardar por mês: ${Number(m.aporteMensal) > 0 ? brl(m.aporteMensal) : "não definido"}"><span class="meta-falta-ic">💰</span>${Number(m.aporteMensal) > 0 ? brlCurto(m.aporteMensal).replace(/^R\$\s*/, "") : "—"}</span>${m.prazo ? `<span class="meta-st meta-falta" title="Data final da meta"><span class="meta-falta-ic">📅</span>${fmtData(m.prazo)}</span>` : ""}<span class="meta-st meta-falta" title="Objetivo: ${brl(objetivo)}"><span class="meta-falta-ic">🏁</span>${brlCurto(objetivo).replace(/^R\$\s*/, "")}</span></span></div>
        <div class="meta-barra meta-barra-grande"><i style="width:${p}%"></i><b class="meta-pct-dentro">${p.toFixed(0)}%</b></div>
        <div class="meta-rodape meta-rodape-3"><span title="Valor guardado">💵 ${brlCurto(valor)}</span><span class="meta-situacao-meio" title="${esc(st.rotulo)}">${situacao}</span><span class="meta-falta-valor" title="Falta para o objetivo">${objetivo > valor ? `⏳ ${brlCurto(objetivo - valor)}` : "✅ Concluída"}</span></div>
      </button>`;
    }
  }

  // subtítulo do quadro de metas: "N de M no caminho certo"
  function resumoMetas(d) {
    if (!d.metas.length) return "progressos";
    const ok = d.metas.filter((m) => situacaoMeta(m).chave === "ok").length;
    return `${ok} de ${d.metas.length} guardado mês`;
  }

  function stripKpis(itens) {
    return `<div class="strip">` + itens.map((i) => `<${i.chave ? "button" : "div"} class="strip-item${i.chave ? " clicavel" : ""}"${i.chave ? ` data-acao="explicar-strip" data-chave="${i.chave}" title="Ver detalhes"` : ""}>
      <span class="strip-ic" style="color:${i.cor};background:${i.cor}1F"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${i.icone}</svg></span>
      <div><div class="strip-rotulo">${i.rotulo}</div><div class="strip-valor">${i.valor}</div><div class="strip-sub">${i.sub || ""}</div></div>
    </${i.chave ? "button" : "div"}>`).join("") + `</div>`;
  }

  // ticker de cotações (faixa persistente abaixo da topbar)
  function atualizarTicker() {
    const tape = document.getElementById("tickerTape");
    const track = document.getElementById("tickerTrack");
    if (!tape || !track) return;
    const lista = I.listaAcoesComCalculo(DADOS);
    if (!lista.length && !dolar && !cripto) { tape.style.display = "none"; return; }
    const itemDolar = dolar ? `<span class="ticker-item clicavel" data-acao="ir-dolar" title="Ver histórico do dólar"><b>USD/BRL</b><span class="tp">${dolar.valor.toFixed(2).replace(".", ",")}</span><span class="tv ${dolar.variacaoPct >= 0 ? "up" : "down"}">${Math.abs(dolar.variacaoPct || 0).toFixed(2).replace(".", ",")}%</span></span>` : "";
    // BTC e ETH logo depois do dólar; clicando, abrem a tela da moeda
    const itensCripto = Object.keys(CRIPTOS).map((m) => {
      const c = cripto && cripto[m];
      if (!c) return "";
      const v = c.variacaoPct || 0;
      return `<span class="ticker-item clicavel" data-cripto="${m}" title="Ver histórico do ${CRIPTOS[m]}"><b>${m}/BRL</b><span class="tp">${c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span class="tv ${v >= 0 ? "up" : "down"}">${Math.abs(v).toFixed(2).replace(".", ",")}%</span></span>`;
    }).join("");
    const itens = itemDolar + itensCripto + lista.map((a) => {
      const p = a.fontePreco === "auto" && a.variacaoDiaPct != null ? a.variacaoDiaPct : ((a.historicoPrecos || []).length < 2 ? a.rentabilidade : I.variacaoRecente(a).pct);
      return `<span class="ticker-item clicavel" data-acao="ir-acao" data-id="${a.id}" title="Ver ${esc(a.ticker)}"><b>${esc(a.ticker)}</b><span class="tp">${a.precoAtual.toFixed(2).replace(".", ",")}</span><span class="tv ${p >= 0 ? "up" : "down"}">${Math.abs(p).toFixed(2).replace(".", ",")}%</span></span>`;
    }).join("");
    track.innerHTML = itens + itens;
    tape.style.display = "";
    // velocidade constante, ~25% mais lenta que a original (3,1 em/s): ≈ 2,3
    // em/s. A duração acompanha a largura da faixa, para que mais ou menos
    // ativos não acelerem nem freiem a rolagem.
    const fonte = parseFloat(getComputedStyle(track.firstElementChild || track).fontSize) || 12.5;
    const dur = Math.max(10, track.scrollWidth / 2 / (fonte * VEL_TICKER_EM));
    if (Math.abs((parseFloat(track.style.animationDuration) || 0) - dur) > 0.5) track.style.animationDuration = dur.toFixed(1) + "s";
  }
  const VEL_TICKER_EM = 2.3;

  // =========================================================================
  // COTAÇÕES AUTOMÁTICAS (dólar + ações) — opcional, cai no manual se falhar
  // =========================================================================
  // token da brapi.dev já configurado de fábrica; o usuário pode trocar
  // por outro em Configurações (o que ele digitar tem prioridade).
  const TOKEN_BRAPI_PADRAO = "oGucoGNp2Ami56Y5x5UqBQ";
  function configCotacoes() {
    const c = DADOS.config || {};
    return { auto: c.cotacoesAuto !== false, token: (c.brapiToken || "").trim() || TOKEN_BRAPI_PADRAO };
  }

  // Mercado de câmbio (dólar comercial) aberto: dias úteis das 9h às 18h no
  // horário de Brasília. Feriados não são considerados.
  function mercadoDolarAberto(agora) {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(agora || new Date()).reduce((o, x) => { o[x.type] = x.value; return o; }, {});
    const min = (Number(p.hour) % 24) * 60 + Number(p.minute);
    return !["Sat", "Sun"].includes(p.weekday) && min >= 9 * 60 && min < 18 * 60;
  }

  // classe do selo de categoria sem acento: "Ação" → selo-acao (a mesma do
  // selo MOEDA), "FII" → selo-fii, "ETF" → selo-etf
  function classeSelo(categoria) {
    return "selo-" + String(categoria || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  // bolinha da barra de data e hora: verde e pulsando com o mercado aberto
  // (dias úteis, 9h às 18h de Brasília), vermelha com o mercado fechado
  function renderStatusMercado(agora) {
    const dot = document.querySelector("#statusVivo .dot-vivo"), caixa = document.getElementById("statusVivo");
    if (!dot) return;
    const aberto = mercadoDolarAberto(agora);
    dot.classList.toggle("fechado", !aberto);
    if (caixa) caixa.title = aberto ? "Mercado Aberto (dias úteis, das 9 às 18 horas)" : "Mercado Fechado (Abertura nos dias úteis às 9 horas)";
  }

  function renderDolar() {
    const el = document.getElementById("dolarTopbar");
    if (!el) return;
    if (!dolar) { el.style.display = "none"; return; }
    const v = dolar.variacaoPct || 0;
    el.style.display = "";
    el.style.cursor = "pointer";
    el.setAttribute("data-acao", "ir-dolar");
    el.setAttribute("title", "Ver histórico do dólar");
    el.innerHTML = `<small>USD/BRL</small><b>R$ ${dolar.valor.toFixed(2).replace(".", ",")}</b><span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(2).replace(".", ",")}%</span>`;
  }

  // Pílulas do Bitcoin e do Ethereum ao lado do dólar. Clicando, abre a tela
  // da moeda (como a do USD/BRL), com o botão para informar a quantidade que
  // você tem; com quantidade, a pílula mostra também quanto ela vale em reais.
  const CRIPTOS = { BTC: "Bitcoin", ETH: "Ethereum" };
  function qtdCripto(m) {
    const q = ((DADOS.config || {}).cripto || {})[m];
    return q > 0 ? q : 0;
  }
  function fmtQtdCripto(q) {
    return q.toLocaleString("pt-BR", { maximumFractionDigits: 8 });
  }
  function renderCripto() {
    Object.keys(CRIPTOS).forEach((m) => {
      const el = document.getElementById("cripto" + m);
      if (!el) return;
      const c = cripto && cripto[m];
      const q = qtdCripto(m);
      if (!c && !q) { el.style.display = "none"; return; }
      el.style.display = "";
      el.style.cursor = "pointer";
      el.setAttribute("data-cripto", m);
      el.setAttribute("title", q ? `${fmtQtdCripto(q)} ${m} — ver histórico do ${CRIPTOS[m]}` : `Ver histórico do ${CRIPTOS[m]}`);
      const v = c ? c.variacaoPct || 0 : 0;
      const preco = c ? `<b>${brl(c.valor)}</b><span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(2).replace(".", ",")}%</span>` : `<b>—</b>`;
      // com quantidade informada, mostra também quanto ela vale hoje em reais
      const meu = q && precoCriptoAtual(m) ? `<em class="cripto-meu" title="Valor dos seus ${fmtQtdCripto(q)} ${m}">${brl(q * precoCriptoAtual(m))}</em>` : "";
      el.innerHTML = `<small>${m}</small>${preco}${meu}`;
    });
  }
  // guarda o preço do dia de cada cripto nos dados: os totais (patrimônio,
  // composição, relatórios) usam o último preço mesmo sem internet, e a
  // evolução patrimonial ganha o histórico
  function registrarPrecosCripto(r) {
    DADOS.config = DADOS.config || {};
    const precos = DADOS.config.criptoPrecos = DADOS.config.criptoPrecos || {};
    let mudou = false;
    Object.keys(CRIPTOS).forEach((m) => {
      const c = r && r[m];
      if (!c || !(c.valor > 0)) return;
      const hist = precos[m] || [];
      const ult = hist[hist.length - 1];
      if (ult && ult.data === hojeISO() && Math.abs(ult.preco - c.valor) < 0.005) return;
      precos[m] = adicionarPontoPreco(hist, c.valor);
      mudou = true;
    });
    if (mudou) A.salvarDados(DADOS, false, true);   // preço de mercado não conta como alteração sua
  }
  // completa o histórico de preços com a série diária (tela da moeda)
  function completarHistoricoCripto(m, serie) {
    if (!serie || !serie.length) return;
    DADOS.config = DADOS.config || {};
    const precos = DADOS.config.criptoPrecos = DADOS.config.criptoPrecos || {};
    const porData = {};
    (precos[m] || []).forEach((p) => { porData[p.data] = p; });
    let novos = 0;
    serie.forEach((p) => { if (p.data < hojeISO() && !porData[p.data]) { porData[p.data] = { data: p.data, preco: p.preco }; novos++; } });
    if (!novos) return;
    precos[m] = Object.keys(porData).sort().map((dt) => porData[dt]).slice(-400);
    A.salvarDados(DADOS, false, true);
  }
  // preço para mostrar: o ao vivo ou, sem internet, o último guardado
  function precoCriptoAtual(m) {
    const c = cripto && cripto[m];
    return c ? c.valor : I.precoCripto(DADOS, m);
  }

  function abrirModalCripto(m) {
    if (!CRIPTOS[m]) return;
    const c = cripto && cripto[m];
    const q = qtdCripto(m);
    abrirModal(`
      <h3>${CRIPTOS[m]} (${m})</h3>
      ${c ? `<p class="dim" style="margin:0 0 12px">Cotação agora: <b class="creme">${brl(c.valor)}</b></p>` : ""}
      <div class="campo"><label for="f_qtdCripto">Quantos ${m} você tem?</label><input id="f_qtdCripto" type="text" inputmode="decimal" autocomplete="off" value="${q ? fmtQtdCripto(q).replace(/\./g, "") : ""}" placeholder="0,00000000"></div>
      <p class="dim" id="f_valorCripto" style="margin:4px 0 0;font-size:12.5px"></p>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvar">Salvar</button></div>`);
    const inp = document.getElementById("f_qtdCripto");
    const mostrarValor = () => {
      const n = numIn(inp.value);
      document.getElementById("f_valorCripto").textContent = c && n > 0 ? `Vale ${brl(n * c.valor)}` : "";
    };
    inp.addEventListener("input", mostrarValor);
    mostrarValor();
    document.getElementById("btnSalvar").onclick = () => {
      const n = String(inp.value).trim() ? numIn(inp.value) : 0;
      if (!(n >= 0) || !isFinite(n)) { toast("Informe uma quantidade válida."); return; }
      DADOS.config = DADOS.config || {};
      DADOS.config.cripto = { ...(DADOS.config.cripto || {}), [m]: n };
      fecharModal();
      salvarEAtualizar(n > 0 ? `${fmtQtdCripto(n)} ${m} salvo.` : `Quantidade de ${m} zerada.`);
      if (ROTA.secao === "detalhe-cripto") renderRota();
      else renderCripto();
    };
  }

  function atualizarCotacoesAutomaticas(silencioso) {
    if (!C || buscandoCotacoes || typeof fetch !== "function") return Promise.resolve();
    const cfg = configCotacoes();
    if (!cfg.auto) return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.onLine === false) { if (!silencioso) toast("Sem internet — mantendo os últimos preços."); return Promise.resolve(); }
    buscandoCotacoes = true;
    const tickers = DADOS.acoes.map((a) => a.ticker.toUpperCase());

    const pDolar = C.buscarDolar().then((r) => { dolar = r; renderDolar(); atualizarTicker(); }).catch(() => {});
    const pCripto = C.buscarCripto ? C.buscarCripto().then((r) => {
      cripto = r;
      registrarPrecosCripto(r);
      renderCripto();
      atualizarTicker();
      // na tela da moeda, o rodapé (cotação e quanto vale o que você tem) acompanha o preço novo
      const janelaAberta = document.getElementById("scrim") && document.getElementById("scrim").classList.contains("on");
      if (ROTA.secao === "detalhe-cripto" && !janelaAberta) renderRota();
    }).catch(() => {}) : Promise.resolve();
    const pAcoes = tickers.length ? C.buscarCotacoes(tickers, cfg.token).then((res) => {
      const mapa = res.cotacoes || {};
      const erros = res.erros || {};
      let alterados = 0;
      DADOS.acoes.forEach((a) => {
        const q = mapa[a.ticker.toUpperCase()];
        if (!q || !(q.preco > 0)) return;
        // completa o histórico com os fechamentos diários que ainda não estavam gravados
        if (q.historico && q.historico.length) {
          const porData = {};
          (a.historicoPrecos || []).forEach((pt) => { porData[pt.data] = { ...pt }; });
          let novos = 0;
          q.historico.forEach((pt) => {
            if (pt.data >= hojeISO()) return;
            const ex = porData[pt.data];
            if (!ex) { porData[pt.data] = { ...pt }; novos++; }
            // dia já gravado só com o fechamento: completa abertura/máxima/mínima (velas)
            else if (!(ex.abertura > 0) && pt.abertura > 0) { Object.assign(ex, { abertura: pt.abertura, maxima: pt.maxima, minima: pt.minima }); novos++; }
          });
          if (novos) {
            a.historicoPrecos = Object.keys(porData).sort().map((dt) => porData[dt]).slice(-400);
            alterados++;
          }
        }
        if (Math.abs(q.preco - a.precoAtual) > 0.0001 || a.fontePreco !== "auto") {
          a.precoAtual = q.preco;
          a.historicoPrecos = adicionarPontoPreco(a.historicoPrecos, q.preco);
          alterados++;
        }
        a.atualizadoEm = hojeISO();
        a.fontePreco = "auto";
        a.variacaoDiaPct = q.variacaoPct;
        if (!a.empresa && q.nome) a.empresa = q.nome;
      });
      const qtdErros = Object.keys(erros).length;
      if (alterados) {
        A.salvarDados(DADOS, false, true);   // preço de mercado não conta como alteração sua
        if (!silencioso) toast(`Cotações atualizadas (${plural(alterados, "ativo")})${qtdErros ? ` · ${qtdErros} com erro` : ""}.`);
      }
      else if (!silencioso) {
        if (qtdErros) { const k = Object.keys(erros)[0]; toast(`Não consegui buscar ${plural(qtdErros, "ativo")}. Ex.: ${k}: ${erros[k]}`); }
        else toast("Cotações já estavam atualizadas.");
      }
      if (qtdErros) console.warn("Cotações com erro:", erros);
    }).catch((e) => { if (!silencioso) toast("Não consegui buscar as ações: " + e.message); }) : Promise.resolve();

    return Promise.all([pDolar, pCripto, pAcoes]).then(() => { buscandoCotacoes = false; }, () => { buscandoCotacoes = false; });
  }

  function iniciarRelogio() {
    const rel = document.getElementById("relogioTopbar");
    const dataEl = document.getElementById("dataTopbar");
    // virada do mês: refaz a tela para o monitoramento das metas (bolinha e
    // "N de M guardado mês") recomeçar no mês novo, mesmo com o app aberto
    let mesVisto = `${new Date().getFullYear()}-${new Date().getMonth()}`;
    const tick = () => {
      const agora = new Date();
      const mesAgora = `${agora.getFullYear()}-${agora.getMonth()}`;
      const janelaAberta = document.getElementById("scrim") && document.getElementById("scrim").classList.contains("on");
      if (mesAgora !== mesVisto && !janelaAberta) {   // com uma janela aberta, espera ela fechar
        if (mesAgora.slice(0, 4) !== mesVisto.slice(0, 4)) anoMetas = String(agora.getFullYear());
        mesVisto = mesAgora;
        renderRota();
      }
      if (rel) rel.textContent = agora.toLocaleTimeString("pt-BR");
      const termRel = document.getElementById("termRelogio");
      if (termRel) termRel.textContent = agora.toLocaleTimeString("pt-BR");
      renderStatusMercado(agora);
      preencherPopData(agora);
      if (dataEl) dataEl.textContent = agora.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
    };
    tick();
    setInterval(tick, 1000);
  }

  function atualizarSidebarMeta() {
    const el = document.getElementById("sidebarMeta");
    if (!el) return;
    const d = DADOS;
    if (!d.metas.length) {
      el.innerHTML = `<div class="sb-meta-titulo">META PRINCIPAL</div><p class="dim" style="font-size:12px;margin:6px 0 10px">Nenhuma meta ainda.</p><button class="btn pequeno" data-acao="ir" data-secao="metas" style="width:100%;justify-content:center">Criar meta</button>`;
      return;
    }
    const m = d.metas.reduce((a, b) => ((a.atual / (a.objetivo || 1)) <= (b.atual / (b.objetivo || 1)) ? a : b));
    const p = m.objetivo > 0 ? Math.min(100, (m.atual / m.objetivo) * 100) : 0;
    const noPrazo = !m.prazo || F.diasEntre(m.prazo) >= 0;
    el.innerHTML = `<div class="sb-meta-titulo">META PRINCIPAL</div>
      <div class="sb-meta-nome">${nomeMeta(m)}</div>
      <div class="sb-meta-valor">${brl(m.objetivo)}</div>
      <div class="progresso" style="margin:10px 0 8px"><i style="width:${p}%;background:var(--laranja)"></i></div>
      <div class="sb-meta-linha"><span class="dim">Progresso</span><b class="up">${p.toFixed(1).replace(".", ",")}%</b></div>
      <div class="sb-meta-atual">${brl(m.atual)}</div>
      <div class="sb-meta-sub">${m.prazo ? "prazo " + fmtData(m.prazo) : "sem prazo definido"}</div>
      <div class="sb-status"><span class="dot-vivo" style="background:${noPrazo ? "var(--up)" : "var(--down)"}"></span>Status: <b class="${noPrazo ? "up" : "down"}">${noPrazo ? "No prazo" : "Prazo Vencido"}</b></div>`;
  }

  function atualizarRodape() {
    const el = document.getElementById("rodapeAtualizado");
    // texto completo e uma versão curta (celular), para o rodapé caber numa linha
    const agora = new Date();
    const curto = agora.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");
    if (el) el.innerHTML = `<i class="rd-longo">Versão ${VERSAO_APP} · dados atualizados: ${agora.toLocaleString("pt-BR")}</i><i class="rd-curto">v${VERSAO_APP} · ${curto}</i>`;
  }


  // ---------------------------------------------------------------------
  // Painel que explica de onde vem cada percentual do dashboard,
  // mostrando a conta com os seus próprios números
  // ---------------------------------------------------------------------
  let painelKpiAberto = null;
  let origemHistorico = null;   // quadro de onde o histórico da classe foi aberto (para o Voltar)
  let painelReabrir = null;
  function explicarKPI(chave) {
    painelKpiAberto = chave;
    painelReabrir = () => explicarKPI(chave);
    const d = DADOS;
    const p = I.patrimonio(d);
    const mes = F.mesAtual(), mesAnt = F.mesAnterior();
    // receitas e despesas seguem o status: só o que está Pago; o previsto aparece à parte
    const entradas = totalEntradasEfetivas(d, mes), entradasAnt = totalEntradasEfetivas(d, mesAnt);
    const despesas = totalDespesasPagasMes(d, mes), despesasAnt = totalDespesasPagasMes(d, mesAnt);
    const entradasPrev = Math.max(0, totalEntradasTodasMes(d, mes) - entradas), despesasPrev = Math.max(0, totalDespesasTodasMes(d, mes) - despesas);
    const linha = (rot, val, cls) => `<div class="kv"><span class="dim">${rotuloPainel(rot)}</span><b class="${cls || ""}">${val}</b></div>`;

    const paineis = {
      patrimonio: {
        titulo: "Patrimônio total",
        conta: "bancos + investimentos + ações + cripto − dívidas",
        pct: p.bruto > 0 ? (p.liquido / p.bruto) * 100 : 0,
        pctRotulo: "do patrimônio bruto está livre de dívidas",
        // o total soma exatamente as linhas mostradas aqui (investimentos já
        // líquidos de IR), para nunca destoar da própria conta do painel
        linhas: (() => {
          const investLiq = I.totalLiquidoOutros(d);
          const totalLiquido = p.bancos + investLiq + p.acoes + p.cripto - p.dividas;
          // cada classe abre o histórico dela, com data e valores, como no quadro do banco
          const abre = (classe, html) => html.replace('<div class="kv">', `<div class="kv kv-editavel" data-historico-classe="${classe}" title="Ver o histórico">`);
          // valores com sinal, em branco (só o Total leva a cor verde/vermelha)
          const val = (v) => [brlSinal(v), ""];
          const lv = (classe, rot, v) => abre(classe, linha(rot, ...val(v)));
          return lv("bancos", "+ Bancos", p.bancos) + lv("investimentos", "+ Investimentos", investLiq) +
            lv("acoes", "+ Ações e FIIs", p.acoes) + (p.cripto > 0 ? lv("cripto", "+ Criptomoedas", p.cripto) : "") +
            lv("dividas", "− Dívidas", -p.dividas) +
            linha("Saldo", brlSinal(totalLiquido), corSinal(totalLiquido));
        })(),
        secao: "bancos"
      },
      bancos: {
        titulo: "Saldo bancário",
        conta: "saldo = saldo inicial + entradas − despesas",
        pct: p.bruto > 0 ? (p.bancos / p.bruto) * 100 : 0,
        pctRotulo: "do patrimônio bruto está em conta",
        linhas: bancosNaOrdem(F.listaBancosComSaldo(d)).map((b) => linhaBancoClicavel(b.id, linha(esc(b.nome), brlSinal(b.saldoAtual)))).join("") +
          linha("Total", brlSinal(p.bancos), corSinal(p.bancos)),
        secao: "bancos"
      },
      investido: {
        titulo: "Investimentos",
        conta: "(investimentos + ações + cripto) ÷ patrimônio bruto",
        pct: I.percentualInvestido(d),
        pctRotulo: "do patrimônio bruto está investido",
        linhas: (() => {
          const investLiq = I.totalLiquidoOutros(d);
          // cada classe abre o histórico dela, como as linhas do Patrimônio total
          const abre = (classe, html) => html.replace('<div class="kv">', `<div class="kv kv-editavel" data-historico-classe="${classe}" title="Ver o histórico">`);
          return linha("Rentabilidade carteira", pct(I.rentabilidadeCarteiraAcoes(d)), corSinal(I.rentabilidadeCarteiraAcoes(d))) +
            abre("investimentos", linha("Renda fixa, Tesouro e Fundos", brlSinal(investLiq))) +
            abre("acoes", linha("Ações, FIIs e ETFs", brlSinal(p.acoes))) +
            (p.cripto > 0 ? abre("cripto", linha("Criptomoedas (BTC, ETH)", brlSinal(p.cripto))) : "") +
            linha("Total", brlSinal(investLiq + p.acoes + p.cripto), corSinal(investLiq + p.acoes + p.cripto));
        })(),
        secao: "investimentos"
      },
      receitas: {
        titulo: "Receitas do mês",
        conta: "soma das entradas pagas no mês atual (as previstas aparecem à parte)",
        pct: F.variacaoPercentual(entradas, entradasAnt),
        pctRotulo: "de variação em relação ao mês anterior",
        linhas: (() => {
          const itensR = listaEntradasTodasMes(d, mes);
          return cabecalhoColunasPainel() +
            itensR.map((e) => linhaEditavel(e, linha(descPainel(e), `<span class="col-rep">${repColuna(e, e.data)}</span>` + seloStatusPainel(e.status, e) + bancoPainel(e.banco, e) + `<span class="col-valor valor-guia up">+${brl(e.valor)}</span>`))).join("") +
            linhaTotalPainel(plural(itensR.filter((e) => e.status === "Pago").length, "Lançamento pago", "Lançamentos pagos"), `+${brl(entradas)}`);
        })(),
        secao: "entradas"
      },
      despesas: {
        titulo: "Despesas do mês",
        conta: "soma das despesas pagas no mês atual (as previstas aparecem à parte)",
        pct: entradas > 0 ? (despesas / entradas) * 100 : 0,
        pctRotulo: "das receitas do mês já foram gastas",
        linhas: (() => {
          const itensD = listaDespesasTodasMes(d, mes);
          return cabecalhoColunasPainel() +
            itensD.map((x) => linhaEditavel(x, linha(descPainel(x), `<span class="col-rep">${repColuna(x, x.data)}</span>` + seloStatusPainel(x.status, x) + bancoPainel(x.banco, x) + `<span class="col-valor valor-guia down">−${brl(x.valor)}</span>`))).join("") +
            linhaTotalPainel(plural(itensD.filter((x) => x.status === "Pago").length, "Lançamento pago", "Lançamentos pagos"), `−${brl(despesas)}`);
        })(),
        secao: "despesas"
      }
    };

    const x = paineis[chave];
    if (!x) return;
    abrirModal(`
      <h3>${x.titulo}</h3>
      <div class="explica-pct"><b>${Math.abs(x.pct).toFixed(1).replace(".", ",")}%</b><span>${x.pctRotulo}</span></div>
      <p class="campo ajuda" style="margin:0 0 12px">Como é calculado: <b>${x.conta}</b></p>
      <div class="explica-lista">${x.linhas}</div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnIrPainel">${x.botao ? esc(x.botao.rotulo) : "Abrir"}</button>
        <button class="btn" id="btnFecharPainel">Fechar</button>
      </div>`);
    document.getElementById("btnIrPainel").onclick = () => {
      if (x.botao) { x.botao.acao(); return; }   // abre o formulário novo por cima do painel
      fecharModal(); navegarPara(x.secao);
    };
    document.getElementById("btnFecharPainel").onclick = fecharModal;
  }



  // Nos painéis interativos, o rótulo de cada linha da tabela mostra a
  // segunda palavra com a inicial em maiúscula (ex.: "Valor Aplicado").
  // "1 entrada" / "3 entradas" — escolhe singular ou plural pela quantidade
  function plural(qtd, singular, pluralTexto) {
    const n = Number(qtd) || 0;
    return `${n} ${n === 1 ? singular : (pluralTexto || singular + "s")}`;
  }

  function rotuloPainel(texto) {
    if (String(texto).indexOf("<") !== -1) return texto;
    let palavras = 0;
    return String(texto).split(" ").map((p) => {
      if (!/^[\p{L}]/u.test(p)) return p;            // símbolos (+, −, parênteses) não contam
      if (/^[\p{L}]$/u.test(p)) return p;            // conectivos de uma letra ("e") ficam em minúsculo
      palavras++;
      return palavras === 2 ? p.charAt(0).toUpperCase() + p.slice(1) : p;
    }).join(" ");
  }



  function painelSimples(titulo, pctValor, pctRotulo, comoCalcula, linhasHtml, secao, botao, extraHtml) {
    abrirModal(`
      <h3>${titulo}</h3>
      <div class="explica-pct"><b>${Math.abs(pctValor).toFixed(1).replace(".", ",")}%</b><span>${pctRotulo}</span></div>
      ${comoCalcula ? `<p class="campo ajuda" style="margin:0 0 12px">Como é calculado: <b>${comoCalcula}</b></p>` : ""}
      <div class="explica-lista">${linhasHtml}</div>
      ${extraHtml || ""}
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnIrPainel">${botao ? esc(botao.rotulo) : "Abrir"}</button>
        <button class="btn" id="btnFecharPainel">Fechar</button>
      </div>`);
    document.getElementById("btnIrPainel").onclick = () => {
      fecharModal();
      if (botao && typeof botao.acao === "function") botao.acao();
      else navegarPara(secao);
    };
    document.getElementById("btnFecharPainel").onclick = fecharModal;
    // o extrato abre já no fim, onde está o saldo atual
    const ext = document.querySelector(".extrato-banco");
    if (ext) ext.scrollTop = ext.scrollHeight;
  }

  // Histórico da conta: os lançamentos do período escolhido, cada um com o
  // saldo da conta depois dele, e o resumo do período (entradas, saídas e
  // resultado) no fim da tabela.
  // período do histórico da conta (De / Até) — sempre abre no mês atual,
  // do primeiro ao último dia
  function faixaMesAtual() {
    const hj = hojeISO();
    const ultimo = new Date(Number(hj.slice(0, 4)), Number(hj.slice(5, 7)), 0).getDate();
    return { ini: hj.slice(0, 8) + "01", fim: hj.slice(0, 8) + String(ultimo).padStart(2, "0") };
  }
  function faixaExtratoPadrao() {
    return faixaMesAtual();
  }

  const fmtDataISO = (iso) => { const p = String(iso || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ""; };
  function extratoBancoHtml(d, b, faixa) {
    const fx = faixa || faixaExtratoPadrao(d, b);
    // a data aparece como 10/07/2026 num texto por cima do campo (o iPad escreveria
    // "10 de jul. de 2026" em duas linhas); tocar abre o calendário do aparelho
    const campo = (id, v) => `<span class="campo-data-curta"><span class="data-txt" id="${id}Txt">${fmtDataISO(v)}</span><input type="date" id="${id}" value="${v}" aria-label="${id === "extratoIni" ? "Data inicial" : "Data final"}"></span>`;
    return `
      <div class="extrato-titulo"><span>Histórico da conta</span><span class="dim" id="extratoQtd"></span></div>
      <div class="extrato-periodo" data-banco="${b.id}">
        <button type="button" class="btn pequeno extrato-seta" data-extrato-passo="-1" title="Mês anterior" aria-label="Mês anterior">‹</button>
        <label>${campo("extratoIni", fx.ini)}</label>
        <label>Até ${campo("extratoFim", fx.fim)}</label>
        <button type="button" class="btn pequeno extrato-seta" data-extrato-passo="1" title="Próximo mês" aria-label="Próximo mês">›</button>
        <span class="extrato-atalhos">
          <span class="abas abas-periodo extrato-abas">
            <button type="button" data-extrato-meses="3">3m</button>
            <button type="button" data-extrato-meses="6">6m</button>
            <button type="button" data-extrato-meses="12">12m</button>
            <button type="button" data-extrato-meses="0">Tudo</button>
          </span>
        </span>
      </div>
      <div id="extratoConteudo">${extratoBancoCorpo(d, b, fx)}</div>`;
  }

  // "outubro de 2026" quando o período é um mês só; "set/2026 a out/2026" quando são vários
  const NOMES_MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function rotuloPeriodoMeses(ini, fim) {
    const a = String(ini || "").slice(0, 7), z = String(fim || "").slice(0, 7);
    if (!a || !z) return "no período";
    const mesAno = (m) => `${NOMES_MES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;
    return a === z ? `${NOMES_MES_LONGO[Number(a.slice(5, 7)) - 1]} de ${a.slice(0, 4)}` : `${mesAno(a)} a ${mesAno(z)}`;
  }

  // liga os campos De/Até e os atalhos do histórico aberto no painel
  function ligarPeriodoExtrato(b) {
    const caixa = document.querySelector("#modal .extrato-periodo");
    if (!caixa) return;
    const ini = document.getElementById("extratoIni"), fim = document.getElementById("extratoFim");
    const atualizar = () => {
      let a = ini.value, z = fim.value;
      if (!a || !z) return;
      if (a > z) { [a, z] = [z, a]; ini.value = a; fim.value = z; }
      document.getElementById("extratoIniTxt").textContent = fmtDataISO(a);
      document.getElementById("extratoFimTxt").textContent = fmtDataISO(z);
      document.getElementById("extratoConteudo").innerHTML = extratoBancoCorpo(DADOS, b, { ini: a, fim: z });
      contarExtrato();
      const ext = document.querySelector("#modal .extrato-banco");
      if (ext) ext.scrollTop = ext.scrollHeight;
    };
    // quantos lançamentos no período, na linha do título
    const contarExtrato = () => {
      const c = document.querySelector("#extratoConteudo [data-qtd]"), q = document.getElementById("extratoQtd");
      if (c && q) q.textContent = plural(Number(c.dataset.qtd), "lançamento") + " · " + rotuloPeriodoMeses(ini.value, fim.value);
    };
    contarExtrato();
    // data digitada à mão: nenhum atalho fica marcado
    const limparAtalho = () => caixa.querySelectorAll("[data-extrato-meses]").forEach((x) => x.classList.remove("ativo"));
    [ini, fim].forEach((el) => {
      el.addEventListener("change", () => { limparAtalho(); atualizar(); });
      el.addEventListener("input", () => { limparAtalho(); atualizar(); });
      // no computador, clicar em qualquer parte do campo abre o calendário
      el.addEventListener("click", () => { try { if (el.showPicker) el.showPicker(); } catch (e) { /* sem suporte */ } });
    });
    // setas: vão para o mês anterior / seguinte ao mês da data inicial, do dia 1 ao último dia
    caixa.querySelectorAll("[data-extrato-passo]").forEach((bt) => {
      bt.onclick = (e) => {
        e.stopPropagation();
        const base = (ini.value || hojeISO()).slice(0, 7).split("-").map(Number);
        const alvo = new Date(base[0], base[1] - 1 + Number(bt.dataset.extratoPasso), 1);
        const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
        const mes = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}`;
        ini.value = `${mes}-01`;
        fim.value = `${mes}-${String(ultimo).padStart(2, "0")}`;
        caixa.querySelectorAll("[data-extrato-meses]").forEach((x) => x.classList.remove("ativo"));   // mês avulso: nenhuma aba marcada
        atualizar();
      };
    });
    caixa.querySelectorAll("[data-extrato-meses]").forEach((bt) => {
      bt.onclick = (e) => {
        e.stopPropagation();
        caixa.querySelectorAll("[data-extrato-meses]").forEach((x) => x.classList.toggle("ativo", x === bt));
        const m = Number(bt.dataset.extratoMeses);
        const hj = hojeISO();
        if (!m) {   // Tudo: do primeiro lançamento até hoje
          const it = F.extratoDoBanco(DADOS, b.id).itens.filter((i) => i.data);
          ini.value = it.length ? String(it[0].data).slice(0, 10) : hj.slice(0, 8) + "01";
        } else {    // mês atual, ou os últimos 3/12 meses contando o atual
          const dt = new Date(Number(hj.slice(0, 4)), Number(hj.slice(5, 7)) - 1 - (m - 1), 1);
          ini.value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
        }
        fim.value = m === 1 ? faixaMesAtual().fim : hj;   // Mês: do dia 1 ao último dia do mês
        atualizar();
      };
    });
  }

  // célula do resumo do período: rótulo e valor na mesma linha; no celular o
  // rótulo fica curto (Ent., Saí., Res.) e o "R$" some, para caber numa linha
  function celResumo(rotulo, curto, valor, sinal, classe) {
    return `<span><small><i class="rot-longo">${rotulo}</i><i class="rot-curto">${curto}</i></small><b class="${classe}">${sinal}<i class="rs">R$ </i>${brl(valor).replace(/^R\$\s*/, "")}</b></span>`;
  }

  // entradas e despesas PREVISTAS do banco num período (ainda não mexeram no
  // saldo): entradas marcadas como previstas, contas a pagar pendentes e as
  // repetições do mês que ainda não foram marcadas como pagas
  function previstasDoBanco(d, bancoId, ini, fim) {
    const itens = [];
    const dentro = (dt) => dt && String(dt) >= ini && String(dt) <= fim;
    const add = (x, data, valor, tipo, secao, id) => itens.push({ data, descricao: x.descricao || x.categoria || (tipo === "entrada" ? "Entrada" : "Despesa"),
      valor, tipo, previsto: true, emoji: x.emoji, categoria: x.categoria, ref: { secao, id, data } });
    d.entradas.filter((e) => e.previsto && e.bancoId === bancoId && dentro(e.data))
      .forEach((e) => add(e, e.data, Number(e.valor || 0), "entrada", "entradas", e.id));
    (d.contasPagar || []).filter((c) => c.status !== "Pago" && c.bancoId === bancoId && !c.cartaoId && dentro(c.vencimento))
      .forEach((c) => add(c, c.vencimento, -Number(c.valor || 0), "despesa", "despesas", c.id));
    // repetições ainda não pagas, mês a mês dentro do período
    const meses = [];
    for (let m = String(ini).slice(0, 7); m <= String(fim).slice(0, 7) && meses.length < 240; m = proximoMes(m)) meses.push(m);
    const doBanco = (reg, m) => bancoDoMes(reg, m) === bancoId && !reg.cartaoId && !mesQuitado(reg, m);
    meses.forEach((mes) => {
      repeticoesPrevistas(d.entradas, mes, (reg, data) => { if (dentro(data) && doBanco(reg, mes)) add(reg, data, valorDoMes(reg, mes), "entrada", "entradas", reg.id); return null; });
      const contasDoMes = (d.contasPagar || []).filter((c) => String(c.vencimento || "").slice(0, 7) === mes)
        .map((c) => ({ descricao: c.descricao, categoria: c.categoria, valor: c.valor, data: c.vencimento, origemRecorrente: c.origemRecorrente }));
      repeticoesPrevistas(d.despesas, mes, (reg, data) => { if (dentro(data) && doBanco(reg, mes)) add(reg, data, -valorDoMes(reg, mes), "despesa", "despesas", reg.id); return null; }, contasDoMes);
      repeticoesPrevistas((d.contasPagar || []).map((c) => ({ ...c, data: c.vencimento })), mes,
        (reg, data) => { if (dentro(data) && doBanco(reg, mes)) add(reg, data, -valorDoMes(reg, mes), "despesa", "despesas", reg.id); return null; }, []);
    });
    // transferências automáticas de meses em que a entrada ainda não caiu
    movimentosTransfAuto(d, false, String(fim).slice(0, 7)).filter((m) => m.bancoId === bancoId && dentro(m.data))
      .forEach((m) => itens.push({ ...m, tipo: "transferencia", previsto: true, emoji: "🔁" }));
    return itens;
  }

  function extratoBancoCorpo(d, b, fx) {
    const ext = F.extratoDoBanco(d, b.id);
    // status do lançamento, com o mesmo selo das guias Entradas e Despesas
    // (transferência já feita também conta como Pago)
    const seloStatus = (tipo, previsto) => previsto ? `<span class="selo-tag selo-prevista">Prevista</span>` : `<span class="selo-tag selo-pago">Pago</span>`;
    const linha = (data, desc, valor, saldo, classe, ref, tipo, previsto, auto, transfId, ajusteId) => `
      <div class="extrato-linha ${classe || ""}${previsto ? " linha-prevista" : ""}${ref || auto || transfId || ajusteId ? " clicavel" : ""}"${auto ? ` data-transf-auto="${esc(auto.id)}" data-mes="${auto.mes}" title="Mudar o valor deste mês"` : ""}${transfId ? ` data-transf-id="${esc(String(transfId))}" title="Editar a transferência"` : ""}${ajusteId ? ` data-ajuste-id="${esc(String(ajusteId))}" title="Ver o ajuste de saldo"` : ""}${ref ? ` data-ir-secao="${ref.secao}" data-ir-id="${esc(String(ref.id))}" data-ir-data="${esc(String(ref.data || ""))}" title="Ver na guia ${ref.secao === "entradas" ? "Entradas" : "Despesas"}"` : ""}>
        <span class="dim">${data}</span>
        <span class="desc">${desc}</span>
        <span class="rep">${auto ? `<span class="selo-tag selo-cat" title="Transferência automática">Automática</span>` : ajusteId && !ref ? SELO_UNICA : celRep(repDe(ref))}</span>
        <span class="status">${tipo ? seloStatus(tipo, previsto) : ""}${repDe(ref) ? `<span class="rep-movel">${repDe(ref)}</span>` : ""}</span>
        <b class="${valor === null ? "vazio" : corSinal(valor)}">${valor === null ? "" : brlSinal(valor)}</b>
        <b class="saldo${saldo < 0 ? " down" : ""}">${saldo === null ? '<span class="dim">—</span>' : brl(Math.abs(saldo))}</b>
      </div>`;
    // coluna Recorrência: o mesmo selo das guias (mensal, Parcela 05/16…) ou "—"
    const todos = [...d.entradas, ...d.despesas, ...(d.contasPagar || [])];
    const repDe = (ref) => {
      const orig = ref && ref.id ? todos.find((r) => r.id === ref.id) : null;
      return orig ? seloFreq({ ...orig, data: ref.data || dataReg(orig) }, true).trim() || SELO_UNICA : "";
    };
    // o emoji do lançamento (o escolhido ou o da categoria) na frente da descrição
    // embaixo da descrição, "Categoria · Tipo" como nas guias Entradas e Despesas
    // transferência: "Para · Banco" (ou "De · Banco") embaixo, como o "Categoria · Tipo" dos lançamentos
    const subItem = (i) => i.tipo === "transferencia" ? (i.sub ? `<span class="desc-sub sem-quebra">${esc(i.sub)}</span>` : "")
      : i.ref ? `<span class="desc-sub">${subDe({ id: i.ref.id, categoria: i.categoria })}</span>` : "";
    const doItem = (i) => linha(fmtDataCurta(i.data), descEmoji(i) + subItem(i), i.valor, i.saldo, "", i.ref, i.tipo, i.previsto, i.auto, i.transfId, i.ajusteId);
    let corpo;
    {
      const pagos = ext.itens.filter((i) => String(i.data) >= fx.ini && String(i.data) <= fx.fim);
      const previstas = previstasDoBanco(d, b.id, fx.ini, fx.fim);
      let dentro = pagos;
      if (previstas.length) {
        // previstas aparecem na lista, mas seguem o status: não mexem no saldo nem nos
        // totais até serem marcadas como pagas (a linha prevista mostra "—" no Saldo)
        const antes = ext.itens.filter((i) => String(i.data) < fx.ini);
        let saldo = antes.length ? antes[antes.length - 1].saldo : ext.saldoInicial;
        dentro = [...pagos, ...previstas]
          .sort((a, b2) => String(a.data).localeCompare(String(b2.data)) ||
            ((a.valor >= 0 && b2.valor >= 0) ? F.ordemNoDia(a) - F.ordemNoDia(b2) : 0) || (b2.valor - a.valor))
          .map((i) => { if (i.previsto) return { ...i, saldo: null }; saldo = Math.round((saldo + i.valor) * 100) / 100; return { ...i, saldo }; });
      }
      // Entradas, Saídas e Saldo do rodapé: só o que está Pago
      const efetivos = dentro.filter((i) => !i.previsto);
      const entradas = efetivos.filter((i) => i.valor > 0).reduce((t, i) => t + i.valor, 0);
      const saidas = efetivos.filter((i) => i.valor < 0).reduce((t, i) => t - i.valor, 0);
      // só os lançamentos do período: sem linha de saldo inicial nem de saldo final
      corpo = (dentro.length ? dentro.map(doItem).join("") : `<div class="extrato-linha"><span></span><span class="desc dim">Nenhum lançamento no período</span><span></span><span></span><span></span><span></span></div>`);
      return `
      <div class="extrato-tabela extrato-com-rep">
        <div class="extrato-cab"><span>Data</span><span>Descrição</span><span class="rep">Recorrência</span><span class="status">Status</span><span>Valor</span><span>Saldo</span></div>
        <div class="explica-lista extrato-banco">${corpo}</div>
        <div class="extrato-resumo" data-qtd="${dentro.length}">
          ${celResumo("Entradas", "Ent.", entradas, "+", "up fluxo")}
          ${celResumo("Despesas", "Desp.", saidas, "−", "down fluxo")}
          ${celResumo("Saldo", "Sal.", Math.abs(Math.round((entradas - saidas) * 100) / 100), entradas - saidas > 0 ? "+" : entradas - saidas < 0 ? "−" : "", corSinal(entradas - saidas))}
        </div>
      </div>`;
    }
  }

  // quadro do banco: só o histórico da conta, com o período De/Até e os atalhos
  // numa linha, e os botões Depositar / Editar / Fechar
  function explicarBanco(id) {
    const d = DADOS;
    const b = bancosDoPeriodo(d).find((x) => x.id === id);
    if (!b) return;
    painelReabrir = null;
    abrirModal(`
      <h3 class="extrato-cab-banco"><span>${esc(b.nome)}</span><b class="${corSinal(b.saldoAtual)}">${brlSinal(b.saldoAtual)}</b></h3>
      ${extratoBancoHtml(d, b)}
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnIrPainel">Depositar</button>
        <button class="btn" id="btnSaldoReal" title="Alterar o saldo do banco">Alterar</button>
        <button class="btn btn-com-icone" id="btnEditarBanco" title="Editar os dados do banco">${ICONE_EDITAR}Editar</button>
        <button class="btn" id="btnFecharPainel">Fechar</button>
      </div>`);
    document.getElementById("modal").classList.add("modal-extrato");
    document.getElementById("btnIrPainel").onclick = () => { fecharModal(); abrirModalValorBanco(b.id); };
    document.getElementById("btnEditarBanco").onclick = () => { fecharModal(); abrirModalBanco(b.id); };
    document.getElementById("btnSaldoReal").onclick = () => { fecharModal(); informarSaldoBanco(b.id, { depois: () => explicarBanco(b.id) }); };
    document.getElementById("btnFecharPainel").onclick = fecharModal;
    ligarPeriodoExtrato(b);
    const ext = document.querySelector("#modal .extrato-banco");
    if (ext) ext.scrollTop = ext.scrollHeight;   // abre no fim, onde está o saldo atual
    // o foco automático no primeiro campo abriria o calendário no iPad
    if (document.activeElement && document.activeElement.blur) setTimeout(() => document.activeElement.blur(), 40);
  }

  // Patrimônio total → cada classe (bancos, investimentos, ações, cripto,
  // dívidas) abre uma tabela no mesmo formato do histórico do banco: data,
  // descrição, status, valor e o total acumulado depois de cada linha
  function itensDividas(d) {
    const itens = [];
    let pagas = 0;   // parcelas das séries que já foram pagas
    const hoje = hojeISO();
    const selo = (dt) => String(dt) < hoje ? `<span class="selo-tag selo-atrasado">Vencida</span>` : `<span class="selo-tag selo-pendente">Pendente</span>`;
    // banco de cada dívida: o do mês (se foi trocado), o da conta ou o do cartão
    const bancoDe = (x, data) => { const nome = bancoDoLancamento(d, { ...x, bancoId: bancoDoMes(x, String(data).slice(0, 7)) }); return nome && nome !== "—" ? nome : ""; };
    const add = (x, data, valor, status, tipo) => itens.push({ data, desc: descEmoji(x, x.categoria || "Conta"), status, valor: -Number(valor || 0),
      ref: { secao: "despesas", id: x.id, data }, tipo: tipo || "conta", banco: bancoDe(x, data) });
    // contas em aberto vencidas ou do mês atual (as mesmas de F.totalDividas)
    (d.contasPagar || []).filter((c) => c.status !== "Pago" && !(ehPers(c) && Number(regraDe(c).parcelas) > 0) && String(c.vencimento || "").slice(0, 7) <= F.mesAtual())
      .forEach((c) => add(c, c.vencimento, c.valor, selo(c.vencimento)));
    // parcelas que ainda faltam pagar (as mesmas de saldoDevedorParcelas)
    const todos = [...d.despesas, ...(d.contasPagar || [])];
    const pago = (x) => d.despesas.includes(x) || x.status === "Pago";
    const dia = (o) => String(dataReg(o)).slice(8, 10) || "01";
    todos.filter((o) => ehPers(o) && !o.origemRecorrente && Number(regraDe(o).parcelas) > 0).forEach((orig) => {
      const regra = regraDe(orig), n = Number(regra.parcelas);
      let mes = regra.primeiraParcela || mesReg(orig);
      for (let k = 0; k < n; k++) {
        if (k) for (let i = 0; i < Math.max(1, Number(regra.intervalo) || 1); i++) mes = proximoMes(mes);
        const parc = `<span class="selo-tag selo-cat">Parcela ${dd(k + 1)}/${dd(n)}</span>`;
        if (mes === mesReg(orig)) { if (!pago(orig)) add(orig, dataReg(orig), orig.valor, parc, "parcela"); else pagas += Number(orig.valor || 0); continue; }
        if (!ocorrenciasNoMes(orig, mes).length) continue;
        const inst = todos.find((x) => x.origemRecorrente === orig.id && mesReg(x) === mes);
        if (inst) { if (!pago(inst)) add(inst, dataReg(inst), inst.valor, parc, "parcela"); else pagas += Number(inst.valor || 0); }
        else if (!mesQuitado(orig, mes)) add(orig, `${mes}-${dia(orig)}`, valorDoMes(orig, mes), parc, "parcela");
        else pagas += valorDoMes(orig, mes);
      }
    });
    itens.pagas = Math.round(pagas * 100) / 100;
    return itens;
  }

  function historicoClasse(d, classe) {
    const selo = (txt, cls) => `<span class="selo-tag ${cls || "selo-cat"}">${esc(txt)}</span>`;
    const soma = (lista, f) => lista.reduce((t, i) => t + Number(f(i) || 0), 0);
    const r2 = (v) => Math.round(v * 100) / 100;
    let itens = [], inicial = 0, resumo = [], titulo = "";
    if (classe === "bancos") {
      titulo = "Bancos";
      bancosNaOrdem(F.listaBancosComSaldo(d)).forEach((b) => {
        const ext = F.extratoDoBanco(d, b.id);
        inicial += Number(ext.saldoInicial || 0);
        // recorrência (mensal, Parcela 05/16…) e "Categoria · Tipo" embaixo da descrição, como nas guias
        const todosReg = [...d.entradas, ...d.despesas, ...(d.contasPagar || [])];
        const repDe = (ref) => { const o = ref && ref.id ? todosReg.find((r) => r.id === ref.id) : null; return o ? seloFreq({ ...o, data: ref.data || dataReg(o) }, true).trim() || SELO_UNICA : ""; };
        ext.itens.forEach((i) => itens.push({ data: i.data, valor: i.valor, ref: i.ref, rep: i.ajusteId ? (i.ref ? repDe(i.ref) : SELO_UNICA) : i.tipo === "transferencia" ? "" : repDe(i.ref),
          desc: descEmoji(i) + (i.tipo === "transferencia" ? (i.sub ? `<span class="desc-sub sem-quebra">${esc(i.sub)}</span>` : "")
            : i.ref ? `<span class="desc-sub">${subDe({ id: i.ref.id, categoria: i.categoria })}</span>` : ""), banco: b.nome,
          status: selo("Pago", "selo-pago") }));
      });
      const ent = soma(itens.filter((i) => i.valor > 0), (i) => i.valor), sai = soma(itens.filter((i) => i.valor < 0), (i) => -i.valor);
      resumo = [["Entradas", "Ent.", ent, "+", "up fluxo"], ["Despesas", "Desp.", sai, "−", "down fluxo"], ["Saldo", "Sal.", inicial + ent - sai]];
    } else if (classe === "investimentos") {
      titulo = "Investimentos";
      itens = d.investimentos.map((i) => ({ data: i.dataAplicacao || "", valor: I.valorLiquidoInvestimento(i),
        desc: `<span class="emoji-desc">${emojiInvestimento(i)}</span>${esc(nomeCurtoInvestimento(i.nome))}${i.banco || i.emissor ? `<span class="desc-sub">${esc(i.banco || i.emissor)}</span>` : ""}`,
        status: selo(i.categoria || "Outros") }));
      const aplicado = soma(d.investimentos, (i) => i.valorInvestido), total = soma(itens, (i) => i.valor);
      resumo = [["Aplicado", "Apl.", aplicado], ["Rendimento", "Rend.", total - aplicado], ["Total", "Tot.", total]];
    } else if (classe === "acoes") {
      titulo = "Ações e FIIs";
      const lista = I.listaAcoesComCalculo(d);
      itens = lista.map((a) => ({ data: ((a.historicoPrecos || [])[0] || {}).data || a.atualizadoEm || "", valor: a.valorAtual,
        desc: `<span class="emoji-desc">${emojiClasse(a.categoria === "FII" ? "FIIs" : a.categoria === "ETF" ? "ETFs" : "Ações")}</span>${esc(a.ticker)} <span class="dim">· ${a.quantidade} un.</span>`,
        status: selo(a.categoria || "Ação", a.categoria === "FII" ? "selo-fii" : a.categoria === "ETF" ? "selo-etf" : "selo-acao") }));
      const investido = soma(lista, (a) => a.valorInvestido), total = soma(lista, (a) => a.valorAtual);
      resumo = [["Investido", "Inv.", investido], ["Resultado", "Res.", total - investido], ["Total", "Tot.", total]];
    } else if (classe === "cripto") {
      titulo = "Criptomoedas";
      const lista = I.listaCripto(d);
      const precos = (d.config || {}).criptoPrecos || {};
      const dataPreco = (m) => (precos[m] || []).reduce((z, p) => (p.data > z ? p.data : z), "") || hojeISO();
      itens = lista.map((c) => ({ data: dataPreco(c.moeda), valor: c.valor,
        desc: `<span class="emoji-desc">🪙</span>${esc(c.moeda)} <span class="dim">· ${fmtQtdCripto(c.quantidade)}</span>`, status: selo(c.moeda) }));
      const v = (m) => soma(lista.filter((c) => c.moeda === m), (c) => c.valor);
      resumo = [["BTC", "BTC", v("BTC")], ["ETH", "ETH", v("ETH")], ["Total", "Tot.", soma(lista, (c) => c.valor)]];
    } else if (classe === "dividas") {
      titulo = "Dívidas";
      itens = itensDividas(d);
      // Pagas: parcelas já quitadas · Pendentes: tudo o que ainda falta pagar (a lista) · Total: a soma das duas
      const pagas = itens.pagas || 0, pendentes = soma(itens, (i) => -i.valor);
      resumo = [["Pagas", "Pag.", pagas, pagas > 0 ? "+" : "", "up fluxo"], ["Pendentes", "Pend.", -pendentes, undefined, "down fluxo"], ["Total", "Tot.", -(pagas + pendentes)]];
    }
    // ordem de data, com o total acumulado depois de cada linha
    let saldo = inicial;
    itens = itens.sort((a, b) => String(a.data).localeCompare(String(b.data)))
      .map((i) => { saldo = r2(saldo + i.valor); return { ...i, saldo }; });
    // em Bancos e Dívidas, a coluna Banco mostra de qual conta é cada lançamento;
    // a coluna Recorrência só em Bancos (em Dívidas o Status já mostra a parcela)
    const comBanco = classe === "bancos" || classe === "dividas", comRep = classe === "bancos";
    const linha = (i) => `
      <div class="extrato-linha${i.ref ? " clicavel" : ""}"${i.ref ? ` data-ir-secao="${i.ref.secao}" data-ir-id="${esc(String(i.ref.id))}" data-ir-data="${esc(String(i.ref.data || ""))}" title="Ver na guia ${i.ref.secao === "entradas" ? "Entradas" : "Despesas"}"` : ""}>
        <span class="dim">${i.data ? fmtDataCurta(i.data) : "—"}</span>
        <span class="desc"${i.banco ? ` title="${esc(i.banco)}"` : ""}>${i.desc}</span>
        ${comRep ? `<span class="rep">${celRep(i.rep)}</span>` : ""}
        <span class="status">${i.status || ""}${comRep && i.rep ? `<span class="rep-movel">${i.rep}</span>` : ""}${comBanco ? `<span class="banco-movel">${esc(i.banco || "")}</span>` : ""}</span>
        ${comBanco ? `<span class="banco">${i.banco ? marcaBanco(i.banco, 20) + `<span>${esc(i.banco)}</span>` : "—"}</span>` : ""}
        <b class="${corSinal(i.valor)}">${brlSinal(i.valor)}</b>
        <b class="saldo${i.saldo < 0 ? " down" : ""}">${brl(Math.abs(i.saldo))}</b>
      </div>`;
    const cel = ([rot, curto, v, sinal, cls]) => celResumo(rot, curto, Math.abs(r2(v)), sinal !== undefined ? sinal : (r2(v) > 0 ? "+" : r2(v) < 0 ? "−" : ""), cls || corSinal(v));
    return { titulo, total: r2(saldo), qtd: itens.length, html: `
      <div class="extrato-titulo"><span>Histórico</span><span class="dim">${plural(itens.length, "lançamento")}</span></div>
      <div class="extrato-tabela extrato-classe${comRep ? " extrato-com-banco" : comBanco ? " extrato-so-banco" : ""}">
        <div class="extrato-cab"><span>Data</span><span>Descrição</span>${comRep ? `<span class="rep">Recorrência</span>` : ""}<span class="status">Status</span>${comBanco ? `<span class="banco">Banco</span>` : ""}<span>Valor</span><span>Saldo</span></div>
        <div class="explica-lista extrato-banco">${itens.length ? itens.map(linha).join("") : `<div class="extrato-linha"><span></span><span class="desc dim">Nada por aqui ainda</span><span></span><span></span><span></span></div>`}</div>
        <div class="extrato-resumo">${resumo.map(cel).join("")}</div>
      </div>` };
  }

  function explicarHistoricoClasse(classe) {
    const h = historicoClasse(DADOS, classe);
    painelReabrir = () => explicarHistoricoClasse(classe);
    const secao = { bancos: "bancos", investimentos: "investimentos", acoes: "acoes", cripto: "investimentos", dividas: "despesas" }[classe];
    abrirModal(`
      <h3 class="extrato-cab-banco"><span>${h.titulo}</span><b class="${corSinal(h.total)}${classe === "dividas" ? " cab-divida" : ""}">${brlSinal(h.total)}</b></h3>
      ${h.html}
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnIrPainel">Abrir</button>
        <button class="btn" id="btnVoltarPainel">Voltar</button>
        <button class="btn" id="btnFecharPainel">Fechar</button>
      </div>`);
    document.getElementById("modal").classList.add("modal-extrato", classe === "bancos" ? "modal-bancos" : classe === "dividas" ? "modal-dividas" : "modal-classe");
    document.getElementById("btnIrPainel").onclick = () => { fecharModal(); navegarPara(secao); };
    document.getElementById("btnVoltarPainel").onclick = () => explicarKPI(origemHistorico || "patrimonio");
    document.getElementById("btnFecharPainel").onclick = fecharModal;
    const ext = document.querySelector("#modal .extrato-banco");
    if (ext) ext.scrollTop = ext.scrollHeight;   // abre no fim, onde está o total atual
    ajustarLarguraHistorico();
  }
  // descrição numa linha só: o quadro ganha a largura exata para a maior descrição
  // caber inteira (sem sobrar vão antes do Status); no celular, quebra linha
  function ajustarLarguraHistorico() {
    const m = document.getElementById("modal");
    if (!m || window.innerWidth <= 560) return;
    const descs = [...m.querySelectorAll(".extrato-classe .extrato-linha .desc")];
    if (!descs.length) return;
    m.style.width = "";
    descs.forEach((el) => { el.style.whiteSpace = "nowrap"; });
    const coluna = descs[0].getBoundingClientRect().width;
    const maior = Math.max(...descs.map((el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; }));
    const largura = Math.max(640, Math.ceil(m.getBoundingClientRect().width - coluna + maior + 4));
    if (largura <= window.innerWidth - 24) m.style.width = largura + "px";
    else descs.forEach((el) => { el.style.whiteSpace = ""; });   // não cabe na tela: volta a quebrar linha
  }

  function explicarClasse(rotulo) {
    const d = DADOS;
    const itens = itensPatrimonio(d);
    const item = itens.find((i) => i.rotulo === rotulo);
    if (!item) return;
    const total = itens.reduce((s, i) => s + i.valor, 0);
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    let detalhe = "";
    let secao = "investimentos";
    if (rotulo === "Bancos") {
      detalhe = bancosNaOrdem(F.listaBancosComSaldo(d)).map((b) => linhaBancoClicavel(b.id, linha(esc(b.nome), brlSinal(b.saldoAtual)))).join("");
      secao = "bancos";
    } else if (["Ações", "FIIs", "ETFs"].indexOf(rotulo) > -1) {
      const cat = rotulo === "Ações" ? "Ação" : rotulo === "FIIs" ? "FII" : "ETF";
      detalhe = I.listaAcoesComCalculo(d).filter((a) => a.categoria === cat)
        .map((a) => linha(esc(a.ticker) + " · " + a.quantidade + " un.", brlSinal(a.valorAtual))).join("");
      secao = "acoes";
    } else {
      detalhe = d.investimentos.filter((i) => rotuloCategoriaComp(i.categoria || "Outros") === rotulo)
        .map((i) => linha(esc(nomeCurtoInvestimento(i.nome)), brlSinal(I.valorLiquidoInvestimento(i)))).join("");
      if (rotulo === "Criptomoedas") {
        detalhe += I.listaCripto(d).map((c) => linha(`${c.moeda} · ${fmtQtdCripto(c.quantidade)}`, brlSinal(c.valor))).join("");
        if (!d.investimentos.some((i) => rotuloCategoriaComp(i.categoria || "Outros") === rotulo)) secao = "acoes";
      }
    }
    painelSimples(rotulo, total > 0 ? (item.valor / total) * 100 : 0, "do seu patrimônio líquido",
      "valor deste grupo ÷ patrimônio líquido",
      detalhe + linha("Total", brlSinal(item.valor), corSinal(item.valor)), secao);
  }

  // TOTAL do quadro "Composição patrimônio": quanto há em cada classe;
  // cada linha abre o detalhe daquela classe
  function explicarComposicao() {
    const itens = itensPatrimonio(DADOS);
    if (!itens.length) return;
    const total = itens.reduce((s, i) => s + i.valor, 0);
    const bancos = itens.filter((i) => i.rotulo === "Bancos").reduce((s, i) => s + i.valor, 0);
    const linhas = itens.map((i) => `<div class="kv kv-editavel" data-classe="${esc(i.rotulo)}" title="Ver detalhes"><span class="dim">${emojiClasse(i.rotulo)} ${esc(i.rotulo)} · ${(total > 0 ? (i.valor / total) * 100 : 0).toFixed(1).replace(".", ",")}%</span><b>${brlSinal(i.valor)}</b></div>`).join("");
    painelSimples("Composição patrimônio", total > 0 ? ((total - bancos) / total) * 100 : 0, "do total está investido",
      "soma dos ativos líquidos (bancos + investimentos sem IR + ações + cripto)",
      linhas + `<div class="kv"><span class="dim">Total</span><b class="${corSinal(total)}">${brlSinal(total)}</b></div>`, "investimentos");
    document.querySelectorAll("#modal [data-classe]").forEach((el) => {
      el.onclick = (e) => { e.stopPropagation(); explicarClasse(el.dataset.classe); };
    });
  }

  function explicarMeta(id) {
    const m = achar(DADOS.metas, id);
    if (!m) return;
    const progresso = m.objetivo > 0 ? (m.atual / m.objetivo) * 100 : 0;
    const falta = Math.max(0, Number(m.objetivo || 0) - Number(m.atual || 0));
    // cada linha abre a edição da meta
    const linha = (r, v, c) => `<div class="kv kv-editavel" data-acao-editar="editar-meta" data-id="${esc(m.id)}" title="Abrir para editar"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    painelSimples(nomeMeta(m), progresso, "do objetivo já foi guardado", "valor atual ÷ objetivo",
      linha("Objetivo", brlSinal(m.objetivo)) + linha("Guardado", brlSinal(m.atual)) +
      linha("Faltam", brlSinal(-falta), corSinal(-falta)) +
      linha("Prazo", m.prazo ? fmtData(m.prazo) : "sem prazo"),
      "metas", { rotulo: "Depositar", acao: () => abrirModalDeposito(m.id) });
    // Editar ao lado de Depositar, no mesmo padrão do quadro do banco
    const fechar = document.getElementById("btnFecharPainel");
    fechar.insertAdjacentHTML("beforebegin", `<button class="btn btn-com-icone" id="btnEditarMeta" title="Editar a meta">${ICONE_EDITAR}Editar</button>`);
    document.getElementById("btnEditarMeta").onclick = () => { fecharModal(); abrirModalMeta(m.id); };
  }


  function explicarStrip(chave) {
    const d = DADOS;
    const mes = F.mesAtual();
    const entradas = totalEntradasEfetivas(d, mes), despesas = totalDespesasPagasMes(d, mes);
    const hoje = new Date(), dia = hoje.getDate();
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;

    if (chave === "poupanca") {
      const sobra = entradas - despesas;
      const taxa = entradas > 0 ? (sobra / entradas) * 100 : 0;
      // Entradas, Despesas e Saldo abrem a lista dos lançamentos do mês
      const linhaLista = (r, v, c, alvo) => `<div class="kv kv-editavel" data-lista-poup="${alvo}" title="Ver os lançamentos do mês"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
      painelSimples("Taxa Poupança", taxa, "das receitas do mês sobraram", "(receitas − despesas) ÷ receitas",
        linha("Saudável", "20% ou mais") +
        linhaLista("+ Entradas", brlSinal(entradas), corSinal(entradas), "entradas") + linhaLista("− Despesas", brlSinal(-despesas), corSinal(-despesas), "despesas") +
        linhaLista("Saldo", brlSinal(sobra), corSinal(sobra), "saldo"), "entradas");
      document.querySelectorAll("#modal [data-lista-poup]").forEach((el) => {
        el.onclick = (e) => {
          e.stopPropagation();
          const alvo = el.dataset.listaPoup;
          if (alvo === "entradas") explicarKPI("receitas");
          else if (alvo === "despesas") explicarKPI("despesas");
          else explicarMes({ mes });
        };
      });
      return;
    }
    if (chave === "projecao") {
      // sempre as contas previstas do mês que vem
      painelReabrir = () => explicarStrip("projecao");
      const itens = despesasPrevistasMesQueVem(d);
      const aVir = itens.reduce((t, x) => t + Number(x.valor || 0), 0);
      const saldo = F.totalBancos(d);
      painelSimples(`Projeção de despesas · ${nomeMesQueVem()}`, saldo > 0 ? (aVir / saldo) * 100 : 0,
        "do seu saldo em bancos já está comprometido", "despesas previstas para o próximo mês",
        (itens.length
          ? cabecalhoColunasPainel() + itens.map((x) => linhaEditavel(x, linha(descPainel(x),
              `<span class="col-rep">${repColuna(x, x.data)}</span>` + seloStatusPainel(x.status, x) + bancoPainel(x.banco, x) + `<span class="col-valor valor-guia down">−${brl(x.valor)}</span>`))).join("")
          : `<div class="kv"><span class="dim">Nenhuma conta prevista para o mês que vem</span><b>—</b></div>`) +
        linhaTotalPainel(plural(itens.length, "Lançamento"), "−" + brl(aVir)), "despesas");
      return;
    }
    if (chave === "maiorgasto") {
      const maior = maiorDespesaPaga(d, mes);
      if (!maior) { toast("Nenhuma despesa lançada neste mês."); return; }
      painelSimples("Maior gasto do mês", despesas > 0 ? (Number(maior.valor) / despesas) * 100 : 0,
        "do total gasto no mês veio deste lançamento", "maior valor entre as despesas do mês",
        linha("Descrição", descEmoji(maior)) + linha("Valor", "−" + brl(maior.valor), "down") +
        linha("Categoria", esc(maior.categoria || "—")) + linha("Data", fmtData(maior.data)) +
        linha("Total", brlSinal(-despesas), corSinal(-despesas)), "despesas");
      return;
    }
    if (chave === "melhorativo") {
      const lista = I.listaAcoesComCalculo(d);
      if (!lista.length) { toast("Nenhum ativo cadastrado."); return; }
      const a = lista.reduce((x, y) => (x.rentabilidade >= y.rentabilidade ? x : y));
      painelSimples(`${esc(a.ticker)} · melhor ativo`, a.rentabilidade, "de rentabilidade sobre o preço médio",
        "(preço atual ÷ preço médio − 1) × 100",
        linha("Empresa", esc(a.empresa || "—")) + linha("Quantidade", String(a.quantidade)) +
        linha("Preço médio", brlSinal(a.precoMedio)) + linha("Preço atual", brlSinal(a.precoAtual)) +
        linha("Valor investido", brlSinal(a.valorInvestido)) + linha("Valor atual", brlSinal(a.valorAtual)) +
        linha("Resultado", brlSinal(a.resultado), corSinal(a.resultado)), "acoes");
      return;
    }
    if (chave === "avencer") {
      // mesmo formato do painel "Despesas do mês", só com o que ainda não foi pago
      painelReabrir = () => explicarStrip("avencer");
      const itens = pendentesDoMes(d, F.mesAtual());
      const total = itens.reduce((sm, x) => sm + Number(x.valor || 0), 0);
      const saldo = F.totalBancos(d);
      painelSimples("Contas Pendentes", saldo > 0 ? (total / saldo) * 100 : 0,
        "do seu saldo em bancos está comprometido", "soma de contas pendentes no mês atual",
        (itens.length ? cabecalhoColunasPainel() : "") +
        (itens.length
          ? itens.map((x) => linhaEditavel(x, linha(descPainel(x),
              `<span class="col-rep">${repColuna(x, x.data)}</span>` + seloStatusPainel(x.status, x) + bancoPainel(x.banco, x) + `<span class="col-valor valor-guia down">−${brl(x.valor)}</span>`))).join("")
          : `<div class="kv"><span class="dim">Nenhuma conta pendente no mês atual</span><b>—</b></div>`) +
        linhaTotalPainel(plural(itens.length, "Lançamento"), `−${brl(total)}`), "despesas");
      return;
    }
  }


  // ---------------------------------------------------------------------
  // Ordem dos bancos: do maior para o menor saldo, a mesma em todas as
  // telas (barras do dashboard, cartões e gráfico da guia Bancos).
  // ---------------------------------------------------------------------
  function bancosNaOrdem(lista) {
    const v = (x) => Number(x.valor !== undefined ? x.valor : x.saldoAtual || 0);
    return lista.slice().sort((a, b) => v(b) - v(a));
  }


  // quadros da guia Relatórios: clicar abre o histórico com cada lançamento
  // que entra no valor do quadro (só o que está Pago, como os totais), no
  // mesmo formato do histórico dos Bancos
  function explicarRelatorio(chave) {
    const d = DADOS;
    if (chave === "rel-rentabilidade") {
      const h = historicoClasse(d, "acoes"), rent = I.rentabilidadeCarteiraAcoes(d);
      abrirHistoricoRelatorio("Rentabilidade", pct(rent), corSinal(rent), h.html, "acoes", chave);
      return;
    }
    const fx = intervaloRel(mesesRelA, anoRelA);
    const meses = mesesDoPeriodoRel(d, fx);
    const comEntradas = chave !== "rel-despesas", comDespesas = chave !== "rel-receitas";
    const todosReg = [...d.entradas, ...d.despesas, ...(d.contasPagar || [])];
    const repDe = (x) => { const o = todosReg.find((r) => r.id === x.id); return o ? seloFreq({ ...o, data: x.data }, true).trim() || SELO_UNICA : ""; };
    let itens = [];
    meses.forEach((mes) => {
      if (comEntradas) listaEntradasTodasMes(d, mes).filter((x) => x.status === "Pago").forEach((x) => itens.push({ ...x, valor: Number(x.valor || 0), secao: "entradas" }));
      if (comDespesas) despesasPagasMes(d, mes).forEach((x) => itens.push({ ...x, valor: -Number(x.valor || 0), secao: "despesas" }));
    });
    let saldo = 0;
    itens = itens.sort((a, b) => String(a.data).localeCompare(String(b.data)))
      .map((x) => { saldo = Math.round((saldo + x.valor) * 100) / 100; return { ...x, saldo }; });
    const ent = itens.filter((x) => x.valor > 0).reduce((t, x) => t + x.valor, 0);
    const sai = itens.filter((x) => x.valor < 0).reduce((t, x) => t - x.valor, 0);
    const linha = (x) => {
      const rep = repDe(x), banco = x.banco && x.banco !== "—" ? x.banco : "";
      return `
      <div class="extrato-linha clicavel" data-ir-secao="${x.secao}" data-ir-id="${esc(String(x.id))}" data-ir-data="${esc(String(x.data || ""))}" title="Ver na guia ${x.secao === "entradas" ? "Entradas" : "Despesas"}">
        <span class="dim">${fmtDataCurta(x.data)}</span>
        <span class="desc"${banco ? ` title="${esc(banco)}"` : ""}>${descEmoji(x)}<span class="desc-sub">${subDe(x)}</span></span>
        <span class="rep">${celRep(rep)}</span>
        <span class="status"><span class="selo-tag selo-pago">Pago</span>${rep ? `<span class="rep-movel">${rep}</span>` : ""}<span class="banco-movel">${esc(banco)}</span></span>
        <span class="banco">${banco ? marcaBanco(banco, 20) + `<span>${esc(banco)}</span>` : "—"}</span>
        <b class="${corSinal(x.valor)}">${brlSinal(x.valor)}</b>
        <b class="saldo${x.saldo < 0 ? " down" : ""}">${brl(Math.abs(x.saldo))}</b>
      </div>`;
    };
    // Resultado: receitas, despesas e a diferença; Receitas ou Despesas: o maior lançamento, a média por mês e o total
    const maior = itens.reduce((m, x) => Math.max(m, Math.abs(x.valor)), 0), media = (ent + sai) / Math.max(1, meses.length);
    const resumo = comEntradas && comDespesas
      ? [["Receitas", "Rec.", ent, "+", "up fluxo"], ["Despesas", "Desp.", sai, "−", "down fluxo"], ["Resultado", "Res.", ent - sai]]
      : comEntradas ? [["Maior", "Maior", maior, "+", "up"], ["Média/mês", "Média", media, "+", "up"], ["Total", "Tot.", ent, "+", "up"]]
        : [["Maior", "Maior", maior, "−", "down"], ["Média/mês", "Média", media, "−", "down"], ["Total", "Tot.", sai, "−", "down"]];
    const cel = ([rot, curto, v, sinal, cls]) => celResumo(rot, curto, Math.abs(Math.round(v * 100) / 100), sinal !== undefined ? sinal : (v > 0.004 ? "+" : v < -0.004 ? "−" : ""), cls || corSinal(v));
    const vazio = `<div class="extrato-linha"><span></span><span class="desc dim">Nenhum lançamento pago no período</span><span></span><span></span><span></span><span></span><span></span></div>`;
    const html = `
      <div class="extrato-titulo"><span>Histórico · ${esc(mesesRelA ? `${mesesRelA} ${mesesRelA === 1 ? "mês" : "meses"} de ${anoRelA}` : "Todo histórico")}</span><span class="dim">${plural(itens.length, "lançamento")}</span></div>
      <div class="extrato-tabela extrato-classe extrato-com-banco">
        <div class="extrato-cab"><span>Data</span><span>Descrição</span><span class="rep">Recorrência</span><span class="status">Status</span><span class="banco">Banco</span><span>Valor</span><span>Saldo</span></div>
        <div class="explica-lista extrato-banco">${itens.length ? itens.map(linha).join("") : vazio}</div>
        <div class="extrato-resumo">${resumo.map(cel).join("")}</div>
      </div>`;
    const titulo = { "rel-receitas": "Receitas", "rel-despesas": "Despesas", "rel-resultado": "Resultado" }[chave];
    const total = chave === "rel-receitas" ? ent : chave === "rel-despesas" ? -sai : ent - sai;
    abrirHistoricoRelatorio(titulo, brlSinal(total), corSinal(total), html, chave === "rel-despesas" ? "despesas" : "entradas", chave);
  }
  function abrirHistoricoRelatorio(titulo, valor, cor, html, secao, chave) {
    painelReabrir = () => explicarRelatorio(chave);   // redesenha depois de editar um lançamento
    abrirModal(`
      <h3 class="extrato-cab-banco"><span>${esc(titulo)}</span><b class="${cor}">${valor}</b></h3>
      ${html}
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnIrPainel">Abrir</button>
        <button class="btn" id="btnFecharPainel">Fechar</button>
      </div>`);
    document.getElementById("modal").classList.add("modal-extrato", secao === "acoes" ? "modal-classe" : "modal-bancos");
    document.getElementById("btnIrPainel").onclick = () => { fecharModal(); navegarPara(secao); };
    document.getElementById("btnFecharPainel").onclick = fecharModal;
    const ext = document.querySelector("#modal .extrato-banco");
    if (ext) ext.scrollTop = ext.scrollHeight;   // abre no fim, onde está o total do período
    ajustarLarguraHistorico();
  }

  function explicarMes(ponto) {
    if (!ponto || !ponto.mes) return;
    const d = DADOS;
    const mes = ponto.mes;
    painelReabrir = () => explicarMes(ponto);   // redesenha depois de trocar status/banco
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    // mesmo formato dos painéis "Receitas do mês" e "Despesas do mês":
    // todos os lançamentos do mês, com banco, status e valor, e o saldo no fim
    // organizado em dois blocos — receitas e despesas, cada um com seu total —
    // e o saldo (receitas − despesas) no fim
    const itensR = listaEntradasTodasMes(d, mes).map((e) => ({ ...e, sinal: "+", cor: "up" }));
    const itensD = listaDespesasTodasMes(d, mes).map((x) => ({ ...x, sinal: "−", cor: "down" }));
    const todos = [...itensR, ...itensD];
    const linhaItem = (it) => linhaEditavel(it, linha(descPainel(it),
      `<span class="col-rep">${repColuna(it, it.data)}</span>` + seloStatusPainel(it.status, it) + bancoPainel(it.banco, it) + `<span class="col-valor valor-guia ${it.cor}">${it.sinal}${brl(it.valor)}</span>`));
    const vazio = (txt) => `<div class="kv"><span class="dim">${txt}</span><b>—</b></div>`;
    // o mês segue o status: os totais contam só o que está Pago
    const totE = totalEntradasEfetivas(d, mes), totD = totalDespesasPagasMes(d, mes);
    const saldo = totE - totD;
    const nomeMes = new Date(mes + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    painelSimples(nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1),
      totE > 0 ? (saldo / totE) * 100 : 0, saldo < 0 ? "das receitas: o mês fechou no negativo" : "das receitas sobraram neste mês", "receitas − despesas do mês",
      cabecalhoColunasPainel() +
      (todos.length ? todos.sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")) || (a.sinal === "+" && b.sinal === "+" ? F.ordemNoDia(a) - F.ordemNoDia(b) : 0)).map(linhaItem).join("") : vazio("Nenhum lançamento no mês")) +
      // rodapé igual ao dos históricos: Entradas, Despesas e Saldo do mês (só o que está Pago)
      `<div class="extrato-tabela rodape-painel"><div class="extrato-resumo">
        ${celResumo("Entradas", "Ent.", totE, "+", "up fluxo")}
        ${celResumo("Despesas", "Desp.", totD, "−", "down fluxo")}
        ${celResumo("Saldo", "Sal.", Math.abs(saldo), saldo > 0 ? "+" : saldo < 0 ? "−" : "", corSinal(saldo))}
      </div></div>`,
      "despesas", { rotulo: "Abrir", acao: () => { navegarPara("despesas"); mesDespesas = mes; renderRota(); } });
    // mês no negativo: o percentual aparece com "−" e em vermelho
    if (saldo < 0) { const b = document.querySelector("#modal .explica-pct b"); if (b) { b.textContent = "−" + b.textContent; b.classList.add("down"); } }
  }



  // Painel do quadro "Evolução patrimonial": detalha o ponto clicado —
  // quanto o patrimônio variou desde o mês anterior e desde o começo do
  // período, e como ele está dividido hoje.
  function explicarPatrimonio(ponto, serie, iPico) {
    if (!ponto) return;
    const d = DADOS;
    const idx = serie.indexOf(ponto);
    const anterior = idx > 0 ? serie[idx - 1] : null;
    const primeiro = serie[0];
    const pico = serie[iPico];
    const iMin = serie.reduce((m, x, i) => (x.valor < serie[m].valor ? i : m), 0);
    const varMes = anterior ? ponto.valor - anterior.valor : 0;
    const pctMes = anterior && anterior.valor ? (varMes / Math.abs(anterior.valor)) * 100 : 0;
    const varPeriodo = ponto.valor - primeiro.valor;
    const pctPeriodo = primeiro.valor ? (varPeriodo / Math.abs(primeiro.valor)) * 100 : 0;
    const mes = String(ponto.data).slice(0, 7);
    const entradasMes = totalEntradasEfetivas(d, mes), despesasMes = totalDespesasPagasMes(d, mes);
    // rótulos escritos exatamente como devem aparecer (sem a capitalização automática)
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${r}</span><b class="${c || ""}">${v}</b></div>`;
    const secao = (t, cor) => `<div class="kv kv-secao ${cor ? "kv-secao-" + cor : ""}"><span>${t}</span></div>`;
    const pctTxt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1).replace(".", ",") + "%";
    const quando = new Date(ponto.data + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    // marco do ponto, em uma frase curta
    let marco = "";
    if (idx === iPico) marco = `<div class="marco-evo marco-pico">🏆 Maior patrimônio do período</div>`;
    else if (idx === iMin && serie.length > 2) marco = `<div class="marco-evo marco-min">📉 Menor patrimônio do período</div>`;
    else if (anterior && varMes > 0) marco = `<div class="marco-evo marco-sobe">▲ Patrimônio cresceu ${brl(varMes)} no mês</div>`;
    else if (anterior && varMes < 0) marco = `<div class="marco-evo marco-cai">▼ Patrimônio caiu ${brl(Math.abs(varMes))} no mês</div>`;
    const temComp = ponto.bancos !== undefined;

    painelSimples(quando.charAt(0).toUpperCase() + quando.slice(1) + (ponto.hoje ? " · hoje" : ""),
      anterior ? pctMes : pctPeriodo, anterior ? "em relação ao mês anterior" : "desde o início do período",
      "bancos + investimentos + ações + cripto − dívidas",
      marco +
      secao("Resumo") +
      linha("Patrimônio", brlSinal(ponto.valor), corSinal(ponto.valor)) +
      (anterior ? linha("Variação no mês", `${brlSinal(varMes)} (${pctTxt(pctMes)})`, corSinal(varMes)) : "") +
      linha("Desde o início", `${brlSinal(varPeriodo)} (${pctTxt(pctPeriodo)})`, corSinal(varPeriodo)) +
      (idx !== iPico ? linha("Distância do pico", brlSinal(ponto.valor - pico.valor), corSinal(ponto.valor - pico.valor)) : "") +
      (temComp ? secao("Composição") +
        linha("+ Bancos", brlSinal(ponto.bancos), corSinal(ponto.bancos)) +
        linha("+ Investimentos", brlSinal(ponto.investimentos), corSinal(ponto.investimentos)) +
        linha("+ Ações e FIIs", brlSinal(ponto.acoes), corSinal(ponto.acoes)) +
        (ponto.cripto > 0 ? linha("+ Criptomoedas", brlSinal(ponto.cripto), corSinal(ponto.cripto)) : "") +
        (ponto.dividas > 0 ? linha("− Dívidas", brlSinal(-ponto.dividas), "down") : "") : "") +
      secao("Movimento do mês") +
      linha("+ Entradas", "+" + brl(entradasMes), "up") +
      linha("− Despesas", "−" + brl(despesasMes), "down") +
      linha("Sobra do mês", brlSinal(entradasMes - despesasMes), corSinal(entradasMes - despesasMes)),
      "bancos");
  }


  // =========================================================================
  // DASHBOARD
  // =========================================================================
  function renderDashboard(d) {
    const p = I.patrimonio(d);
    const mesAtual = F.mesAtual(), mesAnt = F.mesAnterior();
    // receitas e despesas do mês seguem o status: só o que está Pago
    const entradasMes = totalEntradasEfetivas(d, mesAtual), entradasAnt = totalEntradasEfetivas(d, mesAnt);
    const despesasMes = totalDespesasPagasMes(d, mesAtual), despesasAnt = totalDespesasPagasMes(d, mesAnt);
    const resultadoMes = entradasMes - despesasMes, resultadoAnt = entradasAnt - despesasAnt;
    const patrimonioAnt = (() => {
      const hist = histPatrimonio(d);
      const alvo = new Date(); alvo.setMonth(alvo.getMonth() - 1);
      const alvoStr = alvo.toISOString().slice(0, 10);
      let ref = hist[0];
      for (const h of hist) if (h.data <= alvoStr) ref = h;
      return ref ? ref.valor : p.liquido;
    })();
    const pctDespesas = entradasMes > 0 ? (despesasMes / entradasMes) * 100 : 0;
    const taxaPoupanca = entradasMes > 0 ? (resultadoMes / entradasMes) * 100 : 0;
    const baseLiquida = p.bancos + I.totalLiquidoOutros(d) + p.acoes + p.cripto;
    const pctInvestido = baseLiquida > 0 ? ((I.totalLiquidoOutros(d) + p.acoes + p.cripto) / baseLiquida) * 100 : 0;
    const pctLivre = p.bruto > 0 ? (p.liquido / p.bruto) * 100 : 0;
    const pctBancos = p.bruto > 0 ? (p.bancos / p.bruto) * 100 : 0;
    const rentCarteira = I.rentabilidadeCarteiraAcoes(d);

    const bancos = bancosNaOrdem(F.listaBancosComSaldo(d)).map((b) => ({ id: b.id, nome: b.nome, valor: b.saldoAtual, cor: b.cor }));
    const composicao = itensPatrimonio(d);
    const totalComp = composicao.reduce((s, i) => s + i.valor, 0);
    const legendaComp = composicao.length ? composicao.map((i) => `<button class="legenda-linha clicavel" data-acao="explicar-classe" data-rotulo="${esc(i.rotulo)}" title="Ver detalhes"><span class="legenda-nome"><span class="legenda-ponto" style="background:${i.cor}"></span>${esc(i.rotulo)}</span><span class="legenda-pct" style="color:${i.cor}"><span class="emoji-pct">${emojiClasse(i.rotulo)}</span>${(totalComp > 0 ? (i.valor / totalComp) * 100 : 0).toFixed(1).replace(".", ",")}%</span><span class="legenda-val">${brlSinal(i.valor)}</span></button>`).join("") : `<div class="empty">Sem ativos ainda.</div>`;

    if (!anoRD) anoRD = String(new Date().getFullYear());
    if (!anoEvo) anoEvo = String(new Date().getFullYear());

    // o pico é o maior valor dentro do período escolhido no quadro E
    const histPeriodo = historicoEvo(d);
    const pico = histPeriodo.length ? Math.max(...histPeriodo.map((h) => h.valor)) : 0;

    const acoes = I.listaAcoesComCalculo(d);
    const melhor = acoes.length ? acoes.reduce((a, b) => (a.rentabilidade >= b.rentabilidade ? a : b)) : null;
    const maiorDesp = maiorDespesaPaga(d);
    const hoje = new Date(), diaAtual = hoje.getDate(), diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const projecao = diaAtual > 0 ? (despesasMes / diaAtual) * diasNoMes : 0;
    const vencendo = pendentesDoMes(d, F.mesAtual());
    const totalVencendo = vencendo.reduce((s, c) => s + Number(c.valor || 0), 0);

    const movRecentes = [
      ...d.entradas.map((e) => ({ ...e, __tipo: "entrada" })),
      ...d.despesas.map((x) => ({ ...x, __tipo: "despesa" }))
    ].sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 6);

    return `
      ${faixaDemo(d)}
      <div class="kpi-row">
        ${kpiCard("Patrimônio líquido", brlSinal(p.bancos + I.totalLiquidoOutros(d) + p.acoes + p.cripto - p.dividas), pctLivre, "var(--cy)", delta(F.variacaoPercentual(p.liquido, patrimonioAnt), "vs mês anterior"), `Dívidas: ${brl(p.dividas)}`, "patrimonio")}
        ${kpiCard("Saldo bancário", brlSinal(p.bancos), pctBancos, "var(--cy)", delta(pctBancos, "do patrimônio"), `${bancos.length} ${bancos.length === 1 ? "Conta Cadastrada" : "Contas Cadastradas"}`, "bancos")}
        ${kpiCard("Bolsa Líquido", brlSinal(I.totalLiquidoOutros(d) + p.acoes + p.cripto), pctInvestido, "var(--cy)", delta(rentCarteira, "rent. carteira"), `${pctInvestido.toFixed(0)}% do patrimônio investido`, "investido")}
        ${kpiCard("Receitas mês", "+" + brl(entradasMes), entradasMes + despesasMes > 0 ? (entradasMes / (entradasMes + despesasMes)) * 100 : 0, "var(--cy)", delta(F.variacaoPercentual(entradasMes, entradasAnt), "vs mês anterior"), `Mês anterior: ${brl(entradasAnt)}`, "receitas")}
        ${kpiCard("Despesas mês", "−" + brl(despesasMes), pctDespesas, "var(--cy)", delta(F.variacaoPercentual(despesasMes, despesasAnt), "vs mês anterior", true), `${pctDespesas.toFixed(0)}% das receitas`, "despesas")}
      </div>

      <div class="grid">
        <div class="c3">${card("card-centrado", "Saldo bancos", "mapa ativos", `<button class="pill-periodo clicavel ${corSinal(p.bancos)}" data-acao="explicar-kpi" data-kpi="bancos" title="Ver o saldo de cada banco">TOTAL ${brlSinal(p.bancos)}</button>`, `<div class="body pad">${barList(bancos)}</div>`)}</div>
        <div class="c3">${card("card-centrado", "Composição patrimônio", "ativos líquidos", `<button class="pill-periodo clicavel ${corSinal(totalComp)}" data-acao="explicar-composicao" title="Ver o total de cada classe">TOTAL ${brlSinal(totalComp)}</button>`, `
          <div class="donut-wrap">
            <div class="donut-centro"><canvas id="graf-dash-composicao" width="150" height="150" style="width:150px;height:150px"></canvas>
              <button class="donut-rotulo clicavel" data-acao="explicar-kpi" data-kpi="investido" title="Ver como este percentual é calculado"><b>${pctInvestido.toFixed(1).replace(".", ",")}%</b><span class="acc-laranja">INVESTIDO</span></button>
            </div>
            <div class="legenda">${legendaComp}</div>
          </div>`)}</div>
        <div class="c3">${card("", "Receitas x despesas", `${mesesRD} ${mesesRD === 1 ? "mês" : "meses"} de ${anoRD}`,
          `<div class="filtro-mes">${LEGENDA_RD}${abasMeses("periodo-rd", mesesRD, [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }])}</div>`, `<div class="grafico-cheio" style="padding:8px 14px 12px;min-height:236px"><div class="grafico-cheio-area"><canvas id="graf-receitas-despesas"></canvas></div></div>`)}</div>
        <div class="c3">${card("", "Metas", resumoMetas(d), `<div class="filtro-mes">` + abasMeses("periodo-metas", periodoMetas, [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }, { meses: 0, rotulo: "Tudo" }]) + `</div>`, metasMini(d))}</div>
      </div>

      <div class="grid">
        <div class="c12">${cardEvolucaoPatrimonial(d, { canvas: "graf-evolucao", acao: "periodo-evo", meses: mesesEvo, ano: anoEvo })}</div>
      </div>

      ${stripKpis([
        { rotulo: "TAXA POUPANÇA", valor: taxaPoupanca.toFixed(1).replace(".", ",") + "%", sub: `Resultado: ${brlSinal(resultadoMes)}`, cor: "#22E39A", icone: ICONES_STRIP.poupanca, chave: "poupanca" },
        { rotulo: "PROJEÇÃO DESPESAS", valor: "−" + brl(despesasPrevistasMesQueVem(d).reduce((t, x) => t + Number(x.valor || 0), 0)), sub: nomeMesQueVem(), cor: "#FF7A1A", icone: ICONES_STRIP.projecao, chave: "projecao" },
        { rotulo: "MAIOR GASTO", valor: maiorDesp ? "−" + brl(maiorDesp.valor) : "—", sub: maiorDesp ? descEmoji(maiorDesp) : "Sem Despesas", cor: "#FF4D7A", icone: ICONES_STRIP.maiorgasto, chave: "maiorgasto" },
        { rotulo: "MELHOR ATIVO", valor: melhor ? esc(melhor.ticker) : "—", sub: melhor ? `<b class="${corSinal(melhor.rentabilidade)}">${pct(melhor.rentabilidade)}</b> Preço Médio` : "sem ativos", cor: "#FFC233", icone: ICONES_STRIP.melhorativo, chave: "melhorativo" },
        { rotulo: "CONTAS PENDENTES", valor: brl(totalVencendo), sub: `${vencendo.length} ${vencendo.length === 1 ? "Conta" : "Contas"}`, cor: "#2F8BFF", icone: ICONES_STRIP.avencer, chave: "avencer" }
      ])}

    `;
  }

  function fmtMesRotulo(chave) {
    const dt = new Date(Number(chave.slice(0, 4)), Number(chave.slice(5, 7)) - 1, 1);
    return dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase() + "/" + chave.slice(2, 4);
  }

  function tabelaAcoesResumo(lista) {
    if (!lista.length) return `<div class="empty">Nenhuma ação cadastrada ainda.</div>`;
    const grid = "grid-template-columns:1fr 70px 90px 90px";
    let html = `<div class="hd" style="${grid}"><i>Ativo</i><i class="r">Qtd</i><i class="r">Atual</i><i class="r">Result.</i></div>`;
    html += lista.map((a) => `
      <button class="rw" style="${grid}" data-acao="ir" data-secao="detalhe-acao" data-id="${a.id}">
        <div><span class="tk">${esc(a.ticker)}</span> <span class="selo-tag ${classeSelo(a.categoria)}">${esc(a.categoria)}</span></div>
        <div class="r big">${a.quantidade}</div>
        <div class="r big">${brl(a.valorAtual)}</div>
        <div class="r big ${corSinal(a.resultado)}">${brlSinal(a.resultado)}</div>
      </button>`).join("");
    return html;
  }

  function tabelaMovimentacoes(d, lista) {
    if (!lista.length) return `<div class="empty">Nenhuma movimentação registrada ainda.</div>`;
    const grid = "grid-template-columns:1fr 90px";
    let html = `<div class="hd" style="${grid}"><i>Descrição</i><i class="r">Valor</i></div>`;
    html += lista.map((m) => `
      <div class="rw" style="${grid}">
        <div><div class="nm">${descEmoji(m)}</div><div class="sub">${fmtDataCurta(m.data)} · ${subDe(m)}${seloDe(m, m.data)}</div></div>
        <div class="r big ${m.__tipo === "entrada" ? "up" : "down"}">${m.__tipo === "entrada" ? "+" : "−"}${brl(m.valor)}</div>
      </div>`).join("");
    return html;
  }

  // =========================================================================
  // FINANÇAS — resumo patrimonial (item 15)
  // =========================================================================
  // nome da categoria como aparece no quadro Composição patrimônio (só a exibição muda)
  const rotuloCategoriaComp = (c) => (String(c).toLowerCase() === "renda fixa" ? "Renda Fixa" : c);

  // cada classe do patrimônio com uma cor própria e fixa (sem repetir e sem
  // vermelho, que no programa indica valor negativo)
  // emoji de cada classe da composição; classe nova ganha um emoji sozinha
  // (por palavra-chave ou, se nada combinar, um fixo tirado do próprio nome)
  const EMOJI_CLASSE = {
    "Bancos": "🏦", "Ações": "📈", "FIIs": "🏢", "ETFs": "🧺", "BDRs": "🌎", "Renda Fixa": "💰", "Tesouro Direto": "🏛️",
    "Fundos": "💼", "Criptomoedas": "🪙", "Outros": "📦", "Dólar": "💵", "Poupança": "🐷", "Previdência": "🧓"
  };
  const EMOJI_CLASSE_CHAVE = [[/banco|conta/i, "🏦"], [/a[cç][aã]o|a[cç][oõ]es|bolsa/i, "📈"], [/fii|imobili/i, "🏢"], [/etf|[ií]ndice/i, "🧺"],
    [/bdr|exterior|internacional/i, "🌎"], [/renda fixa|cdb|lci|lca|deb[eê]nt|cri\b|cra\b/i, "💰"], [/tesouro/i, "🏛️"], [/fundo/i, "💼"],
    [/cripto|bitcoin|btc|eth/i, "🪙"], [/d[oó]lar|c[aâ]mbio|moeda/i, "💵"], [/poupan/i, "🐷"], [/previd/i, "🧓"], [/ouro/i, "🥇"], [/im[oó]ve/i, "🏠"]];
  const EMOJIS_RESERVA = ["🔷", "🔶", "🟣", "🟢", "🔵", "🟠", "🟡", "🔺", "⭐", "💎", "🧩", "🎯"];
  // emoji de cada aplicação pelo tipo do ativo (ou pelo nome): CDB, RDB, LCI...
  // cada um com o seu; sem tipo reconhecido, fica o emoji da classe
  const EMOJI_TIPO_ATIVO = [
    [/^cdb\b/i, "💰"], [/^rdb\b/i, "💎"], [/^lci\b/i, "🏠"], [/^lca\b/i, "🌾"], [/^lc\b/i, "💳"],
    [/^cri\b/i, "🏘️"], [/^cra\b/i, "🚜"], [/deb[eê]nture/i, "📜"], [/tesouro/i, "🏛️"], [/poupan/i, "🐷"],
    [/fundo imobili/i, "🏢"], [/fundo/i, "💼"], [/cripto/i, "🪙"]
  ];
  function emojiInvestimento(i) {
    for (const txt of [i.tipoAtivo, i.nome]) {
      const r = txt && EMOJI_TIPO_ATIVO.find(([re]) => re.test(String(txt).trim()));
      if (r) return r[1];
    }
    return emojiClasse(rotuloCategoriaComp(i.categoria || "Outros"));
  }
  function emojiClasse(rotulo) {
    const r = String(rotulo || "");
    if (EMOJI_CLASSE[r]) return EMOJI_CLASSE[r];
    const k = EMOJI_CLASSE_CHAVE.find(([re]) => re.test(r));
    if (k) return k[1];
    let h = 0; for (const c of r) h = (h * 31 + c.codePointAt(0)) >>> 0;
    return EMOJIS_RESERVA[h % EMOJIS_RESERVA.length];
  }
  const CORES_COMPOSICAO = {
    "Bancos": "#00E5FF", "Ações": "#2EE59D", "FIIs": "#A78BFA", "ETFs": "#FFD633",
    "Renda Fixa": "#FF8A3D", "Tesouro Direto": "#3B82F6", "Fundos": "#F472B6",
    "Criptomoedas": "#FACC15", "Outros": "#94A3B8"
  };
  const CORES_COMPOSICAO_EXTRA = ["#14B8A6", "#E879F9", "#84CC16", "#60A5FA", "#FDBA74"];
  function itensPatrimonio(d) {
    const acoesPorCat = {};
    d.acoes.forEach((a) => {
      const v = I.valorAtualAcao(a);
      acoesPorCat[a.categoria] = (acoesPorCat[a.categoria] || 0) + v;
    });
    const itens = [{ rotulo: "Bancos", valor: F.totalBancos(d), cor: CORES_COMPOSICAO["Bancos"] }];
    if (acoesPorCat["Ação"]) itens.push({ rotulo: "Ações", valor: acoesPorCat["Ação"], cor: CORES_COMPOSICAO["Ações"] });
    if (acoesPorCat["FII"]) itens.push({ rotulo: "FIIs", valor: acoesPorCat["FII"], cor: CORES_COMPOSICAO["FIIs"] });
    if (acoesPorCat["ETF"]) itens.push({ rotulo: "ETFs", valor: acoesPorCat["ETF"], cor: CORES_COMPOSICAO["ETFs"] });
    // investimentos pelo valor LÍQUIDO (já sem o IR), agrupados por categoria
    const invLiq = {};
    d.investimentos.forEach((inv) => { const c = inv.categoria || "Outros"; invLiq[c] = (invLiq[c] || 0) + I.valorLiquidoInvestimento(inv); });
    Object.keys(invLiq).sort((a, b) => invLiq[b] - invLiq[a])
      .forEach((c, i) => { const r = rotuloCategoriaComp(c); itens.push({ rotulo: r, valor: invLiq[c], cor: CORES_COMPOSICAO[r] || CORES_COMPOSICAO_EXTRA[i % CORES_COMPOSICAO_EXTRA.length] }); });
    // BTC e ETH entram em "Criptomoedas" (somam com os investimentos lançados nessa categoria)
    const totCripto = I.totalCripto(d);
    if (totCripto > 0) {
      const ex = itens.find((i) => i.rotulo === "Criptomoedas");
      if (ex) ex.valor += totCripto;
      else itens.push({ rotulo: "Criptomoedas", valor: totCripto, cor: CORES_COMPOSICAO["Criptomoedas"] });
    }
    return itens.filter((i) => i.valor > 0);
  }

  function renderFinancas(d) {
    const p = I.patrimonio(d);
    const itens = itensPatrimonio(d);
    const total = itens.reduce((s, i) => s + i.valor, 0);
    const legendaHtml = itens.length
      ? itens.map((i) => `<div class="legenda-linha"><span class="legenda-nome"><span class="legenda-ponto" style="background:${i.cor}"></span>${esc(i.rotulo)}</span><span class="legenda-pct" style="color:${i.cor}"><span class="emoji-pct">${emojiClasse(i.rotulo)}</span>${(total > 0 ? (i.valor / total) * 100 : 0).toFixed(0)}%</span><span class="legenda-val">${brlSinal(i.valor)}</span></div>`).join("")
      : `<div class="empty">Cadastre bancos, ações ou investimentos para ver a composição.</div>`;

    const serie = serieMensalEfetiva(d, 12);
    const renda = serie.map((s) => s.entradas), desp = serie.map((s) => s.despesas), poup = serie.map((s) => s.entradas - s.despesas);
    const media = (arr) => { const v = arr.filter((x) => x !== 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
    const rendaMes = totalEntradasEfetivas(d, F.mesAtual()), despMes = totalDespesasPagasMes(d, F.mesAtual()), poupMes = rendaMes - despMes;
    const pctDesp = rendaMes > 0 ? (despMes / rendaMes) * 100 : 0;
    const pctPoup = rendaMes > 0 ? Math.max(0, (poupMes / rendaMes) * 100) : 0;

    const tile = (rotulo, valor, cor, badge) => `<div class="tile" style="--tile:${cor}">
      <span class="tile-badge">${badge}</span><div class="tile-valor">${valor}</div><div class="tile-rotulo">${rotulo}</div></div>`;
    const trend = (rotulo, valorAtual, arr, cor) => `<div class="trend-card">
      <div class="trend-topo"><span style="color:${cor}">${rotulo}</span><b>${brl(valorAtual)}</b></div>
      <div class="trend-spark">${sparklineSVG(arr, cor)}</div>
      <div class="trend-media">média mensal: ${brl(media(arr))}</div></div>`;

    return `
      <div class="grid g-top">
        <div class="c3">
          <div class="tiles">
            ${tile("Renda do mês", brl(rendaMes), "var(--up)", rendaMes >= media(renda) ? "acima da média" : "abaixo da média")}
            ${tile("Despesas do mês", brl(despMes), "var(--down)", pctDesp.toFixed(1).replace(".", ",") + "% da renda")}
            ${tile("Poupança do mês", brlSinal(poupMes), "var(--azul)", pctPoup.toFixed(1).replace(".", ",") + "% da renda")}
          </div>
        </div>
        <div class="c3">${card("", "Indicadores", "limites recomendados", "", `
          <div class="body pad">
            <div class="semi-bloco"><div class="semi-titulo down">Despesas % da renda</div>${semiGaugeSVG(pctDesp, 70, "var(--down)")}</div>
            <div class="semi-bloco"><div class="semi-titulo" style="color:var(--azul)">Poupança % da renda</div>${semiGaugeSVG(pctPoup, 30, "var(--azul)")}</div>
          </div>`)}</div>
        <div class="c6">${card("", "Renda, despesas e poupança", "últimos 12 meses", `
          <span class="mini-stat up">${brl(media(renda))}<small>renda média</small></span>
          <span class="mini-stat down">${brl(media(desp))}<small>despesa média</small></span>
          <span class="mini-stat" style="color:var(--azul)">${brl(media(poup))}<small>poupança média</small></span>`,
          `<div style="padding:8px 14px 12px;height:280px"><canvas id="graf-fin-linhas"></canvas></div>`)}</div>
      </div>

      <div class="grid">
        <div class="c4">${trend("Renda", rendaMes, renda, "var(--up)")}</div>
        <div class="c4">${trend("Despesas", despMes, desp, "var(--down)")}</div>
        <div class="c4">${trend("Poupança", poupMes, poup, "var(--azul)")}</div>
      </div>

      <div class="grid">
        <div class="c6">${card("card-centrado", "Composição patrimônio", "ativos líquidos", `<button class="pill-periodo clicavel ${corSinal(total)}" data-acao="explicar-composicao" title="Ver o total de cada classe">TOTAL ${brlSinal(total)}</button>`, `<div class="donut-wrap"><div class="donut-centro"><canvas id="graf-patrimonio-divisao" width="150" height="150" style="width:150px;height:150px"></canvas><div class="donut-rotulo"><b>${brl(p.bruto).replace("R$", "").trim()}</b><span class="acc-laranja">BRUTO</span></div></div><div class="legenda">${legendaHtml}</div></div>`)}</div>
        <div class="c6">${card("", "Resumo patrimonial", "", "", `
          <div class="kv"><span class="dim">Dinheiro em bancos</span><b class="${corSinal(p.bancos)}">${brlSinal(p.bancos)}</b></div>
          <div class="kv"><span class="dim">+ Ações e FIIs</span><b class="${corSinal(p.acoes)}">${brlSinal(p.acoes)}</b></div>
          ${p.cripto > 0 ? `<div class="kv"><span class="dim">+ Criptomoedas (BTC, ETH)</span><b class="${corSinal(p.cripto)}">${brlSinal(p.cripto)}</b></div>` : ""}
          <div class="kv"><span class="dim">+ Investimentos (renda fixa, tesouro, fundos...)</span><b class="${corSinal(p.investimentos)}">${brlSinal(p.investimentos)}</b></div>
          <div class="kv"><span class="dim">− Dívidas (contas em aberto e parcelas a pagar)</span><b class="down">${brlSinal(-p.dividas)}</b></div>
        `, `<span>PATRIMÔNIO LÍQUIDO</span><span class="${corSinal(p.liquido)}" style="font-size:15px">${brlSinal(p.liquido)}</span>`)}</div>
      </div>
    `;
  }

  // =========================================================================
  // BANCOS
  // =========================================================================

  // Valores de cada conta conforme o período escolhido na guia Bancos.
  // Sem período ("Tudo") é o saldo atual; com período, a movimentação
  // líquida do intervalo (entradas menos saídas).
  function faixaBancos() {
    if (!anoBancos) anoBancos = String(new Date().getFullYear());
    return intervaloAnoMeses(anoBancos, mesesBancos);
  }

  function bancosDoPeriodo(d) {
    const fx = mesesBancos ? faixaBancos() : { ini: "0000-01-01", fim: "9999-12-31" };
    const dentro = (dt) => String(dt || "") >= fx.ini && String(dt || "") <= fx.fim;
    return F.listaBancosComSaldo(d).map((b) => {
      let ent = d.entradas.filter((e) => e.bancoId === b.id && !e.previsto && dentro(e.data))
        .reduce((t, e) => t + Number(e.valor || 0), 0);
      let sai = d.despesas.filter((x) => x.bancoId === b.id && !x.cartaoId && dentro(x.data))
        .reduce((t, x) => t + Number(x.valor || 0), 0);
      // contas a pagar e repetições marcadas como pagas
      let transf = 0;
      F.movimentosDoBanco(d, b.id).filter((m) => dentro(m.data)).forEach((m) => {
        if (m.transferencia) transf += m.valor;
        else if (m.valor >= 0) ent += m.valor; else sai -= m.valor;
      });
      return Object.assign({}, b, { entradas: ent, saidas: sai, transferido: transf, valor: mesesBancos ? ent - sai + transf : b.saldoAtual });
    });
  }

  function renderBancos(d) {
    const bancos = bancosNaOrdem(bancosDoPeriodo(d));
    const total = bancos.reduce((t, b) => t + Number(b.valor || 0), 0);
    const rotuloPeriodo = mesesBancos ? `Movimentação últimos ${mesesBancos} meses` : "";
    let listaHtml;
    if (!bancos.length) {
      listaHtml = `<div class="empty">Nenhum banco cadastrado. Use "+ Novo banco" para começar.</div>`;
    } else {
      listaHtml = `<div class="grade-bancos">` + bancos.map((b) => `
          <div class="cartao-item" style="border-left-color:${esc(b.cor || "#3FC1E0")}" data-acao="explicar-banco" data-id="${b.id}" title="Ver o histórico de transações">
            <div class="linha1"><div class="nome-com-marca">${marcaBanco(b.nome, 24)}<div><div class="nome">${esc(b.nome)}</div><div class="tipo">${esc(b.tipo || "—")}</div>${b.agencia ? `<div class="tipo"><span class="sem-quebra">Ag ${esc(b.agencia)}</span></div>` : ""}${b.conta ? `<div class="tipo"><span class="sem-quebra">Cc ${esc(b.conta)}</span></div>` : ""}</div></div></div>
            <div class="saldo saldo-branco">${brlSinal(b.valor)}</div>
            ${mesesBancos ? `<div class="rodape"><span>Saldo Atual ${brl(b.saldoAtual)}</span></div>` : ""}
          </div>`).join("") + `</div>`;
    }
    return `
      ${faixaDemo(d)}
      <div class="grid g-top">
        <div class="c12">${card("c12", "Meus bancos", `${bancos.length} ${bancos.length === 1 ? "Conta Cadastrada" : "Contas Cadastradas"}`, `${bancos.length ? `<span class="pill-periodo ${corSinal(total)}" title="Soma de todas as contas">TOTAL ${brlSinal(total)}</span>` : ""}${d.bancos.length > 1 ? `<button class="btn" data-acao="nova-transferencia" title="Passar dinheiro de um banco para outro">⇄ TRANSFERIR</button>` : ""}<button class="btn primario" data-acao="nova-banco"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`, listaHtml)}</div>
      </div>
      <div class="grid">
        <div class="c12">${card("", "Saldo bancos", mesesBancos ? `Movimentação · ${mesesBancos} ${mesesBancos === 1 ? "mês" : "meses"} de ${anoBancos}` : "comparação entre contas",
          `<div class="filtro-mes">${seletorAnoDash("anoBancos", anoBancos, anosDashboard(d))}${abasMeses("periodo-bancos", mesesBancos, [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }, { meses: 0, rotulo: "Tudo" }])}</div>`,
          `<div style="padding:8px 18px 10px;height:${Math.max(150, bancos.length * 40)}px"><canvas id="graf-saldo-bancos"></canvas></div>`)}</div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------
  // TRANSFERÊNCIAS entre os próprios bancos: tiram de um e põem no outro,
  // sem contar como receita ou despesa do mês. Ficam no extrato de cada
  // banco, onde a linha abre a transferência para editar.
  // ---------------------------------------------------------------------
  // Tipo da transferência (só ao criar): trocar abre a outra janela com o que já foi preenchido
  const campoTipoTransf = (auto) => `<div class="campo"><label for="f_tipoTransf">Tipo</label><select id="f_tipoTransf">
        <option value="unica"${auto ? "" : " selected"}>Única</option>
        <option value="auto"${auto ? " selected" : ""}>Automática</option>
      </select></div>`;
  function ligarTipoTransf(abrirOutra) {
    const sel = document.getElementById("f_tipoTransf");
    if (sel) sel.onchange = () => abrirOutra({ deBancoId: document.getElementById("f_de").value, paraBancoId: document.getElementById("f_para").value,
      valor: numIn(document.getElementById("f_valor").value) || "", obs: document.getElementById("f_obs").value.trim() });
  }

  // Saldo de hoje do banco de onde sai o dinheiro, embaixo do campo "De", e
  // como ele fica depois da transferência. Ao editar uma transferência já
  // feita, o valor dela volta para o saldo (é o que dá para enviar).
  function ligarSaldoOrigem(devolver, soSaldo) {
    const de = document.getElementById("f_de"), valor = document.getElementById("f_valor");
    if (!de || !valor) return;
    const caixa = document.createElement("div");
    caixa.className = "ajuda saldo-origem";
    de.insertAdjacentElement("afterend", caixa);
    const saldos = F.listaBancosComSaldo(DADOS);
    const atualizar = () => {
      const b = saldos.find((x) => x.id === de.value);
      if (!b) { caixa.innerHTML = ""; return; }
      const saldo = b.saldoAtual + (devolver && devolver.bancoId === b.id ? devolver.valor : 0);
      const v = numIn(valor.value), depois = Math.round((saldo - v) * 100) / 100;
      caixa.innerHTML = `Saldo disponível: <b class="${corSinal(saldo)}">${brlSinal(saldo)}</b>` +
        (v > 0 && !soSaldo ? ` · depois: <b class="${corSinal(depois)}">${brlSinal(depois)}</b>${depois < 0 ? " (fica negativo)" : ""}` : "");
    };
    de.addEventListener("change", atualizar);
    valor.addEventListener("input", atualizar);
    atualizar();
  }

  function abrirModalTransferencia(id, inicial) {
    const t = id ? achar(DADOS.transferencias || [], id) : null;
    const v = t || inicial || {};
    // sugestão: tirar do banco com mais saldo
    const maior = F.listaBancosComSaldo(DADOS).slice().sort((a, b) => b.saldoAtual - a.saldoAtual)[0];
    abrirModal(`
      <h3>${t ? "Editar transferência" : "Transferir entre bancos"}</h3>
      ${t ? "" : campoTipoTransf(false)}
      <div class="par">
        <div class="campo"><label for="f_de">De</label><select id="f_de">${opcoesBancos(DADOS.bancos, v.deBancoId || (maior ? maior.id : ""), true)}</select></div>
        <div class="campo"><label for="f_para">Para</label><select id="f_para">${opcoesBancos(DADOS.bancos, v.paraBancoId || "", true)}</select></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_valor">Valor</label>${campoMoeda("f_valor", v.valor || "")}</div>
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${t ? t.data : hojeISO()}"></div>
      </div>
      <div class="campo"><label for="f_obs">Observação</label><input id="f_obs" value="${esc(v.obs || "")}" placeholder="Opcional"><div class="ajuda">O valor sai do primeiro banco e entra no segundo. Não conta como receita nem despesa.</div></div>
      <div class="modal-acoes">${t ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}<button class="btn primario salvar" id="btnSalvar">${t ? "Salvar" : "Transferir"}</button></div>`);
    if (!t) ligarTipoTransf((dados) => abrirModalTransfAuto(null, dados));
    ligarSaldoOrigem(t ? { bancoId: t.deBancoId, valor: Number(t.valor || 0) } : null);
    document.getElementById("btnSalvar").onclick = () => {
      const de = document.getElementById("f_de").value, para = document.getElementById("f_para").value;
      const valor = numIn(document.getElementById("f_valor").value);
      const data = document.getElementById("f_data").value || hojeISO();
      if (!de || !para) { toast("Escolha os dois bancos."); return; }
      if (de === para) { toast("Escolha bancos diferentes."); return; }
      if (!(valor > 0)) { toast("Informe um valor maior que zero."); return; }
      const registro = { deBancoId: de, paraBancoId: para, valor, data, obs: document.getElementById("f_obs").value.trim() };
      DADOS.transferencias = DADOS.transferencias || [];
      if (t) Object.assign(t, registro); else DADOS.transferencias.push({ id: A.novoId(), ...registro });
      fecharModal();
      salvarEAtualizar(t ? "Transferência atualizada." : `${brl(valor)} transferido de ${F.nomeBanco(DADOS, de)} para ${F.nomeBanco(DADOS, para)}.`);
    };
    if (t) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      confirmarExclusao("Excluir esta transferência? Os saldos dos dois bancos voltam ao que eram antes.", () => {
        DADOS.transferencias = DADOS.transferencias.filter((x) => x.id !== t.id);
        salvarEAtualizar("Transferência excluída.");
      });
    };
  }

  // ---------------------------------------------------------------------
  // TRANSFERÊNCIAS AUTOMÁTICAS: todo mês, quando a condição escolhida
  // acontece, passa um valor de um banco para outro. Condições (cond):
  //  - "entrada": as entradas marcadas caem (o salário, por ex.);
  //  - "despesa": as despesas marcadas são pagas;
  //  - "dia": num dia fixo do mês;
  //  - "transf": depois que outra transferência automática acontece.
  // O valor de cada mês vem de um destes modos:
  //  - "fixo": um valor padrão;
  //  - "soma": a soma dos lançamentos da condição (Pagamento + Bonificação),
  //    acompanhando o valor que eles tiverem naquele mês — ou, na condição
  //    "transf", o mesmo valor da outra transferência;
  //  - "lanc": o valor de um lançamento (a despesa VR, por ex.) no mesmo
  //    mês ou no mês seguinte.
  // Em qualquer modo o valor de um mês pode ser trocado só naquele mês.
  // DADOS.transfAuto: [{ id, deBancoId, paraBancoId, cond, gatilhos: [{ id, desc }],
  //   dia, depoisDe, modo, valor, lanc: { id, desc, tipo, mesSeguinte }, desde: "AAAA-MM", obs,
  //   meses: { "AAAA-MM": { valor, pulado, visto } } }]
  // ---------------------------------------------------------------------
  const descIgual = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  const casaRef = (ref) => (r) => (ref.id && (r.id === ref.id || r.origemRecorrente === ref.id)) || descIgual(r.descricao, ref.desc);
  // a primeira versão guardava uma só entrada (entradaId/entradaDesc)
  const gatilhosDe = (regra) => regra.gatilhos || (regra.entradaId || regra.entradaDesc ? [{ id: regra.entradaId, desc: regra.entradaDesc }] : []);
  const modoDe = (regra) => regra.modo || "fixo";
  const nomesGatilhos = (regra) => gatilhosDe(regra).map((g) => g.desc || "o lançamento").join(" + ") || "o lançamento";
  // regras antigas, sem condição, eram todas "quando cair uma entrada"
  const condDe = (regra) => regra.cond || "entrada";
  const rotuloTransfAuto = (regra) => (regra.obs ? regra.obs + " · " : "") + F.nomeBanco(DADOS, regra.deBancoId) + " → " + F.nomeBanco(DADOS, regra.paraBancoId);
  function textoCond(regra) {
    const c = condDe(regra);
    if (c === "dia") return "Todo dia " + (regra.dia || "?");
    if (c === "transf") { const o = achar(DADOS.transfAuto || [], regra.depoisDe); return "Depois de " + (o ? rotuloTransfAuto(o) : "outra transferência (excluída)"); }
    return (c === "despesa" ? "Quando pagar " : "Quando cair ") + nomesGatilhos(regra);
  }

  // séries recorrentes (uma por descrição), para escolher na janela
  function seriesRecorrentes(lista) {
    const vistas = new Set();
    return lista.filter((e) => freqDe(e) !== FREQUENCIAS[0] && !e.origemRecorrente)
      .filter((e) => { const k = String(e.descricao || "").trim().toLowerCase(); if (!k || vistas.has(k)) return false; vistas.add(k); return true; });
  }
  const entradasGatilho = (d) => seriesRecorrentes(d.entradas);
  const despesasGatilho = (d) => seriesRecorrentes([...d.despesas, ...(d.contasPagar || [])]);
  const lancamentosValor = (d) => [...entradasGatilho(d).map((e) => ({ reg: e, tipo: "entrada" })),
    ...seriesRecorrentes([...d.despesas, ...(d.contasPagar || [])]).map((x) => ({ reg: x, tipo: "despesa" }))];

  // o lançamento num mês: { data, recebida (paga), valor } ou null
  function ocorrenciaNoMes(d, ref, mes, tipo) {
    const casa = casaRef(ref), achados = [];
    const doMes = (dt) => String(dt || "").slice(0, 7) === mes;
    if (tipo === "despesa") {
      d.despesas.filter((x) => doMes(x.data) && casa(x)).forEach((x) => achados.push({ data: x.data, recebida: true, valor: Number(x.valor || 0) }));
      const contasDoMes = (d.contasPagar || []).filter((c) => doMes(c.vencimento));
      contasDoMes.filter(casa).forEach((c) => achados.push({ data: c.vencimento, recebida: c.status === "Pago", valor: Number(c.valor || 0) }));
      const rep = (reg, data) => { if (casa(reg)) achados.push({ data, recebida: mesQuitado(reg, mes), valor: valorDoMes(reg, mes) }); return null; };
      repeticoesPrevistas(d.despesas, mes, rep, contasDoMes);
      repeticoesPrevistas((d.contasPagar || []).map((c) => ({ ...c, data: c.vencimento })), mes, rep, []);
    } else {
      d.entradas.filter((e) => doMes(e.data) && casa(e)).forEach((e) => achados.push({ data: e.data, recebida: !e.previsto, valor: Number(e.valor || 0) }));
      repeticoesPrevistas(d.entradas, mes, (reg, data) => { if (casa(reg)) achados.push({ data, recebida: mesQuitado(reg, mes), valor: valorDoMes(reg, mes) }); return null; });
    }
    achados.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    return achados.find((a) => a.recebida) || achados[0] || null;
  }
  // a condição da regra no mês: { data, recebida (já aconteceu), soma } ou null.
  // Entradas/despesas: acontece quando alguma já caiu (foi paga), na data da
  // última; soma = o que já caiu (ou tudo, se nada caiu).
  function gatilhoDoMes(d, regra, mes, prof) {
    const c = condDe(regra);
    if (c === "dia") {
      const [a, m] = mes.split("-").map(Number);
      const dia = Math.min(Math.max(1, Number(regra.dia) || 1), new Date(a, m, 0).getDate());
      const data = `${mes}-${String(dia).padStart(2, "0")}`;
      return { data, recebida: data <= hojeISO(), soma: 0 };
    }
    if (c === "transf") {
      // acompanha a outra regra (com limite, para uma cadeia que volte nela mesma)
      const o = (d.transfAuto || []).find((x) => x.id === regra.depoisDe);
      if (!o || o === regra || (prof || 0) > 8 || mes < (o.desde || mes) || ((o.meses || {})[mes] || {}).pulado) return null;
      const g = gatilhoDoMes(d, o, mes, (prof || 0) + 1);
      return g ? { data: g.data, recebida: g.recebida, soma: valorTransfAuto(d, o, mes, g) } : null;
    }
    const ocs = gatilhosDe(regra).map((g) => ocorrenciaNoMes(d, g, mes, c === "despesa" ? "despesa" : "entrada")).filter(Boolean);
    if (!ocs.length) return null;
    const caidas = ocs.filter((o) => o.recebida), base = caidas.length ? caidas : ocs;
    const datas = base.map((o) => String(o.data)).sort();
    return { data: caidas.length ? datas[datas.length - 1] : datas[0], recebida: !!caidas.length, soma: base.reduce((t, o) => t + o.valor, 0) };
  }
  // valor calculado pelo modo da regra (sem a troca manual do mês)
  function valorAutoTransf(d, regra, mes, g) {
    const modo = modoDe(regra);
    if (modo === "soma") return g ? Math.round(g.soma * 100) / 100 : 0;
    if (modo === "lanc" && regra.lanc) {
      const o = ocorrenciaNoMes(d, regra.lanc, regra.lanc.mesSeguinte ? proximoMes(mes) : mes, regra.lanc.tipo);
      if (o) return o.valor;
    }
    return Number(regra.valor || 0);
  }
  function valorTransfAuto(d, regra, mes, g) {
    const m = (regra.meses || {})[mes] || {};
    return m.valor !== undefined ? Number(m.valor) : valorAutoTransf(d, regra, mes, g === undefined ? gatilhoDoMes(d, regra, mes) : g);
  }
  // cada mês de cada regra, do início até dois meses à frente — ou até o mês
  // "ate", para mostrar as previstas de qualquer período, como as recorrências
  // (os meses pulados vêm com valor zero); recebida = a entrada já caiu, então mexe no saldo
  function ocorrenciasTransfAuto(d, ateMes) {
    const padrao = proximoMes(proximoMes(F.mesAtual()));
    const saida = [], ate = ateMes && ateMes > padrao ? ateMes : padrao;
    (d.transfAuto || []).forEach((regra) => {
      for (let mes = regra.desde || F.mesAtual(), n = 0; mes <= ate && n < 240; mes = proximoMes(mes), n++) {
        const g = gatilhoDoMes(d, regra, mes);
        const pulado = !!((regra.meses || {})[mes] || {}).pulado;
        if (g) saida.push({ regra, mes, data: g.data, recebida: g.recebida, pulado, valor: pulado ? 0 : valorTransfAuto(d, regra, mes, g) });
      }
    });
    return saida;
  }
  // as duas pontas de cada transferência automática (sai de um, entra no outro)
  function movimentosTransfAuto(d, recebidas, ateMes) {
    const saida = [];
    ocorrenciasTransfAuto(d, ateMes).filter((o) => o.recebida === recebidas && o.valor > 0).forEach((o) => {
      const auto = { id: o.regra.id, mes: o.mes }, obs = o.regra.obs ? " · " + o.regra.obs : "";
      saida.push({ bancoId: o.regra.deBancoId, valor: -o.valor, data: o.data, transferencia: true, auto, descricao: "Transferência", sub: "Para · " + F.nomeBanco(d, o.regra.paraBancoId) + obs });
      saida.push({ bancoId: o.regra.paraBancoId, valor: o.valor, data: o.data, transferencia: true, auto, descricao: "Transferência", sub: "De · " + F.nomeBanco(d, o.regra.deBancoId) + obs });
    });
    return saida;
  }

  // "Começa em": o mês atual, ou o próximo se a condição deste mês já aconteceu
  function inicioSugerido(regra) {
    const mes = F.mesAtual();
    const g = regra.cond ? gatilhoDoMes(DADOS, regra, mes) : null;
    return g && g.recebida ? proximoMes(mes) : mes;
  }
  const textoModo = (regra) => {
    const modo = modoDe(regra);
    if (modo === "soma") return condDe(regra) === "transf" ? "o mesmo valor" : "soma de " + nomesGatilhos(regra);
    if (modo === "lanc" && regra.lanc) return "valor de " + regra.lanc.desc + (regra.lanc.mesSeguinte ? " (mês seguinte)" : "");
    return "valor fixo";
  };

  // criar ou editar a regra: a condição é escolhida na hora, sem nada marcado
  function abrirModalTransfAuto(id, inicial) {
    const r = id ? achar(DADOS.transfAuto || [], id) : null;
    const v = r || inicial || {};
    const cond = r ? condDe(r) : "";
    const entradas = entradasGatilho(DADOS), despesas = despesasGatilho(DADOS);
    const outras = (DADOS.transfAuto || []).filter((x) => x !== r);
    const marcados = r ? gatilhosDe(r) : [];
    const marcado = (e) => marcados.some((g) => casaRef(g)(e));
    const modo = r ? modoDe(r) : v.modo || "fixo", lancs = lancamentosValor(DADOS);
    const lancAtual = v.lanc ? lancs.find((l) => l.tipo === v.lanc.tipo && casaRef(v.lanc)(l.reg)) : null;
    const nomeLanc = (l) => `${l.tipo === "entrada" ? "Entrada" : "Despesa"}: ${esc(l.reg.descricao || l.reg.categoria || "")}${l.reg.bancoId ? " · " + esc(F.nomeBanco(DADOS, l.reg.bancoId)) : ""}`;
    const caixas = (lista, classe, vazio) => lista.length ? lista.map((e) => `
        <label class="chk-linha"><input type="checkbox" class="${classe}" value="${e.id}"${cond && marcado(e) ? " checked" : ""}> ${esc(e.descricao || e.categoria || "")}${e.bancoId ? ` <span class="dim">· ${esc(F.nomeBanco(DADOS, e.bancoId))}</span>` : ""}</label>`).join("")
      : `<div class="ajuda">${vazio}</div>`;
    const opc = (valor, texto, atual) => `<option value="${valor}"${valor === atual ? " selected" : ""}>${texto}</option>`;
    const ultimos = r ? ocorrenciasTransfAuto(DADOS).filter((o) => o.regra === r).slice(-6).reverse() : [];
    abrirModal(`
      <h3>${r ? "Editar transferência automática" : "Transferir entre bancos"}</h3>
      ${r ? "" : campoTipoTransf(true)}
      <div class="campo"><label for="f_cond">Condição</label><select id="f_cond">
        ${r ? "" : opc("", "Escolha a condição…", cond)}
        ${opc("entrada", "Quando cair uma entrada", cond)}
        ${opc("despesa", "Quando pagar uma despesa", cond)}
        ${opc("dia", "Num dia fixo do mês", cond)}
        ${opc("transf", "Depois de outra transferência automática", cond)}
      </select></div>
      <div class="campo bloco-cond" data-cond="entrada"><label>Entradas</label>${caixas(entradas, "f_gat", "Nenhuma entrada recorrente cadastrada em Entradas.")}</div>
      <div class="campo bloco-cond" data-cond="despesa"><label>Despesas</label>${caixas(despesas, "f_gatDesp", "Nenhuma despesa recorrente cadastrada em Despesas.")}</div>
      <div class="campo bloco-cond" data-cond="dia"><label for="f_dia">Dia do mês</label><input id="f_dia" type="number" min="1" max="31" inputmode="numeric" value="${esc(String(v.dia || ""))}" placeholder="1 a 31"><div class="ajuda">Em meses mais curtos, vale o último dia.</div></div>
      <div class="campo bloco-cond" data-cond="transf"><label for="f_depois">Transferência</label>${outras.length
        ? `<select id="f_depois">${outras.map((x) => opc(x.id, esc(rotuloTransfAuto(x)), v.depoisDe || "")).join("")}</select>`
        : `<div class="ajuda">Crie antes outra transferência automática.</div>`}</div>
      <div class="par">
        <div class="campo"><label for="f_de">De</label><select id="f_de">${opcoesBancos(DADOS.bancos, v.deBancoId || "", true)}</select></div>
        <div class="campo"><label for="f_para">Para</label><select id="f_para">${opcoesBancos(DADOS.bancos, v.paraBancoId || "", true)}</select></div>
      </div>
      <div class="campo"><label for="f_modo">Valor</label><select id="f_modo">
        ${opc("fixo", "Valor fixo", modo)}
        <option value="soma"${modo === "soma" ? " selected" : ""} id="opcSoma">Soma</option>
        ${opc("lanc", "Valor de um lançamento (VR, VT…)", modo)}
      </select></div>
      <div class="par" id="blocoLanc">
        <div class="campo"><label for="f_lanc">Lançamento</label><select id="f_lanc">${lancs.map((l, i) => `<option value="${i}"${l === lancAtual ? " selected" : ""}>${nomeLanc(l)}</option>`).join("")}</select></div>
        <div class="campo"><label for="f_lancMes">Do mês</label><select id="f_lancMes">
          <option value="0"${v.lanc && !v.lanc.mesSeguinte ? " selected" : ""}>O mesmo da condição</option>
          <option value="1"${v.lanc && v.lanc.mesSeguinte ? " selected" : ""}>O mês seguinte</option>
        </select></div>
      </div>
      <div class="par">
        <div class="campo" id="blocoValor"><label for="f_valor" id="rotValor">Valor padrão</label>${campoMoeda("f_valor", v.valor || "")}</div>
        <div class="campo"><label for="f_desde">Começa em</label><input id="f_desde" type="month" value="${r ? r.desde : F.mesAtual()}"></div>
      </div>
      <div class="campo"><label for="f_obs">Observação</label><input id="f_obs" value="${esc(v.obs || "")}" placeholder="Opcional (VR, VT…)"><div class="ajuda" id="ajudaModo"></div></div>
      ${ultimos.length ? `<div class="campo"><label>Meses</label>${ultimos.map((o) => `
        <div class="kv kv-editavel" data-transf-auto="${r.id}" data-mes="${o.mes}" title="Mudar o valor deste mês">
          <span class="dim">${fmtMesRotulo(o.mes)} · ${o.pulado ? "não transferido" : o.recebida ? fmtDataCurta(o.data) : "prevista"}</span><b>${brl(o.valor)}</b>
        </div>`).join("")}</div>` : ""}
      <div class="modal-acoes">${r ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}<button class="btn primario salvar" id="btnSalvar">Salvar</button></div>`);
    const $ = (sel) => document.getElementById(sel);
    const selCond = $("f_cond"), selModo = $("f_modo");
    // a regra como está na janela agora (para a sugestão de "Começa em" e para salvar)
    const lerGatilhos = () => {
      const c = selCond.value;
      if (c !== "entrada" && c !== "despesa") return [];
      const lista = c === "entrada" ? DADOS.entradas : [...DADOS.despesas, ...(DADOS.contasPagar || [])];
      return [...document.querySelectorAll(`#modal .${c === "entrada" ? "f_gat" : "f_gatDesp"}:checked`)]
        .map((x) => lista.find((e) => e.id === x.value)).filter(Boolean).map((e) => ({ id: e.id, desc: e.descricao }));
    };
    const lerRegra = () => ({ cond: selCond.value, gatilhos: lerGatilhos(), dia: Number($("f_dia").value) || 0, depoisDe: $("f_depois") ? $("f_depois").value : "" });
    const sugerirInicio = () => { if (!r) $("f_desde").value = inicioSugerido(lerRegra()); };
    const ajustar = () => {
      const c = selCond.value, m = selModo.value;
      document.querySelectorAll("#modal .bloco-cond").forEach((b) => { b.style.display = b.dataset.cond === c ? "" : "none"; });
      const opcSoma = $("opcSoma");
      opcSoma.textContent = c === "despesa" ? "Soma das despesas marcadas" : c === "transf" ? "O mesmo valor da outra transferência" : "Soma das entradas marcadas";
      opcSoma.disabled = c === "dia" || !c;
      if (opcSoma.disabled && m === "soma") selModo.value = "fixo";
      const m2 = selModo.value;
      $("blocoLanc").style.display = m2 === "lanc" ? "" : "none";
      $("blocoValor").style.display = m2 === "soma" ? "none" : "";
      $("rotValor").textContent = m2 === "lanc" ? "Valor se o lançamento faltar" : "Valor padrão";
      const quando = { entrada: "Quando as entradas marcadas forem recebidas", despesa: "Quando as despesas marcadas forem pagas",
        dia: "No dia escolhido de cada mês", transf: "Quando a outra transferência acontecer" }[c];
      $("ajudaModo").textContent = (m2 === "soma" ? (c === "transf" ? "O valor de cada mês é o mesmo da outra transferência. " : "O valor de cada mês é a soma dos lançamentos marcados, com o valor que você editar neles. ")
        : m2 === "lanc" ? "O valor de cada mês é o do lançamento escolhido, com o valor que você editar nele. " : "")
        + (quando ? quando + ", o valor sai do primeiro banco e entra no segundo, na mesma data. " : "")
        + "Dá para mudar o valor de um mês clicando na transferência.";
    };
    selCond.onchange = () => {
      ajustar(); sugerirInicio();
      // depois de outra transferência: o dinheiro sai de onde a outra entrou
      if (selCond.value === "transf" && $("f_depois")) { const o = achar(outras, $("f_depois").value); if (o) $("f_de").value = o.paraBancoId; }
    };
    selModo.onchange = ajustar; ajustar();
    ligarSaldoOrigem(null, true);   // automática: o "depois" só vale no dia em que acontecer
    if (!r) ligarTipoTransf((dados) => abrirModalTransferencia(null, dados));
    if (!r) {
      document.querySelectorAll("#modal .f_gat, #modal .f_gatDesp").forEach((c) => { c.onchange = () => {
        const gs = lerGatilhos(), lista = [...DADOS.entradas, ...DADOS.despesas, ...(DADOS.contasPagar || [])];
        const e = gs.length ? lista.find((x) => x.id === gs[0].id) : null;
        if (e && e.bancoId) { $("f_de").value = e.bancoId; $("f_de").dispatchEvent(new Event("change")); }
        sugerirInicio();
      }; });
      $("f_dia").oninput = sugerirInicio;
      if ($("f_depois")) $("f_depois").onchange = () => { const o = achar(outras, $("f_depois").value); if (o) { $("f_de").value = o.paraBancoId; $("f_de").dispatchEvent(new Event("change")); } sugerirInicio(); };
    }
    document.querySelectorAll("#modal [data-transf-auto]").forEach((el) => { el.onclick = () => abrirModalTransfAutoMes(el.dataset.transfAuto, el.dataset.mes); });
    $("btnSalvar").onclick = () => {
      const de = $("f_de").value, para = $("f_para").value, cnd = lerRegra();
      const valor = numIn($("f_valor").value), modoNovo = selModo.value;
      const l = lancs[Number($("f_lanc").value)];
      if (!cnd.cond) { toast("Escolha a condição."); return; }
      if (cnd.cond === "entrada" && !cnd.gatilhos.length) { toast("Marque ao menos uma entrada."); return; }
      if (cnd.cond === "despesa" && !cnd.gatilhos.length) { toast("Marque ao menos uma despesa."); return; }
      if (cnd.cond === "dia" && !(cnd.dia >= 1 && cnd.dia <= 31)) { toast("Informe um dia de 1 a 31."); return; }
      if (cnd.cond === "transf" && !cnd.depoisDe) { toast("Escolha a outra transferência."); return; }
      if (!de || !para) { toast("Escolha os dois bancos."); return; }
      if (de === para) { toast("Escolha bancos diferentes."); return; }
      if (modoNovo === "fixo" && !(valor > 0)) { toast("Informe um valor maior que zero."); return; }
      if (modoNovo === "lanc" && !l) { toast("Escolha o lançamento."); return; }
      const registro = { deBancoId: de, paraBancoId: para, cond: cnd.cond, gatilhos: cnd.gatilhos,
        dia: cnd.cond === "dia" ? cnd.dia : undefined, depoisDe: cnd.cond === "transf" ? cnd.depoisDe : undefined,
        modo: modoNovo, valor: modoNovo === "soma" ? 0 : valor,
        lanc: modoNovo === "lanc" ? { id: l.reg.id, desc: l.reg.descricao, tipo: l.tipo, mesSeguinte: $("f_lancMes").value === "1" } : undefined,
        desde: $("f_desde").value || F.mesAtual(), obs: $("f_obs").value.trim(), entradaId: undefined, entradaDesc: undefined };
      DADOS.transfAuto = DADOS.transfAuto || [];
      if (r) Object.assign(r, registro); else DADOS.transfAuto.push({ id: A.novoId(), ...registro, meses: {} });
      fecharModal();
      salvarEAtualizar(r ? "Transferência automática atualizada." : `${textoCond(registro)}: ${textoModo(registro)} vai de ${F.nomeBanco(DADOS, de)} para ${F.nomeBanco(DADOS, para)}.`);
    };
    if (r) $("btnExcluir").onclick = () => {
      const dependentes = (DADOS.transfAuto || []).filter((x) => condDe(x) === "transf" && x.depoisDe === r.id);
      fecharModal();
      confirmarExclusao("Excluir esta transferência automática? As transferências que ela já fez também saem dos saldos." +
        (dependentes.length ? ` ${dependentes.length === 1 ? "Uma transferência depende" : dependentes.length + " transferências dependem"} dela e deixa${dependentes.length === 1 ? "" : "m"} de acontecer.` : ""), () => {
        DADOS.transfAuto = DADOS.transfAuto.filter((x) => x.id !== r.id);
        salvarEAtualizar("Transferência automática excluída.");
      });
    };
  }

  // ---------------------------------------------------------------------
  // AJUSTE DE SALDO: o usuário informa quanto o banco tem de verdade (o
  // saldo do Inter depois de receber o VR/VT, por ex.) e a diferença para o
  // saldo calculado vira um lançamento "Ajuste de saldo" — não conta como
  // receita nem despesa. Fica no botão "Alterar" do quadro do banco.
  // DADOS.ajustesSaldo: [{ id, bancoId, data, valor, saldoInformado }]
  // ---------------------------------------------------------------------
  // opts.depois: chamado ao terminar (salvando ou não)
  // campo "Lançamento" do ajuste: as séries de despesas e entradas (uma por descrição)
  function campoLancAjuste(atual) {
    const lancs = [...seriesRecorrentes([...DADOS.despesas, ...(DADOS.contasPagar || [])]), ...seriesRecorrentes(DADOS.entradas)];
    return `<div class="campo"><label for="f_lanc">Lançamento</label><select id="f_lanc"><option value="">Nenhum</option>${lancs.map((r) => `<option value="${esc(r.id)}"${r.id === atual ? " selected" : ""}>${esc(r.descricao || r.categoria || "")}${r.bancoId ? " · " + esc(F.nomeBanco(DADOS, r.bancoId)) : ""}</option>`).join("")}</select><div class="ajuda">O ajuste aparece no extrato como este lançamento (descrição, ícone e recorrência), com o valor do ajuste.</div></div>`;
  }
  function informarSaldoBanco(bancoId, opts) {
    opts = opts || {};
    const b = F.listaBancosComSaldo(DADOS).find((x) => x.id === bancoId);
    if (!b) return;
    abrirModal(`
      <h3>Saldo Atual no ${esc(b.nome)}</h3>
      <p class="campo ajuda" style="margin:0 0 14px">Pelo app, o ${esc(b.nome)} tem <b>${brlSinal(b.saldoAtual)}</b>. Quanto tem nele agora?</p>
      <div class="campo"><label for="f_saldoReal">Saldo Atual</label>${campoMoeda("f_saldoReal", b.saldoAtual)}<div class="ajuda">Diferença entra no extrato como "Ajuste", sem contar como receita ou despesa.</div></div>
      ${campoLancAjuste("")}
      <div class="modal-acoes"><button class="btn" id="btnPularSaldo">Cancelar</button><button class="btn primario salvar" id="btnSalvarSaldo">Salvar</button></div>`);
    const terminar = () => { fecharModal(); if (opts.depois) opts.depois(); };
    document.getElementById("btnPularSaldo").onclick = terminar;
    document.getElementById("btnSalvarSaldo").onclick = () => {
      const real = Math.round(numIn(document.getElementById("f_saldoReal").value) * 100) / 100;
      const diff = Math.round((real - b.saldoAtual) * 100) / 100;
      if (diff) {
        DADOS.ajustesSaldo = DADOS.ajustesSaldo || [];
        DADOS.ajustesSaldo.push({ id: A.novoId(), bancoId, data: hojeISO(), valor: diff, saldoInformado: real, lancId: document.getElementById("f_lanc").value || undefined });
      }
      salvarEAtualizar(diff ? `Saldo do ${b.nome} ajustado para ${brlSinal(real)}.` : `O saldo do ${b.nome} já estava certo.`);
      terminar();
    };
  }
  // ver um ajuste de saldo: dá para editar a descrição e o texto de baixo
  function abrirModalAjusteSaldo(id) {
    const a = achar(DADOS.ajustesSaldo || [], id);
    if (!a) return;
    const nome = F.nomeBanco(DADOS, a.bancoId);
    abrirModal(`
      <h3>Ajuste de saldo · ${esc(nome)}</h3>
      <div class="kv"><span class="dim">Data</span><b>${fmtDataCurta(a.data)}</b></div>
      <div class="kv"><span class="dim">Saldo informado</span><b>${brlSinal(Number(a.saldoInformado || 0))}</b></div>
      <div class="kv" style="margin-bottom:12px"><span class="dim">Diferença</span><b class="${corSinal(a.valor)}">${brlSinal(Number(a.valor || 0))}</b></div>
      <div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="${esc(a.descricao || "")}" placeholder="Ajuste"></div>
      <div class="campo"><label for="f_detalhe">Detalhe</label><input id="f_detalhe" value="${esc(a.detalhe || "")}" placeholder="Saldo"></div>
      ${campoLancAjuste(a.lancId)}
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvarAj">Salvar</button><button class="btn perigo" id="btnExcluir">Excluir</button><button class="btn" id="btnFecharAj">Fechar</button></div>`);
    // o foco automático no primeiro campo abriria o teclado no iPad
    if (document.activeElement && document.activeElement.blur) setTimeout(() => document.activeElement.blur(), 40);
    document.getElementById("btnFecharAj").onclick = () => { fecharModal(); explicarBanco(a.bancoId); };
    document.getElementById("btnSalvarAj").onclick = () => {
      // vazio volta ao texto padrão
      a.descricao = document.getElementById("f_desc").value.trim() || undefined;
      a.detalhe = document.getElementById("f_detalhe").value.trim() || undefined;
      a.lancId = document.getElementById("f_lanc").value || undefined;
      fecharModal();
      salvarEAtualizar("Ajuste de saldo atualizado.");
      explicarBanco(a.bancoId);
    };
    document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      confirmarExclusao("Excluir este ajuste? O saldo do banco volta ao calculado pelo app.", () => {
        DADOS.ajustesSaldo = DADOS.ajustesSaldo.filter((x) => x.id !== a.id);
        salvarEAtualizar("Ajuste de saldo excluído.");
      });
    };
  }

  // valor de um mês: confirmar, mudar só este mês ou pular o mês
  function abrirModalTransfAutoMes(id, mes) {
    const r = achar(DADOS.transfAuto || [], id);
    if (!r) return;
    const g = gatilhoDoMes(DADOS, r, mes);
    const ajuste = (r.meses || {})[mes] || {};
    const auto = valorAutoTransf(DADOS, r, mes, g);
    r.meses = r.meses || {};
    r.meses[mes] = { ...ajuste, visto: true };
    A.salvarDados(DADOS, true);
    const quando = esc(textoCond(r));
    abrirModal(`
      <h3>Transferência automática · ${fmtMesRotulo(mes)}</h3>
      <p class="campo ajuda" style="margin:0 0 14px">${quando}: ${g && g.recebida ? `aconteceu em ${fmtDataCurta(g.data)}.` : g ? `prevista para ${fmtDataCurta(g.data)}.` : "não acontece neste mês."}
        Quanto vai de <b>${esc(F.nomeBanco(DADOS, r.deBancoId))}</b> para <b>${esc(F.nomeBanco(DADOS, r.paraBancoId))}</b>${r.obs ? ` (${esc(r.obs)})` : ""}?</p>
      <div class="campo"><label for="f_valor">Valor deste mês</label>${campoMoeda("f_valor", valorTransfAuto(DADOS, r, mes, g))}<div class="ajuda">${modoDe(r) === "fixo" ? "Valor padrão" : "Valor automático (" + esc(textoModo(r)) + ")"}: ${brl(auto)}. Um valor diferente vale só para ${fmtMesRotulo(mes)}.</div></div>
      <div class="modal-acoes" style="flex-wrap:wrap">
        <button class="btn" id="btnRegra">Editar regra</button>
        <button class="btn perigo" id="btnPular">${ajuste.pulado ? "Voltar a transferir" : "Não transferir este mês"}</button>
        <button class="btn primario salvar" id="btnSalvar">Confirmar</button>
      </div>`);
    document.getElementById("btnSalvar").onclick = () => {
      const valor = Math.round(numIn(document.getElementById("f_valor").value) * 100) / 100;
      // igual ao automático: não prende o valor, para seguir as edições das entradas
      const novo = { ...r.meses[mes], pulado: false };
      if (valor === Math.round(auto * 100) / 100) delete novo.valor; else novo.valor = valor;
      r.meses[mes] = novo;
      fecharModal();
      salvarEAtualizar(`${brl(valor)} de ${F.nomeBanco(DADOS, r.deBancoId)} para ${F.nomeBanco(DADOS, r.paraBancoId)} em ${fmtMesRotulo(mes)}.`);
    };
    document.getElementById("btnPular").onclick = () => {
      r.meses[mes] = { ...r.meses[mes], pulado: !ajuste.pulado };
      fecharModal();
      salvarEAtualizar(ajuste.pulado ? "A transferência deste mês voltou." : `Sem transferência automática em ${fmtMesRotulo(mes)}.`);
    };
    document.getElementById("btnRegra").onclick = () => abrirModalTransfAuto(r.id);
  }

  // Quando as entradas de um mês acabam de cair (marcadas como recebidas),
  // abre a janela para conferir o valor de uma transferência de valor fixo —
  // uma vez por mês. As de soma ou de lançamento já seguem os valores editados.
  // (sobre um painel aberto só quando o status foi trocado nele: forcar)
  function conferirTransfAutoNovas(forcar) {
    if (!(DADOS.transfAuto || []).length || (forcar !== true && document.getElementById("modal").classList.contains("on"))) return;
    const nova = ocorrenciasTransfAuto(DADOS).find((o) => o.recebida && !o.pulado && modoDe(o.regra) === "fixo" && !((o.regra.meses || {})[o.mes] || {}).visto);
    if (nova) abrirModalTransfAutoMes(nova.regra.id, nova.mes);
  }

  function abrirModalBanco(id) {
    const b = id ? achar(DADOS.bancos, id) : null;
    abrirModal(`
      <h3>${b ? "Editar banco" : "Novo banco"}</h3>
      <div class="par">
        <div class="campo"><label for="f_nome">Nome do banco</label>${campoBanco("f_nome", b ? b.nome : "", "Selecione o banco…")}</div>
        <div class="campo"><label for="f_tipo">Tipo de conta</label><select id="f_tipo">${opcoes(TIPOS_CONTA_BANCO, b ? b.tipo : TIPOS_CONTA_BANCO[0])}</select></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_ag">Agência</label><input id="f_ag" value="${b ? esc(b.agencia || "") : ""}" placeholder="0001"></div>
        <div class="campo"><label for="f_cc">Conta</label><input id="f_cc" value="${b ? esc(b.conta || "") : ""}" placeholder="12345-6"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_saldo">Saldo Inicial</label>${campoMoeda("f_saldo", b ? b.saldoInicial : "")}</div>
        <div class="campo"><label for="f_cor">Cor de identificação</label><input id="f_cor" type="color" value="${b ? b.cor || "#3FC1E0" : "#3FC1E0"}"></div>
      </div>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Opcional">${b ? esc(b.obs || "") : ""}</textarea></div>
      <p class="campo ajuda">O saldo atual é sempre calculado a partir do saldo inicial mais entradas e menos despesas deste banco — por isso não é um campo editável.</p>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${b ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    document.getElementById("btnSalvar").onclick = () => {
      const nome = lerCampoBanco("f_nome");
      if (!nome) { toast("Escolha o banco (ou selecione \"Outro…\" e digite o nome)."); return; }
      const registro = {
        id: b ? b.id : A.novoId(),
        nome, tipo: document.getElementById("f_tipo").value,
        agencia: document.getElementById("f_ag").value.trim(),
        conta: document.getElementById("f_cc").value.trim(),
        saldoInicial: numIn(document.getElementById("f_saldo").value),
        cor: document.getElementById("f_cor").value,
        obs: document.getElementById("f_obs").value.trim()
      };
      if (b) Object.assign(b, registro); else DADOS.bancos.push(registro);
      fecharModal();
      salvarEAtualizar(b ? "Banco atualizado." : "Banco cadastrado.");
    };
    if (b) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      confirmarExclusao(`Excluir o banco "${b.nome}"? As entradas e despesas ligadas a ele continuarão no histórico.`, () => {
        DADOS.bancos = DADOS.bancos.filter((x) => x.id !== b.id);
        salvarEAtualizar("Banco excluído.");
      });
    };
  }

  // =========================================================================
  // ENTRADAS
  // =========================================================================

  // ---------------------------------------------------------------------
  // Lançamentos recorrentes: além do registro original, o sistema mostra
  // as repetições previstas nos meses seguintes. São itens calculados na
  // hora (marcados como "Prevista"), não gravados no banco de dados.
  // ---------------------------------------------------------------------
  const PASSO_DIAS = { "Semanal": 7, "Quinzenal": 14 };

  // Cada lançamento recorrente pode ter ajustes por mês guardados nele
  // mesmo (valor diferente, marcado como pago). Assim não é preciso criar
  // um registro novo para mudar o valor de um único mês.
  function ajusteDoMes(reg, mes) { return (reg && reg.meses && reg.meses[mes]) || {}; }
  function valorDoMes(reg, mes) {
    const a = ajusteDoMes(reg, mes);
    if (a.valor !== undefined) return Number(a.valor);
    // série "Variável": mudar o valor do lançamento original não altera os outros meses
    if (reg.valorRepeticao !== undefined) return Number(reg.valorRepeticao);
    return Number(reg.valor || 0);
  }

  // Ao salvar o lançamento original de uma série: mantém os ajustes por mês
  // e, se for "Variável", guarda o valor antigo como base dos outros meses —
  // assim só o lançamento editado muda. Numa série "Fixa", todos acompanham.
  function manterSerie(antigo, registro) {
    if (!antigo) return registro;
    if (antigo.meses) registro.meses = antigo.meses;
    if (antigo.reancoragens) registro.reancoragens = antigo.reancoragens;
    if (registro.recorrente && registro.tipo === "Variável") {
      const baseAnterior = antigo.valorRepeticao !== undefined ? Number(antigo.valorRepeticao) : Number(antigo.valor || 0);
      registro.valorRepeticao = baseAnterior;
    } else {
      registro.valorRepeticao = undefined;
    }
    return registro;
  }
  function mesQuitado(reg, mes) { return !!ajusteDoMes(reg, mes).pago; }
  // banco de onde saiu o pagamento daquele mês (pode ser outro que o da série)
  function bancoDoMes(reg, mes) { return ajusteDoMes(reg, mes).bancoId || reg.bancoId; }
  function gravarAjuste(reg, mes, dados) {
    reg.meses = reg.meses || {};
    reg.meses[mes] = Object.assign({}, reg.meses[mes], dados);
  }

  // Quando o usuário muda a data de uma repetição, a nova data passa a
  // valer para aquele mês e para todos os seguintes: guardamos uma
  // "reancoragem" {desde: mês, data: nova data} no próprio lançamento.
  function registrarReancoragem(reg, mes, novaData) {
    if (!reg || !novaData) return;
    reg.reancoragens = (reg.reancoragens || []).filter((r) => r.desde < mes);   // o novo ajuste substitui os posteriores
    reg.reancoragens.push({ desde: mes, data: novaData });
  }

  function ocorrenciasNoMes(reg, mes) {
    const freq = freqDe(reg);
    if (freq === FREQ_PERS) {
      if (reg.origemRecorrente || !dataReg(reg)) return [];         // é o lançamento de um mês, não a origem
      const inicio = mesReg(reg);
      if (mes <= inicio) return [];                                  // começa no mês seguinte ao da origem
      if (reg.ateMes && mes > reg.ateMes) return [];                 // série encerrada ("este e os próximos")
      if (reg.pulados && reg.pulados[mes]) return [];                // mês excluído ("somente este mês")
      const regra = regraDe(reg);
      const [a0, m0] = inicio.split("-").map(Number), [a1, m1] = mes.split("-").map(Number);
      if (((a1 - a0) * 12 + (m1 - m0)) % Math.max(1, Number(regra.intervalo) || 1) !== 0) return [];
      if (numeroParcela(regra, mes) > Number(regra.parcelas)) return [];   // já passou da última parcela
      return [dataDoMesRegra(regra, mes)];
    }
    if (freq === FREQUENCIAS[0] || !reg.data) return [];
    // âncora vigente: a data original ou a última reancoragem que já vale neste mês
    let ancora = reg.data, desde = null;
    (reg.reancoragens || []).forEach((r) => { if (r.desde <= mes && (!desde || r.desde >= desde)) { desde = r.desde; ancora = r.data; } });
    const inicio = new Date(ancora + "T00:00:00");
    const [ano, m] = mes.split("-").map(Number);
    const primeiro = new Date(ano, m - 1, 1), ultimo = new Date(ano, m, 0);
    if (!desde && ultimo < inicio) return [];
    const datas = [];

    if (freq === "Mensal" || freq === "Anual") {
      const passoMeses = freq === "Mensal" ? 1 : 12;
      if (desde) {
        // a partir do mês da mudança, usa o novo dia (e, no anual, o novo mês)
        const [dAno, dMes] = desde.split("-").map(Number);
        const diffD = (ano - dAno) * 12 + (m - dMes);
        if (diffD < 0 || diffD % passoMeses !== 0) return [];
        const dia = Math.min(inicio.getDate(), ultimo.getDate());
        return [new Date(ano, m - 1, dia).toISOString().slice(0, 10)];
      }
      const diff = (ano - inicio.getFullYear()) * 12 + (m - 1 - inicio.getMonth());
      if (diff <= 0 || diff % passoMeses !== 0) return [];
      const dia = Math.min(inicio.getDate(), ultimo.getDate());
      datas.push(new Date(ano, m - 1, dia));
    } else {
      // semanal/quinzenal: salta direto para a primeira repetição do mês,
      // em vez de percorrer semana a semana desde o começo
      const passo = PASSO_DIAS[freq] || 7;
      const diasAte = Math.floor((primeiro - inicio) / 86400000);
      const saltos = desde ? Math.max(0, Math.ceil(diasAte / passo)) : Math.max(1, Math.ceil(diasAte / passo));
      const dt = new Date(inicio);
      dt.setDate(dt.getDate() + saltos * passo);
      while (dt <= ultimo) {
        if (dt >= primeiro) datas.push(new Date(dt));
        dt.setDate(dt.getDate() + passo);
      }
    }
    return datas.map((dt) => dt.toISOString().slice(0, 10));
  }



  // Total de despesas realmente PAGAS num mês: junta as despesas lançadas,
  // as contas a pagar já quitadas com vencimento nesse mês, e as repetições
  // (recorrências) confirmadas naquele mês em particular — a mesma conta
  // que a guia Despesas usa no "Pagas:" do cabeçalho. A antiga
  // F.totalDespesasMes só somava a tabela de despesas, sem contas pagas.

  // Total de TODAS as despesas do mês, independente do status (pagas,
  // previstas ou atrasadas) — usado no card e no painel "Despesas do mês".
  function totalDespesasTodasMes(d, mes) {
    let total = d.despesas.filter((x) => String(x.data || "").slice(0, 7) === mes)
      .reduce((t, x) => t + Number(x.valor || 0), 0);
    total += (d.contasPagar || []).filter((c) => String(c.vencimento || "").slice(0, 7) === mes)
      .reduce((t, c) => t + Number(c.valor || 0), 0);
    const contasComoLista = (d.contasPagar || []).map((c) => ({ ...c, data: c.vencimento }));
    const contasDoMes = (d.contasPagar || []).filter((c) => String(c.vencimento || "").slice(0, 7) === mes);
    const repDespesas = repeticoesPrevistas(d.despesas, mes, (reg, data) => ({
      valor: valorDoMes(reg, data.slice(0, 7))
    }), contasDoMes);
    const repContas = repeticoesPrevistas(contasComoLista, mes, (reg, data) => ({
      valor: valorDoMes(reg, data.slice(0, 7))
    }), []);
    total += [...repDespesas, ...repContas].reduce((t, x) => t + Number(x.valor || 0), 0);
    return total;
  }

  // Total de TODAS as entradas do mês, independente do status (recebidas
  // ou previstas) — usado no card e no painel "Receitas do mês".
  function totalEntradasTodasMes(d, mes) {
    const reais = d.entradas.filter((e) => String(e.data || "").slice(0, 7) === mes)
      .reduce((t, e) => t + Number(e.valor || 0), 0);
    const recorrentes = repeticoesPrevistas(d.entradas, mes, (reg, data) => ({
      valor: valorDoMes(reg, data.slice(0, 7))
    })).reduce((t, e) => t + Number(e.valor || 0), 0);
    return reais + recorrentes;
  }


  // Contas a pagar ainda não quitadas (pendentes ou atrasadas) com
  // vencimento dentro de um mês — usado no quadro "Contas Pendentes".
  function contasPendentesMes(d, mes) {
    return F.listaContasPagarComStatus(d)
      .filter((c) => c.statusReal !== "Pago" && String(c.vencimento || "").slice(0, 7) === mes)
      .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
  }


  // Lista, ordenada por data, de todas as despesas/contas do mês (pagas,
  // previstas ou atrasadas) — usada no painel "Despesas do mês".
  // selo colorido do status, no mesmo padrão das guias Entradas e Despesas

  // Troca o status de um lançamento — a mesma regra usada nas guias
  // Entradas e Despesas e nos painéis "Receitas/Despesas do mês".
  function alternarStatusLancamento(acao, id, mes, bancoEscolhido, destino) {
    // marcar despesa como paga: pergunta antes de qual banco sai o dinheiro
    if (!bancoEscolhido && DADOS.bancos.length) {
      const regQ = acao === "quitar-mes" ? achar(DADOS.despesas, id) : (acao === "quitar-mes-conta" || acao === "alternar-pago") ? achar(DADOS.contasPagar, id) : null;
      const vaiPagar = regQ && !regQ.cartaoId && (acao === "alternar-pago" ? regQ.status !== "Pago" : !mesQuitado(regQ, mes));
      if (vaiPagar) {
        escolherBancoPagamento(regQ, mes, (bancoId, destinoId) => alternarStatusLancamento(acao, id, mes, bancoId, destinoId));
        return true;
      }
    }
    if (acao === "quitar-mes" || acao === "quitar-mes-conta") {
      const reg = achar(acao === "quitar-mes" ? DADOS.despesas : DADOS.contasPagar, id);
      if (reg) {
        const pagar = !mesQuitado(reg, mes);
        gravarAjuste(reg, mes, { pago: pagar, bancoId: bancoEscolhido || ajusteDoMes(reg, mes).bancoId, ...(pagar ? { destinoBancoId: destino || undefined } : {}) });
        salvarEAtualizar(pagar ? "Marcada como paga neste mês." + (destino ? ` O valor foi para o ${F.nomeBanco(DADOS, destino)}.` : "") : "Marcada como prevista.");
      }
    } else if (acao === "quitar-mes-entrada") {
      const regE = achar(DADOS.entradas, id);
      if (regE) { gravarAjuste(regE, mes, { pago: !mesQuitado(regE, mes) }); salvarEAtualizar(mesQuitado(regE, mes) ? "Marcada como paga neste mês." : "Marcada como prevista."); setTimeout(() => conferirTransfAutoNovas(true), 0); }
    } else if (acao === "alternar-prevista-entrada") {
      const ent4 = achar(DADOS.entradas, id);
      if (ent4) { ent4.previsto = !ent4.previsto; salvarEAtualizar(ent4.previsto ? "Marcada como prevista." : "Marcada como paga."); setTimeout(() => conferirTransfAutoNovas(true), 0); }
    } else if (acao === "tornar-pendente") {
      const dsp = achar(DADOS.despesas, id);
      if (dsp) {
        DADOS.despesas = DADOS.despesas.filter((r) => r.id !== dsp.id);
        // mantém banco e os dados da série (parcelas), só troca a data por vencimento
        const { data: dataDsp, cartaoId, ...resto } = dsp;
        DADOS.contasPagar.push({ ...resto, vencimento: dataDsp, status: "Pendente", obs: dsp.obs || "" });
        salvarEAtualizar("Marcada como prevista.");
      }
    } else if (acao === "alternar-pago") {
      const c = achar(DADOS.contasPagar, id);
      if (c) {
        c.status = c.status === "Pago" ? "Pendente" : "Pago";
        if (bancoEscolhido) { c.bancoId = bancoEscolhido; c.destinoBancoId = destino || undefined; }
        salvarEAtualizar(c.status === "Pago" ? "Marcada como paga." + (c.destinoBancoId ? ` O valor foi para o ${F.nomeBanco(DADOS, c.destinoBancoId)}.` : "") : "Marcada como prevista.");
      }
    }
  }


  // Janela "Pagar com qual banco?": lista os bancos com o saldo de hoje e
  // como fica depois do pagamento; já vem marcado o banco da despesa.
  function escolherBancoPagamento(reg, mes, aoEscolher) {
    const valor = mes ? valorDoMes(reg, mes) : Number(reg.valor || 0);
    const atual = mes ? bancoDoMes(reg, mes) : reg.bancoId;
    const bancos = bancosNaOrdem(F.listaBancosComSaldo(DADOS));
    let escolhido = bancos.some((b) => b.id === atual) ? atual : bancos[0].id;
    const destinoAtual = (mes && ajusteDoMes(reg, mes).destinoBancoId) || reg.destinoBancoId || "";
    const reabrir = painelReabrir;
    abrirModal(`
      <h3>Pagar com qual banco?</h3>
      <div class="dim" style="margin-bottom:10px">${descEmoji(reg, "Despesa")}${seloParcela(reg.id, mes ? mes + "-01" : reg.vencimento)} · <b class="down">−${brl(valor)}</b></div>
      <div id="listaBancosPg">${bancos.map((b) => `
        <button type="button" class="kv kv-editavel opcao-banco-pg" data-banco="${b.id}" style="align-items:center;width:100%;text-align:left;cursor:pointer;border-radius:8px">
          <span style="display:flex;align-items:center;gap:8px">${marcaBanco(b.nome, 18)}${esc(b.nome)}</span>
          <b class="pg-valores"><span class="dim pg-antes">${brlSinal(b.saldoAtual)}</span><span class="dim pg-seta">→</span><span class="pg-depois ${b.saldoAtual - valor < 0 ? "down" : "up"}">${brlSinal(b.saldoAtual - valor)}</span></b>
        </button>`).join("")}</div>
      ${bancos.length > 1 && destinoAtual ? `<div class="campo" style="margin-top:12px"><label for="f_destinoPg">Enviar</label><select id="f_destinoPg">
        <option value="">Nenhum</option>
        ${bancos.map((b) => `<option value="${b.id}"${b.id === destinoAtual ? " selected" : ""}>${esc(b.nome)}</option>`).join("")}
      </select><div class="ajuda">O valor será debitado do banco selecionado e transferido para o banco escolhido.</div></div>` : ""}
      <div class="modal-acoes"><button class="btn primario salvar" id="btnConfirmarPg">Pagar</button><button class="btn" id="btnCancelarPg">Cancelar</button></div>`);
    // o foco automático no "Enviar" abriria a lista no iPad
    if (document.getElementById("f_destinoPg")) setTimeout(() => document.getElementById("f_destinoPg").blur(), 40);
    // "antes → depois" em colunas: cada coluna com a largura do maior valor
    ["pg-antes", "pg-depois"].forEach((cls) => {
      const els = [...document.querySelectorAll("#modal ." + cls)];
      const larg = Math.max(0, ...els.map((e) => e.getBoundingClientRect().width));
      if (larg) els.forEach((e) => { e.style.minWidth = Math.ceil(larg) + "px"; });
    });
    const marcar = () => document.querySelectorAll(".opcao-banco-pg").forEach((el) => {
      const sel = el.dataset.banco === escolhido;
      el.style.outline = sel ? "2px solid var(--cy)" : "none";
      el.style.background = sel ? "rgba(63,193,224,.08)" : "transparent";
    });
    marcar();
    document.querySelectorAll(".opcao-banco-pg").forEach((el) => { el.onclick = () => { escolhido = el.dataset.banco; marcar(); }; });
    document.getElementById("btnCancelarPg").onclick = () => { fecharModal(); if (reabrir) reabrir(); };
    document.getElementById("btnConfirmarPg").onclick = () => {
      const selDest = document.getElementById("f_destinoPg");
      const destino = selDest && selDest.value !== escolhido ? selDest.value : "";
      fecharModal(); painelReabrir = reabrir; aoEscolher(escolhido, destino); if (reabrir) reabrir();
    };
  }

  // Troca o banco de um lançamento para o próximo da lista — a mesma regra
  // das guias Entradas e Despesas e dos painéis "Receitas/Despesas do mês".
  function alternarBancoLancamento(acao, id) {
    if (!DADOS.bancos.length) return;
    const ids = DADOS.bancos.map((bb) => bb.id);
    if (acao === "trocar-banco-entrada") {
      const ent2 = achar(DADOS.entradas, id);
      if (ent2) { const prox = ids[(ids.indexOf(ent2.bancoId) + 1) % ids.length]; ent2.bancoId = prox; salvarEAtualizar(`Agora em ${F.nomeBanco(DADOS, prox)}.`); }
    } else if (acao === "trocar-banco-conta") {
      const cta = achar(DADOS.contasPagar, id);
      if (cta) { const prox = ids[(ids.indexOf(cta.bancoId) + 1) % ids.length]; cta.bancoId = prox; salvarEAtualizar(`Agora pelo ${F.nomeBanco(DADOS, prox)}.`); }
    } else if (acao === "trocar-banco") {
      const dsp2 = achar(DADOS.despesas, id);
      if (dsp2) {
        const atual = dsp2.cartaoId ? (achar(DADOS.cartoes, dsp2.cartaoId) || {}).bancoId : dsp2.bancoId;
        const prox = ids[(ids.indexOf(atual) + 1) % ids.length];
        dsp2.bancoId = prox; dsp2.cartaoId = "";
        salvarEAtualizar(`Agora pago com ${F.nomeBanco(DADOS, prox)}.`);
      }
    }
  }

  // Abre a edição de um lançamento — mesma regra do clique na linha das guias
  // (numa repetição, abre só aquele mês).
  function abrirEdicaoLancamento(acao, id, data) {
    if (acao === "editar-meta") abrirModalMeta(id);
    else if (acao === "editar-entrada") abrirModalEntrada(id);
    else if (acao === "editar-previsao-entrada") abrirModalEntrada(id, null, { origemId: id, data });
    else if (acao === "editar-despesa") abrirModalDespesa(id);
    else if (acao === "editar-conta") abrirModalDespesa(id, "conta");
    else if (acao === "editar-previsao") abrirModalDespesa(id, "despesa", { origemId: id, data });
    else if (acao === "editar-previsao-conta") abrirModalDespesa(id, "conta", { origemId: id, data });
  }

  // marca a linha do painel como clicável para abrir a edição
  // linha de um banco nos quadros de detalhe: clicar abre o quadro daquele banco
  function linhaBancoClicavel(id, html) {
    return html.replace('<div class="kv">', `<div class="kv kv-editavel" data-abrir-banco="${esc(id)}" title="Abrir o banco">`);
  }
  function linhaEditavel(item, html) {
    if (!item || !item.acaoEditar) return html;
    return html.replace('<div class="kv">', `<div class="kv kv-editavel" data-acao-editar="${item.acaoEditar}" data-id="${esc(item.id)}" data-data="${item.data || ""}" title="Abrir para editar">`);
  }

  // títulos das colunas nos painéis de lançamentos, no mesmo padrão das guias
  // última linha dos painéis: "Total · N lançamentos" e o valor, no padrão das linhas da lista
  // linha "Previsto" dos painéis: o que ainda não foi pago e por isso não entra no total
  function linhaPrevistoPainel(valor) {
    return `<div class="kv kv-previsto"><span class="dim">Previsto · ainda não entra no total</span><b><span class="col-valor dim">${valor}</span></b></div>`;
  }
  function linhaTotalPainel(qtd, valor, rotulo) {
    return `<div class="kv kv-total"><span class="dim">${esc(rotulo || "Total")} · ${esc(qtd)}</span><b><span class="col-valor">${valor}</span></b></div>`;
  }

  // resumo do mês ao lado do título das guias Entradas/Despesas, com ícone e na cor de cada status
  const ICONES_RESUMO = {
    pago: '<path d="M20 6 9 17l-5-5"/>',
    prevista: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    atrasado: '<path d="M12 3.5 2.8 19.5h18.4Z"/><path d="M12 10v4.2M12 17h.01"/>'
  };
  const STATUS_DO_RESUMO = { pago: "Pago", prevista: "Prevista", atrasado: "Atrasado" };
  function resumoPills(itens, acao, ativo) {
    // status com valor zero não aparece; clicar filtra a tabela por aquele status
    return `<span class="resumo-pills${ativo ? " com-filtro" : ""}">${itens.filter((it) => Math.abs(Number(it[3]) || 0) >= 0.005).map(([tipo, rotulo, valor]) =>
      `<button type="button" class="resumo-pill rp-${tipo}${ativo === STATUS_DO_RESUMO[tipo] ? " ativo" : ""}" data-acao="${acao}" data-status="${STATUS_DO_RESUMO[tipo]}" title="${ativo === STATUS_DO_RESUMO[tipo] ? "Mostrar todos os lançamentos" : "Mostrar só " + rotulo.toLowerCase()}"><span class="rp-ic"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONES_RESUMO[tipo]}</svg></span><span class="rp-txt"><small>${rotulo}</small><b>${valor}</b></span></button>`).join("")}</span>`;
  }

  function cabecalhoColunasPainel() {
    return `<div class="kv kv-cab"><span class="cab-desc"><span class="dp-data-col">Data</span>Descrição</span><b><span class="col-rep">Recorrência</span><span class="col-status">Status</span><span class="col-banco">Banco</span><span class="col-valor">Valor</span></b></div>`;
  }

  function bancoPainel(nome, item) {
    const n = nome && nome !== "—" ? nome : "";
    const miolo = n ? marcaBanco(n, 26) + `<span class="dim">${esc(n)}</span>` : '<span class="dim">—</span>';
    if (item && item.acaoBanco) {
      return `<button class="col-banco banco-painel-botao" data-acao-banco="${item.acaoBanco}" data-id="${esc(item.id)}" title="Clique para trocar o banco">${miolo}</button>`;
    }
    return `<span class="col-banco">${miolo}</span>`;
  }

  function seloStatusPainel(st, item) {
    const cls = st === "Atrasado" ? "selo-atrasado" : (st === "Prevista" ? "selo-prevista" : "selo-pago");
    if (item && item.acao) {
      return `<span class="col-status"><button class="selo-tag ${cls} selo-painel selo-botao" data-acao-status="${item.acao}" data-id="${esc(item.id)}"${item.mes ? ` data-mes="${item.mes}"` : ""} title="Clique para trocar o status">${esc(st)}</button></span>`;
    }
    return `<span class="col-status"><span class="selo-tag ${cls} selo-painel">${esc(st)}</span></span>`;
  }


  // Despesas (lançadas e programadas, qualquer status) de hoje até 30 dias à frente
  function despesasProximos30Dias(d) {
    const hoje = hojeISO();
    const lim = new Date(hoje + "T00:00:00"); lim.setDate(lim.getDate() + 30);
    const fim = lim.toISOString().slice(0, 10);
    const meses = [...new Set([hoje.slice(0, 7), fim.slice(0, 7)])];
    return meses.flatMap((m) => listaDespesasTodasMes(d, m))
      .filter((x) => (x.data || "") >= hoje && (x.data || "") <= fim)
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  }


  // Contas previstas (ainda não pagas) do mês que vem — usadas na Projeção de despesas
  function mesQueVem() { const [a, m] = F.mesAtual().split("-").map(Number); const d2 = new Date(a, m, 1); return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}`; }
  function nomeMesQueVem() { const t = new Date(mesQueVem() + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); }
  function despesasPrevistasMesQueVem(d) {
    return listaDespesasTodasMes(d, mesQueVem()).filter((x) => x.status !== "Pago")
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  }

  function pendentesDoMes(d, mes) {
    return listaDespesasTodasMes(d, mes).filter((x) => x.status !== "Pago");
  }

  function listaDespesasTodasMes(d, mes) {
    const lancadas = d.despesas.filter((x) => String(x.data || "").slice(0, 7) === mes)
      .map((x) => ({ descricao: x.descricao, emoji: x.emoji, categoria: x.categoria, valor: Number(x.valor || 0), data: x.data, status: "Pago", acao: "tornar-pendente", id: x.id, banco: bancoDoLancamento(d, x), acaoBanco: "trocar-banco", acaoEditar: "editar-despesa" }));
    const contasDoMes = (d.contasPagar || []).filter((c) => String(c.vencimento || "").slice(0, 7) === mes);
    const contasMapeadas = contasDoMes.map((c) => {
      const st = F.statusReal(c);
      return { descricao: c.descricao, emoji: c.emoji, categoria: c.categoria, valor: Number(c.valor || 0), data: c.vencimento, status: st === "Pendente" ? "Prevista" : st, acao: "alternar-pago", id: c.id, banco: c.bancoId ? F.nomeBanco(d, c.bancoId) : "—", acaoBanco: "trocar-banco-conta", acaoEditar: "editar-conta" };
    });
    const contasComoLista = (d.contasPagar || []).map((c) => ({ ...c, data: c.vencimento }));
    const repDespesas = repeticoesPrevistas(d.despesas, mes, (reg, data) => ({
      descricao: reg.descricao, emoji: reg.emoji, categoria: reg.categoria, valor: valorDoMes(reg, data.slice(0, 7)), data,
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      acao: "quitar-mes", id: reg.id, mes: data.slice(0, 7), banco: bancoDoLancamento(d, { ...reg, bancoId: bancoDoMes(reg, data.slice(0, 7)) }), acaoBanco: "trocar-banco", acaoEditar: "editar-previsao"
    }), contasDoMes);
    const repContas = repeticoesPrevistas(contasComoLista, mes, (reg, data) => ({
      descricao: reg.descricao, emoji: reg.emoji, categoria: reg.categoria, valor: valorDoMes(reg, data.slice(0, 7)), data,
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      acao: "quitar-mes-conta", id: reg.id, mes: data.slice(0, 7), banco: bancoDoMes(reg, data.slice(0, 7)) ? F.nomeBanco(d, bancoDoMes(reg, data.slice(0, 7))) : "—", acaoBanco: "trocar-banco-conta", acaoEditar: "editar-previsao-conta"
    }), []);
    return [...lancadas, ...contasMapeadas, ...repDespesas, ...repContas]
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  }

  // Lista, ordenada por data, de todas as entradas do mês (recebidas ou
  // previstas) — usada no painel "Receitas do mês".
  function listaEntradasTodasMes(d, mes) {
    const reais = d.entradas.filter((e) => String(e.data || "").slice(0, 7) === mes)
      .map((e) => ({ descricao: e.descricao, emoji: e.emoji, categoria: e.categoria, valor: Number(e.valor || 0), data: e.data, status: e.previsto ? "Prevista" : "Pago", acao: "alternar-prevista-entrada", id: e.id, banco: F.nomeBanco(d, e.bancoId), acaoBanco: "trocar-banco-entrada", acaoEditar: "editar-entrada" }));
    const recorrentes = repeticoesPrevistas(d.entradas, mes, (reg, data) => ({
      descricao: reg.descricao, emoji: reg.emoji, categoria: reg.categoria, valor: valorDoMes(reg, data.slice(0, 7)), data,
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      acao: "quitar-mes-entrada", id: reg.id, mes: data.slice(0, 7), banco: F.nomeBanco(d, reg.bancoId), acaoBanco: "trocar-banco-entrada", acaoEditar: "editar-previsao-entrada"
    }));
    return [...reais, ...recorrentes].sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  }

  // Despesas PAGAS do mês com a mesma regra da guia Despesas: lançadas,
  // contas a pagar marcadas como Pago e repetições quitadas no mês.
  // (F.maiorDespesa/F.despesasPorCategoria/F.serieMensal só olhavam as
  // despesas lançadas e deixavam de fora, por ex., a fatura do cartão.)
  function despesasPagasMes(d, mes) {
    return listaDespesasTodasMes(d, mes || F.mesAtual()).filter((x) => x.status === "Pago");
  }
  function maiorDespesaPaga(d, mes) {
    const lista = despesasPagasMes(d, mes);
    return lista.length ? lista.reduce((a, b) => (Number(b.valor) > Number(a.valor) ? b : a)) : null;
  }
  function despesasPorCategoriaPagas(d, mes) {
    const mapa = {};
    despesasPagasMes(d, mes).forEach((x) => { const c = x.categoria || "Outros"; mapa[c] = (mapa[c] || 0) + Number(x.valor || 0); });
    return Object.keys(mapa).map((c) => ({ categoria: c, valor: mapa[c] })).sort((a, b) => b.valor - a.valor);
  }
  // série dos últimos meses (gráficos) com receitas e despesas efetivas
  function serieMensalEfetiva(d, meses) {
    return F.serieMensal(d, meses).map((s) => ({ ...s, entradas: totalEntradasEfetivas(d, s.mes), despesas: totalDespesasPagasMes(d, s.mes) }));
  }

  function totalDespesasPagasMes(d, mes) {
    let total = d.despesas.filter((x) => String(x.data || "").slice(0, 7) === mes)
      .reduce((t, x) => t + Number(x.valor || 0), 0);
    total += (d.contasPagar || []).filter((c) => c.status === "Pago" && String(c.vencimento || "").slice(0, 7) === mes)
      .reduce((t, c) => t + Number(c.valor || 0), 0);
    const contasComoLista = (d.contasPagar || []).map((c) => ({ ...c, data: c.vencimento }));
    const contasDoMes = (d.contasPagar || []).filter((c) => String(c.vencimento || "").slice(0, 7) === mes);
    const repDespesas = repeticoesPrevistas(d.despesas, mes, (reg, data) => ({
      valor: valorDoMes(reg, data.slice(0, 7)), quitado: mesQuitado(reg, data.slice(0, 7))
    }), contasDoMes);
    const repContas = repeticoesPrevistas(contasComoLista, mes, (reg, data) => ({
      valor: valorDoMes(reg, data.slice(0, 7)), quitado: mesQuitado(reg, data.slice(0, 7))
    }), []);
    total += [...repDespesas, ...repContas].filter((x) => x.quitado).reduce((t, x) => t + Number(x.valor || 0), 0);
    return total;
  }

  function entradasEfetivasMes(d, mes) {
    const reais = d.entradas.filter((e) => String(e.data || "").slice(0, 7) === mes && !e.previsto);
    const recorrentes = repeticoesPrevistas(d.entradas, mes, (reg, data) => ({
      descricao: reg.descricao, valor: valorDoMes(reg, data.slice(0, 7)), quitado: mesQuitado(reg, data.slice(0, 7))
    })).filter((x) => x.quitado);
    return [...reais, ...recorrentes];
  }
  function totalEntradasEfetivas(d, mes) {
    return entradasEfetivasMes(d, mes).reduce((t, e) => t + Number(e.valor || 0), 0);
  }

  function repeticoesPrevistas(lista, mes, monta, existentes) {
    const saida = [];
    const noMes = [...lista.filter((r) => String(r.data || "").slice(0, 7) === mes), ...(existentes || [])];
    // assinatura usada para não repetir o que já foi lançado de verdade
    const chave = (r) => `${String(r.categoria || "").toLowerCase()}|${Number(r.valor || 0)}`;
    const jaNoMes = new Set(noMes.map(chave));
    const nomes = new Set(noMes.map((r) => String(r.descricao || "").toLowerCase()));
    // registros que já foram criados a partir de uma recorrência neste mês
    const origens = new Set(noMes.map((r) => r.origemRecorrente).filter(Boolean));

    lista.forEach((reg) => {
      if (reg.origemRecorrente) return;                            // é a instância de um mês, não a origem
      if (String(reg.data || "").slice(0, 7) === mes) return;      // o próprio mês já tem o registro
      const raiz = reg.origemRecorrente || reg.id;
      if (origens.has(raiz)) return;                               // este mês já foi materializado
      if (jaNoMes.has(chave(reg)) || nomes.has(String(reg.descricao || "").toLowerCase())) return;
      const datas = ocorrenciasNoMes(reg, mes);
      if (!datas.length) return;
      datas.forEach((data) => saida.push(monta(reg, data)));
      jaNoMes.add(chave(reg));
      nomes.add(String(reg.descricao || "").toLowerCase());
    });
    return saida;
  }


  // Repetições de lançamentos recorrentes marcadas como pagas num mês: não
  // são registros próprios, então entram no saldo dos bancos por aqui (as
  // mesmas que as guias Entradas e Despesas mostram como "Pago"), junto com
  // as transferências automáticas já feitas.
  function movimentosRepeticoesPagas(d) {
    const meses = new Set();
    [d.entradas, d.despesas, d.contasPagar || []].forEach((l) => l.forEach((r) =>
      Object.keys(r.meses || {}).forEach((m) => { if (r.meses[m].pago) meses.add(m); })));
    const saida = [];
    // despesa paga cujo dinheiro foi para outro banco (VR/VT para o Inter):
    // o valor entra no banco de destino, como uma transferência
    const paraDestino = (reg, origem, destino, valor, data) => {
      if (destino && origem && destino !== origem && valor > 0) saida.push({ bancoId: destino, valor, data, transferencia: true, descricao: reg.descricao,
        emoji: reg.emoji, sub: "De · " + F.nomeBanco(d, origem), ref: { secao: "despesas", id: reg.id, data } });
    };
    const pagas = (reg, data, sinal) => {
      const m = data.slice(0, 7);
      if (bancoDoMes(reg, m) && !reg.cartaoId && mesQuitado(reg, m)) {
        saida.push({ bancoId: bancoDoMes(reg, m), valor: sinal * valorDoMes(reg, m), data, descricao: reg.descricao,
          emoji: reg.emoji, categoria: reg.categoria, ref: { secao: sinal > 0 ? "entradas" : "despesas", id: reg.id, data } });
        if (sinal < 0) paraDestino(reg, bancoDoMes(reg, m), ajusteDoMes(reg, m).destinoBancoId, valorDoMes(reg, m), data);
      }
      return null;
    };
    (d.contasPagar || []).filter((c) => c.status === "Pago" && !c.cartaoId)
      .forEach((c) => paraDestino(c, c.bancoId, c.destinoBancoId, Number(c.valor || 0), c.vencimento));
    // despesa única lançada já paga (nas séries, o mês de origem não manda: o
    // destino delas vale a partir dos meses marcados como pagos)
    d.despesas.filter((x) => !x.cartaoId && freqDe(x) === FREQUENCIAS[0] && !x.origemRecorrente)
      .forEach((x) => paraDestino(x, x.bancoId, x.destinoBancoId, Number(x.valor || 0), x.data));
    meses.forEach((mes) => {
      repeticoesPrevistas(d.entradas, mes, (reg, data) => pagas(reg, data, 1));
      const contasDoMes = (d.contasPagar || []).filter((c) => String(c.vencimento || "").slice(0, 7) === mes)
        .map((c) => ({ descricao: c.descricao, categoria: c.categoria, valor: c.valor, data: c.vencimento, origemRecorrente: c.origemRecorrente }));
      repeticoesPrevistas(d.despesas, mes, (reg, data) => pagas(reg, data, -1), contasDoMes);
      repeticoesPrevistas((d.contasPagar || []).map((c) => ({ ...c, data: c.vencimento })), mes, (reg, data) => pagas(reg, data, -1), []);
    });
    // transferências automáticas dos meses em que a entrada já caiu
    return saida.concat(movimentosTransfAuto(d, true));
  }
  F.definirMovimentosExtras(movimentosRepeticoesPagas);

  // Saldo devedor das despesas parceladas (repetição Personalizar com
  // quantidade de parcelas): soma TODAS as parcelas ainda não pagas, também
  // as de meses que ainda não foram abertos. Diminui a cada parcela paga.
  function saldoDevedorParcelas(d) {
    let total = 0;
    const todos = [...d.despesas, ...(d.contasPagar || [])];
    const pago = (x) => d.despesas.includes(x) || x.status === "Pago";
    todos.filter((o) => ehPers(o) && !o.origemRecorrente && Number(regraDe(o).parcelas) > 0).forEach((orig) => {
      const regra = regraDe(orig);
      let mes = regra.primeiraParcela || mesReg(orig);
      for (let k = 0; k < Number(regra.parcelas); k++) {
        if (k) for (let i = 0; i < Math.max(1, Number(regra.intervalo) || 1); i++) mes = proximoMes(mes);
        if (mes === mesReg(orig)) { if (!pago(orig)) total += Number(orig.valor || 0); continue; }
        if (!ocorrenciasNoMes(orig, mes).length) continue;              // mês fora desta série (excluído ou de outra origem)
        const inst = todos.find((x) => x.origemRecorrente === orig.id && mesReg(x) === mes);
        if (inst) { if (!pago(inst)) total += Number(inst.valor || 0); }
        else if (!mesQuitado(orig, mes)) total += valorDoMes(orig, mes);
      }
    });
    return total;
  }
  F.definirDividasParceladas(saldoDevedorParcelas);

  // ---- séries "Personalizar": funcionam para entradas e para despesas ----
  // entradas ficam em DADOS.entradas; despesas em DADOS.despesas (pagas) ou
  // DADOS.contasPagar (previstas) — os meses criados sozinhos entram como contas previstas
  const COLECOES_SERIE = { entrada: ["entradas"], despesa: ["despesas", "contasPagar"] };
  const registrosSerie = (tipo) => COLECOES_SERIE[tipo].flatMap((c) => DADOS[c]);
  const removerRegistro = (tipo, id) => COLECOES_SERIE[tipo].forEach((c) => { DADOS[c] = DADOS[c].filter((x) => x.id !== id); });
  const definirData = (x, iso) => { if (x.vencimento !== undefined) x.vencimento = iso; else x.data = iso; };
  const CAMPOS_SERIE = ["descricao", "emoji", "categoria", "bancoId", "tipo", "obs", "valor"];

  // cria (sem gravar) o lançamento de um mês da série
  function novaOcorrencia(tipo, orig, mes) {
    const base = {
      id: A.novoId(), origemRecorrente: orig.id, descricao: orig.descricao, emoji: orig.emoji, categoria: orig.categoria,
      bancoId: orig.bancoId, tipo: orig.tipo, obs: orig.obs || "", valor: valorDoMes(orig, mes),
      recorrencia: FREQ_PERS, regraRep: regraDe(orig), recorrente: false
    };
    const data = dataDoMesRegra(regraDe(orig), mes);
    if (tipo === "entrada") { const o = { ...base, data, previsto: !mesQuitado(orig, mes) }; DADOS.entradas.push(o); return o; }
    const o = { ...base, vencimento: data, status: mesQuitado(orig, mes) ? "Pago" : "Pendente", formaPagamento: orig.formaPagamento || "" };
    DADOS.contasPagar.push(o); return o;
  }

  // Cria de verdade o lançamento do mês de cada série "Personalizar" que ainda
  // não tenha sido criado, com os dados da origem e status Prevista.
  function materializarPers(tipo, mes) {
    let criados = 0;
    const todos = registrosSerie(tipo);
    todos.filter((r) => ehPers(r) && !r.origemRecorrente).forEach((orig) => {
      if (!ocorrenciasNoMes(orig, mes).length) return;
      if (registrosSerie(tipo).some((x) => x.origemRecorrente === orig.id && mesReg(x) === mes)) return;
      novaOcorrencia(tipo, orig, mes); criados++;
    });
    // parcelas que sobraram depois de diminuir a quantidade (só as ainda não pagas)
    registrosSerie(tipo).filter((x) => x.origemRecorrente && ehPers(x) && x.status !== "Pago" && (tipo !== "entrada" || x.previsto))
      .filter((x) => { const r = regraDe(x); return numeroParcela(r, mesReg(x)) > Number(r.parcelas); })
      .forEach((x) => { removerRegistro(tipo, x.id); criados++; });
    if (criados) { A.salvarDados(DADOS, true); agendarEnvioSync(); }   // grava sem redesenhar a tela em laço
    return criados;
  }

  // Pergunta o alcance de uma alteração ou exclusão numa série "Personalizar"
  function escolherAlcance(titulo, aoEscolher) {
    abrirModal(`
      <h3>${esc(titulo)}</h3>
      <p class="campo ajuda" style="margin:0 0 14px">Este lançamento faz parte de uma repetição personalizada.</p>
      <div class="modal-acoes" style="flex-wrap:wrap">
        <button class="btn primario" id="btnAlcanceMes">Somente este mês</button>
        <button class="btn primario" id="btnAlcanceProximos">Este e os próximos</button>
        <button class="btn" id="btnAlcanceCancelar">Cancelar</button>
      </div>`);
    document.getElementById("btnAlcanceMes").onclick = () => { fecharModal(); aoEscolher("mes"); };
    document.getElementById("btnAlcanceProximos").onclick = () => { fecharModal(); aoEscolher("proximos"); };
    document.getElementById("btnAlcanceCancelar").onclick = fecharModal;
  }
  const proximoMes = (mes) => { const [a, m] = mes.split("-").map(Number); const d2 = new Date(a, m, 1); return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}`; };
  const mesAnterior = (mes) => { const [a, m] = mes.split("-").map(Number); const d2 = new Date(a, m - 2, 1); return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}`; };
  // próximo mês em que a série acontece (respeita o intervalo e os meses excluídos)
  function proximaOcorrencia(orig, depoisDe) {
    let mes = depoisDe;
    for (let i = 0; i < 60; i++) { mes = proximoMes(mes); if (ocorrenciasNoMes({ ...orig, data: dataReg(orig), vencimento: undefined }, mes).length) return mes; if (orig.ateMes && mes > orig.ateMes) return null; }
    return null;
  }

  // A origem deixa de valer num mês: a próxima ocorrência vira a nova origem da série
  function passarOrigemAdiante(tipo, orig) {
    const prox = proximaOcorrencia(orig, mesReg(orig));
    if (!prox) return null;
    let nova = registrosSerie(tipo).find((x) => x.origemRecorrente === orig.id && mesReg(x) === prox);
    if (!nova) nova = novaOcorrencia(tipo, orig, prox);
    delete nova.origemRecorrente;
    Object.assign(nova, { recorrencia: FREQ_PERS, recorrente: true, regraRep: regraDe(orig), meses: orig.meses, pulados: orig.pulados, ateMes: orig.ateMes, valorRepeticao: orig.valorRepeticao });
    registrosSerie(tipo).forEach((x) => { if (x.origemRecorrente === orig.id) x.origemRecorrente = nova.id; });
    return nova;
  }

  function salvarPers(tipo, e, registro, alcance) {
    const mes = mesReg(e);
    const novos = {}; CAMPOS_SERIE.forEach((k) => { if (registro[k] !== undefined) novos[k] = registro[k]; });
    const regraNova = registro.regraRep ? { ...registro.regraRep } : null;
    if (e.origemRecorrente) {
      const orig = registrosSerie(tipo).find((x) => x.id === e.origemRecorrente);
      Object.assign(e, novos);                                          // o mês editado sempre muda
      if (alcance === "proximos" && orig) {
        // encerra a série antiga no mês anterior e começa uma nova a partir deste
        orig.ateMes = mesAnterior(mes);
        delete e.origemRecorrente;
        Object.assign(e, { recorrencia: FREQ_PERS, recorrente: true, regraRep: regraNova || regraDe(orig), meses: {}, pulados: {}, valorRepeticao: undefined });
        if (regraNova) definirData(e, dataDoMesRegra(regraNova, mes));
        registrosSerie(tipo).forEach((x) => {
          if (x.origemRecorrente === orig.id && mesReg(x) > mes) {
            x.origemRecorrente = e.id; Object.assign(x, novos);
            if (regraNova) { x.regraRep = { ...regraNova }; definirData(x, dataDoMesRegra(regraNova, mesReg(x))); }
          }
        });
      }
    } else if (alcance === "mes") {
      // só o mês da origem muda: a série continua com os dados antigos a partir da próxima ocorrência
      const nova = passarOrigemAdiante(tipo, e);
      Object.assign(e, novos, { meses: undefined, pulados: undefined, ateMes: undefined, valorRepeticao: undefined });
      if (nova) Object.assign(e, { origemRecorrente: nova.id, recorrencia: FREQ_PERS, recorrente: false });
      else Object.assign(e, { recorrencia: FREQUENCIAS[0], recorrente: false });
    } else {
      Object.assign(e, novos);
      if (regraNova) { e.regraRep = { ...regraNova }; definirData(e, dataDoMesRegra(regraNova, mes)); }
      registrosSerie(tipo).forEach((x) => {
        if (x.origemRecorrente === e.id && mesReg(x) > mes) {
          Object.assign(x, novos);
          if (regraNova) { x.regraRep = { ...regraNova }; definirData(x, dataDoMesRegra(regraNova, mesReg(x))); }
        }
      });
    }
  }

  function excluirPers(tipo, e, alcance) {
    const mes = mesReg(e);
    if (e.origemRecorrente) {
      const orig = registrosSerie(tipo).find((x) => x.id === e.origemRecorrente);
      if (orig) {
        if (alcance === "mes") orig.pulados = { ...(orig.pulados || {}), [mes]: true };
        else {
          orig.ateMes = mesAnterior(mes);
          registrosSerie(tipo).filter((x) => x.origemRecorrente === orig.id && mesReg(x) > mes).forEach((x) => removerRegistro(tipo, x.id));
        }
      }
      removerRegistro(tipo, e.id);
    } else if (alcance === "mes") {
      passarOrigemAdiante(tipo, e);
      removerRegistro(tipo, e.id);
    } else {
      registrosSerie(tipo).filter((x) => x.origemRecorrente === e.id).forEach((x) => removerRegistro(tipo, x.id));
      removerRegistro(tipo, e.id);
    }
  }

  // Campos da repetição "Personalizar" dentro dos formulários
  function htmlPersonalizar(regra) {
    const r = { ...REGRA_PADRAO, ...(regra || {}) };
    const op = (lista, atual) => lista.map(([v, t]) => `<option value="${v}"${String(v) === String(atual) ? " selected" : ""}>${t}</option>`).join("");
    return `<div class="bloco-personalizar" id="blocoPers" style="display:none">
        <div class="par par-3">
          <div class="campo"><label for="p_tipo">Regra da data</label><select id="p_tipo">${op([["diaUtil", "Nº dia útil do mês"], ["ultimoDiaUtil", "Último dia útil do mês"], ["diaFixo", "Dia fixo do mês"]], r.tipo)}</select></div>
          <div class="campo" id="p_campoN"><label for="p_n" id="p_rotuloN">Qual dia útil</label><input id="p_n" type="number" min="1" max="31" value="${r.n}"></div>
          <div class="campo" id="p_campoAjuste"><label for="p_ajuste" title="Se cair em fim de semana ou feriado">Fim de semana/feriado</label><select id="p_ajuste">${op([["proximo", "Próximo dia útil"], ["anterior", "Dia útil anterior"], ["manter", "Manter a data"]], r.ajuste)}</select></div>
        </div>
        <div class="par">
          <div class="campo"><label for="p_intervalo">Repetir</label><select id="p_intervalo">${op([[1, "Todo mês"], [2, "A cada 2 meses"], [3, "A cada 3 meses"], [6, "A cada 6 meses"], [12, "Uma vez por ano"]], r.intervalo)}</select></div>
          <div class="campo"><label for="p_parcelas">Parcelas</label><input id="p_parcelas" type="number" min="0" max="600" inputmode="numeric" placeholder="Ilimitado" title="Deixe vazio para repetir sem data para acabar" value="${Number(r.parcelas) > 0 ? r.parcelas : ""}" data-primeira="${esc(r.primeiraParcela || "")}"></div>
        </div>
        <div class="ajuda" id="p_previa"></div>
      </div>`;
  }
  // liga os campos: mostra o bloco, calcula a data (somente leitura) e a prévia das próximas datas
  function ligarPersonalizar(mesDoForm, ajudaRepetição) {
    const campoRec = document.getElementById("f_rec"), campoData = document.getElementById("f_data");
    const bloco = document.getElementById("blocoPers");
    const ajudaRec = document.getElementById("ajudaRec");
    const textoPadrao = ajudaRec ? ajudaRec.textContent : "";
    const ler = () => ({
      tipo: document.getElementById("p_tipo").value,
      n: Math.max(1, Math.min(31, Number(document.getElementById("p_n").value) || 1)),
      ajuste: document.getElementById("p_ajuste").value,
      intervalo: Number(document.getElementById("p_intervalo").value) || 1,
      // a parcela 1 é o mês do lançamento (ou a já gravada, ao editar uma parcela)
      ...((Number(document.getElementById("p_parcelas").value) || 0) > 0 ? {
        parcelas: Math.min(600, Math.floor(Number(document.getElementById("p_parcelas").value))),
        primeiraParcela: document.getElementById("p_parcelas").dataset.primeira || mesDoForm
      } : {})
    });
    const atualizar = () => {
      const ativo = campoRec.value === FREQ_PERS;
      bloco.style.display = ativo ? "" : "none";
      campoData.readOnly = ativo;
      campoData.classList.toggle("somente-leitura", ativo);
      // na repetição Personalizada, a ajuda da Repetição explica que cada mês é criado sozinho
      if (ajudaRec) { ajudaRec.textContent = ativo ? ajudaRepetição : textoPadrao; ajudaRec.style.display = ajudaRec.textContent ? "" : "none"; }
      if (!ativo) return;
      const r = ler();
      document.getElementById("p_campoN").style.display = r.tipo === "ultimoDiaUtil" ? "none" : "";
      document.getElementById("p_rotuloN").textContent = r.tipo === "diaFixo" ? "Dia do mês" : "Qual dia útil";
      document.getElementById("p_campoAjuste").style.display = r.tipo === "diaFixo" ? "" : "none";
      campoData.value = dataDoMesRegra(r, mesDoForm);
      const prox = []; let mes = mesDoForm;
      for (let i = 0; i < 4; i++) { const [a, m] = mes.split("-").map(Number); const c = F.calcularDataRegra(a, m, r); prox.push(fmtData(c.data) + (c.alertaSabado ? " ⚠️" : "")); for (let k = 0; k < r.intervalo; k++) mes = proximoMes(mes); }
      let previa = "Próximas datas: " + prox.join(" · ");
      if (r.parcelas) {
        // data da última parcela
        let mesFim = r.primeiraParcela;
        for (let k = 0; k < (r.parcelas - 1) * r.intervalo; k++) mesFim = proximoMes(mesFim);
        const [af, mf] = mesFim.split("-").map(Number);
        const nAtual = numeroParcela(r, mesDoForm);
        previa = `Parcela ${nAtual} de ${r.parcelas} · última em ${fmtData(F.calcularDataRegra(af, mf, r).data)}. ` + previa;
      }
      document.getElementById("p_previa").textContent = previa;
    };
    ["change", "input"].forEach((ev) => bloco.addEventListener(ev, atualizar));
    campoRec.addEventListener("change", atualizar);
    atualizar();
    return () => (campoRec.value === FREQ_PERS ? ler() : null);
  }

  // Lista de emojis do formulário: o escolhido fica marcado; sem escolha,
  // acompanha a categoria selecionada
  // Campo compacto: um botão com o emoji escolhido (ao lado de outro campo,
  // aoLado) que abre, logo embaixo, a lista — os sugeridos (a lista do
  // formulário) e todos os emojis do Unicode por grupo (js/emojis.js), numa
  // caixa com barra de rolagem e abas que levam a cada grupo.
  function campoEmoji(lista, atual, aoLado) {
    const sugeridos = atual && lista.indexOf(atual) === -1 ? [atual, ...lista] : lista;
    const grupos = [{ nome: "Sugeridos", icone: "⭐", lista: sugeridos }, ...(window.EMOJIS_TODOS || [])];
    const botoes = (l) => l.map((em) => `<button type="button" class="opcao-emoji" data-emoji="${em}">${em}</button>`).join("");
    return `<div class="par par-emoji">
        <div class="campo campo-emoji"><label>Emoji</label><button type="button" class="emoji-atual" id="f_emoji_btn" title="Escolher emoji" aria-expanded="false"><span class="emoji-atual-ic">${atual || "🙂"}</span><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 5 5 5-5"/></svg></button></div>
        ${aoLado || ""}
      </div>
      <div class="emoji-painel" id="f_emoji_painel" hidden>
        <div class="emoji-abas">${grupos.map((g, i) => `<button type="button" class="emoji-aba" data-emoji-grupo="${i}" title="${esc(g.nome)}">${g.icone}</button>`).join("")}</div>
        <div class="seletor-emoji" id="f_emoji">${grupos.map((g, i) =>
          `<div class="emoji-grupo" data-emoji-grupo="${i}"><div class="emoji-titulo">${esc(g.nome)}</div><div class="emoji-grade">${botoes(g.lista)}</div></div>`).join("")}</div>
      </div>`;
  }
  // padrao: emoji sugerido quando nada foi escolhido; campoPadrao: campo que muda a sugestão
  function ligarEmoji(atual, padrao, campoPadrao) {
    const caixa = document.getElementById("f_emoji");
    const selCat = campoPadrao || document.getElementById("f_cat");
    const sugerido = padrao || (() => EMOJI_CATEGORIA[selCat.value]);
    let escolhido = atual || "";
    const painel = document.getElementById("f_emoji_painel"), botao = document.getElementById("f_emoji_btn");
    const abrir = (sim) => { painel.hidden = !sim; botao.setAttribute("aria-expanded", sim ? "true" : "false"); botao.classList.toggle("aberto", sim); };
    const marcar = () => {
      const ativo = escolhido || sugerido() || "";
      caixa.querySelectorAll(".opcao-emoji").forEach((b) => b.classList.toggle("ativo", b.dataset.emoji === ativo));
      botao.querySelector(".emoji-atual-ic").textContent = ativo || "🙂";
    };
    botao.addEventListener("click", () => abrir(painel.hidden));
    caixa.addEventListener("click", (ev) => {
      const b = ev.target.closest(".opcao-emoji");
      if (!b) return;
      escolhido = escolhido === b.dataset.emoji ? "" : b.dataset.emoji;   // clicar de novo volta ao da categoria
      marcar();
      abrir(false);   // escolheu: a lista fecha
    });
    selCat.addEventListener("change", marcar);
    selCat.addEventListener("input", marcar);
    // abas dos grupos: rolam a caixa até o grupo
    const abas = painel.querySelector(".emoji-abas");
    if (abas) abas.addEventListener("click", (ev) => {
      const a = ev.target.closest(".emoji-aba");
      const g = a && caixa.querySelector(`.emoji-grupo[data-emoji-grupo="${a.dataset.emojiGrupo}"]`);
      if (g) caixa.scrollTo({ top: g.offsetTop, behavior: "smooth" });   // a caixa é a referência (position: relative)
    });
    marcar();
    return () => escolhido || undefined;
  }

  function renderEntradas(d) {
    if (!mesEntradas) mesEntradas = F.mesAtual();
    materializarPers("entrada", mesEntradas);   // cria o lançamento do mês das séries "Personalizar"
    d = DADOS;
    const previstasEnt = repeticoesPrevistas(d.entradas, mesEntradas, (reg, data) => ({
      ...reg, data, valor: valorDoMes(reg, data.slice(0, 7)), prevista: true,
      recebidaNoMes: mesQuitado(reg, data.slice(0, 7)), mesRef: data.slice(0, 7)
    }));
    const lista = [...d.entradas.filter((e) => String(e.data || "").slice(0, 7) === mesEntradas), ...previstasEnt]
      .map((e) => ({ ...e, banco: F.nomeBanco(d, e.bancoId), status: e.prevista ? (e.recebidaNoMes ? "Pago" : "Prevista") : (e.previsto ? "Prevista" : "Pago") }))
      .sort((a, b) => {
        if (ordemEntradas.campo === "cronologica") return (a.data || "").localeCompare(b.data || "") || F.ordemNoDia(a) - F.ordemNoDia(b);
        return comparar(a, b, ordemEntradas.campo, ordemEntradas.dir) || (ordemEntradas.campo === "data" ? F.ordemNoDia(a) - F.ordemNoDia(b) : 0);
      });
    const totalMes = totalEntradasEfetivas(d, mesEntradas);
    const totalPrevisto = previstasEnt.filter((e) => !e.recebidaNoMes).reduce((t, e) => t + Number(e.valor || 0), 0) + F.totalEntradasPrevistasMes(d, mesEntradas);
    const grid = GRID_LANCAMENTOS;
    let corpo;
    // filtro pelas caixas do resumo (some sozinho se o status não existir mais no mês)
    if (filtroEntradas && !lista.some((x) => x.status === filtroEntradas)) filtroEntradas = null;
    const listaTabela = filtroEntradas ? lista.filter((x) => x.status === filtroEntradas) : lista;
    if (!lista.length) {
      corpo = `<div class="empty">Nenhuma entrada cadastrada. Use "+ Nova entrada" para lançar seu salário ou outra receita.</div>`;
    } else {
      corpo = `<div class="hd" style="${grid}">${thOrdem("ordenar-entradas", "data", "Data", ordemEntradas)}${thOrdem("ordenar-entradas", "descricao", "Descrição", ordemEntradas)}<i>Recorrência</i>${thOrdem("ordenar-entradas", "status", "Status", ordemEntradas)}${thOrdem("ordenar-entradas", "banco", "Banco", ordemEntradas)}${thOrdem("ordenar-entradas", "valor", "Valor", ordemEntradas, "hd-valor")}</div>` +
        listaTabela.map((e) => `
        <div class="rw clicavel${e.prevista ? " linha-prevista" : ""}" style="${grid}" data-acao="${e.prevista ? "editar-previsao-entrada" : "editar-entrada"}" data-id="${e.id}" data-data="${e.data}" title="${e.prevista ? "Abre este mês para edição (o valor muda só aqui)" : "Abrir para editar"}">
          <div class="dim cel-data" style="font-size:12px">${fmtDataCurta(e.data)}${seloSabado(e)}</div>
          <div><div class="nm">${descEmoji(e)}</div><div class="sub">${esc(e.categoria)} · ${esc(e.tipo || "")}</div></div>
          <div class="cel-rep">${celRep(seloFreq(e, true), true)}</div>
          <div>${e.prevista
            ? `<button class="selo-tag ${e.recebidaNoMes ? "selo-pago" : "selo-prevista"} selo-botao" data-acao="quitar-mes-entrada" data-id="${e.id}" data-mes="${e.mesRef}" title="${e.recebidaNoMes ? "Marcar como prevista" : "Marcar como paga"}">${e.status}</button>`
            : `<button class="selo-tag ${e.previsto ? "selo-prevista" : "selo-pago"} selo-botao" data-acao="alternar-prevista-entrada" data-id="${e.id}" title="${e.previsto ? "Marcar como paga" : "Marcar como prevista"}">${e.status}</button>`}</div>
          <div><button class="cel-banco cel-banco-botao" data-acao="trocar-banco-entrada" data-id="${e.id}" title="${e.prevista ? "Troca o banco do lançamento original (vale para todas as repetições)" : "Trocar o banco desta entrada"}">${marcaBanco(e.banco, 26)}<span class="dim">${esc(e.banco)}</span></button></div>
          <div class="cel-valor"><span class="big up">+${brl(e.valor)}</span></div>
        </div>`).join("");
    }
    return `
      <div class="grid g-top">
        <div class="c12">${card("c12", `Entradas ${resumoPills([["pago", "Pagas", "+" + brl(totalMes), totalMes], ["prevista", "Previstas", "+" + brl(totalPrevisto), totalPrevisto]], "filtrar-entradas", filtroEntradas)}`, "", `${abasMeses12("mes-entradas", mesEntradas, "anoEntradas", anosDisponiveis(d))}<button class="btn primario" data-acao="nova-entrada" title="Nova entrada"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`, corpo)}</div>
      </div>
    `;
  }


  // Janela simples para somar um valor à conta, no mesmo formato da que
  // adiciona valor a uma meta. O lançamento entra em Entradas.
  function abrirModalValorBanco(bancoId) {
    const b = achar(DADOS.bancos, bancoId);
    if (!b) return;
    abrirModal(`
      <h3>Depositar — ${esc(b.nome)}</h3>
      <div class="campo"><label for="f_valor">Quanto você quer depositar?</label>${campoMoeda("f_valor", "")}</div>
      <div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="Depósito" placeholder="Depósito"></div>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvar">Depositar</button></div>`);
    document.getElementById("btnSalvar").onclick = () => {
      const v = numIn(document.getElementById("f_valor").value);
      if (!(v > 0)) { toast("Informe um valor maior que zero."); return; }
      DADOS.entradas.push({
        id: A.novoId(), data: hojeISO(),
        descricao: (document.getElementById("f_desc").value || "Depósito").trim(),
        categoria: "Outros", bancoId: b.id, valor: v, tipo: "Variável",
        recorrencia: FREQUENCIAS[0], recorrente: false, obs: ""
      });
      fecharModal();
      salvarEAtualizar(`${brl(v)} adicionado em ${b.nome}.`);
    };
  }

  // "previsao" indica que estamos editando a repetição de um mês: o
  // registro daquele mês só é criado quando o usuário salva.
  // status com que a janela de entrada abre: o do lançamento (ou do mês, numa
  // repetição); num lançamento novo, Prevista se a data for futura
  function statusEntradaInicial(e, previsao) {
    if (previsao) return mesQuitado(e, String(previsao.data).slice(0, 7)) ? "Pago" : "Prevista";
    if (e) return e.previsto ? "Prevista" : "Pago";
    return "Pago";
  }
  // lançamento novo: enquanto o status não for escolhido à mão, ele acompanha a
  // data — hoje ou antes = Pago; data futura = Prevista (não entra no saldo ainda)
  function statusSegueData(idData, idStatus) {
    const dt = document.getElementById(idData), st = document.getElementById(idStatus);
    if (!dt || !st) return;
    let mexeu = false;
    st.addEventListener("change", () => { mexeu = true; });
    const ajustar = () => {
      if (mexeu || !dt.value) return;
      const novo = dt.value > hojeISO() ? "Prevista" : "Pago";
      if (st.value !== novo) { st.value = novo; st.dispatchEvent(new Event("change")); mexeu = false; }
    };
    dt.addEventListener("change", ajustar);
    dt.addEventListener("input", ajustar);
    ajustar();
  }

  function abrirModalEntrada(id, bancoIdPadrao, previsao) {
    let e = id ? achar(DADOS.entradas, id) : null;
    // repetição "4º dia útil" vista de outro lugar (ex.: painel): cria o mês e abre o lançamento real
    if (e && previsao && ehPers(e)) {
      const mes = String(previsao.data).slice(0, 7);
      materializarPers("entrada", mes);
      const inst = DADOS.entradas.find((x) => x.origemRecorrente === e.id && String(x.data).slice(0, 7) === mes);
      if (inst) { e = inst; previsao = null; }
    }
    abrirModal(`
      <h3>${e ? "Editar entrada" : "Nova entrada"}</h3>
      <div class="par">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${previsao ? previsao.data : (e ? e.data : hojeISO())}"></div>
        <div class="campo"><label for="f_valor">Valor</label>${campoMoeda("f_valor", e ? (previsao ? valorDoMes(e, previsao.data.slice(0, 7)) : e.valor) : "")}</div>
      </div>
      ${campoEmoji(EMOJIS_ENTRADA, e && e.emoji, `<div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="${e ? esc(e.descricao) : ""}" placeholder="Salário"></div>`)}
      <div class="par">
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(comAtual(CATS_ENTRADA, e && e.categoria), e ? e.categoria : CATS_ENTRADA[0])}</select></div>
        <div class="campo"><label for="f_banco">Banco</label><select id="f_banco">${opcoesBancos(DADOS.bancos, e ? e.bancoId : (bancoIdPadrao || ""), true)}</select></div>
      </div>
      <div class="par par-3">
        <div class="campo"><label for="f_tipo">Tipo</label><select id="f_tipo">${opcoes(["Fixa", "Variável"], e ? e.tipo : "Fixa")}</select></div>
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${opcoes(["Pago", "Prevista"], statusEntradaInicial(e, previsao))}</select></div>
        <div class="campo"><label for="f_rec">Repetição</label><select id="f_rec">${opcoes(FREQUENCIAS_REP, freqDe(e))}</select></div>
      </div>
      <div class="ajuda ajuda-rec" id="ajudaRec">Serve para identificar entradas que se repetem; o lançamento seguinte continua sendo feito por você.</div>
      ${htmlPersonalizar(e && e.regraRep)}
      <div class="campo"><label for="f_obs">Observação</label><textarea id="f_obs" placeholder="Opcional">${e ? esc(e.obs || "") : ""}</textarea></div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${e ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    // "Personalizar": a data vira calculada (somente leitura) para o mês escolhido
    const mesDoForm = e ? String(e.data).slice(0, 7) : (mesEntradas || (document.getElementById("f_data").value || hojeISO()).slice(0, 7));   // mês aberto na guia
    document.getElementById("modal").classList.add("modal-lanc");   // computador/iPad: janela mais larga, com os campos lado a lado
    const lerEmoji = ligarEmoji(e && e.emoji);
    const regraDoForm = ligarPersonalizar(mesDoForm, "O lançamento de cada mês é criado sozinho, com status Prevista, para você marcar como Pago depois.");
    if (!e) statusSegueData("f_data", "f_status");   // lançamento novo: data futura começa como Prevista

    document.getElementById("btnSalvar").onclick = () => {
      const banco = document.getElementById("f_banco").value;
      if (!banco) { toast("Selecione o banco que recebeu o valor."); return; }
      const statusEnt = document.getElementById("f_status").value;
      const desc = document.getElementById("f_desc").value.trim();
      if (!desc) { toast("Descreva a entrada."); return; }
      const registro = {
        id: e ? e.id : A.novoId(),
        data: document.getElementById("f_data").value || hojeISO(),
        descricao: desc,
        emoji: lerEmoji(),
        categoria: document.getElementById("f_cat").value,
        bancoId: banco,
        valor: numIn(document.getElementById("f_valor").value),
        tipo: document.getElementById("f_tipo").value,
        recorrencia: document.getElementById("f_rec").value,
        recorrente: document.getElementById("f_rec").value !== FREQUENCIAS[0],
        obs: document.getElementById("f_obs").value.trim(),
        previsto: statusEnt === "Prevista"   // o status manda no saldo e em todos os totais
      };
      if (registro.recorrencia === FREQ_PERS) { registro.regraRep = regraDoForm(); registro.data = dataDoMesRegra(registro.regraRep, mesDoForm); }
      if (e && ehPers(e) && registro.recorrencia === FREQ_PERS) {
        // lançamento já existente da série: pergunta se vale só para este mês ou também para os próximos
        escolherAlcance("Salvar alteração", (alcance) => { salvarPers("entrada", e, registro, alcance); salvarEAtualizar("Entrada atualizada."); });
        return;
      }
      if (previsao) {
        // muda só o mês editado, dentro do próprio lançamento recorrente (valor e status do mês)
        gravarAjuste(e, previsao.data.slice(0, 7), { valor: registro.valor, pago: statusEnt === "Pago" });
        e.emoji = registro.emoji;   // o emoji vale para a série toda
        if (registro.data && registro.data !== previsao.data) registrarReancoragem(e, previsao.data.slice(0, 7), registro.data);
      } else if (e) Object.assign(e, manterSerie(e, registro));
      else DADOS.entradas.push(registro);
      fecharModal();
      salvarEAtualizar(e ? "Entrada atualizada." : "Entrada cadastrada.");
    };
    if (e) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      if (ehPers(e)) {
        escolherAlcance("Excluir entrada", (alcance) => { excluirPers("entrada", e, alcance); salvarEAtualizar("Entrada excluída."); });
        return;
      }
      confirmarExclusao("Excluir esta entrada?", () => {
        DADOS.entradas = DADOS.entradas.filter((x) => x.id !== e.id);
        salvarEAtualizar("Entrada excluída.");
      });
    };
  }

  // =========================================================================
  // DESPESAS
  // =========================================================================
  // nome do banco de uma despesa (se foi no cartão, o banco do cartão)
  function bancoDoLancamento(d, x) {
    if (x.cartaoId) {
      const c = achar(d.cartoes, x.cartaoId);
      return c ? F.nomeBanco(d, c.bancoId) : "Cartão";
    }
    return F.nomeBanco(d, x.bancoId);
  }

  function renderDespesas(d) {
    if (!mesDespesas) mesDespesas = F.mesAtual();
    materializarPers("despesa", mesDespesas);   // cria o lançamento do mês das séries "Personalizar"
    d = DADOS;
    // a tela reúne o que já saiu (despesas lançadas) e o que ainda vai
    // sair (contas a pagar), com o status de cada linha
    const lancadas = d.despesas.map((x) => ({
      origem: "despesa", id: x.id, descricao: x.descricao, emoji: x.emoji, categoria: x.categoria, tipo: x.tipo,
      pagoCom: bancoDoLancamento(d, x),
      data: x.data, status: "Pago", valor: Number(x.valor || 0), recorrencia: freqDe(x)
    }));
    const contasDoMes = (d.contasPagar || [])
      .filter((c) => String(c.vencimento || "").slice(0, 7) === mesDespesas)
      .map((c) => ({ descricao: c.descricao, categoria: c.categoria, valor: c.valor, data: c.vencimento, origemRecorrente: c.origemRecorrente }));
    // contas a pagar recorrentes também geram previsões
    const contasComoLista = (d.contasPagar || []).map((c) => ({ ...c, data: c.vencimento }));
    const repeticoesContas = repeticoesPrevistas(contasComoLista, mesDespesas, (reg, data) => ({
      origem: "conta", id: reg.id, descricao: reg.descricao, emoji: reg.emoji, categoria: reg.categoria, tipo: reg.tipo,
      pagoCom: bancoDoMes(reg, data.slice(0, 7)) ? F.nomeBanco(d, bancoDoMes(reg, data.slice(0, 7))) : "—", data, valor: valorDoMes(reg, data.slice(0, 7)),
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      recorrencia: freqDe(reg), prevista: true, mesRef: data.slice(0, 7)
    }), []);
    const repeticoes = repeticoesPrevistas(d.despesas, mesDespesas, (reg, data) => ({
      origem: "despesa", id: reg.id, descricao: reg.descricao, emoji: reg.emoji, categoria: reg.categoria, tipo: reg.tipo,
      pagoCom: bancoDoLancamento(d, { ...reg, bancoId: bancoDoMes(reg, data.slice(0, 7)) }), data, valor: valorDoMes(reg, data.slice(0, 7)),
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      recorrencia: freqDe(reg), prevista: true, mesRef: data.slice(0, 7)
    }), contasDoMes);
    const previstas = F.listaContasPagarComStatus(d).map((c) => ({
      origem: "conta", id: c.id, descricao: c.descricao, emoji: c.emoji, categoria: c.categoria, tipo: c.tipo,
      pagoCom: c.bancoId ? F.nomeBanco(d, c.bancoId) : "—",
      data: c.vencimento, status: c.statusReal === "Pendente" ? "Prevista" : c.statusReal,
      valor: Number(c.valor || 0), recorrencia: freqDe(c)
    }));
    if (!mesDespesas) mesDespesas = F.mesAtual();
    const lista = [...lancadas, ...previstas, ...repeticoes, ...repeticoesContas]
      .filter((x) => String(x.data || "").slice(0, 7) === mesDespesas)
      .sort((a, b) => {
        if (ordemDespesas.campo === "cronologica") return (a.data || "").localeCompare(b.data || "");
        return comparar(a, b, ordemDespesas.campo, ordemDespesas.dir);
      });

    // "Pagas" soma as despesas lançadas e as contas já quitadas do mês;
    // "em aberto" soma o que ainda está pendente ou atrasado no mês
    const somaStatus = (st) => lista.filter((x) => x.status === st).reduce((t, x) => t + Number(x.valor || 0), 0);
    const totalMes = somaStatus("Pago");
    const emAberto = somaStatus("Prevista");
    const atrasadas = somaStatus("Atrasado");
    const aPagar = F.totalAPagar(d);
    const gridD = GRID_LANCAMENTOS;

    let corpo;
    // filtro pelas caixas do resumo (some sozinho se o status não existir mais no mês)
    if (filtroDespesas && !lista.some((x) => x.status === filtroDespesas)) filtroDespesas = null;
    const listaTabela = filtroDespesas ? lista.filter((x) => x.status === filtroDespesas) : lista;
    if (!lista.length) {
      corpo = `<div class="empty">Nenhum lançamento em ${NOMES_MES[Number(mesDespesas.slice(5, 7)) - 1]}/${mesDespesas.slice(0, 4)}. Use NOVO para lançar uma despesa ou uma conta a pagar.</div>`;
    } else {
      corpo = `<div class="hd" style="${gridD}">${thOrdem("ordenar-despesas", "data", "Data", ordemDespesas)}${thOrdem("ordenar-despesas", "descricao", "Descrição", ordemDespesas)}<i>Recorrência</i>${thOrdem("ordenar-despesas", "status", "Status", ordemDespesas)}${thOrdem("ordenar-despesas", "pagoCom", "Banco", ordemDespesas)}${thOrdem("ordenar-despesas", "valor", "Valor", ordemDespesas, "hd-valor")}</div>` +
        listaTabela.map((x) => `
        <div class="rw clicavel${x.prevista ? " linha-prevista" : ""}" style="${gridD}" data-acao="${x.prevista ? (x.origem === "conta" ? "editar-previsao-conta" : "editar-previsao") : (x.origem === "despesa" ? "editar-despesa" : "editar-conta")}" data-id="${x.id}" data-data="${x.data}" title="${x.prevista ? "Abre este mês para edição (o valor muda só aqui)" : "Abrir para editar"}">
          <div class="dim cel-data" style="font-size:12px">${fmtData(x.data)}</div>
          <div><div class="nm">${descEmoji(x)}</div><div class="sub">${esc(x.categoria || "—")} · ${esc(x.tipo || "Variável")}</div></div>
          <div class="cel-rep">${celRep(seloFreq({ ...(registrosSerie("despesa").find((y) => y.id === x.id) || {}), recorrencia: x.recorrencia, data: x.data }, true), true)}</div>
          <div>${x.prevista
            ? `<button class="selo-tag ${x.status === "Pago" ? "selo-pago" : "selo-prevista"} selo-botao" data-acao="${x.origem === "conta" ? "quitar-mes-conta" : "quitar-mes"}" data-id="${x.id}" data-mes="${x.mesRef}" title="Confirmar: cria o lançamento deste mês">${x.status}</button>`
            : `<button class="selo-tag selo-${x.status.toLowerCase()} selo-botao" data-acao="${x.origem === "conta" ? "alternar-pago" : "tornar-pendente"}" data-id="${x.id}" title="${x.origem === "conta" ? (x.status === "Pago" ? "Marcar como prevista" : "Pagar") : "Marcar como prevista (vira conta a pagar)"}">${x.status}</button>`}</div>
          <div>${x.origem === "despesa" || x.pagoCom !== "—"
            ? `<button class="cel-banco cel-banco-botao" data-acao="${x.origem === "despesa" ? "trocar-banco" : "trocar-banco-conta"}" data-id="${x.id}" title="Trocar o banco (nas repetições, altera o lançamento original)">${marcaBanco(x.pagoCom, 26)}<span class="dim">${esc(x.pagoCom)}</span></button>`
            : `<span class="cel-banco">${x.pagoCom && x.pagoCom !== "—" ? marcaBanco(x.pagoCom, 26) + `<span class="dim">${esc(x.pagoCom)}</span>` : '<span class="dim">—</span>'}</span>`}</div>
          <div class="cel-valor"><span class="big down">−${brl(x.valor)}</span></div>
        </div>`).join("");
    }

    return `
      <div class="grid g-top">
        <div class="c12">${card("c12", `Despesas ${resumoPills([["pago", "Pagas", "+" + brl(totalMes), totalMes], ["prevista", "Previstas", "−" + brl(emAberto), emAberto], ["atrasado", "Atrasadas", "−" + brl(atrasadas), atrasadas]], "filtrar-despesas", filtroDespesas)}`, "",
          `${abasMeses12("mes-despesas", mesDespesas, "anoDespesas", anosDisponiveis(d))}<button class="btn primario" data-acao="nova-despesa" title="Nova despesa"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`,
          corpo)}</div>
      </div>
    `;
  }

  function nomeCartao(d, id) {
    const c = d.cartoes.find((x) => x.id === id);
    return c ? c.nome : "—";
  }
  function opcoesPagarCom(d, bancoIdAtual, cartaoIdAtual) {
    let html = '<option value="">Selecione…</option>';
    if (d.bancos.length) {
      html += `<optgroup label="Bancos">` + d.bancos.map((b) => `<option value="banco:${b.id}" ${b.id === bancoIdAtual ? "selected" : ""}>${esc(b.nome)}</option>`).join("") + `</optgroup>`;
    }
    return html;
  }

  // Formulário único de despesa: o campo Status decide onde o registro
  // fica guardado — "Pago" vira uma despesa lançada, "Pendente" vira uma
  // conta a pagar com a data informada como vencimento.
  function abrirModalDespesa(id, origem, previsao) {
    origem = origem || "despesa";
    let x = id ? achar(origem === "conta" ? DADOS.contasPagar : DADOS.despesas, id) : null;
    // mês de uma série "Personalizar" visto de outro lugar: cria o mês e abre o lançamento real
    if (x && previsao && ehPers(x)) {
      const mesP = String(previsao.data).slice(0, 7);
      materializarPers("despesa", mesP);
      const inst = registrosSerie("despesa").find((y) => y.origemRecorrente === x.id && mesReg(y) === mesP);
      if (inst) { x = inst; origem = DADOS.contasPagar.includes(inst) ? "conta" : "despesa"; previsao = null; }
    }
    const ehConta = origem === "conta";
    const statusAtual = x ? (ehConta ? (F.statusReal(x) === "Pago" ? "Pago" : "Prevista") : "Pago") : "Pago";
    const dataAtual = previsao ? previsao.data : (x ? (ehConta ? x.vencimento : x.data) : hojeISO());

    abrirModal(`
      <h3>${x ? "Editar lançamento" : "Nova despesa"}</h3>
      <div class="par">
        <div class="campo"><label for="f_data"><span id="rotuloData">Data</span></label><input id="f_data" type="date" value="${dataAtual}"></div>
        <div class="campo"><label for="f_valor">Valor</label>${campoMoeda("f_valor", x ? (previsao ? valorDoMes(x, previsao.data.slice(0, 7)) : x.valor) : "")}</div>
      </div>
      ${campoEmoji(EMOJIS_DESPESA, x && x.emoji, `<div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="${x ? esc(x.descricao) : ""}" placeholder="Supermercado"></div>`)}
      <div class="par par-3">
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(comAtual(CATS_DESPESA, x && x.categoria), x ? x.categoria : CATS_DESPESA[0])}</select></div>
        <div class="campo"><label for="f_tipo">Tipo</label><select id="f_tipo">${opcoes(["Fixa", "Variável"], x && x.tipo ? x.tipo : "Variável")}</select></div>
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${opcoes(["Pago", "Prevista"], statusAtual)}</select></div>
      </div>
      <div id="camposPagamento">
        <div class="par par-3">
          <div class="campo"><label for="f_pagarcom">Banco</label><select id="f_pagarcom">${opcoesPagarCom(DADOS, x ? x.bancoId : "", x && !ehConta ? x.cartaoId : "")}</select></div>
          <div class="campo"><label for="f_forma">Forma</label><select id="f_forma">${opcoes(FORMAS_PAGAMENTO, x ? x.formaPagamento : FORMAS_PAGAMENTO[0])}</select></div>
          <div class="campo"><label for="f_rec">Repetição</label><select id="f_rec">${opcoes(FREQUENCIAS_REP, freqDe(x))}</select></div>
        </div>
        <div class="ajuda ajuda-rec" id="ajudaRec"></div>
      ${htmlPersonalizar(x && x.regraRep)}
      </div>
      <div class="${DADOS.bancos.length > 1 ? "par" : ""}">
        ${DADOS.bancos.length > 1 ? `<div class="campo" title="Ao pagar, o valor sai do banco da despesa e é transferido para este (VR e VT para o Inter, por ex.)"><label for="f_destino">Enviar</label><select id="f_destino"><option value="">Nenhum</option>${DADOS.bancos.map((b) => `<option value="${b.id}"${x && (previsao ? ajusteDoMes(x, previsao.data.slice(0, 7)).destinoBancoId || x.destinoBancoId : x.destinoBancoId) === b.id ? " selected" : ""}>${esc(b.nome)}</option>`).join("")}</select></div>` : ""}
        <div class="campo"><label for="f_obs">Observação</label><textarea id="f_obs" placeholder="Opcional">${x ? esc(x.obs || "") : ""}</textarea></div>
      </div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${x && !previsao ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    const selStatus = document.getElementById("f_status");
    if (!x) setTimeout(() => statusSegueData("f_data", "f_status"), 0);   // nova: data futura começa como Prevista

    const mesDoFormD = x ? String(ehConta ? x.vencimento : x.data).slice(0, 7) : (mesDespesas || hojeISO().slice(0, 7));   // mês aberto na guia
    document.getElementById("modal").classList.add("modal-lanc");   // computador/iPad: janela mais larga, com os campos lado a lado
    const lerEmojiD = ligarEmoji(x && x.emoji);
    const regraDoFormD = ligarPersonalizar(mesDoFormD, "O lançamento de cada mês é criado sozinho, com status Prevista, para você marcar como Pago depois.");

    document.getElementById("btnSalvar").onclick = () => {
      const status = selStatus.value;
      const desc = document.getElementById("f_desc").value.trim();
      if (!desc) { toast("Descreva o lançamento."); return; }
      const destinoForm = document.getElementById("f_destino") ? document.getElementById("f_destino").value || undefined : x ? x.destinoBancoId : undefined;
      const regraLida = regraDoFormD();
      const data = regraLida ? dataDoMesRegra(regraLida, mesDoFormD) : (document.getElementById("f_data").value || hojeISO());
      if (x && ehPers(x) && regraLida) {
        // lançamento já existente da série: pergunta o alcance e aplica o status só no mês editado
        const pagarCom = document.getElementById("f_pagarcom") ? document.getElementById("f_pagarcom").value : "";
        const [tipoPg, idPg] = String(pagarCom || ":").split(":");
        const reg = { descricao: desc, emoji: lerEmojiD(), categoria: document.getElementById("f_cat").value, tipo: document.getElementById("f_tipo").value,
          obs: document.getElementById("f_obs").value.trim(), valor: numIn(document.getElementById("f_valor").value), regraRep: regraLida, destinoBancoId: destinoForm };
        if (tipoPg === "banco" && idPg) reg.bancoId = idPg;
        escolherAlcance("Salvar alteração", (alcance) => {
          salvarPers("despesa", x, reg, alcance);
          if (DADOS.contasPagar.includes(x)) x.status = status === "Pago" ? "Pago" : "Pendente";
          salvarEAtualizar("Lançamento atualizado.");
        });
        return;
      }
      const valor = numIn(document.getElementById("f_valor").value);
      const categoria = document.getElementById("f_cat").value;
      const tipo = document.getElementById("f_tipo").value;
      const obs = document.getElementById("f_obs").value.trim();
      const emoji = lerEmojiD();
      if (previsao && x) x.emoji = emoji;   // o emoji vale para a série toda

      if (status === "Pago") {
        const pagarCom = document.getElementById("f_pagarcom").value;
        if (!pagarCom) { toast("Selecione com o que essa despesa foi paga."); return; }
        const [tipoPg, idPg] = pagarCom.split(":");
        const registro = {
          id: (x && !ehConta) ? x.id : A.novoId(), data, descricao: desc, emoji, categoria, tipo,
          bancoId: tipoPg === "banco" ? idPg : "", cartaoId: tipoPg === "cartao" ? idPg : "",
          valor, formaPagamento: document.getElementById("f_forma").value,
          recorrencia: document.getElementById("f_rec").value,
          recorrente: document.getElementById("f_rec").value !== FREQUENCIAS[0], regraRep: regraLida || undefined, obs, destinoBancoId: destinoForm
        };
        if (previsao) {
          gravarAjuste(x, previsao.data.slice(0, 7), { valor: registro.valor, pago: true, bancoId: registro.bancoId || undefined, destinoBancoId: destinoForm });
          if (data !== previsao.data) registrarReancoragem(x, previsao.data.slice(0, 7), data);
        } else if (x && !ehConta) Object.assign(x, manterSerie(x, registro));
        else {
          DADOS.despesas.push(manterSerie(x, registro));
          if (x && ehConta) DADOS.contasPagar = DADOS.contasPagar.filter((r) => r.id !== x.id); // deixou de ser conta
        }
      } else {
        const pagarComP = document.getElementById("f_pagarcom").value;
        const [tipoP, idP] = pagarComP ? pagarComP.split(":") : ["", ""];
        const registro = {
          id: (x && ehConta) ? x.id : A.novoId(), descricao: desc, emoji, categoria, tipo,
          vencimento: data, valor, status: "Pendente", obs,
          bancoId: tipoP === "banco" ? idP : "",
          formaPagamento: document.getElementById("f_forma").value,
          recorrencia: document.getElementById("f_rec").value,
          recorrente: document.getElementById("f_rec").value !== FREQUENCIAS[0], regraRep: regraLida || undefined, destinoBancoId: destinoForm
        };
        if (previsao) {
          gravarAjuste(x, previsao.data.slice(0, 7), { valor: registro.valor, pago: false, bancoId: registro.bancoId || undefined, destinoBancoId: destinoForm });
          if (data !== previsao.data) registrarReancoragem(x, previsao.data.slice(0, 7), data);
        } else if (x && ehConta) Object.assign(x, manterSerie(x, registro));
        else {
          DADOS.contasPagar.push(manterSerie(x, registro));
          if (x && !ehConta) DADOS.despesas = DADOS.despesas.filter((r) => r.id !== x.id); // virou conta a pagar
        }
      }
      fecharModal();
      salvarEAtualizar(x ? "Lançamento atualizado." : (status === "Pago" ? "Despesa cadastrada." : "Conta prevista cadastrada."));
    };

    if (x && !previsao) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      if (ehPers(x)) {
        escolherAlcance("Excluir lançamento", (alcance) => { excluirPers("despesa", x, alcance); salvarEAtualizar("Lançamento excluído."); });
        return;
      }
      confirmarExclusao("Excluir este lançamento?", () => {
        if (ehConta) DADOS.contasPagar = DADOS.contasPagar.filter((r) => r.id !== x.id);
        else DADOS.despesas = DADOS.despesas.filter((r) => r.id !== x.id);
        salvarEAtualizar("Lançamento excluído.");
      });
    };
  }

  // =========================================================================
  // CARTÕES DE CRÉDITO
  // =========================================================================
  function renderCartoes(d) {
    const cartoes = F.listaCartoesComUso(d);
    let corpo;
    if (!cartoes.length) {
      corpo = `<div class="empty">Nenhum cartão cadastrado. Use "+ Novo cartão" para começar.</div>`;
    } else {
      corpo = `<div class="grid">` + cartoes.map((c) => {
        const cor = c.percentualUso >= 90 ? "var(--down)" : c.percentualUso >= 70 ? "var(--acc)" : "var(--up)";
        return `<div class="c4">
          <div class="cartao-item" style="border-left-color:var(--vi)" data-acao="editar-cartao" data-id="${c.id}">
            <div class="linha1"><div><div class="nome">${esc(c.nome)}</div><div class="tipo">${esc(c.bancoNome)}</div></div></div>
            <div class="rodape" style="margin-bottom:8px">Limite ${brl(c.limite)}</div>
            <div class="progresso"><i style="width:${Math.min(100, c.percentualUso)}%;background:${cor}"></i></div>
            <div class="progresso-legenda"><span>usado ${brl(c.limiteUsado)}</span><span>disponível ${brl(c.limiteDisponivel)}</span></div>
            <div class="rodape" style="margin-top:8px">fecha dia ${c.diaFechamento} · vence dia ${c.diaVencimento}</div>
          </div>
        </div>`;
      }).join("") + `</div>`;
    }
    return `
      <div class="grid g-top">
        <div class="c12">${card("c12", "Cartões de crédito", `${plural(cartoes.length, "cartão", "cartões")}`, `<button class="btn primario" data-acao="novo-cartao"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Novo cartão</button>`, corpo)}</div>
      </div>
    `;
  }

  function abrirModalCartao(id) {
    const c = id ? achar(DADOS.cartoes, id) : null;
    abrirModal(`
      <h3>${c ? "Editar cartão" : "Novo cartão"}</h3>
      <div class="campo"><label for="f_nome">Nome do cartão</label><input id="f_nome" value="${c ? esc(c.nome) : ""}" placeholder="Nubank Ultravioleta"></div>
      <div class="campo"><label for="f_banco">Banco</label><select id="f_banco">${opcoesBancos(DADOS.bancos, c ? c.bancoId : "", true)}</select></div>
      <div class="campo"><label for="f_limite">Limite total</label>${campoMoeda("f_limite", c ? c.limite : "")}</div>
      <div class="par">
        <div class="campo"><label for="f_fech">Dia de fechamento</label><input id="f_fech" type="number" min="1" max="31" value="${c ? c.diaFechamento : ""}" placeholder="22"></div>
        <div class="campo"><label for="f_venc">Dia de vencimento</label><input id="f_venc" type="number" min="1" max="31" value="${c ? c.diaVencimento : ""}" placeholder="5"></div>
      </div>
      <p class="campo ajuda">O limite usado e o disponível são calculados a partir das despesas que você lançar neste cartão desde o último fechamento — não precisa informar manualmente.</p>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${c ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    document.getElementById("btnSalvar").onclick = () => {
      const nome = document.getElementById("f_nome").value.trim();
      if (!nome) { toast("Informe o nome do cartão."); return; }
      const registro = {
        id: c ? c.id : A.novoId(),
        nome, bancoId: document.getElementById("f_banco").value,
        limite: numIn(document.getElementById("f_limite").value),
        diaFechamento: Number(document.getElementById("f_fech").value) || 1,
        diaVencimento: Number(document.getElementById("f_venc").value) || 10
      };
      if (c) Object.assign(c, registro); else DADOS.cartoes.push(registro);
      fecharModal();
      salvarEAtualizar(c ? "Cartão atualizado." : "Cartão cadastrado.");
    };
    if (c) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      confirmarExclusao(`Excluir o cartão "${c.nome}"? As despesas já lançadas nele continuarão no histórico.`, () => {
        DADOS.cartoes = DADOS.cartoes.filter((r) => r.id !== c.id);
        salvarEAtualizar("Cartão excluído.");
      });
    };
  }

  // =========================================================================
  // CONTAS A PAGAR
  // =========================================================================
  function seloStatus(status) {
    const classe = status === "Pago" ? "selo-pago" : status === "Atrasado" ? "selo-atrasado" : "selo-pendente";
    return `<span class="selo-tag ${classe}">${status}</span>`;
  }

  function renderContasPagar(d) {
    const lista = F.listaContasPagarComStatus(d).sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
    const totalAberto = F.totalAPagar(d);
    const dispensadasAviso = (d.config && d.config.contasDispensadas) || [];
    const chaveConta = (c) => c.id + ":" + (c.vencimento || "") + ":" + c.statusReal;
    const atrasadas = F.contasAtrasadas(d).filter((c) => dispensadasAviso.indexOf(chaveConta(c)) === -1);
    const vencendo = F.contasVencendoEm(d, 7).filter((c) => c.statusReal === "Pendente" && dispensadasAviso.indexOf(chaveConta(c)) === -1);
    const grid = "grid-template-columns:26px 1fr 120px 110px 100px";

    let corpo;
    if (!lista.length) {
      corpo = `<div class="empty">Nenhuma conta a pagar cadastrada.</div>`;
    } else {
      corpo = `<div class="hd" style="${grid}"><i></i><i>Descrição</i><i>Vencimento</i><i class="r">Valor</i><i class="r">Status</i></div>` +
        lista.map((c) => `
        <div class="rw" style="${grid}">
          <button class="btn fantasma" data-acao="alternar-pago" data-id="${c.id}" title="${c.statusReal === "Pago" ? "Marcar como pendente" : "Pagar"}" style="color:${c.statusReal === "Pago" ? "var(--up)" : "var(--dim)"}">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l3.5 3.5L16 5"/></svg>
          </button>
          <button data-acao="editar-conta" data-id="${c.id}" style="text-align:left"><div class="nm">${descEmoji(c)}</div><div class="sub">${subDe(c)}${seloDe(c, c.vencimento)}</div></button>
          <div class="dim" style="font-size:12.5px">${fmtData(c.vencimento)}</div>
          <div class="r big">${brl(c.valor)}</div>
          <div class="r" style="display:flex;gap:6px;justify-content:flex-end;align-items:center">${seloStatus(c.statusReal)}
            <button class="btn fantasma" data-acao="excluir-conta" data-id="${c.id}" title="Excluir" style="color:var(--down)"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONES.excluir}</svg></button>
          </div>
        </div>`).join("");
    }

    let avisos = "";
    if (atrasadas.length || vencendo.length) {
      avisos = `<div class="faixa-demo" style="border-color:rgba(255,176,32,.3)">
        <div>${atrasadas.length ? `<b class="down">${plural(atrasadas.length, "conta atrasada", "contas atrasadas")}</b>` : ""}${atrasadas.length && vencendo.length ? " · " : ""}${vencendo.length ? `<b class="acc">${vencendo.length} vencendo nos próximos 7 dias</b>` : ""}</div>
        <button class="fechar" data-acao="dispensar-contas" title="Não avisar mais sobre estas contas" aria-label="Dispensar aviso">×</button>
      </div>`;
    }

    return `
      ${avisos}
      <div class="grid g-top">
        <div class="c12">${card("c12", "Contas a pagar", `${plural(lista.length, "conta")}`, `<button class="btn primario" data-acao="nova-conta"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Nova conta</button>`, corpo, `<span class="dim">Total em aberto</span><span class="down" style="font-size:14px">${brl(totalAberto)}</span>`)}</div>
      </div>
    `;
  }

  function abrirModalContaPagar(id) {
    const c = id ? achar(DADOS.contasPagar, id) : null;
    abrirModal(`
      <h3>${c ? "Editar conta" : "Nova conta a pagar"}</h3>
      <div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="${c ? esc(c.descricao) : ""}" placeholder="Condomínio"></div>
      <div class="par">
        <div class="campo"><label for="f_cat">Categoria</label><input id="f_cat" value="${c ? esc(c.categoria || "") : ""}" placeholder="Moradia"></div>
        <div class="campo"><label for="f_venc">Vencimento</label><input id="f_venc" type="date" value="${c ? c.vencimento : hojeISO()}"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_valor">Valor</label>${campoMoeda("f_valor", c ? c.valor : "")}</div>
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${opcoes(["Pendente", "Pago"], c ? c.status : "Pendente")}</select></div>
      </div>
      <p class="campo ajuda">O status "Atrasado" aparece sozinho quando a data de vencimento já passou e a conta ainda não foi marcada como paga.</p>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${c ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    document.getElementById("btnSalvar").onclick = () => {
      const desc = document.getElementById("f_desc").value.trim();
      if (!desc) { toast("Descreva a conta."); return; }
      const registro = {
        id: c ? c.id : A.novoId(),
        descricao: desc,
        categoria: document.getElementById("f_cat").value.trim(),
        vencimento: document.getElementById("f_venc").value || hojeISO(),
        valor: numIn(document.getElementById("f_valor").value),
        status: document.getElementById("f_status").value
      };
      if (c) Object.assign(c, registro); else DADOS.contasPagar.push(registro);
      fecharModal();
      salvarEAtualizar(c ? "Conta atualizada." : "Conta cadastrada.");
    };
    if (c) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      confirmarExclusao("Excluir esta conta?", () => {
        DADOS.contasPagar = DADOS.contasPagar.filter((r) => r.id !== c.id);
        salvarEAtualizar("Conta excluída.");
      });
    };
  }

  // =========================================================================
  // HISTÓRICO FINANCEIRO (busca, filtros, ordenação)
  // =========================================================================
  function limitesPeriodo(chave) {
    const hoje = new Date();
    let inicio;
    if (chave === "mes-atual") { inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1); }
    else if (chave === "3m") { inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1); }
    else if (chave === "6m") { inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1); }
    else if (chave === "ano") { inicio = new Date(hoje.getFullYear(), 0, 1); }
    else { inicio = new Date(2000, 0, 1); }
    return { inicio: inicio.toISOString().slice(0, 10), fim: hoje.toISOString().slice(0, 10) };
  }

  function movimentacoesFiltradas(d) {
    const { inicio, fim } = limitesPeriodo(filtrosHistorico.periodo);
    let lista = [
      ...d.entradas.map((e) => ({ ...e, __tipo: "Entrada" })),
      ...d.despesas.map((x) => ({ ...x, __tipo: "Despesa" }))
    ].filter((m) => m.data >= inicio && m.data <= fim);

    if (filtrosHistorico.tipo !== "todos") lista = lista.filter((m) => m.__tipo === filtrosHistorico.tipo);
    if (filtrosHistorico.banco) lista = lista.filter((m) => m.bancoId === filtrosHistorico.banco || m.cartaoId === filtrosHistorico.banco);
    if (filtrosHistorico.categoria) lista = lista.filter((m) => (m.categoria || "") === filtrosHistorico.categoria);
    if (filtrosHistorico.busca) {
      const b = filtrosHistorico.busca.toLowerCase();
      lista = lista.filter((m) => (m.descricao || "").toLowerCase().includes(b));
    }
    lista.sort((a, b) => {
      let r = 0;
      if (filtrosHistorico.ordenarPor === "valor") r = Number(a.valor) - Number(b.valor);
      else r = (a.data || "").localeCompare(b.data || "");
      return filtrosHistorico.ordemAsc ? r : -r;
    });
    return lista;
  }

  function renderHistorico(d) {
    const lista = movimentacoesFiltradas(d);
    const todasCategorias = [...new Set([...d.entradas, ...d.despesas].map((m) => m.categoria).filter(Boolean))].sort();
    const grid = "grid-template-columns:90px 1fr 130px 130px 100px 90px";

    let corpo;
    if (!lista.length) {
      corpo = `<div class="empty">Nenhuma movimentação encontrada com esses filtros.</div>`;
    } else {
      corpo = `<div class="hd" style="${grid}">
          <button class="btn fantasma" data-acao="ordenar-historico" data-campo="data" style="justify-content:flex-start">Data ${filtrosHistorico.ordenarPor === "data" ? (filtrosHistorico.ordemAsc ? "↑" : "↓") : ""}</button>
          <i>Descrição</i><i>Categoria</i><i>Conta</i>
          <button class="btn fantasma" data-acao="ordenar-historico" data-campo="valor" style="justify-content:flex-end;margin-left:auto">Valor ${filtrosHistorico.ordenarPor === "valor" ? (filtrosHistorico.ordemAsc ? "↑" : "↓") : ""}</button>
          <i class="r">Status</i>
        </div>` +
        lista.map((m) => `
        <div class="rw" style="${grid}">
          <div class="dim" style="font-size:12px">${fmtDataCurta(m.data)}</div>
          <button data-acao="${m.__tipo === "Entrada" ? "editar-entrada" : "editar-despesa"}" data-id="${m.id}" style="text-align:left"><div class="nm">${descEmoji(m)}</div><div class="sub">${subDe(m)}${seloDe(m, m.data)}</div></button>
          <div class="dim" style="font-size:12.5px">${esc(m.categoria || "—")}</div>
          <div class="dim" style="font-size:12.5px">${m.cartaoId ? "💳 " + esc(nomeCartao(d, m.cartaoId)) : esc(F.nomeBanco(d, m.bancoId))}</div>
          <div class="r big ${m.__tipo === "Entrada" ? "up" : "down"}">${m.__tipo === "Entrada" ? "+" : "−"}${brl(m.valor)}</div>
          <div class="r"><span class="selo-tag ${m.__tipo === "Entrada" ? "selo-entrada" : "selo-cat"}">${m.__tipo}</span></div>
        </div>`).join("");
    }

    return `
      <div class="filtros">
        <select id="filtroPeriodo">
          <option value="mes-atual" ${filtrosHistorico.periodo === "mes-atual" ? "selected" : ""}>Este mês</option>
          <option value="3m" ${filtrosHistorico.periodo === "3m" ? "selected" : ""}>Últimos 3 meses</option>
          <option value="6m" ${filtrosHistorico.periodo === "6m" ? "selected" : ""}>Últimos 6 meses</option>
          <option value="ano" ${filtrosHistorico.periodo === "ano" ? "selected" : ""}>Este ano</option>
          <option value="tudo" ${filtrosHistorico.periodo === "tudo" ? "selected" : ""}>Tudo</option>
        </select>
        <select id="filtroTipo">
          <option value="todos" ${filtrosHistorico.tipo === "todos" ? "selected" : ""}>Entradas e despesas</option>
          <option value="Entrada" ${filtrosHistorico.tipo === "Entrada" ? "selected" : ""}>Só entradas</option>
          <option value="Despesa" ${filtrosHistorico.tipo === "Despesa" ? "selected" : ""}>Só despesas</option>
        </select>
        <select id="filtroBanco"><option value="">Todos os bancos</option>${opcoesBancos(d.bancos, filtrosHistorico.banco)}</select>
        <select id="filtroCategoria"><option value="">Todas as categorias</option>${opcoes(todasCategorias, filtrosHistorico.categoria)}</select>
        <input type="search" id="filtroBusca" placeholder="Buscar por descrição…" value="${esc(filtrosHistorico.busca)}">
      </div>
      ${card("c12", "Movimentações", `${plural(lista.length, "resultado")}`, "", corpo)}
    `;
  }

  // =========================================================================
  // INVESTIMENTOS (renda fixa, tesouro, fundos, cripto...)
  // =========================================================================

  // ---------- Buscar: atualiza investimentos pelos índices oficiais ----------
  // Renda fixa pós-fixada (% do CDI, CDI +, Selic +), prefixada e IPCA +:
  // aplica a variação do índice desde o último valor registrado até hoje.
  // É uma estimativa — o extrato do banco continua sendo a referência exata.
  const INDEXADORES_ATUALIZAVEIS = ["% do CDI", "CDI +", "Selic +", "Prefixado", "IPCA +"];
  function fatorInvestimento(inv, desde, cdi, selic, ipca) {
    const taxa = Number(inv.taxaContratada || 0);
    const dias = cdi.filter((x) => x.data > desde);               // dias úteis do período
    const n = dias.length;
    const anual = (t) => Math.pow(1 + t / 100, n / 252);
    const produto = (lista, mult) => lista.filter((x) => x.data > desde).reduce((f, x) => f * (1 + (x.valor / 100) * mult), 1);
    switch (inv.indexador) {
      case "% do CDI": return produto(cdi, (taxa || 100) / 100);
      case "CDI +": return produto(cdi, 1) * anual(taxa);
      case "Selic +": return produto(selic, 1) * anual(taxa);
      case "Prefixado": return anual(taxa);
      case "IPCA +": {
        // IPCA dos meses que já terminaram dentro do período + taxa real
        const meses = ipca.filter((x) => x.data.slice(0, 7) >= desde.slice(0, 7) && x.data.slice(0, 7) < new Date().toISOString().slice(0, 7));
        return meses.reduce((f, x) => f * (1 + x.valor / 100), 1) * anual(taxa);
      }
      default: return 1;
    }
  }

  let buscandoInvestimentos = false;
  function buscarInvestimentos() {
    if (buscandoInvestimentos) return;
    const hj = new Date(); const hoje = `${hj.getFullYear()}-${String(hj.getMonth() + 1).padStart(2, "0")}-${String(hj.getDate()).padStart(2, "0")}`;   // data local
    const candidatos = DADOS.investimentos.filter((i) => INDEXADORES_ATUALIZAVEIS.indexOf(i.indexador) !== -1 &&
      Number(i.valorAtual) > 0 && (!i.dataVencimento || i.dataVencimento >= hoje));
    const semIndice = DADOS.investimentos.length - candidatos.length;
    if (!candidatos.length) { toast("Nenhum investimento com índice para atualizar (use % do CDI, CDI +, Selic +, Prefixado ou IPCA +)."); return; }
    const ultimaData = (i) => (i.historicoValores || []).reduce((m, p) => (p.data > m ? p.data : m), i.dataAplicacao || "") || hoje;
    const inicio = candidatos.map(ultimaData).reduce((m, x) => (x < m ? x : m), hoje);
    if (inicio >= hoje) { toast("Os investimentos já estão atualizados hoje."); return; }
    buscandoInvestimentos = true;
    toast("Buscando índices no Banco Central…");
    const inicioIPCA = inicio.slice(0, 8) + "01";
    Promise.all([
      Cotacoes.buscarSerieBCB(12, inicio, hoje),
      Cotacoes.buscarSerieBCB(11, inicio, hoje),
      Cotacoes.buscarSerieBCB(433, inicioIPCA, hoje)
    ]).then(([cdi, selic, ipca]) => {
      let atualizados = 0, jaEmDia = 0;
      candidatos.forEach((inv) => {
        const desde = ultimaData(inv);
        if (desde >= hoje) { jaEmDia++; return; }
        const fator = fatorInvestimento(inv, desde, cdi, selic, ipca);
        if (!isFinite(fator) || fator <= 0 || Math.abs(fator - 1) < 1e-9) { jaEmDia++; return; }
        const antes = Number(inv.valorAtual);
        const depois = Math.round(antes * fator * 100) / 100;
        // IR informado pelo banco: soma o imposto estimado sobre o rendimento novo
        if (inv.irBanco != null) {
          const aliq = I.aliquotaIR(inv) / 100;
          inv.irBanco = Math.round((Number(inv.irBanco) + (depois - antes) * aliq) * 100) / 100;
          inv.liquidoBanco = Math.round((depois - inv.irBanco) * 100) / 100;
        }
        inv.valorAtual = depois;
        inv.historicoValores = (inv.historicoValores || []).filter((p) => p.data !== hoje);
        inv.historicoValores.push({ data: hoje, valor: depois });
        atualizados++;
      });
      buscandoInvestimentos = false;
      if (atualizados) salvarEAtualizar(`${plural(atualizados, "investimento atualizado", "investimentos atualizados")} pelos índices do Banco Central.` + (semIndice ? ` ${plural(semIndice, "outro sem índice", "outros sem índice")}.` : ""));
      else toast("Nenhuma variação nova dos índices desde a última atualização.");
    }).catch((e) => {
      buscandoInvestimentos = false;
      // a internet pode estar ok: o problema costuma ser o Banco Central não responder
      toast(typeof navigator !== "undefined" && navigator.onLine === false
        ? "Sem internet — tente de novo quando a conexão voltar."
        : "O Banco Central não respondeu agora (" + ((e && e.message) || "erro") + "). Tente de novo em alguns minutos.");
      console.warn("Banco Central:", e && e.message);
    });
  }

  // nome na tabela sem os detalhes entre parênteses que vêm do extrato importado
  // (ex.: "RDB Resgate Imediato (Caixinha Turbo Croma)" → "RDB Resgate Imediato")
  const nomeCurtoInvestimento = (nome) => String(nome || "").replace(/\s*\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim() || String(nome || "");
  function renderInvestimentos(d) {
    const lista = I.listaInvestimentosComCalculo(d);
    const t = I.totaisInvestimentos(d);
    const dispensados = (d.config && d.config.vencDispensados) || [];
    const vencendo = I.investimentosVencendoEm(d, 60)
      .filter((v) => dispensados.indexOf(v.id + ":" + (v.dataVencimento || "")) === -1);
    const f2 = (v) => Number(v || 0).toFixed(2).replace(".", ",");

    let corpo;
    if (!lista.length) {
      corpo = `<div class="empty">Nenhum investimento cadastrado ainda. Ações, FIIs e ETFs têm sua própria área — use aqui para renda fixa, tesouro, fundos e cripto.</div>`;
    } else {
      const linhas = lista.map((inv) => `
        <tr data-acao="ir" data-secao="detalhe-investimento" data-id="${inv.id}">
          <td class="papel" title="${esc(inv.nome)}">${esc(nomeCurtoInvestimento(inv.nome))}<small>${esc([inv.tipoAtivo || inv.categoria, inv.banco || inv.emissor].filter(Boolean).join(" · "))}</small></td>
          <td class="col-contratada">${esc(inv.indexador || "—")}${inv.taxaContratada ? " " + f2(inv.taxaContratada) + "%" : ""}</td>
          <td class="r">${fmtData(inv.dataAplicacao)}</td>
          <td class="r">${inv.quantidade ? f2(inv.quantidade) : "—"}</td>
          <td class="r creme">${brl(inv.valorInvestido)}</td>
          <td class="r ${corSinal(inv.resultado)}">${brlSinal(inv.resultado)}</td>
          <td class="r creme">${brl(inv.valorAtual)}</td>
          <td class="r dim col-ir">${inv.aliquota === 0 ? "isento" : f2(inv.aliquota) + "%"}</td>
          <td class="r down">${inv.imposto > 0 ? "−" + brl(inv.imposto) : "—"}</td>
          <td class="r up">${brl(inv.liquido)}</td>
          <td class="r ${inv.diasVenc !== null && inv.diasVenc <= 30 ? "acc" : "dim"}">${inv.diasVenc === null ? "—" : inv.diasVenc + "d"}</td>
          <td class="r">${inv.dataVencimento ? fmtData(inv.dataVencimento) : "—"}</td>
          <td class="r ${corSinal(inv.rentBruta)}">${pct(inv.rentBruta)}</td>
          <td class="r ${corSinal(inv.rentLiquida)}">${pct(inv.rentLiquida)}</td>
          <td class="r ${inv.rentAno === null ? "dim" : corSinal(inv.rentAno)}">${inv.rentAno === null ? "—" : pct(inv.rentAno)}</td>
        </tr>`).join("");
      corpo = `<div class="terminal-scroll"><table class="terminal tab-investimentos">
        <thead><tr>
          <th>Ativo</th><th class="col-contratada">Rentab. contratada</th><th class="r">Aplicação</th>
          <th class="r">Cotas</th><th class="r">Aplicado</th><th class="r">Resultado</th><th class="r">Bruto</th>
          <th class="r col-ir">IR</th><th class="r">Imposto</th><th class="r">Líquido</th><th class="r">Faltam</th><th class="r">Vencimento</th>
          <th class="r">Rent. bruta</th><th class="r">Rent. líquida</th><th class="r">Ao ano</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr>
          <td>TOTAL</td><td class="col-contratada"></td><td></td><td></td>
          <td class="r creme">${brl(t.aplicado)}</td>
          <td class="r ${corSinal(t.resultado)}">${brlSinal(t.resultado)}</td>
          <td class="r creme">${brl(t.bruto)}</td>
          <td class="col-ir"></td>
          <td class="r down">${t.imposto > 0 ? "−" + brl(t.imposto) : "—"}</td>
          <td class="r up">${brl(t.liquido)}</td>
          <td></td><td></td>
          <td class="r ${corSinal(t.rentBruta)}">${pct(t.rentBruta)}</td>
          <td class="r ${corSinal(t.rentLiquida)}">${pct(t.rentLiquida)}</td>
          <td></td>
        </tr></tfoot>
      </table></div>`;
    }

    const aviso = vencendo.length
      ? `<div class="faixa-demo" style="border-color:rgba(255,194,51,.3)">
          <div><b class="acc">${plural(vencendo.length, "investimento")} vencendo nos próximos 60 dias:</b> ${vencendo.map((v) => esc(nomeCurtoInvestimento(v.nome)) + " (" + fmtData(v.dataVencimento) + ")").join(" · ")}</div>
          <button class="fechar" data-acao="dispensar-vencimentos" title="Não avisar mais sobre estes vencimentos" aria-label="Dispensar aviso">×</button>
        </div>`
      : "";

    return `
      ${aviso}
      <div class="grid g-top">
        <div class="c12">${card("", "Investimentos", "renda fixa, tesouro, fundos e cripto",
          `<div class="pilulas-cripto"><div class="dolar-pill cripto-pill" id="criptoBTC" style="display:none"></div>
           <div class="dolar-pill cripto-pill" id="criptoETH" style="display:none"></div></div>
           <button class="btn" data-acao="buscar-investimentos" title="Atualizar os investimentos pelos índices do Banco Central (CDI, Selic, IPCA)">↻ Buscar</button>
           <button class="btn primario" data-acao="novo-investimento"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`,
          corpo,
          `<span class="dim">Total líquido</span><b class="creme" style="font-size:14px;font-weight:800">${brlSinal(t.liquido)}</b>`)}</div>
      </div>
    `;
  }

  function abrirModalInvestimento(id) {
    const inv = id ? achar(DADOS.investimentos, id) : null;
    abrirModal(`
      <h3>${inv ? "Editar investimento" : "Novo investimento"}</h3>

      <div class="sechead">IDENTIFICAÇÃO</div>
      <div class="campo"><label for="f_nome">Nome do ativo</label><input id="f_nome" value="${inv ? esc(inv.nome) : ""}" placeholder="CDB Banco Inter 110% CDI"></div>
      <div class="par">
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(CATS_INVESTIMENTO, inv ? inv.categoria : CATS_INVESTIMENTO[0])}</select></div>
        <div class="campo"><label for="f_tipo">Tipo do ativo</label><select id="f_tipo">${opcoes(TIPOS_ATIVO_RF, inv ? inv.tipoAtivo : "CDB")}</select></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_emissor">Emissor / corretora</label>${campoBanco("f_emissor", inv ? inv.emissor || "" : "", "Selecione o emissor…")}</div>
        <div class="campo"><label for="f_liq">Liquidez</label><select id="f_liq">${opcoes(LIQUIDEZ, inv ? inv.liquidez : LIQUIDEZ[0])}</select></div>
      </div>
      <div class="campo"><label for="f_banco">Banco onde está custodiado</label>${campoBanco("f_banco", inv ? inv.banco || "" : "", "Selecione o banco…")}
        <div class="ajuda">Onde o ativo aparece hoje — pode ser diferente do emissor (ex.: um CDB do Banco Digimais guardado no Nubank).</div></div>

      <div class="sechead">APLICAÇÃO</div>
      <div class="par">
        <div class="campo"><label for="f_vi">Valor Aplicado</label>${campoMoeda("f_vi", inv ? inv.valorInvestido : "")}</div>
        <div class="campo"><label for="f_qtd">Quantidade de cotas</label><input id="f_qtd" type="number" step="0.00000001" value="${inv ? inv.quantidade || "" : ""}" placeholder="opcional"></div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_data">Data da aplicação</label><input id="f_data" type="date" value="${inv ? inv.dataAplicacao : hojeISO()}"></div>
        <div class="campo"><label for="f_venc">Data de vencimento</label><input id="f_venc" type="date" value="${inv ? inv.dataVencimento || "" : ""}"></div>
      </div>

      <div class="sechead">RENTABILIDADE CONTRATADA</div>
      <div class="par">
        <div class="campo"><label for="f_idx">Indexador</label><select id="f_idx">${opcoes(INDEXADORES, inv ? inv.indexador : INDEXADORES[1])}</select></div>
        <div class="campo"><label for="f_taxa">Taxa contratada (%)</label><input id="f_taxa" type="number" step="0.01" value="${inv ? inv.taxaContratada || "" : ""}" placeholder="110">
          <div class="ajuda">Ex.: 110 para 110% do CDI, ou 6,5 para IPCA + 6,5% ao ano.</div></div>
      </div>

      <div class="sechead">SITUAÇÃO ATUAL</div>
      <div class="campo"><label for="f_va">Valor bruto atual</label>${campoMoeda("f_va", inv ? inv.valorAtual : "")}
        <div class="ajuda">Valor que aparece hoje no extrato, antes do imposto.</div></div>
      <label class="chk-linha"><input type="checkbox" id="f_isento" ${inv && inv.isentoIR ? "checked" : ""}> Isento de imposto de renda (LCI, LCA, CRI, CRA, poupança…)</label>
      <div id="previaIR" class="previa-ir"></div>

      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${inv ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`, true);

    // prévia do imposto, recalculada enquanto o usuário digita
    const atualizarPrevia = () => {
      const simulado = {
        valorInvestido: numIn(document.getElementById("f_vi").value),
        valorAtual: numIn(document.getElementById("f_va").value),
        dataAplicacao: document.getElementById("f_data").value || hojeISO(),
        tipoAtivo: document.getElementById("f_tipo").value,
        isentoIR: document.getElementById("f_isento").checked
      };
      const el = document.getElementById("previaIR");
      if (!el) return;
      if (!(simulado.valorInvestido > 0) || !(simulado.valorAtual > 0)) { el.innerHTML = ""; return; }
      const dias = I.diasCorridos(simulado);
      const aliq = I.aliquotaIR(simulado);
      const imp = I.impostoInvestimento(simulado);
      const liq = I.valorLiquidoInvestimento(simulado);
      const rl = I.rentabilidadeLiquida(simulado);
      const ra = I.rentabilidadeAnualizada(simulado, true);
      el.innerHTML = `
        <div class="kv"><span class="dim">Dias corridos</span><b>${dias}</b></div>
        <div class="kv"><span class="dim">Alíquota de IR</span><b>${aliq === 0 ? "isento" : aliq.toFixed(1).replace(".", ",") + "%"}</b></div>
        <div class="kv"><span class="dim">Imposto estimado</span><b class="down">${brl(imp)}</b></div>
        <div class="kv"><span class="dim">Total líquido</span><b class="up">${brl(liq)}</b></div>
        <div class="kv"><span class="dim">Rentabilidade líquida</span><b class="${corSinal(rl)}">${pct(rl)}${ra !== null ? ` · ${pct(ra)} ao ano` : ""}</b></div>`;
    };
    ["f_vi", "f_va", "f_data", "f_tipo", "f_isento"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.addEventListener("input", atualizarPrevia); el.addEventListener("change", atualizarPrevia); }
    });
    atualizarPrevia();

    document.getElementById("btnSalvar").onclick = () => {
      const nome = document.getElementById("f_nome").value.trim();
      if (!nome) { toast("Informe o nome do investimento."); return; }
      const registro = {
        id: inv ? inv.id : A.novoId(),
        nome,
        categoria: document.getElementById("f_cat").value,
        tipoAtivo: document.getElementById("f_tipo").value,
        emissor: lerCampoBanco("f_emissor"),
        banco: lerCampoBanco("f_banco"),
        liquidez: document.getElementById("f_liq").value,
        valorInvestido: numIn(document.getElementById("f_vi").value),
        quantidade: numIn(document.getElementById("f_qtd").value),
        dataAplicacao: document.getElementById("f_data").value || hojeISO(),
        dataVencimento: document.getElementById("f_venc").value,
        indexador: document.getElementById("f_idx").value,
        taxaContratada: numIn(document.getElementById("f_taxa").value),
        valorAtual: numIn(document.getElementById("f_va").value),
        isentoIR: document.getElementById("f_isento").checked,
        historicoValores: adicionarPontoValor(inv ? inv.historicoValores : [], numIn(document.getElementById("f_va").value)),
        obs: inv ? inv.obs || "" : ""   // sem campo na tela: mantém a observação que já existia
      };
      if (inv) { delete inv.irBanco; delete inv.liquidoBanco; Object.assign(inv, registro); }
      else DADOS.investimentos.push(registro);
      fecharModal();
      salvarEAtualizar(inv ? "Investimento atualizado." : "Investimento cadastrado.");
    };
    if (inv) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      confirmarExclusao(`Excluir "${inv.nome}"?`, () => {
        DADOS.investimentos = DADOS.investimentos.filter((r) => r.id !== inv.id);
        salvarEAtualizar("Investimento excluído.");
      });
    };
  }


  // =========================================================================
  // DETALHE DA APLICAÇÃO (mesma lógica da tela de detalhe das ações)
  // =========================================================================
  function adicionarPontoValor(historico, valor) {
    const hist = (historico || []).slice();
    const hj = hojeISO();
    if (!(valor > 0)) return hist;
    if (hist.length && hist[hist.length - 1].data === hj) hist[hist.length - 1].valor = valor;
    else hist.push({ data: hj, valor });
    if (hist.length > 400) hist.shift();
    return hist;
  }


  // Histórico usado no gráfico da aplicação: os valores registrados e, se
  // faltar, o ponto inicial (data da aplicação, valor aplicado) e o valor
  // atual hoje — assim o gráfico aparece mesmo com só um registro.
  function historicoGraficoInvestimento(inv) {
    const hist = (inv.historicoValores || []).filter((p) => p && p.data && Number(p.valor) > 0)
      .slice().sort((a, b) => (a.data < b.data ? -1 : 1));
    const aplicado = Number(inv.valorInvestido || 0), atual = Number(inv.valorAtual || 0), hoje = hojeISO();
    if (inv.dataAplicacao && aplicado > 0 && (!hist.length || inv.dataAplicacao < hist[0].data)) hist.unshift({ data: inv.dataAplicacao, valor: aplicado });
    if (atual > 0 && (!hist.length || hist[hist.length - 1].data < hoje)) hist.push({ data: hoje, valor: atual });
    return hist;
  }

  function explicarPontoInvestimento(inv, ponto, idx, historico) {
    if (!inv || !ponto) return;
    const aplicado = Number(inv.valorInvestido || 0);
    const anterior = idx > 0 ? historico[idx - 1] : null;
    const resultado = ponto.valor - aplicado;
    const varAnt = anterior ? ponto.valor - anterior.valor : 0;
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    painelSimples(`${esc(nomeCurtoInvestimento(inv.nome))} · ${fmtData(ponto.data)}`, aplicado > 0 ? (resultado / aplicado) * 100 : 0,
      "de rendimento sobre o valor aplicado", "(valor na data ÷ valor aplicado − 1) × 100",
      linha("Valor na data", brlSinal(ponto.valor)) +
      linha("Valor Aplicado", brlSinal(aplicado)) +
      linha("Resultado", brlSinal(resultado), corSinal(resultado)) +
      (anterior ? linha("Registro anterior", `${brlSinal(anterior.valor)} · ${fmtData(anterior.data)}`) : "") +
      (anterior ? linha("Variação", brlSinal(varAnt), corSinal(varAnt)) : "") +
      linha("Valor atual", brlSinal(inv.valorAtual)),
      "investimentos",
      { rotulo: "Editar", acao: () => abrirModalInvestimento(inv.id) });
  }

  function renderDetalheInvestimento(d, id) {
    const inv = achar(d.investimentos, id);
    if (!inv) return `<div class="empty">Aplicação não encontrada. <button class="link-acao" data-acao="ir" data-secao="investimentos">Voltar para Investimentos</button></div>`;

    // o gráfico ocupa a tela inteira (sem o quadro de resumo ao lado)
    const hist = historicoGraficoInvestimento(inv);
    const f2 = (v) => Number(v || 0).toFixed(2).replace(".", ",");

    return `
      <button class="voltar" data-acao="ir" data-secao="investimentos"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.voltar}</svg>Voltar para Investimentos</button>
      <div class="grid g-top">
        <div class="c12">${card("", `<span title="${esc(inv.nome)}">${esc(nomeCurtoInvestimento(inv.nome))}</span> <span class="selo-tag selo-acao">${esc(inv.tipoAtivo || inv.categoria)}</span>`,
          `${esc(inv.emissor || "emissor não informado")}${inv.indexador ? " · " + esc(inv.indexador) + (inv.taxaContratada ? " " + f2(inv.taxaContratada) + "%" : "") : ""}`,
          `${abasPeriodo()}<button class="btn" data-acao="editar-investimento" data-id="${inv.id}">Editar</button>`,
          hist.length >= 2
            ? `<div class="grafico-acao-area grafico-tela-cheia"><canvas id="graf-valor-investimento"></canvas></div>`
            : `<div class="empty">Ainda não há histórico suficiente para o gráfico.<br>Cada importação do extrato (ou edição do valor atual) acrescenta um ponto na linha.</div>`)}</div>
      </div>
    `;
  }

  function abrirModalNovoValor(id) {
    const inv = achar(DADOS.investimentos, id);
    if (!inv) return;
    abrirModal(`
      <h3>Lançar novo valor — ${esc(nomeCurtoInvestimento(inv.nome))}</h3>
      <div class="par">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${hojeISO()}"></div>
        <div class="campo"><label for="f_valor">Valor Bruto</label>${campoMoeda("f_valor", inv.valorAtual)}</div>
      </div>
      <p class="campo ajuda">Informe o saldo bruto que aparece hoje no extrato. O imposto e o valor líquido são recalculados automaticamente.</p>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvar">Salvar</button></div>`);
    document.getElementById("btnSalvar").onclick = () => {
      const valor = numIn(document.getElementById("f_valor").value);
      if (!(valor > 0)) { toast("Informe um valor maior que zero."); return; }
      const data = document.getElementById("f_data").value || hojeISO();
      const hist = (inv.historicoValores || []).slice();
      const existente = hist.find((p) => p.data === data);
      if (existente) existente.valor = valor; else hist.push({ data, valor });
      hist.sort((a, b) => a.data.localeCompare(b.data));
      inv.historicoValores = hist;
      inv.valorAtual = valor;
      delete inv.irBanco; delete inv.liquidoBanco;   // valor digitado à mão, sem confirmação do banco
      fecharModal();
      salvarEAtualizar("Valor lançado.");
    };
  }


  // =========================================================================
  // DETALHE DO DÓLAR (USD/BRL) — mesma estrutura da tela de uma ação
  // =========================================================================
  let serieDolar = null;        // série diária vinda da AwesomeAPI
  let buscandoSerieDolar = false;
  let velasDolar = true;        // true = gráfico em velas (tocar no gráfico alterna para a linha)
  let velasAcao = true;         // o mesmo para o gráfico de cada ação

  // Velas diárias a partir de um histórico de preços. Devolve todas as
  // velas (o zoom do gráfico pode mostrar mais ou menos dias) e quantas
  // cabem no período escolhido nas abas, que é a visão inicial.
  // Dias sem abertura/máxima/mínima gravadas (preço lançado à mão) usam o
  // fechamento anterior como abertura, e a máxima/mínima entre os dois.
  // O último dia recebe o preço atual.
  function velasPeriodo(historico, atual) {
    const serie = (historico || []).filter((p) => p.preco > 0).slice().sort((a, b) => (a.data < b.data ? -1 : 1));
    const velas = serie.map((p, i) => {
      const abertura = p.abertura > 0 ? p.abertura : (i > 0 ? serie[i - 1].preco : p.preco);
      return { data: p.data, preco: p.preco, abertura, volume: Number(p.volume) || 0,
        maxima: Math.max(p.maxima > 0 ? p.maxima : 0, abertura, p.preco),
        minima: Math.min(p.minima > 0 ? p.minima : Infinity, abertura, p.preco) };
    });
    if (atual > 0 && velas.length) {
      const hj = hojeISO(), ult = velas[velas.length - 1];
      if (ult.data === hj) { ult.preco = atual; ult.maxima = Math.max(ult.maxima, atual); ult.minima = Math.min(ult.minima, atual); }
      else velas.push({ data: hj, abertura: ult.preco, preco: atual, maxima: Math.max(ult.preco, atual), minima: Math.min(ult.preco, atual) });
    }
    const op = PERIODOS_GRAFICO.find((x) => x.chave === periodoGrafico);
    let visiveis = velas.length;
    if (op && op.dias) {
      const limite = new Date();
      limite.setDate(limite.getDate() - op.dias);
      const corte = limite.toISOString().slice(0, 10);
      visiveis = velas.filter((p) => p.data >= corte).length;
      if (visiveis < 2) visiveis = velas.length;
    }
    return { velas, visiveis };
  }
  // Notícias para os "N" nas velas: só os dias com variação forte são
  // consultados, um de cada vez (primeiro os que estão na tela, do mais
  // recente para o mais antigo), e cada dia fica guardado no aparelho —
  // notícia de um dia que já passou não muda.
  const NOTICIAS_MAX_DIAS = 40;
  // as notícias guardadas por versões anteriores (nt:, nt2:) são descartadas
  try { Object.keys(localStorage).forEach((k) => { if (/^nt2?:/.test(k)) localStorage.removeItem(k); }); } catch (e) { /* sem acesso */ }
  function lerNoticiasDia(chave, dia) {
    try {
      const r = JSON.parse(localStorage.getItem(`nt3:${chave}:${dia}`) || "null");
      if (!r) return null;
      // dia sem notícia (ou hoje) é consultado de novo depois de 2 horas
      if ((!r.itens.length || dia === hojeISO()) && Date.now() - r.t > 2 * 60 * 60 * 1000) return null;
      return r.itens;
    } catch (e) { return null; }
  }
  function gravarNoticiasDia(chave, dia, itens) {
    try { localStorage.setItem(`nt3:${chave}:${dia}`, JSON.stringify({ t: Date.now(), itens })); } catch (e) { /* sem espaço */ }
  }
  // Uma busca por ativo ("dolar", "acao:PETR4"…) que continua mesmo quando a
  // tela é redesenhada (cotações automáticas, sincronização, troca de período):
  // o redesenho só aponta a busca para o gráfico novo, em vez de recomeçá-la.
  //
  // Regras:
  // - notícia encontrada fica guardada no aparelho e aparece sempre, na hora;
  // - cada vez que o gráfico é ABERTO, uma busca nova procura as notícias que
  //   faltam (dias ainda sem notícia e os dias mais recentes, que podem ter
  //   notícias novas) e junta com as guardadas;
  // - uma busca em andamento nunca é reiniciada: abrir de novo ou redesenhar
  //   a tela só faz a busca continuar mostrando no gráfico atual.
  const buscasNoticias = {};
  let aberturaGrafico = 0;
  // primeiroPlano: chamada pelo gráfico aberto — essa busca tem prioridade e
  // as de segundo plano (outros ativos) esperam enquanto ela não termina
  let chaveNaTela = null;
  const outraNaFrente = (chave) => {
    const b = chaveNaTela && chaveNaTela !== chave ? buscasNoticias[chaveNaTela] : null;
    return !!(b && !b.terminou);
  };
  const esperarVez = (chave) => new Promise((ok) => {
    const ver = () => (outraNaFrente(chave) ? setTimeout(ver, 1000) : ok());
    ver();
  });
  function carregarNoticiasVelas(chave, termos, velas, visiveis, limiar, canvasId, aindaNaTela, primeiroPlano) {
    if (!C || !C.buscarNoticiasDia || typeof fetch !== "function") return Promise.resolve();
    if (primeiroPlano) chaveNaTela = chave;
    const existente = buscasNoticias[chave];
    if (existente && (!existente.terminou || existente.abertura === aberturaGrafico)) {
      existente.alvo = { canvasId, aindaNaTela, limiar };
      existente.mostrar();
      return existente.promessa;
    }
    const busca = buscasNoticias[chave] = { abertura: aberturaGrafico, alvo: { canvasId, aindaNaTela, limiar }, artigos: [], terminou: false, falhas: 0, dias: 0 };
    let fim;
    busca.promessa = new Promise((ok) => { fim = ok; });   // resolve quando a busca termina
    const fortes = [];
    velas.forEach((v, i) => {
      const ant = i > 0 ? velas[i - 1].preco : v.abertura;
      if (ant && Math.abs(v.preco / ant - 1) * 100 >= limiar) fortes.push(i);
    });
    const inicioTela = velas.length - visiveis;
    const ordem = fortes.filter((i) => i >= inicioTela).reverse().concat(fortes.filter((i) => i < inicioTela).reverse()).slice(0, NOTICIAS_MAX_DIAS);
    busca.dias = ordem.length;
    // mostra o que já tem no gráfico que estiver na tela; durante a busca, sem
    // aviso; no fim, um aviso só se não achou nada
    busca.mostrar = () => {
      const alvo = busca.alvo;
      if (!alvo.aindaNaTela()) return;
      G.definirNoticias(alvo.canvasId, busca.artigos.slice(), alvo.limiar);
      let txt = "";
      if (busca.terminou && !busca.artigos.length) {
        txt = busca.falhas ? "sem conexão com as fontes" : (busca.dias ? "nenhuma nos dias de maior variação" : "sem dias de grande variação");
      } else if (busca.terminou && busca.semResposta) {
        // achou algumas, mas parte dos dias ficou sem resposta (tenta de novo na próxima abertura)
        txt = `${busca.semResposta} ${busca.semResposta === 1 ? "dia" : "dias"} sem resposta das fontes`;
      }
      G.statusNoticias(alvo.canvasId, txt);
    };
    // notícias por dia, sem repetir (a mesma matéria pode vir em várias buscas)
    const porDia = {};
    const guardar = (dia, itens) => {
      const lista = porDia[dia] || (porDia[dia] = []);
      itens.forEach((n) => { if (!lista.some((x) => x.url === n.url)) lista.push(n); });
      lista.sort((a, b) => (a.quando < b.quando ? 1 : -1));
      busca.artigos = Object.keys(porDia).reduce((t, d) => t.concat(porDia[d].map((n) => ({ ...n, data: d }))), []);
      return lista;
    };
    // junta as novas com as guardadas e grava no aparelho
    const salvar = (dia, itens) => gravarNoticiasDia(chave, dia, guardar(dia, itens).slice(0, 8));
    // primeiro o que já está guardado no aparelho (aparece na hora); os dias
    // dos últimos 3 dias são consultados de novo mesmo assim (notícias novas)
    const limiteRecente = (() => { const d = new Date(); d.setDate(d.getDate() - 3); return d.toISOString().slice(0, 10); })();
    const faltam = [];
    ordem.forEach((i) => {
      const dia = velas[i].data, salvo = lerNoticiasDia(chave, dia);
      if (salvo) guardar(dia, salvo);
      if (!salvo || dia >= limiteRecente) faltam.push(dia);
    });
    const encerrar = () => { busca.terminou = true; busca.mostrar(); fim(); };
    if (!faltam.length) { encerrar(); return busca.promessa; }
    busca.mostrar();
    // depois busca na internet: primeiro UMA busca para o período todo (mostra
    // a maior parte dos "N" de uma vez), depois dia a dia só os que faltarem
    const isoLocal = (q) => { const d = new Date(q); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const vespera = (dia) => { const d = new Date(dia + "T12:00:00"); d.setDate(d.getDate() - 1); return isoLocal(d); };
    const fila = faltam.slice();
    // um dia de cada vez; dia que falhar volta para o fim da fila (até 3
    // tentativas) e a pausa cresce a cada falha seguida (as fontes gratuitas
    // recusam quando recebem pedidos demais) — a busca nunca desiste no meio
    const tentativas = {};
    let seguidas = 0, ativos = 0;
    const proximo = () => {
      if (!fila.length) {
        if (--ativos <= 0 && !busca.terminou) encerrar();
        return Promise.resolve();
      }
      // outro ativo está aberto na tela e ainda buscando: ele vai primeiro
      if (outraNaFrente(chave)) return esperarVez(chave).then(proximo);
      const dia = fila.shift();
      tentativas[dia] = (tentativas[dia] || 0) + 1;
      return C.buscarNoticiasDia(termos, dia).then((itens) => {
        seguidas = 0;
        if (itens.length) { salvar(dia, itens); busca.mostrar(); }
        else if (!porDia[dia]) gravarNoticiasDia(chave, dia, []);   // dia sem notícia (consulta de novo depois)
      }).catch(() => {
        seguidas++;
        if (tentativas[dia] < 3) fila.push(dia);
        else { busca.falhas++; busca.semResposta = (busca.semResposta || 0) + 1; }
      }).then(() => new Promise((ok) => setTimeout(ok, Math.min(15000, 900 * Math.pow(2, seguidas)))))
        .then(proximo);
    };
    const ordenados = faltam.slice().sort();
    const porPeriodo = C.buscarNoticiasPeriodo
      ? esperarVez(chave).then(() => C.buscarNoticiasPeriodo(termos, ordenados[0], ordenados[ordenados.length - 1])).then((itens) => {
        // cada notícia vale para o dia dela e para o dia seguinte (véspera)
        faltam.forEach((dia) => {
          const doDia = itens.filter((n) => { const d = isoLocal(n.quando); return d === dia || d === vespera(dia); })
            .sort((x, y) => (isoLocal(y.quando) === dia) - (isoLocal(x.quando) === dia) || (x.quando < y.quando ? 1 : -1)).slice(0, 5);
          if (!doDia.length) return;
          salvar(dia, doDia);
          fila.splice(fila.indexOf(dia), 1);
        });
        busca.mostrar();
      }).catch(() => { /* sem a busca do período: o dia a dia cobre */ })
      : Promise.resolve();
    // o ativo aberto na tela busca dois dias por vez; os de segundo plano, um
    porPeriodo.then(() => {
      ativos = chaveNaTela === chave ? 2 : 1;
      for (let k = 0; k < ativos; k++) proximo();
    });
    return busca.promessa;
  }

  // atalhos: notícias do dólar e de uma ação (usados pelo gráfico e pela
  // busca em segundo plano)
  function noticiasDoDolar(primeiroPlano) {
    const vd = velasDolarPeriodo();
    if (vd.velas.length < 2) return Promise.resolve();
    // "N" nas velas em que o dólar variou 0,35% ou mais e houve notícia
    return carregarNoticiasVelas("dolar", { google: "dólar", gdelt: "(dólar OR câmbio) real" }, vd.velas, vd.visiveis, 0.35, "graf-dolar",
      () => ROTA.secao === "detalhe-dolar" && velasDolar, primeiroPlano);
  }
  function noticiasDaAcao(a, primeiroPlano) {
    const va = velasPeriodo(a.historicoPrecos, Number(a.precoAtual) || 0);
    if (va.velas.length < 2) return Promise.resolve();
    // "N" nas velas em que a ação variou 1% ou mais e houve notícia; só
    // aparece se estiver no gráfico desta ação, em velas
    const idAcao = a.id;
    return carregarNoticiasVelas("acao:" + a.ticker.toUpperCase(), termosNoticiasAcao(a), va.velas, va.visiveis, 1, "graf-preco-acao",
      () => ROTA.secao === "detalhe-acao" && ROTA.param === idAcao && velasAcao, primeiroPlano);
  }

  // Busca em SEGUNDO PLANO: logo depois de abrir o app (e a cada 30 min),
  // procura as notícias do dólar e de todas as ações, uma de cada vez, e
  // guarda no aparelho. Ao abrir o gráfico, os "N" já aparecem direto.
  let noticiasSegundoPlano = false;
  function buscarNoticiasEmSegundoPlano() {
    if (noticiasSegundoPlano || !C || typeof fetch !== "function") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    noticiasSegundoPlano = true;
    aberturaGrafico++;   // conta como uma "abertura": busca as notícias novas (sem reiniciar as em andamento)
    let fila = carregarSerieDolar().then(() => noticiasDoDolar()).catch(() => {});
    // uma de cada vez, com uma pausa entre elas (limites dos serviços gratuitos)
    const pausa = () => new Promise((ok) => setTimeout(ok, 2000));
    (DADOS.acoes || []).forEach((a) => { fila = fila.then(pausa).then(() => noticiasDaAcao(a)).catch(() => {}); });
    fila.then(() => { noticiasSegundoPlano = false; });
  }

  // termos de busca de uma ação: o ticker e o nome da empresa sem a classe
  // (PN, ON, UNT…) — ex.: PETR4 OR "Petrobras"
  function termosNoticiasAcao(a) {
    const nome = String(a.empresa || "").replace(/\b(PN|ON|PNA|PNB|UNT|N1|N2|NM|S\.?A\.?|SA|CI|FII|ER|EJ|ED)\b\.?/gi, "").replace(/\s+/g, " ").trim();
    const tk = a.ticker.toUpperCase();
    if (nome.length < 4) return { google: tk, gdelt: tk };
    const n = `"${nome.replace(/"/g, "")}"`;
    return { google: `${tk} OR ${n}`, gdelt: `(${tk} OR ${n})` };
  }

  // Com o zoom das velas, marca a aba de período que corresponde ao
  // intervalo na tela: o menor período que cobre do primeiro ao último dia
  // visível (ou "Tudo" quando o histórico inteiro está na tela).
  function marcarPeriodoDoZoom(primeira, ultima, tudo) {
    const dias = Math.round((new Date(ultima + "T00:00:00") - new Date(primeira + "T00:00:00")) / 86400000);
    const op = tudo ? PERIODOS_GRAFICO.find((x) => !x.dias)
      : (PERIODOS_GRAFICO.find((x) => x.dias && dias <= x.dias) || PERIODOS_GRAFICO.find((x) => !x.dias));
    if (!op) return;
    periodoGrafico = op.chave;
    document.querySelectorAll('.abas-periodo [data-acao="periodo-grafico"]').forEach((b) => b.classList.toggle("ativo", b.dataset.periodo === op.chave));
  }

  function velasDolarPeriodo() {
    return velasPeriodo((serieDolar || []).filter((p) => p.abertura > 0), dolar ? dolar.valor : 0);
  }

  let promessaSerieDolar = null;
  function carregarSerieDolar() {
    if (serieDolar) return Promise.resolve(serieDolar);
    if (buscandoSerieDolar) return promessaSerieDolar;
    if (!C || typeof fetch !== "function") return Promise.resolve(null);
    buscandoSerieDolar = true;
    promessaSerieDolar = C.buscarSerieDolar(365).then((serie) => {
      serieDolar = serie;
      buscandoSerieDolar = false;
      if (ROTA.secao === "detalhe-dolar") renderRota();
      return serie;
    }).catch(() => { buscandoSerieDolar = false; return null; });
    return promessaSerieDolar;
  }

  // o gráfico ocupa a tela inteira (sem o quadro de resumo ao lado)
  function renderDetalheDolar() {
    const serie = serieDolar || [];
    const filtrada = filtrarPeriodo(serie.map((p) => ({ data: p.data, preco: p.preco })), periodoGrafico);

    return `
      <button class="voltar" data-acao="ir" data-secao="acoes"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.voltar}</svg>Voltar para Ações</button>
      <div class="grid g-top">
        <div class="c12">${card("", `USD/BRL <span class="selo-tag selo-acao">moeda</span>`,
          "dólar comercial · AwesomeAPI",
          `${abasPeriodo()}<button class="btn" data-acao="buscar-cotacoes">↻ Buscar</button>`,
          filtrada.length >= 2
            ? `<div class="grafico-acao-area grafico-tela-cheia"><canvas id="graf-dolar"></canvas></div>`
            : `<div class="empty">${buscandoSerieDolar ? "Carregando o histórico do dólar…" : "Não foi possível carregar o histórico agora. Verifique a internet e toque em ↻ Buscar."}</div>`)}</div>
      </div>
    `;
  }

  // =========================================================================
  // DETALHE DE UMA CRIPTOMOEDA (BTC, ETH) — mesma tela do dólar, com a
  // quantidade que você tem e o botão para adicionar/editar
  // =========================================================================
  const seriesCripto = {};      // { BTC: [...], ETH: [...] } — série diária da AwesomeAPI
  const promessasSerieCripto = {};
  function carregarSerieCripto(m) {
    if (seriesCripto[m]) return Promise.resolve(seriesCripto[m]);
    if (promessasSerieCripto[m]) return promessasSerieCripto[m];
    if (!C || !C.buscarSerieMoeda || typeof fetch !== "function") return Promise.resolve(null);
    promessasSerieCripto[m] = C.buscarSerieMoeda(m + "-BRL", 365).then((serie) => {
      seriesCripto[m] = serie;
      delete promessasSerieCripto[m];
      completarHistoricoCripto(m, serie);
      if (ROTA.secao === "detalhe-cripto" && ROTA.param === m) renderRota();
      return serie;
    }).catch(() => { delete promessasSerieCripto[m]; return null; });
    return promessasSerieCripto[m];
  }
  function velasCriptoPeriodo(m) {
    const c = cripto && cripto[m];
    return velasPeriodo((seriesCripto[m] || []).filter((p) => p.abertura > 0), c ? c.valor : 0);
  }
  function noticiasDaCripto(m, primeiroPlano) {
    const vc = velasCriptoPeriodo(m);
    if (vc.velas.length < 2) return Promise.resolve();
    // "N" nas velas em que a moeda variou 3% ou mais e houve notícia
    const nome = CRIPTOS[m];
    return carregarNoticiasVelas("cripto:" + m, { google: nome, gdelt: `(${nome} OR ${m})` }, vc.velas, vc.visiveis, 3, "graf-cripto",
      () => ROTA.secao === "detalhe-cripto" && ROTA.param === m && velasDolar, primeiroPlano);
  }

  function renderDetalheCripto() {
    const m = ROTA.param;
    const voltar = `<button class="voltar" data-acao="ir" data-secao="investimentos"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.voltar}</svg>Voltar para Investimentos</button>`;
    if (!CRIPTOS[m]) return `${voltar}<div class="empty">Criptomoeda não encontrada.</div>`;
    const serie = seriesCripto[m] || [];
    const filtrada = filtrarPeriodo(serie.map((p) => ({ data: p.data, preco: p.preco })), periodoGrafico);
    const c = cripto && cripto[m];
    const q = qtdCripto(m);
    const btnQtd = `<button class="btn primario" data-cripto-qtd="${m}">${q ? "✎ Editar" : `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Adicionar`}</button>`;
    const v = c ? c.variacaoPct || 0 : 0;
    const rodape = `<span class="cripto-rodape"><span class="dim">Cotação</span><b class="creme">${c ? brl(c.valor) : "—"}</b>${c ? `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(2).replace(".", ",")}%</span>` : ""}</span>
      <span class="cripto-rodape"><span class="dim">${q ? `Você tem ${fmtQtdCripto(q)} ${m}` : `Você ainda não informou quantos ${m} tem`}</span>${q && precoCriptoAtual(m) ? `<b class="creme" style="font-size:14px;font-weight:800">${brl(q * precoCriptoAtual(m))}</b>` : ""}</span>`;

    return `
      ${voltar}
      <div class="grid g-top">
        <div class="c12">${card("", `${m}/BRL <span class="selo-tag selo-acao">cripto</span>`,
          `${CRIPTOS[m].toLowerCase()} · AwesomeAPI`,
          `${abasPeriodo()}<button class="btn" data-acao="buscar-cotacoes">↻ Buscar</button>${btnQtd}`,
          filtrada.length >= 2
            ? `<div class="grafico-acao-area grafico-tela-cheia"><canvas id="graf-cripto"></canvas></div>`
            : `<div class="empty">${promessasSerieCripto[m] ? `Carregando o histórico do ${CRIPTOS[m]}…` : "Não foi possível carregar o histórico agora. Verifique a internet e toque em ↻ Buscar."}</div>`,
          rodape)}</div>
      </div>
    `;
  }

  // =========================================================================
  // AÇÕES (terminal)
  // =========================================================================
  // =========================================================================
  // GUIA NASDAQ — relatório de mercado: Nasdaq, Nasdaq-100 e Ibovespa, as
  // maiores ações de cada bolsa e um resumo escrito a partir dos números.
  // Cotações do Yahoo Finance e da brapi (3 meses de histórico diário),
  // guardadas no aparelho para a guia abrir com o último retrato sem internet.
  // =========================================================================
  const MERCADO_INDICES = [
    { s: "^IXIC", nome: "Nasdaq Composite", curto: "Nasdaq" },
    { s: "^NDX", nome: "Nasdaq-100", curto: "Nasdaq-100" },
    { s: "^GSPC", nome: "S&P 500", curto: "S&P 500" },
    { s: "^BVSP", nome: "Ibovespa", curto: "Ibovespa" }
  ];
  const MERCADO_EUA = [
    ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["NVDA", "Nvidia"], ["AMZN", "Amazon"], ["GOOGL", "Alphabet"],
    ["META", "Meta"], ["TSLA", "Tesla"], ["AVGO", "Broadcom"], ["NFLX", "Netflix"], ["AMD", "AMD"],
    ["COST", "Costco"], ["PEP", "PepsiCo"], ["ADBE", "Adobe"], ["CSCO", "Cisco"], ["INTC", "Intel"],
    ["QCOM", "Qualcomm"], ["TXN", "Texas Instruments"], ["AMGN", "Amgen"], ["INTU", "Intuit"], ["PYPL", "PayPal"],
    ["SBUX", "Starbucks"], ["BKNG", "Booking"], ["MU", "Micron"], ["PLTR", "Palantir"], ["ASML", "ASML"]
  ];
  const MERCADO_BR = [
    ["PETR4", "Petrobras"], ["VALE3", "Vale"], ["ITUB4", "Itaú Unibanco"], ["BBDC4", "Bradesco"], ["BBAS3", "Banco do Brasil"],
    ["WEGE3", "WEG"], ["ABEV3", "Ambev"], ["B3SA3", "B3"], ["BPAC11", "BTG Pactual"], ["SUZB3", "Suzano"],
    ["ITSA4", "Itaúsa"], ["PETR3", "Petrobras ON"], ["ELET3", "Eletrobras"], ["RENT3", "Localiza"], ["PRIO3", "Prio"],
    ["EQTL3", "Equatorial"], ["RADL3", "Raia Drogasil"], ["RDOR3", "Rede D'Or"], ["GGBR4", "Gerdau"], ["CSNA3", "CSN"],
    ["VIVT3", "Vivo"], ["SBSP3", "Sabesp"], ["LREN3", "Lojas Renner"], ["MGLU3", "Magazine Luiza"], ["EMBJ3", "Embraer"],
    ["HAPV3", "Hapvida"], ["BBSE3", "BB Seguridade"], ["CMIG4", "Cemig"], ["TIMS3", "TIM"], ["UGPA3", "Ultrapar"],
    ["KLBN11", "Klabin"], ["CSAN3", "Cosan"], ["TOTS3", "Totvs"]
  ];
  const CHAVE_MERCADO = "mercado1";
  let mercado = (() => {
    try { const m = JSON.parse(localStorage.getItem(CHAVE_MERCADO) || "null"); if (m && m.cotacoes) return { ...m, carregando: false }; } catch (e) { /* sem acesso */ }
    return { cotacoes: {}, erros: {}, dolar: null, em: 0, carregando: false };
  })();
  // Notícias do mercado em separado das cotações, com reservas: a busca do
  // período (Google Notícias, GDELT) e, se vier vazia, as de hoje e de ontem
  const noticiasMercado = { buscando: false, tentativa: 0 };
  const TERMOS_MERCADO = { google: 'Nasdaq OR Ibovespa OR "Wall Street" OR "bolsa de valores"', gdelt: '(Nasdaq OR Ibovespa OR "Wall Street")' };
  function atualizarNoticiasMercado() {
    if (noticiasMercado.buscando) return;
    noticiasMercado.buscando = true; noticiasMercado.tentativa = Date.now();
    const isoDia = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const hoje = new Date(), ontem = new Date(), inicio = new Date();
    ontem.setDate(ontem.getDate() - 1); inicio.setDate(inicio.getDate() - 3);
    C.buscarNoticiasPeriodo(TERMOS_MERCADO, isoDia(inicio), isoDia(hoje)).catch(() => [])
      .then((lista) => lista && lista.length ? lista
        : Promise.all([C.buscarNoticiasDia(TERMOS_MERCADO, isoDia(hoje)).catch(() => []), C.buscarNoticiasDia(TERMOS_MERCADO, isoDia(ontem)).catch(() => [])]).then(([a, b]) => [...a, ...b]))
      .then((lista) => {
        if (lista && lista.length) {
          mercado.noticias = [...new Map(lista.map((n) => [n.titulo, n])).values()].sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, 20);
          mercado.noticiasEm = Date.now();
          try { localStorage.setItem(CHAVE_MERCADO, JSON.stringify({ ...mercado, carregando: false })); } catch (e) { /* sem espaço */ }
        }
      })
      .then(() => { noticiasMercado.buscando = false; if (ROTA.secao === "nasdaq") renderRota(); });
  }
  // Com a guia Bolsa aberta, tudo se atualiza sozinho: cotações a cada 10
  // minutos e notícias a cada 15 (sem notícias, nova tentativa a cada 2 minutos)
  setInterval(() => {
    if (ROTA.secao !== "nasdaq" || document.visibilityState === "hidden" || navigator.onLine === false) return;
    atualizarMercado(false, true);
    atualizarIndicadoresBCB(false);
    const semNoticias = !(mercado.noticias && mercado.noticias.length);
    const desde = Date.now() - (noticiasMercado.tentativa || 0);
    if (desde > (semNoticias ? 2 : 15) * 60 * 1000) atualizarNoticiasMercado();
  }, 30 * 1000);

  // Quadro interativo do CDI, da Selic (renda fixa) e do IPCA: gráfico da série
  // com períodos, os números principais, tocar num ponto mostra aquela data e
  // uma simulação simples (quanto rende / quanto perdeu de poder de compra)
  let periodoIndicador = "1a";
  function abrirIndicador(ind) {
    const bcb = mercado.bcb || {}, x = bcb[ind];
    if (!x || !x.serie || !x.serie.length) { toast("Buscando os dados no Banco Central…"); atualizarIndicadoresBCB(true); return; }
    const f2 = (v) => v == null ? "—" : `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const dataBR = (iso) => iso.length === 7 || ind === "ipca" ? ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(iso.slice(5, 7)) - 1] + "/" + iso.slice(0, 4) : iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
    const titulos = { cdi: "CDI", selic: "Renda fixa · Selic meta", ipca: "IPCA · inflação" };
    const subs = { cdi: "taxa DI ao ano · Banco Central (série 12)", selic: "taxa básica de juros · Banco Central (série 432)", ipca: "inflação oficial · IBGE via Banco Central (série 433)" };
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${r}</span><b class="${c || ""}">${v}</b></div>`;
    let numeros = "", simul = "";
    if (ind === "cdi") {
      numeros = linha("Taxa atual", f2(x.aa) + "% a.a.", "up") + linha("Acumulado no mês", f2(x.mes) + "%") + linha("Acumulado no ano", f2(x.ano) + "%") + linha("Últimos 12 meses", f2(x.d12) + "%");
      const r = 10000 * x.d12 / 100;
      simul = `R$ 10.000,00 aplicados a 100% do CDI nos últimos 12 meses renderam cerca de <b class="up">${brl(r)}</b> antes do imposto (total ${brl(10000 + r)}).`;
    } else if (ind === "selic") {
      numeros = linha("Selic meta", f2(x.aa) + "% a.a.", "up") + linha("Mudança em 30 dias", f2(x.var30) + " p.p.") + linha("Mudança em 12 meses", f2(x.var365) + " p.p.");
      const mensal = (Math.pow(1 + x.aa / 100, 1 / 12) - 1) * 100;
      simul = `Com a Selic em ${f2(x.aa)}% ao ano, R$ 10.000,00 rendem perto de <b class="up">${brl(10000 * mensal / 100)}</b> por mês (${f2(mensal)}% a.m.), antes do imposto.`;
    } else {
      numeros = linha("Acumulado em 12 meses", f2(x.d12) + "%", x.d12 > 0 ? "down" : "up") + linha(`Mês (${dataBR(x.data)})`, f2(x.mes) + "%", x.mes > 0 ? "down" : "up") + linha("Acumulado no ano", f2(x.ano) + "%");
      simul = `Com a inflação de ${f2(x.d12)}% em 12 meses, o que custava R$ 1.000,00 há um ano custa hoje cerca de <b class="down">${brl(1000 * (1 + x.d12 / 100))}</b>.`;
    }
    const PER = ind === "ipca" ? [["1a", "12 meses", 12], ["tudo", "Tudo", 0]] : [["90d", "3 meses", 90], ["6m", "6 meses", 182], ["1a", "1 ano", 366], ["tudo", "Tudo", 0]];
    if (!PER.some((p) => p[0] === periodoIndicador)) periodoIndicador = "1a";
    abrirModal(`
      <h3>${titulos[ind]}</h3><p class="dim" style="margin:-6px 0 10px;font-size:12px">${subs[ind]} · último dado: ${dataBR(x.data)}</p>
      <div class="abas abas-periodo ind-periodos">${PER.map((p) => `<button class="${p[0] === periodoIndicador ? "ativo" : ""}" data-per="${p[0]}">${p[1]}</button>`).join("")}</div>
      <div class="ind-graf"><canvas id="graf-indicador"></canvas></div>
      <div class="ind-ponto" id="indPonto">Toque num ponto do gráfico para ver o valor daquela data.</div>
      <div class="ind-numeros">${numeros}</div>
      <p class="ind-simul">${simul}</p>`, true);
    const desenhar = () => {
      const per = PER.find((p) => p[0] === periodoIndicador);
      let serie = x.serie;
      if (per[2]) {
        if (ind === "ipca") serie = serie.slice(-per[2]);
        else { const lim = new Date(); lim.setDate(lim.getDate() - per[2]); const iso = lim.toISOString().slice(0, 10); serie = serie.filter((p) => p[0] >= iso); }
      }
      const rot = serie.map((p) => ind === "ipca" ? dataBR(p[0]) : p[0].slice(8, 10) + "/" + p[0].slice(5, 7));
      const series = ind === "ipca"
        ? [{ rotulo: "Acumulado 12 meses", valores: serie.map((p) => p[2]), cor: G.CORES.down }, { rotulo: "No mês", valores: serie.map((p) => p[1]), cor: G.CORES.laranja }]
        : [{ rotulo: ind === "cdi" ? "CDI (% a.a.)" : "Selic meta (% a.a.)", valores: serie.map((p) => p[1]), cor: G.CORES.cy }];
      G.renderLinhaMultipla("graf-indicador", rot, series, {
        formato: (v) => f2(v) + "%",
        aoClicar: (i) => {
          const p = serie[i], el = document.getElementById("indPonto");
          if (!p || !el) return;
          el.innerHTML = ind === "ipca"
            ? `<b>${dataBR(p[0])}</b>: inflação de <b class="${p[1] > 0 ? "down" : "up"}">${f2(p[1])}%</b> no mês · <b>${f2(p[2])}%</b> em 12 meses`
            : `<b>${dataBR(p[0])}</b>: ${ind === "cdi" ? "CDI" : "Selic meta"} de <b class="up">${f2(p[1])}% ao ano</b>`;
        }
      });
    };
    document.querySelectorAll("#modal .ind-periodos button").forEach((bt) => bt.addEventListener("click", () => {
      periodoIndicador = bt.dataset.per;
      document.querySelectorAll("#modal .ind-periodos button").forEach((o) => o.classList.toggle("ativo", o === bt));
      desenhar();
    }));
    setTimeout(desenhar, 30);
  }

  let redesenhoMercado = null;
  // CDI, Selic e IPCA direto do Banco Central (séries do SGS), para as caixas
  // da guia Bolsa funcionarem sem o relatório: 12 = CDI diário (% a.d.),
  // 432 = Selic meta (% a.a.), 433 = IPCA mensal (% a.m.). Atualiza a cada 6 h.
  let buscandoBCB = false, tentativaBCB = 0;
  // último retrato do BCB guardado à parte (sobrevive a qualquer atualização das cotações)
  if (!mercado.bcb) { try { const b = JSON.parse(localStorage.getItem("bcb1") || "null"); if (b) mercado.bcb = b; } catch (e) { /* sem acesso */ } }
  function atualizarIndicadoresBCB(forcar) {
    // completo: renova a cada 30 min; faltando CDI, Selic ou IPCA: nova tentativa a cada 2 min
    const b0 = mercado.bcb, completo = b0 && b0.v === 2 && b0.cdi && b0.selic && b0.ipca;
    const espera = completo ? 30 * 60 * 1000 : 2 * 60 * 1000;
    if (buscandoBCB || (!forcar && Date.now() - ((completo ? b0.em : tentativaBCB) || 0) < espera)) return;
    buscandoBCB = true; tentativaBCB = Date.now();
    const isoDia = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const hoje = new Date(), umAno = new Date(), doisAnos = new Date();
    umAno.setDate(umAno.getDate() - 400); doisAnos.setMonth(doisAnos.getMonth() - 26);
    const acum = (xs) => (xs.reduce((a, v) => a * (1 + v / 100), 1) - 1) * 100;
    Promise.all([
      C.buscarSerieBCB(12, isoDia(umAno), isoDia(hoje)).catch(() => []),
      C.buscarSerieBCB(432, isoDia(umAno), isoDia(hoje)).catch(() => []),
      C.buscarSerieBCB(433, isoDia(doisAnos), isoDia(hoje)).catch(() => [])
    ]).then(([cdi, selic, ipca]) => {
      const bcb = { ...(mercado.bcb || {}), em: Date.now(), v: 2 };   // v2: séries com as datas (quadro interativo)
      if (cdi.length > 20) {
        const ult = cdi[cdi.length - 1], mes = ult.data.slice(0, 7), ano = ult.data.slice(0, 4);
        const aa = (d) => (Math.pow(1 + d / 100, 252) - 1) * 100;
        bcb.cdi = { aa: aa(ult.valor), mes: acum(cdi.filter((x) => x.data.startsWith(mes)).map((x) => x.valor)),
          ano: acum(cdi.filter((x) => x.data.startsWith(ano)).map((x) => x.valor)), data: ult.data, hist: cdi.slice(-90).map((x) => aa(x.valor)),
          d12: acum(cdi.slice(-252).map((x) => x.valor)), serie: cdi.map((x) => [x.data, +aa(x.valor).toFixed(2)]) };
      }
      if (selic.length > 20) {
        const ult = selic[selic.length - 1];
        const antes = (dias) => { const lim = new Date(ult.data + "T00:00:00"); lim.setDate(lim.getDate() - dias); const iso = isoDia(lim); return ([...selic].reverse().find((x) => x.data <= iso) || selic[0]).valor; };
        bcb.selic = { aa: ult.valor, var30: ult.valor - antes(30), var365: ult.valor - antes(365), data: ult.data, hist: selic.slice(-120).map((x) => x.valor),
          serie: selic.map((x) => [x.data, x.valor]) };
      }
      if (ipca.length >= 13) {
        const ult = ipca[ipca.length - 1], ano = ult.data.slice(0, 4);
        const d12 = (k) => acum(ipca.slice(k - 11, k + 1).map((x) => x.valor));
        bcb.ipca = { d12: d12(ipca.length - 1), mes: ult.valor, ano: acum(ipca.filter((x) => x.data.startsWith(ano)).map((x) => x.valor)), data: ult.data,
          hist: ipca.slice(11).map((x, i) => d12(i + 11)),
          serie: ipca.slice(11).map((x, i) => [x.data, x.valor, +d12(i + 11).toFixed(2)]) };
      }
      // uma série que falhou nesta busca mantém o último valor conhecido
      ["cdi", "selic", "ipca"].forEach((k) => { if (!bcb[k] && mercado.bcb && mercado.bcb[k]) bcb[k] = mercado.bcb[k]; });
      mercado.bcb = bcb;
      try { localStorage.setItem(CHAVE_MERCADO, JSON.stringify({ ...mercado, carregando: false })); } catch (e) { /* sem espaço */ }
      try { if (bcb.cdi || bcb.selic || bcb.ipca) localStorage.setItem("bcb1", JSON.stringify(bcb)); } catch (e) { /* sem espaço */ }
    }).catch(() => {}).then(() => { buscandoBCB = false; if (ROTA.secao === "nasdaq") renderRota(); });
  }

  function atualizarMercado(forcar, silencioso) {
    if (mercado.carregando) return;
    if (!forcar && Date.now() - mercado.em < 10 * 60 * 1000 && Object.keys(mercado.cotacoes).length) return;
    const doRelatorio = acoesDoRelatorio(DADOS.relatorioMercado).map((x) => x.ticker + ".SA");
    const simbolos = [...new Set([...MERCADO_INDICES.map((x) => x.s), "GC=F", ...MERCADO_EUA.map((x) => x[0]), ...MERCADO_BR.map((x) => x[0] + ".SA"), ...doRelatorio])];
    mercado.carregando = true;
    const isoDia = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const hoje = new Date(), inicio = new Date(); inicio.setDate(inicio.getDate() - 3);
    Promise.all([
      // cada cotação que chega já entra na tela (redesenho no máximo a cada 1,5 s)
      C.buscarMercado(simbolos, configCotacoes().token, (sim, cot) => {
        const ant = mercado.cotacoes[sim];
        if (ant && !cot.historico.length) cot.historico = ant.historico || [];
        mercado.cotacoes = { ...mercado.cotacoes, [sim]: cot };
        if (ROTA.secao === "nasdaq" && !redesenhoMercado) redesenhoMercado = setTimeout(() => { redesenhoMercado = null; if (ROTA.secao === "nasdaq") renderRota(); }, 1500);
      }),
      C.buscarSerieDolar(90).catch(() => null),
      // ouro pela AwesomeAPI (reserva do Yahoo/Stooq): cotação e série de 90 dias
      // (entra na tela assim que chega, sem esperar as outras cotações)
      Promise.all([C.buscarOuro(), C.buscarSerieMoeda("XAU-USD", 90).catch(() => [])]).then((o) => {
        const atual = mercado.cotacoes["GC=F"];
        if (o[0] && !(atual && atual.preco > 0 && atual.fonte !== "awesome")) {
          mercado.cotacoes = { ...mercado.cotacoes, "GC=F": { ...o[0], nome: "Ouro", moeda: "USD", fonte: "awesome", historico: (o[1] || []).map((p) => ({ data: p.data, preco: p.preco, abertura: p.abertura, maxima: p.maxima, minima: p.minima })) } };
          if (ROTA.secao === "nasdaq") renderRota();
        }
        return o;
      }).catch(() => null),
      // notícias do mercado dos últimos dias (Google Notícias, com o GDELT de reserva)
      C.buscarNoticiasPeriodo({ google: 'Nasdaq OR Ibovespa OR "Wall Street" OR "bolsa de valores"', gdelt: '(Nasdaq OR Ibovespa OR "Wall Street")' }, isoDia(inicio), isoDia(hoje)).catch(() => null)
    ]).then(([r, dolar, ouroAw, noticias]) => {
      // sem o ouro do Yahoo/Stooq, entra o da AwesomeAPI
      if (ouroAw && ouroAw[0] && !(r.cotacoes["GC=F"] && r.cotacoes["GC=F"].preco > 0)) {
        r.cotacoes["GC=F"] = { ...ouroAw[0], nome: "Ouro", moeda: "USD", historico: (ouroAw[1] || []).map((p) => ({ data: p.data, preco: p.preco, abertura: p.abertura, maxima: p.maxima, minima: p.minima })) };
      }
      const achou = Object.keys(r.cotacoes).length;
      // cotação sem histórico (fonte de reserva) mantém o histórico que já havia
      Object.keys(r.cotacoes).forEach((k) => { const ant = mercado.cotacoes[k]; if (ant && !r.cotacoes[k].historico.length) r.cotacoes[k].historico = ant.historico || []; });
      const nts = noticias && noticias.length
        ? [...new Map(noticias.map((n) => [n.titulo, n])).values()].sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, 20) : mercado.noticias;
      // uma busca que falhou inteira (sem internet) não apaga o último retrato
      // ...mercado mantém os números do Banco Central e a hora das notícias (antes eram apagados aqui)
      if (achou) mercado = { ...mercado, cotacoes: { ...mercado.cotacoes, ...r.cotacoes }, erros: r.erros, dolar: dolar || mercado.dolar, noticias: nts, em: Date.now(), carregando: false };
      else mercado = { ...mercado, erros: r.erros, noticias: nts, carregando: false };
      try { localStorage.setItem(CHAVE_MERCADO, JSON.stringify({ ...mercado, carregando: false })); } catch (e) { /* sem espaço */ }
      if (forcar && !silencioso) toast(achou ? "Cotações de mercado atualizadas." : "Não foi possível buscar as cotações agora.");
    }).catch(() => { mercado.carregando = false; if (forcar && !silencioso) toast("Não foi possível buscar as cotações agora."); })
      .then(() => { if (ROTA.secao === "nasdaq") renderRota(); });
  }
  // variação % da série nos últimos "dias" corridos (ponto de partida: o
  // último fechamento até aquela data)
  function variacaoSerie(hist, dias) {
    if (!hist || hist.length < 2) return null;
    const ult = hist[hist.length - 1];
    const lim = new Date(ult.data + "T00:00:00"); lim.setDate(lim.getDate() - dias);
    const limIso = lim.toISOString().slice(0, 10);
    const base = [...hist].reverse().find((h) => h.data <= limIso) || hist[0];
    return base.preco > 0 ? (ult.preco / base.preco - 1) * 100 : null;
  }
  const pctMercado = (v) => v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2).replace(".", ",") + "%";
  const celPct = (v) => v == null ? '<span class="dim">—</span>' : `<span class="${v >= 0 ? "up" : "down"}">${pctMercado(v)}</span>`;
  const fmtPontos = (v) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const usd = (v) => "US$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function tabelaMercado(lista, sufixo, moeda) {
    const q = mercado.cotacoes;
    const linhas = lista.map(([t, nome]) => {
      const c = q[t + sufixo];
      if (!c) return `<tr><td class="papel">${t}<small>${esc(nome)}</small></td><td class="r dim" colspan="4">sem cotação</td></tr>`;
      return `<tr><td class="papel">${t}<small>${esc(nome)}</small></td>
        <td class="r">${moeda(c.preco)}</td><td class="r">${celPct(c.variacaoPct)}</td>
        <td class="r">${celPct(variacaoSerie(c.historico, 30))}</td><td class="r">${celPct(variacaoSerie(c.historico, 90))}</td></tr>`;
    }).join("");
    return `<div class="terminal-scroll"><table class="terminal tab-mercado">
      <thead><tr><th>Papel</th><th class="r">Preço</th><th class="r">Dia</th><th class="r">1 mês</th><th class="r">3 meses</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>`;
  }

  // ---------------------------------------------------------------------
  // Relatório diário em PDF (fechamento do dia anterior): o usuário importa
  // o arquivo, o leitor (relatorio.js) tira os números e a tela mostra tudo
  // num painel de pregão — cotações, maiores altas e quedas, juros e
  // inflação, o resumo e as análises de empresas — com a cotação de hoje de
  // cada ação citada. Fica em DADOS.relatorioMercado (vai junto no backup).
  // ---------------------------------------------------------------------
  const MESES_RELATORIO = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  // "DIA 07 OUTUBRO 2026" → "2026-10-07"
  function dataFechamentoRelatorio(r) {
    const m = /(\d{1,2})\s+(?:DE\s+)?([A-ZÇ]+)\s+(?:DE\s+)?(\d{4})/i.exec((r && r.fechamento) || "");
    const mes = m ? MESES_RELATORIO.indexOf(m[2].toUpperCase()) : -1;
    return mes >= 0 ? `${m[3]}-${String(mes + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  }
  // as ações citadas no relatório, com onde cada uma aparece
  function acoesDoRelatorio(r) {
    const mapa = new Map();
    const add = (t, onde, pct) => { if (!mapa.has(t)) mapa.set(t, { ticker: t, onde: [], pct: null }); const x = mapa.get(t); if (!x.onde.includes(onde)) x.onde.push(onde); if (pct != null && x.pct == null) x.pct = pct; };
    if (!r) return [];
    r.grupos.forEach((g) => g.ativos.forEach((a) => { if (a.acao) add(a.nome, "Principais", a.dia); }));
    r.altas.forEach((a) => add(a.ticker, "Maiores altas", a.pct));
    r.quedas.forEach((a) => add(a.ticker, "Maiores quedas", a.pct));
    r.noticias.forEach((n) => n.tickers.forEach((t) => add(t, "Análise", null)));
    return [...mapa.values()];
  }
  function importarRelatorio(arquivo) {
    if (!window.Relatorio) { toast("O leitor do relatório não foi carregado."); return; }
    toast("Lendo o relatório…");
    prepararLeitorPdf()
      .then(() => arquivo.arrayBuffer())
      .then((buf) => window.Relatorio.lerPdf(buf))
      .then((r) => {
        DADOS.relatorioMercado = { ...r, arquivo: arquivo.name, importadoEm: new Date().toISOString() };
        salvarEAtualizar(`Relatório importado: fechamento ${r.colunas[0] || r.fechamento}.`);
        atualizarMercado(true, true);   // cotação de hoje das ações citadas
        if (ROTA.secao === "nasdaq") renderRota(); else navegarPara("nasdaq");
      })
      .catch((e) => toast("Não consegui ler o relatório: " + (e && e.message ? e.message : e)));
  }

  const corMov = (v) => v == null ? "" : v > 0 ? "t-up" : v < 0 ? "t-down" : "t-zero";
  const setaMov = (v) => v == null ? "" : v > 0 ? "▲" : v < 0 ? "▼" : "►";
  const tPct = (v, casas) => v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: casas == null ? 2 : casas, maximumFractionDigits: casas == null ? 2 : casas }) + "%";
  const tNum = (v, taxa) => v == null ? "—" : taxa ? tPct(v).replace("+", "") : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // célula de variação "acesa" (fundo colorido) quando o movimento é forte
  const celVar = (v, forte) => `<td class="r ${corMov(v)}${forte && v != null && Math.abs(v) >= forte ? " t-aceso" : ""}">${tPct(v)} <i>${setaMov(v)}</i></td>`;
  // símbolo do Yahoo/brapi para um ativo da tabela do relatório (para o minigráfico de 3 meses)
  const SIMBOLO_RELATORIO = { "IBOVESPA": "^BVSP", "NASDAQ": "^IXIC" };

  // ---------------------------------------------------------------------
  // Triagem automática para sugerir ações (guia Bolsa). Cada ação ganha uma
  // nota de 0 a 100, somando sinais simples e explicáveis:
  //   tendência (preço acima das médias de 20 e 50 pregões), momento (1 e 3
  //   meses), risco (volatilidade e distância da máxima de 3 meses),
  //   relatório ICL (maiores altas/quedas, citação nas análises) e o tom das
  //   notícias que citam a empresa (palavras positivas e negativas).
  // É uma triagem de números, não uma recomendação de investimento.
  // ---------------------------------------------------------------------
  const PALAVRAS_POS = ["alta", "sobe", "subiu", "dispara", "avança", "lucro", "recorde", "supera", "eleva", "dividendo", "compra", "otimis", "cresce", "expansão", "aprova", "ganha", "valoriza", "melhora", "positiv"];
  const PALAVRAS_NEG = ["queda", "cai ", "caiu", "recua", "despenca", "prejuízo", "rebaix", "crise", "dívida", "recuperação judicial", "perde", "multa", "investiga", "processo", "pessimis", "risco", "corta", "negativ", "impasse", "rescind"];
  function tomTexto(txt) {
    const t = " " + String(txt || "").toLowerCase() + " ";
    let p = 0; PALAVRAS_POS.forEach((w) => { if (t.includes(w)) p++; }); PALAVRAS_NEG.forEach((w) => { if (t.includes(w)) p--; });
    return p;
  }
  function triagemAtivos() {
    const q = mercado.cotacoes, r = DADOS.relatorioMercado, res = new Map();
    const relAcoes = new Map(acoesDoRelatorio(r).map((x) => [x.ticker, x]));
    const candidatos = [...MERCADO_EUA.map(([t, n]) => ({ t, nome: n, sim: t, moeda: "USD" })), ...MERCADO_BR.map(([t, n]) => ({ t, nome: n, sim: t + ".SA", moeda: "BRL" }))];
    relAcoes.forEach((x, t) => { if (!candidatos.some((c) => c.t === t)) candidatos.push({ t, nome: "", sim: t + ".SA", moeda: "BRL" }); });
    const noticias = mercado.noticias || [];
    const media = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
    candidatos.forEach((c) => {
      const cot = q[c.sim]; if (!cot) return;
      const nome = c.nome || (cot.nome && cot.nome !== c.t ? cot.nome : c.t);
      const h = (cot.historico || []).map((x) => x.preco).filter((v) => v > 0);
      let nota = 50; const motivos = [];
      const mot = (txt, pts) => { nota += pts; motivos.push({ txt, pos: pts > 0 }); };
      // tendência
      if (h.length >= 20) {
        const m20 = media(h.slice(-20)), m50 = media(h.slice(-Math.min(50, h.length)));
        if (cot.preco > m20 && m20 > m50) mot("tendência de alta (acima das médias)", 12);
        else if (cot.preco < m20 && m20 < m50) mot("tendência de baixa (abaixo das médias)", -12);
      }
      // momento
      const v1 = variacaoSerie(cot.historico, 30), v3 = variacaoSerie(cot.historico, 90);
      if (v3 != null) { const pts = Math.max(-12, Math.min(12, v3 * 0.6)); if (Math.abs(pts) >= 2) mot(`3 meses ${pctMercado(v3)}`, Math.round(pts)); }
      if (v1 != null) { const pts = Math.max(-8, Math.min(8, v1 * 0.8)); if (Math.abs(pts) >= 2) mot(`1 mês ${pctMercado(v1)}`, Math.round(pts)); }
      // risco: volatilidade diária e distância da máxima de 3 meses
      if (h.length >= 20) {
        const rets = h.slice(1).map((v, i) => v / h[i] - 1), mr = media(rets);
        const vol = Math.sqrt(media(rets.map((x) => (x - mr) ** 2))) * 100;
        if (vol > 3) mot(`volatilidade alta (${vol.toFixed(1).replace(".", ",")}% ao dia)`, -8);
        else if (vol < 1.5) mot("volatilidade baixa", 4);
        const dd = (cot.preco / Math.max(...h) - 1) * 100;
        if (dd < -15) mot(`${pctMercado(dd)} abaixo da máxima de 3 meses`, -6);
        else if (dd > -3) mot("perto da máxima de 3 meses", 3);
      }
      // relatório ICL
      const rel = relAcoes.get(c.t);
      if (rel) {
        if (rel.onde.includes("Maiores altas")) mot("entre as maiores altas do relatório ICL", 5);
        if (rel.onde.includes("Maiores quedas")) mot("entre as maiores quedas do relatório ICL", -5);
        if (rel.onde.includes("Análise") && r) {
          const txt = r.noticias.filter((n) => n.tickers.includes(c.t)).map((n) => n.titulo + " " + n.paragrafos.join(" ")).join(" ");
          const tom = tomTexto(txt);
          if (tom >= 2) mot("análise do relatório com tom positivo", 6);
          else if (tom <= -2) mot("análise do relatório com tom negativo", -6);
        }
      }
      // notícias do mercado que citam a ação ou a empresa
      const chave = nome.split(/\s+/)[0].toLowerCase();
      const citam = noticias.filter((n) => { const t = n.titulo.toLowerCase(); return t.includes(c.t.toLowerCase()) || (chave.length >= 4 && t.includes(chave)); });
      if (citam.length) {
        const tom = citam.reduce((a, n) => a + Math.sign(tomTexto(n.titulo)), 0);
        if (tom > 0) mot(`${citam.length} notícia${citam.length > 1 ? "s" : ""} com tom positivo`, Math.min(8, 3 * tom));
        else if (tom < 0) mot(`${citam.length} notícia${citam.length > 1 ? "s" : ""} com tom negativo`, Math.max(-8, 3 * tom));
      }
      nota = Math.max(0, Math.min(100, Math.round(nota)));
      res.set(c.sim, { ...c, nome, cot, nota, classe: nota >= 65 ? "destaque" : nota < 40 ? "cautela" : "neutra", motivos, v3 });
    });
    return res;
  }
  let triagem = new Map();

  // grau de investimento pela nota da triagem (A a E), mostrado em todas as tabelas
  const GRAUS = [{ min: 75, letra: "A", rot: "Forte" }, { min: 65, letra: "B", rot: "Boa" }, { min: 50, letra: "C", rot: "Neutra" }, { min: 40, letra: "D", rot: "Fraca" }, { min: 0, letra: "E", rot: "Cautela" }];
  const grauDe = (nota) => GRAUS.find((g) => nota >= g.min);
  const notaDe = (sim) => { const x = triagem.get(sim); return x ? x.nota : -1; };
  // bolinha com a cor do grau, na frente do papel (a nota e os motivos ficam na dica)
  function letraNota(sim) {
    const x = triagem.get(sim);
    if (!x) return '<span class="bola-grau g-x" title="Sem nota (sem cotação)"></span>';
    const g = grauDe(x.nota);
    const porque = x.motivos.map((m) => (m.pos ? "+ " : "− ") + m.txt).join("\n") || "sem sinais fortes";
    return `<span class="bola-grau g-${g.letra.toLowerCase()}" title="${esc(`Nota ${x.nota} · ${g.rot}\n${porque}`)}"></span>`;
  }



  // célula do preço pisca (verde ao subir, vermelho ao cair) quando o valor
  // mudou desde a última vez que a tabela foi desenhada — como nos terminais
  const ultimosPrecos = new Map();
  // ativo selecionado na área de trabalho da guia Bolsa (lista de cotações,
  // gráfico, painel do ativo e fechamentos diários seguem a seleção)
  let velaBolsa = "^BVSP";
  let cotSelecionada = null;   // cotação do ativo selecionado (para o gráfico)
  // indicadores do gráfico (como no Profit): médias móveis e Bollinger sobre
  // as velas e um oscilador embaixo (IFR, MACD ou volume)
  const indBolsa = { mm9: true, mm21: true, bb: false };
  let oscBolsa = "ifr";
  const IND = {
    mms(v, n) { return v.map((_, i) => i + 1 < n ? null : v.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n); },
    mme(v, n) { const k = 2 / (n + 1); let e = null; return v.map((x, i) => { if (i + 1 < n) return null; e = e == null ? v.slice(0, n).reduce((a, b) => a + b, 0) / n : x * k + e * (1 - k); return e; }); },
    bollinger(v, n, d) {
      const m = IND.mms(v, n);
      const dp = v.map((_, i) => { if (m[i] == null) return null; const j = v.slice(i + 1 - n, i + 1); return Math.sqrt(j.reduce((a, x) => a + (x - m[i]) ** 2, 0) / n); });
      return { sup: m.map((x, i) => x == null ? null : x + d * dp[i]), inf: m.map((x, i) => x == null ? null : x - d * dp[i]) };
    },
    // IFR de Wilder (14)
    ifr(v, n) {
      const out = v.map(() => null); if (v.length <= n) return out;
      let g = 0, p = 0;
      for (let i = 1; i <= n; i++) { const d = v[i] - v[i - 1]; if (d > 0) g += d; else p -= d; }
      g /= n; p /= n; out[n] = p === 0 ? 100 : 100 - 100 / (1 + g / p);
      for (let i = n + 1; i < v.length; i++) { const d = v[i] - v[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; p = (p * (n - 1) + Math.max(-d, 0)) / n; out[i] = p === 0 ? 100 : 100 - 100 / (1 + g / p); }
      return out;
    },
    macd(v) {
      const r = IND.mme(v, 12), l = IND.mme(v, 26);
      const m = v.map((_, i) => r[i] == null || l[i] == null ? null : r[i] - l[i]);
      const base = m.findIndex((x) => x != null), sinal = m.map(() => null);
      if (base >= 0) { const sub = IND.mme(m.slice(base), 9); sub.forEach((x, i) => { sinal[base + i] = x; }); }
      return { macd: m, sinal, hist: m.map((x, i) => x == null || sinal[i] == null ? null : x - sinal[i]) };
    },
  };
  const fmtVolume = (v) => !(v > 0) ? "—" : v >= 1e9 ? (v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " bi" : v >= 1e6 ? (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : v >= 1e3 ? (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " mil" : String(Math.round(v));
  function piscaPreco(sim, preco) {
    const ant = ultimosPrecos.get(sim);
    ultimosPrecos.set(sim, preco);
    if (ant == null || ant === preco) return "";
    return preco > ant ? " pisca-up" : " pisca-down";
  }
  // com relatório ICL importado, a tabela da B3 mostra as ações do relatório:
  // onde cada uma aparece, a variação que o relatório traz e a cotação de hoje
  function tabelaRelatorioB3(r) {
    const q = mercado.cotacoes, iso = dataFechamentoRelatorio(r);
    const col = r.colunas.length ? r.colunas[0] : "relatório";
    // as ações do relatório e, junto, as demais grandes do Ibovespa
    const doRel = acoesDoRelatorio(r), nomes = new Map(MERCADO_BR);
    const todas = [...doRel, ...MERCADO_BR.filter(([t]) => !doRel.some((x) => x.ticker === t)).map(([t]) => ({ ticker: t, onde: [], pct: null }))];
    const linhas = todas.sort((a, b) => notaDe(b.ticker + ".SA") - notaDe(a.ticker + ".SA")).map((x) => {
      const c = q[x.ticker + ".SA"];
      let desde = null;
      if (c && iso) { const base = [...c.historico].reverse().find((h) => h.data <= iso); if (base && base.preco > 0) desde = (c.preco / base.preco - 1) * 100; }
      const chips = x.onde.map((o) => `<span class="term-chip${o === "Maiores altas" ? " c-up" : o === "Maiores quedas" ? " c-down" : o === "Análise" ? " c-acc" : ""}">${{ "Maiores altas": "ALTA", "Maiores quedas": "QUEDA", "Principais": "PRINCIPAL", "Análise": "ANÁLISE" }[o] || o}</span>`).join("");
      const nome = c && c.nome && c.nome !== x.ticker ? `<small>${esc(c.nome)}</small>` : nomes.has(x.ticker) ? `<small>${esc(nomes.get(x.ticker))}</small>` : "";
      const spark = c && c.historico && c.historico.length > 1 ? sparklineSVG(c.historico.map((h) => h.preco), (c.variacaoPct || 0) >= 0 ? G.CORES.up : G.CORES.down) : "";
      const vazio = `<td class="r term-dim">${mercado.carregando ? "buscando…" : "—"}</td>`;
      return `<tr ${c ? linkAtivo(x.ticker + ".SA") : ""}><td class="term-ativo">${letraNota(x.ticker + ".SA")} ${x.ticker} ${chips}${nome}</td>
        ${x.pct == null ? '<td class="r term-dim">—</td>' : celVar(x.pct, 3)}
        ${c ? `<td class="r t-preco${piscaPreco(x.ticker + ".SA", c.preco)}">${brl(c.preco)}</td>` : vazio}${c ? celVar(c.variacaoPct, 2) : vazio}${desde == null ? vazio : celVar(desde, 5)}<td class="term-spark">${spark}</td></tr>`;
    }).join("");
    return `<div class="term-painel"><div class="term-cab">B3 · IBOVESPA E AÇÕES DO RELATÓRIO ICL · FECHAMENTO ${esc(col)}</div><div class="term-rolar"><table class="term-tab tab-pregao">
      <thead><tr><th>Papel</th><th class="r">${esc(col)}</th><th class="r">Último</th><th class="r">Hoje</th><th class="r">Desde ${esc(col)}</th><th>3M</th></tr></thead>
      <tbody>${linhas}</tbody></table></div></div>`;
  }

  // Relatório ICL em quadros no padrão da guia Ações (cartões com título e a
  // tabela "terminal" da guia Ações): cotações de fechamento, maiores altas e
  // quedas, CDI e IPCA, resumo do dia e análises
  // parte "inicio": Índices e Moedas e Ouro, resumo e análises; parte "meio":
  // Renda Fixa, Futuros, Principais Ações e CDI/IPCA (no meio da guia)
  const GRUPO_DO_MEIO = /renda fixa|futuro|a[çc][õo]es/i;
  function painelRelatorio(parte) {
    const r = DADOS.relatorioMercado;
    if (!r) return "";
    const doMeio = parte === "meio";
    const q = mercado.cotacoes;
    const col = r.colunas.length ? r.colunas : ["Últ.", "Ant."];
    const sub = `relatório ICL · ${esc(r.data.toLowerCase())}`;
    const f2 = (v) => Math.abs(Number(v || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // como na guia Ações: variação colorida, e movimento forte com fundo
    const fp = (v, forte) => {
      if (v == null) return '<span class="dim">—</span>';
      const txt = `${v > 0 ? "+" : v < 0 ? "−" : ""}${f2(v)}%`;
      if (forte && Math.abs(v) >= forte) return `<span class="${v >= 0 ? "cel-up" : "cel-down"}">${txt}</span>`;
      return `<span class="${v > 0 ? "up" : v < 0 ? "down" : "dim"}">${txt}</span>`;
    };
    const num = (v, taxa) => v == null ? "—" : taxa ? f2(v) + "%" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // (1) cotações de fechamento, agrupadas como no relatório
    // Renda Fixa ganha um quadro só dela (no meio da guia, acima do CDI e IPCA)
    const ehRendaFixa = (g) => /renda fixa/i.test(g.nome);
    const rf = doMeio ? r.grupos.filter(ehRendaFixa) : [];
    const rendaFixa = rf.length ? card("", "Renda fixa", sub, "", rf.map((g) => g.ativos.map((a) => `
      <div class="rf-item">
        <div class="rf-nome">${esc(a.nome)}</div>
        <div class="rf-taxas"><b>${num(a.atual, a.taxa)}</b><span>${esc(col[1] || "anterior")}: ${num(a.anterior, a.taxa)}</span></div>
        <div class="rf-vars"><div><i>Dia</i>${fp(a.dia)}</div><div><i>Mês</i>${fp(a.mes)}</div><div><i>Ano</i>${fp(a.ano)}</div></div>
      </div>`).join("")).join("")
      + (rf.some((g) => g.ativos.some((a) => /\*/.test(a.nome))) ? '<p class="rel-nota">* Variações em pontos percentuais: a diferença nominal da taxa nos períodos.</p>' : "")) : "";
    const linhasCot = r.grupos.filter((g) => GRUPO_DO_MEIO.test(g.nome) === doMeio && !ehRendaFixa(g)).map((g) => `<tr class="tr-grupo"><td colspan="7">${esc(g.nome)}</td></tr>` + g.ativos.map((a) => {
      const sim = a.acao ? a.nome + ".SA" : SIMBOLO_RELATORIO[a.nome];
      const hist = sim && q[sim] && q[sim].historico;
      const spark = hist && hist.length > 1 ? sparklineSVG(hist.map((h) => h.preco), a.ano >= 0 ? G.CORES.up : G.CORES.down) : "";
      return `<tr ${sim && q[sim] ? linkAtivo(sim) : ""}><td class="papel">${esc(a.nome)}</td><td class="r creme">${num(a.atual, a.taxa)}</td><td class="r dim">${num(a.anterior, a.taxa)}</td>
        <td class="r">${fp(a.dia, 1)}</td><td class="r">${fp(a.mes)}</td><td class="r">${fp(a.ano)}</td><td class="tab-rel-spark">${spark}</td></tr>`;
    }).join("")).join("");
    const cot = !linhasCot ? "" : card("", doMeio ? "Futuros e principais ações" : "Índices, moedas e ouro", sub, "", `<div class="terminal-scroll"><table class="terminal tab-rel">
      <thead><tr><th>Ativo</th><th class="r">${esc(col[0])}</th><th class="r">${esc(col[1] || "")}</th><th class="r">Dia</th><th class="r">Mês</th><th class="r">Ano</th><th>3 meses</th></tr></thead>
      <tbody>${linhasCot}</tbody></table></div>`);

    // (3) CDI e IPCA
    const juros = r.indicadores.length ? card("", "CDI e IPCA", sub, "", `<div class="terminal-scroll"><table class="terminal tab-rel">
      <thead><tr><th>Indicador</th><th class="r">Taxa</th></tr></thead><tbody>
      ${r.indicadores.map((i) => `<tr><td class="papel">${esc(i.nome.replace(/\s*\(TAXA ANO\)/i, " (ao ano)"))}</td><td class="r"><span class="${/IPCA/i.test(i.nome) ? (i.valor > 0 ? "down" : "up") : "up"}">${i.valor < 0 ? "−" : ""}${f2(i.valor)}%</span></td></tr>`).join("")}
      </tbody></table></div>`) : "";

    // (4) resumo e (5) análises (abre e fecha em cada título)
    const resumo = r.resumo ? card("", "Resumo do dia", sub, "", `<p class="rel-texto">${esc(r.resumo)}</p>`) : "";
    const analises = r.noticias.length ? card("", "Análises do relatório", `${r.noticias.length} ${r.noticias.length > 1 ? "análises" : "análise"} · toque no título para abrir`, "", r.noticias.map((n) => `
      <details class="rel-analise"><summary><span>${esc(n.titulo)}</span>${n.tickers.map((t) => {
        const c = q[t + ".SA"];
        return `<em class="selo-tag selo-acao">${t}${c ? `&nbsp; ${fp(c.variacaoPct)}` : ""}</em>`;
      }).join("")}</summary>${n.paragrafos.map((p) => `<p>${esc(p)}</p>`).join("")}</details>`).join("")) : "";

    if (doMeio) {
      const lado = [rendaFixa, juros].filter(Boolean);
      if (!cot && !lado.length) return "";
      return `
      <div class="grid grid-relatorio-meio">
        ${cot ? `<div class="${lado.length ? "c8" : "c12"}">${cot}</div>` : ""}
        ${lado.length ? `<div class="${cot ? "c4" : "c12"}"><div class="rel-pilha">${lado.join("")}</div></div>` : ""}
      </div>`;
    }
    return `
      <div class="grid g-top grid-relatorio">
        ${cot ? `<div class="${resumo ? "c6" : "c12"}">${cot}</div>` : ""}
        ${resumo ? `<div class="${cot ? "c6" : "c12"}">${resumo}</div>` : ""}
        ${analises ? `<div class="c12">${analises}</div>` : ""}
      </div>`;
  }

  // ativo da tabela do relatório pelo nome ("NASDAQ", "SP500"…)
  const ativoRelatorio = (nome) => { const r = DADOS.relatorioMercado; if (!r) return null; for (const g of r.grupos) for (const a of g.ativos) if (a.nome === nome) return a; return null; };

  // clique numa ação ou índice da guia Bolsa: se a ação está na carteira,
  // abre a mesma tela da guia Ações; senão, a tela do ativo com o histórico
  // das cotações (velas, períodos e notícias, como na guia Ações)
  function linkAtivo(simbolo) {
    const tk = simbolo.replace(/\.SA$/, "");
    const minha = (DADOS.acoes || []).find((a) => String(a.ticker).toUpperCase() === tk);
    return minha ? `data-acao="ir" data-secao="detalhe-acao" data-id="${minha.id}"` : `data-acao="ir" data-secao="detalhe-mercado" data-id="${esc(simbolo)}"`;
  }
  const NOMES_INDICES = { "^IXIC": "Nasdaq Composite", "^NDX": "Nasdaq-100", "^GSPC": "S&P 500", "^BVSP": "Ibovespa" };
  // a ação do mercado no formato de uma ação da carteira (sem quantidade nem preço de compra)
  function ativoMercado(simbolo) {
    const c = mercado.cotacoes[simbolo];
    if (!c) return null;
    const tk = simbolo.replace(/\.SA$/, "");
    const lista = [...MERCADO_EUA, ...MERCADO_BR].find((x) => x[0] === tk);
    const ouro = simbolo === "GC=F";
    return { id: simbolo, ticker: ouro ? "OURO" : NOMES_INDICES[simbolo] ? tk.replace("^", "") : tk, empresa: ouro ? "Ouro · contrato futuro (US$ por onça)" : c.nome || (lista && lista[1]) || NOMES_INDICES[simbolo] || "",
      categoria: ouro ? "Mercadoria" : NOMES_INDICES[simbolo] ? "Índice" : "Ação", moeda: c.moeda, historicoPrecos: c.historico || [], precoAtual: c.preco, precoMedio: 0, quantidade: 0 };
  }
  function renderDetalheMercado(d, simbolo) {
    const a = ativoMercado(simbolo);
    const voltar = `<button class="voltar" data-acao="ir" data-secao="nasdaq"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.voltar}</svg>Voltar para Bolsa</button>`;
    if (!a) return `${voltar}<div class="empty">Sem cotação deste ativo agora. Volte para a guia Bolsa e toque em ↻ Atualizar.</div>`;
    const c = mercado.cotacoes[simbolo], v = c.variacaoPct || 0;
    const preco = NOMES_INDICES[simbolo] ? fmtPontos(a.precoAtual) + " pts" : a.moeda === "USD" ? usd(a.precoAtual) : brl(a.precoAtual);
    const sub = `${esc(a.empresa)} · <b class="${v >= 0 ? "up" : "down"}">${preco} ${v >= 0 ? "▲" : "▼"} ${pctMercado(v)}</b>`;
    return `
      ${voltar}
      <div class="grid g-top">
        <div class="c12">${card("", `${esc(NOMES_INDICES[simbolo] || a.ticker)} <span class="selo-tag ${a.categoria === "Índice" ? "selo-cat" : "selo-acao"}">${a.categoria}</span>`, sub,
          abasPeriodo(),
          `<div class="grafico-acao-area grafico-tela-cheia"><canvas id="graf-preco-acao"></canvas></div>`)}</div>
      </div>
    `;
  }

  // janela da área de trabalho da guia Bolsa (barra de título cinza e corpo preto)
  function janelaBolsa(cls, titulo, corpo, extra) {
    return `<div class="prof-jan ${cls}"><div class="prof-tit"><span class="prof-ico"></span>${titulo}${extra || ""}</div><div class="prof-corpo">${corpo}</div></div>`;
  }
  function renderNasdaq() {
    const q = mercado.cotacoes, tem = Object.keys(q).length, r = DADOS.relatorioMercado;
    triagem = tem ? triagemAtivos() : new Map();
    const quando = mercado.em ? new Date(mercado.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    const status = mercado.carregando ? "buscando cotações…" : quando ? `cotações ${quando}` : "sem cotações";


    // quadro de cotações grandes (como o "58.50 +0,43%" do terminal):
    // cotação ao vivo; sem ela, o fechamento do relatório ICL
    const rotRel = r ? `ICL ${esc(r.colunas[0] || "")}` : "";
    const caixa = (nome, live, rel, fmt, rotuloRel) => {
      let preco, varDia, sub = "", spark = "", fonte;
      if (live) {
        preco = live.preco; varDia = live.variacaoPct; fonte = live.fonte || "AO VIVO";
        sub = `1 mês ${tPct(variacaoSerie(live.historico, 30))} · 3 meses ${tPct(variacaoSerie(live.historico, 90))}`;
        if (live.historico && live.historico.length > 1) spark = sparklineSVG(live.historico.map((h) => h.preco), varDia >= 0 ? G.CORES.up : G.CORES.down);
      } else if (rel) {
        preco = rel.atual; varDia = rel.dia; fonte = rotuloRel || rotRel;
        sub = `MÊS ${tPct(rel.mes)} · ANO ${tPct(rel.ano)}`;
      } else return `<div class="term-quote"><span class="tq-nome">${nome}</span><b class="tq-preco term-dim">—</b><span class="tq-sub term-dim">sem cotação</span></div>`;
      const clique = live && live.clique ? ` ${live.clique}` : live && live.simbolo ? ` ${live.simbolo === "dolar" ? 'data-acao="ir" data-secao="detalhe-dolar"' : linkAtivo(live.simbolo)}` : "";
      return `<div class="term-quote${clique ? " clicavel" : ""}"${clique}><span class="tq-nome">${nome}<em>${fonte}</em></span>
        <b class="tq-preco ${corMov(varDia)}">${fmt(preco)}</b>
        <span class="tq-var ${corMov(varDia)}">${tPct(varDia)} ${setaMov(varDia)}</span>
        <span class="tq-sub">${sub}</span>${spark ? `<span class="tq-spark">${spark}</span>` : ""}</div>`;
    };
    // só os índices, o ouro, o dólar, as criptos e as ações da carteira (guia
    // Ações — uma ação comprada lá entra aqui sozinha); cada uma abre a
    // própria tela ao tocar
    const dolarVivo = dolar && dolar.valor ? { preco: dolar.valor, variacaoPct: dolar.variacaoPct || 0, historico: serieDolar || mercado.dolar || [], clique: 'data-acao="ir" data-secao="detalhe-dolar"' } : null;
    const criptoVivo = (m) => { const c = cripto && cripto[m]; return c && c.valor ? { preco: c.valor, variacaoPct: c.variacaoPct || 0, historico: seriesCripto[m] || [], clique: `data-cripto="${m}"`, fonte: qtdCripto(m) > 0 ? "CARTEIRA" : undefined } : null; };
    const acaoCarteira = (a) => {
      if (!(Number(a.precoAtual) > 0)) return null;
      const v = a.fontePreco === "auto" && a.variacaoDiaPct != null ? a.variacaoDiaPct : I.variacaoRecente(a).pct;
      return { preco: Number(a.precoAtual), variacaoPct: v, historico: (a.historicoPrecos || []).slice().sort((x, y) => (x.data < y.data ? -1 : 1)), fonte: "CARTEIRA", clique: `data-acao="ir" data-secao="detalhe-acao" data-id="${a.id}"` };
    };
    // ouro sem cotação nem relatório: última referência conhecida (relatório ICL de 07/10/2026)
    const REF_OURO = { atual: 4303.48, dia: 0.37, mes: -3.27, ano: -0.81 };
    const pts = (v) => fmtPontos(v);
    const moeda2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const comSimbolo = (sim) => q[sim] ? { ...q[sim], simbolo: sim } : null;
    const board = `<div class="term-board">
      ${caixa("IBOVESPA", comSimbolo("^BVSP"), ativoRelatorio("IBOVESPA"), pts)}
      ${caixa("S&amp;P 500", comSimbolo("^GSPC"), ativoRelatorio("SP500"), pts)}
      ${caixa("NASDAQ", comSimbolo("^IXIC"), ativoRelatorio("NASDAQ"), pts)}
      ${caixa("OURO", comSimbolo("GC=F"), ativoRelatorio("OURO") || REF_OURO, (v) => "US$ " + moeda2(v), ativoRelatorio("OURO") ? undefined : "REF.")}
      ${caixa("DÓLAR", dolarVivo, ativoRelatorio("DÓLAR / REAL"), (v) => "R$ " + moeda2(v))}
      ${["BTC", "ETH"].map((m) => caixa(m === "BTC" ? "BITCOIN" : "ETHEREUM", criptoVivo(m), null, (v) => "R$ " + Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 }))).join("")}
      ${(DADOS.acoes || []).map((a) => caixa(esc(String(a.ticker).toUpperCase()), acaoCarteira(a), null, brl)).join("")}
    </div>`;

    const quandoHora = mercado.em ? new Date(mercado.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
    // ===== padrão das plataformas de pregão =====
    // todos os papéis acompanhados (B3, Nasdaq e as ações da carteira)
    const papeis = [...MERCADO_BR.map(([t, n]) => ({ t, n, sim: t + ".SA", c: q[t + ".SA"] })), ...MERCADO_EUA.map(([t, n]) => ({ t, n, sim: t, c: q[t] }))];
    (DADOS.acoes || []).forEach((a) => {
      const t = String(a.ticker).toUpperCase();
      if (!papeis.some((x) => x.t === t)) papeis.push({ t, n: a.empresa || "", sim: t + ".SA", c: q[t + ".SA"] || acaoCarteira(a), clique: `data-acao="ir" data-secao="detalhe-acao" data-id="${a.id}"` });
    });
    const comCot = papeis.filter((x) => x.c && x.c.preco > 0);
    const n2 = (v) => moeda2(v);
    // sempre 8 caixas por linha (no computador e no iPad)
    // no título de cada caixa fica só a primeira palavra (em amarelo); o
    // S&P 500 e a RENDA FIXA ficam com o nome inteiro
    const pintarNome = (txt) => {
      const t = txt.trim();
      if (/^S&amp;P 500$/.test(t)) return t;
      if (/^RENDA FIXA\b/i.test(t)) return "RENDA FIXA";
      return t.split(/\s+/)[0];
    };
    const boardDuas = board
      .replace(/<span class="tq-n">([^<]*)<\/span>/g, (_, n) => `<span class="tq-n">${pintarNome(n)}</span>`)
      .replace(/(<span class="tq-nome[^"]*">)([^<]+)(?=<em>|<\/span>)/g, (_, a, n) => `${a}<span class="tq-n">${pintarNome(n)}</span>`)
      .replace('<div class="term-board">', `<div class="term-board" style="--cols:8">`);
    // gráfico e análise automática
    const graficoCorpo = `<div class="term-graf prof-comp-graf">${tem ? '<canvas id="graf-mercado-comp"></canvas>' : '<p class="term-texto term-dim">O gráfico aparece quando as cotações chegarem.</p>'}</div>`;

    // ===== área de trabalho no estilo do ProfitChart (Nelogica) =====
    // janelas com barra de título sobre fundo cinza: Cotação (lista única,
    // agrupada), Ativo (resumo e preços × dias), Gráfico (velas) e
    // Fechamentos diários (como o Times & Trades). Tocar numa linha da
    // Cotação seleciona o ativo nas outras janelas.
    const citadas = new Set(acoesDoRelatorio(r).map((x) => x.ticker));
    const fDolar = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    // minhas ações (guia Ações) ficam no grupo da própria bolsa (B3 ou
    // Nasdaq), mas sempre nas primeiras linhas dele
    const tickersCarteira = new Set((DADOS.acoes || []).map((a) => String(a.ticker).toUpperCase()));
    const ordenados = [...papeis.filter((x) => tickersCarteira.has(x.t)), ...papeis.filter((x) => !tickersCarteira.has(x.t))];
    const grupos = [
      ["ÍNDICES, MOEDAS E OURO", [["IBOV", "Índice Ibovespa", "^BVSP", fmtPontos], ["NASDAQ", "Nasdaq Composite", "^IXIC", fmtPontos], ["S&P 500", "S&P 500", "^GSPC", fmtPontos],
        ["DÓLAR", "Dólar comercial · R$", "USDBRL", fDolar], ["OURO", "Ouro · US$ por onça", "GC=F", n2]]],
      ["B3 · AÇÕES · R$", ordenados.filter((x) => /\.SA$/.test(x.sim)).map((x) => [x.t, x.n, x.sim, n2, x])],
      [papeis.some((x) => !/\.SA$/.test(x.sim) && q[x.sim] && q[x.sim].bdr) ? "NASDAQ · AÇÕES · R$" : "NASDAQ · AÇÕES · US$", ordenados.filter((x) => !/\.SA$/.test(x.sim)).map((x) => [x.t, x.n, x.sim, n2, x])],
    ];
    const cotDe = (sim, x) => sim === "USDBRL" ? dolarVivo : q[sim] || (x && x.c) || null;
    const todosSel = grupos.flatMap((g) => g[1]);
    if (!todosSel.some((i) => i[2] === velaBolsa)) velaBolsa = "^BVSP";
    const sel = todosSel.find((i) => i[2] === velaBolsa), cs = cotDe(sel[2], sel[4]), fs = sel[3];
    cotSelecionada = cs;
    const horaCot = quandoHora || "—";
    const janela = janelaBolsa;
    const numP = (v, f) => v == null || !(v > 0) ? '<span class="term-dim">—</span>' : f(v);
    // (1) Cotação
    // célula da variação pintada de verde (alta) ou vermelho (queda)
    const celPinta = (v) => `<td class="r ${v == null ? "" : v > 0 ? "cel-alta" : v < 0 ? "cel-baixa" : "t-zero"}">${tPct(v)}${v ? ` <i>${setaMov(v)}</i>` : ""}</td>`;
    const linhaCot = ([t, nome, sim, f, x]) => {
      const c = cotDe(sim, x), selo = citadas.has(t) ? ' <span class="term-chip c-acc">ICL</span>' : "";
      // linha em destaque quando a ação está na carteira (guia Ações)
      const naCarteira = (DADOS.acoes || []).some((a) => String(a.ticker).toUpperCase() === t);
      const ativo = (sim === velaBolsa ? " prof-sel" : "") + (naCarteira ? " prof-cart" : "");
      if (!c) return `<tr class="${ativo}" data-acao="prof-sel" data-id="${esc(sim)}"><td class="prof-sim">${t}${selo}</td><td class="prof-desc">${esc(nome)}</td><td class="r term-dim" colspan="10">${mercado.carregando ? "buscando…" : "sem cotação"}</td></tr>`;
      const h = c.historico || [], ult = h[h.length - 1], ant = h.length > 1 ? h[h.length - 2].preco : null;
      const max = ult && ult.maxima > 0 ? Math.max(ult.maxima, c.preco) : null, min = ult && ult.minima > 0 ? Math.min(ult.minima, c.preco) : null;
      const abe = ult && ult.abertura > 0 ? ult.abertura : null;
      // ação dos EUA: mesma linha das ações da B3 (bolinha da nota e números
      // sem símbolo de moeda); vinda pelo BDR, o código dele fica na dica
      return `<tr class="${ativo}" data-acao="prof-sel" data-id="${esc(sim)}" title="Selecionar ${t}${c.bdr ? ` · cotação do BDR ${c.bdr} na B3, em reais` : ""}"><td class="prof-sim">${x ? letraNota(sim) + " " : ""}${t}${selo}</td><td class="prof-desc">${esc(nome)}</td>
        <td class="r t-preco${piscaPreco(sim, c.preco)}">${f(c.preco)}</td>${celPinta(c.variacaoPct)}<td class="r prof-hora">${horaCot}</td>
        <td class="r">${numP(abe, f)}</td><td class="r t-max">${numP(max, f)}</td><td class="r t-min">${numP(min, f)}</td><td class="r t-ant">${numP(ant, f)}</td><td class="r prof-vol">${fmtVolume(ult && ult.volume)}</td>
        ${celPinta(variacaoSerie(h, 30))}${celPinta(variacaoSerie(h, 90))}</tr>`;
    };
    const jCot = janela("prof-cot", "Cotação", `<div class="term-rolar"><table class="term-tab prof-tab">
      <thead><tr><th>Símbolo</th><th>Descrição</th><th class="r">Último</th><th class="r">%</th><th class="r">Hora</th><th class="r">Abertura</th><th class="r">Máxima</th><th class="r">Mínima</th><th class="r">Fechamento</th><th class="r">Volume</th><th class="r">1 mês</th><th class="r">3 meses</th></tr></thead>
      <tbody>${grupos.map(([g, itens]) => `<tr class="prof-grupo"><td colspan="12">${g}</td></tr>${itens.map(linhaCot).join("")}`).join("")}</tbody></table></div>`);
    // (2) Ativo: faixa de cotação, dias de alta × baixa e preços × dias
    const hs = cs && cs.historico ? cs.historico.filter((p) => p.preco > 0) : [];
    const us = hs[hs.length - 1], antS = hs.length > 1 ? hs[hs.length - 2].preco : null;
    let corpoAtivo = '<p class="term-texto term-dim">Sem cotação deste ativo agora.</p>';
    if (cs && hs.length > 1) {
      let altas = 0, baixas = 0;
      hs.forEach((p, i) => { if (i) { if (p.preco > hs[i - 1].preco) altas++; else if (p.preco < hs[i - 1].preco) baixas++; } });
      const fechs = hs.map((p) => p.preco), lo = Math.min(...fechs), hi = Math.max(...fechs), N = 14, passo = (hi - lo) / N || 1;
      const faixas = Array.from({ length: N }, (_, k) => ({ de: lo + k * passo, ate: lo + (k + 1) * passo, dias: 0, ult: null }));
      const comVolume = hs.some((p) => p.volume > 0);
      hs.forEach((p) => { const k = Math.min(N - 1, Math.floor((p.preco - lo) / passo)); faixas[k].dias += comVolume ? (p.volume || 0) : 1; faixas[k].ult = p.data; });
      const maxDias = Math.max(...faixas.map((x) => x.dias)) || 1;
      const kAtual = Math.min(N - 1, Math.max(0, Math.floor((cs.preco - lo) / passo)));
      const dataBR = (d) => d ? d.slice(8, 10) + "/" + d.slice(5, 7) : "—";
      corpoAtivo = `<table class="term-tab prof-tab prof-resumo"><thead><tr><th>Símbolo</th><th class="r">Último</th><th class="r">%</th><th class="r">Abertura</th><th class="r">Máxima</th><th class="r">Mínima</th><th class="r">Fechamento</th></tr></thead>
        <tbody><tr><td class="prof-sim">${sel[0]}</td><td class="r t-preco">${fs(cs.preco)}</td><td class="r ${corMov(cs.variacaoPct)}">${tPct(cs.variacaoPct)}</td>
        <td class="r">${numP(us && us.abertura, fs)}</td><td class="r t-max">${numP(us && us.maxima, fs)}</td><td class="r t-min">${numP(us && us.minima, fs)}</td><td class="r t-ant">${numP(antS, fs)}</td></tr></tbody></table>
        <div class="prof-forca" title="Pregões em alta × em baixa nos últimos ${hs.length} dias"><span class="pf-alta" style="flex:${altas || 0.0001}">${altas} dias de alta</span><span class="pf-baixa" style="flex:${baixas || 0.0001}">${baixas} de baixa</span></div>
        <table class="term-tab prof-tab prof-escada"><thead><tr><th class="r">Faixa de preço</th><th class="r">${comVolume ? "Volume" : "Dias"}</th><th>${comVolume ? `Volume at Price · ${hs.length} pregões` : `Fechamentos em ${hs.length} pregões`}</th><th class="r">Último dia</th></tr></thead><tbody>
        ${faixas.map((x, k) => ({ x, k })).reverse().map(({ x, k }) => `<tr class="${k === kAtual ? "pe-atual" : ""}" style="--pe:${(x.dias / maxDias).toFixed(2)}"><td class="r">${fs(x.de)} – ${fs(x.ate)}</td><td class="r">${comVolume ? fmtVolume(x.dias) : x.dias}</td>
          <td class="pe-barra"><i style="width:${(x.dias / maxDias * 100).toFixed(0)}%"></i></td><td class="r">${k === kAtual ? "◄ atual" : dataBR(x.ult)}</td></tr>`).join("")}
        </tbody></table>`;
    }
    const abrirAtivo = sel[2] === "USDBRL" ? 'data-acao="ir" data-secao="detalhe-dolar"' : sel[4] && sel[4].clique ? sel[4].clique : cs ? linkAtivo(sel[2]) : "";
    const jAtivo = janela("prof-ativo", `Ativo · ${sel[0]} <small>${esc(sel[1])}</small>`, corpoAtivo, abrirAtivo ? `<button class="prof-abrir" ${abrirAtivo}>abrir ↗</button>` : "");
    // (3) Gráfico de velas do ativo selecionado
    const botInd = [["mm9", "MME 9"], ["mm21", "MMA 21"], ["bb", "Bollinger"]].map(([k, rot]) => `<button class="prof-bt${indBolsa[k] ? " ativo" : ""}" data-acao="ind-bolsa" data-id="${k}">${rot}</button>`).join("");
    const botOsc = [["ifr", "IFR"], ["macd", "MACD"], ["vol", "Volume"]].map(([k, rot]) => `<button class="prof-bt${oscBolsa === k ? " ativo" : ""}" data-acao="osc-bolsa" data-id="${k}">${rot}</button>`).join("");
    const jGraf = janela("prof-graf", `Gráfico · ${sel[0]} · Diário`, hs.length > 1 ? `<div class="prof-ferr"><span>${botInd}</span><span>${botOsc}</span></div>
      <div class="term-velas"><canvas id="graf-bolsa-velas"></canvas></div><div class="prof-osc"><canvas id="graf-bolsa-osc"></canvas></div>` : '<p class="term-texto term-dim">O gráfico aparece quando as cotações chegarem.</p>',
      cs ? `<span class="prof-tit-dir ${corMov(cs.variacaoPct)}">${fs(cs.preco)} ${tPct(cs.variacaoPct)}</span>` : "");
    // (4) Fechamentos diários (mais recentes primeiro; azul alta, vermelho baixa)
    const jNeg = janela("prof-neg", `Fechamentos diários · ${sel[0]}`, hs.length > 1 ? `<div class="term-rolar"><table class="term-tab prof-tab prof-negocios">
      <thead><tr><th>Data</th><th class="r">Fechamento</th><th class="r">%</th><th class="r">Abertura</th><th class="r">Máxima</th><th class="r">Mínima</th><th class="r">Amplitude</th><th class="r">Volume</th></tr></thead><tbody>
      ${hs.map((p, i) => ({ p, v: i ? (p.preco / hs[i - 1].preco - 1) * 100 : null })).reverse().map(({ p, v }) => `<tr class="${v == null ? "" : v >= 0 ? "pn-alta" : "pn-baixa"}"><td>${p.data.slice(8, 10)}/${p.data.slice(5, 7)}/${p.data.slice(2, 4)}</td>
        <td class="r">${fs(p.preco)}</td><td class="r">${v == null ? "—" : tPct(v)}</td><td class="r">${numP(p.abertura, fs)}</td><td class="r">${numP(p.maxima, fs)}</td><td class="r">${numP(p.minima, fs)}</td>
        <td class="r">${p.maxima > 0 && p.minima > 0 ? tPct((p.maxima / p.minima - 1) * 100).replace("+", "") : "—"}</td><td class="r">${fmtVolume(p.volume)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="term-texto term-dim">Sem histórico deste ativo.</p>');
    const areaTrabalho = `<section class="term term-nasdaq prof prof-sec1">
      <div class="prof-grade">${jCot}${jAtivo}${jGraf}${jNeg}</div>
    </section>`;

    // notícias do mercado (as mais recentes primeiro) e, embaixo, a análise automática
    const agoraMs = Date.now();
    const haQuanto = (iso) => { const m = Math.max(0, Math.round((agoraMs - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`; };
    const lista = mercado.noticias || [];
    // quadro de notícias ao lado do gráfico (com rolagem própria)
    const noticiasCorpo = `<div class="tp-rolar">
      ${lista.length ? `<div class="term-noticias">${lista.map((n) => `<a class="term-noticia" href="${esc(n.url)}" target="_blank" rel="noopener">
        <span class="tn-hora">${new Date(n.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}<em>${haQuanto(n.quando)}</em></span>
        <span class="tn-titulo">${esc(n.titulo)}</span><span class="tn-fonte">${esc(n.fonte || "")}</span></a>`).join("")}</div>`
        : `<p class="term-texto term-dim">${mercado.carregando || noticiasMercado.buscando ? "Buscando notícias…" : "Nenhuma notícia por enquanto — o app tenta de novo sozinho em instantes."}</p>`}
      </div>`;

    // os quadros do relatório ICL (Índices, Moedas e Ouro, Renda Fixa…) vêm no início da guia
    return `${painelRelatorio("inicio")}<section class="term term-nasdaq term-board-sec">${boardDuas}</section>
    ${areaTrabalho}${r ? `<section class="term term-nasdaq"><div class="term-grade term-grade-um term-grade-meio">${tabelaRelatorioB3(r)}</div></section>` : ""}${painelRelatorio("meio")}<section class="term term-nasdaq prof prof-sec2"><div class="prof-grade prof-grade-2">
      ${janelaBolsa("prof-comp", "Gráfico · Nasdaq × Ibovespa · variação em 3 meses", graficoCorpo)}${janelaBolsa("prof-not", "Notícias do mercado · Nasdaq e B3", noticiasCorpo, lista.length ? `<span class="prof-tit-dir">${lista.length} notícias</span>` : "")}
    </div></section>`;
  }
  // gráfico: variação acumulada desde o início dos 3 meses, nos dias da
  // Nasdaq; o Ibovespa e o dólar usam o último fechamento até cada dia
  // troca o ativo da área de trabalho sem perder a rolagem da página e da lista
  function selecionarAtivoBolsa(sim) {
    if (!sim || sim === velaBolsa) return;
    const lista = document.querySelector(".prof-cot .term-rolar"), topo = lista ? lista.scrollTop : 0, y = window.scrollY;
    velaBolsa = sim;
    renderRota();
    const nova = document.querySelector(".prof-cot .term-rolar");
    if (nova) nova.scrollTop = topo;
    window.scrollTo(0, y);
  }
  // velas diárias do ativo selecionado na área de trabalho
  function montarVelasBolsa() {
    const c = cotSelecionada;
    if (!c || !c.historico || c.historico.length < 2 || !document.getElementById("graf-bolsa-velas")) return;
    const v = velasPeriodo(c.historico, c.preco), fech = v.velas.map((p) => p.preco);
    const sob = [];
    if (indBolsa.bb) { const b = IND.bollinger(fech, 20, 2); sob.push({ valores: b.sup, cor: "#B0B6C0", largura: 1, traco: [4, 3], rotulo: "Bollinger 20,2" }, { valores: b.inf, cor: "#B0B6C0", largura: 1, traco: [4, 3] }); }
    if (indBolsa.mm9) sob.push({ valores: IND.mme(fech, 9), cor: "#FFD633", rotulo: "MME 9" });
    if (indBolsa.mm21) sob.push({ valores: IND.mms(fech, 21), cor: "#3B82F6", rotulo: "MMA 21" });
    const visiveis = Math.min(v.velas.length, 60);
    G.renderVelas("graf-bolsa-velas", v.velas, { visiveis, casas: 2, linhaAtual: c.preco, corAtual: "#FFD633", rotuloAtual: "Último", sobreposicoes: sob,
      aoMudarJanela: (d1, d2) => montarOsciladorBolsa(v.velas, d1, d2) });
    montarOsciladorBolsa(v.velas, v.velas[v.velas.length - visiveis].data, v.velas[v.velas.length - 1].data);
  }
  // oscilador embaixo das velas, mostrando os mesmos dias que estão na tela
  function montarOsciladorBolsa(velas, d1, d2) {
    if (!document.getElementById("graf-bolsa-osc")) return;
    const fech = velas.map((p) => p.preco), ids = velas.map((p, i) => (p.data >= d1 && p.data <= d2 ? i : -1)).filter((i) => i >= 0);
    const corte = (arr) => ids.map((i) => (arr[i] == null ? null : +arr[i].toFixed(4)));
    const rot = ids.map((i) => velas[i].data.slice(8, 10) + "/" + velas[i].data.slice(5, 7));
    const cimaG = window.Chart && Chart.getChart ? Chart.getChart("graf-bolsa-velas") : null;
    const larguraEixo = cimaG && cimaG.scales && cimaG.scales.y ? cimaG.scales.y.width : 0;
    if (oscBolsa === "macd") {
      const m = IND.macd(fech), h = corte(m.hist);
      G.renderOscilador("graf-bolsa-osc", rot, [
        { rotulo: "Hist.", valores: h, tipo: "barra", cores: h.map((x) => (x >= 0 ? "rgba(25,229,122,.55)" : "rgba(255,59,78,.55)")), cor: "#888", semLegenda: true },
        { rotulo: "MACD", valores: corte(m.macd), cor: "#38D6FF" }, { rotulo: "Sinal", valores: corte(m.sinal), cor: "#FF9F1C" }],
        { titulo: "MACD 12,26,9", larguraEixo, referencias: [0], formato: (x) => Number(x).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) });
    } else if (oscBolsa === "vol") {
      const vol = ids.map((i) => velas[i].volume || 0);
      G.renderOscilador("graf-bolsa-osc", rot, [{ rotulo: "Volume", valores: vol.map((x) => x || null), tipo: "barra",
        cores: ids.map((i) => (velas[i].preco >= velas[i].abertura ? "rgba(25,229,122,.6)" : "rgba(255,59,78,.6)")), cor: "#19E57A" }],
        { titulo: vol.some((x) => x > 0) ? "Volume" : "Volume (a fonte não informa para este ativo)", larguraEixo, formato: fmtVolume, min: 0 });
    } else {
      G.renderOscilador("graf-bolsa-osc", rot, [{ rotulo: "IFR", valores: corte(IND.ifr(fech, 14)), cor: "#B98CFF" }],
        { titulo: "IFR 14", larguraEixo, referencias: [70, 30], min: 0, max: 100, formato: (x) => Number(x).toFixed(0) });
    }
  }
  function montarGraficoMercado() {
    montarVelasBolsa();
    const q = mercado.cotacoes, nq = q["^IXIC"], ib = q["^BVSP"];
    const ref = (nq || ib) && (nq || ib).historico;
    if (!ref || ref.length < 2) return;
    const em = (hist, data) => { let v = null; for (const h of hist) { if (h.data > data) break; v = h.preco; } return v; };
    const acumulada = (hist) => { const b = em(hist, ref[0].data) || hist[0].preco; return ref.map((r) => { const v = em(hist, r.data); return v == null ? null : +((v / b - 1) * 100).toFixed(2); }); };
    const series = [];
    if (nq) series.push({ rotulo: "Nasdaq", valores: acumulada(nq.historico), cor: G.CORES.cy });
    if (ib) series.push({ rotulo: "Ibovespa", valores: acumulada(ib.historico), cor: G.CORES.laranja });
    // tocar num dia abre o painel daquele pregão
    G.renderLinhaMultipla("graf-mercado-comp", ref.map((r) => r.data.slice(8, 10) + "/" + r.data.slice(5, 7)), series,
      { formato: pctMercado, aoClicar: (i) => explicarDiaMercado(ref[i].data) });
  }

  // Painel de um dia do gráfico Nasdaq × Ibovespa: fechamento, variação do
  // dia e acumulada de cada índice e do dólar, as ações que mais subiram e
  // caíram naquele dia, as notícias do dia e setas para o dia anterior/seguinte
  function explicarDiaMercado(dia) {
    const q = mercado.cotacoes, nq = q["^IXIC"], ib = q["^BVSP"];
    const ref = ((nq || ib) && (nq || ib).historico) || [];
    const k = ref.findIndex((h) => h.data === dia);
    if (k < 0) return;
    // fechamento do dia, variação sobre o pregão anterior e acumulada desde o início do gráfico
    const doDia = (hist) => {
      if (!hist || !hist.length) return null;
      let i = -1; hist.forEach((h, j) => { if (h.data <= dia) i = j; });
      if (i < 0) return null;
      const ini = hist.find((h) => h.data >= ref[0].data) || hist[0];
      return { preco: hist[i].preco, dia: i > 0 ? (hist[i].preco / hist[i - 1].preco - 1) * 100 : null, acum: (hist[i].preco / ini.preco - 1) * 100, mesmoDia: hist[i].data === dia };
    };
    const linha = (rot, x, fmt) => x ? `<div class="kv"><span class="dim">${rot}${x.mesmoDia ? "" : " <small>(último pregão)</small>"}</span>
      <b>${fmt(x.preco)} · <span class="${corSinal(x.dia || 0)}">${x.dia == null ? "—" : pctMercado(x.dia)}</span> · <span class="${corSinal(x.acum)}">${pctMercado(x.acum)} no período</span></b></div>` : "";
    const n = doDia(nq && nq.historico), b = doDia(ib && ib.historico), dl = doDia(mercado.dolar);
    // ações que mais subiram e caíram neste dia
    const movs = (lista, sufixo, fmt) => lista.map(([t, nome]) => {
      const c = q[t + sufixo], h = c && c.historico; if (!h) return null;
      let i = -1; h.forEach((p, j) => { if (p.data <= dia) i = j; });   // feriado de um lado só: último pregão
      return i > 0 ? { t, nome, preco: h[i].preco, v: (h[i].preco / h[i - 1].preco - 1) * 100, fmt, sim: t + sufixo } : null;
    }).filter(Boolean).sort((x, y) => y.v - x.v);
    const blocoMov = (titulo, xs) => xs.length ? `<div class="pdm-bloco"><div class="pdm-tit">${titulo}</div>${[...xs.slice(0, 3), ...(xs.length > 3 ? xs.slice(-3) : [])].filter((x, i, arr) => arr.indexOf(x) === i).map((x) =>
      `<button class="pdm-acao" ${linkAtivo(x.sim)}><b>${x.t}</b><span>${esc(x.nome)}</span><em>${x.fmt(x.preco)}</em><i class="${corSinal(x.v)}">${pctMercado(x.v)}</i></button>`).join("")}</div>` : "";
    const dt = new Date(dia + "T12:00:00");
    const titulo = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const ant = k > 0 ? ref[k - 1].data : null, prox = k < ref.length - 1 ? ref[k + 1].data : null;
    let difTxt = "";
    if (n && b) { const d = n.acum - b.acum; difTxt = `<div class="kv"><span class="dim">Nasdaq − Ibovespa no período</span><b class="${corSinal(d)}">${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(2).replace(".", ",")} p.p.</b></div>`; }
    abrirModal(`
      <div class="pdm-topo"><button class="btn" id="pdmAnt" ${ant ? "" : "disabled"}>◀</button>
        <h3>${titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h3>
        <button class="btn" id="pdmProx" ${prox ? "" : "disabled"}>▶</button></div>
      <div class="pdm-kvs">
        ${linha("Nasdaq", n, (v) => fmtPontos(v) + " pts")}
        ${linha("Ibovespa", b, (v) => fmtPontos(v) + " pts")}
        ${linha("Dólar", dl, (v) => "R$ " + v.toFixed(2).replace(".", ","))}
        ${difTxt}
      </div>
      ${(() => { const bl = [blocoMov("NASDAQ NO DIA", movs(MERCADO_EUA, "", usd)), blocoMov("B3 NO DIA", movs(MERCADO_BR, ".SA", brl))].filter(Boolean);
        return bl.length ? `<div class="pdm-movs${bl.length === 1 ? " pdm-um" : ""}">${bl.join("")}</div>` : ""; })()}
      <div class="pdm-tit">NOTÍCIAS DO DIA</div>
      <div id="pdmNoticias" class="pdm-noticias"><span class="dim">Buscando notícias…</span></div>`, true);
    const m = document.getElementById("modal");
    if (ant) document.getElementById("pdmAnt").onclick = () => explicarDiaMercado(ant);
    if (prox) document.getElementById("pdmProx").onclick = () => explicarDiaMercado(prox);
    // tocar numa ação do painel fecha o painel e abre o gráfico dela
    m.querySelectorAll(".pdm-acao").forEach((el) => el.addEventListener("click", () => { fecharModal(); navegarPara(el.dataset.secao, el.dataset.id); }));
    C.buscarNoticiasDia({ google: 'Nasdaq OR Ibovespa OR "Wall Street"', gdelt: '(Nasdaq OR Ibovespa OR "Wall Street")' }, dia).then((lista) => {
      const el = document.getElementById("pdmNoticias");
      if (!el || !m.classList.contains("on")) return;
      el.innerHTML = lista && lista.length ? lista.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener"><span>${new Date(x.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>${esc(x.titulo)}<em>${esc(x.fonte || "")}</em></a>`).join("")
        : '<span class="dim">Nenhuma notícia encontrada para este dia.</span>';
    }).catch(() => { const el = document.getElementById("pdmNoticias"); if (el) el.innerHTML = '<span class="dim">Não foi possível buscar as notícias agora.</span>'; });
  }

  function renderAcoes(d) {
    const lista = I.listaAcoesComCalculo(d);
    const f2 = (v) => Number(v || 0).toFixed(2).replace(".", ",");
    const fp = (v) => v == null ? '<span class="dim">—</span>' : `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "+" : ""}${f2(v)}%</span>`;
    const fn = (v) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

    let corpo;
    if (!lista.length) {
      corpo = `<div class="empty">Nenhum ativo cadastrado. Use "+ Novo ativo" para lançar ações, FIIs ou ETFs.</div>`;
    } else {
      const linhas = lista.map((a) => {
        const v = a.fontePreco === "auto" && a.variacaoDiaPct != null
          ? { pct: a.variacaoDiaPct, valor: a.precoAtual - a.precoAtual / (1 + a.variacaoDiaPct / 100) }
          : I.variacaoRecente(a);
        const mm = I.precoMinMax(a);
        const m30 = I.variacaoDias(a, 30), m365 = I.variacaoDias(a, 365);
        const forte = Math.abs(v.pct) >= 2 ? (v.pct > 0 ? "cel-up" : "cel-down") : (Math.abs(v.pct) >= 1 ? "cel-neutra" : "");
        const ultima = editandoPrecos
          ? `<input class="campo-preco moeda" data-id="${a.id}" type="text" inputmode="decimal" value="${valorCampoMoeda(a.precoAtual)}" onclick="event.stopPropagation()">`
          : `<span class="${forte}">${brl(a.precoAtual)}</span>`;
        return `<tr data-acao="ir" data-secao="detalhe-acao" data-id="${a.id}">
          <td class="papel">${esc(a.ticker)}<small>${esc([a.categoria, a.banco].filter(Boolean).join(" · "))}</small></td>
          <td class="r">${brl(a.valorInvestido)}</td>
          <td class="r">${ultima}</td>
          <td class="r"><span class="${v.valor >= 0 ? "cel-up" : "cel-down"}">${v.valor >= 0 ? "+" : "−"}${brl(Math.abs(v.valor))}</span></td>
          <td class="r">${fp(v.pct)}</td>
          <td class="r">${fn(a.quantidade)}</td>
          <td class="r col-oculta">${brl(a.precoMedio)}</td>
          <td class="r creme col-oculta">${brl(a.valorAtual)}</td>
          <td class="r">${fp(a.rentabilidade)}</td>
          <td class="r dim">${brl(mm.min)}</td>
          <td class="r dim">${brl(mm.max)}</td>
          <td class="r">${fp(m30)}</td>
          <td class="r">${fp(m365)}</td>
          <td class="r ${corSinal(a.resultado)}">${a.resultado >= 0 ? "+" : "−"}${brl(Math.abs(a.resultado))}</td>
          <td class="r col-oculta">${brl(a.dividendos || 0)}</td>
          <td class="r col-oculta">${f2(a.peso)}%</td>
          <td class="r dim col-atualiz">${fmtDataCurta(a.atualizadoEm)}</td>
        </tr>`;
      }).join("");
      const tInv = I.totalInvestidoAcoes(d), tAt = I.totalCarteiraAcoes(d), tRes = tAt - tInv;
      corpo = `<div class="terminal-scroll"><table class="terminal tab-acoes">
        <thead><tr>
          <th>Papel</th><th class="r">Investido</th><th class="r">Última</th><th class="r">Var.</th><th class="r">Var. %</th><th class="r">Qtd.</th>
          <th class="r col-oculta">PM</th><th class="r col-oculta">Atual</th><th class="r">Rent. %</th>
          <th class="r">Mínima</th><th class="r">Máxima</th><th class="r">Mensal %</th><th class="r">Anual %</th><th class="r">Resultado</th>
          <th class="r col-oculta">Divid.</th><th class="r col-oculta">Peso</th><th class="r col-atualiz">Atualiz.</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr>
          <td>CARTEIRA</td><td class="r">${brl(tInv)}</td><td></td><td></td><td></td><td></td>
          <td class="col-oculta"></td><td class="r creme col-oculta">${brl(tAt)}</td>
          <td class="r">${fp(I.rentabilidadeCarteiraAcoes(d))}</td>
          <td></td><td></td><td></td><td></td>
          <td class="r ${corSinal(tRes)}">${tRes >= 0 ? "+" : "−"}${brl(Math.abs(tRes))}</td><td class="r col-oculta">${brl(I.totalDividendosAcoes(d))}</td><td class="r col-oculta">100%</td><td class="col-atualiz"></td>
        </tr></tfoot>
      </table></div>`;
    }

    return `
      <div class="grid g-top">
        <div class="c12">${card("", "Painel ativos", (configCotacoes().auto ? '<span class="selo-tag selo-acao">cotação automática · brapi.dev</span>' : '<span class="selo-tag selo-cat">preço atualizado manualmente</span>'),
          `<div class="pilulas-cotacao"><div class="dolar-pill" id="dolarTopbar" title="Dólar comercial (AwesomeAPI)" style="display:none"></div></div>
           <button class="btn" data-acao="buscar-cotacoes" title="Buscar cotações na internet agora">↻ Buscar</button>
           <button class="btn primario" data-acao="novo-ativo"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`,
          corpo,
          `<span class="dim">Total Carteira</span><b class="creme" style="font-size:14px;font-weight:800">${brlSinal(I.totalCarteiraAcoes(d))}</b>`, "painelAtivos")}</div>
      </div>
    `;
  }

  function abrirModalAcao(id) {
    const a = id ? achar(DADOS.acoes, id) : null;
    abrirModal(`
      <h3>${a ? "Editar ativo" : "Novo ativo"}</h3>
      <div class="par">
        <div class="campo"><label for="f_tk">Ticker</label><input id="f_tk" value="${a ? esc(a.ticker) : ""}" placeholder="PETR4" style="text-transform:uppercase"></div>
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(CATS_ACAO, a ? a.categoria : CATS_ACAO[0])}</select></div>
      </div>
      <div class="campo"><label for="f_emp">Empresa / fundo</label><input id="f_emp" value="${a ? esc(a.empresa) : ""}" placeholder="Petrobras PN"></div>
      <div class="campo"><label for="f_banco">Banco / corretora</label>${campoBanco("f_banco", a ? a.banco || "" : "", "Selecione o banco…")}</div>
      <div class="par">
        <div class="campo"><label for="f_qtd">Quantidade</label><input id="f_qtd" type="number" step="0.00000001" value="${a ? a.quantidade : ""}" placeholder="100"></div>
        <div class="campo"><label for="f_pm">Preço médio</label>${campoMoeda("f_pm", a ? a.precoMedio : "")}</div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_pa">Preço atual</label>${campoMoeda("f_pa", a ? a.precoAtual : "")}</div>
        <div class="campo"><label for="f_div">Dividendos recebidos</label>${campoMoeda("f_div", a ? a.dividendos || 0 : 0)}</div>
      </div>
      <p class="campo ajuda">Com as cotações automáticas ligadas (Configurações), o preço atual é buscado na brapi.dev pelo ticker. Sem internet, vale o valor digitado aqui.</p>
      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Opcional">${a ? esc(a.obs || "") : ""}</textarea></div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${a ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    document.getElementById("btnSalvar").onclick = () => {
      const tk = document.getElementById("f_tk").value.trim().toUpperCase();
      if (!tk) { toast("Informe o ticker."); return; }
      const precoAtual = numIn(document.getElementById("f_pa").value);
      const registro = {
        id: a ? a.id : A.novoId(),
        ticker: tk, empresa: document.getElementById("f_emp").value.trim(),
        banco: lerCampoBanco("f_banco"),
        categoria: document.getElementById("f_cat").value,
        quantidade: numIn(document.getElementById("f_qtd").value),
        precoMedio: numIn(document.getElementById("f_pm").value),
        precoAtual,
        dividendos: numIn(document.getElementById("f_div").value),
        obs: document.getElementById("f_obs").value.trim(),
        atualizadoEm: hojeISO(),
        historicoPrecos: a ? adicionarPontoPreco(a.historicoPrecos, precoAtual) : [{ data: hojeISO(), preco: precoAtual }]
      };
      if (a) Object.assign(a, registro); else DADOS.acoes.push(registro);
      fecharModal();
      salvarEAtualizar(a ? "Ativo atualizado." : "Ativo cadastrado.");
    };
    if (a) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      confirmarExclusao(`Excluir ${a.ticker} da carteira?`, () => {
        DADOS.acoes = DADOS.acoes.filter((r) => r.id !== a.id);
        salvarEAtualizar("Ativo excluído.");
      });
    };
  }

  function adicionarPontoPreco(historico, preco) {
    const hist = (historico || []).slice();
    const hj = hojeISO();
    if (hist.length && hist[hist.length - 1].data === hj) hist[hist.length - 1].preco = preco;
    else hist.push({ data: hj, preco });
    if (hist.length > 400) hist.shift();
    return hist;
  }

  function salvarEdicaoPrecosEmMassa() {
    let alterados = 0;
    document.querySelectorAll(".campo-preco").forEach((input) => {
      const a = achar(DADOS.acoes, input.dataset.id);
      if (!a) return;
      const novo = numIn(input.value);
      if (novo !== a.precoAtual) {
        a.precoAtual = novo;
        a.atualizadoEm = hojeISO();
        a.historicoPrecos = adicionarPontoPreco(a.historicoPrecos, novo);
        alterados++;
      }
    });
    if (alterados) salvarEAtualizar(`${plural(alterados, "preço atualizado", "preços atualizados")}.`);
  }

  // =========================================================================
  // DETALHE DO ATIVO
  // =========================================================================
  const PERIODOS_GRAFICO = [
    { chave: "7d", rotulo: "7 dias", dias: 7 },
    { chave: "30d", rotulo: "30 dias", dias: 30 },
    { chave: "90d", rotulo: "3 meses", dias: 90 },
    { chave: "180d", rotulo: "6 meses", dias: 180 },
    { chave: "365d", rotulo: "1 ano", dias: 365 },
    { chave: "tudo", rotulo: "Tudo", dias: null }
  ];


  // Valor líquido de um investimento numa data: desconta o IR estimado sobre
  // o rendimento, pela tabela regressiva da data do ponto. No ponto atual,
  // usa o líquido informado pelo banco (extrato em PDF), quando existir.
  function liquidoInvestimentoEm(inv, valor, data) {
    const v = Number(valor || 0);
    if (inv.liquidoBanco != null && Math.abs(v - Number(inv.valorAtual || 0)) < 0.005) return Number(inv.liquidoBanco);
    if (I.ehIsento(inv)) return v;
    const lucro = v - Number(inv.valorInvestido || 0);
    if (lucro <= 0) return v;
    const dias = inv.dataAplicacao ? Math.max(0, Math.round((new Date(data + "T00:00:00") - new Date(inv.dataAplicacao + "T00:00:00")) / 86400000)) : 0;
    const aliq = dias <= 180 ? 22.5 : dias <= 360 ? 20 : dias <= 720 ? 17.5 : 15;
    return v - lucro * (aliq / 100);
  }

  function filtrarPeriodo(historico, chave) {
    const op = PERIODOS_GRAFICO.find((x) => x.chave === chave);
    if (!op || !op.dias) return historico || [];
    const limite = new Date();
    limite.setDate(limite.getDate() - op.dias);
    const corte = limite.toISOString().slice(0, 10);
    const lista = (historico || []).slice().sort((a, b) => (a.data < b.data ? -1 : 1));
    const filtrado = lista.filter((p) => p.data >= corte);
    // o último valor antes do corte vale no início da janela: a linha cobre o período inteiro
    const anterior = lista.filter((p) => p.data < corte).pop();
    if (anterior) filtrado.unshift({ ...anterior, data: corte });
    // se ainda assim não houver 2 pontos, mostra tudo em vez de um gráfico vazio
    return filtrado.length >= 2 ? filtrado : lista;
  }

  // anos com dados, para os seletores dos quadros do dashboard
  function serieRD(d) {
    const fx = intervaloAnoMeses(anoRD, mesesRD);
    return serieMensalPeriodo(d, fx.ini, fx.fim);
  }


  // Histórico do patrimônio calculado a partir dos próprios dados (um ponto no
  // fim de cada mês + hoje). Antes ele era uma "foto" gravada por dia, e fotos
  // antigas — como as do exemplo — continuavam valendo mesmo depois de os
  // lançamentos serem apagados, travando o PICO num valor que não existia mais.
  let cacheHistPat = { chave: "", pontos: [] };
  function histPatrimonio(d) {
    const hoje = hojeISO();
    const chave = (d.atualizadoEm || "") + "|" + hoje + "|" + JSON.stringify([(d.config || {}).cripto, (d.config || {}).criptoPrecos]) + "|" + d.entradas.length + "|" + d.despesas.length + "|" + d.investimentos.length + "|" + d.acoes.length + "|" + d.bancos.length;
    if (cacheHistPat.chave === chave) return cacheHistPat.pontos;
    const idsBanco = new Set(d.bancos.map((b) => b.id));
    const movs = [
      ...d.entradas.filter((e) => !e.previsto && idsBanco.has(e.bancoId)).map((e) => ({ data: String(e.data || ""), v: Number(e.valor || 0) })),
      ...d.despesas.filter((x) => idsBanco.has(x.bancoId) && !x.cartaoId).map((x) => ({ data: String(x.data || ""), v: -Number(x.valor || 0) }))
    ].filter((m) => m.data && m.data <= hoje);
    const datas = [...movs.map((m) => m.data)];
    d.investimentos.forEach((i) => { (i.historicoValores || []).forEach((p) => datas.push(p.data)); if (i.dataAplicacao) datas.push(i.dataAplicacao); });
    d.acoes.forEach((a) => (a.historicoPrecos || []).forEach((p) => datas.push(p.data)));
    I.listaCripto(d).forEach((c) => ((((d.config || {}).criptoPrecos || {})[c.moeda]) || []).forEach((p) => datas.push(p.data)));
    const p = I.patrimonio(d);
    const validas = datas.filter((x) => x && x <= hoje).sort();
    if (!validas.length && !p.bruto) { cacheHistPat = { chave, pontos: [] }; return []; }
    const ultimoAte = (lista, campo, fim) => { let v = null; (lista || []).forEach((pt) => { if (pt.data <= fim && (v === null || pt.data >= v.data)) v = pt; }); return v ? Number(v[campo]) : null; };
    const saldoInicial = d.bancos.reduce((s, b) => s + Number(b.saldoInicial || 0), 0);
    const valorEm = (fim) => {
      const bancos = saldoInicial + movs.filter((m) => m.data <= fim).reduce((s, m) => s + m.v, 0);
      const invest = d.investimentos.reduce((s, i) => {
        const v = ultimoAte(i.historicoValores, "valor", fim);
        if (v !== null) return s + v;
        return s + (i.dataAplicacao && i.dataAplicacao <= fim ? Number(i.valorInvestido || 0) : 0);
      }, 0);
      const acoes = d.acoes.reduce((s, a) => { const pr = ultimoAte(a.historicoPrecos, "preco", fim); return s + (pr !== null ? pr * Number(a.quantidade || 0) : 0); }, 0);
      const cripto = I.totalCripto(d, fim);   // quantidade atual × preço do fim do mês
      return { bancos, investimentos: invest, acoes, cripto, dividas: 0 };
    };
    let inicio = (validas[0] || hoje).slice(0, 7);
    const limite = `${Number(hoje.slice(0, 4)) - 10}${hoje.slice(4, 7)}`;
    if (inicio < limite) inicio = limite;
    const pontos = [];
    for (let mes = inicio; mes < hoje.slice(0, 7); ) {
      const [a, m] = mes.split("-").map(Number);
      const fim = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
      const c = valorEm(fim);
      pontos.push({ data: fim, valor: Math.round(c.bancos + c.investimentos + c.acoes + c.cripto), ...c });
      const prox = new Date(a, m, 1); mes = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}`;
    }
    pontos.push({ data: hoje, valor: Math.round(p.liquido), bancos: p.bancos, investimentos: p.investimentos, acoes: p.acoes, cripto: p.cripto, dividas: p.dividas, hoje: true });     // hoje: o patrimônio líquido exato
    cacheHistPat = { chave, pontos };
    return pontos;
  }


  // Quadro "Evolução patrimonial": montado pela mesma função no Dashboard e nos
  // Relatórios, para os dois ficarem sempre idênticos (cada guia guarda o seu
  // próprio ano e período)
  function histEvolucao(d, meses, ano) {
    const h = histPatrimonio(d);
    if (!meses) return h;
    const fx = intervaloAnoMeses(ano, meses);
    return h.filter((x) => x.data >= fx.ini && x.data <= fx.fim);
  }
  // sem cfg.idAno (Dashboard) o quadro não tem seletor de ano: usa sempre o ano atual
  function cardEvolucaoPatrimonial(d, cfg) {
    const hist = histEvolucao(d, cfg.meses, cfg.ano);
    const varPer = hist.length >= 2 ? hist[hist.length - 1].valor - hist[0].valor : 0;
    return card("", "Evolução patrimonial", `patrimônio líquido · ${cfg.meses ? cfg.meses + " meses de " + cfg.ano : "todo histórico"}`,
      (hist.length >= 2 ? `<span class="pill-periodo ${corSinal(varPer)}">PERÍODO ${brlSinal(varPer)}</span>` : "") +
      `<div class="filtro-mes">${cfg.idAno ? seletorAnoDash(cfg.idAno, cfg.ano, anosDashboard(d)) : ""}${abasMeses(cfg.acao, cfg.meses, [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }, { meses: 0, rotulo: "Tudo" }])}</div>`,
      hist.length >= 2
        ? `<div${cfg.classe ? ` class="${cfg.classe}"` : ""} style="padding:8px 14px 12px;height:280px"><canvas id="${cfg.canvas}"></canvas></div>`
        : `<div class="empty">Sem registros de patrimônio em ${cfg.meses ? `${cfg.meses} ${cfg.meses === 1 ? "mês" : "meses"} de ${cfg.ano}` : "todo histórico"}.</div>`);
  }

  function historicoEvo(d) { return histEvolucao(d, mesesEvo, anoEvo); }


  // Lista de anos dos seletores: do ano mais antigo com dados (ou do ano
  // atual) até 2070, para planejar recorrências de longo prazo.
  const ANO_LIMITE = 2070;
  function faixaAnos(anosComDados) {
    const atual = new Date().getFullYear();
    const numeros = anosComDados.map(Number).filter((n) => n > 1900);
    const inicio = Math.min(atual, ...(numeros.length ? numeros : [atual]));
    const fim = Math.max(ANO_LIMITE, ...(numeros.length ? numeros : [atual]));
    const lista = [];
    for (let a = inicio; a <= fim; a++) lista.push(String(a));
    return lista;
  }

  function anosDashboard(d) {
    const anos = new Set([String(new Date().getFullYear())]);
    [...d.entradas, ...d.despesas].forEach((m) => { if (m.data) anos.add(String(m.data).slice(0, 4)); });
    (histPatrimonio(d) || []).forEach((h) => { if (h.data) anos.add(String(h.data).slice(0, 4)); });
    return faixaAnos([...anos]);
  }

  // intervalo dos primeiros N meses do ano escolhido; no ano corrente
  // não passa do mês atual
  function intervaloAnoMeses(ano, meses) {
    const hoje = new Date();
    const ehAnoAtual = Number(ano) === hoje.getFullYear();
    const ultimo = ehAnoAtual ? Math.min(meses, hoje.getMonth() + 1) : meses;
    const fimMes = new Date(Number(ano), ultimo, 0);
    return { ini: `${ano}-01-01`, fim: fimMes.toISOString().slice(0, 10) };
  }

  function seletorAnoDash(id, ano, anos) {
    return `<select class="sel-ano" id="${id}" title="Ano">${anos.map((a) =>
      `<option value="${a}" ${a === ano ? "selected" : ""}>${a}</option>`).join("")}</select>`;
  }

  function abasMeses(acao, atual, opcoes) {
    return `<div class="abas abas-periodo">${opcoes.map((op) =>
      `<button class="${atual === op.meses ? "ativo" : ""}" data-acao="${acao}" data-meses="${op.meses}">${op.rotulo}</button>`).join("")}</div>`;
  }

  function abasPeriodo() {
    return `<div class="abas abas-periodo">${PERIODOS_GRAFICO.map((op) =>
      `<button class="${periodoGrafico === op.chave ? "ativo" : ""}" data-acao="periodo-grafico" data-periodo="${op.chave}">${op.rotulo}</button>`).join("")}</div>`;
  }

  function renderDetalheAcao(d, id) {
    const a = achar(d.acoes, id);
    if (!a) return `<div class="empty">Ativo não encontrado. <button class="link-acao" data-acao="ir" data-secao="acoes">Voltar para Ações</button></div>`;
    // o gráfico ocupa a tela inteira (sem o quadro de resumo ao lado)
    return `
      <button class="voltar" data-acao="ir" data-secao="acoes"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.voltar}</svg>Voltar para Ações</button>
      <div class="grid g-top">
        <div class="c12">${card("", `${esc(a.ticker)} <span class="selo-tag ${classeSelo(a.categoria)}">${esc(a.categoria)}</span>`, esc(a.empresa),
          `${abasPeriodo()}<button class="btn primario" data-acao="editar-acao" data-id="${a.id}">✎ Editar</button>`,
          `<div class="grafico-acao-area grafico-tela-cheia"><canvas id="graf-preco-acao"></canvas></div>`)}</div>
      </div>
    `;
  }

  function abrirModalNovoPreco(id) {
    const a = achar(DADOS.acoes, id);
    if (!a) return;
    abrirModal(`
      <h3>Lançar novo preço — ${esc(a.ticker)}</h3>
      <div class="par">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${hojeISO()}"></div>
        <div class="campo"><label for="f_preco">Preço</label>${campoMoeda("f_preco", a.precoAtual)}</div>
      </div>
      <p class="campo ajuda">Isso atualiza o preço atual do ativo e adiciona um ponto ao gráfico de evolução. Preço inserido manualmente — sem cotação automática nesta versão.</p>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvar">Salvar</button></div>`);
    document.getElementById("btnSalvar").onclick = () => {
      const preco = numIn(document.getElementById("f_preco").value);
      const data = document.getElementById("f_data").value || hojeISO();
      const hist = a.historicoPrecos.slice();
      const existente = hist.find((p) => p.data === data);
      if (existente) existente.preco = preco; else hist.push({ data, preco });
      hist.sort((x, y) => x.data.localeCompare(y.data));
      a.historicoPrecos = hist;
      if (data === hojeISO() || data > (a.atualizadoEm || "")) { a.precoAtual = preco; a.atualizadoEm = data; }
      fecharModal();
      salvarEAtualizar("Preço lançado.");
    };
  }

  // =========================================================================
  // CARTEIRA DE AÇÕES (visão consolidada)
  // =========================================================================
  function renderCarteira(d) {
    const total = I.totalCarteiraAcoes(d);
    const resultado = I.resultadoCarteiraAcoes(d);
    const rent = I.rentabilidadeCarteiraAcoes(d);
    const composicao = I.composicaoCarteira(d);
    const dividendos = I.totalDividendosAcoes(d);

    const legenda = composicao.length ? composicao.map((c, i) => `
      <div class="legenda-linha"><span class="legenda-nome"><span class="legenda-ponto" style="background:${G.PALETA_CATEGORIAS[i % G.PALETA_CATEGORIAS.length]}"></span>${esc(c.rotulo)}</span><span class="legenda-pct">${c.peso.toFixed(0)}%</span><span class="legenda-val">${brl(c.valor)}</span></div>
    `).join("") : `<div class="empty">Sem ativos na carteira ainda.</div>`;

    return `
      <div class="grid g-top">
        <div class="c5">${card("", "Composição da carteira", "por ativo", "", `<div class="donut-wrap"><canvas id="graf-carteira-acoes" width="160" height="160" style="width:160px;height:160px"></canvas><div class="legenda">${legenda}</div></div>`)}</div>
        <div class="c7">
          <div class="grid">
            <div class="c6">${metricCard("Valor total da carteira", brl(total), ICONES.investimento, "var(--cy)")}</div>
            <div class="c6">${metricCard("Resultado", brlSinal(resultado), ICONES.resultado, corSinal(resultado) !== "down" ? "var(--up)" : "var(--down)")}</div>
            <div class="c6">${metricCard("Rentabilidade", pct(rent), ICONES.resultado, corSinal(rent) !== "down" ? "var(--up)" : "var(--down)")}</div>
            <div class="c6">${metricCard("Dividendos recebidos", brl(dividendos), ICONES.entrada, "var(--up)")}</div>
          </div>
        </div>
      </div>
      <div class="sechead">POSIÇÕES</div>
      ${card("c12", "Ativos na carteira", "", "", tabelaAcoesResumo(I.listaAcoesComCalculo(d)))}
    `;
  }

  // =========================================================================
  // METAS FINANCEIRAS
  // =========================================================================
  function renderMetas(d) {
    let corpo;
    if (!d.metas.length) {
      corpo = `<div class="c8"><div class="card"><div class="empty">Nenhuma meta cadastrada. Que tal começar por uma reserva de emergência?</div></div></div>`;
    } else {
      // cada meta num quadro igual ao quadro Metas do Dashboard (o mesmo bloco
      // da meta), com o Editar no topo à direita (o "Guardar Mês" aparece no
      // selo 💰 da meta); sempre com o valor de hoje
      corpo = metasPorStatus(d.metas).map((m) => {
        const diasPrazo = m.prazo ? F.diasEntre(m.prazo) : null;
        const vencida = diasPrazo !== null && diasPrazo < 0 && Number(m.atual || 0) < Number(m.objetivo || 0);
        // sem título repetido: o bloco da meta é o mesmo do Dashboard (bolinha, nome,
        // selos e a situação do mês no meio da linha de valores); o Editar fica
        // dentro do quadro de detalhes da meta
        return `<div class="c4"><section class="card card-meta-quadro${vencida ? " card-meta-vencida" : ""}">
          <div class="body"><div class="metas-lista">${itemMetaHtml(m, true)}</div></div>
        </section></div>`;
      }).join("");
    }
    // o botão de nova meta ocupa o espaço de um quadro, com o sinal "+"
    const botaoNova = `<div class="c4"><button class="card card-novo card-novo-meta" data-acao="nova-meta" title="Nova meta" aria-label="Nova meta">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${ICONES.mais}</svg>
    </button></div>`;
    // criar uma meta é feito pelo quadro com "+", sempre no fim da grade
    return `<div class="grid g-top">${corpo}${botaoNova}</div>`;
  }

  function abrirModalMeta(id) {
    const m = id ? achar(DADOS.metas, id) : null;
    abrirModal(`
      <h3>${m ? "Editar meta" : "Nova meta"}</h3>
      ${campoEmoji(EMOJIS_META, m && m.emoji, `<div class="campo"><label for="f_nome">Nome</label><input id="f_nome" value="${m ? esc(m.nome) : ""}" placeholder="Reserva de emergência"></div>`)}
      <div class="par">
        <div class="campo"><label for="f_obj">Objetivo</label>${campoMoeda("f_obj", m ? m.objetivo : "", "R$ 30.000,00")}</div>
        <div class="campo"><label for="f_atual">Valor Atual</label>${campoMoeda("f_atual", m ? m.atual : 0)}</div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_mensal">Guardar Mês</label>${campoMoeda("f_mensal", m && m.aporteMensal ? m.aporteMensal : "", "R$ 500,00")}</div>
        <div class="campo"><label for="f_prazo">Prazo</label><input id="f_prazo" type="date" value="${m ? m.prazo || "" : ""}"></div>
      </div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${m ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    const campoNome = document.getElementById("f_nome");
    const lerEmojiMeta = ligarEmoji(m && m.emoji, () => emojiSugeridoMeta(campoNome.value), campoNome);

    document.getElementById("btnSalvar").onclick = () => {
      const nome = document.getElementById("f_nome").value.trim();
      if (!nome) { toast("Dê um nome para a meta."); return; }
      const registro = {
        id: m ? m.id : A.novoId(),
        nome, objetivo: numIn(document.getElementById("f_obj").value),
        atual: numIn(document.getElementById("f_atual").value),
        prazo: document.getElementById("f_prazo").value,
        aporteMensal: numIn(document.getElementById("f_mensal").value),
        cor: m ? (m.cor || COR_META_PADRAO) : COR_META_PADRAO,   // meta nova sempre em ciano, a cor padrão do sistema
        criadoEm: m ? m.criadoEm : hojeISO(),   // o "Guardar Mês" é cobrado a partir deste mês
        emoji: lerEmojiMeta()
      };
      const atualAntes = m ? Number(m.atual || 0) : undefined;
      if (m) Object.assign(m, registro); else DADOS.metas.push(registro);
      registrarHistMeta(m || registro, atualAntes);
      fecharModal();
      salvarEAtualizar(m ? "Meta atualizada." : "Meta criada.");
    };
    if (m) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      confirmarExclusao(`Excluir a meta "${m.nome}"?`, () => {
        DADOS.metas = DADOS.metas.filter((r) => r.id !== m.id);
        salvarEAtualizar("Meta excluída.");
      });
    };
  }

  // =========================================================================
  // RELATÓRIOS
  // =========================================================================


  function serieMensalPeriodo(d, inicioISO, fimISO) {
    const out = [];
    const cursor = new Date(inicioISO + "T00:00:00"); cursor.setDate(1);
    const fim = new Date(fimISO + "T00:00:00");
    while (cursor <= fim) {
      const chave = cursor.toISOString().slice(0, 7);
      out.push({ mes: chave, rotulo: cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), entradas: totalEntradasEfetivas(d, chave), despesas: totalDespesasPagasMes(d, chave) });
      cursor.setMonth(cursor.getMonth() + 1);
      if (out.length > 24) break;
    }
    return out;
  }
  function despesasPorCategoriaPeriodo(d, inicioISO, fimISO) {
    const mapa = {};
    d.despesas.filter((x) => x.data >= inicioISO && x.data <= fimISO).forEach((x) => {
      const c = x.categoria || "Outros";
      mapa[c] = (mapa[c] || 0) + Number(x.valor || 0);
    });
    return Object.keys(mapa).map((c) => ({ categoria: c, valor: mapa[c] })).sort((a, b) => b.valor - a.valor);
  }

  // meses do quadro A (Receitas x despesas); "Tudo" começa no mês do lançamento mais antigo
  function mesesDoPeriodoRel(d, fx) {
    const primeiraData = [...d.entradas.map((e) => e.data), ...d.despesas.map((x) => x.data), ...(d.contasPagar || []).map((c) => c.vencimento)]
      .filter(Boolean).map(String).sort()[0] || fx.fim;
    const meses = [];
    for (let m = (fx.ini > primeiraData ? fx.ini : primeiraData).slice(0, 7); m <= fx.fim.slice(0, 7) && meses.length < 1200; m = proximoMes(m)) meses.push(m);
    return meses;
  }

  function renderRelatorios(d) {
    if (!anoRelA) anoRelA = String(new Date().getFullYear());
    if (!anoRelB) anoRelB = String(new Date().getFullYear());
    const fxA = intervaloRel(mesesRelA, anoRelA);   // quadro receitas x despesas
    const fxB = intervaloRel(mesesRelB, anoRelB);   // quadro evolução patrimonial
    // receitas e despesas do período seguem o status: só o que está Pago
    // (inclui contas pagas e repetições marcadas como pagas), mês a mês
    // "Tudo" começa no mês do lançamento mais antigo
    const mesesDoPeriodo = mesesDoPeriodoRel(d, fxA);
    const entradasP = mesesDoPeriodo.reduce((t, m) => t + totalEntradasEfetivas(d, m), 0);
    const despesasP = mesesDoPeriodo.reduce((t, m) => t + totalDespesasPagasMes(d, m), 0);
    const historicoP = histPatrimonio(d).filter((h) => h.data >= fxB.ini && h.data <= fxB.fim);
    const picoB = historicoP.length ? Math.max(...historicoP.map((h) => h.valor)) : 0;
    const OPC = [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }, { meses: 0, rotulo: "Tudo" }];
    const rotulo = (m, ano) => (m ? `${m} ${m === 1 ? "mês" : "meses"} de ${ano}` : "Todo histórico");
    const rotuloPeriodo = rotulo(mesesRelA, anoRelA);

    return `
      <div class="grid g-top rel-kpis">
        <div class="c3">${metricCard("Rentabilidade", pct(I.rentabilidadeCarteiraAcoes(d)), ICONES_STRIP.melhorativo, "var(--vi)", "", "Acumulada · Preço Médio", null, "0 0 24 24", "rel-rentabilidade")}</div>
        <div class="c3">${metricCard("Receitas", "+" + brl(entradasP), ICONES_STRIP.poupanca, "var(--up)", "", rotuloPeriodo, null, "0 0 24 24", "rel-receitas")}</div>
        <div class="c3">${metricCard("Despesas", "−" + brl(despesasP), ICONES_STRIP.maiorgasto, "var(--down)", "", rotuloPeriodo, null, "0 0 24 24", "rel-despesas")}</div>
        <div class="c3">${metricCard("Resultado", brlSinal(entradasP - despesasP), ICONES_STRIP.projecao, corSinal(entradasP - despesasP) !== "down" ? "var(--up)" : "var(--down)", "", rotuloPeriodo, null, "0 0 24 24", "rel-resultado")}</div>
      </div>
      <div class="grid">
        <div class="c12">${card("", "Receitas x despesas", `${rotulo(mesesRelA, anoRelA)}`, `<div class="filtro-mes">${LEGENDA_RD}${seletorAnoDash("anoRelA", anoRelA, anosDashboard(d))}${abasMeses("periodo-rel-a", mesesRelA, OPC)}</div>`, `<div class="rel-grafico rel-alto" style="padding:10px 16px;height:220px"><canvas id="graf-rel-mensal"></canvas></div>`)}</div>
      </div>
      <div class="grid">
        <div class="c12">${cardEvolucaoPatrimonial(d, { canvas: "graf-rel-evolucao", classe: "rel-alto", idAno: "anoRelB", acao: "periodo-rel-b", meses: mesesRelB, ano: anoRelB })}</div>
      </div>
    `;
  }





  // =========================================================================
  // CONFIGURAÇÕES — backup, importação de Excel, privacidade
  // =========================================================================
  function renderConfiguracoes(d) {
    // todos os quadros no mesmo padrão: explicação em cima, a lista do que
    // cada ação faz no meio e os botões (tamanho normal) embaixo, alinhados
    // na mesma altura. Backup e Senha (mesmo tamanho) na primeira linha;
    // Sincronização, Cotações e Zona Risco (mesmo tamanho, Zona Risco sempre
    // a última) na segunda.
    // O app estica os quadros até o rodapé (ajustarAlturaConfig).
    // [texto, n]: com n, a linha é opcional e some (a de n maior primeiro) só
    // se a página não couber na tela
    const opc = (n) => (n ? ` class="cfg-opc" data-opc="${n}"` : "");
    const lista = (itens) => `<ul class="cfg-lista">${itens.map((it) => Array.isArray(it) ? `<li${opc(it[1])}>${it[0]}</li>` : `<li>${it}</li>`).join("")}</ul>`;
    const acoes = (html) => `<div class="cfg-acoes">${html}</div>`;
    const ultimoBackup = d.config && d.config.ultimoBackup ? new Date(d.config.ultimoBackup).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const comSenha = window.Bloqueio && Bloqueio.ativo();
    const sc = cfgSync();
    const ultimaSync = sc.ultima ? new Date(sc.ultima).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
    return `
      <div class="grid g-top cfg-grid">
        <div class="cfg-backup">${card("", "Backup Dados", A.ehDesktop ? "arquivo do programa, com cópia automática (dados.bak.json)" : "tudo fica salvo só neste navegador", "", `
          <div class="body pad">
            ${A.ehDesktop ? `<p class="cfg-texto" id="caminhoBanco">Local do banco: carregando…</p>` : ""}
            <p class="cfg-texto"${opc(4)}>Guarde uma cópia dos seus dados de vez em quando. O arquivo de backup leva bancos, lançamentos, investimentos, ações e metas (sem o token da sincronização).</p>
            ${lista([
              ["<b>Exportar Backup</b> baixa um arquivo <b>.json</b> com todos os dados.", 6],
              ["<b>Importar Backup</b> substitui todos os dados atuais pelos do arquivo — o sistema pede confirmação antes.", 1],
              ["<b>Importar Nubank</b> lê o Extrato de Custódia do Nubank e traz os investimentos e as ações (nada é enviado para a internet).", 5],
              ["<b>Importar ICL</b> lê o relatório do Instituto Conhecimento Liberta (PDF) e atualiza toda a guia Nasdaq: cotações, altas e quedas, CDI, IPCA, resumo e análises.", 3]
            ])}
            <p class="cfg-info"${opc(2)}>Último backup exportado: <b>${ultimoBackup || "nenhum ainda"}</b></p>
            ${acoes(`${A.ehDesktop ? `<button class="btn" data-acao="abrir-pasta-banco">Abrir pasta</button>` : ""}
              <button class="btn primario" data-acao="exportar-backup">Exportar Backup</button>
              <button class="btn primario" data-acao="importar-backup">Importar Backup</button>
              <button class="btn btn-pdf" data-acao="importar-pdf">Importar Nubank</button>
              <button class="btn btn-icl" data-acao="importar-relatorio">Importar ICL</button>`)}
          </div>`)}</div>
        <div class="cfg-senha">${card("", "Senha Acesso", "protege o sistema neste aparelho", "", `
          <div class="body pad">
            <p class="cfg-texto">${comSenha ? "A senha está <b>ativa</b>: o sistema pede a senha sempre que é aberto neste aparelho." : "Sem senha: qualquer pessoa com acesso a este aparelho consegue abrir o sistema."}</p>
            ${comSenha ? `<div id="areaBiometria" class="cfg-biometria"></div>` : ""}
            ${lista([
              ["Vale só para este aparelho — os outros continuam com a própria configuração.", 3],
              ["Com a senha criada, dá para desbloquear com a digital (Touch ID) ou o Face ID, quando o aparelho permitir.", 4],
              ["Esqueceu a senha? Será preciso apagar os dados e restaurar um backup.", 1]
            ])}
            ${acoes(comSenha ? `<button class="btn" data-acao="trocar-senha">Trocar senha</button>
              <button class="btn perigo" data-acao="remover-senha">Remover senha</button>`
              : `<button class="btn primario" data-acao="criar-senha">Criar</button>`)}
          </div>`)}</div>
        <div class="cfg-sync">${card("", "Sincronização", "entre aparelhos · web, iPad e Windows", "", sc.ligada ? `
          <div class="body pad">
            <div class="sync-estado"><span class="sync-ponto ligado"></span><b>Ligado</b>
              <span class="dim" id="statusSync">${esc(statusSync || descreverAlteracao(DADOS) || "última sincronização: " + ultimaSync)}</span></div>
            <div class="campo"><label>Código do cofre</label>
              <div class="sync-codigo"><code>${esc(sc.cofre || "sendo criado…")}</code></div></div>
            ${lista([
              "Cada alteração é enviada para o cofre em poucos segundos.",
              ["A cada 2 minutos o sistema confere se outro aparelho mandou algo novo.", 3],
              "Para ligar outro aparelho seu, use o mesmo token."
            ])}
            ${acoes(`<button class="btn primario" data-acao="sincronizar-agora">Sincronizar</button>
              <button class="btn perigo" data-acao="desligar-sync">Desligar</button>`)}
          </div>` : `
          <div class="body pad">
            <div class="sync-estado"><span class="sync-ponto"></span><b>Desligado</b>
              <span class="dim" id="statusSync">${esc(statusSync)}</span></div>
            <div class="campo"><label for="cfgSyncToken">Token do GitHub</label>
              <input id="cfgSyncToken" type="password" autocomplete="off" spellcheck="false" placeholder="ghp_…"></div>
            ${lista([
              ["Crie em GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic), marcando só a permissão <b>gist</b>.", 1],
              ["Ligue primeiro no aparelho com os dados mais completos; nos outros, use o mesmo token.", 2],
              ["O token fica salvo só neste aparelho.", 5]
            ])}
            <p class="cfg-info cfg-alerta"><b>Outras pessoas vão usar o sistema?</b> Cada uma precisa da própria conta do GitHub e do próprio token — com o mesmo token, os dados se misturam no mesmo cofre.</p>
            ${acoes(`<button class="btn primario" data-acao="conectar-sync">Ligar</button>`)}
          </div>`)}</div>
        <div class="cfg-cotacoes">${card("", "Cotações automáticas", "dólar e ações · AwesomeAPI e brapi", "", `
          <div class="body pad">
            <label class="chk-linha"><input type="checkbox" id="cfgCotacoesAuto" ${configCotacoes().auto ? "checked" : ""}> Atualizar cotações a cada 5 min</label>
            <div class="campo"><label for="cfgBrapiToken">Token da brapi.dev</label>
              <input id="cfgBrapiToken" value="${esc(configCotacoes().token)}" placeholder="cole aqui outro token, se quiser"></div>
            ${lista([
              ["Já vem com um token configurado — não precisa mexer.", 2],
              ["Se a internet cair, o sistema mantém os últimos preços e continua funcionando.", 3]
            ])}
            <p class="cfg-info"${opc(1)}>Dólar agora: <b class="acc-laranja">${dolar ? "R$ " + dolar.valor.toFixed(2).replace(".", ",") : "—"}</b></p>
            ${acoes(`<button class="btn primario" data-acao="salvar-cotacoes">Salvar</button>`)}
          </div>`)}</div>
        <div class="cfg-zona"><div class="card" style="border-color:rgba(255,84,104,.3)">
          <header><div><h2 class="down">Zona Risco</h2><div class="sub">esta ação não pode ser desfeita</div></div></header>
          <div class="body"><div class="body pad">
            <p class="cfg-texto">Apaga todos os dados deste aparelho de uma vez.</p>
            ${lista([
              ["Bancos, lançamentos, investimentos, ações e metas.", 4],
              ["O sistema pede confirmação duas vezes.", 5],
              ["Não há como desfazer: exporte um backup antes.", 1]
            ])}
            ${(() => {
              // o que seria apagado hoje, com o ícone de alerta (ocupa o espaço livre do quadro)
              const n = (x) => (x || []).length;
              const itens = [["Bancos", n(d.bancos)], ["Lançamentos", n(d.entradas) + n(d.despesas) + n(d.contasPagar)], ["Investimentos", n(d.investimentos)],
                ["Ações", n(d.acoes)], ["Metas", n(d.metas)], ["Cartões", n(d.cartoes)]];
              return `<div class="zona-resumo">
                <div class="zona-icone"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 5l19 34H5z"/><path d="M24 19v10"/><circle cx="24" cy="34" r="1.2" fill="currentColor"/></svg></div>
                <div class="zona-contagem">${itens.map(([r, v]) => `<div><b>${v}</b><span>${r}</span></div>`).join("")}</div>
                <div class="zona-backup">Último backup: <b>${ultimoBackup || "nenhum ainda"}</b></div>
              </div>`;
            })()}
            ${acoes(`<button class="btn perigo" data-acao="apagar-tudo">Apagar</button>`)}
          </div></div>
        </div></div>
      </div>
    `;
  }

  // =========================================================================
  // GRÁFICOS — montados depois que o HTML da rota já está no DOM
  // =========================================================================
  function montarGraficosRelatorio(d) {
    const fxA = intervaloRel(mesesRelA, anoRelA), fxB = intervaloRel(mesesRelB, anoRelB);
    const historicoP = histEvolucao(d, mesesRelB, anoRelB);
    if (historicoP.length >= 2) G.renderEvolucaoPatrimonio("graf-rel-evolucao", historicoP, { aoClicar: explicarPatrimonio });
    const primeiro = histPatrimonio(d).length ? histPatrimonio(d)[0].data : fxA.ini;
    G.renderReceitasDespesas("graf-rel-mensal", serieMensalPeriodo(d, mesesRelA ? fxA.ini : primeiro, fxA.fim), { aoClicar: explicarMes, semLegenda: window.innerWidth > 600 });   // a legenda fica no cabeçalho, ao lado do ano (no celular, no gráfico)
  }





  // Gráfico de tela cheia (dólar, ação, aplicação): a altura é a que sobra
  // na tela até a linha do rodapé, para o rodapé aparecer inteiro sem
  // precisar arrastar a tela (mínimo de 260 px)
  function ajustarAlturaGrafico() {
    const area = document.querySelector(".grafico-tela-cheia");
    if (!area) return;
    const rodape = document.querySelector(".rodape-app");
    const conteudo = document.getElementById("conteudo");
    const card = area.closest(".card");
    const topo = area.getBoundingClientRect().top + (window.scrollY || document.documentElement.scrollTop || 0);
    const abaixoArea = card ? card.getBoundingClientRect().bottom - area.getBoundingClientRect().bottom : 0;
    const folgaConteudo = conteudo ? parseFloat(getComputedStyle(conteudo).paddingBottom) || 0 : 0;
    const folgaRodape = rodape ? (rodape.offsetHeight + (parseFloat(getComputedStyle(rodape).marginTop) || 0)) : 0;
    const alt = Math.max(260, Math.floor(window.innerHeight - topo - abaixoArea - folgaConteudo - folgaRodape - 2));
    area.style.minHeight = alt + "px";
    area.style.height = alt + "px";
  }
  // guia Configurações (tablet e computador): os quadros crescem até a linha
  // do rodapé, para usar a tela toda sem sobrar faixa vazia nem precisar rolar
  function ajustarAlturaConfig() {
    const grade = document.querySelector("#conteudo .cfg-grid");
    if (!grade) return;
    grade.style.minHeight = "";
    const opcionais = [...grade.querySelectorAll(".cfg-opc")];
    opcionais.forEach((el) => { el.hidden = false; });
    if (window.innerWidth < 700) return;   // celular: tudo à mostra, com rolagem
    const rod = document.querySelector(".rodape-app"), cont = document.getElementById("conteudo");
    const folga = (cont ? parseFloat(getComputedStyle(cont).paddingBottom) || 0 : 0) + (rod ? parseFloat(getComputedStyle(rod).marginTop) || 0 : 0);
    const sobra = () => (rod ? rod.getBoundingClientRect().top - grade.getBoundingClientRect().bottom - folga : 0);
    const passou = () => sobra() < 0 || document.documentElement.scrollHeight > window.innerHeight;
    // tela baixa: tira as linhas opcionais, a menos importante (n maior) primeiro, até caber
    const fila = opcionais.sort((a, b) => Number(b.dataset.opc) - Number(a.dataset.opc));
    for (let i = 0; i < fila.length && passou(); i++) fila[i].hidden = true;
    const resto = sobra();
    if (resto > 1) grade.style.minHeight = Math.floor(grade.offsetHeight + resto) + "px";
    ajustarZonaResumo();
  }
  // Zona Risco: o resumo do que seria apagado só ocupa o espaço que sobra no
  // quadro (não aumenta a linha); se sobrar pouco, mostra só o ícone, e sem
  // espaço nem para isso, some
  function ajustarZonaResumo() {
    const z = document.querySelector("#conteudo .zona-resumo");
    if (!z) return;
    z.classList.remove("zona-sem-backup", "zona-compacta", "zona-oculta");
    if (window.innerWidth < 700) return;
    const naoCabe = () => z.clientHeight < z.scrollHeight - 2;
    if (naoCabe()) z.classList.add("zona-sem-backup");
    if (naoCabe()) z.classList.add("zona-compacta");
    if (z.clientHeight < 70) z.classList.add("zona-oculta");
  }
  // quadro Metas do Dashboard: a altura da lista é a das 3 primeiras metas;
  // as outras ficam embaixo, com barra de rolagem dentro do quadro
  function ajustarRolagemMetas() {
    const lista = document.querySelector("#conteudo .metas-rolagem");
    if (!lista) return;
    lista.style.maxHeight = "";
    const itens = lista.children;
    if (itens.length <= 3) return;
    const fim = itens[2].getBoundingClientRect().bottom - lista.getBoundingClientRect().top;
    lista.style.maxHeight = Math.ceil(fim + (parseFloat(getComputedStyle(lista).paddingBottom) || 0)) + "px";
  }
  window.addEventListener("resize", () => { ajustarAlturaGrafico(); ajustarAlturaConfig(); ajustarRolagemMetas(); });

  function montarGraficosDaRota() {
    const d = DADOS;
    ajustarAlturaGrafico();   // antes de desenhar, para o gráfico já nascer no tamanho certo
    switch (ROTA.secao) {
      case "dashboard": {
        ajustarRolagemMetas();
        if (!anoRD) anoRD = String(new Date().getFullYear());
        if (!anoEvo) anoEvo = String(new Date().getFullYear());
        const hist = historicoEvo(d);
        if (hist.length < 2) break;
        if (hist.length >= 2) G.renderEvolucaoPatrimonio("graf-evolucao", hist, { aoClicar: explicarPatrimonio });
        else G.destruir("graf-evolucao");
        G.renderReceitasDespesas("graf-receitas-despesas", serieRD(d), { aoClicar: explicarMes, semLegenda: window.innerWidth > 600 });   // a legenda fica no cabeçalho
        if (itensPatrimonio(d).length) G.renderDoughnutGenerico("graf-dash-composicao", itensPatrimonio(d), { semLegenda: true, aoClicar: (item) => explicarClasse(item.rotulo) });
        break;
      }
      case "nasdaq": montarGraficoMercado(); break;
      case "financas": {
        if (itensPatrimonio(d).length) G.renderDoughnutGenerico("graf-patrimonio-divisao", itensPatrimonio(d), { semLegenda: true, aoClicar: (item) => explicarClasse(item.rotulo) });
        const serie = serieMensalEfetiva(d, 12);
        G.renderLinhaMultipla("graf-fin-linhas", serie.map((x) => x.rotulo), [
          { rotulo: "Renda", valores: serie.map((x) => x.entradas), cor: G.CORES.up },
          { rotulo: "Despesas", valores: serie.map((x) => x.despesas), cor: G.CORES.down },
          { rotulo: "Poupança", valores: serie.map((x) => x.entradas - x.despesas), cor: G.CORES.azul }
        ]);
        break;
      }
      case "bancos": {
        if (!d.bancos.length) break;
        // tablet e computador: o gráfico ocupa a altura que sobra até o rodapé
        // (a página termina junto com a tela, sem faixa vazia) e encolhe quando
        // a página passaria da tela, para tudo caber sem rolar — até um mínimo
        // em que as barras ainda ficam legíveis
        const caixaGraf = document.getElementById("graf-saldo-bancos") && document.getElementById("graf-saldo-bancos").parentElement;
        if (caixaGraf && window.innerWidth > 760) {
          // espaço vazio entre o fim do conteúdo e o rodapé (o rodapé fica preso embaixo)
          const rod = document.querySelector(".rodape-app"), cont = document.getElementById("conteudo");
          const ultimo = cont && cont.lastElementChild;
          const folga = (cont ? parseFloat(getComputedStyle(cont).paddingBottom) || 0 : 0) + (rod ? parseFloat(getComputedStyle(rod).marginTop) || 0 : 0);
          const sobra = rod && ultimo ? rod.getBoundingClientRect().top - ultimo.getBoundingClientRect().bottom - folga : 0;
          if (sobra > 1) caixaGraf.style.height = Math.floor(caixaGraf.clientHeight + sobra) + "px";
          else {
            const excesso = document.documentElement.scrollHeight - window.innerHeight;
            const minimo = Math.max(120, d.bancos.length * 24 + 50);
            if (excesso > 0) caixaGraf.style.height = Math.max(minimo, Math.floor(caixaGraf.clientHeight - excesso)) + "px";
          }
        }
        G.renderSaldoBancos("graf-saldo-bancos", bancosNaOrdem(bancosDoPeriodo(d)).map((b) => Object.assign({}, b, { saldoAtual: b.valor })),
          { aoClicar: (b) => explicarBanco(b.id) });
        break;
      }
      case "despesas": break;
      case "investimentos": break;
      case "detalhe-dolar": {
        carregarSerieDolar();
        const serie = filtrarPeriodo((serieDolar || []).map((p) => ({ data: p.data, preco: p.preco })), periodoGrafico);
        const atualDolar = dolar ? dolar.valor : (serie.length ? serie[serie.length - 1].preco : 0);
        // a linha de preço termina exatamente no valor atual: as duas linhas se
        // encontram no fim, como a linha do valor aplicado nos investimentos
        if (atualDolar > 0 && serie.length) {
          const hj = hojeISO();
          if (serie[serie.length - 1].data === hj) serie[serie.length - 1] = { ...serie[serie.length - 1], preco: atualDolar };
          else serie.push({ data: hj, preco: atualDolar });
        }
        const alternar = () => { velasDolar = !velasDolar; renderRota(); };
        const vd = velasDolarPeriodo();
        if (velasDolar && vd.velas.length >= 2) G.renderVelas("graf-dolar", vd.velas, { visiveis: vd.visiveis, linhaAtual: atualDolar, corAtual: "#FFD633", rotuloAtual: "Valor Atual", aoClicar: alternar, aoMudarJanela: marcarPeriodoDoZoom });
        else if (serie.length >= 2) G.renderPrecoAcao("graf-dolar", serie, 0, 0, { linhaAtual: atualDolar, aoClicar: alternar });
        // notícias: a busca já começa na visão de linha, para estar pronta ao trocar para velas
        noticiasDoDolar(true);   // gráfico aberto: tem prioridade sobre o segundo plano
        break;
      }
      case "detalhe-cripto": {
        const m = ROTA.param;
        if (!CRIPTOS[m]) break;
        carregarSerieCripto(m);
        const serie = filtrarPeriodo((seriesCripto[m] || []).map((p) => ({ data: p.data, preco: p.preco })), periodoGrafico);
        const atual = cripto && cripto[m] ? cripto[m].valor : (serie.length ? serie[serie.length - 1].preco : 0);
        if (atual > 0 && serie.length) {
          const hj = hojeISO();
          if (serie[serie.length - 1].data === hj) serie[serie.length - 1] = { ...serie[serie.length - 1], preco: atual };
          else serie.push({ data: hj, preco: atual });
        }
        const alternar = () => { velasDolar = !velasDolar; renderRota(); };
        const vc = velasCriptoPeriodo(m);
        if (velasDolar && vc.velas.length >= 2) G.renderVelas("graf-cripto", vc.velas, { visiveis: vc.visiveis, casas: 2, linhaAtual: atual, corAtual: "#FFD633", rotuloAtual: "Valor Atual", aoClicar: alternar, aoMudarJanela: marcarPeriodoDoZoom });
        else if (serie.length >= 2) G.renderPrecoAcao("graf-cripto", serie, 0, 0, { linhaAtual: atual, aoClicar: alternar });
        noticiasDaCripto(m, true);
        break;
      }
      case "detalhe-investimento": {
        const inv = achar(d.investimentos, ROTA.param);
        const h = inv ? historicoGraficoInvestimento(inv) : [];
        if (h.length >= 2) G.renderEvolucaoValor("graf-valor-investimento", filtrarPeriodo(h, periodoGrafico).map((pt) => ({ ...pt, valor: liquidoInvestimentoEm(inv, pt.valor, pt.data) })), Number(inv.valorInvestido || 0), "Valor Aplicado",
          { aoClicar: (ponto, idx, lista) => explicarPontoInvestimento(inv, ponto, idx, lista) });
        break;
      }
      case "detalhe-acao": {
        const a = achar(d.acoes, ROTA.param);
        const alternarAcao = () => { velasAcao = !velasAcao; renderRota(); };
        const va = a ? velasPeriodo(a.historicoPrecos, Number(a.precoAtual) || 0) : { velas: [] };
        if (velasAcao && va.velas.length >= 2) G.renderVelas("graf-preco-acao", va.velas, { visiveis: va.visiveis, linhaAtual: Number(a.precoAtual) || 0, linhaCompra: Number(a.precoMedio) || 0, quantidade: Number(a.quantidade) || 0, casas: 2, aoClicar: alternarAcao, aoMudarJanela: marcarPeriodoDoZoom });
        else if (a && a.historicoPrecos.length) G.renderPrecoAcao("graf-preco-acao", filtrarPeriodo(a.historicoPrecos, periodoGrafico), a.precoMedio, Number(a.precoAtual) || 0, { quantidade: Number(a.quantidade) || 0, aoClicar: alternarAcao });
        // notícias: a busca já começa na visão de linha
        if (a) noticiasDaAcao(a, true);   // gráfico aberto: tem prioridade sobre o segundo plano
        break;
      }
      case "detalhe-mercado": {
        // igual ao gráfico de uma ação da carteira (velas ⇄ linha, períodos, "N" de notícias)
        const a = ativoMercado(ROTA.param);
        if (!a) break;
        const alternar = () => { velasAcao = !velasAcao; renderRota(); };
        const va = velasPeriodo(a.historicoPrecos, Number(a.precoAtual) || 0);
        if (velasAcao && va.velas.length >= 2) G.renderVelas("graf-preco-acao", va.velas, { visiveis: va.visiveis, linhaAtual: Number(a.precoAtual) || 0, linhaCompra: 0, quantidade: 0, casas: 2, aoClicar: alternar, aoMudarJanela: marcarPeriodoDoZoom });
        else if (a.historicoPrecos.length) G.renderPrecoAcao("graf-preco-acao", filtrarPeriodo(a.historicoPrecos, periodoGrafico), 0, Number(a.precoAtual) || 0, { quantidade: 0, aoClicar: alternar });
        if (va.velas.length >= 2) {
          const termos = NOMES_INDICES[ROTA.param] ? { google: `"${NOMES_INDICES[ROTA.param]}"`, gdelt: `"${NOMES_INDICES[ROTA.param]}"` } : termosNoticiasAcao(a);
          const sim = ROTA.param;
          carregarNoticiasVelas("acao:" + a.ticker.toUpperCase(), termos, va.velas, va.visiveis, 1, "graf-preco-acao",
            () => ROTA.secao === "detalhe-mercado" && ROTA.param === sim && velasAcao, true);
        }
        break;
      }
      case "carteira": {
        const comp = I.composicaoCarteira(d);
        if (comp.length) G.renderDoughnutGenerico("graf-carteira-acoes", comp, { semLegenda: true });
        break;
      }
      case "configuracoes":
        // mede de novo depois que os ícones entram nos botões (no quadro seguinte)
        ajustarAlturaConfig();
        requestAnimationFrame(() => requestAnimationFrame(ajustarAlturaConfig));
        break;
      case "relatorios": {
        // como na guia Bancos: no tablet e no computador os dois gráficos
        // dividem a altura que sobra até o rodapé, crescendo ou encolhendo
        // para a página caber na tela sem rolar (com um mínimo legível)
        const caixas = [...document.querySelectorAll("#conteudo .rel-alto")];
        if (caixas.length && window.innerWidth >= 700) {
          const rod = document.querySelector(".rodape-app"), cont = document.getElementById("conteudo");
          const ultimo = cont && cont.lastElementChild;
          const folga = (cont ? parseFloat(getComputedStyle(cont).paddingBottom) || 0 : 0) + (rod ? parseFloat(getComputedStyle(rod).marginTop) || 0 : 0);
          const sobra = rod && ultimo ? rod.getBoundingClientRect().top - ultimo.getBoundingClientRect().bottom - folga : 0;
          const ajuste = sobra > 1 ? sobra : -(document.documentElement.scrollHeight - window.innerHeight);
          const porCaixa = ajuste / caixas.length;
          if (Math.abs(porCaixa) >= 1) caixas.forEach((c) => { c.style.height = Math.max(110, Math.floor(c.clientHeight + porCaixa)) + "px"; });
        }
        montarGraficosRelatorio(d);
        break;
      }
    }
  }

  // =========================================================================
  // DELEGAÇÃO DE EVENTOS DE #conteudo (cliques, mudanças de filtro, busca)
  // =========================================================================
  function ligarDelegacaoConteudo() {
    const cont = document.getElementById("conteudo");

    cont.addEventListener("click", (e) => {
      const b = e.target.closest("[data-acao]");
      if (!b) return;
      const acao = b.dataset.acao;
      const id = b.dataset.id;

      switch (acao) {
        case "ir": navegarPara(b.dataset.secao, b.dataset.id); break;

        case "entrada-banco": abrirModalValorBanco(id); break;
        case "nova-banco": abrirModalBanco(null); break;
        case "nova-transferencia": abrirModalTransferencia(null); break;
        case "editar-transferencia": abrirModalTransferencia(id); break;
        case "nova-transf-auto": abrirModalTransfAuto(null); break;
        case "editar-transf-auto": abrirModalTransfAuto(id); break;
        case "transf-auto-mes": abrirModalTransfAutoMes(id, b.dataset.mes); break;
        case "editar-banco": abrirModalBanco(id); break;

        case "nova-entrada": abrirModalEntrada(null); break;
        case "editar-entrada": abrirModalEntrada(id); break;
        case "excluir-entrada":
          confirmarExclusao("Excluir esta entrada?", () => { DADOS.entradas = DADOS.entradas.filter((x) => x.id !== id); salvarEAtualizar("Entrada excluída."); });
          break;

        case "nova-despesa": abrirModalDespesa(null); break;
        case "editar-despesa": abrirModalDespesa(id); break;
        case "excluir-despesa":
          confirmarExclusao("Excluir esta despesa?", () => { DADOS.despesas = DADOS.despesas.filter((x) => x.id !== id); salvarEAtualizar("Despesa excluída."); });
          break;

        case "novo-cartao": abrirModalCartao(null); break;
        case "editar-cartao": abrirModalCartao(id); break;

        case "nova-conta": abrirModalDespesa(null); break;
        case "editar-conta": abrirModalDespesa(id, "conta"); break;
        case "excluir-conta":
          confirmarExclusao("Excluir esta conta?", () => { DADOS.contasPagar = DADOS.contasPagar.filter((x) => x.id !== id); salvarEAtualizar("Conta excluída."); });
          break;

        case "editar-previsao":
          abrirModalDespesa(id, "despesa", { origemId: id, data: b.dataset.data });
          break;

        case "editar-previsao-conta":
          abrirModalDespesa(id, "conta", { origemId: id, data: b.dataset.data });
          break;

        case "editar-previsao-entrada":
          abrirModalEntrada(id, null, { origemId: id, data: b.dataset.data });
          break;

        case "quitar-mes": alternarStatusLancamento("quitar-mes", id, b.dataset.mes); break;

        case "quitar-mes-conta": alternarStatusLancamento("quitar-mes-conta", id, b.dataset.mes); break;

        case "quitar-mes-entrada": alternarStatusLancamento("quitar-mes-entrada", id, b.dataset.mes); break;

        case "alternar-prevista-entrada": alternarStatusLancamento("alternar-prevista-entrada", id); break;

        case "trocar-banco-entrada": alternarBancoLancamento("trocar-banco-entrada", id); break;

        case "trocar-banco-conta": alternarBancoLancamento("trocar-banco-conta", id); break;

        case "trocar-banco": alternarBancoLancamento("trocar-banco", id); break;

        case "tornar-pendente": alternarStatusLancamento("tornar-pendente", id); break;

        case "alternar-pago": alternarStatusLancamento("alternar-pago", id); break;

        case "novo-investimento": abrirModalInvestimento(null); break;
        case "editar-investimento": abrirModalInvestimento(id); break;

        case "novo-ativo": abrirModalAcao(null); break;
        case "editar-acao": abrirModalAcao(id); break;
        case "explicar-kpi": explicarKPI(b.dataset.kpi); break;
        case "explicar-banco": explicarBanco(id); break;
        case "explicar-classe": explicarClasse(b.dataset.rotulo); break;
        case "explicar-composicao": explicarComposicao(); break;
        case "explicar-meta": explicarMeta(id); break;
        case "ordenar-entradas": {
          const campo = b.dataset.campo;
          ordemEntradas = { campo, dir: ordemEntradas.campo === campo && ordemEntradas.dir === "asc" ? "desc" : "asc" };
          renderRota(); break;
        }
        case "ordenar-despesas": {
          const campo = b.dataset.campo;
          ordemDespesas = { campo, dir: ordemDespesas.campo === campo && ordemDespesas.dir === "asc" ? "desc" : "asc" };
          renderRota(); break;
        }
        case "mes-entradas": mesEntradas = b.dataset.mes; filtroEntradas = null; renderRota(); break;
        case "mes-despesas": mesDespesas = b.dataset.mes; filtroDespesas = null; renderRota(); break;
        case "filtrar-entradas": filtroEntradas = filtroEntradas === b.dataset.status ? null : b.dataset.status; renderRota(); break;
        case "filtrar-despesas": filtroDespesas = filtroDespesas === b.dataset.status ? null : b.dataset.status; renderRota(); break;
        case "ir-dolar": navegarPara("detalhe-dolar"); break;
        case "explicar-relatorio": explicarRelatorio(b.dataset.chave); break;
        case "explicar-strip": explicarStrip(b.dataset.chave); break;
        case "periodo-bancos": mesesBancos = Number(b.dataset.meses); renderRota(); break;
        case "periodo-rel-a": mesesRelA = Number(b.dataset.meses); renderRota(); break;
        case "periodo-rel-b": mesesRelB = Number(b.dataset.meses); renderRota(); break;
        case "periodo-rd": mesesRD = Number(b.dataset.meses); renderRota(); break;
        case "periodo-metas": periodoMetas = Number(b.dataset.meses); renderRota(); break;
        case "periodo-evo": mesesEvo = Number(b.dataset.meses); renderRota(); break;
        case "periodo-grafico": periodoGrafico = b.dataset.periodo; renderRota(); break;
        case "prof-sel": selecionarAtivoBolsa(id); break;
        case "ind-bolsa": indBolsa[id] = !indBolsa[id]; b.classList.toggle("ativo", indBolsa[id]); montarVelasBolsa(); break;
        case "osc-bolsa":
          oscBolsa = id;
          document.querySelectorAll('[data-acao="osc-bolsa"]').forEach((x) => x.classList.toggle("ativo", x.dataset.id === id));
          montarVelasBolsa(); break;
        case "novo-preco-acao": abrirModalNovoPreco(id); break;
        case "novo-valor-investimento": abrirModalNovoValor(id); break;
        case "dispensar-contas": {
          DADOS.config = DADOS.config || {};
          const jaDisp = DADOS.config.contasDispensadas || [];
          const chaves = F.listaContasPagarComStatus(DADOS)
            .filter((c) => c.statusReal !== "Pago")
            .map((c) => c.id + ":" + (c.vencimento || "") + ":" + c.statusReal);
          DADOS.config.contasDispensadas = [...new Set([...jaDisp, ...chaves])];
          salvarEAtualizar("Aviso dispensado. Ele volta se o vencimento ou o status mudar.");
          break;
        }
        case "dispensar-vencimentos": {
          // guarda o par ativo+vencimento; se a data mudar, o aviso volta
          DADOS.config = DADOS.config || {};
          const jaDispensados = DADOS.config.vencDispensados || [];
          const novos = I.investimentosVencendoEm(DADOS, 60).map((v) => v.id + ":" + (v.dataVencimento || ""));
          DADOS.config.vencDispensados = [...new Set([...jaDispensados, ...novos])];
          salvarEAtualizar("Aviso dispensado. Ele volta se a data de vencimento mudar.");
          break;
        }
        case "buscar-investimentos": buscarInvestimentos(); break;
        case "abrir-indicador": abrirIndicador(b.dataset.ind); break;
        case "importar-relatorio": document.getElementById("inputImportarRelatorio").click(); break;
        case "atualizar-mercado": toast("Buscando cotações…"); atualizarMercado(true); renderRota(); break;
        case "buscar-cotacoes":
          if (!configCotacoes().auto) { toast("Ative as cotações automáticas em Configurações."); break; }
          toast("Buscando cotações…"); atualizarCotacoesAutomaticas(false); break;
        case "salvar-cotacoes": {
          DADOS.config.cotacoesAuto = document.getElementById("cfgCotacoesAuto").checked;
          DADOS.config.brapiToken = document.getElementById("cfgBrapiToken").value.trim();
          salvarEAtualizar("Preferências de cotação salvas.");
          if (DADOS.config.cotacoesAuto) atualizarCotacoesAutomaticas(false);
          break;
        }
        case "alternar-edicao-precos":
          if (editandoPrecos) { editandoPrecos = false; salvarEdicaoPrecosEmMassa(); }
          else { editandoPrecos = true; renderRota(); }
          break;

        case "nova-meta": abrirModalMeta(null); break;
        case "editar-meta": abrirModalMeta(id); break;
        case "excluir-meta":
          confirmarExclusao("Excluir esta meta?", () => { DADOS.metas = DADOS.metas.filter((x) => x.id !== id); salvarEAtualizar("Meta excluída."); });
          break;
        case "depositar-meta": abrirModalDeposito(id); break;

        case "ordenar-historico": {
          const campo = b.dataset.campo;
          if (filtrosHistorico.ordenarPor === campo) filtrosHistorico.ordemAsc = !filtrosHistorico.ordemAsc;
          else { filtrosHistorico.ordenarPor = campo; filtrosHistorico.ordemAsc = false; }
          renderRota();
          break;
        }

        case "manter-demo": demoBannerOculto = true; renderRota(); break;
        case "remover-demo":
          confirmarExclusao("Isso vai apagar todos os dados de demonstração e você começará do zero. Continuar?", () => {
            A.limparDados(); toast("Dados de exemplo removidos.");
          });
          break;
        case "recarregar-demo": {
          const temReais = DADOS.bancos.length || DADOS.entradas.length || DADOS.despesas.length || DADOS.acoes.length || DADOS.investimentos.length;
          const msg = temReais ? "Isso vai substituir TODOS os seus dados atuais pelos dados de demonstração. Tem certeza?" : "Carregar os dados de demonstração?";
          confirmarExclusao(msg, () => { A.carregarExemplo(); toast("Dados de exemplo carregados."); });
          break;
        }

        case "ativar-biometria":
          Bloqueio.ativarBiometria()
            .then(() => { toast("Desbloqueio por digital/Face ID ativado neste aparelho."); montarAreaBiometria(); })
            .catch((err) => toast("Não consegui ativar: " + (err && err.name === "NotAllowedError" ? "pedido cancelado" : (err.message || "erro"))));
          break;
        case "remover-biometria":
          confirmarExclusao("Desativar o desbloqueio por digital/Face ID neste aparelho? A senha continuará sendo pedida.", () => {
            Bloqueio.removerBiometria(); montarAreaBiometria(); toast("Desbloqueio por digital/Face ID desativado.");
          });
          break;
        case "criar-senha":
          Bloqueio.abrir({ modo: "criar", aoDesbloquear: () => { renderRota(); toast("Senha criada. Ela será pedida na próxima abertura."); } });
          break;
        case "trocar-senha":
          Bloqueio.abrir({ modo: "criar", aoDesbloquear: () => { renderRota(); toast("Senha alterada."); } });
          break;
        case "remover-senha":
          confirmarExclusao("Remover a senha? O sistema abrirá sem pedir nada neste aparelho.", () => {
            Bloqueio.remover(); renderRota(); toast("Senha removida.");
          });
          break;
        case "conectar-sync": conectarSync(); break;
        case "copiar-cofre":
          if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.cofre).then(() => toast("Código copiado."), () => toast("Código: " + b.dataset.cofre));
          else toast("Código: " + b.dataset.cofre);
          break;
        case "sincronizar-agora": toast("Sincronizando…"); sincronizar(false); break;
        case "desligar-sync": desligarSync(); break;
        case "abrir-pasta-banco": A.abrirPastaBanco(); break;
        case "exportar-backup": A.exportarDados(); toast("Backup exportado — verifique seus downloads."); break;
        case "importar-pdf": document.getElementById("inputImportarPdf").click(); break;
        case "importar-backup": document.getElementById("inputImportarBackup").click(); break;

        case "apagar-tudo":
          confirmarExclusao("Isso vai apagar TODOS os seus dados permanentemente. Essa ação não pode ser desfeita. Deseja continuar?", () => {
            confirmarExclusao("Tem certeza mesmo? Não há como desfazer.", () => { A.limparDados(); toast("Todos os dados foram apagados."); });
          });
          break;
      }
    });

    cont.addEventListener("change", (e) => {
      const id = e.target.id;
      if (id === "anoRelA") { anoRelA = e.target.value; renderRota(); return; }
      if (id === "anoRelB") { anoRelB = e.target.value; renderRota(); return; }
      if (id === "anoBancos") { anoBancos = e.target.value; renderRota(); return; }
      if (id === "anoEntradas") { mesEntradas = e.target.value + mesEntradas.slice(4); filtroEntradas = null; renderRota(); return; }
      if (id === "anoDespesas") { mesDespesas = e.target.value + mesDespesas.slice(4); filtroDespesas = null; renderRota(); return; }
      if (id === "filtroPeriodo") { filtrosHistorico.periodo = e.target.value; renderRota(); }
      else if (id === "filtroTipo") { filtrosHistorico.tipo = e.target.value; renderRota(); }
      else if (id === "filtroBanco") { filtrosHistorico.banco = e.target.value; renderRota(); }
      else if (id === "filtroCategoria") { filtrosHistorico.categoria = e.target.value; renderRota(); }

    });

    let timerBusca = null;
    cont.addEventListener("input", (e) => {
      if (e.target.id === "filtroBusca") {
        clearTimeout(timerBusca);
        const valor = e.target.value;
        timerBusca = setTimeout(() => {
          filtrosHistorico.busca = valor;
          renderRota();
          const el = document.getElementById("filtroBusca");
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 300);
      }
    });
  }

  // =========================================================================
  // ENTRADAS GLOBAIS (arquivos de importação, fora de #conteudo)
  // =========================================================================
  function ligarInputsGlobais() {
    const inpPdf = document.getElementById("inputImportarPdf");
    if (inpPdf) inpPdf.addEventListener("change", (e) => {
      const arquivo = e.target.files[0];
      e.target.value = "";
      if (arquivo) importarPdf(arquivo);
    });

    const inpRel = document.getElementById("inputImportarRelatorio");
    if (inpRel) inpRel.addEventListener("change", (e) => {
      const arquivo = e.target.files[0];
      e.target.value = "";
      if (arquivo) importarRelatorio(arquivo);
    });

    document.getElementById("inputImportarBackup").addEventListener("change", (e) => {
      const arquivo = e.target.files[0];
      e.target.value = "";
      if (!arquivo) return;
      if (!window.confirm("Importar este backup vai substituir TODOS os dados atuais por completo. Deseja continuar?")) return;
      A.importarDados(arquivo)
        .then(() => toast("Backup importado com sucesso."))
        .catch((err) => toast(err.message));
    });

  }

  // =========================================================================
  // BOOT
  // =========================================================================
  function iniciarComInputs() {
    ligarInputsGlobais();
    iniciar();
  }

  function abrirModalDeposito(id) {
    const m = achar(DADOS.metas, id);
    if (!m) return;
    abrirModal(`
      <h3>Depositar — ${nomeMeta(m)}</h3>
      <div class="campo"><label for="f_valor">Quanto você quer depositar?</label>${campoMoeda("f_valor", "")}</div>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvar">Depositar</button></div>`);
    document.getElementById("btnSalvar").onclick = () => {
      const v = numIn(document.getElementById("f_valor").value);
      if (v <= 0) { toast("Informe um valor maior que zero."); return; }
      const atualAntes = Number(m.atual || 0);
      m.atual = atualAntes + v;
      registrarHistMeta(m, atualAntes);
      (m.depositos = Array.isArray(m.depositos) ? m.depositos : []).push({ data: isoLocal(new Date()), valor: v });
      fecharModal();
      salvarEAtualizar(`${brl(v)} adicionado à meta "${m.nome}".`);
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarComInputs);
  } else {
    iniciarComInputs();
  }
})();
