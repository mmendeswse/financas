/**
 * sincronizacao.js
 * -----------------------------------------------------------------------
 * Conta de sincronização entre aparelhos (computador, iPad, celular),
 * no mesmo modelo do Meu Controle — mas guardada num Gist PRIVADO do
 * GitHub, então basta a chave (token) do GitHub: não é preciso criar
 * repositório nenhum.
 *
 *  - Cada conta é um Gist com o arquivo muller-mendes-conta.json, com os
 *    dados CRIPTOGRAFADOS (AES-GCM 256, compactados com gzip). Quem abrir
 *    o Gist só enxerga texto embaralhado.
 *  - O "código da conta" (texto e QR code) leva o id do Gist, a chave do
 *    GitHub e a chave da criptografia. Funciona como uma senha: quem tem o
 *    código lê e altera os dados. Os outros aparelhos entram com ele.
 *  - Mudanças feitas em dois aparelhos ao mesmo tempo são JUNTADAS
 *    registro a registro (cada aparelho guarda a "base" da última
 *    sincronização para saber o que mudou de cada lado).
 *  - A lista de aparelhos fica dentro do arquivo criptografado; um
 *    aparelho removido se desconecta (e pode apagar os dados) ao
 *    sincronizar.
 *  - Cada envio é uma revisão do Gist: o histórico guarda as versões.
 *
 * Este arquivo não desenha telas: o app (app.js) chama as funções daqui e
 * recebe o estado por configurar({ ... }).
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var API = "https://api.github.com";
  var ARQUIVO = "muller-mendes-conta.json";
  var DESCRICAO = "Finanças — conta criptografada (não apague)";
  var ARQUIVO_ANTIGO = "muller-mendes-dados.json";   // cofre sem criptografia (versões até 3.6.398)
  var CHAVE = "mullerMendes:sync";
  var BANCO = "muller-mendes-sync";
  var PREFIXO = "MF1.";
  var VISTO_A_CADA = 6 * 3600e3;   // atualiza "visto por último" sem gravar a cada minuto

  // ganchos do app
  var app = {
    dados: function () { return {}; },
    aplicar: function () {},
    versao: "",
    aoEstado: function () {},
    temDados: function () { return false; },
    ocupado: function () { return false; }
  };
  function configurar(o) { Object.keys(o || {}).forEach(function (k) { app[k] = o[k]; }); }

  // ---------------------------------------------------------------------
  // estado deste aparelho (fica fora dos dados: não vai para o backup)
  // ---------------------------------------------------------------------
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function gravar(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) { /* sem espaço */ } }
  function conectado() { var s = ler(); return !!(s.t && s.k && s.g); }
  function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // base da última sincronização (IndexedDB: pode ser grande)
  var bancoP = null;
  function banco() {
    if (bancoP) return bancoP;
    bancoP = new Promise(function (ok, erro) {
      if (!global.indexedDB) { erro(new Error("sem IndexedDB")); return; }
      var r = indexedDB.open(BANCO, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("base"); };
      r.onsuccess = function () { var db = r.result; db.onclose = function () { bancoP = null; }; db.onversionchange = function () { db.close(); bancoP = null; }; ok(db); };
      r.onerror = function () { bancoP = null; erro(r.error); };
    });
    return bancoP;
  }
  function lerBase() {
    return banco().then(function (db) {
      return new Promise(function (ok) {
        var r = db.transaction("base").objectStore("base").get("base");
        r.onsuccess = function () { ok(r.result || null); }; r.onerror = function () { ok(null); };
      });
    }).catch(function () { try { return JSON.parse(localStorage.getItem(CHAVE + ":base")); } catch (e) { return null; } });
  }
  function gravarBase(b) {
    return banco().then(function (db) {
      return new Promise(function (ok) {
        var t = db.transaction("base", "readwrite");
        if (b) t.objectStore("base").put(b, "base"); else t.objectStore("base").delete("base");
        t.oncomplete = t.onerror = function () { ok(); };
      });
    }).catch(function () { try { if (b) localStorage.setItem(CHAVE + ":base", JSON.stringify(b)); else localStorage.removeItem(CHAVE + ":base"); } catch (e) { /* ignora */ } });
  }

  // ---------------------------------------------------------------------
  // código da conta
  // ---------------------------------------------------------------------
  function b64url(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function deB64url(s) { return decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)))); }
  function codigoDe(s) { s = s || ler(); return PREFIXO + b64url(JSON.stringify({ g: s.g, t: s.t, k: s.k })); }
  function lerCodigo(txt) {
    var m = String(txt || "").replace(/\s+/g, "").match(/MF1\.[A-Za-z0-9_-]+/);
    if (!m) return null;
    try {
      var j = JSON.parse(deB64url(m[0].slice(PREFIXO.length)));
      return j && j.g && j.t && j.k ? j : null;
    } catch (e) { return null; }
  }
  function linkDe(s) { return location.href.split("#")[0].split("?")[0] + "#sync=" + codigoDe(s); }

  // ---------------------------------------------------------------------
  // criptografia (AES-GCM 256) + compactação
  // ---------------------------------------------------------------------
  function bytesB64(bytes) { var s = "", T = 0x8000; for (var i = 0; i < bytes.length; i += T) s += String.fromCharCode.apply(null, bytes.subarray(i, i + T)); return btoa(s); }
  function b64Bytes(b) { var s = atob(b), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function novaChave() { var a = new Uint8Array(32); crypto.getRandomValues(a); return bytesB64(a).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function importar(k) { return crypto.subtle.importKey("raw", b64Bytes(k.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((k.length + 3) % 4)), "AES-GCM", false, ["encrypt", "decrypt"]); }
  function passar(bytes, stream) { return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function temGzip() { return typeof global.CompressionStream === "function" && typeof global.DecompressionStream === "function"; }
  function cifrar(obj, k) {
    var json = new TextEncoder().encode(JSON.stringify(obj));
    var z = temGzip();
    var iv = new Uint8Array(12); crypto.getRandomValues(iv);
    return (z ? passar(json, new CompressionStream("gzip")) : Promise.resolve(json))
      .then(function (dados) { return importar(k).then(function (ch) { return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, ch, dados); }); })
      .then(function (c) { return { app: "muller-mendes", v: 1, z: z, iv: bytesB64(iv), c: bytesB64(new Uint8Array(c)) }; });
  }
  function decifrar(env, k) {
    if (!env || env.app !== "muller-mendes" || !env.c) return Promise.reject(Object.assign(new Error("arquivo inválido"), { tipo: "chave" }));
    return importar(k).then(function (ch) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64Bytes(env.iv) }, ch, b64Bytes(env.c)); })
      .catch(function () { throw Object.assign(new Error("chave"), { tipo: "chave" }); })
      .then(function (b) { return env.z ? passar(new Uint8Array(b), new DecompressionStream("gzip")) : new Uint8Array(b); })
      .then(function (b) { return JSON.parse(new TextDecoder().decode(b)); });
  }

  // ---------------------------------------------------------------------
  // GitHub (Gists)
  // ---------------------------------------------------------------------
  function erroGH(status, j) {
    var msg = status === 401 ? "A chave do GitHub venceu ou foi apagada. Atualize a chave em Configurações → Sincronização."
      : status === 403 ? ((j && /rate limit/i.test(j.message || "")) ? "O GitHub pediu uma pausa (muitos pedidos). Tento de novo daqui a pouco." : "A chave do GitHub não tem permissão para Gists (marque a permissão gist).")
      : status === 404 ? "Não encontrei a conta no GitHub (o código pode ter sido trocado, ou a chave não tem permissão para Gists)."
      : "O GitHub respondeu com erro " + status + ".";
    return Object.assign(new Error(msg), { status: status, tipo: status === 401 ? "token" : status === 404 ? "sumiu" : "gh" });
  }
  function gh(t, metodo, caminho, corpo) {
    return fetch(API + caminho, {
      method: metodo, cache: "no-store",
      headers: Object.assign({ Authorization: "Bearer " + t, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, corpo ? { "Content-Type": "application/json" } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined
    }).then(function (r) {
      var exp = r.headers.get("github-authentication-token-expiration");
      if (exp) { var st = ler(); if (st.t === t && st.expira !== exp) { st.expira = exp; gravar(st); } }
      return r.json().catch(function () { return null; }).then(function (j) { return { status: r.status, j: j }; });
    }).catch(function (e) {
      throw Object.assign(new Error(navigator.onLine === false ? "Sem internet — sincronizo quando a conexão voltar." : "Não consegui falar com o GitHub."), { tipo: "rede", causa: e });
    });
  }
  // conteúdo de um arquivo do Gist (os grandes vêm à parte, pelo raw_url)
  function conteudo(f) {
    if (!f) return Promise.resolve(null);
    if (f.truncated && f.raw_url) return fetch(f.raw_url, { cache: "no-store" }).then(function (r) { return r.text(); });
    return Promise.resolve(f.content);
  }
  // lê o arquivo da conta; devolve { versao, env } ou null se a conta não existe mais
  function lerConta(s, versao) {
    return gh(s.t, "GET", "/gists/" + encodeURIComponent(s.g) + (versao ? "/" + versao : "")).then(function (r) {
      if (r.status === 404) return null;
      if (r.status !== 200 || !r.j) throw erroGH(r.status, r.j);
      var f = r.j.files && r.j.files[ARQUIVO];
      if (!f) return null;
      var v = r.j.history && r.j.history[0] ? r.j.history[0].version : (r.j.updated_at || "");
      return conteudo(f).then(function (txt) {
        var env; try { env = JSON.parse(txt); } catch (e) { throw Object.assign(new Error("O arquivo da conta está corrompido."), { tipo: "gh" }); }
        return { versao: v, env: env };
      });
    });
  }
  // grava; devolve { versao, anterior } (anterior = versão que ficou logo antes desta)
  function gravarConta(s, env) {
    var corpo = { files: {} };
    corpo.files[ARQUIVO] = { content: JSON.stringify(env) };
    return gh(s.t, "PATCH", "/gists/" + encodeURIComponent(s.g), corpo).then(function (r) {
      if (r.status !== 200 || !r.j) throw erroGH(r.status, r.j);
      var h = r.j.history || [];
      return { versao: h[0] ? h[0].version : "", anterior: h[1] ? h[1].version : "" };
    });
  }
  function criarGist(t, env) {
    var corpo = { description: DESCRICAO, public: false, files: {} };
    corpo.files[ARQUIVO] = { content: JSON.stringify(env) };
    return gh(t, "POST", "/gists", corpo).then(function (r) {
      if (r.status !== 201 || !r.j) throw erroGH(r.status === 404 ? 403 : r.status, r.j);
      return { g: r.j.id, versao: r.j.history && r.j.history[0] ? r.j.history[0].version : "" };
    });
  }
  function apagarGist(t, g) {
    return gh(t, "DELETE", "/gists/" + encodeURIComponent(g)).then(function (r) {
      if (r.status !== 204 && r.status !== 404) throw erroGH(r.status, r.j);
    });
  }
  // confere a chave; devolve o login
  function conferirChave(t) {
    return gh(t, "GET", "/user").then(function (r) {
      if (r.status === 401) throw new Error("O GitHub não aceitou essa chave. Confira se copiou inteira e se ela não foi apagada.");
      if (r.status !== 200 || !r.j) throw erroGH(r.status, r.j);
      return r.j.login;
    });
  }
  // contas já criadas com esta chave (para não criar duas sem querer)
  function contasExistentes(t) {
    return gh(t, "GET", "/gists?per_page=100").then(function (r) {
      if (r.status !== 200) throw erroGH(r.status, r.j);
      return (r.j || []).filter(function (g) { return g.files && g.files[ARQUIVO]; }).map(function (g) { return g.id; });
    });
  }

  // ---------------------------------------------------------------------
  // junção de alterações (três vias: base × este aparelho × nuvem)
  // ---------------------------------------------------------------------
  function estavel(v) {
    if (v === undefined) return "u";
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(estavel).join(",") + "]";
    return "{" + Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort().map(function (k) { return JSON.stringify(k) + ":" + estavel(v[k]); }).join(",") + "}";
  }
  function igual(a, b) { return a === b || estavel(a) === estavel(b); }
  function ehObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function listaComId(v) { return Array.isArray(v) && v.every(function (x) { return x && typeof x === "object" && x.id != null; }); }
  function juntarLista(b, l, r) {
    function mapa(lista) { var m = new Map(); (lista || []).forEach(function (x) { m.set(String(x.id), x); }); return m; }
    var mb = mapa(b), ml = mapa(l), mr = mapa(r);
    var ordem = (r || []).map(function (x) { return String(x.id); }).concat((l || []).map(function (x) { return String(x.id); }).filter(function (id) { return !mr.has(id); }));
    var vistos = new Set(), saida = [];
    ordem.forEach(function (id) {
      if (vistos.has(id)) return; vistos.add(id);
      var x = juntar(mb.get(id), ml.get(id), mr.get(id));
      if (x !== undefined) saida.push(x);
    });
    return saida;
  }
  function juntar(b, l, r) {
    if (igual(l, r)) return l;
    if (igual(l, b)) return r;          // só a nuvem mudou (ou apagou)
    if (igual(r, b)) return l;          // só este aparelho mudou (ou apagou)
    if (l === undefined) return r;      // apagado aqui, editado lá: não perde a edição
    if (r === undefined) return l;
    if (ehObj(l) && ehObj(r)) {
      var o = {};
      new Set(Object.keys(l).concat(Object.keys(r))).forEach(function (k) { var v = juntar(ehObj(b) ? b[k] : undefined, l[k], r[k]); if (v !== undefined) o[k] = v; });
      return o;
    }
    if (Array.isArray(l) && Array.isArray(r) && listaComId(l) && listaComId(r)) return juntarLista(listaComId(b) ? b : [], l, r);
    return l; // mesmo campo mudou nos dois: vale o deste aparelho
  }

  // o que vai para a nuvem (sem o que é só deste aparelho)
  function paraNuvem(d) {
    var c = JSON.parse(JSON.stringify(d || {}));
    delete c.atualizadoEm; delete c.alteradoPor; delete c.demo;
    if (c.config) { delete c.config.sync; delete c.config.ultimoBackup; }
    return c;
  }

  // ---------------------------------------------------------------------
  // aparelho
  // ---------------------------------------------------------------------
  function idAparelho() { var s = ler(); if (!s.disp) { s.disp = novoId(); gravar(s); } return s.disp; }
  function nomePadrao() {
    var ua = navigator.userAgent;
    if (global.bancoDados && global.bancoDados.ehDesktop) return "Programa Windows";
    var so = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Celular Android" : "Tablet Android") : /Windows/.test(ua) ? "PC Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Computador Linux" : "Aparelho";
    var nav = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
    return so + (nav && !/iPhone|iPad/.test(so) ? " · " + nav : "");
  }
  function nomeAparelho() { return ler().nome || nomePadrao(); }
  function registro(s) { return { nome: s.nome || nomePadrao(), visto: new Date().toISOString(), versao: app.versao }; }

  // ---------------------------------------------------------------------
  // ciclo de sincronização
  // ---------------------------------------------------------------------
  var st = { rodando: false, denovo: false, timer: null, estado: "parado", msg: "", aparelhos: null, baixou: false };
  function avisar() { try { app.aoEstado(st); } catch (e) { /* tela */ } }
  function agendar(ms) {
    if (!conectado()) return;
    clearTimeout(st.timer);
    st.timer = setTimeout(function () { sincronizar(); }, ms == null ? 3000 : ms);
  }
  var aplicando = false;
  function aplicar(junto, salvoEm, por) {
    aplicando = true;
    try { app.aplicar(JSON.parse(JSON.stringify(junto)), salvoEm, por); } finally { aplicando = false; }
  }

  // opc.forcarEnvio: grava mesmo sem mudanças (ex.: registrar este aparelho)
  // opc.agora: não espera um formulário aberto fechar
  function sincronizar(opc) {
    opc = opc || {};
    if (!conectado()) return Promise.resolve();
    if (st.rodando) { st.denovo = true; return Promise.resolve(); }
    // não troca os dados por baixo de um formulário aberto: tenta daqui a pouco
    if (!opc.agora && app.ocupado()) { agendar(5000); return Promise.resolve(); }
    // dados de exemplo nunca vão para a conta
    if (app.dados().demo) { st.estado = "demo"; avisar(); return Promise.resolve(); }
    st.rodando = true; st.estado = "sincronizando"; avisar();
    var s = ler();
    function fim(estado, msg) {
      st.rodando = false; st.estado = estado; st.msg = msg || "";
      s = ler(); s.erro = estado === "erro" ? msg : null; if (estado === "ok") s.ultimo = new Date().toISOString(); gravar(s);
      avisar();
      if (st.denovo) { st.denovo = false; agendar(1200); }
    }
    return Promise.all([lerBase(), lerConta(s)]).then(function (res) {
      var base = res[0], remoto = res[1];
      if (!remoto) {
        if (base && !opc.criar) throw Object.assign(new Error("Esta conta não existe mais (o código foi trocado em outro aparelho). Entre com o código novo."), { tipo: "sumiu" });
        return { base: base, remoto: null, nuvem: null };
      }
      return decifrar(remoto.env, s.k).then(function (nuvem) { return { base: base, remoto: remoto, nuvem: nuvem }; });
    }).then(function (x) { return juntarEGravar(s, x.base, x.remoto, x.nuvem, opc, 0); })
      .then(function () { st.baixou = true; fim("ok"); })
      .catch(function (e) {
        if (e.tipo === "removido") return;
        fim(e.tipo === "rede" ? "offline" : "erro", e.tipo === "chave" ? "O código desta conta mudou em outro aparelho. Entre com o código novo." : e.message);
      });
  }

  function juntarEGravar(s, base, remoto, nuvem, opc, volta) {
    var eu = idAparelho();
    var aparelhos = Object.assign({}, nuvem && nuvem.aparelhos);
    // este aparelho foi removido em outro
    if (aparelhos[eu] && aparelhos[eu].removido) { desconectado(aparelhos[eu].apagar); throw Object.assign(new Error("removido"), { tipo: "removido" }); }
    // chave do GitHub renovada em outro aparelho
    if (nuvem && nuvem.acesso && nuvem.acesso.t && nuvem.acesso.t !== s.t) { s.t = nuvem.acesso.t; delete s.expira; gravar(s); }
    var local = paraNuvem(app.dados());
    var junto;
    if (!nuvem) junto = local;
    else if (base && remoto && base.versao === remoto.versao) junto = local;   // a nuvem não mudou desde a última vez
    else junto = juntar(base ? base.dados : undefined, local, nuvem.dados);
    if (!igual(junto, local)) aplicar(junto, nuvem && nuvem.salvoEm, nuvem && nuvem.porNome);
    var meu = aparelhos[eu];
    var vencido = !meu || !meu.visto || Date.now() - new Date(meu.visto).getTime() > VISTO_A_CADA || meu.nome !== nomeAparelho() || meu.versao !== app.versao;
    var mudou = !nuvem || !igual(junto, nuvem.dados);
    if (!mudou && !vencido && !opc.forcarEnvio) {
      st.aparelhos = aparelhos;
      return gravarBase({ versao: remoto.versao, dados: junto });
    }
    aparelhos[eu] = Object.assign({}, meu, registro(s));
    // aparelhos removidos há mais de 60 dias saem da lista
    Object.keys(aparelhos).forEach(function (id) { var a = aparelhos[id]; if (a && a.removido && a.removidoEm && Date.now() - Date.parse(a.removidoEm) > 60 * 864e5) delete aparelhos[id]; });
    var pacote = { dados: junto, aparelhos: aparelhos, acesso: { t: s.t }, salvoEm: new Date().toISOString(), por: eu, porNome: nomeAparelho() };
    return cifrar(pacote, s.k).then(function (env) { return gravarConta(s, env); }).then(function (g) {
      st.aparelhos = aparelhos;
      // outro aparelho gravou entre a leitura e esta gravação: a versão dele
      // ficou logo antes da nossa. Junta o que ele mudou e grava de novo.
      if (remoto && g.anterior && g.anterior !== remoto.versao && volta < 3) {
        return lerConta(s, g.anterior).then(function (outro) {
          if (!outro) return gravarBase({ versao: g.versao, dados: junto });
          return decifrar(outro.env, s.k).then(function (n2) {
            var juntoDeNovo = juntar(nuvem ? nuvem.dados : undefined, junto, n2.dados);
            if (igual(juntoDeNovo, junto)) return gravarBase({ versao: g.versao, dados: junto });
            var ap2 = Object.assign({}, n2.aparelhos, aparelhos);
            return juntarEGravar(s, { versao: "", dados: junto }, { versao: g.versao }, { dados: juntoDeNovo, aparelhos: ap2, acesso: { t: s.t }, salvoEm: n2.salvoEm, porNome: n2.porNome }, { forcarEnvio: true }, volta + 1);
          });
        });
      }
      return gravarBase({ versao: g.versao, dados: junto });
    });
  }

  // altera a lista de aparelhos direto na nuvem (remover, desconectar)
  function alterarNuvem(fn) {
    var s = ler();
    return lerConta(s).then(function (remoto) {
      if (!remoto) throw new Error("A conta não foi encontrada.");
      return decifrar(remoto.env, s.k).then(function (nuvem) {
        fn(nuvem);
        return cifrar(nuvem, s.k).then(function (env) { return gravarConta(s, env); }).then(function () { st.aparelhos = nuvem.aparelhos; avisar(); });
      });
    });
  }

  function limparLocal() {
    var s = ler();
    gravar({ disp: s.disp, nome: s.nome });
    st.aparelhos = null; st.estado = "parado"; st.msg = "";
    avisar();
    return gravarBase(null);
  }
  function desconectado(apagar) {
    limparLocal().then(function () {
      if (app.aoRemovido) app.aoRemovido(!!apagar);
    });
  }
  function sair() {
    var eu = idAparelho();
    return alterarNuvem(function (n) { if (n.aparelhos) delete n.aparelhos[eu]; }).catch(function () {}).then(limparLocal);
  }
  function removerAparelho(id, apagar) {
    return alterarNuvem(function (n) {
      n.aparelhos = n.aparelhos || {};
      n.aparelhos[id] = Object.assign({}, n.aparelhos[id], { removido: true, apagar: !!apagar, removidoEm: new Date().toISOString() });
    });
  }
  function renomear(nome) {
    var s = ler(); s.nome = String(nome || "").trim().slice(0, 40) || nomePadrao(); gravar(s);
    return sincronizar({ agora: true, forcarEnvio: true });
  }

  // ---------------------------------------------------------------------
  // criar conta / entrar com código
  // ---------------------------------------------------------------------
  // opc.mesmoAssim: cria mesmo que já exista outra conta com esta chave
  function criarConta(token, nome, opc) {
    token = String(token || "").trim(); opc = opc || {};
    if (app.dados().demo) return Promise.reject(new Error("Os dados de exemplo não vão para a conta. Apague o exemplo (na faixa amarela do Dashboard) e crie a conta depois — ou, se já usa em outro aparelho, toque em Entrar com código."));
    return conferirChave(token).then(function (login) {
      return (opc.mesmoAssim ? Promise.resolve([]) : contasExistentes(token)).then(function (ids) {
        if (ids.length) throw Object.assign(new Error("Já existe uma conta de sincronização nesta chave do GitHub."), { tipo: "existe", ids: ids });
        var s = ler();
        var k = novaChave(), eu = idAparelho();
        var nomeAp = String(nome || "").trim() || s.nome || nomePadrao();
        var dados = paraNuvem(app.dados());
        var pacote = { dados: dados, aparelhos: {}, acesso: { t: token }, salvoEm: new Date().toISOString(), por: eu, porNome: nomeAp };
        pacote.aparelhos[eu] = { nome: nomeAp, visto: pacote.salvoEm, versao: app.versao };
        return cifrar(pacote, k).then(function (env) { return criarGist(token, env); }).then(function (g) {
          gravar(Object.assign(ler(), { g: g.g, t: token, k: k, nome: nomeAp, login: login, erro: null, ultimo: new Date().toISOString() }));
          st.aparelhos = pacote.aparelhos; st.estado = "ok"; st.baixou = true; avisar();
          return gravarBase({ versao: g.versao, dados: dados }).then(function () { return { login: login }; });
        });
      });
    });
  }
  // modo: "juntar" (une os dados deste aparelho com os da conta) ou "conta" (fica só com os da conta)
  function entrar(codigo, modo, nome) {
    var c = lerCodigo(codigo);
    if (!c) return Promise.reject(new Error("Código inválido. Confira se copiou inteiro (começa com MF1.)."));
    return lerConta(c).then(function (remoto) {
      if (!remoto) throw new Error("Não encontrei esta conta. O código pode ter sido trocado.");
      return decifrar(remoto.env, c.k).catch(function () { throw new Error("Este código não abre a conta (foi trocado?)."); }).then(function (nuvem) {
        var s = ler();
        Object.assign(s, { g: c.g, t: (nuvem.acesso && nuvem.acesso.t) || c.t, k: c.k, nome: String(nome || "").trim() || s.nome || nomePadrao(), erro: null });
        gravar(s);
        // aparelho novo (sem registros) ou com o exemplo: fica com tudo da conta
        var d = app.dados();
        if (modo === "conta" || d.demo || !app.temDados(d)) { aplicar(nuvem.dados, nuvem.salvoEm, nuvem.porNome); return gravarBase({ versao: remoto.versao, dados: nuvem.dados }); }
        return gravarBase(null); // sem base: junta tudo (nada se perde)
      });
    }).then(function () { return sincronizar({ agora: true, forcarEnvio: true }); }).then(function () {
      if (st.estado === "erro") { var m = st.msg; limparLocal(); throw new Error(m); }
    });
  }
  // gera chave e Gist novos: os outros aparelhos (inclusive um roubado) deixam de acessar
  function trocarCodigo(tokenNovo) {
    var antigo = Object.assign({}, ler());
    var nuvemAtual = null;
    tokenNovo = tokenNovo ? String(tokenNovo).trim() : "";
    return lerConta(antigo).then(function (remoto) {
      if (!remoto) return null;
      return decifrar(remoto.env, antigo.k).then(function (n) { nuvemAtual = n; });
    }).then(function () { return tokenNovo ? conferirChave(tokenNovo) : null; }).then(function () {
      var t = tokenNovo || antigo.t, k = novaChave(), eu = idAparelho();
      var pacote = { dados: paraNuvem(app.dados()), aparelhos: {}, acesso: { t: t }, salvoEm: new Date().toISOString(), por: eu, porNome: nomeAparelho() };
      if (nuvemAtual) pacote.dados = juntar(undefined, pacote.dados, nuvemAtual.dados);
      pacote.aparelhos[eu] = registro(antigo);
      return cifrar(pacote, k).then(function (env) { return criarGist(t, env); }).then(function (g) {
        gravar(Object.assign(ler(), { g: g.g, t: t, k: k, erro: null, ultimo: new Date().toISOString() }));
        return gravarBase({ versao: g.versao, dados: pacote.dados });
      }).then(function () { return apagarGist(antigo.t, antigo.g).catch(function () {}); })
        .then(function () { st.aparelhos = pacote.aparelhos; st.estado = "ok"; avisar(); });
    });
  }
  // renova a chave do GitHub (antes de vencer): os outros aparelhos recebem sozinhos
  function atualizarToken(token) {
    token = String(token || "").trim();
    var s = ler();
    return conferirChave(token).then(function () {
      return gh(token, "GET", "/gists/" + encodeURIComponent(s.g)).then(function (r) {
        if (r.status !== 200) throw new Error("Esta chave não consegue abrir a conta: ela precisa ser da mesma conta do GitHub e ter a permissão gist.");
      });
    }).then(function () {
      s.t = token; delete s.expira; s.erro = null; gravar(s);
      return sincronizar({ agora: true, forcarEnvio: true });
    });
  }

  // ---------------------------------------------------------------------
  // versões antigas: cofre SEM criptografia (token + id do Gist salvos nos
  // dados). O primeiro aparelho atualizado transforma o cofre na conta
  // criptografada; os outros precisam do código da conta.
  // ---------------------------------------------------------------------
  function migrarAntigo(token, gistId) {
    return gh(token, "GET", "/gists/" + encodeURIComponent(gistId)).then(function (r) {
      if (r.status === 404) return { estado: "sem-cofre" };
      if (r.status !== 200 || !r.j) throw erroGH(r.status, r.j);
      var arqs = r.j.files || {};
      if (arqs[ARQUIVO]) return { estado: "precisa-codigo" };   // outro aparelho já migrou
      var f = arqs[ARQUIVO_ANTIGO];
      if (!f) return { estado: "sem-cofre" };
      return conteudo(f).then(function (txt) {
        var antigos = null; try { antigos = JSON.parse(txt); } catch (e) { /* vazio */ }
        if (antigos && antigos.migrado) return { estado: "precisa-codigo" };
        var s = ler(), k = novaChave(), eu = idAparelho();
        var local = paraNuvem(app.dados());
        // fica com a versão mais nova (como o sistema antigo fazia) e junta o resto
        var maisNovoRemoto = antigos && antigos.atualizadoEm && antigos.atualizadoEm > (app.dados().atualizadoEm || "");
        var dados = antigos ? (maisNovoRemoto ? juntar(undefined, paraNuvem(antigos), local) : juntar(undefined, local, paraNuvem(antigos))) : local;
        var pacote = { dados: dados, aparelhos: {}, acesso: { t: token }, salvoEm: new Date().toISOString(), por: eu, porNome: nomeAparelho() };
        pacote.aparelhos[eu] = registro(s);
        return cifrar(pacote, k).then(function (env) {
          var corpo = { description: DESCRICAO, files: {} };
          corpo.files[ARQUIVO] = { content: JSON.stringify(env) };
          // o arquivo sem criptografia vira só um aviso para as versões antigas
          corpo.files[ARQUIVO_ANTIGO] = { content: JSON.stringify({ migrado: true, aviso: "Os dados agora ficam criptografados em " + ARQUIVO + ". Entre com o código da conta." }) };
          return gh(token, "PATCH", "/gists/" + encodeURIComponent(gistId), corpo);
        }).then(function (r2) {
          if (r2.status !== 200 || !r2.j) throw erroGH(r2.status, r2.j);
          var v = r2.j.history && r2.j.history[0] ? r2.j.history[0].version : "";
          gravar(Object.assign(ler(), { g: gistId, t: token, k: k, nome: s.nome || nomePadrao(), erro: null, ultimo: new Date().toISOString() }));
          if (!igual(dados, local)) aplicar(dados);
          st.aparelhos = pacote.aparelhos; st.estado = "ok"; st.baixou = true; avisar();
          return gravarBase({ versao: v, dados: dados }).then(function () { return { estado: "migrado" }; });
        });
      });
    });
  }

  // ---------------------------------------------------------------------
  // QR code (gerar e ler)
  // ---------------------------------------------------------------------
  var scripts = {};
  function carregarScript(src) {
    if (!scripts[src]) scripts[src] = new Promise(function (ok, erro) { var t = document.createElement("script"); t.src = src; t.onload = ok; t.onerror = function () { delete scripts[src]; erro(new Error("não carregou")); }; document.head.appendChild(t); });
    return scripts[src];
  }
  function qrSVG(texto) {
    return carregarScript("js/vendor/qrcode.js").then(function () {
      var q = global.qrcode(0, "L"); q.addData(texto); q.make();
      return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
    });
  }
  var leitor = null;
  function pararLeitor() { if (leitor) { leitor.parar = true; if (leitor.stream) leitor.stream.getTracks().forEach(function (t) { t.stop(); }); leitor = null; } }
  function lerQR(video, aoLer) {
    pararLeitor();
    var l = leitor = { parar: false, stream: null };
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }).then(function (stream) {
      l.stream = stream; video.srcObject = stream; video.setAttribute("playsinline", ""); video.muted = true;
      return video.play();
    }).then(function () {
      var nativo = "BarcodeDetector" in global;
      var det = nativo ? new global.BarcodeDetector({ formats: ["qr_code"] }) : null;
      return (nativo ? Promise.resolve() : carregarScript("js/vendor/jsQR.js")).then(function () {
        var cv = document.createElement("canvas"), g = cv.getContext("2d", { willReadFrequently: true });
        function passo() {
          if (l.parar) return;
          if (video.readyState < 2) { setTimeout(passo, 200); return; }
          var tentar = det ? det.detect(video).then(function (r) { return r[0] && r[0].rawValue; }) : Promise.resolve().then(function () {
            var w = Math.min(640, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
            cv.width = w; cv.height = h; g.drawImage(video, 0, 0, w, h);
            var r = global.jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            return r && r.data;
          });
          tentar.then(function (txt) { if (l.parar) return; if (txt && lerCodigo(txt)) { pararLeitor(); aoLer(txt); } else setTimeout(passo, 250); }).catch(function () { setTimeout(passo, 400); });
        }
        passo();
      });
    });
  }

  function diasParaVencer() {
    var s = ler();
    if (!s.expira) return null;
    var t = Date.parse(String(s.expira).replace(" UTC", "Z").replace(" ", "T"));
    return isNaN(t) ? null : Math.floor((t - Date.now()) / 864e5);
  }

  global.Sincronizacao = {
    configurar: configurar, conectado: conectado, ler: ler, estado: st,
    sincronizar: sincronizar, agendar: agendar, aplicando: function () { return aplicando; },
    criarConta: criarConta, entrar: entrar, trocarCodigo: trocarCodigo, atualizarToken: atualizarToken,
    sair: sair, removerAparelho: removerAparelho, renomear: renomear, limparLocal: limparLocal,
    migrarAntigo: migrarAntigo,
    codigoDe: codigoDe, lerCodigo: lerCodigo, linkDe: linkDe,
    qrSVG: qrSVG, lerQR: lerQR, pararLeitor: pararLeitor,
    idAparelho: idAparelho, nomePadrao: nomePadrao, nomeAparelho: nomeAparelho, diasParaVencer: diasParaVencer,
    juntar: juntar, cifrar: cifrar, decifrar: decifrar
  };
})(window);
