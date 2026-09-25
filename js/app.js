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
  const VERSAO_APP = "1.7.1";
  const CATS_ENTRADA = ["Salário", "Freelance", "Venda", "Dividendos", "Juros", "Cashback", "Outros"];
  const CATS_DESPESA = ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Compras", "Assinaturas", "Impostos", "Investimentos", "Outros"];
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
    if (lista.indexOf(ano) === -1) lista.unshift(ano);
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
  const GRID_LANCAMENTOS = "grid-template-columns:96px minmax(0,1fr) minmax(118px, 138px) 104px 150px";

  let mesesBancos = 0;
  let anoBancos = null;   // período do gráfico da guia Bancos (0 = saldo atual)
  let mesesRelA = 12;   // período do quadro Receitas x despesas
  let mesesRelB = 0;    // período do quadro Evolução patrimonial (0 = tudo)
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
    const linha = (rot, val) => `<div class="kv"><span class="dim">${rot}</span><b>${val}</b></div>`;
    abrirModal(`
      <h3>Importar PDF — ${esc(r.banco)} · ${fmtData(dataRef)}</h3>
      <div class="explica-lista">
        ${r.investimentos.map((i) => linha(esc(i.nome), brl(i.valorAtual))).join("")}
        ${r.acoes.map((a) => linha(`${esc(a.ticker)} · ${a.quantidade} un.`, brl(a.valorAtual))).join("")}
        ${linha("Total do extrato", brl(total))}
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
    I.registrarPontoPatrimonio(DADOS);
    A.salvarDados(DADOS, true, true);   // automático: não conta como alteração sua
    A.aoMudar(() => { DADOS = A.carregarDados(); renderRota(); });

    ligarTopbar();
    ligarSidebar();
    ligarModalGlobal();
    ligarCliqueNotificacoes();
    // a faixa de cotações e a pílula do dólar ficam fora da área principal,
    // então precisam do seu próprio tratador de clique
    document.addEventListener("click", (e) => {
      const alvo = e.target.closest('[data-acao="ir-dolar"]');
      if (alvo) { e.preventDefault(); navegarPara("detalhe-dolar"); }
    });
    ligarDelegacaoConteudo();
    ligarPuxarParaAtualizar();
    ligarMascaraMoeda(document.getElementById("conteudo"));
    iniciarRelogio();
    ajustarBarraGuias();
    window.addEventListener("resize", ajustarBarraGuias);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", ajustarBarraGuias);
    window.addEventListener("orientationchange", () => setTimeout(ajustarBarraGuias, 300));

    navegarPara("dashboard");
    atualizarCotacoesAutomaticas(true);
    setInterval(() => atualizarCotacoesAutomaticas(true), 5 * 60 * 1000);
    sincronizar(true);                                   // ao abrir/atualizar a página
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
  }

  function navegarPara(secao, param) {
    ROTA = { secao, param: param || null };
    // ao entrar na guia, o filtro volta sempre para o mês e o ano atuais
    if (secao === "entradas") { mesEntradas = F.mesAtual(); ordemEntradas = { ...ORDEM_ENTRADAS_PADRAO }; }
    if (secao === "despesas") { mesDespesas = F.mesAtual(); ordemDespesas = { ...ORDEM_DESPESAS_PADRAO }; }
    // ao entrar em Ações ou Investimentos (e nas telas de detalhe delas),
    // o período dos gráficos volta ao padrão, em vez de guardar a escolha
    // (em Ações, sempre abre nos últimos 7 dias)
    if (secao === "acoes") periodoGrafico = "7d";
    if (secao === "investimentos") periodoGrafico = "tudo";
    // a guia Bancos sempre abre mostrando o saldo atual ("Tudo")
    if (secao === "bancos") { mesesBancos = 0; anoBancos = String(new Date().getFullYear()); }
    // Dashboard e Relatórios abrem sempre no ano atual: receitas x despesas
    // em 12 meses e evolução patrimonial em "Tudo"
    if (secao === "dashboard") {
      anoRD = String(new Date().getFullYear()); mesesRD = 12;
      anoEvo = String(new Date().getFullYear()); mesesEvo = 0;
    }
    if (secao === "relatorios") {
      anoRelA = String(new Date().getFullYear()); mesesRelA = 12;
      anoRelB = String(new Date().getFullYear()); mesesRelB = 0;
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
    "detalhe-investimento": ["Detalhe da aplicação", "Histórico, imposto e rentabilidade"],
    "detalhe-dolar": ["Dólar comercial", "USD/BRL — cotação e histórico"],
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
      acoes: renderAcoes, "detalhe-acao": renderDetalheAcao, "detalhe-investimento": renderDetalheInvestimento, "detalhe-dolar": renderDetalheDolar, carteira: renderCarteira,
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
        alternarStatusLancamento(st.dataset.acaoStatus, st.dataset.id, st.dataset.mes);
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
      const ln = e.target.closest("[data-acao-editar]");
      if (ln) {
        e.stopPropagation();
        abrirEdicaoLancamento(ln.dataset.acaoEditar, ln.dataset.id, ln.dataset.data);
      }
    });
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

    const vencendo = contasPendentesMes(d, F.mesAtual()).filter((c) => c.statusReal === "Pendente");
    if (vencendo.length) {
      alertas.push({ tipo: "aviso", rota: "despesas", texto: `${vencendo.length === 1 ? "Existe 1 conta pendente" : `Existem ${vencendo.length} contas pendentes`} no mês atual.` });
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
      return `<span class="marca-logo" style="height:${t}px"><img src="assets/icons/bancos/${m.arquivo}?v=1.7.1" alt="" loading="lazy"></span>`;
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
    const soma = itens.reduce((t, i) => t + Math.abs(i.valor), 0) || 1;
    return `<div class="barlist">` + itens.map((i) => {
      const p = Math.max(0, (i.valor / soma) * 100);   // quanto este item representa do total
      const clic = i.id ? ` data-acao="explicar-banco" data-id="${i.id}" title="Ver detalhes deste banco"` : "";
      return `<${i.id ? "button" : "div"} class="barlist-linha${i.id ? " clicavel" : ""}"${clic}>
        <span class="barlist-nome">${i.id ? marcaBanco(i.nome, 18) : ""}${esc(i.nome)}</span>
        <span class="barlist-trilho"><i style="width:${p.toFixed(1)}%;background:${i.cor || cor || "var(--azul)"}"></i><b class="barlist-pct">${p.toFixed(1).replace(".", ",")}%</b></span>
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
      const vencida = m.prazo && F.diasEntre(m.prazo) < 0 && Number(m.atual || 0) < Number(m.objetivo || 0);
      return `<button class="mix-item clicavel${vencida ? " meta-vencida" : ""}" data-acao="explicar-meta" data-id="${m.id}" title="Ver detalhes da meta">
        <div class="mix-topo"><span>${esc(m.nome)}</span><b style="color:${m.cor || "var(--laranja)"}">${p.toFixed(0)}% (${brl(m.atual)})</b></div>
        <div class="progresso fina"><i style="width:${p}%;background:${m.cor || "var(--laranja)"}"></i></div>
      </button>`;
    }).join("") + `</div>`;
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
    if (!lista.length && !dolar) { tape.style.display = "none"; return; }
    const itemDolar = dolar ? `<span class="ticker-item clicavel" data-acao="ir-dolar" title="Ver histórico do dólar"><b>USD/BRL</b><span class="tp">${dolar.valor.toFixed(2).replace(".", ",")}</span><span class="tv ${dolar.variacaoPct >= 0 ? "up" : "down"}">${Math.abs(dolar.variacaoPct || 0).toFixed(2).replace(".", ",")}%</span></span>` : "";
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
    el.style.cursor = "pointer";
    el.setAttribute("data-acao", "ir-dolar");
    el.setAttribute("title", "Ver histórico do dólar");
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
  let painelKpiAberto = null;
  let painelReabrir = null;
  function explicarKPI(chave) {
    painelKpiAberto = chave;
    painelReabrir = () => explicarKPI(chave);
    const d = DADOS;
    const p = I.patrimonio(d);
    const mes = F.mesAtual(), mesAnt = F.mesAnterior();
    const entradas = totalEntradasTodasMes(d, mes), entradasAnt = totalEntradasTodasMes(d, mesAnt);
    const despesas = totalDespesasTodasMes(d, mes), despesasAnt = totalDespesasTodasMes(d, mesAnt);
    const linha = (rot, val, cls) => `<div class="kv"><span class="dim">${rotuloPainel(rot)}</span><b class="${cls || ""}">${val}</b></div>`;

    const paineis = {
      patrimonio: {
        titulo: "Patrimônio total",
        conta: "bancos + investimentos + ações − dívidas",
        pct: p.bruto > 0 ? (p.liquido / p.bruto) * 100 : 0,
        pctRotulo: "do patrimônio bruto está livre de dívidas",
        // o total soma exatamente as linhas mostradas aqui (investimentos já
        // líquidos de IR), para nunca destoar da própria conta do painel
        linhas: (() => {
          const investLiq = I.totalLiquidoOutros(d);
          const totalLiquido = p.bancos + investLiq + p.acoes - p.dividas;
          return linha("+ Bancos", brl(p.bancos)) + linha("+ Investimentos", brl(investLiq)) +
            linha("+ Ações e FIIs", brl(p.acoes)) + linha("− Dívidas", brl(p.dividas), "down") +
            linha("Total Líquido", brl(totalLiquido), corSinal(totalLiquido));
        })(),
        secao: "bancos"
      },
      bancos: {
        titulo: "Saldo bancário",
        conta: "saldo = saldo inicial + entradas − despesas",
        pct: p.bruto > 0 ? (p.bancos / p.bruto) * 100 : 0,
        pctRotulo: "do patrimônio bruto está em conta",
        linhas: bancosNaOrdem(F.listaBancosComSaldo(d)).map((b) => linha(esc(b.nome), brl(b.saldoAtual))).join("") +
          linha("Total", brl(p.bancos), "up"),
        secao: "bancos"
      },
      investido: {
        titulo: "Investimentos",
        conta: "(investimentos + ações) ÷ patrimônio bruto",
        pct: I.percentualInvestido(d),
        pctRotulo: "do patrimônio bruto está investido",
        linhas: (() => {
          const investLiq = I.totalLiquidoOutros(d);
          return linha("Rentabilidade carteira", pct(I.rentabilidadeCarteiraAcoes(d)), corSinal(I.rentabilidadeCarteiraAcoes(d))) +
            linha("Renda fixa, Tesouro e Fundos", `<span class="valor-guia up">+${brl(investLiq)}</span>`) +
            linha("Ações, FIIs e ETFs", `<span class="valor-guia up">+${brl(p.acoes)}</span>`) +
            linha("Total", "+" + brl(investLiq + p.acoes));
        })(),
        secao: "investimentos"
      },
      receitas: {
        titulo: "Receitas do mês",
        conta: "soma das entradas lançadas no mês atual",
        pct: F.variacaoPercentual(entradas, entradasAnt),
        pctRotulo: "de variação em relação ao mês anterior",
        linhas: (() => {
          const itensR = listaEntradasTodasMes(d, mes);
          return linha("Lançamentos", plural(itensR.length, "entrada")) +
            itensR.map((e) => linhaEditavel(e, linha(fmtDataCurta(e.data) + " · " + esc(e.descricao), bancoPainel(e.banco, e) + seloStatusPainel(e.status, e) + `<span class="col-valor valor-guia up">+${brl(e.valor)}</span>`))).join("") +
            linha("Total", `<span class="col-valor">+${brl(entradas)}</span>`);
        })(),
        secao: "entradas"
      },
      despesas: {
        titulo: "Despesas do mês",
        conta: "soma das despesas lançadas no mês atual",
        pct: entradas > 0 ? (despesas / entradas) * 100 : 0,
        pctRotulo: "das receitas do mês já foram gastas",
        linhas: (() => {
          const itensD = listaDespesasTodasMes(d, mes);
          return linha("Lançamentos", plural(itensD.length, "despesa")) +
            itensD.map((x) => linhaEditavel(x, linha(fmtDataCurta(x.data) + " · " + esc(x.descricao), bancoPainel(x.banco, x) + seloStatusPainel(x.status, x) + `<span class="col-valor valor-guia down">−${brl(x.valor)}</span>`))).join("") +
            linha("Total", `<span class="col-valor">−${brl(despesas)}</span>`);
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
    let palavras = 0;
    return String(texto).split(" ").map((p) => {
      if (!/^[\p{L}]/u.test(p)) return p;            // símbolos (+, −, parênteses) não contam
      if (/^[\p{L}]$/u.test(p)) return p;            // conectivos de uma letra ("e") ficam em minúsculo
      palavras++;
      return palavras === 2 ? p.charAt(0).toUpperCase() + p.slice(1) : p;
    }).join(" ");
  }



  function painelSimples(titulo, pctValor, pctRotulo, comoCalcula, linhasHtml, secao, botao) {
    abrirModal(`
      <h3>${titulo}</h3>
      <div class="explica-pct"><b>${Math.abs(pctValor).toFixed(1).replace(".", ",")}%</b><span>${pctRotulo}</span></div>
      ${comoCalcula ? `<p class="campo ajuda" style="margin:0 0 12px">Como é calculado: <b>${comoCalcula}</b></p>` : ""}
      <div class="explica-lista">${linhasHtml}</div>
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
  }

  function explicarBanco(id) {
    const d = DADOS;
    const lista = bancosDoPeriodo(d);
    const b = lista.find((x) => x.id === id);
    if (!b) return;
    const totalPeriodo = lista.reduce((t, x) => t + Number(x.valor || 0), 0);
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    const periodo = mesesBancos ? `nos últimos ${mesesBancos} meses` : "";

    if (mesesBancos) {
      painelSimples(esc(b.nome), totalPeriodo !== 0 ? (b.valor / totalPeriodo) * 100 : 0,
        `da movimentação de todas as contas ${periodo}`, "entradas − despesas do período",
        linha("Tipo conta", esc(b.tipo || "—")) +
        linha(`Entradas ${periodo}`, `<span class="valor-guia up">+${brl(b.entradas)}</span>`) +
        linha(`Despesas ${periodo}`, `<span class="valor-guia down">−${brl(b.saidas)}</span>`) +
        linha("Movimentação líquida", brlSinal(b.valor)) +
        linha("Saldo atual da conta", brlSinal(b.saldoAtual)), "bancos",
        { rotulo: "+ Adicionar", acao: () => abrirModalValorBanco(b.id) });
      return;
    }

    painelSimples(esc(b.nome), totalPeriodo > 0 ? (b.saldoAtual / totalPeriodo) * 100 : 0, "do seu dinheiro em bancos está aqui",
      "saldo inicial + entradas − despesas",
      linha("Tipo conta", esc(b.tipo || "—")) +
      linha("+ Entradas", `<span class="valor-guia up">+${brl(b.entradas)}</span>`) +
      linha("− Despesas", `<span class="valor-guia down">−${brl(b.saidas)}</span>`) +
      linha("Saldo atual", brlSinal(b.saldoAtual)), "bancos",
      { rotulo: "+ Adicionar", acao: () => abrirModalValorBanco(b.id) });
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
      detalhe = bancosNaOrdem(F.listaBancosComSaldo(d)).map((b) => linha(esc(b.nome), brl(b.saldoAtual))).join("");
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
      detalhe + linha("Total grupo", brl(item.valor), "up") + linha("Patrimônio bruto", brl(total)), secao);
  }

  function explicarMeta(id) {
    const m = achar(DADOS.metas, id);
    if (!m) return;
    const progresso = m.objetivo > 0 ? (m.atual / m.objetivo) * 100 : 0;
    const falta = Math.max(0, Number(m.objetivo || 0) - Number(m.atual || 0));
    // cada linha abre a edição da meta
    const linha = (r, v, c) => `<div class="kv kv-editavel" data-acao-editar="editar-meta" data-id="${esc(m.id)}" title="Abrir para editar"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    painelSimples(esc(m.nome), progresso, "do objetivo já foi guardado", "valor atual ÷ objetivo",
      linha("Objetivo", brl(m.objetivo)) + linha("Guardado", brl(m.atual), "up") +
      linha("Faltam", brl(falta), falta > 0 ? "down" : "up") +
      linha("Prazo", m.prazo ? fmtData(m.prazo) : "sem prazo"),
      "metas", { rotulo: "+ Adicionar", acao: () => abrirModalDeposito(m.id) });
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
      painelSimples("Taxa Poupança", taxa, "das receitas do mês sobraram", "(receitas − despesas) ÷ receitas",
        linha("Referência saudável", "20% ou mais") +
        linha("+ Entradas", brl(entradas), "up") + linha("− Despesas", brl(despesas), "down") +
        linha("Saldo atual", brlSinal(sobra), corSinal(sobra)), "entradas");
      return;
    }
    if (chave === "projecao") {
      const mediaDia = dia > 0 ? despesas / dia : 0;
      const projecao = mediaDia * diasNoMes;
      let soma = 0, meses = 0;
      for (let i = 1; i <= 3; i++) {
        const dt = new Date(); dt.setMonth(dt.getMonth() - i);
        const t = totalDespesasPagasMes(d, dt.toISOString().slice(0, 7));
        if (t > 0) { soma += t; meses++; }
      }
      const media3 = meses ? soma / meses : 0;
      const dif = media3 > 0 ? ((projecao - media3) / media3) * 100 : 0;
      painelSimples("Projeção de despesas", dif, "acima (ou abaixo) da sua média dos últimos meses",
        "(gasto até hoje ÷ dias corridos) × dias do mês",
        linha("− Despesas", brl(despesas), "down") + linha("Dias corridos", `${dia} de ${diasNoMes}`) +
        linha("Média diária", brl(mediaDia)) + linha("Projeção mês", brl(projecao), "down") +
        linha("Média trimestral", media3 > 0 ? brl(media3) : "sem histórico"), "despesas");
      return;
    }
    if (chave === "maiorgasto") {
      const maior = F.maiorDespesa(d, mes);
      if (!maior) { toast("Nenhuma despesa lançada neste mês."); return; }
      painelSimples("Maior gasto do mês", despesas > 0 ? (Number(maior.valor) / despesas) * 100 : 0,
        "do total gasto no mês veio deste lançamento", "maior valor entre as despesas do mês",
        linha("Descrição", esc(maior.descricao)) + linha("Valor", brl(maior.valor), "down") +
        linha("Categoria", esc(maior.categoria || "—")) + linha("Data", fmtData(maior.data)) +
        linha("Total", brl(despesas)), "despesas");
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
      // mesmo formato do painel "Despesas do mês", só com o que ainda não foi pago
      painelReabrir = () => explicarStrip("avencer");
      const itens = pendentesDoMes(d, F.mesAtual());
      const total = itens.reduce((sm, x) => sm + Number(x.valor || 0), 0);
      const saldo = F.totalBancos(d);
      painelSimples("Contas Pendentes", saldo > 0 ? (total / saldo) * 100 : 0,
        "do seu saldo em bancos está comprometido", "soma de contas pendentes no mês atual",
        linha("Lançamentos", plural(itens.length, "despesa")) +
        (itens.length
          ? itens.map((x) => linhaEditavel(x, linha(fmtDataCurta(x.data) + " · " + esc(x.descricao),
              bancoPainel(x.banco, x) + seloStatusPainel(x.status, x) + `<span class="col-valor valor-guia down">−${brl(x.valor)}</span>`))).join("")
          : `<div class="kv"><span class="dim">Nenhuma conta pendente no mês atual</span><b>—</b></div>`) +
        linha("Total", `<span class="col-valor">−${brl(total)}</span>`), "despesas");
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


  function explicarRelatorio(chave) {
    const d = DADOS;
    const fxA = intervaloRel(mesesRelA, anoRelA);
    const entradas = d.entradas.filter((e) => e.data >= fxA.ini && e.data <= fxA.fim);
    const despesas = d.despesas.filter((x) => x.data >= fxA.ini && x.data <= fxA.fim);
    const totE = entradas.reduce((s, e) => s + Number(e.valor || 0), 0);
    const totD = despesas.reduce((s, x) => s + Number(x.valor || 0), 0);
    const meses = mesesRelA || Math.max(1, new Set(entradas.concat(despesas).map((m) => String(m.data).slice(0, 7))).size);
    const periodo = mesesRelA ? `últimos ${mesesRelA} meses` : "todo histórico";
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    const porCategoria = (lista) => {
      const mapa = {};
      lista.forEach((m) => { const k = m.categoria || "Outros"; mapa[k] = (mapa[k] || 0) + Number(m.valor || 0); });
      return Object.keys(mapa).sort((a, b) => mapa[b] - mapa[a])
        .map((k) => linha("· " + esc(k), brl(mapa[k]))).join("");
    };

    if (chave === "rel-receitas") {
      painelSimples("Receitas", totE > 0 ? 100 : 0, `do que entrou no período (${periodo})`, "soma das entradas no período",
        porCategoria(entradas) + linha("Média mensal", brl(totE / meses)) +
        linha("Lançamentos", plural(entradas.length, "entrada")) + linha("Total", brl(totE), "up"), "entradas");
      return;
    }
    if (chave === "rel-despesas") {
      painelSimples("Despesas", totE > 0 ? (totD / totE) * 100 : 0, "das receitas do período foram gastas", "soma das despesas ÷ receitas",
        porCategoria(despesas) + linha("Média mensal", brl(totD / meses)) +
        linha("Lançamentos", plural(despesas.length, "despesa")) + linha("Total", brl(totD), "down"), "despesas");
      return;
    }
    if (chave === "rel-resultado") {
      const saldo = totE - totD;
      painelSimples("Resultado", totE > 0 ? (saldo / totE) * 100 : 0, "das receitas sobraram no período", "receitas − despesas",
        linha("Período", periodo) +
        linha("+ Receitas", brl(totE), "up") + linha("− Despesas", brl(totD), "down") +
        linha("Média mensal", brlSinal(saldo / meses), corSinal(saldo)) +
        linha("Resultado", brlSinal(saldo), corSinal(saldo)), "entradas");
      return;
    }
    if (chave === "rel-rentabilidade") {
      const rent = I.rentabilidadeCarteiraAcoes(d);
      painelSimples("Rentabilidade da carteira", rent, "acumulada em relação ao preço médio", "(valor atual ÷ valor investido − 1) × 100",
        linha("Valor investido", brl(I.totalInvestidoAcoes(d))) +
        linha("Valor atual", brl(I.totalCarteiraAcoes(d)), "creme") +
        linha("Dividendos recebidos", brl(I.totalDividendosAcoes(d)), "up") +
        linha("Ativos carteira", plural(d.acoes.length, "ativo")) +
        linha("Resultado", brlSinal(I.resultadoCarteiraAcoes(d)), corSinal(I.resultadoCarteiraAcoes(d))), "acoes");
    }
  }


  function explicarMes(ponto) {
    if (!ponto || !ponto.mes) return;
    const d = DADOS;
    const mes = ponto.mes;
    painelReabrir = () => explicarMes(ponto);   // redesenha depois de trocar status/banco
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    // mesmo formato dos painéis "Receitas do mês" e "Despesas do mês":
    // todos os lançamentos do mês, com banco, status e valor, e o saldo no fim
    const itensR = listaEntradasTodasMes(d, mes).map((e) => ({ ...e, sinal: "+", cor: "up" }));
    const itensD = listaDespesasTodasMes(d, mes).map((x) => ({ ...x, sinal: "−", cor: "down" }));
    const todos = [...itensR, ...itensD].sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    const totE = totalEntradasTodasMes(d, mes), totD = totalDespesasTodasMes(d, mes);
    const saldo = totE - totD;
    const nomeMes = new Date(mes + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    painelSimples(nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1),
      totE > 0 ? (saldo / totE) * 100 : 0, "das receitas sobraram neste mês", "receitas − despesas do mês",
      linha("Lançamentos", `${plural(itensR.length, "entrada")} · ${plural(itensD.length, "despesa")}`) +
      todos.map((it) => linhaEditavel(it, linha(fmtDataCurta(it.data) + " · " + esc(it.descricao),
        bancoPainel(it.banco, it) + seloStatusPainel(it.status, it) + `<span class="col-valor valor-guia ${it.cor}">${it.sinal}${brl(it.valor)}</span>`))).join("") +
      linha("Saldo", `<span class="col-valor">${brlSinal(saldo)}</span>`),
      "despesas");
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
    const varMes = anterior ? ponto.valor - anterior.valor : 0;
    const varPeriodo = ponto.valor - primeiro.valor;
    const pctPeriodo = primeiro.valor > 0 ? (varPeriodo / primeiro.valor) * 100 : 0;
    const p = I.patrimonio(d);
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    const quando = new Date(ponto.data + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const ehPico = idx === iPico;

    painelSimples(quando.charAt(0).toUpperCase() + quando.slice(1), pctPeriodo,
      "de variação desde o início do período", "valor do mês ÷ valor do primeiro mês",
      linha("Patrimônio", brl(ponto.valor), "creme") +
      (ehPico ? linha("Situação", "maior valor do período · " + brl(ponto.valor), "up") : "") +
      (anterior ? linha("Mês anterior", brl(anterior.valor)) : "") +
      (anterior ? linha("Variação", brlSinal(varMes), corSinal(varMes)) : "") +
      linha("Início", brl(primeiro.valor)) +
      linha("Variação", brlSinal(varPeriodo), corSinal(varPeriodo)) +
      linha("Bancos", brl(p.bancos)) +
      linha("Investimentos", brl(p.investimentos + p.acoes)) +
      linha("Dívidas", brl(p.dividas), p.dividas > 0 ? "down" : ""),
      "bancos");
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  function renderDashboard(d) {
    const p = I.patrimonio(d);
    const mesAtual = F.mesAtual(), mesAnt = F.mesAnterior();
    const entradasMes = totalEntradasTodasMes(d, mesAtual), entradasAnt = totalEntradasTodasMes(d, mesAnt);
    const despesasMes = totalDespesasTodasMes(d, mesAtual), despesasAnt = totalDespesasTodasMes(d, mesAnt);
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

    const bancos = bancosNaOrdem(F.listaBancosComSaldo(d)).map((b) => ({ id: b.id, nome: b.nome, valor: b.saldoAtual, cor: b.cor }));
    const composicao = itensPatrimonio(d);
    const totalComp = composicao.reduce((s, i) => s + i.valor, 0);
    const legendaComp = composicao.length ? composicao.map((i) => `<button class="legenda-linha clicavel" data-acao="explicar-classe" data-rotulo="${esc(i.rotulo)}" title="Ver detalhes"><span class="legenda-nome"><span class="legenda-ponto" style="background:${i.cor}"></span>${esc(i.rotulo)}</span><span class="legenda-pct" style="color:${i.cor}">${(totalComp > 0 ? (i.valor / totalComp) * 100 : 0).toFixed(1).replace(".", ",")}%</span><span class="legenda-val">${brl(i.valor)}</span></button>`).join("") : `<div class="empty">Sem ativos ainda.</div>`;

    if (!anoRD) anoRD = String(new Date().getFullYear());
    if (!anoEvo) anoEvo = String(new Date().getFullYear());

    // o pico é o maior valor dentro do período escolhido no quadro E
    const histPeriodo = historicoEvo(d);
    const pico = histPeriodo.length ? Math.max(...histPeriodo.map((h) => h.valor)) : 0;

    const acoes = I.listaAcoesComCalculo(d);
    const melhor = acoes.length ? acoes.reduce((a, b) => (a.rentabilidade >= b.rentabilidade ? a : b)) : null;
    const maiorDesp = F.maiorDespesa(d);
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
        ${kpiCard("Patrimônio líquido", brl(p.bancos + I.totalLiquidoOutros(d) + p.acoes - p.dividas), pctLivre, "var(--laranja)", delta(F.variacaoPercentual(p.liquido, patrimonioAnt), "vs mês anterior"), `Dívidas: ${brl(p.dividas)}`, "patrimonio")}
        ${kpiCard("Saldo bancário", brl(p.bancos), pctBancos, "var(--azul)", delta(pctBancos, "do patrimônio"), `${bancos.length} ${bancos.length === 1 ? "Conta Cadastrada" : "Contas Cadastradas"}`, "bancos")}
        ${kpiCard("Investimentos Líquidos", brl(I.totalLiquidoOutros(d) + p.acoes), pctInvestido, "var(--vi)", delta(rentCarteira, "rent. carteira"), `${pctInvestido.toFixed(0)}% do patrimônio investido`, "investido")}
        ${kpiCard("Receitas mês", brl(entradasMes), entradasMes + despesasMes > 0 ? (entradasMes / (entradasMes + despesasMes)) * 100 : 0, "var(--up)", delta(F.variacaoPercentual(entradasMes, entradasAnt), "vs mês anterior"), `Mês anterior: ${brl(entradasAnt)}`, "receitas")}
        ${kpiCard("Despesas mês", brl(despesasMes), pctDespesas, "var(--down)", delta(F.variacaoPercentual(despesasMes, despesasAnt), "vs mês anterior", true), `${pctDespesas.toFixed(0)}% das receitas`, "despesas")}
      </div>

      <div class="grid">
        <div class="c3">${card("card-centrado", "Saldo banco", "mapa ativos", `<span class="acc-laranja" style="font-size:12px;font-weight:700">Total: ${brl(p.bancos)}</span>`, `<div class="body pad">${barList(bancos)}</div>`)}</div>
        <div class="c3">${card("card-centrado", "Composição patrimônio", "ativos brutos", `<span class="acc-laranja" style="font-size:12px;font-weight:700">Total: ${brl(p.bancos + I.totalLiquidoOutros(d) + p.acoes)}</span>`, `
          <div class="donut-wrap">
            <div class="donut-centro"><canvas id="graf-dash-composicao" width="150" height="150" style="width:150px;height:150px"></canvas>
              <button class="donut-rotulo clicavel" data-acao="explicar-kpi" data-kpi="investido" title="Ver como este percentual é calculado"><b>${pctInvestido.toFixed(1).replace(".", ",")}%</b><span class="acc-laranja">INVESTIDO</span></button>
            </div>
            <div class="legenda">${legendaComp}</div>
          </div>`)}</div>
        <div class="c3">${card("", "Receitas x despesas", `${mesesRD} ${mesesRD === 1 ? "mês" : "meses"} de ${anoRD}`,
          `<div class="filtro-mes">${seletorAnoDash("anoRD", anoRD, anosDashboard(d))}${abasMeses("periodo-rd", mesesRD, [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }])}</div>`, `<div style="padding:8px 14px 12px;height:236px"><canvas id="graf-receitas-despesas"></canvas></div>`)}</div>
        <div class="c3">${card("", "Metas", "progressos", `<button class="btn pequeno" data-acao="ir" data-secao="metas">ver todas →</button>`, metasMini(d))}</div>
      </div>

      <div class="grid">
        <div class="c12">${card("", "Evolução patrimonial", `patrimônio líquido · ${mesesEvo ? mesesEvo + " meses de " + anoEvo : "todo histórico"}`,
          (pico ? `<span class="pill-pico">PICO ${brl(pico)}</span>` : "") +
          `<div class="filtro-mes">${seletorAnoDash("anoEvo", anoEvo, anosDashboard(d))}${abasMeses("periodo-evo", mesesEvo, [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }, { meses: 0, rotulo: "Tudo" }])}</div>`, histPeriodo.length >= 2
            ? `<div style="padding:8px 14px 12px;height:236px"><canvas id="graf-evolucao"></canvas></div>`
            : `<div class="empty">Sem registros de patrimônio em ${mesesEvo ? `${mesesEvo} ${mesesEvo === 1 ? "mês" : "meses"} de ${anoEvo}` : "todo histórico"}. O patrimônio é registrado a cada dia que você abre o sistema.</div>`)}</div>
      </div>

      ${stripKpis([
        { rotulo: "TAXA POUPANÇA", valor: taxaPoupanca.toFixed(1).replace(".", ",") + "%", sub: `Resultado: ${brlSinal(resultadoMes)}`, cor: "#22E39A", icone: ICONES_STRIP.poupanca, chave: "poupanca" },
        { rotulo: "PROJEÇÃO DESPESAS", valor: brl(projecao), sub: `Ritmo Atual`, cor: "#FF7A1A", icone: ICONES_STRIP.projecao, chave: "projecao" },
        { rotulo: "MAIOR GASTO", valor: maiorDesp ? brl(maiorDesp.valor) : "—", sub: maiorDesp ? esc(maiorDesp.descricao) : "Sem Despesas", cor: "#FF4D7A", icone: ICONES_STRIP.maiorgasto, chave: "maiorgasto" },
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
        <div class="c6">${card("card-centrado", "Composição patrimônio", "ativos brutos", `<span class="acc-laranja" style="font-size:12px;font-weight:700">Total: ${brl(p.bancos + I.totalLiquidoOutros(d) + p.acoes)}</span>`, `<div class="donut-wrap"><div class="donut-centro"><canvas id="graf-patrimonio-divisao" width="150" height="150" style="width:150px;height:150px"></canvas><div class="donut-rotulo"><b>${brl(p.bruto).replace("R$", "").trim()}</b><span class="acc-laranja">BRUTO</span></div></div><div class="legenda">${legendaHtml}</div></div>`)}</div>
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
      const ent = d.entradas.filter((e) => e.bancoId === b.id && dentro(e.data))
        .reduce((t, e) => t + Number(e.valor || 0), 0);
      const sai = d.despesas.filter((x) => x.bancoId === b.id && !x.cartaoId && dentro(x.data))
        .reduce((t, x) => t + Number(x.valor || 0), 0);
      return Object.assign({}, b, { entradas: ent, saidas: sai, valor: mesesBancos ? ent - sai : b.saldoAtual });
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
          <div class="cartao-item" style="border-left-color:${esc(b.cor || "#3FC1E0")}" data-acao="editar-banco" data-id="${b.id}">
            <div class="linha1"><div class="nome-com-marca">${marcaBanco(b.nome, 26)}<div><div class="nome">${esc(b.nome)}</div><div class="tipo">${esc(b.tipo || "—")}</div>${b.agencia || b.conta ? `<div class="tipo">${b.agencia ? "Ag " + esc(b.agencia) : ""}${b.agencia && b.conta ? " · " : ""}${b.conta ? "Cc " + esc(b.conta) : ""}</div>` : ""}</div></div></div>
            <div class="saldo ${corSinal(b.valor)}">${brl(b.valor)}</div>
            <div class="rodape"><span>${mesesBancos ? `Saldo Atual ${brl(b.saldoAtual)}` : ""}</span>
              <button class="btn pequeno" data-acao="entrada-banco" data-id="${b.id}" title="Lançar uma entrada nesta conta">+ Adicionar</button>
            </div>
          </div>`).join("") + `</div>`;
    }
    return `
      ${faixaDemo(d)}
      <div class="grid g-top">
        <div class="c12">${card("c12", "Meus bancos", `${bancos.length} ${bancos.length === 1 ? "Conta Cadastrada" : "Contas Cadastradas"}`, `<button class="btn primario" data-acao="nova-banco"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`, listaHtml, `<span class="dim">Total</span><b class="${corSinal(total)}" style="font-size:14px;font-weight:800">${brl(total)}</b>`)}</div>
      </div>
      <div class="grid">
        <div class="c12">${card("", "Saldo banco", mesesBancos ? `Movimentação · ${mesesBancos} ${mesesBancos === 1 ? "mês" : "meses"} de ${anoBancos}` : "comparação entre contas",
          `<div class="filtro-mes">${seletorAnoDash("anoBancos", anoBancos, anosDashboard(d))}${abasMeses("periodo-bancos", mesesBancos, [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }, { meses: 0, rotulo: "Tudo" }])}</div>`,
          `<div style="padding:12px 18px 16px;height:${Math.max(190, bancos.length * 52)}px"><canvas id="graf-saldo-bancos"></canvas></div>`)}</div>
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
  function alternarStatusLancamento(acao, id, mes) {
    if (acao === "quitar-mes") {
      const reg = achar(DADOS.despesas, id);
      if (reg) { gravarAjuste(reg, mes, { pago: !mesQuitado(reg, mes) }); salvarEAtualizar(mesQuitado(reg, mes) ? "Marcada como paga neste mês." : "Marcada como prevista."); }
    } else if (acao === "quitar-mes-conta") {
      const regC = achar(DADOS.contasPagar, id);
      if (regC) { gravarAjuste(regC, mes, { pago: !mesQuitado(regC, mes) }); salvarEAtualizar(mesQuitado(regC, mes) ? "Marcada como paga neste mês." : "Marcada como prevista."); }
    } else if (acao === "quitar-mes-entrada") {
      const regE = achar(DADOS.entradas, id);
      if (regE) { gravarAjuste(regE, mes, { pago: !mesQuitado(regE, mes) }); salvarEAtualizar(mesQuitado(regE, mes) ? "Marcada como paga neste mês." : "Marcada como prevista."); }
    } else if (acao === "alternar-prevista-entrada") {
      const ent4 = achar(DADOS.entradas, id);
      if (ent4) { ent4.previsto = !ent4.previsto; salvarEAtualizar(ent4.previsto ? "Marcada como prevista." : "Marcada como paga."); }
    } else if (acao === "tornar-pendente") {
      const dsp = achar(DADOS.despesas, id);
      if (dsp) {
        DADOS.despesas = DADOS.despesas.filter((r) => r.id !== dsp.id);
        DADOS.contasPagar.push({
          id: dsp.id, descricao: dsp.descricao, categoria: dsp.categoria,
          vencimento: dsp.data, valor: dsp.valor, status: "Pendente", obs: dsp.obs || ""
        });
        salvarEAtualizar("Marcada como prevista.");
      }
    } else if (acao === "alternar-pago") {
      const c = achar(DADOS.contasPagar, id);
      if (c) { c.status = c.status === "Pago" ? "Pendente" : "Pago"; salvarEAtualizar(c.status === "Pago" ? "Marcada como paga." : "Marcada como prevista."); }
    }
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
  function linhaEditavel(item, html) {
    if (!item || !item.acaoEditar) return html;
    return html.replace('<div class="kv">', `<div class="kv kv-editavel" data-acao-editar="${item.acaoEditar}" data-id="${esc(item.id)}" data-data="${item.data || ""}" title="Abrir para editar">`);
  }

  function bancoPainel(nome, item) {
    const n = nome && nome !== "—" ? nome : "";
    const miolo = n ? marcaBanco(n, 16) + `<span class="dim">${esc(n)}</span>` : '<span class="dim">—</span>';
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

  function pendentesDoMes(d, mes) {
    return listaDespesasTodasMes(d, mes).filter((x) => x.status !== "Pago");
  }

  function listaDespesasTodasMes(d, mes) {
    const lancadas = d.despesas.filter((x) => String(x.data || "").slice(0, 7) === mes)
      .map((x) => ({ descricao: x.descricao, valor: Number(x.valor || 0), data: x.data, status: "Pago", acao: "tornar-pendente", id: x.id, banco: bancoDoLancamento(d, x), acaoBanco: "trocar-banco", acaoEditar: "editar-despesa" }));
    const contasDoMes = (d.contasPagar || []).filter((c) => String(c.vencimento || "").slice(0, 7) === mes);
    const contasMapeadas = contasDoMes.map((c) => {
      const st = F.statusReal(c);
      return { descricao: c.descricao, valor: Number(c.valor || 0), data: c.vencimento, status: st === "Pendente" ? "Prevista" : st, acao: "alternar-pago", id: c.id, banco: c.bancoId ? F.nomeBanco(d, c.bancoId) : "—", acaoBanco: "trocar-banco-conta", acaoEditar: "editar-conta" };
    });
    const contasComoLista = (d.contasPagar || []).map((c) => ({ ...c, data: c.vencimento }));
    const repDespesas = repeticoesPrevistas(d.despesas, mes, (reg, data) => ({
      descricao: reg.descricao, valor: valorDoMes(reg, data.slice(0, 7)), data,
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      acao: "quitar-mes", id: reg.id, mes: data.slice(0, 7), banco: bancoDoLancamento(d, reg), acaoBanco: "trocar-banco", acaoEditar: "editar-previsao"
    }), contasDoMes);
    const repContas = repeticoesPrevistas(contasComoLista, mes, (reg, data) => ({
      descricao: reg.descricao, valor: valorDoMes(reg, data.slice(0, 7)), data,
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      acao: "quitar-mes-conta", id: reg.id, mes: data.slice(0, 7), banco: reg.bancoId ? F.nomeBanco(d, reg.bancoId) : "—", acaoBanco: "trocar-banco-conta", acaoEditar: "editar-previsao-conta"
    }), []);
    return [...lancadas, ...contasMapeadas, ...repDespesas, ...repContas]
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  }

  // Lista, ordenada por data, de todas as entradas do mês (recebidas ou
  // previstas) — usada no painel "Receitas do mês".
  function listaEntradasTodasMes(d, mes) {
    const reais = d.entradas.filter((e) => String(e.data || "").slice(0, 7) === mes)
      .map((e) => ({ descricao: e.descricao, valor: Number(e.valor || 0), data: e.data, status: e.previsto ? "Prevista" : "Pago", acao: "alternar-prevista-entrada", id: e.id, banco: F.nomeBanco(d, e.bancoId), acaoBanco: "trocar-banco-entrada", acaoEditar: "editar-entrada" }));
    const recorrentes = repeticoesPrevistas(d.entradas, mes, (reg, data) => ({
      descricao: reg.descricao, valor: valorDoMes(reg, data.slice(0, 7)), data,
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      acao: "quitar-mes-entrada", id: reg.id, mes: data.slice(0, 7), banco: F.nomeBanco(d, reg.bancoId), acaoBanco: "trocar-banco-entrada", acaoEditar: "editar-previsao-entrada"
    }));
    return [...reais, ...recorrentes].sort((a, b) => (a.data || "").localeCompare(b.data || ""));
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

  function renderEntradas(d) {
    if (!mesEntradas) mesEntradas = F.mesAtual();
    const previstasEnt = repeticoesPrevistas(d.entradas, mesEntradas, (reg, data) => ({
      ...reg, data, valor: valorDoMes(reg, data.slice(0, 7)), prevista: true,
      recebidaNoMes: mesQuitado(reg, data.slice(0, 7)), mesRef: data.slice(0, 7)
    }));
    const lista = [...d.entradas.filter((e) => String(e.data || "").slice(0, 7) === mesEntradas), ...previstasEnt]
      .map((e) => ({ ...e, banco: F.nomeBanco(d, e.bancoId), status: e.prevista ? (e.recebidaNoMes ? "Pago" : "Prevista") : (e.previsto ? "Prevista" : "Pago") }))
      .sort((a, b) => {
        if (ordemEntradas.campo === "cronologica") return (a.data || "").localeCompare(b.data || "");
        return comparar(a, b, ordemEntradas.campo, ordemEntradas.dir);
      });
    const totalMes = totalEntradasEfetivas(d, mesEntradas);
    const totalPrevisto = previstasEnt.filter((e) => !e.recebidaNoMes).reduce((t, e) => t + Number(e.valor || 0), 0) + F.totalEntradasPrevistasMes(d, mesEntradas);
    const grid = GRID_LANCAMENTOS;
    let corpo;
    if (!lista.length) {
      corpo = `<div class="empty">Nenhuma entrada cadastrada. Use "+ Nova entrada" para lançar seu salário ou outra receita.</div>`;
    } else {
      corpo = `<div class="hd" style="${grid}">${thOrdem("ordenar-entradas", "data", "Data", ordemEntradas)}${thOrdem("ordenar-entradas", "descricao", "Descrição", ordemEntradas)}${thOrdem("ordenar-entradas", "banco", "Banco", ordemEntradas)}${thOrdem("ordenar-entradas", "status", "Status", ordemEntradas)}${thOrdem("ordenar-entradas", "valor", "Valor", ordemEntradas, "r hd-valor")}</div>` +
        lista.map((e) => `
        <div class="rw clicavel${e.prevista ? " linha-prevista" : ""}" style="${grid}" data-acao="${e.prevista ? "editar-previsao-entrada" : "editar-entrada"}" data-id="${e.id}" data-data="${e.data}" title="${e.prevista ? "Abre este mês para edição (o valor muda só aqui)" : "Abrir para editar"}">
          <div class="dim" style="font-size:12px">${fmtDataCurta(e.data)}</div>
          <div><div class="nm">${esc(e.descricao)}${seloFreq(e)}</div><div class="sub">${esc(e.categoria)} · ${esc(e.tipo || "")}</div></div>
          <div><button class="cel-banco cel-banco-botao" data-acao="trocar-banco-entrada" data-id="${e.id}" title="${e.prevista ? "Troca o banco do lançamento original (vale para todas as repetições)" : "Trocar o banco desta entrada"}">${marcaBanco(e.banco, 18)}<span class="dim">${esc(e.banco)}</span></button></div>
          <div>${e.prevista
            ? `<button class="selo-tag ${e.recebidaNoMes ? "selo-pago" : "selo-prevista"} selo-botao" data-acao="quitar-mes-entrada" data-id="${e.id}" data-mes="${e.mesRef}" title="${e.recebidaNoMes ? "Marcar como prevista" : "Marcar como paga"}">${e.status}</button>`
            : `<button class="selo-tag ${e.previsto ? "selo-prevista" : "selo-pago"} selo-botao" data-acao="alternar-prevista-entrada" data-id="${e.id}" title="${e.previsto ? "Marcar como paga" : "Marcar como prevista"}">${e.status}</button>`}</div>
          <div class="cel-valor"><span class="big up">+${brl(e.valor)}</span></div>
        </div>`).join("");
    }
    return `
      <div class="grid g-top">
        <div class="c12">${card("c12", "Entradas", `Recebidas: +${brl(totalMes)} · previstas: +${brl(totalPrevisto)}`, `${abasMeses12("mes-entradas", mesEntradas, "anoEntradas", anosDisponiveis(d))}<button class="btn primario" data-acao="nova-entrada"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`, corpo)}</div>
      </div>
    `;
  }


  // Janela simples para somar um valor à conta, no mesmo formato da que
  // adiciona valor a uma meta. O lançamento entra em Entradas.
  function abrirModalValorBanco(bancoId) {
    const b = achar(DADOS.bancos, bancoId);
    if (!b) return;
    abrirModal(`
      <h3>Adicionar valor — ${esc(b.nome)}</h3>
      <div class="campo"><label for="f_valor">Quanto você quer adicionar?</label>${campoMoeda("f_valor", "")}</div>
      <div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="Depósito" placeholder="Depósito"></div>
      <div class="modal-acoes"><button class="btn primario salvar" id="btnSalvar">Adicionar</button></div>`);
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
  function abrirModalEntrada(id, bancoIdPadrao, previsao) {
    const e = id ? achar(DADOS.entradas, id) : null;
    abrirModal(`
      <h3>${e ? "Editar entrada" : "Nova entrada"}</h3>
      <div class="par">
        <div class="campo"><label for="f_data">Data</label><input id="f_data" type="date" value="${previsao ? previsao.data : (e ? e.data : hojeISO())}"></div>
        <div class="campo"><label for="f_valor">Valor</label>${campoMoeda("f_valor", e ? (previsao ? valorDoMes(e, previsao.data.slice(0, 7)) : e.valor) : "")}</div>
      </div>
      <div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="${e ? esc(e.descricao) : ""}" placeholder="Salário"></div>
      <div class="par">
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(CATS_ENTRADA, e ? e.categoria : CATS_ENTRADA[0])}</select></div>
        <div class="campo"><label for="f_banco">Banco</label><select id="f_banco">${opcoesBancos(DADOS.bancos, e ? e.bancoId : (bancoIdPadrao || ""), true)}</select></div>
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
      if (previsao) {
        // muda só o mês editado, dentro do próprio lançamento recorrente
        gravarAjuste(e, previsao.data.slice(0, 7), { valor: registro.valor });
        if (registro.data && registro.data !== previsao.data) registrarReancoragem(e, previsao.data.slice(0, 7), registro.data);
      } else if (e) Object.assign(e, manterSerie(e, registro));
      else DADOS.entradas.push(registro);
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
  // nome do banco de uma despesa (se foi no cartão, o banco do cartão)
  function bancoDoLancamento(d, x) {
    if (x.cartaoId) {
      const c = achar(d.cartoes, x.cartaoId);
      return c ? F.nomeBanco(d, c.bancoId) : "Cartão";
    }
    return F.nomeBanco(d, x.bancoId);
  }

  function renderDespesas(d) {
    // a tela reúne o que já saiu (despesas lançadas) e o que ainda vai
    // sair (contas a pagar), com o status de cada linha
    const lancadas = d.despesas.map((x) => ({
      origem: "despesa", id: x.id, descricao: x.descricao, categoria: x.categoria, tipo: x.tipo,
      pagoCom: bancoDoLancamento(d, x),
      data: x.data, status: "Pago", valor: Number(x.valor || 0), recorrencia: freqDe(x)
    }));
    const contasDoMes = (d.contasPagar || [])
      .filter((c) => String(c.vencimento || "").slice(0, 7) === mesDespesas)
      .map((c) => ({ descricao: c.descricao, categoria: c.categoria, valor: c.valor, data: c.vencimento, origemRecorrente: c.origemRecorrente }));
    // contas a pagar recorrentes também geram previsões
    const contasComoLista = (d.contasPagar || []).map((c) => ({ ...c, data: c.vencimento }));
    const repeticoesContas = repeticoesPrevistas(contasComoLista, mesDespesas, (reg, data) => ({
      origem: "conta", id: reg.id, descricao: reg.descricao, categoria: reg.categoria, tipo: reg.tipo,
      pagoCom: reg.bancoId ? F.nomeBanco(d, reg.bancoId) : "—", data, valor: valorDoMes(reg, data.slice(0, 7)),
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      recorrencia: freqDe(reg), prevista: true, mesRef: data.slice(0, 7)
    }), []);
    const repeticoes = repeticoesPrevistas(d.despesas, mesDespesas, (reg, data) => ({
      origem: "despesa", id: reg.id, descricao: reg.descricao, categoria: reg.categoria, tipo: reg.tipo,
      pagoCom: bancoDoLancamento(d, reg), data, valor: valorDoMes(reg, data.slice(0, 7)),
      status: mesQuitado(reg, data.slice(0, 7)) ? "Pago" : "Prevista",
      recorrencia: freqDe(reg), prevista: true, mesRef: data.slice(0, 7)
    }), contasDoMes);
    const previstas = F.listaContasPagarComStatus(d).map((c) => ({
      origem: "conta", id: c.id, descricao: c.descricao, categoria: c.categoria, tipo: c.tipo,
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
    if (!lista.length) {
      corpo = `<div class="empty">Nenhum lançamento em ${NOMES_MES[Number(mesDespesas.slice(5, 7)) - 1]}/${mesDespesas.slice(0, 4)}. Use NOVO para lançar uma despesa ou uma conta a pagar.</div>`;
    } else {
      corpo = `<div class="hd" style="${gridD}">${thOrdem("ordenar-despesas", "data", "Data", ordemDespesas)}${thOrdem("ordenar-despesas", "descricao", "Descrição", ordemDespesas)}${thOrdem("ordenar-despesas", "pagoCom", "Banco", ordemDespesas)}${thOrdem("ordenar-despesas", "status", "Status", ordemDespesas)}${thOrdem("ordenar-despesas", "valor", "Valor", ordemDespesas, "r hd-valor")}</div>` +
        lista.map((x) => `
        <div class="rw clicavel${x.prevista ? " linha-prevista" : ""}" style="${gridD}" data-acao="${x.prevista ? (x.origem === "conta" ? "editar-previsao-conta" : "editar-previsao") : (x.origem === "despesa" ? "editar-despesa" : "editar-conta")}" data-id="${x.id}" data-data="${x.data}" title="${x.prevista ? "Abre este mês para edição (o valor muda só aqui)" : "Abrir para editar"}">
          <div class="dim" style="font-size:12px">${fmtData(x.data)}</div>
          <div><div class="nm">${esc(x.descricao)}${x.recorrencia && x.recorrencia !== FREQUENCIAS[0] ? ` <span class="selo-tag selo-cat">${esc(x.recorrencia.toLowerCase())}</span>` : ""}</div><div class="sub">${esc(x.categoria || "—")} · ${esc(x.tipo || "Variável")}</div></div>
          <div>${x.origem === "despesa" || x.pagoCom !== "—"
            ? `<button class="cel-banco cel-banco-botao" data-acao="${x.origem === "despesa" ? "trocar-banco" : "trocar-banco-conta"}" data-id="${x.id}" title="Trocar o banco (nas repetições, altera o lançamento original)">${marcaBanco(x.pagoCom, 18)}<span class="dim">${esc(x.pagoCom)}</span></button>`
            : `<span class="cel-banco">${x.pagoCom && x.pagoCom !== "—" ? marcaBanco(x.pagoCom, 18) + `<span class="dim">${esc(x.pagoCom)}</span>` : '<span class="dim">—</span>'}</span>`}</div>
          <div>${x.prevista
            ? `<button class="selo-tag ${x.status === "Pago" ? "selo-pago" : "selo-prevista"} selo-botao" data-acao="${x.origem === "conta" ? "quitar-mes-conta" : "quitar-mes"}" data-id="${x.id}" data-mes="${x.mesRef}" title="Confirmar: cria o lançamento deste mês">${x.status}</button>`
            : `<button class="selo-tag selo-${x.status.toLowerCase()} selo-botao" data-acao="${x.origem === "conta" ? "alternar-pago" : "tornar-pendente"}" data-id="${x.id}" title="${x.origem === "conta" ? (x.status === "Pago" ? "Marcar como prevista" : "Marcar como paga") : "Marcar como prevista (vira conta a pagar)"}">${x.status}</button>`}</div>
          <div class="cel-valor"><span class="big down">−${brl(x.valor)}</span></div>
        </div>`).join("");
    }

    return `
      <div class="grid g-top">
        <div class="c12">${card("c12", "Despesas", `Pagas: −${brl(totalMes)} · Previstas: −${brl(emAberto)} · Atrasadas: −${brl(atrasadas)}`,
          `${abasMeses12("mes-despesas", mesDespesas, "anoDespesas", anosDisponiveis(d))}<button class="btn primario" data-acao="nova-despesa"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`,
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
    const x = id ? achar(origem === "conta" ? DADOS.contasPagar : DADOS.despesas, id) : null;
    const ehConta = origem === "conta";
    const statusAtual = x ? (ehConta ? (F.statusReal(x) === "Pago" ? "Pago" : "Prevista") : "Pago") : "Pago";
    const dataAtual = previsao ? previsao.data : (x ? (ehConta ? x.vencimento : x.data) : hojeISO());

    abrirModal(`
      <h3>${x ? "Editar lançamento" : "Nova despesa"}</h3>
      <div class="par">
        <div class="campo"><label for="f_data"><span id="rotuloData">${statusAtual === "Pago" ? "Data" : "Data de vencimento"}</span></label><input id="f_data" type="date" value="${dataAtual}"></div>
        <div class="campo"><label for="f_valor">Valor</label>${campoMoeda("f_valor", x ? (previsao ? valorDoMes(x, previsao.data.slice(0, 7)) : x.valor) : "")}</div>
      </div>
      <div class="campo"><label for="f_desc">Descrição</label><input id="f_desc" value="${x ? esc(x.descricao) : ""}" placeholder="Supermercado"></div>
      <div class="par">
        <div class="campo"><label for="f_cat">Categoria</label><select id="f_cat">${opcoes(CATS_DESPESA, x ? x.categoria : CATS_DESPESA[0])}</select></div>
        <div class="campo"><label for="f_tipo">Tipo</label><select id="f_tipo">${opcoes(["Fixa", "Variável"], x && x.tipo ? x.tipo : "Variável")}</select></div>
      </div>
      <div class="campo"><label for="f_status">Status</label><select id="f_status">${opcoes(["Pago", "Prevista"], statusAtual)}</select></div>
      <div id="camposPagamento">
        <div class="par">
          <div class="campo"><label for="f_pagarcom">Banco</label><select id="f_pagarcom">${opcoesPagarCom(DADOS, x ? x.bancoId : "", x && !ehConta ? x.cartaoId : "")}</select></div>
          <div class="campo"><label for="f_forma">Forma</label><select id="f_forma">${opcoes(FORMAS_PAGAMENTO, x ? x.formaPagamento : FORMAS_PAGAMENTO[0])}</select></div>
        </div>
        <div class="campo"><label for="f_rec">Repetição</label><select id="f_rec">${opcoes(FREQUENCIAS, freqDe(x))}</select></div>
      </div>
      <div class="campo"><label for="f_obs">Observação</label><textarea id="f_obs" placeholder="Opcional">${x ? esc(x.obs || "") : ""}</textarea></div>
      <div class="modal-acoes">
        <button class="btn primario salvar" id="btnSalvar">Salvar</button>
        ${x && !previsao ? `<button class="btn perigo" id="btnExcluir">Excluir</button>` : ""}
      </div>`);

    // mostra ou esconde os campos de pagamento conforme o status
    const selStatus = document.getElementById("f_status");
    selStatus.addEventListener("change", () => {
      const pago = selStatus.value === "Pago";
      document.getElementById("rotuloData").textContent = pago ? "Data" : "Data de vencimento";
    });

    document.getElementById("btnSalvar").onclick = () => {
      const status = selStatus.value;
      const desc = document.getElementById("f_desc").value.trim();
      if (!desc) { toast("Descreva o lançamento."); return; }
      const data = document.getElementById("f_data").value || hojeISO();
      const valor = numIn(document.getElementById("f_valor").value);
      const categoria = document.getElementById("f_cat").value;
      const tipo = document.getElementById("f_tipo").value;
      const obs = document.getElementById("f_obs").value.trim();

      if (status === "Pago") {
        const pagarCom = document.getElementById("f_pagarcom").value;
        if (!pagarCom) { toast("Selecione com o que essa despesa foi paga."); return; }
        const [tipoPg, idPg] = pagarCom.split(":");
        const registro = {
          id: (x && !ehConta) ? x.id : A.novoId(), data, descricao: desc, categoria, tipo,
          bancoId: tipoPg === "banco" ? idPg : "", cartaoId: tipoPg === "cartao" ? idPg : "",
          valor, formaPagamento: document.getElementById("f_forma").value,
          recorrencia: document.getElementById("f_rec").value,
          recorrente: document.getElementById("f_rec").value !== FREQUENCIAS[0], obs
        };
        if (previsao) {
          gravarAjuste(x, previsao.data.slice(0, 7), { valor: registro.valor, pago: true });
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
          id: (x && ehConta) ? x.id : A.novoId(), descricao: desc, categoria, tipo,
          vencimento: data, valor, status: "Pendente", obs,
          bancoId: tipoP === "banco" ? idP : "",
          formaPagamento: document.getElementById("f_forma").value,
          recorrencia: document.getElementById("f_rec").value,
          recorrente: document.getElementById("f_rec").value !== FREQUENCIAS[0]
        };
        if (previsao) {
          gravarAjuste(x, previsao.data.slice(0, 7), { valor: registro.valor, pago: false });
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
          <button data-acao="${m.__tipo === "Entrada" ? "editar-entrada" : "editar-despesa"}" data-id="${m.id}" style="text-align:left"><div class="nm">${esc(m.descricao)}</div></button>
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
          <td class="papel">${esc(inv.nome)}<small>${esc(inv.tipoAtivo || inv.categoria)}${inv.banco ? " · " + esc(inv.banco) : ""}</small></td>
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
          <div><b class="acc">${plural(vencendo.length, "investimento")} vencendo nos próximos 60 dias:</b> ${vencendo.map((v) => esc(v.nome) + " (" + fmtData(v.dataVencimento) + ")").join(" · ")}</div>
          <button class="fechar" data-acao="dispensar-vencimentos" title="Não avisar mais sobre estes vencimentos" aria-label="Dispensar aviso">×</button>
        </div>`
      : "";

    return `
      ${aviso}
      <div class="grid g-top">
        <div class="c12">${card("", "Investimentos", "renda fixa, tesouro, fundos e cripto",
          `<button class="btn primario" data-acao="novo-investimento"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`,
          corpo,
          `<span class="dim">Total líquido</span><b class="creme" style="font-size:14px;font-weight:800">${brl(t.liquido)}</b>`)}</div>
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
        obs: document.getElementById("f_obs").value.trim()
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


  function explicarPontoInvestimento(inv, ponto, idx, historico) {
    if (!inv || !ponto) return;
    const aplicado = Number(inv.valorInvestido || 0);
    const anterior = idx > 0 ? historico[idx - 1] : null;
    const resultado = ponto.valor - aplicado;
    const varAnt = anterior ? ponto.valor - anterior.valor : 0;
    const linha = (r, v, c) => `<div class="kv"><span class="dim">${rotuloPainel(r)}</span><b class="${c || ""}">${v}</b></div>`;
    painelSimples(`${esc(inv.nome)} · ${fmtData(ponto.data)}`, aplicado > 0 ? (resultado / aplicado) * 100 : 0,
      "de rendimento sobre o valor aplicado", "(valor na data ÷ valor aplicado − 1) × 100",
      linha("Valor na data", brl(ponto.valor), "creme") +
      linha("Valor aplicado", brl(aplicado)) +
      linha("Resultado", brlSinal(resultado), corSinal(resultado)) +
      (anterior ? linha("Registro anterior", `${brl(anterior.valor)} · ${fmtData(anterior.data)}`) : "") +
      (anterior ? linha("Variação", brlSinal(varAnt), corSinal(varAnt)) : "") +
      linha("Valor atual", brl(inv.valorAtual)),
      "investimentos",
      { rotulo: "Editar", acao: () => abrirModalInvestimento(inv.id) });
  }

  function renderDetalheInvestimento(d, id) {
    const inv = achar(d.investimentos, id);
    if (!inv) return `<div class="empty">Aplicação não encontrada. <button class="link-acao" data-acao="ir" data-secao="investimentos">Voltar para Investimentos</button></div>`;

    const aplicado = Number(inv.valorInvestido || 0);
    const bruto = Number(inv.valorAtual || 0);
    const resultado = bruto - aplicado;
    const dias = I.diasCorridos(inv);
    const diasVenc = I.diasAteVencimento(inv);
    const aliq = I.aliquotaEfetiva(inv);
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
          `${esc(inv.emissor || "emissor não informado")}${inv.banco ? " · custódia: " + esc(inv.banco) : ""}${inv.indexador ? " · " + esc(inv.indexador) + (inv.taxaContratada ? " " + f2(inv.taxaContratada) + "%" : "") : ""}`,
          `${abasPeriodo()}<button class="btn" data-acao="editar-investimento" data-id="${inv.id}">Editar</button>`,
          hist.length >= 2
            ? `<div style="padding:10px 16px;height:260px"><canvas id="graf-valor-investimento"></canvas></div>`
            : `<div class="empty">Ainda não há histórico suficiente para o gráfico.<br>Cada importação do extrato (ou edição do valor atual) acrescenta um ponto na linha.</div>`)}</div>
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

  function carregarSerieDolar() {
    if (serieDolar || buscandoSerieDolar || !C || typeof fetch !== "function") return;
    buscandoSerieDolar = true;
    C.buscarSerieDolar(180).then((serie) => {
      serieDolar = serie;
      buscandoSerieDolar = false;
      if (ROTA.secao === "detalhe-dolar") renderRota();
    }).catch(() => { buscandoSerieDolar = false; });
  }

  function renderDetalheDolar(d) {
    const serie = serieDolar || [];
    const filtrada = filtrarPeriodo(serie.map((p) => ({ data: p.data, preco: p.preco })), periodoGrafico);
    const atual = dolar ? dolar.valor : (serie.length ? serie[serie.length - 1].preco : 0);
    const variacao = dolar ? (dolar.variacaoPct || 0) : 0;
    const precos = filtrada.map((p) => p.preco);
    const min = precos.length ? Math.min(...precos) : atual;
    const max = precos.length ? Math.max(...precos) : atual;
    const media = precos.length ? precos.reduce((a, b) => a + b, 0) / precos.length : atual;
    const primeiro = precos.length ? precos[0] : atual;
    const noPeriodo = primeiro > 0 ? ((atual / primeiro) - 1) * 100 : 0;
    const emDolar = I.totalCarteiraAcoes(d) + I.patrimonio(d).investimentos;

    return `
      <button class="voltar" data-acao="ir" data-secao="acoes"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.voltar}</svg>Voltar para Ações</button>
      <div class="grid g-top grid-detalhe">
        <div class="c8">${card("", `USD/BRL <span class="selo-tag selo-acao">moeda</span>`,
          "dólar comercial · AwesomeAPI",
          `${abasPeriodo()}<button class="btn" data-acao="buscar-cotacoes">↻ Buscar</button>`,
          filtrada.length >= 2
            ? `<div style="padding:10px 16px;height:260px"><canvas id="graf-dolar"></canvas></div>`
            : `<div class="empty">${buscandoSerieDolar ? "Carregando o histórico do dólar…" : "Não foi possível carregar o histórico agora. Verifique a internet e toque em ↻ Buscar."}</div>`)}</div>
        <div class="c4">${card("", "Resumo da cotação", "", "", `
          <div class="kv"><span class="dim">Cotação atual</span><b class="creme">${brl(atual)}</b></div>
          <div class="kv"><span class="dim">Variação do dia</span><b class="${corSinal(variacao)}">${pct(variacao)}</b></div>
          <div class="kv"><span class="dim">Variação no período</span><b class="${corSinal(noPeriodo)}">${pct(noPeriodo)}</b></div>
          <div class="kv"><span class="dim">Mínima do período</span><b>${brl(min)}</b></div>
          <div class="kv"><span class="dim">Máxima do período</span><b>${brl(max)}</b></div>
          <div class="kv"><span class="dim">Média do período</span><b>${brl(media)}</b></div>
          <div class="kv"><span class="dim">Dias no gráfico</span><b>${filtrada.length}</b></div>
          <div class="kv"><span class="dim">Seus investimentos</span><b>${brl(emDolar)}</b></div>
          <div class="kv"><span class="dim">Equivalente em dólar</span><b>${atual > 0 ? "US$ " + (emDolar / atual).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</b></div>
          <div class="kv"><span class="dim">Atualizado em</span><b>${dolar && dolar.atualizadoEm ? esc(String(dolar.atualizadoEm).slice(0, 16).replace("T", " ")) : "—"}</b></div>
        `)}</div>
      </div>
    `;
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
          : `<span class="${forte}">${brl(a.precoAtual)}</span>`;
        return `<tr data-acao="ir" data-secao="detalhe-acao" data-id="${a.id}">
          <td class="papel">${esc(a.ticker)}<small>${esc(a.categoria)}${a.banco ? " · " + esc(a.banco) : ""}</small></td>
          <td class="r">${ultima}</td>
          <td class="r"><span class="${v.valor >= 0 ? "cel-up" : "cel-down"}">${v.valor >= 0 ? "+" : "−"}${brl(Math.abs(v.valor))}</span></td>
          <td class="r">${fp(v.pct)}</td>
          <td class="r">${fn(a.quantidade)}</td>
          <td class="r">${brl(a.precoMedio)}</td>
          <td class="r">${brl(a.valorInvestido)}</td>
          <td class="r creme">${brl(a.valorAtual)}</td>
          <td class="r ${corSinal(a.resultado)}">${a.resultado >= 0 ? "+" : "−"}${brl(Math.abs(a.resultado))}</td>
          <td class="r">${fp(a.rentabilidade)}</td>
          <td class="r dim">${brl(mm.min)}</td>
          <td class="r dim">${brl(mm.max)}</td>
          <td class="r">${fp(m30)}</td>
          <td class="r">${fp(m365)}</td>
          <td class="r">${brl(a.dividendos || 0)}</td>
          <td class="r">${f2(a.peso)}%</td>
          <td class="r dim col-atualiz">${fmtDataCurta(a.atualizadoEm)}</td>
        </tr>`;
      }).join("");
      const tInv = I.totalInvestidoAcoes(d), tAt = I.totalCarteiraAcoes(d), tRes = tAt - tInv;
      corpo = `<div class="terminal-scroll"><table class="terminal tab-acoes">
        <thead><tr>
          <th>Papel</th><th class="r">Última</th><th class="r">Var.</th><th class="r">Var. %</th><th class="r">Qtd.</th><th class="r">PM</th>
          <th class="r">Investido</th><th class="r">Atual</th><th class="r">Resultado</th><th class="r">Rent. %</th>
          <th class="r">Mínima</th><th class="r">Máxima</th><th class="r">Mensal %</th><th class="r">Anual %</th>
          <th class="r">Divid.</th><th class="r">Peso</th><th class="r col-atualiz">Atualiz.</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr>
          <td>CARTEIRA</td><td></td><td></td><td></td><td></td><td></td>
          <td class="r">${brl(tInv)}</td><td class="r creme">${brl(tAt)}</td>
          <td class="r ${corSinal(tRes)}">${tRes >= 0 ? "+" : "−"}${brl(Math.abs(tRes))}</td>
          <td class="r">${fp(I.rentabilidadeCarteiraAcoes(d))}</td>
          <td></td><td></td><td></td><td></td><td class="r">${brl(I.totalDividendosAcoes(d))}</td><td class="r">100%</td><td class="col-atualiz"></td>
        </tr></tfoot>
      </table></div>`;
    }

    return `
      <div class="grid g-top">
        <div class="c12">${card("", "Painel ativos", (configCotacoes().auto ? '<span class="selo-tag selo-acao">cotação automática · brapi.dev</span>' : '<span class="selo-tag selo-cat">preço atualizado manualmente</span>'),
          `<div class="dolar-pill" id="dolarTopbar" title="Dólar comercial (AwesomeAPI)" style="display:none"></div>
           <button class="btn" data-acao="buscar-cotacoes" title="Buscar cotações na internet agora">↻ Buscar</button>
           <button class="btn primario" data-acao="novo-ativo"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONES.mais}</svg>NOVO</button>`,
          corpo,
          `<span class="dim">Total Carteira</span><b class="creme" style="font-size:14px;font-weight:800">${brl(I.totalCarteiraAcoes(d))}</b>`)}</div>
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

  // anos com dados, para os seletores dos quadros do dashboard
  function serieRD(d) {
    const fx = intervaloAnoMeses(anoRD, mesesRD);
    return serieMensalPeriodo(d, fx.ini, fx.fim);
  }

  function historicoEvo(d) {
    const h = d.historicoPatrimonio || [];
    if (!mesesEvo) return h;
    const fx = intervaloAnoMeses(anoEvo, mesesEvo);
    // devolve só o que existe no período; se não houver, o quadro avisa
    return h.filter((x) => x.data >= fx.ini && x.data <= fx.fim);
  }


  // Lista de anos dos seletores: do ano mais antigo com dados (ou do ano
  // atual) até 2070, para planejar recorrências de longo prazo.
  const ANO_LIMITE = 2070;
  function faixaAnos(anosComDados) {
    const atual = new Date().getFullYear();
    const numeros = anosComDados.map(Number).filter((n) => n > 1900);
    const inicio = Math.min(atual, ...(numeros.length ? numeros : [atual]));
    const fim = Math.max(ANO_LIMITE, ...(numeros.length ? numeros : [atual]));
    const lista = [];
    for (let a = fim; a >= inicio; a--) lista.push(String(a));
    return lista;
  }

  function anosDashboard(d) {
    const anos = new Set([String(new Date().getFullYear())]);
    [...d.entradas, ...d.despesas].forEach((m) => { if (m.data) anos.add(String(m.data).slice(0, 4)); });
    (d.historicoPatrimonio || []).forEach((h) => { if (h.data) anos.add(String(h.data).slice(0, 4)); });
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
    const investido = I.valorInvestidoAcao(a), atual = I.valorAtualAcao(a);
    const resultado = atual - investido, rent = I.rentabilidadeAcao(a);
    const { min, max } = I.precoMinMax(a);

    return `
      <button class="voltar" data-acao="ir" data-secao="acoes"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES.voltar}</svg>Voltar para Ações</button>
      <div class="grid g-top grid-detalhe">
        <div class="c8">${card("", `${esc(a.ticker)} <span class="selo-tag selo-${a.categoria.toLowerCase()}">${a.categoria}</span>`, esc(a.empresa),
          `${abasPeriodo()}<button class="btn" data-acao="editar-acao" data-id="${a.id}">Editar</button>`,
          `<div class="grafico-acao-area"><canvas id="graf-preco-acao"></canvas></div>`)}</div>
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
          ${a.banco ? `<div class="kv"><span class="dim">Banco / corretora</span><b>${esc(a.banco)}</b></div>` : ""}
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
      corpo = `<div class="c8"><div class="card"><div class="empty">Nenhuma meta cadastrada. Que tal começar por uma reserva de emergência?</div></div></div>`;
    } else {
      corpo = d.metas.map((m) => {
        const progresso = m.objetivo > 0 ? Math.min(100, (m.atual / m.objetivo) * 100) : 0;
        const diasPrazo = m.prazo ? F.diasEntre(m.prazo) : null;
        const vencida = diasPrazo !== null && diasPrazo < 0 && Number(m.atual || 0) < Number(m.objetivo || 0);
        return `<div class="c4"><div class="card card-clicavel${vencida ? " card-meta-vencida" : ""}" data-acao="editar-meta" data-id="${m.id}" title="Abrir para editar">
          <header><div><h2>${esc(m.nome)}${vencida ? ' <span class="selo-tag selo-atrasado">prazo vencido</span>' : ""}</h2>${m.prazo ? `<div class="sub ${vencida ? "down" : ""}">até ${fmtData(m.prazo)}${vencida ? ` · há ${plural(Math.abs(diasPrazo), "dia")}` : ""}</div>` : ""}</div>
          </header>
          <div class="body pad">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span class="num" style="font-size:18px;font-weight:600">${brl(m.atual)}</span>
              <span class="dim num" style="font-size:12.5px">de ${brl(m.objetivo)}</span>
            </div>
            <div class="progresso"><i style="width:${progresso}%;background:${m.cor || "var(--up)"}"></i></div>
            <div class="progresso-legenda"><span>${progresso.toFixed(1)}%</span><span>${brl(Math.max(0, m.objetivo - m.atual))} restantes</span></div>
            <div class="meta-mensal" title="Quanto guardar por mês — clique para editar">
              <span class="meta-mensal-icone" style="color:${m.cor || "var(--up)"}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M12 13.2v5M9.8 15.4h4.4"/></svg></span>
              <span class="meta-mensal-texto"><small>Guardar por mês</small>${Number(m.aporteMensal) > 0 ? `<b class="num">${brl(m.aporteMensal)}</b>` : `<b class="dim">Definir valor</b>`}</span>
            </div>
            <button class="btn pequeno" style="margin-top:12px;width:100%;justify-content:center" data-acao="depositar-meta" data-id="${m.id}">+ Adicionar</button>
          </div>
        </div></div>`;
      }).join("");
    }
    // o botão de nova meta ocupa o espaço de um quadro, com o sinal "+"
    const botaoNova = `<div class="c4"><button class="card card-novo" data-acao="nova-meta" title="Nova meta" aria-label="Nova meta">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${ICONES.mais}</svg>
    </button></div>`;
    // criar uma meta é feito pelo quadro com "+", sempre no fim da grade
    return `<div class="grid g-top">${corpo}${botaoNova}</div>`;
  }

  function abrirModalMeta(id) {
    const m = id ? achar(DADOS.metas, id) : null;
    abrirModal(`
      <h3>${m ? "Editar meta" : "Nova meta"}</h3>
      <div class="campo"><label for="f_nome">Nome</label><input id="f_nome" value="${m ? esc(m.nome) : ""}" placeholder="Reserva de emergência"></div>
      <div class="par">
        <div class="campo"><label for="f_obj">Objetivo</label>${campoMoeda("f_obj", m ? m.objetivo : "", "R$ 30.000,00")}</div>
        <div class="campo"><label for="f_atual">Valor Atual</label>${campoMoeda("f_atual", m ? m.atual : 0)}</div>
      </div>
      <div class="par">
        <div class="campo"><label for="f_mensal">Guardar por mês</label>${campoMoeda("f_mensal", m && m.aporteMensal ? m.aporteMensal : "", "R$ 500,00")}</div>
        <div class="campo"><label for="f_prazo">Prazo</label><input id="f_prazo" type="date" value="${m ? m.prazo || "" : ""}"></div>
      </div>
      <div class="campo ajuda" style="margin-top:-6px">Quanto você pretende adicionar a esta meta todo mês.</div>
      <div class="campo"><label for="f_cor">Cor</label><input id="f_cor" type="color" value="${m ? m.cor || "#22E08A" : CORES_META[DADOS.metas.length % CORES_META.length]}"></div>
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
        aporteMensal: numIn(document.getElementById("f_mensal").value),
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

  function renderRelatorios(d) {
    if (!anoRelA) anoRelA = String(new Date().getFullYear());
    if (!anoRelB) anoRelB = String(new Date().getFullYear());
    const fxA = intervaloRel(mesesRelA, anoRelA);   // quadro receitas x despesas
    const fxB = intervaloRel(mesesRelB, anoRelB);   // quadro evolução patrimonial
    const entradasP = d.entradas.filter((e) => e.data >= fxA.ini && e.data <= fxA.fim).reduce((s, e) => s + Number(e.valor), 0);
    const despesasP = d.despesas.filter((x) => x.data >= fxA.ini && x.data <= fxA.fim).reduce((s, x) => s + Number(x.valor), 0);
    const historicoP = d.historicoPatrimonio.filter((h) => h.data >= fxB.ini && h.data <= fxB.fim);
    const picoB = historicoP.length ? Math.max(...historicoP.map((h) => h.valor)) : 0;
    const OPC = [{ meses: 3, rotulo: "3m" }, { meses: 6, rotulo: "6m" }, { meses: 12, rotulo: "12m" }, { meses: 0, rotulo: "Tudo" }];
    const rotulo = (m, ano) => (m ? `${m} ${m === 1 ? "mês" : "meses"} de ${ano}` : "Todo histórico");
    const rotuloPeriodo = rotulo(mesesRelA, anoRelA);

    return `
      <div class="grid g-top">
        <div class="c3">${metricCard("Receitas", brl(entradasP), ICONES_STRIP.poupanca, "var(--up)", "", rotuloPeriodo, null, "0 0 24 24", "rel-receitas")}</div>
        <div class="c3">${metricCard("Despesas", brl(despesasP), ICONES_STRIP.maiorgasto, "var(--down)", "", rotuloPeriodo, null, "0 0 24 24", "rel-despesas")}</div>
        <div class="c3">${metricCard("Resultado", brlSinal(entradasP - despesasP), ICONES_STRIP.projecao, corSinal(entradasP - despesasP) === "up" ? "var(--up)" : "var(--down)", "", "", null, "0 0 24 24", "rel-resultado")}</div>
        <div class="c3">${metricCard("Rentabilidade", pct(I.rentabilidadeCarteiraAcoes(d)), ICONES_STRIP.melhorativo, "var(--vi)", "", "Acumulada · Preço Médio", null, "0 0 24 24", "rel-rentabilidade")}</div>
      </div>
      <div class="grid">
        <div class="c12">${card("", "Receitas x despesas", `${rotulo(mesesRelA, anoRelA)}`, `<div class="filtro-mes">${seletorAnoDash("anoRelA", anoRelA, anosDashboard(d))}${abasMeses("periodo-rel-a", mesesRelA, OPC)}</div>`, `<div style="padding:10px 16px;height:220px"><canvas id="graf-rel-mensal"></canvas></div>`)}</div>
      </div>
      <div class="grid">
        <div class="c12">${card("", "Evolução patrimonial", `${rotulo(mesesRelB, anoRelB)}`,
          (picoB ? `<span class="pill-pico">PICO ${brl(picoB)}</span>` : "") +
          `<div class="filtro-mes">${seletorAnoDash("anoRelB", anoRelB, anosDashboard(d))}${abasMeses("periodo-rel-b", mesesRelB, OPC)}</div>`, historicoP.length >= 2 ? `<div style="padding:10px 16px;height:220px"><canvas id="graf-rel-evolucao"></canvas></div>` : `<div class="empty">Ainda não há histórico suficiente para este período.</div>`)}</div>
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
        <div class="c6">${card("", "Backup Dados", A.ehDesktop ? "banco de dados em arquivo dentro do programa, com cópia automática (dados.bak.json)" : "tudo fica salvo só neste navegador — guarde uma cópia de vez em quando", "", `
          ${A.ehDesktop ? `<p class="campo ajuda" style="padding:8px 16px 0" id="caminhoBanco">Local do banco: carregando…</p><div style="padding:0 16px 6px"><button class="btn pequeno" data-acao="abrir-pasta-banco">Abrir pasta do banco de dados</button></div>` : ""}
          <div class="body pad" style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn primario" data-acao="exportar-backup">Exportar Backup</button>
            <button class="btn primario" data-acao="importar-backup">Importar Backup</button>
            <button class="btn btn-pdf" data-acao="importar-pdf">Importar PDF</button>
          </div>
          <p class="campo ajuda" style="padding:0 16px 14px">Importar um backup substitui todos os dados atuais — o sistema pede confirmação antes de aplicar.</p>
        `)}</div>
        <div class="c6">${card("", "Senha Acesso", "protege o sistema neste aparelho", "", `
          <div class="body pad">
            ${window.Bloqueio && Bloqueio.ativo() ? `
              <div id="areaBiometria" style="margin:12px 0"></div>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="btn" data-acao="trocar-senha">Trocar senha</button>
                <button class="btn perigo" data-acao="remover-senha">Remover senha</button>
              </div>
            ` : `
              <button class="btn primario" data-acao="criar-senha">Criar</button>
            `}
            <p class="campo ajuda" style="margin-top:26px">Válido exclusivamente neste dispositivo. Em caso de esquecimento da senha, será necessário apagar os dados e restaurar um backup.</p>
          </div>`)}</div>
        <div class="c12">${(() => {
          const sc = cfgSync();
          const ultima = sc.ultima ? new Date(sc.ultima).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
          const corpo = sc.ligada ? `
          <div class="body pad">
            <div class="sync-estado"><span class="sync-ponto ligado"></span><b>Ligado</b>
              <span class="dim" id="statusSync">${esc(statusSync || descreverAlteracao(DADOS) || "última sincronização: " + ultima)}</span></div>
            <div class="campo" style="margin-top:14px"><label>Código do cofre</label>
              <div class="sync-codigo"><code>${esc(sc.cofre || "sendo criado…")}</code></div>
              <div class="ajuda">Para ligar outro aparelho seu, use o mesmo token.</div></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn primario" data-acao="sincronizar-agora">Sincronizar</button>
              <button class="btn perigo" data-acao="desligar-sync">Desligar</button>
            </div>
          </div>` : `
          <div class="body pad">
            <div class="sync-estado"><span class="sync-ponto"></span><b>Desligado</b>
              <span class="dim" id="statusSync">${esc(statusSync)}</span></div>
            <div class="campo"><label for="cfgSyncToken">Token do GitHub</label>
              <input id="cfgSyncToken" type="password" autocomplete="off" spellcheck="false" placeholder="ghp_…">
              <div class="ajuda">Crie em GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic), marcando só a permissão <b>gist</b>.</div></div>
            <button class="btn primario" data-acao="conectar-sync">Ligar</button>
            <p class="campo ajuda" style="margin-top:14px">Ligue primeiro no aparelho com os dados mais completos. Nos seus outros aparelhos, use o mesmo token: eles baixam os dados e passam a se atualizar sozinhos. O token fica salvo só neste aparelho.</p>
            <p class="campo ajuda" style="margin-top:8px;color:var(--acc)"><b>Se outras pessoas também vão usar o sistema:</b> cada uma precisa da <b>própria conta</b> do GitHub e do próprio token — gratuito e leva menos de 2 minutos para criar. Usar o mesmo token que o seu faz os dados de vocês se misturarem no mesmo cofre, podendo apagar uns aos outros.</p>
          </div>`;
          return card("", "Sincronização", "entre aparelhos · web, iPad e Windows", "", corpo);
        })()}</div>
        <div class="c6">${card("", "Cotações automáticas", "dólar via AwesomeAPI (sem chave) · ações via brapi.dev", "", `
          <div class="body pad">
            <label class="chk-linha"><input type="checkbox" id="cfgCotacoesAuto" ${configCotacoes().auto ? "checked" : ""}> Buscar cotações automaticamente ao abrir o sistema e a cada 5 minutos</label>
            <div class="campo"><label for="cfgBrapiToken">Token da brapi.dev</label><input id="cfgBrapiToken" value="${esc(configCotacoes().token)}" placeholder="cole aqui outro token, se quiser">
              <div class="ajuda">Já vem com um token configurado — não precisa mexer. Se um dia quiser usar outro, basta colar aqui. Se a internet cair, o sistema mantém os últimos preços e continua funcionando.</div></div>
            <button class="btn primario" data-acao="salvar-cotacoes">Salvar</button>
            ${dolar ? `<span class="dim" style="margin-left:12px;font-size:12px">Dólar agora: <b class="acc-laranja">R$ ${dolar.valor.toFixed(2).replace(".", ",")}</b></span>` : ""}
          </div>`)}</div>
        <div class="c6"><div class="card" style="border-color:rgba(255,84,104,.3)">
          <header><div><h2 class="down">Zona Risco</h2><div class="sub">esta ação não pode ser desfeita</div></div></header>
          <div class="body pad">
            <button class="btn perigo" data-acao="apagar-tudo">Apagar</button>
            <p class="campo ajuda" style="margin-top:26px">Não há como desfazer. Exporte um backup antes, se houver algo que você queira guardar.</p>
          </div>
        </div></div>
      </div>
    `;
  }

  // =========================================================================
  // GRÁFICOS — montados depois que o HTML da rota já está no DOM
  // =========================================================================
  function montarGraficosRelatorio(d) {
    const fxA = intervaloRel(mesesRelA, anoRelA), fxB = intervaloRel(mesesRelB, anoRelB);
    const historicoP = d.historicoPatrimonio.filter((h) => h.data >= fxB.ini && h.data <= fxB.fim);
    if (historicoP.length >= 2) G.renderEvolucaoPatrimonio("graf-rel-evolucao", historicoP, { aoClicar: explicarPatrimonio });
    const primeiro = d.historicoPatrimonio.length ? d.historicoPatrimonio[0].data : fxA.ini;
    G.renderReceitasDespesas("graf-rel-mensal", serieMensalPeriodo(d, mesesRelA ? fxA.ini : primeiro, fxA.fim), { aoClicar: explicarMes });
  }





  function montarGraficosDaRota() {
    const d = DADOS;
    switch (ROTA.secao) {
      case "dashboard": {
        if (!anoRD) anoRD = String(new Date().getFullYear());
        if (!anoEvo) anoEvo = String(new Date().getFullYear());
        const hist = historicoEvo(d);
        if (hist.length < 2) break;
        if (hist.length >= 2) G.renderEvolucaoPatrimonio("graf-evolucao", hist, { aoClicar: explicarPatrimonio });
        else G.destruir("graf-evolucao");
        G.renderReceitasDespesas("graf-receitas-despesas", serieRD(d), { aoClicar: explicarMes });
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
      case "bancos": {
        if (!d.bancos.length) break;
        G.renderSaldoBancos("graf-saldo-bancos", bancosNaOrdem(bancosDoPeriodo(d)).map((b) => Object.assign({}, b, { saldoAtual: b.valor })),
          { aoClicar: (b) => explicarBanco(b.id) });
        break;
      }
      case "despesas": break;
      case "investimentos": break;
      case "detalhe-dolar": {
        carregarSerieDolar();
        const serie = filtrarPeriodo((serieDolar || []).map((p) => ({ data: p.data, preco: p.preco })), periodoGrafico);
        if (serie.length >= 2) G.renderPrecoAcao("graf-dolar", serie, 0);
        break;
      }
      case "detalhe-investimento": {
        const inv = achar(d.investimentos, ROTA.param);
        const h = inv && inv.historicoValores ? inv.historicoValores : [];
        if (h.length >= 2) G.renderEvolucaoValor("graf-valor-investimento", filtrarPeriodo(h, periodoGrafico), Number(inv.valorInvestido || 0), "Valor aplicado",
          { aoClicar: (ponto, idx, lista) => explicarPontoInvestimento(inv, ponto, idx, lista) });
        break;
      }
      case "detalhe-acao": {
        const a = achar(d.acoes, ROTA.param);
        if (a && a.historicoPrecos.length) G.renderPrecoAcao("graf-preco-acao", filtrarPeriodo(a.historicoPrecos, periodoGrafico), a.precoMedio, Number(a.precoAtual) || 0);
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

        case "entrada-banco": abrirModalValorBanco(id); break;
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
        case "mes-entradas": mesEntradas = b.dataset.mes; renderRota(); break;
        case "mes-despesas": mesDespesas = b.dataset.mes; renderRota(); break;
        case "ir-dolar": navegarPara("detalhe-dolar"); break;
        case "explicar-relatorio": explicarRelatorio(b.dataset.chave); break;
        case "explicar-strip": explicarStrip(b.dataset.chave); break;
        case "periodo-bancos": mesesBancos = Number(b.dataset.meses); renderRota(); break;
        case "periodo-rel-a": mesesRelA = Number(b.dataset.meses); renderRota(); break;
        case "periodo-rel-b": mesesRelB = Number(b.dataset.meses); renderRota(); break;
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
      if (id === "anoRD") { anoRD = e.target.value; renderRota(); return; }
      if (id === "anoEvo") { anoEvo = e.target.value; renderRota(); return; }
      if (id === "anoEntradas") { mesEntradas = e.target.value + mesEntradas.slice(4); renderRota(); return; }
      if (id === "anoDespesas") { mesDespesas = e.target.value + mesDespesas.slice(4); renderRota(); return; }
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
