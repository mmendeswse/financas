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
  let buscandoCotacoes = false;

  // Categorias fixas usadas nos formulários (conforme especificação)
  const VERSAO_APP = "1.0.2";
  const CATS_ENTRADA = ["Salário", "Freelance", "Venda", "Dividendos", "Juros", "Cashback", "Outros"];
  const CATS_DESPESA = ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Compras", "Assinaturas", "Impostos", "Investimentos", "Outros"];
  const TIPOS_CONTA_BANCO = ["Conta corrente", "Conta poupança", "Conta digital", "Investimento", "Outro"];
  const FORMAS_PAGAMENTO = ["Débito", "Pix", "Dinheiro", "Cartão de crédito", "Boleto", "Transferência", "Débito automático"];
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
  function seloFreq(reg) {
    const f = freqDe(reg);
    return f === FREQUENCIAS[0] ? "" : ` <span class="selo-tag selo-cat">${esc(f.toLowerCase())}</span>`;
  }

  const CORES_META = ["#22E08A", "#3FC1E0", "#FFB020", "#B487F0", "#FF6F91", "#7C9CF0"];

  // Estado da interface (não persistido — só a sessão atual)
  let DADOS = null;
  let ROTA = { secao: "dashboard", param: null };
  let editandoPrecos = false;
  let periodoGrafico = "tudo";
  let mesesRD = 6;        // meses no gráfico receitas x despesas
  let mesesEvo = 12;      // meses no gráfico de evolução patrimonial   // período mostrado no gráfico do ativo
  let filtrosHistorico = { periodo: "3m", banco: "", categoria: "", tipo: "todos", busca: "", ordenarPor: "data", ordemAsc: false };
  // cada quadro de relatório tem o seu próprio intervalo de datas
  function seisMesesAtras() {
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1);
    return d.toISOString().slice(0, 10);
  }
  let rangeA = null;   // receitas x despesas
  let rangeB = null;   // evolução patrimonial
  function garantirRanges() {
    const padrao = () => ({ ini: seisMesesAtras(), fim: new Date().toISOString().slice(0, 10) });
    if (!rangeA) rangeA = padrao();
    if (!rangeB) rangeB = padrao();
  }
  let demoBannerOculto = false;

  // =========================================================================
  // FORMATAÇÃO
  // =========================================================================
  const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const brl = (v) => fmtBRL.format(Number(v) || 0);
  const brlSinal = (v) => { const n = Number(v) || 0; return (n > 0 ? "+" : n < 0 ? "−" : "") + fmtBRL.format(Math.abs(n)); };
  const pct = (v) => { const n = Number(v) || 0; return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(1).replace(".", ",") + "%"; };
  const corSinal = (v) => (Number(v) >= 0 ? "up" : "down");
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

  function opcoes(lista, atual, comVazio) {
    let html = comVazio ? '<option value="">Selecione…</option>' : "";
    html += lista.map((v) => `<option value="${esc(v)}" ${v === atual ? "selected" : ""}>${esc(v)}</option>`).join("");
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
      : S.procurarCofre(cfg.token).then((id) => id || S.criarCofre(cfg.token, JSON.stringify(DADOS, null, 2)))
         .then((id) => { gravarCfgSync({ cofre: id }); return id; });

    return garantirCofre.then((cofre) => S.baixar(cfg.token, cofre).then((remoto) => {
      const hrLocal = DADOS.atualizadoEm || "";
      const hrRemoto = (remoto && remoto.atualizadoEm) || "";
      if (hrRemoto && hrRemoto > hrLocal) {
        aplicarRemoto(remoto);
        gravarCfgSync({ ultima: new Date().toISOString() });
        mostrarStatusSync("dados atualizados a partir de outro aparelho");
        if (!silencioso) toast("Dados atualizados a partir de outro aparelho.");
      } else if (hrLocal && hrLocal !== hrRemoto) {
        return S.enviar(cfg.token, cofre, JSON.stringify(DADOS, null, 2)).then(() => {
          gravarCfgSync({ ultima: new Date().toISOString() });
          mostrarStatusSync("tudo sincronizado · " + new Date().toLocaleTimeString("pt-BR"));
          if (!silencioso) toast("Dados enviados para o cofre.");
        });
      } else {
        mostrarStatusSync("tudo sincronizado · " + new Date().toLocaleTimeString("pt-BR"));
      }
    })).catch((e) => {
      mostrarStatusSync("não sincronizado: " + e.message);
      if (!silencioso) toast("Sincronização: " + e.message);
    }).then(() => { sincronizando = false; });
  }

  function agendarEnvioSync() {                       // chamado após cada alteração
    if (!cfgSync().token) return;
    clearTimeout(timerEnvio);
    timerEnvio = setTimeout(() => sincronizar(true), 4000);
  }

  function conectarSync() {
    const token = (document.getElementById("cfgSyncToken").value || "").trim();
    const cofreInformado = (document.getElementById("cfgSyncCofre").value || "").trim();
    if (!token) { toast("Cole o token do GitHub para ativar."); return; }
    mostrarStatusSync("verificando token…");
    S.verificarToken(token).then((login) => {
      gravarCfgSync({ token, cofre: cofreInformado });
      mostrarStatusSync("conectado como " + login + " · sincronizando…");
      return sincronizar(false);
    }).then(() => renderRota())
      .catch((e) => { mostrarStatusSync("falhou: " + e.message); toast("Não consegui conectar: " + e.message); });
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
    // tolerância: diferenças de poucos pixels não valem encolher a barra,
    // para o visual continuar igual ao tamanho cheio sempre que possível
    const FOLGA = 6;
    const cabe = () => nav.scrollWidth <= nav.clientWidth + FOLGA && barra.scrollWidth <= barra.clientWidth + FOLGA;
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
  const BANCOS_SUGERIDOS = ["Banco do Brasil", "Nubank", "Itaú", "Mercado Pago", "Caixa Tem", "Inter"];

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


  // =========================================================================
  // CICLO DE VIDA
  // =========================================================================
  function iniciar() {
    DADOS = A.carregarDados();
    I.registrarPontoPatrimonio(DADOS);
    A.salvarDados(DADOS, true);
    A.aoMudar(() => { DADOS = A.carregarDados(); renderRota(); });

    ligarTopbar();
    ligarSidebar();
    ligarModalGlobal();
    ligarCliqueNotificacoes();
    ligarDelegacaoConteudo();
    ligarMascaraMoeda(document.getElementById("conteudo"));
    iniciarRelogio();
    ajustarBarraGuias();
    window.addEventListener("resize", ajustarBarraGuias);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", ajustarBarraGuias);
    window.addEventListener("orientationchange", () => setTimeout(ajustarBarraGuias, 300));

    navegarPara("dashboard");
    atualizarCotacoesAutomaticas(true);
    setInterval(() => atualizarCotacoesAutomaticas(true), 5 * 60 * 1000);
    sincronizar(true);
    setInterval(() => sincronizar(true), 2 * 60 * 1000);
    window.addEventListener("online", () => sincronizar(true));
  }

  function salvarEAtualizar(mensagem) {
    A.salvarDados(DADOS);
    if (mensagem) toast(mensagem);
    agendarEnvioSync();
  }

  function navegarPara(secao, param) {
    ROTA = { secao, param: param || null };
    document.querySelectorAll("#navPrincipal button").forEach((b) => b.classList.toggle("ativo", b.dataset.secao === secao));
    fecharSidebarMobile();
    renderRota();
    const area = document.querySelector(".scroll");
    if (area) area.scrollTop = 0;
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
    "detalhe-investimento": ["Detalhe da aplicação", "Histórico, imposto e rentabilidade"],
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
      acoes: renderAcoes, "detalhe-acao": renderDetalheAcao, "detalhe-investimento": renderDetalheInvestimento, carteira: renderCarteira,
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
    m.innerHTML = html;
    document.getElementById("scrim").classList.add("on");
    const primeiro = m.querySelector("input, select, textarea");
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
  }
  function fecharModal() {
    document.getElementById("modal").classList.remove("on");
    document.getElementById("scrim").classList.remove("on");
  }
  function ligarModalGlobal() {
    ligarMascaraMoeda(document.getElementById("modal"));
    ligarCamposBanco(document.getElementById("modal"));
    document.getElementById("scrim").addEventListener("click", fecharModal);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharModal(); });
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
    btnNotif.addEventListener("click", (e) => {
      e.stopPropagation();
      dropNotif.classList.toggle("on");
      if (dropNotif.classList.contains("on")) preencherNotificacoes();
    });
    document.addEventListener("click", (e) => {
      if (!dropNotif.contains(e.target) && e.target !== btnNotif) dropNotif.classList.remove("on");
    });
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
  function gerarAlertas(d) {
    const alertas = [];

    const atrasadas = F.contasAtrasadas(d);
    if (atrasadas.length) {
      const total = atrasadas.reduce((s, c) => s + Number(c.valor || 0), 0);
      alertas.push({ tipo: "perigo", rota: "despesas", texto: atrasadas.length === 1
        ? `A conta "${atrasadas[0].descricao}" está atrasada (${brl(atrasadas[0].valor)}).`
        : `${atrasadas.length} contas estão atrasadas, somando ${brl(total)}.` });
    }

    const vencendo = F.contasVencendoEm(d, 7).filter((c) => c.statusReal === "Pendente");
    if (vencendo.length) {
      alertas.push({ tipo: "aviso", rota: "despesas", texto: `Existem ${vencendo.length} conta(s) vencendo nos próximos 7 dias.` });
    }

    // categorias de despesa com alta em relação à média dos últimos 3 meses
    const catsAtual = F.despesasPorCategoria(d, F.mesAtual());
    let avisosCategorias = 0;
    for (const c of catsAtual) {
      if (avisosCategorias >= 2) break;
      let soma = 0, meses = 0;
      for (let i = 1; i <= 3; i++) {
        const dt = new Date(); dt.setMonth(dt.getMonth() - i);
        const chave = dt.toISOString().slice(0, 7);
        const v = d.despesas.filter((x) => F.mesDe(x.data) === chave && (x.categoria || "Outros") === c.categoria)
          .reduce((s, x) => s + Number(x.valor || 0), 0);
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
    const gastoAtual = F.totalDespesasMes(d, F.mesAtual());
    let somaAnt = 0, mesesAnt = 0;
    for (let i = 1; i <= 3; i++) {
      const dt = new Date(); dt.setMonth(dt.getMonth() - i);
      const total = F.totalDespesasMes(d, dt.toISOString().slice(0, 7));
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
    if (!pendentes.length) {
      el.innerHTML = '<div class="dropdown-vazio">Nenhum alerta pendente. Tudo em ordem.</div>';
      return;
    }
    el.innerHTML = pendentes.map((a) => `
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
        A.salvarDados(DADOS, true);
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
  function metricCard(rotulo, valor, iconePath, corVar, variacaoHtml, legenda, sparklineValores) {
    const spark = sparklineValores && sparklineValores.length > 1
      ? `<div class="sparkline">${sparklineSVG(sparklineValores, corVar)}</div>` : "";
    return `<div class="metric">
      <div class="topo"><span class="selo" style="background:${corVar}22;color:${corVar}">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${iconePath}</svg>
      </span><span class="rotulo">${rotulo}</span></div>
      <div class="valor">${valor}</div>
      ${variacaoHtml || ""}
      ${spark}
      ${legenda ? `<div class="legenda">${legenda}</div>` : ""}
    </div>`;
  }
  function variacaoPill(v, rotulo) {
    const boa = v >= 0;
    return `<span class="variacao ${boa ? "pos" : "neg"}">${boa ? "▲" : "▼"} ${Math.abs(v).toFixed(1).replace(".", ",")}%</span> <span class="dim" style="font-size:11px">${rotulo || ""}</span>`;
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
  function kpiCard(rotulo, valor, gaugePct, cor, deltaHtml, sub, chave) {
    const clicavel = chave ? ` data-acao="explicar-kpi" data-kpi="${chave}" title="Ver como este percentual é calculado"` : "";
    const gauge = gaugePct == null ? "" :
      `<button class="kpi-gauge${chave ? " clicavel" : ""}"${clicavel}>${gaugeSVG(gaugePct, cor, 66)}<span class="kpi-gauge-txt">${Math.round(Math.max(0, Math.min(100, gaugePct)))}%</span></button>`;
    return `<div class="kpi">
      <div class="kpi-rotulo">${rotulo}</div>
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
    const max = Math.max(...itens.map((i) => Math.abs(i.valor)), 1);
    return `<div class="barlist">` + itens.map((i) => {
      const p = Math.max(0, (i.valor / max) * 100);
      const clic = i.id ? ` data-acao="explicar-banco" data-id="${i.id}" title="Ver detalhes deste banco"` : "";
      return `<${i.id ? "button" : "div"} class="barlist-linha${i.id ? " clicavel" : ""}"${clic}>
        <span class="barlist-nome">${esc(i.nome)}</span>
        <span class="barlist-trilho"><i style="width:${p.toFixed(1)}%;background:${i.cor || cor || "var(--azul)"}">${p >= 22 ? Math.round(p) + "%" : ""}</i></span>
        <b class="barlist-valor ${i.valor < 0 ? "down" : ""}">${brl(i.valor)}</b>
      </${i.id ? "button" : "div"}>`;
    }).join("") + `</div>`;
  }

  // tabela comparativa de despesas por categoria (mês anterior x atual)
  function tabelaCategoriasComparativa(d) {
    const atual = F.despesasPorCategoria(d, F.mesAtual());
    const antMap = {};
    F.despesasPorCategoria(d, F.mesAnterior()).forEach((c) => { antMap[c.categoria] = c.valor; });
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

  function metasMini(d) {
    if (!d.metas.length) return `<div class="empty" style="padding:14px">Nenhuma meta cadastrada.</div>`;
    return `<div class="mix-lista">` + d.metas.slice(0, 4).map((m) => {
      const p = m.objetivo > 0 ? Math.min(100, (m.atual / m.objetivo) * 100) : 0;
      return `<button class="mix-item clicavel" data-acao="explicar-meta" data-id="${m.id}" title="Ver detalhes da meta">
        <div class="mix-topo"><span>${esc(m.nome)}</span><b style="color:${m.cor || "var(--laranja)"}">${p.toFixed(0)}% (${brl(m.atual)})</b></div>
        <div class="progresso fina"><i style="width:${p}%;background:${m.cor || "var(--laranja)"}"></i></div>
      </button>`;
    }).join("") + `</div>`;
  }

  function stripKpis(itens) {
    return `<div class="strip">` + itens.map((i) => `<${i.chave ? "button" : "div"} class="strip-item${i.chave ? " clicavel" : ""}"${i.chave ? ` data-acao="explicar-strip" data-chave="${i.chave}" title="Ver detalhes"` : ""}>
      <span class="strip-ic" style="color:${i.cor};background:${i.cor}1F"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${i.icone}</svg></span>
      <div><div class="strip-rotulo">${i.rotulo}</div><div class="strip-valor">${i.valor}</div><div class="strip-sub">${i.sub || ""}</div></div>
    </${i.chave ? "button" : "div"}>`).join("") + `</div>`;
  }

  // ticker de cotações (faixa persistente abaixo da topbar)
  function atualizarTicker() {
    const tape = document.getElementById("tickerTape");
    const track = document.getElementById("tickerTrack");
    if (!tape || !track) return;
    const lista = I.listaAcoesComCalculo(DADOS);
    if (!lista.length && !dolar) { tape.style.display = "none"; return; }
    const itemDolar = dolar ? `<span class="ticker-item"><b>USD/BRL</b><span class="tp">${dolar.valor.toFixed(2).replace(".", ",")}</span><span class="tv ${dolar.variacaoPct >= 0 ? "up" : "down"}">${Math.abs(dolar.variacaoPct || 0).toFixed(2).replace(".", ",")}%</span></span>` : "";
    const itens = itemDolar + lista.map((a) => {
      const p = a.fontePreco === "auto" && a.variacaoDiaPct != null ? a.variacaoDiaPct : ((a.historicoPrecos || []).length < 2 ? a.rentabilidade : I.variacaoRecente(a).pct);
      return `<span class="ticker-item"><b>${esc(a.ticker)}</b><span class="tp">${a.precoAtual.toFixed(2).replace(".", ",")}</span><span class="tv ${p >= 0 ? "up" : "down"}">${Math.abs(p).toFixed(2).replace(".", ",")}%</span></span>`;
    }).join("");
    track.innerHTML = itens + itens;
    tape.style.display = "";
  }

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

  function renderDolar() {
    const el = document.getElementById("dolarTopbar");
    if (!el) return;
    if (!dolar) { el.style.display = "none"; return; }
    const v = dolar.variacaoPct || 0;
    el.style.display = "";
    el.innerHTML = `<small>USD/BRL</small><b>R$ ${dolar.valor.toFixed(2).replace(".", ",")}</b><span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(2).replace(".", ",")}%</span>`;
  }

  function atualizarCotacoesAutomaticas(silencioso) {
    if (!C || buscandoCotacoes || typeof fetch !== "function") return Promise.resolve();
    const cfg = configCotacoes();
    if (!cfg.auto) return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.onLine === false) { if (!silencioso) toast("Sem internet — mantendo os últimos preços."); return Promise.resolve(); }
    buscandoCotacoes = true;
    const tickers = DADOS.acoes.map((a) => a.ticker.toUpperCase());

    const pDolar = C.buscarDolar().then((r) => { dolar = r; renderDolar(); atualizarTicker(); }).catch(() => {});
    const pAcoes = tickers.length ? C.buscarCotacoes(tickers, cfg.token).then((res) => {
      const mapa = res.cotacoes || {};
      const erros = res.erros || {};
      let alterados = 0;
      DADOS.acoes.forEach((a) => {
        const q = mapa[a.ticker.toUpperCase()];
        if (!q || !(q.preco > 0)) return;
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
      if (alterados) salvarEAtualizar(silencioso ? "" : `Cotações atualizadas (${alterados} ativo(s))${qtdErros ? ` · ${qtdErros} com erro` : ""}.`);
      else if (!silencioso) {
        if (qtdErros) { const k = Object.keys(erros)[0]; toast(`Não consegui buscar ${qtdErros} ativo(s). Ex.: ${k}: ${erros[k]}`); }
        else toast("Cotações já estavam atualizadas.");
      }
      if (qtdErros) console.warn("Cotações com erro:", erros);
    }).catch((e) => { if (!silencioso) toast("Não consegui buscar as ações: " + e.message); }) : Promise.resolve();

    return Promise.all([pDolar, pAcoes]).then(() => { buscandoCotacoes = false; }, () => { buscandoCotacoes = false; });
  }

  function iniciarRelogio() {
    const rel = document.getElementById("relogioTopbar");
    const dataEl = document.getElementById("dataTopbar");
    const tick = () => {
      const agora = new Date();
      if (rel) rel.textContent = agora.toLocaleTimeString("pt-BR");
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
      <div class="sb-meta-nome">${esc(m.nome)}</div>
      <div class="sb-meta-valor">${brl(m.objetivo)}</div>
      <div class="progresso" style="margin:10px 0 8px"><i style="width:${p}%;background:var(--laranja)"></i></div>
      <div class="sb-meta-linha"><span class="dim">Progresso</span><b class="up">${p.toFixed(1).replace(".", ",")}%</b></div>
      <div class="sb-meta-atual">${brl(m.atual)}</div>
      <div class="sb-meta-sub">${m.prazo ? "prazo " + fmtData(m.prazo) : "sem prazo definido"}</div>
      <div class="sb-status"><span class="dot-vivo" style="background:${noPrazo ? "var(--up)" : "var(--down)"}"></span>Status: <b class="${noPrazo ? "up" : "down"}">${noPrazo ? "No prazo" : "Prazo vencido"}</b></div>`;
  }

  function atualizarRodape() {
    const el = document.getElementById("rodapeAtualizado");
    if (el) el.textContent = "Versão " + VERSAO_APP + " · dados atualizados: " + new Date().toLocaleString("pt-BR");
  }


  // ---------------------------------------------------------------------
  // Painel que explica de onde vem cada percentual do dashboard,
  // mostrando a conta com os seus próprios números
  // ---------------------------------------------------------------------
  function explicarKPI(chave) {
    const d = DADOS;
    const p = I.patrimonio(d);
    const mes = F.mesAtual(), mesAnt = F.mesAnterior();
    const entradas = F.totalEntradasMes(d, mes), entradasAnt = F.totalEntradasMes(d, mesAnt);
    const despesas = F.totalDespesasMes(d, mes), despesasAnt = F.totalDespesasMes(d, mesAnt);
    const linha = (rot, val, cls) => `<div class="kv"><span class="dim">${rot}</span><b class="${cls || ""}">${val}</b></div>`;

    const paineis = {
      patrimonio: {
        titulo: "Patrimônio total",
        conta: "bancos + investimentos + ações − dívidas",
        pct: p.bruto > 0 ? (p.liquido / p.bruto) * 100 : 0,
        pctRotulo: "do patrimônio bruto está livre de dívidas",
        linhas: linha("Dinheiro em bancos", brl(p.bancos)) + linha("+ Investimentos", brl(p.investimentos)) +
          linha("+ Ações e FIIs", brl(p.acoes)) + linha("− Dívidas em aberto", brl(p.dividas), "down") +
          linha("= Patrimônio líquido", brl(p.liquido), corSinal(p.liquido)),
        secao: "bancos"
      },
      bancos: {
        titulo: "Saldo bancário",
        conta: "saldo de cada banco = saldo inicial + entradas − despesas",
        pct: p.bruto > 0 ? (p.bancos / p.bruto) * 100 : 0,
        pctRotulo: "do patrimônio bruto está em conta",
        linhas: F.listaBancosComSaldo(d).map((b) => linha(esc(b.nome), brl(b.saldoAtual))).join("") +
          linha("= Total em bancos", brl(p.bancos), "up"),
        secao: "bancos"
      },
      investido: {
        titulo: "Investimentos",
        conta: "(investimentos + ações) ÷ patrimônio bruto",
        pct: I.percentualInvestido(d),
        pctRotulo: "do patrimônio bruto está investido",
        linhas: linha("Renda fixa, tesouro e fundos", brl(p.investimentos)) + linha("Ações, FIIs e ETFs", brl(p.acoes)) +
          linha("= Total investido", brl(p.investimentos + p.acoes), "up") +
          linha("Patrimônio bruto", brl(p.bruto)) +
          linha("Rentabilidade da carteira de ações", pct(I.rentabilidadeCarteiraAcoes(d)), corSinal(I.rentabilidadeCarteiraAcoes(d))),
        secao: "investimentos"
      },
      receitas: {
        titulo: "Receitas do mês",
        conta: "soma das entradas lançadas no mês atual",
        pct: F.variacaoPercentual(entradas, entradasAnt),
        pctRotulo: "de variação em relação ao mês anterior",
        linhas: linha("Receitas deste mês", brl(entradas), "up") + linha("Receitas do mês anterior", brl(entradasAnt)) +
          linha("Diferença", brlSinal(entradas - entradasAnt), corSinal(entradas - entradasAnt)) +
          linha("Lançamentos no mês", String(F.entradasNoMes(d, mes).length)),
        secao: "entradas"
      },
      despesas: {
        titulo: "Despesas do mês",
        conta: "despesas do mês ÷ receitas do mês",
        pct: entradas > 0 ? (despesas / entradas) * 100 : 0,
        pctRotulo: "das receitas do mês já foram gastas",
        linhas: linha("Despesas deste mês", brl(despesas), "down") + linha("Despesas do mês anterior", brl(despesasAnt)) +
          linha("Receitas deste mês", brl(entradas), "up") +
          linha("Sobra do mês", brlSinal(entradas - despesas), corSinal(entradas - despesas)) +
          (F.maiorCategoriaDeGasto(d) ? linha("Maior categoria", esc(F.maiorCategoriaDeGasto(d).categoria) + " · " + brl(F.maiorCategoriaDeGasto(d).valor)) : ""),
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
        <button class="btn primario salvar" id="btnIrPainel">Abrir ${TITULOS[x.secao][0]}</button>
        <button class="btn" id="btnFecharPainel">Fechar</button>
      </div>`);
    document.getElementById("btnIrPainel").onclick = () => { fecharModal(); navegarPara(x.secao); };
    document.getElementById("btnFecharPainel").onclick = fecharModal;
  }


  function painelSimples(titulo, pctValor, pctRotulo, comoCalcula, linhasHtml, secao) {
    abrirModal(`
      <h3>${titulo}</h3>
      <div class="explica-pct"><b>${Math.abs(pctValor).toFixed(1).replace(".", ",")}%</b><span>${pctRotulo}</span></div>
      ${comoCalcula ? `<p class="campo ajuda" style="margin:0 0 12px">Como é calculado: <b>${comoCalcula}</b></p>` : ""}
      <div class="explica-lista">${linhasHtml}</div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnIrPainel">Abrir ${TITULOS[secao][0]}</button>
        <button class="btn" id="btnFecharPainel">Fechar</button>
      </div>`);
    document.getElementById("btnIrPainel").onclick = () => { fecharModal(); navegarPara(secao); };
    document.getElementById("btnFecharPainel").onclick = fecharModal;
  }

  function explicarBanco(id) {
    const d = DADOS;
    const b = achar(d.bancos, id);
    if (!b) return;
    const entradas = d.entradas.filter((e) => e.bancoId === id).reduce((s, e) => s + Number(e.valor || 0), 0);
    const saidas = d.despesas.filter((x) => x.bancoId === id && !x.cartaoId).reduce((s, x) => s + Number(x.valor || 0), 0);
    const saldo = F.saldoBanco(d, b);
    const total = F.totalBancos(d);
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${r}</span><b class="${c || ""}">${v}</b></div>`;
    painelSimples(esc(b.nome), total > 0 ? (saldo / total) * 100 : 0, "do seu dinheiro em bancos está aqui",
      "saldo inicial + entradas − despesas",
      linha("Saldo inicial", brl(b.saldoInicial)) + linha("+ Entradas recebidas", brl(entradas), "up") +
      linha("− Despesas pagas por aqui", brl(saidas), "down") + linha("= Saldo atual", brl(saldo), corSinal(saldo)) +
      linha("Tipo de conta", esc(b.tipo || "—")), "bancos");
  }

  function explicarClasse(rotulo) {
    const d = DADOS;
    const itens = itensPatrimonio(d);
    const item = itens.find((i) => i.rotulo === rotulo);
    if (!item) return;
    const total = itens.reduce((s, i) => s + i.valor, 0);
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${r}</span><b class="${c || ""}">${v}</b></div>`;
    let detalhe = "";
    let secao = "investimentos";
    if (rotulo === "Bancos") {
      detalhe = F.listaBancosComSaldo(d).map((b) => linha(esc(b.nome), brl(b.saldoAtual))).join("");
      secao = "bancos";
    } else if (["Ações", "FIIs", "ETFs"].indexOf(rotulo) > -1) {
      const cat = rotulo === "Ações" ? "Ação" : rotulo === "FIIs" ? "FII" : "ETF";
      detalhe = I.listaAcoesComCalculo(d).filter((a) => a.categoria === cat)
        .map((a) => linha(esc(a.ticker) + " · " + a.quantidade + " un.", brl(a.valorAtual))).join("");
      secao = "acoes";
    } else {
      detalhe = d.investimentos.filter((i) => i.categoria === rotulo)
        .map((i) => linha(esc(i.nome), brl(i.valorAtual))).join("");
    }
    painelSimples(rotulo, total > 0 ? (item.valor / total) * 100 : 0, "do seu patrimônio bruto",
      "valor deste grupo ÷ patrimônio bruto",
      detalhe + linha("= Total do grupo", brl(item.valor), "up") + linha("Patrimônio bruto", brl(total)), secao);
  }

  function explicarMeta(id) {
    const m = achar(DADOS.metas, id);
    if (!m) return;
    const progresso = m.objetivo > 0 ? (m.atual / m.objetivo) * 100 : 0;
    const falta = Math.max(0, Number(m.objetivo || 0) - Number(m.atual || 0));
    const dias = m.prazo ? F.diasEntre(m.prazo) : null;
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${r}</span><b class="${c || ""}">${v}</b></div>`;
    painelSimples(esc(m.nome), progresso, "do objetivo já foi guardado", "valor atual ÷ objetivo",
      linha("Objetivo", brl(m.objetivo)) + linha("Já guardado", brl(m.atual), "up") +
      linha("Falta", brl(falta), falta > 0 ? "down" : "up") +
      linha("Prazo", m.prazo ? fmtData(m.prazo) : "sem prazo") +
      (dias !== null ? linha("Dias restantes", dias >= 0 ? String(dias) : "prazo vencido", dias >= 0 ? "" : "down") : "") +
      (dias !== null && dias > 0 && falta > 0 ? linha("Guardando por mês", brl(falta / Math.max(1, dias / 30))) : ""),
      "metas");
  }


  function explicarStrip(chave) {
    const d = DADOS;
    const mes = F.mesAtual();
    const entradas = F.totalEntradasMes(d, mes), despesas = F.totalDespesasMes(d, mes);
    const hoje = new Date(), dia = hoje.getDate();
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${r}</span><b class="${c || ""}">${v}</b></div>`;

    if (chave === "poupanca") {
      const sobra = entradas - despesas;
      const taxa = entradas > 0 ? (sobra / entradas) * 100 : 0;
      painelSimples("Taxa de poupança", taxa, "das receitas do mês sobraram", "(receitas − despesas) ÷ receitas",
        linha("Receitas do mês", brl(entradas), "up") + linha("− Despesas do mês", brl(despesas), "down") +
        linha("= Sobra", brlSinal(sobra), corSinal(sobra)) +
        linha("Referência saudável", "20% ou mais"), "entradas");
      return;
    }
    if (chave === "projecao") {
      const mediaDia = dia > 0 ? despesas / dia : 0;
      const projecao = mediaDia * diasNoMes;
      let soma = 0, meses = 0;
      for (let i = 1; i <= 3; i++) {
        const dt = new Date(); dt.setMonth(dt.getMonth() - i);
        const t = F.totalDespesasMes(d, dt.toISOString().slice(0, 7));
        if (t > 0) { soma += t; meses++; }
      }
      const media3 = meses ? soma / meses : 0;
      const dif = media3 > 0 ? ((projecao - media3) / media3) * 100 : 0;
      painelSimples("Projeção de despesas", dif, "acima (ou abaixo) da sua média dos últimos meses",
        "(gasto até hoje ÷ dias corridos) × dias do mês",
        linha("Gasto até hoje", brl(despesas), "down") + linha("Dias corridos do mês", `${dia} de ${diasNoMes}`) +
        linha("Média por dia", brl(mediaDia)) + linha("= Projeção para o mês", brl(projecao), "down") +
        linha("Média dos últimos 3 meses", media3 > 0 ? brl(media3) : "sem histórico"), "despesas");
      return;
    }
    if (chave === "maiorgasto") {
      const maior = F.maiorDespesa(d, mes);
      if (!maior) { toast("Nenhuma despesa lançada neste mês."); return; }
      painelSimples("Maior gasto do mês", despesas > 0 ? (Number(maior.valor) / despesas) * 100 : 0,
        "do total gasto no mês veio deste lançamento", "maior valor entre as despesas do mês",
        linha("Descrição", esc(maior.descricao)) + linha("Valor", brl(maior.valor), "down") +
        linha("Categoria", esc(maior.categoria || "—")) + linha("Data", fmtData(maior.data)) +
        linha("Total gasto no mês", brl(despesas)), "despesas");
      return;
    }
    if (chave === "melhorativo") {
      const lista = I.listaAcoesComCalculo(d);
      if (!lista.length) { toast("Nenhum ativo cadastrado."); return; }
      const a = lista.reduce((x, y) => (x.rentabilidade >= y.rentabilidade ? x : y));
      painelSimples(`${esc(a.ticker)} · melhor ativo`, a.rentabilidade, "de rentabilidade sobre o preço médio",
        "(preço atual ÷ preço médio − 1) × 100",
        linha("Empresa", esc(a.empresa || "—")) + linha("Quantidade", String(a.quantidade)) +
        linha("Preço médio", brl(a.precoMedio)) + linha("Preço atual", brl(a.precoAtual)) +
        linha("Valor investido", brl(a.valorInvestido)) + linha("Valor atual", brl(a.valorAtual)) +
        linha("Resultado", brlSinal(a.resultado), corSinal(a.resultado)), "acoes");
      return;
    }
    if (chave === "avencer") {
      const vencendo = F.contasVencendoEm(d, 7).filter((c) => c.statusReal !== "Pago");
      const total = vencendo.reduce((sm, c) => sm + Number(c.valor || 0), 0);
      const saldo = F.totalBancos(d);
      painelSimples("Contas a vencer em 7 dias", saldo > 0 ? (total / saldo) * 100 : 0,
        "do seu saldo em bancos está comprometido", "soma das contas com vencimento nos próximos 7 dias",
        (vencendo.length
          ? vencendo.map((c) => linha(esc(c.descricao) + " · " + fmtData(c.vencimento), brl(c.valor), c.statusReal === "Atrasado" ? "down" : "")).join("")
          : linha("Nenhuma conta nos próximos 7 dias", "—")) +
        linha("= Total a pagar", brl(total), "down") + linha("Saldo em bancos", brl(saldo), "up"), "despesas");
      return;
    }
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  function renderDashboard(d) {
    const p = I.patrimonio(d);
    const mesAtual = F.mesAtual(), mesAnt = F.mesAnterior();
    const entradasMes = F.totalEntradasMes(d, mesAtual), entradasAnt = F.totalEntradasMes(d, mesAnt);
    const despesasMes = F.totalDespesasMes(d, mesAtual), despesasAnt = F.totalDespesasMes(d, mesAnt);
    const resultadoMes = entradasMes - despesasMes, resultadoAnt = entradasAnt - despesasAnt;
    const patrimonioAnt = (() => {
      const hist = d.historicoPatrimonio;
      const alvo = new Date(); alvo.setMonth(alvo.getMonth() - 1);
      const alvoStr = alvo.toISOString().slice(0, 10);
      let ref = hist[0];
      for (const h of hist) if (h.data <= alvoStr) ref = h;
      return ref ? ref.valor : p.liquido;
    })();
    const pctDespesas = entradasMes > 0 ? (despesasMes / entradasMes) * 100 : 0;
    const taxaPoupanca = entradasMes > 0 ? (resultadoMes / entradasMes) * 100 : 0;
    const pctInvestido = I.percentualInvestido(d);
    const pctLivre = p.bruto > 0 ? (p.liquido / p.bruto) * 100 : 0;
    const pctBancos = p.bruto > 0 ? (p.bancos / p.bruto) * 100 : 0;
    const rentCarteira = I.rentabilidadeCarteiraAcoes(d);

    const bancos = F.listaBancosComSaldo(d).sort((a, b) => b.saldoAtual - a.saldoAtual).map((b) => ({ id: b.id, nome: b.nome, valor: b.saldoAtual, cor: b.cor }));
    const composicao = itensPatrimonio(d);
    const totalComp = composicao.reduce((s, i) => s + i.valor, 0);
    const legendaComp = composicao.length ? composicao.map((i) => `<button class="legenda-linha clicavel" data-acao="explicar-classe" data-rotulo="${esc(i.rotulo)}" title="Ver detalhes"><span class="legenda-nome"><span class="legenda-ponto" style="background:${i.cor}"></span>${esc(i.rotulo)}</span><span class="legenda-pct" style="color:${i.cor}">${(totalComp > 0 ? (i.valor / totalComp) * 100 : 0).toFixed(1).replace(".", ",")}%</span><span class="legenda-val">${brl(i.valor)}</span></button>`).join("") : `<div class="empty">Sem ativos ainda.</div>`;

    const histRecente = d.historicoPatrimonio.slice(-30);
    const pico = histRecente.length ? Math.max(...histRecente.map((h) => h.valor)) : 0;

    const acoes = I.listaAcoesComCalculo(d);
    const melhor = acoes.length ? acoes.reduce((a, b) => (a.rentabilidade >= b.rentabilidade ? a : b)) : null;
    const maiorDesp = F.maiorDespesa(d);
    const hoje = new Date(), diaAtual = hoje.getDate(), diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const projecao = diaAtual > 0 ? (despesasMes / diaAtual) * diasNoMes : 0;
    const vencendo = F.contasVencendoEm(d, 7).filter((c) => c.statusReal === "Pendente");
    const totalVencendo = vencendo.reduce((s, c) => s + Number(c.valor || 0), 0);

    const movRecentes = [
      ...d.entradas.map((e) => ({ ...e, __tipo: "entrada" })),
      ...d.despesas.map((x) => ({ ...x, __tipo: "despesa" }))
    ].sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 6);

    return `
      ${faixaDemo(d)}
      <div class="kpi-row">
        ${kpiCard("Patrimônio total", brl(p.liquido), pctLivre, "var(--laranja)", delta(F.variacaoPercentual(p.liquido, patrimonioAnt), "vs mês anterior"), `Dívidas: ${brl(p.dividas)}`, "patrimonio")}
        ${kpiCard("Saldo bancário", brl(p.bancos), pctBancos, "var(--azul)", delta(pctBancos, "do patrimônio"), `${bancos.length} conta(s) cadastrada(s)`, "bancos")}
        ${kpiCard("Investimentos", brl(p.investimentos + p.acoes), pctInvestido, "var(--vi)", delta(rentCarteira, "rent. carteira"), `${pctInvestido.toFixed(0)}% do patrimônio investido`, "investido")}
        ${kpiCard("Receitas do mês", brl(entradasMes), entradasMes + despesasMes > 0 ? (entradasMes / (entradasMes + despesasMes)) * 100 : 0, "var(--up)", delta(F.variacaoPercentual(entradasMes, entradasAnt), "vs mês anterior"), `Mês anterior: ${brl(entradasAnt)}`, "receitas")}
        ${kpiCard("Despesas do mês", brl(despesasMes), pctDespesas, "var(--down)", delta(F.variacaoPercentual(despesasMes, despesasAnt), "vs mês anterior", true), `${pctDespesas.toFixed(0)}% das receitas`, "despesas")}
      </div>

      <div class="grid">
        <div class="c3">${card("", "Saldo por banco", "onde está o seu dinheiro hoje", `<span class="acc-laranja" style="font-size:12px;font-weight:700">Total: ${brl(p.bancos)}</span>`, `<div class="body pad">${barList(bancos)}</div>`)}</div>
        <div class="c3">${card("", "Composição do patrimônio", "ativos brutos, antes das dívidas", "", `
          <div class="donut-wrap">
            <div class="donut-centro"><canvas id="graf-dash-composicao" width="150" height="150" style="width:150px;height:150px"></canvas>
              <div class="donut-rotulo"><b>${pctInvestido.toFixed(1).replace(".", ",")}%</b><span class="acc-laranja">INVESTIDO</span></div>
            </div>
            <div class="legenda">${legendaComp}</div>
          </div>`)}</div>
        <div class="c3">${card("", "Receitas x despesas", `últimos ${mesesRD} meses`, abasMeses("periodo-rd", mesesRD, [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }]), `<div style="padding:8px 14px 12px;height:236px"><canvas id="graf-receitas-despesas"></canvas></div>`)}</div>
        <div class="c3">${card("", "Metas", "progresso dos seus objetivos", `<button class="btn pequeno" data-acao="ir" data-secao="metas">ver todas →</button>`, metasMini(d))}</div>
      </div>

      <div class="grid">
        <div class="c12">${card("", "Evolução patrimonial", "patrimônio líquido por mês", abasMeses("periodo-evo", mesesEvo, [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }, { meses: 0, rotulo: "Tudo" }]) + (pico ? `<span class="pill-pico">PICO ${brl(pico)}</span>` : ""), `<div style="padding:8px 14px 12px;height:236px"><canvas id="graf-evolucao"></canvas></div>`)}</div>
      </div>

      ${stripKpis([
        { rotulo: "TAXA DE POUPANÇA", valor: taxaPoupanca.toFixed(1).replace(".", ",") + "%", sub: `Resultado: ${brlSinal(resultadoMes)}`, cor: "#22E39A", icone: ICONES.resultado, chave: "poupanca" },
        { rotulo: "PROJEÇÃO DE DESPESAS", valor: brl(projecao), sub: `no ritmo atual, até o fim do mês`, cor: "#FF7A1A", icone: ICONES.saida, chave: "projecao" },
        { rotulo: "MAIOR GASTO DO MÊS", valor: maiorDesp ? brl(maiorDesp.valor) : "—", sub: maiorDesp ? esc(maiorDesp.descricao) : "sem despesas", cor: "#FF4D7A", icone: ICONES.saida, chave: "maiorgasto" },
        { rotulo: "MELHOR ATIVO", valor: melhor ? esc(melhor.ticker) : "—", sub: melhor ? `<b class="${corSinal(melhor.rentabilidade)}">${pct(melhor.rentabilidade)}</b> desde o preço médio` : "sem ativos", cor: "#FFC233", icone: ICONES.investimento, chave: "melhorativo" },
        { rotulo: "CONTAS A VENCER (7 DIAS)", valor: brl(totalVencendo), sub: `${vencendo.length} conta(s) pendente(s)`, cor: "#2F8BFF", icone: ICONES.banco, chave: "avencer" }
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
        <div><span class="tk">${esc(a.ticker)}</span> <span class="selo-tag selo-${a.categoria.toLowerCase()}">${esc(a.categoria)}</span></div>
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
        <div><div class="nm">${esc(m.descricao)}</div><div class="sub">${fmtDataCurta(m.data)} · ${esc(m.categoria || "—")}</div></div>
        <div class="r big ${m.__tipo === "entrada" ? "up" : "down"}">${m.__tipo === "entrada" ? "+" : "−"}${brl(m.valor)}</div>
      </div>`).join("");
    return html;
  }

  // =========================================================================
  // FINANÇAS — resumo patrimonial (item 15)
  // =========================================================================
  function itensPatrimonio(d) {
    const acoesPorCat = {};
    d.acoes.forEach((a) => {
      const v = I.valorAtualAcao(a);
      acoesPorCat[a.categoria] = (acoesPorCat[a.categoria] || 0) + v;
    });
    const itens = [{ rotulo: "Bancos", valor: F.totalBancos(d), cor: G.CORES.cy }];
    if (acoesPorCat["Ação"]) itens.push({ rotulo: "Ações", valor: acoesPorCat["Ação"], cor: G.CORES.up });
    if (acoesPorCat["FII"]) itens.push({ rotulo: "FIIs", valor: acoesPorCat["FII"], cor: G.CORES.vi });
    if (acoesPorCat["ETF"]) itens.push({ rotulo: "ETFs", valor: acoesPorCat["ETF"], cor: G.CORES.acc });
    I.investimentosPorCategoria(d).forEach((c, i) => itens.push({ rotulo: c.categoria, valor: c.valor, cor: G.PALETA_CATEGORIAS[(i + 4) % G.PALETA_CATEGORIAS.length] }));
    return itens.filter((i) => i.valor > 0);
  }

  function renderFinancas(d) {
    const p = I.patrimonio(d);
    const itens = itensPatrimonio(d);
    const total = itens.reduce((s, i) => s + i.valor, 0);
    const legendaHtml = itens.length
      ? itens.map((i) => `<div class="legenda-linha"><span class="legenda-nome"><span class="legenda-ponto" style="background:${i.cor}"></span>${esc(i.rotulo)}</span><span class="legenda-pct" style="color:${i.cor}">${(total > 0 ? (i.valor / total) * 100 : 0).toFixed(0)}%</span><span class="legenda-val">${brl(i.valor)}</span></div>`).join("")
      : `<div class="empty">Cadastre bancos, ações ou investimentos para ver a composição.</div>`;

    const serie = F.serieMensal(d, 12);
    const renda = serie.map((s) => s.entradas), desp = serie.map((s) => s.despesas), poup = serie.map((s) => s.entradas - s.despesas);
    const media = (arr) => { const v = arr.filter((x) => x !== 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
    const rendaMes = F.totalEntradasMes(d), despMes = F.totalDespesasMes(d), poupMes = rendaMes - despMes;
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
        <div class="c6">${card("", "Composição do patrimônio", "ativos brutos, antes das dívidas", "", `<div class="donut-wrap"><div class="donut-centro"><canvas id="graf-patrimonio-divisao" width="150" height="150" style="width:150px;height:150px"></canvas><div class="donut-rotulo"><b>${brl(p.bruto).replace("R$", "").trim()}</b><span class="acc-laranja">BRUTO</span></div></div><div class="legenda">${legendaHtml}</div></div>`)}</div>
        <div class="c6">${card("", "Resumo patrimonial", "", "", `
          <div class="kv"><span class="dim">Dinheiro em bancos</span><b>${brl(p.bancos)}</b></div>
          <div class="kv"><span class="dim">+ Ações e FIIs</span><b>${brl(p.acoes)}</b></div>
          <div class="kv"><span class="dim">+ Investimentos (renda fixa, tesouro, fundos...)</span><b>${brl(p.investimentos)}</b></div>
          <div class="kv"><span class="dim">− Dívidas (contas em aberto)</span><b class="down">${brl(p.dividas)}</b></div>
        `, `<span>PATRIMÔNIO LÍQUIDO</span><span class="${corSinal(p.liquido)}" style="font-size:15px">${brl(p.liquido)}</span>`)}</div>
      </div>
    `;
  }

  // =========================================================================
  // BANCOS
  // =========================================================================
  function renderBancos(d) {
    const bancos = F.listaBancosComSaldo(d);
    const total = F.totalBancos(d);
    let listaHtml;
    if (!bancos.length) {
      listaHtml = `<div class="empty">Nenhum banco cadastrado. Use "+ Novo banco" para começar.</div>`;
    } else {
      listaHtml = `<div class="grade-bancos">` + bancos.map((b) => `
          <div class="cartao-item" style="border-left-color:${esc(b.cor || "#3FC1E0")}" data-acao="editar-banco" data-id="${b.id}">
            <div class="linha1"><div><div class="nome">${esc(b.nome)}</div><div class="tipo">${esc(b.tipo || "—")}${b.agencia ? " · Ag " + esc(b.agencia) : ""}${b.conta ? " · Cc " + esc(b.conta) : ""}</div></div></div>
            <div class="saldo ${corSinal(b.saldoAtual)}">${brl(b.saldoAtual)}</div>
            <div class="rodape">saldo inicial ${brl(b.saldoInicial)}</div>
          </div>`).join("") + `</div>`;
    }
    return `
      ${faixaDemo(d)}
      <div class="grid g-top">
        <div class="c12">${card("c12", "Meus bancos", `${bancos.length} conta(s) cadastrada(s)`, `<button class="btn primario" data-acao="nova-banco"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Novo banco</button>`, listaHtml, `<span class="dim">Saldo total em bancos</span><span class="${corSinal(total)}" style="font-size:14px">${brl(total)}</span>`)}</div>
      </div>
      <div class="grid">
        <div class="c12">${card("", "Saldo por banco", "comparação entre as contas", "", `<div style="padding:12px 18px 16px;height:${Math.max(190, bancos.length * 52)}px"><canvas id="graf-saldo-bancos"></canvas></div>`)}</div>
      </div>
    `;
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
        <div class="campo"><label for="f_saldo">Saldo inicial</label>${campoMoeda("f_saldo", b ? b.saldoInicial : "")}</div>
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
  function renderEntradas(d) {
    const lista = [...d.entradas].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    const totalMes = F.totalEntradasMes(d);
    const grid = "grid-template-columns:minmax(0,1fr) 120px 90px 150px";
    let corpo;
    if (!lista.length) {
      corpo = `<div class="empty">Nenhuma entrada cadastrada. Use "+ Nova entrada" para lançar seu salário ou outra receita.</div>`;
    } else {
      corpo = `<div class="hd" style="${grid}"><i>Descrição</i><i>Banco</i><i class="r">Data</i><i class="r hd-valor">Valor</i></div>` +
        lista.map((e) => `
        <div class="rw" style="${grid}">
          <div><div class="nm">${esc(e.descricao)}${seloFreq(e)}</div><div class="sub">${esc(e.categoria)} · ${esc(e.tipo || "")}</div></div>
          <div class="dim" style="font-size:12.5px">${esc(F.nomeBanco(d, e.bancoId))}</div>
          <div class="r dim" style="font-size:12px">${fmtDataCurta(e.data)}</div>
          <div class="cel-valor"><span class="big up">+${brl(e.valor)}</span><span class="cel-botoes">${linhaAcoes("editar-entrada", e.id, "excluir-entrada", e.id)}</span></div>
        </div>`).join("");
    }
    return `
      <div class="grid g-top">
        <div class="c12">${card("c12", "Entradas", `total do mês atual: ${brl(totalMes)}`, `<button class="btn primario" data-acao="nova-entrada"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Nova entrada</button>`, corpo)}</div>
      </div>
    `;
  }

  function abrirModalEntrada(id) {
    const e = id ? achar(DADOS.entradas, id) : null;
    abrirModal(`
      <h3>${e ? "Editar entrada" : "Nova entrada"}</h3>
      <div class="par">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${e ? e.data : hojeISO()}"></div>
        <div class="campo"><label for="f_valor">Valor</label>${campoMoeda("f_valor", e ? e.valor : "")}</div>
      </div>
      <div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="${e ? esc(e.descricao) : ""}" placeholder="Salário"></div>
      <div class="par">
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(CATS_ENTRADA, e ? e.categoria : CATS_ENTRADA[0])}</select></div>
        <div class="campo"><label for="f_banco">Banco</label><select id="f_banco">${opcoesBancos(DADOS.bancos, e ? e.bancoId : "", true)}</select></div>
      </div>
      <div class="campo"><label for="f_tipo">Tipo</label><select id="f_tipo">${opcoes(["Fixa", "Variável"], e ? e.tipo : "Fixa")}</select></div>
      <div class="campo"><label for="f_rec">Repetição</label><select id="f_rec">${opcoes(FREQUENCIAS, freqDe(e))}</select>
        <div class="ajuda">Serve para identificar entradas que se repetem; o lançamento seguinte continua sendo feito por você.</div></div>
      <div class="campo"><label for="f_obs">Observação</label><textarea id="f_obs" placeholder="Opcional">${e ? esc(e.obs || "") : ""}</textarea></div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${e ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    document.getElementById("btnSalvar").onclick = () => {
      const banco = document.getElementById("f_banco").value;
      if (!banco) { toast("Selecione o banco que recebeu o valor."); return; }
      const desc = document.getElementById("f_desc").value.trim();
      if (!desc) { toast("Descreva a entrada."); return; }
      const registro = {
        id: e ? e.id : A.novoId(),
        data: document.getElementById("f_data").value || hojeISO(),
        descricao: desc,
        categoria: document.getElementById("f_cat").value,
        bancoId: banco,
        valor: numIn(document.getElementById("f_valor").value),
        tipo: document.getElementById("f_tipo").value,
        recorrencia: document.getElementById("f_rec").value,
        recorrente: document.getElementById("f_rec").value !== FREQUENCIAS[0],
        obs: document.getElementById("f_obs").value.trim()
      };
      if (e) Object.assign(e, registro); else DADOS.entradas.push(registro);
      fecharModal();
      salvarEAtualizar(e ? "Entrada atualizada." : "Entrada cadastrada.");
    };
    if (e) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
      confirmarExclusao("Excluir esta entrada?", () => {
        DADOS.entradas = DADOS.entradas.filter((x) => x.id !== e.id);
        salvarEAtualizar("Entrada excluída.");
      });
    };
  }

  // =========================================================================
  // DESPESAS
  // =========================================================================
  function renderDespesas(d) {
    // a tela reúne o que já saiu (despesas lançadas) e o que ainda vai
    // sair (contas a pagar), com o status de cada linha
    const lancadas = d.despesas.map((x) => ({
      origem: "despesa", id: x.id, descricao: x.descricao, categoria: x.categoria,
      data: x.data, status: "Pago", valor: Number(x.valor || 0), recorrencia: freqDe(x)
    }));
    const previstas = F.listaContasPagarComStatus(d).map((c) => ({
      origem: "conta", id: c.id, descricao: c.descricao, categoria: c.categoria,
      data: c.vencimento, status: c.statusReal, valor: Number(c.valor || 0), recorrencia: ""
    }));
    const lista = [...lancadas, ...previstas].sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    const totalMes = F.totalDespesasMes(d);
    const aPagar = F.totalAPagar(d);
    const grid = "grid-template-columns:minmax(0,1fr) 120px 112px 168px";

    let corpo;
    if (!lista.length) {
      corpo = `<div class="empty">Nada lançado ainda. Use "+ Nova despesa" para um gasto já feito, ou "+ Conta a pagar" para algo que ainda vai vencer.</div>`;
    } else {
      corpo = `<div class="hd" style="${grid}"><i>Descrição</i><i class="r">Data</i><i class="r">Status</i><i class="r hd-valor">Valor</i></div>` +
        lista.map((x) => `
        <div class="rw" style="${grid}">
          <div><div class="nm">${esc(x.descricao)}${x.recorrencia && x.recorrencia !== FREQUENCIAS[0] ? ` <span class="selo-tag selo-cat">${esc(x.recorrencia.toLowerCase())}</span>` : ""}</div><div class="sub">${esc(x.categoria || "—")}</div></div>
          <div class="r dim" style="font-size:12px">${fmtData(x.data)}</div>
          <div class="r">${x.origem === "conta"
            ? `<button class="selo-tag selo-${x.status.toLowerCase()} selo-botao" data-acao="alternar-pago" data-id="${x.id}" title="Marcar como paga">${x.status}</button>`
            : `<span class="selo-tag selo-pago">${x.status}</span>`}</div>
          <div class="cel-valor"><span class="big down">−${brl(x.valor)}</span><span class="cel-botoes">${
            x.origem === "despesa"
              ? linhaAcoes("editar-despesa", x.id, "excluir-despesa", x.id)
              : linhaAcoes("editar-conta", x.id, "excluir-conta", x.id)
          }</span></div>
        </div>`).join("");
    }

    return `
      <div class="grid g-top">
        <div class="c12">${card("c12", "Despesas", `pagas no mês: ${brl(totalMes)} · em aberto: ${brl(aPagar)}`,
          `<button class="btn primario" data-acao="nova-despesa"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Nova despesa</button>`,
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
    if (d.cartoes.length) {
      html += `<optgroup label="Cartões">` + d.cartoes.map((c) => `<option value="cartao:${c.id}" ${c.id === cartaoIdAtual ? "selected" : ""}>${esc(c.nome)}</option>`).join("") + `</optgroup>`;
    }
    return html;
  }

  // Formulário único de despesa: o campo Status decide onde o registro
  // fica guardado — "Pago" vira uma despesa lançada, "Pendente" vira uma
  // conta a pagar com a data informada como vencimento.
  function abrirModalDespesa(id, origem) {
    origem = origem || "despesa";
    const x = id ? achar(origem === "conta" ? DADOS.contasPagar : DADOS.despesas, id) : null;
    const ehConta = origem === "conta";
    const statusAtual = x ? (ehConta ? (F.statusReal(x) === "Pago" ? "Pago" : "Pendente") : "Pago") : "Pago";
    const dataAtual = x ? (ehConta ? x.vencimento : x.data) : hojeISO();

    abrirModal(`
      <h3>${x ? "Editar lançamento" : "Nova despesa"}</h3>
      <div class="par">
        <div class="campo"><label for="f_data"><span id="rotuloData">${statusAtual === "Pago" ? "Data do pagamento" : "Data de vencimento"}</span></label><input id="f_data" type="date" value="${dataAtual}"></div>
        <div class="campo"><label for="f_valor">Valor</label>${campoMoeda("f_valor", x ? x.valor : "")}</div>
      </div>
      <div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="${x ? esc(x.descricao) : ""}" placeholder="Supermercado"></div>
      <div class="par">
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(CATS_DESPESA, x ? x.categoria : CATS_DESPESA[0])}</select></div>
        <div class="campo"><label for="f_status">Status</label><select id="f_status">${opcoes(["Pago", "Pendente"], statusAtual)}</select>
          <div class="ajuda">"Pendente" guarda como conta a vencer; ela aparece na lista com a data de vencimento.</div></div>
      </div>
      <div id="camposPagamento" style="${statusAtual === "Pago" ? "" : "display:none"}">
        <div class="par">
          <div class="campo"><label for="f_pagarcom">Pago com</label><select id="f_pagarcom">${opcoesPagarCom(DADOS, x && !ehConta ? x.bancoId : "", x && !ehConta ? x.cartaoId : "")}</select></div>
          <div class="campo"><label for="f_forma">Forma de pagamento</label><select id="f_forma">${opcoes(FORMAS_PAGAMENTO, x && !ehConta ? x.formaPagamento : FORMAS_PAGAMENTO[0])}</select></div>
        </div>
        <div class="campo"><label for="f_rec">Repetição</label><select id="f_rec">${opcoes(FREQUENCIAS, freqDe(ehConta ? null : x))}</select></div>
      </div>
      <div class="campo"><label for="f_obs">Observação</label><textarea id="f_obs" placeholder="Opcional">${x ? esc(x.obs || "") : ""}</textarea></div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${x ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    // mostra ou esconde os campos de pagamento conforme o status
    const selStatus = document.getElementById("f_status");
    selStatus.addEventListener("change", () => {
      const pago = selStatus.value === "Pago";
      document.getElementById("camposPagamento").style.display = pago ? "" : "none";
      document.getElementById("rotuloData").textContent = pago ? "Data do pagamento" : "Data de vencimento";
    });

    document.getElementById("btnSalvar").onclick = () => {
      const status = selStatus.value;
      const desc = document.getElementById("f_desc").value.trim();
      if (!desc) { toast("Descreva o lançamento."); return; }
      const data = document.getElementById("f_data").value || hojeISO();
      const valor = numIn(document.getElementById("f_valor").value);
      const categoria = document.getElementById("f_cat").value;
      const obs = document.getElementById("f_obs").value.trim();

      if (status === "Pago") {
        const pagarCom = document.getElementById("f_pagarcom").value;
        if (!pagarCom) { toast("Selecione com o que essa despesa foi paga."); return; }
        const [tipoPg, idPg] = pagarCom.split(":");
        const registro = {
          id: (x && !ehConta) ? x.id : A.novoId(), data, descricao: desc, categoria,
          bancoId: tipoPg === "banco" ? idPg : "", cartaoId: tipoPg === "cartao" ? idPg : "",
          valor, formaPagamento: document.getElementById("f_forma").value,
          recorrencia: document.getElementById("f_rec").value,
          recorrente: document.getElementById("f_rec").value !== FREQUENCIAS[0], obs
        };
        if (x && !ehConta) Object.assign(x, registro);
        else {
          DADOS.despesas.push(registro);
          if (x && ehConta) DADOS.contasPagar = DADOS.contasPagar.filter((r) => r.id !== x.id); // deixou de ser conta
        }
      } else {
        const registro = {
          id: (x && ehConta) ? x.id : A.novoId(), descricao: desc, categoria,
          vencimento: data, valor, status: "Pendente", obs
        };
        if (x && ehConta) Object.assign(x, registro);
        else {
          DADOS.contasPagar.push(registro);
          if (x && !ehConta) DADOS.despesas = DADOS.despesas.filter((r) => r.id !== x.id); // virou conta a pagar
        }
      }
      fecharModal();
      salvarEAtualizar(x ? "Lançamento atualizado." : (status === "Pago" ? "Despesa cadastrada." : "Conta a pagar cadastrada."));
    };

    if (x) document.getElementById("btnExcluir").onclick = () => {
      fecharModal();
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
        <div class="c12">${card("c12", "Cartões de crédito", `${cartoes.length} cartão(ões)`, `<button class="btn primario" data-acao="novo-cartao"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Novo cartão</button>`, corpo)}</div>
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
          <button class="btn fantasma" data-acao="alternar-pago" data-id="${c.id}" title="${c.statusReal === "Pago" ? "Marcar como pendente" : "Marcar como pago"}" style="color:${c.statusReal === "Pago" ? "var(--up)" : "var(--dim)"}">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l3.5 3.5L16 5"/></svg>
          </button>
          <button data-acao="editar-conta" data-id="${c.id}" style="text-align:left"><div class="nm">${esc(c.descricao)}</div><div class="sub">${esc(c.categoria || "—")}</div></button>
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
        <div>${atrasadas.length ? `<b class="down">${atrasadas.length} conta(s) atrasada(s)</b>` : ""}${atrasadas.length && vencendo.length ? " · " : ""}${vencendo.length ? `<b class="acc">${vencendo.length} vencendo nos próximos 7 dias</b>` : ""}</div>
        <button class="fechar" data-acao="dispensar-contas" title="Não avisar mais sobre estas contas" aria-label="Dispensar aviso">×</button>
      </div>`;
    }

    return `
      ${avisos}
      <div class="grid g-top">
        <div class="c12">${card("c12", "Contas a pagar", `${lista.length} conta(s)`, `<button class="btn primario" data-acao="nova-conta"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Nova conta</button>`, corpo, `<span class="dim">Total em aberto</span><span class="down" style="font-size:14px">${brl(totalAberto)}</span>`)}</div>
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
          <button data-acao="${m.__tipo === "Entrada" ? "editar-entrada" : "editar-despesa"}" data-id="${m.id}" style="text-align:left"><div class="nm">${esc(m.descricao)}</div></button>
          <div class="dim" style="font-size:12.5px">${esc(m.categoria || "—")}</div>
          <div class="dim" style="font-size:12.5px">${m.cartaoId ? "💳 " + esc(nomeCartao(d, m.cartaoId)) : esc(F.nomeBanco(d, m.bancoId))}</div>
          <div class="r big ${m.__tipo === "Entrada" ? "up" : "down"}">${m.__tipo === "Entrada" ? "+" : "−"}${brl(m.valor)}</div>
          <div class="r"><span class="selo-tag ${m.__tipo === "Entrada" ? "selo-pago" : "selo-cat"}">${m.__tipo}</span></div>
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
      ${card("c12", "Movimentações", `${lista.length} resultado(s)`, "", corpo)}
    `;
  }

  // =========================================================================
  // INVESTIMENTOS (renda fixa, tesouro, fundos, cripto...)
  // =========================================================================
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
          <td class="papel">${esc(inv.nome)}<small>${esc(inv.tipoAtivo || inv.categoria)}</small></td>
          <td class="col-contratada">${esc(inv.indexador || "—")}${inv.taxaContratada ? " " + f2(inv.taxaContratada) + "%" : ""}</td>
          <td class="r">${fmtDataCurta(inv.dataAplicacao)}</td>
          <td class="r">${inv.dataVencimento ? fmtDataCurta(inv.dataVencimento) : "—"}</td>
          <td class="r ${inv.diasVenc !== null && inv.diasVenc <= 30 ? "acc" : "dim"}">${inv.diasVenc === null ? "—" : inv.diasVenc + "d"}</td>
          <td class="r">${inv.quantidade ? f2(inv.quantidade) : "—"}</td>
          <td class="r creme">${brl(inv.valorInvestido)}</td>
          <td class="r ${corSinal(inv.resultado)}">${brlSinal(inv.resultado)}</td>
          <td class="r creme">${brl(inv.valorAtual)}</td>
          <td class="r dim col-ir">${inv.aliquota === 0 ? "isento" : f2(inv.aliquota) + "%"}</td>
          <td class="r down">${inv.imposto > 0 ? "−" + brl(inv.imposto) : "—"}</td>
          <td class="r up">${brl(inv.liquido)}</td>
          <td class="r ${corSinal(inv.rentBruta)}">${pct(inv.rentBruta)}</td>
          <td class="r ${corSinal(inv.rentLiquida)}">${pct(inv.rentLiquida)}</td>
          <td class="r ${inv.rentAno === null ? "dim" : corSinal(inv.rentAno)}">${inv.rentAno === null ? "—" : pct(inv.rentAno)}</td>
        </tr>`).join("");
      corpo = `<div class="terminal-scroll"><table class="terminal tab-investimentos">
        <thead><tr>
          <th>Ativo</th><th class="col-contratada">Rentab. contratada</th><th class="r">Aplicação</th><th class="r">Vencimento</th><th class="r">Faltam</th>
          <th class="r">Cotas</th><th class="r">Valor aplicado</th><th class="r">Resultado</th><th class="r">Bruto atual</th>
          <th class="r col-ir">IR</th><th class="r">Imposto</th><th class="r">Total líquido</th>
          <th class="r">Rent. bruta</th><th class="r">Rent. líquida</th><th class="r">Ao ano</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr>
          <td>TOTAL</td><td class="col-contratada"></td><td></td><td></td><td></td><td></td>
          <td class="r creme">${brl(t.aplicado)}</td>
          <td class="r ${corSinal(t.resultado)}">${brlSinal(t.resultado)}</td>
          <td class="r creme">${brl(t.bruto)}</td>
          <td class="col-ir"></td>
          <td class="r down">${t.imposto > 0 ? "−" + brl(t.imposto) : "—"}</td>
          <td class="r up">${brl(t.liquido)}</td>
          <td class="r ${corSinal(t.rentBruta)}">${pct(t.rentBruta)}</td>
          <td class="r ${corSinal(t.rentLiquida)}">${pct(t.rentLiquida)}</td>
          <td></td>
        </tr></tfoot>
      </table></div>`;
    }

    const aviso = vencendo.length
      ? `<div class="faixa-demo" style="border-color:rgba(255,194,51,.3)">
          <div><b class="acc">${vencendo.length} investimento(s) vencendo nos próximos 60 dias:</b> ${vencendo.map((v) => esc(v.nome) + " (" + fmtData(v.dataVencimento) + ")").join(" · ")}</div>
          <button class="fechar" data-acao="dispensar-vencimentos" title="Não avisar mais sobre estes vencimentos" aria-label="Dispensar aviso">×</button>
        </div>`
      : "";

    return `
      ${aviso}
      <div class="grid g-top">
        <div class="c12">${card("", "Investimentos", "renda fixa, tesouro, fundos e cripto",
          `<button class="btn primario" data-acao="novo-investimento"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Novo investimento</button>`,
          corpo,
          `<span class="dim">Valor total líquido</span><b class="creme" style="font-size:14px;font-weight:800">${brl(t.liquido)}</b>`)}</div>
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

      <div class="sechead">APLICAÇÃO</div>
      <div class="par">
        <div class="campo"><label for="f_vi">Valor aplicado</label>${campoMoeda("f_vi", inv ? inv.valorInvestido : "")}</div>
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

      <div class="campo"><label for="f_obs">Observações</label><textarea id="f_obs" placeholder="Opcional">${inv ? esc(inv.obs || "") : ""}</textarea></div>
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
        obs: document.getElementById("f_obs").value.trim()
      };
      if (inv) Object.assign(inv, registro); else DADOS.investimentos.push(registro);
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

  function renderDetalheInvestimento(d, id) {
    const inv = achar(d.investimentos, id);
    if (!inv) return `<div class="empty">Aplicação não encontrada. <button class="link-acao" data-acao="ir" data-secao="investimentos">Voltar para Investimentos</button></div>`;

    const aplicado = Number(inv.valorInvestido || 0);
    const bruto = Number(inv.valorAtual || 0);
    const resultado = bruto - aplicado;
    const dias = I.diasCorridos(inv);
    const diasVenc = I.diasAteVencimento(inv);
    const aliq = I.aliquotaIR(inv);
    const imposto = I.impostoInvestimento(inv);
    const liquido = I.valorLiquidoInvestimento(inv);
    const rentBruta = I.rentabilidadeInvestimento(inv);
    const rentLiq = I.rentabilidadeLiquida(inv);
    const rentAno = I.rentabilidadeAnualizada(inv, true);
    const hist = inv.historicoValores || [];
    const valores = hist.map((p) => p.valor);
    const min = valores.length ? Math.min(...valores) : bruto;
    const max = valores.length ? Math.max(...valores) : bruto;
    const f2 = (v) => Number(v || 0).toFixed(2).replace(".", ",");

    return `
      <button class="voltar" data-acao="ir" data-secao="investimentos"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.voltar}</svg>Voltar para Investimentos</button>
      <div class="grid g-top grid-detalhe">
        <div class="c8">${card("", `${esc(inv.nome)} <span class="selo-tag selo-acao">${esc(inv.tipoAtivo || inv.categoria)}</span>`,
          `${esc(inv.emissor || "emissor não informado")}${inv.indexador ? " · " + esc(inv.indexador) + (inv.taxaContratada ? " " + f2(inv.taxaContratada) + "%" : "") : ""}`,
          `${abasPeriodo()}<button class="btn primario" data-acao="novo-valor-investimento" data-id="${inv.id}">Lançar novo valor</button><button class="btn" data-acao="editar-investimento" data-id="${inv.id}">Editar</button>`,
          hist.length >= 2
            ? `<div style="padding:10px 16px;height:260px"><canvas id="graf-valor-investimento"></canvas></div>`
            : `<div class="empty">Ainda não há histórico suficiente para o gráfico.<br>Use "Lançar novo valor" sempre que consultar o saldo — cada lançamento vira um ponto na linha.</div>`)}</div>
        <div class="c4">${card("", "Resumo da aplicação", "", "", `
          <div class="kv"><span class="dim">Quantidade de cotas</span><b>${inv.quantidade ? f2(inv.quantidade) : "—"}</b></div>
          <div class="kv"><span class="dim">Preço por cota (aplicação)</span><b>${inv.quantidade ? brl(aplicado / inv.quantidade) : "—"}</b></div>
          <div class="kv"><span class="dim">Preço por cota (hoje)</span><b>${inv.quantidade ? brl(bruto / inv.quantidade) : "—"}</b></div>
          <div class="kv"><span class="dim">Valor aplicado</span><b>${brl(aplicado)}</b></div>
          <div class="kv"><span class="dim">Valor bruto atual</span><b>${brl(bruto)}</b></div>
          <div class="kv"><span class="dim">Lucro / prejuízo</span><b class="${corSinal(resultado)}">${brlSinal(resultado)}</b></div>
          <div class="kv"><span class="dim">Rentabilidade líquida</span><b class="${corSinal(rentLiq)}">${pct(rentLiq)}</b></div>
          <div class="kv"><span class="dim">Imposto estimado (${aliq === 0 ? "isento" : f2(aliq) + "%"})</span><b class="down">${imposto > 0 ? "−" + brl(imposto) : brl(0)}</b></div>
          <div class="kv"><span class="dim">Menor valor (histórico)</span><b>${brl(min)}</b></div>
          <div class="kv"><span class="dim">Maior valor (histórico)</span><b>${brl(max)}</b></div>
          <div class="kv"><span class="dim">Vencimento</span><b>${inv.dataVencimento ? fmtData(inv.dataVencimento) : "—"}</b></div>
        `)}</div>
      </div>
      ${inv.obs ? card("c12", "Observações", "", "", `<div style="padding:12px 16px;font-size:13px;color:var(--dim)">${esc(inv.obs)}</div>`) : ""}
    `;
  }

  function abrirModalNovoValor(id) {
    const inv = achar(DADOS.investimentos, id);
    if (!inv) return;
    abrirModal(`
      <h3>Lançar novo valor — ${esc(inv.nome)}</h3>
      <div class="par">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${hojeISO()}"></div>
        <div class="campo"><label for="f_valor">Valor bruto</label>${campoMoeda("f_valor", inv.valorAtual)}</div>
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
      fecharModal();
      salvarEAtualizar("Valor lançado.");
    };
  }

  // =========================================================================
  // AÇÕES (terminal)
  // =========================================================================
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
          : `<span class="${forte}">${f2(a.precoAtual)}</span>`;
        return `<tr data-acao="ir" data-secao="detalhe-acao" data-id="${a.id}">
          <td class="papel">${esc(a.ticker)}<small>${esc(a.categoria)}</small></td>
          <td class="r">${ultima}</td>
          <td class="r ${v.valor >= 0 ? "up" : "down"}">${v.valor >= 0 ? "+" : ""}${f2(v.valor)}</td>
          <td class="r">${fp(v.pct)}</td>
          <td class="r">${fn(a.quantidade)}</td>
          <td class="r">${f2(a.precoMedio)}</td>
          <td class="r">${fn(a.valorInvestido)}</td>
          <td class="r creme">${fn(a.valorAtual)}</td>
          <td class="r ${corSinal(a.resultado)}">${a.resultado >= 0 ? "+" : "−"}${fn(Math.abs(a.resultado))}</td>
          <td class="r">${fp(a.rentabilidade)}</td>
          <td class="r dim">${f2(mm.min)}</td>
          <td class="r dim">${f2(mm.max)}</td>
          <td class="r">${fp(m30)}</td>
          <td class="r">${fp(m365)}</td>
          <td class="r">${fn(a.dividendos || 0)}</td>
          <td class="r">${f2(a.peso)}%</td>
          <td class="r dim">${fmtDataCurta(a.atualizadoEm)}</td>
        </tr>`;
      }).join("");
      const tInv = I.totalInvestidoAcoes(d), tAt = I.totalCarteiraAcoes(d), tRes = tAt - tInv;
      corpo = `<div class="terminal-scroll"><table class="terminal">
        <thead><tr>
          <th>Papel</th><th class="r">Última</th><th class="r">Var.</th><th class="r">Var. %</th><th class="r">Qtd.</th><th class="r">PM</th>
          <th class="r">Investido</th><th class="r">Atual</th><th class="r">Resultado</th><th class="r">Rent. %</th>
          <th class="r">Mínima</th><th class="r">Máxima</th><th class="r">Mensal %</th><th class="r">Anual %</th>
          <th class="r">Divid.</th><th class="r">Peso</th><th class="r">Atualiz.</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr>
          <td>CARTEIRA</td><td></td><td></td><td></td><td></td><td></td>
          <td class="r">${fn(tInv)}</td><td class="r creme">${fn(tAt)}</td>
          <td class="r ${corSinal(tRes)}">${tRes >= 0 ? "+" : "−"}${fn(Math.abs(tRes))}</td>
          <td class="r">${fp(I.rentabilidadeCarteiraAcoes(d))}</td>
          <td></td><td></td><td></td><td></td><td class="r">${fn(I.totalDividendosAcoes(d))}</td><td class="r">100%</td><td></td>
        </tr></tfoot>
      </table></div>`;
    }

    return `
      <div class="grid g-top">
        <div class="c12">${card("", "Painel de ativos", (configCotacoes().auto ? '<span class="selo-tag selo-acao">cotação automática · brapi.dev</span>' : '<span class="selo-tag selo-cat">preço atualizado manualmente</span>'),
          `<div class="dolar-pill" id="dolarTopbar" title="Dólar comercial (AwesomeAPI)" style="display:none"></div>
           <button class="btn" data-acao="buscar-cotacoes" title="Buscar cotações na internet agora">↻ Buscar cotações</button>
           <button class="btn ${editandoPrecos ? "primario" : ""}" data-acao="alternar-edicao-precos">${editandoPrecos ? "Concluir edição" : "Editar manualmente"}</button>
           <button class="btn primario" data-acao="novo-ativo"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Novo ativo</button>`,
          corpo,
          `<span class="dim">Valor total da carteira</span><b class="creme" style="font-size:14px;font-weight:800">${brl(I.totalCarteiraAcoes(d))}</b>`)}</div>
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
    if (alterados) salvarEAtualizar(`${alterados} preço(s) atualizado(s).`);
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

  function filtrarPeriodo(historico, chave) {
    const op = PERIODOS_GRAFICO.find((x) => x.chave === chave);
    if (!op || !op.dias) return historico || [];
    const limite = new Date();
    limite.setDate(limite.getDate() - op.dias);
    const corte = limite.toISOString().slice(0, 10);
    const filtrado = (historico || []).filter((p) => p.data >= corte);
    // se o período escolhido não tiver pontos, mostra tudo em vez de um gráfico vazio
    return filtrado.length >= 2 ? filtrado : (historico || []);
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
    const investido = I.valorInvestidoAcao(a), atual = I.valorAtualAcao(a);
    const resultado = atual - investido, rent = I.rentabilidadeAcao(a);
    const { min, max } = I.precoMinMax(a);

    return `
      <button class="voltar" data-acao="ir" data-secao="acoes"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.voltar}</svg>Voltar para Ações</button>
      <div class="grid g-top grid-detalhe">
        <div class="c8">${card("", `${esc(a.ticker)} <span class="selo-tag selo-${a.categoria.toLowerCase()}">${a.categoria}</span>`, esc(a.empresa),
          `${abasPeriodo()}<button class="btn primario" data-acao="novo-preco-acao" data-id="${a.id}">Lançar novo preço</button><button class="btn" data-acao="editar-acao" data-id="${a.id}">Editar</button>`,
          `<div style="padding:10px 16px;height:260px"><canvas id="graf-preco-acao"></canvas></div>`)}</div>
        <div class="c4">${card("", "Resumo da posição", "", "", `
          <div class="kv"><span class="dim">Quantidade</span><b>${a.quantidade}</b></div>
          <div class="kv"><span class="dim">Preço médio</span><b>${brl(a.precoMedio)}</b></div>
          <div class="kv"><span class="dim">Preço atual</span><b>${brl(a.precoAtual)}</b></div>
          <div class="kv"><span class="dim">Total investido</span><b>${brl(investido)}</b></div>
          <div class="kv"><span class="dim">Valor atual</span><b>${brl(atual)}</b></div>
          <div class="kv"><span class="dim">Lucro / prejuízo</span><b class="${corSinal(resultado)}">${brlSinal(resultado)}</b></div>
          <div class="kv"><span class="dim">Rentabilidade</span><b class="${corSinal(rent)}">${pct(rent)}</b></div>
          <div class="kv"><span class="dim">Dividendos recebidos</span><b class="up">${brl(a.dividendos || 0)}</b></div>
          <div class="kv"><span class="dim">Preço mínimo (histórico)</span><b>${brl(min)}</b></div>
          <div class="kv"><span class="dim">Preço máximo (histórico)</span><b>${brl(max)}</b></div>
          <div class="kv"><span class="dim">Atualizado em</span><b>${fmtData(a.atualizadoEm)}</b></div>
        `)}</div>
      </div>
      ${a.obs ? card("c12", "Observações", "", "", `<div style="padding:12px 16px;font-size:13px;color:var(--dim)">${esc(a.obs)}</div>`) : ""}
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
            <div class="c6">${metricCard("Resultado", brlSinal(resultado), ICONES.resultado, corSinal(resultado) === "up" ? "var(--up)" : "var(--down)")}</div>
            <div class="c6">${metricCard("Rentabilidade", pct(rent), ICONES.resultado, corSinal(rent) === "up" ? "var(--up)" : "var(--down)")}</div>
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
      corpo = `<div class="c12"><div class="empty">Nenhuma meta cadastrada. Que tal começar por uma reserva de emergência?</div></div>`;
    } else {
      corpo = d.metas.map((m) => {
        const progresso = m.objetivo > 0 ? Math.min(100, (m.atual / m.objetivo) * 100) : 0;
        return `<div class="c4"><div class="card">
          <header><div><h2>${esc(m.nome)}</h2>${m.prazo ? `<div class="sub">até ${fmtData(m.prazo)}</div>` : ""}</div>
            <div class="acoes">${linhaAcoes("editar-meta", m.id, "excluir-meta", m.id)}</div>
          </header>
          <div class="body pad">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span class="num" style="font-size:18px;font-weight:600">${brl(m.atual)}</span>
              <span class="dim num" style="font-size:12.5px">de ${brl(m.objetivo)}</span>
            </div>
            <div class="progresso"><i style="width:${progresso}%;background:${m.cor || "var(--up)"}"></i></div>
            <div class="progresso-legenda"><span>${progresso.toFixed(1)}%</span><span>${brl(Math.max(0, m.objetivo - m.atual))} restantes</span></div>
            <button class="btn pequeno" style="margin-top:12px;width:100%;justify-content:center" data-acao="depositar-meta" data-id="${m.id}">+ Adicionar valor</button>
          </div>
        </div></div>`;
      }).join("");
    }
    return `<div class="grid g-top">
      <div class="c12" style="display:flex;justify-content:flex-end">
        <button class="btn primario" data-acao="nova-meta"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>Nova meta</button>
      </div>
    </div>
    <div class="grid">${corpo}</div>`;
  }

  function abrirModalMeta(id) {
    const m = id ? achar(DADOS.metas, id) : null;
    abrirModal(`
      <h3>${m ? "Editar meta" : "Nova meta"}</h3>
      <div class="campo"><label for="f_nome">Nome da meta</label><input id="f_nome" value="${m ? esc(m.nome) : ""}" placeholder="Reserva de emergência"></div>
      <div class="par">
        <div class="campo"><label for="f_obj">Objetivo</label>${campoMoeda("f_obj", m ? m.objetivo : "", "R$ 30.000,00")}</div>
        <div class="campo"><label for="f_atual">Valor atual</label>${campoMoeda("f_atual", m ? m.atual : 0)}</div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_prazo">Prazo</label><input id="f_prazo" type="date" value="${m ? m.prazo || "" : ""}"></div>
        <div class="campo"><label for="f_cor">Cor</label><input id="f_cor" type="color" value="${m ? m.cor || "#22E08A" : CORES_META[DADOS.metas.length % CORES_META.length]}"></div>
      </div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${m ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    document.getElementById("btnSalvar").onclick = () => {
      const nome = document.getElementById("f_nome").value.trim();
      if (!nome) { toast("Dê um nome para a meta."); return; }
      const registro = {
        id: m ? m.id : A.novoId(),
        nome, objetivo: numIn(document.getElementById("f_obj").value),
        atual: numIn(document.getElementById("f_atual").value),
        prazo: document.getElementById("f_prazo").value,
        cor: document.getElementById("f_cor").value
      };
      if (m) Object.assign(m, registro); else DADOS.metas.push(registro);
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
      out.push({ mes: chave, rotulo: cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), entradas: F.totalEntradasMes(d, chave), despesas: F.totalDespesasMes(d, chave) });
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

  function renderRelatorios(d) {
    garantirRanges();
    const entradasP = d.entradas.filter((e) => e.data >= rangeA.ini && e.data <= rangeA.fim).reduce((s, e) => s + Number(e.valor), 0);
    const despesasP = d.despesas.filter((x) => x.data >= rangeA.ini && x.data <= rangeA.fim).reduce((s, x) => s + Number(x.valor), 0);
    const historicoP = d.historicoPatrimonio.filter((h) => h.data >= rangeB.ini && h.data <= rangeB.fim);

    const seletor = (quadro, r) => `<div class="range-datas">
      <input type="date" id="${quadro}_ini" value="${r.ini}" max="${r.fim}" title="Data inicial">
      <span class="dim">até</span>
      <input type="date" id="${quadro}_fim" value="${r.fim}" min="${r.ini}" title="Data final">
    </div>`;

    return `
      <div class="grid g-top">
        <div class="c3">${metricCard("Receitas no período", brl(entradasP), ICONES.entrada, "var(--up)", "", `${fmtData(rangeA.ini)} a ${fmtData(rangeA.fim)}`)}</div>
        <div class="c3">${metricCard("Despesas no período", brl(despesasP), ICONES.saida, "var(--down)", "", `${fmtData(rangeA.ini)} a ${fmtData(rangeA.fim)}`)}</div>
        <div class="c3">${metricCard("Resultado do período", brlSinal(entradasP - despesasP), ICONES.resultado, corSinal(entradasP - despesasP) === "up" ? "var(--up)" : "var(--down)")}</div>
        <div class="c3">${metricCard("Rentabilidade da carteira", pct(I.rentabilidadeCarteiraAcoes(d)), ICONES.investimento, "var(--vi)", "", "acumulada, desde o preço médio")}</div>
      </div>
      <div class="grid">
        <div class="c12">${card("", "Receitas x despesas", "por mês, no intervalo escolhido", seletor("rangeA", rangeA), `<div style="padding:10px 16px;height:220px"><canvas id="graf-rel-mensal"></canvas></div>`)}</div>
      </div>
      <div class="grid">
        <div class="c12">${card("", "Evolução patrimonial", "no intervalo escolhido", seletor("rangeB", rangeB), historicoP.length >= 2 ? `<div style="padding:10px 16px;height:220px"><canvas id="graf-rel-evolucao"></canvas></div>` : `<div class="empty">Ainda não há histórico suficiente para este intervalo.</div>`)}</div>
      </div>
    `;
  }



  // =========================================================================
  // CONFIGURAÇÕES — backup, importação de Excel, privacidade
  // =========================================================================
  function renderConfiguracoes(d) {
    const temDadosReais = d.bancos.length || d.entradas.length || d.despesas.length || d.acoes.length || d.investimentos.length;
    return `
      <div class="grid g-top">
        <div class="c6">${card("", "Backup dos dados", A.ehDesktop ? "banco de dados em arquivo dentro do programa, com cópia automática (dados.bak.json)" : "tudo fica salvo só neste navegador — guarde uma cópia de vez em quando", "", `
          ${A.ehDesktop ? `<p class="campo ajuda" style="padding:8px 16px 0" id="caminhoBanco">Local do banco: carregando…</p><div style="padding:0 16px 6px"><button class="btn pequeno" data-acao="abrir-pasta-banco">Abrir pasta do banco de dados</button></div>` : ""}
          <div class="body pad" style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn primario" data-acao="exportar-backup">Exportar backup (.json)</button>
            <button class="btn" data-acao="importar-backup">Importar backup</button>
          </div>
          <p class="campo ajuda" style="padding:0 16px 14px">Importar um backup substitui todos os dados atuais — o sistema pede confirmação antes de aplicar.</p>
        `)}</div>
        <div class="c6">${card("", "Senha de acesso", "protege o sistema neste aparelho", "", `
          <div class="body pad">
            ${window.Bloqueio && Bloqueio.ativo() ? `
              <div id="areaBiometria" style="margin:12px 0"></div>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="btn" data-acao="trocar-senha">Trocar senha</button>
                <button class="btn perigo" data-acao="remover-senha">Remover senha</button>
              </div>
            ` : `
              <button class="btn primario" data-acao="criar-senha">Criar senha numérica</button>
            `}
            <p class="campo ajuda" style="margin-top:12px">A senha vale só neste aparelho e não é sincronizada. Ela impede o acesso casual, mas não embaralha os dados guardados: quem souber mexer no navegador ainda consegue lê-los. Se esquecer a senha, será preciso limpar os dados do site e restaurar um backup.</p>
          </div>`)}</div>
        <div class="c6">${card("", "Cotações automáticas", "dólar via AwesomeAPI (sem chave) · ações via brapi.dev", "", `
          <div class="body pad">
            <label class="chk-linha"><input type="checkbox" id="cfgCotacoesAuto" ${configCotacoes().auto ? "checked" : ""}> Buscar cotações automaticamente ao abrir o sistema e a cada 5 minutos</label>
            <div class="campo"><label for="cfgBrapiToken">Token da brapi.dev</label><input id="cfgBrapiToken" value="${esc(configCotacoes().token)}" placeholder="cole aqui outro token, se quiser">
              <div class="ajuda">Já vem com um token configurado — não precisa mexer. Se um dia quiser usar outro, basta colar aqui. Se a internet cair, o sistema mantém os últimos preços e continua funcionando.</div></div>
            <button class="btn primario" data-acao="salvar-cotacoes">Salvar e buscar agora</button>
            ${dolar ? `<span class="dim" style="margin-left:12px;font-size:12px">Dólar agora: <b class="acc-laranja">R$ ${dolar.valor.toFixed(2).replace(".", ",")}</b></span>` : ""}
          </div>`)}</div>
        <div class="c6"><div class="card" style="border-color:rgba(255,84,104,.3)">
          <header><div><h2 class="down">Zona de risco</h2><div class="sub">esta ação não pode ser desfeita</div></div></header>
          <div class="body pad">
            <button class="btn perigo" data-acao="apagar-tudo">Apagar todos os dados</button>
            <p class="campo ajuda" style="margin-top:12px">Não há como desfazer: os dados não vão para nenhuma lixeira. Exporte um backup antes, em "Backup dos dados", se houver algo que você queira guardar. A senha de acesso e o token de cotações não são apagados aqui.</p>
          </div>
        </div></div>
      </div>
    `;
  }

  // =========================================================================
  // GRÁFICOS — montados depois que o HTML da rota já está no DOM
  // =========================================================================
  function montarGraficosRelatorio(d) {
    garantirRanges();
    const historicoP = d.historicoPatrimonio.filter((h) => h.data >= rangeB.ini && h.data <= rangeB.fim);
    if (historicoP.length >= 2) G.renderEvolucaoPatrimonio("graf-rel-evolucao", historicoP);
    G.renderReceitasDespesas("graf-rel-mensal", serieMensalPeriodo(d, rangeA.ini, rangeA.fim));
  }



  function montarGraficosDaRota() {
    const d = DADOS;
    switch (ROTA.secao) {
      case "dashboard": {
        let hist = d.historicoPatrimonio;
        if (mesesEvo > 0) {
          const corte = new Date(); corte.setMonth(corte.getMonth() - mesesEvo);
          const limite = corte.toISOString().slice(0, 10);
          const filtrado = hist.filter((h) => h.data >= limite);
          if (filtrado.length >= 2) hist = filtrado;
        }
        if (hist.length >= 2) G.renderEvolucaoPatrimonio("graf-evolucao", hist);
        else G.destruir("graf-evolucao");
        G.renderReceitasDespesas("graf-receitas-despesas", F.serieMensal(d, mesesRD));
        if (itensPatrimonio(d).length) G.renderDoughnutGenerico("graf-dash-composicao", itensPatrimonio(d), { semLegenda: true, aoClicar: (item) => explicarClasse(item.rotulo) });
        break;
      }
      case "financas": {
        if (itensPatrimonio(d).length) G.renderDoughnutGenerico("graf-patrimonio-divisao", itensPatrimonio(d), { semLegenda: true, aoClicar: (item) => explicarClasse(item.rotulo) });
        const serie = F.serieMensal(d, 12);
        G.renderLinhaMultipla("graf-fin-linhas", serie.map((x) => x.rotulo), [
          { rotulo: "Renda", valores: serie.map((x) => x.entradas), cor: G.CORES.up },
          { rotulo: "Despesas", valores: serie.map((x) => x.despesas), cor: G.CORES.down },
          { rotulo: "Poupança", valores: serie.map((x) => x.entradas - x.despesas), cor: G.CORES.azul }
        ]);
        break;
      }
      case "bancos":
        if (d.bancos.length) G.renderSaldoBancos("graf-saldo-bancos", F.listaBancosComSaldo(d));
        break;
      case "despesas": break;
      case "investimentos": break;
      case "detalhe-investimento": {
        const inv = achar(d.investimentos, ROTA.param);
        const h = inv && inv.historicoValores ? inv.historicoValores : [];
        if (h.length >= 2) G.renderEvolucaoValor("graf-valor-investimento", filtrarPeriodo(h, periodoGrafico), Number(inv.valorInvestido || 0), "Valor aplicado");
        break;
      }
      case "detalhe-acao": {
        const a = achar(d.acoes, ROTA.param);
        if (a && a.historicoPrecos.length) G.renderPrecoAcao("graf-preco-acao", filtrarPeriodo(a.historicoPrecos, periodoGrafico), a.precoMedio);
        break;
      }
      case "carteira": {
        const comp = I.composicaoCarteira(d);
        if (comp.length) G.renderDoughnutGenerico("graf-carteira-acoes", comp, { semLegenda: true });
        break;
      }
      case "relatorios":
        montarGraficosRelatorio(d);
        break;
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

        case "nova-banco": abrirModalBanco(null); break;
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
        case "alternar-pago": {
          const c = achar(DADOS.contasPagar, id);
          if (c) { c.status = c.status === "Pago" ? "Pendente" : "Pago"; salvarEAtualizar(c.status === "Pago" ? "Marcada como paga." : "Marcada como pendente."); }
          break;
        }

        case "novo-investimento": abrirModalInvestimento(null); break;
        case "editar-investimento": abrirModalInvestimento(id); break;

        case "novo-ativo": abrirModalAcao(null); break;
        case "editar-acao": abrirModalAcao(id); break;
        case "explicar-kpi": explicarKPI(b.dataset.kpi); break;
        case "explicar-banco": explicarBanco(id); break;
        case "explicar-classe": explicarClasse(b.dataset.rotulo); break;
        case "explicar-meta": explicarMeta(id); break;
        case "explicar-strip": explicarStrip(b.dataset.chave); break;
        case "periodo-rd": mesesRD = Number(b.dataset.meses); renderRota(); break;
        case "periodo-evo": mesesEvo = Number(b.dataset.meses); renderRota(); break;
        case "periodo-grafico": periodoGrafico = b.dataset.periodo; renderRota(); break;
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
        case "sincronizar-agora": toast("Sincronizando…"); sincronizar(false); break;
        case "desligar-sync": desligarSync(); break;
        case "abrir-pasta-banco": A.abrirPastaBanco(); break;
        case "exportar-backup": A.exportarDados(); toast("Backup exportado — verifique seus downloads."); break;
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
      if (id === "filtroPeriodo") { filtrosHistorico.periodo = e.target.value; renderRota(); }
      else if (id === "filtroTipo") { filtrosHistorico.tipo = e.target.value; renderRota(); }
      else if (id === "filtroBanco") { filtrosHistorico.banco = e.target.value; renderRota(); }
      else if (id === "filtroCategoria") { filtrosHistorico.categoria = e.target.value; renderRota(); }
      else if (id === "rangeA_ini") { rangeA.ini = e.target.value; renderRota(); }
      else if (id === "rangeA_fim") { rangeA.fim = e.target.value; renderRota(); }
      else if (id === "rangeB_ini") { rangeB.ini = e.target.value; renderRota(); }
      else if (id === "rangeB_fim") { rangeB.fim = e.target.value; renderRota(); }
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
      <h3>Adicionar valor — ${esc(m.nome)}</h3>
      <div class="campo"><label for="f_valor">Quanto você quer adicionar?</label>${campoMoeda("f_valor", "")}</div>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvar">Adicionar</button></div>`);
    document.getElementById("btnSalvar").onclick = () => {
      const v = numIn(document.getElementById("f_valor").value);
      if (v <= 0) { toast("Informe um valor maior que zero."); return; }
      m.atual = Number(m.atual || 0) + v;
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
