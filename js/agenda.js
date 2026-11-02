/**
 * agenda.js
 * -----------------------------------------------------------------------
 * Integração com o Google Agenda (mesmo sistema do Meu Controle): cria na
 * conta Google da pessoa uma agenda com o nome do programa e coloca nela
 *   💸 contas a pagar ainda não pagas (no dia do vencimento, com alerta
 *      na véspera e no dia),
 *   💰 receitas previstas (opcional),
 *   🎯 prazos das metas.
 * Mudou no sistema, a agenda acompanha. O sistema só mexe nessa agenda — a
 * permissão pedida ("calendar.app.created") não dá acesso às outras.
 *
 * Os alertas da agenda tocam mesmo com o sistema fechado (no celular, no
 * relógio e no computador).
 *
 * O ID do cliente OAuth é o mesmo do Meu Controle (origem
 * https://mmendeswse.github.io). A agenda fica guardada nos dados
 * (config.agenda), então os aparelhos sincronizados usam a mesma.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const CLIENT_ID_PADRAO = "415282972688-krpcv51t9tjkmd70ntibsag1pobri2av.apps.googleusercontent.com";
  const idCliente = () => global.MM_GOOGLE_CLIENT_ID || CLIENT_ID_PADRAO;
  const ESCOPO = "https://www.googleapis.com/auth/calendar.app.created";
  const API = "https://www.googleapis.com/calendar/v3";
  const CHAVE = "mullerMendes:agenda";
  const NOME_AGENDA = "Finanças";   // nome da agenda na conta Google
  const DESCRICAO_AGENDA = "Contas a pagar, receitas e metas do Finanças. Para mudar, altere no sistema.";   // token deste aparelho (vale ~1 h)
  const fuso = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo"; } catch (e) { return "America/Sao_Paulo"; } };

  // ganchos do app
  const app = {
    dados: () => ({}), salvar: () => {}, desejados: () => [], nome: () => "Muller Mendes",
    aoMudarEstado: () => {}
  };
  function configurar(o) { Object.assign(app, o || {}); }

  function lerLocal() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function gravarLocal(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) { /* ignora */ } }
  const ITENS_PADRAO = { contas: true, receitas: false, metas: true };
  function cfg(d) {
    d = d || app.dados();
    d.config = d.config || {};
    const padrao = { ativa: false, calendarioId: null, itens: ITENS_PADRAO, ultimoHash: null, ultimaVez: null };
    const c = d.config.agenda && typeof d.config.agenda === "object" ? d.config.agenda : (d.config.agenda = {});
    Object.keys(padrao).forEach((k) => { if (c[k] === undefined) c[k] = padrao[k]; });
    c.itens = Object.assign({}, ITENS_PADRAO, c.itens || {});
    return c;
  }
  // o login do Google não funciona no programa do Windows (abre de um arquivo)
  const disponivel = () => !!idCliente() && /^https?:$/.test(location.protocol) && !(global.bancoDados && global.bancoDados.ehDesktop);
  const conectadoAqui = () => !!lerLocal().conectado;
  function tokenValido() { const s = lerLocal(); return s.token && s.exp && s.exp > Date.now() + 60000 ? s.token : null; }

  // ---------------------------------------------------------------------
  // login Google (Google Identity Services)
  // ---------------------------------------------------------------------
  let gisP = null, cliente = null, pedido = null;
  function carregarGIS() {
    if (gisP) return gisP;
    gisP = new Promise((ok, erro) => {
      if (global.google && global.google.accounts && global.google.accounts.oauth2) { ok(); return; }
      const t = document.createElement("script");
      t.src = "https://accounts.google.com/gsi/client"; t.async = true;
      t.onload = () => ok(); t.onerror = () => { gisP = null; erro(new Error("Não consegui carregar o login do Google. Verifique a internet.")); };
      document.head.appendChild(t);
    });
    return gisP;
  }
  const gisPronto = () => !!(global.google && global.google.accounts && global.google.accounts.oauth2);
  // precisa vir de um toque (o Google abre uma janelinha). Com o login do
  // Google já carregado, o pedido sai na mesma hora — ainda dentro do toque,
  // senão o navegador bloqueia a janelinha.
  function pedirToken(consentir) {
    return gisPronto() ? pedirAgora(consentir) : carregarGIS().then(() => pedirAgora(consentir));
  }
  function pedirAgora(consentir) {
    return new Promise((ok, erro) => {
      if (!cliente) {
        cliente = global.google.accounts.oauth2.initTokenClient({
          client_id: idCliente(), scope: ESCOPO,
          callback: (r) => {
            const p = pedido; pedido = null; if (!p) return;
            if (r && r.access_token && (!global.google.accounts.oauth2.hasGrantedAllScopes || global.google.accounts.oauth2.hasGrantedAllScopes(r, ESCOPO))) {
              const s = lerLocal(); Object.assign(s, { token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000, conectado: true }); gravarLocal(s);
              p.ok(r.access_token);
            } else p.erro(new Error(r && r.error === "access_denied" ? "Você não autorizou o acesso à agenda." : "O Google não liberou o acesso à agenda."));
          },
          error_callback: (e) => { const p = pedido; pedido = null; if (p) p.erro(new Error(e && e.type === "popup_closed" ? "A janela do Google foi fechada antes de terminar." : e && e.type === "popup_failed_to_open" ? "O navegador bloqueou a janela do Google. Permita pop-ups para este site." : "Não deu certo entrar no Google.")); }
        });
      }
      pedido = { ok, erro };
      cliente.requestAccessToken({ prompt: consentir ? "consent" : "" });
    });
  }

  // ---------------------------------------------------------------------
  // Calendar API
  // ---------------------------------------------------------------------
  function api(token, metodo, caminho, corpo) {
    return fetch(API + caminho, { method: metodo, headers: Object.assign({ Authorization: "Bearer " + token }, corpo ? { "Content-Type": "application/json" } : {}), body: corpo ? JSON.stringify(corpo) : undefined })
      .catch(() => { throw Object.assign(new Error(navigator.onLine ? "Não consegui falar com o Google Agenda." : "Sem internet agora."), { tipo: "rede" }); })
      .then((r) => {
        if (r.status === 204) return null;
        return r.json().catch(() => null).then((j) => {
          if (r.ok) return j;
          const e = new Error(r.status === 401 ? "O acesso ao Google expirou." : r.status === 403 ? "O Google recusou (permissão ou limite de uso)." : r.status === 404 ? "não encontrado" : "O Google Agenda respondeu com erro " + r.status + ".");
          e.status = r.status; throw e;
        });
      });
  }

  // ---------------------------------------------------------------------
  // eventos: o app diz o que deve estar na agenda (desejados), cada um como
  // { chave, titulo, data, hora, duracao, alertas: [min antes], descricao, cor }
  // ---------------------------------------------------------------------
  function somarMin(data, h, min) {
    const [y, m, d] = data.split("-").map(Number), [hh, mm] = h.split(":").map(Number);
    const x = new Date(y, m - 1, d, hh, mm + min);
    const iso = x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
    return iso + "T" + String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0") + ":00";
  }
  function corpoEvento(x) {
    const tz = fuso();
    const e = {
      summary: x.titulo,
      description: (x.descricao ? x.descricao + "\n\n" : "") + "Criado pelo Finanças. Para mudar, altere no sistema.",
      start: { dateTime: x.data + "T" + x.hora + ":00", timeZone: tz },
      end: { dateTime: somarMin(x.data, x.hora, x.duracao || 30), timeZone: tz },
      reminders: { useDefault: false, overrides: (x.alertas || [0]).map((m) => ({ method: "popup", minutes: m })) },
      transparency: "transparent"
    };
    if (x.rrule) e.recurrence = ["RRULE:" + x.rrule];
    if (x.cor) e.colorId = x.cor;
    return e;
  }
  function estavel(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(estavel).join(",") + "]";
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + estavel(v[k])).join(",") + "}";
  }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function alvo(d) { const c = cfg(d); return app.desejados(d, c.itens).map((x) => ({ chave: x.chave, corpo: corpoEvento(x) })); }
  function hashTudo(d) { const c = cfg(d); return hash(estavel([c.itens, alvo(d)])); }

  // ---------------------------------------------------------------------
  // enviar para a agenda
  // ---------------------------------------------------------------------
  const st = { rodando: false, msg: "", erro: null };
  function avisar() { try { app.aoMudarEstado(st); } catch (e) { /* tela */ } }
  function garantirCalendario(token, d) {
    const c = cfg(d);
    const criar = () => api(token, "POST", "/calendars", { summary: NOME_AGENDA, description: DESCRICAO_AGENDA, timeZone: fuso() })
      .then((cal) => { c.calendarioId = cal.id; app.salvar(d); return cal.id; });
    if (!c.calendarioId) return criar();
    return api(token, "GET", `/calendars/${encodeURIComponent(c.calendarioId)}`).then((cal) => {
      // agenda criada com o nome antigo ("Muller Mendes Finanças"): passa a se chamar "Finanças"
      if (cal && cal.summary !== NOME_AGENDA) return api(token, "PATCH", `/calendars/${encodeURIComponent(c.calendarioId)}`, { summary: NOME_AGENDA, description: DESCRICAO_AGENDA }).catch(() => null).then(() => c.calendarioId);
      return c.calendarioId;
    })
      .catch((e) => { if (e.status === 404) { c.calendarioId = null; return criar(); } throw e; });
  }
  function listar(token, cal) {
    const tudo = [];
    const pagina = (pt) => api(token, "GET", `/calendars/${encodeURIComponent(cal)}/events?maxResults=2500&showDeleted=false&fields=items(id,extendedProperties),nextPageToken${pt ? "&pageToken=" + encodeURIComponent(pt) : ""}`)
      .then((j) => { (j.items || []).forEach((x) => tudo.push(x)); return j.nextPageToken ? pagina(j.nextPageToken) : tudo; });
    return pagina(null);
  }
  function enviar(token) {
    const d = app.dados(), c = cfg(d);
    if (st.rodando) return Promise.resolve();
    st.rodando = true; st.erro = null; avisar();
    const lista = alvo(d);
    const n = { novos: 0, mudados: 0, removidos: 0 };
    return garantirCalendario(token, d).then((cal) => listar(token, cal).then((atuais) => {
      const porChave = {};
      atuais.forEach((e) => { const k = e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.mm; if (k) { if (porChave[k]) porChave[k + "#dup" + e.id] = e; else porChave[k] = e; } else porChave["?" + e.id] = e; });
      const tarefas = [], quer = {};
      lista.forEach((x) => {
        const h = hash(estavel(x.corpo));
        quer[x.chave] = true;
        const corpo = Object.assign({}, x.corpo, { extendedProperties: { private: { mm: x.chave, h } } });
        const e = porChave[x.chave];
        if (!e) { n.novos++; tarefas.push(() => api(token, "POST", `/calendars/${encodeURIComponent(cal)}/events`, corpo)); }
        else if (e.extendedProperties.private.h !== h) { n.mudados++; tarefas.push(() => api(token, "PUT", `/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(e.id)}`, corpo)); }
      });
      Object.keys(porChave).forEach((k) => {
        if (quer[k]) return;
        n.removidos++;
        tarefas.push(() => api(token, "DELETE", `/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(porChave[k].id)}`).catch((e) => { if (e.status !== 404 && e.status !== 410) throw e; }));
      });
      // poucos de cada vez (o Google limita pedidos por segundo)
      const rodar = (i) => i >= tarefas.length ? Promise.resolve() : Promise.all(tarefas.slice(i, i + 4).map((f) => f())).then(() => rodar(i + 4));
      return rodar(0);
    })).then(() => {
      c.ultimoHash = hashTudo(d); c.ultimaVez = new Date().toISOString(); c.ativa = true;
      // resumo para a tela (vale em todos os aparelhos): quantos eventos e até quando
      c.totalEventos = lista.length;
      c.semFim = lista.some((x) => x.corpo.recurrence);
      c.ate = lista.reduce((m, x) => { const dt = String(x.corpo.start.dateTime || "").slice(0, 10); return dt > m ? dt : m; }, "");
      app.salvar(d);
      st.msg = n.novos + n.mudados + n.removidos ? `${n.novos ? n.novos + " adicionados" : ""}${n.mudados ? (n.novos ? ", " : "") + n.mudados + " atualizados" : ""}${n.removidos ? (n.novos || n.mudados ? ", " : "") + n.removidos + " removidos" : ""}` : "nada mudou";
      return n;
    }).catch((e) => {
      if (e.status === 401) { const s = lerLocal(); delete s.token; delete s.exp; gravarLocal(s); }
      st.erro = e.message; throw e;
    }).finally(() => { st.rodando = false; avisar(); });
  }
  // com token válido: envia sozinho; sem: o app mostra "Atualizar Google Agenda"
  function talvezEnviar() {
    if (!disponivel()) return;
    const d = app.dados(), c = cfg(d);
    if (d.demo) return;   // dados de exemplo não vão para a agenda de verdade
    if (!c.ativa || c.ultimoHash === hashTudo(d)) { avisar(); return; }
    const t = tokenValido();
    if (t) enviar(t).catch(() => {}); else avisar();
  }
  // logo depois de salvar algo (ainda dentro do toque em "Salvar"): se a agenda
  // mudou, envia na hora — renovando o acesso do Google se ele já venceu
  function atualizarJa() {
    if (!disponivel()) return;
    const d = app.dados(), c = cfg(d);
    if (!c.ativa || d.demo || st.rodando || c.ultimoHash === hashTudo(d)) return;
    const t = tokenValido();
    if (t) { enviar(t).catch(() => {}); return; }
    // sem um toque do usuário o navegador bloquearia a janelinha do Google
    const ua = navigator.userActivation;
    if (!gisPronto() || (ua && !ua.isActive)) { avisar(); return; }
    pedirAgora(false).then((tok) => enviar(tok)).catch(() => avisar());
  }
  // deixa o login do Google carregado, para o pedido sair na hora do toque
  function preparar() {
    if (disponivel() && cfg(app.dados()).ativa) carregarGIS().catch(() => {});
  }
  function enviarComToque() {
    const t = tokenValido();
    return (t ? Promise.resolve(t) : pedirToken(false)).then((tok) => enviar(tok));
  }
  function conectar() {
    if (app.dados().demo) return Promise.reject(new Error("Os dados de exemplo não vão para a agenda. Apague o exemplo antes de conectar."));
    return pedirToken(true).then((t) => { const d = app.dados(); cfg(d).ativa = true; app.salvar(d); return enviar(t); });
  }
  function desconectar() {
    const d = app.dados(), c = cfg(d), cal = c.calendarioId;
    const tok = tokenValido();
    return (tok ? Promise.resolve(tok) : pedirToken(false)).then((t) => (cal ? api(t, "DELETE", `/calendars/${encodeURIComponent(cal)}`).catch(() => {}) : null).then(() => {
      try { global.google.accounts.oauth2.revoke(t, () => {}); } catch (e) { /* ignora */ }
    })).catch(() => {}).then(() => {
      Object.assign(c, { ativa: false, calendarioId: null, ultimoHash: null, ultimaVez: null });
      gravarLocal({}); app.salvar(d); avisar();
    });
  }
  // há mudanças que ainda não foram para a agenda
  // a agenda é da conta (config.agenda sincroniza): qualquer aparelho pode atualizá-la
  function pendente(d) { d = d || app.dados(); const c = cfg(d); return c.ativa && !d.demo && c.ultimoHash !== hashTudo(d); }
  function precisaToque(d) { return disponivel() && pendente(d) && !tokenValido() && !st.rodando; }
  function definirItem(k, ligado) { const d = app.dados(); cfg(d).itens[k] = !!ligado; app.salvar(d); }

  global.Agenda = { configurar, atualizarJa, preparar, disponivel, conectadoAqui, cfg, conectar, desconectar, enviarComToque, talvezEnviar, pendente, precisaToque, definirItem, estado: st };
})(window);
