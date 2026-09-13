/**
 * bloqueio.js
 * -----------------------------------------------------------------------
 * Tela de senha numérica para abrir o sistema.
 *
 * A senha NÃO é guardada: salvamos apenas um resumo (hash SHA-256 com sal
 * aleatório). Ela fica só neste aparelho — não vai para a sincronização,
 * então cada computador/iPad tem a sua.
 *
 * Importante: isto impede o acesso casual de quem pegar o aparelho. Não é
 * criptografia dos dados — quem souber abrir as ferramentas do navegador
 * ainda consegue ver o conteúdo guardado localmente.
 * -----------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var CHAVE = "mullerMendes:acesso";
  var TAM_MIN = 4, TAM_MAX = 8;
  var digitado = "", modo = "entrar", primeira = "", aoDesbloquear = null;

  function ler() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { return null; }
  }
  function gravar(v) {
    try { v ? localStorage.setItem(CHAVE, JSON.stringify(v)) : localStorage.removeItem(CHAVE); } catch (e) {}
  }
  function ativo() { var c = ler(); return !!(c && c.hash); }

  function sal() {
    var a = new Uint8Array(16);
    (global.crypto && global.crypto.getRandomValues) ? global.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.floor(Math.random() * 256); });
    return Array.from(a).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function resumir(senha, salgado) {
    var texto = salgado + ":" + senha;
    if (global.crypto && global.crypto.subtle && global.TextEncoder) {
      return global.crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))
        .then(function (buf) { return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join(""); })
        .catch(function () { return resumoSimples(texto); });
    }
    return Promise.resolve(resumoSimples(texto));
  }
  // usado quando o navegador não oferece SHA-256 (por exemplo, abrindo o
  // arquivo direto do disco); é mais fraco, mas nunca guarda a senha crua
  function resumoSimples(texto) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < texto.length; i++) {
      h1 = ((h1 ^ texto.charCodeAt(i)) * 16777619) >>> 0;
      h2 = ((h2 + texto.charCodeAt(i) * (i + 7)) * 2654435761) >>> 0;
    }
    return "s" + h1.toString(16) + h2.toString(16);
  }

  function definir(senha) {
    var s = sal();
    // guardamos também o tamanho, só para o sistema conferir sozinho assim
    // que o usuário completa os dígitos (sem precisar apertar OK)
    return resumir(senha, s).then(function (h) { gravar({ hash: h, sal: s, tamanho: senha.length, criadaEm: new Date().toISOString() }); return true; });
  }
  function conferir(senha) {
    var c = ler();
    if (!c) return Promise.resolve(true);
    return resumir(senha, c.sal).then(function (h) { return h === c.hash; });
  }
  function remover() { gravar(null); }


  // ---------------------------------------------------------------------
  // BIOMETRIA (Face ID / Touch ID) — usa o WebAuthn do próprio aparelho.
  // Guardamos apenas o identificador da credencial; a digital/rosto nunca
  // sai do iPad e não é acessível pelo sistema. Como não há servidor para
  // conferir a assinatura, isto funciona como uma tranca local, no mesmo
  // nível da senha numérica (que continua valendo como alternativa).
  // ---------------------------------------------------------------------
  var CHAVE_BIO = "mullerMendes:biometria";

  function bytesParaTexto(buf) {
    var b = new Uint8Array(buf), t = "";
    for (var i = 0; i < b.length; i++) t += String.fromCharCode(b[i]);
    return btoa(t);
  }
  function textoParaBytes(txt) {
    var bin = atob(txt), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function lerBio() {
    try { return JSON.parse(localStorage.getItem(CHAVE_BIO) || "null"); } catch (e) { return null; }
  }
  function biometriaAtiva() { var b = lerBio(); return !!(b && b.id); }
  function removerBiometria() { try { localStorage.removeItem(CHAVE_BIO); } catch (e) {} }

  function biometriaDisponivel() {
    if (!global.PublicKeyCredential || !navigator.credentials || !global.isSecureContext) return Promise.resolve(false);
    if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
  }

  function aleatorio(n) {
    var a = new Uint8Array(n);
    (global.crypto && global.crypto.getRandomValues) ? global.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.floor(Math.random() * 256); });
    return a;
  }

  function ativarBiometria() {
    return navigator.credentials.create({
      publicKey: {
        challenge: aleatorio(32),
        rp: { name: "Muller Mendes Finanças", id: location.hostname },
        user: { id: aleatorio(16), name: "usuario", displayName: "Muller Mendes" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60000,
        attestation: "none"
      }
    }).then(function (cred) {
      if (!cred) throw new Error("não foi possível registrar");
      localStorage.setItem(CHAVE_BIO, JSON.stringify({ id: bytesParaTexto(cred.rawId), criadaEm: new Date().toISOString() }));
      return true;
    });
  }

  function pedirBiometria() {
    var b = lerBio();
    if (!b) return Promise.reject(new Error("biometria não configurada"));
    return navigator.credentials.get({
      publicKey: {
        challenge: aleatorio(32),
        allowCredentials: [{ type: "public-key", id: textoParaBytes(b.id), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60000,
        rpId: location.hostname
      }
    }).then(function (r) { if (!r) throw new Error("cancelado"); return true; });
  }

  // ---------------------------------------------------------------------
  // tela
  // ---------------------------------------------------------------------
  function telaHTML() {
    var teclas = [1,2,3,4,5,6,7,8,9,"apagar",0,"ok"].map(function (t) {
      if (t === "apagar") return '<button class="tecla aux" data-tecla="apagar" aria-label="Apagar">⌫</button>';
      if (t === "ok") return '<button class="tecla ok" data-tecla="ok" aria-label="Confirmar">OK</button>';
      return '<button class="tecla" data-tecla="' + t + '">' + t + '</button>';
    }).join("");
    return '<div class="bloqueio-caixa">' +
      '<div class="bloqueio-logo"><svg viewBox="0 0 48 48"><rect x="9" y="27" width="6" height="13" rx="1.5" fill="currentColor"/><rect x="18" y="21" width="6" height="19" rx="1.5" fill="currentColor"/><rect x="27" y="17" width="6" height="23" rx="1.5" fill="currentColor"/><rect x="36" y="11" width="6" height="29" rx="1.5" fill="currentColor"/></svg></div>' +
      '<h2>Muller Mendes</h2>' +
      '<p id="bloqueioTexto">Digite sua senha</p>' +
      '<div class="bolinhas" id="bloqueioBolinhas"></div>' +
      '<div class="teclado">' + teclas + '</div>' +
      '<p class="bloqueio-aviso" id="bloqueioAviso"></p>' +
      (modo === "entrar" && biometriaAtiva() ? '<button class="btn-bio" id="btnBio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c-2 0-3.9.7-5.4 1.9M19.4 7.6A9 9 0 0 0 17 5.1"/><path d="M3.6 10.4A8.6 8.6 0 0 1 12 6.5a8.6 8.6 0 0 1 8.4 3.9"/><path d="M5.6 14.8c.5-1 .8-2.1.8-3.3A5.6 5.6 0 0 1 12 6.5c3.1 0 5.6 2.3 5.6 5v1.8"/><path d="M9 11.2a3 3 0 0 1 6 0v5.2M12 11.5v6.2"/><path d="M17.4 16.6c-.2 1.3-.7 2.5-1.4 3.6M6.8 18.9c.7-1 1.1-2.1 1.2-3.3"/></svg>Desbloquear com digital ou Face ID</button>' : "") +
      '</div>';
  }

  function pintarBolinhas() {
    var el = document.getElementById("bloqueioBolinhas");
    if (!el) return;
    var n = Math.max(TAM_MIN, digitado.length);
    var html = "";
    for (var i = 0; i < n; i++) html += '<i class="' + (i < digitado.length ? "cheia" : "") + '"></i>';
    el.innerHTML = html;
  }

  function avisar(texto, erro) {
    var el = document.getElementById("bloqueioAviso");
    if (!el) return;
    el.textContent = texto || "";
    el.className = "bloqueio-aviso" + (erro ? " erro" : "");
  }

  function tremer() {
    var caixa = document.querySelector(".bloqueio-caixa");
    if (!caixa) return;
    caixa.classList.remove("tremer");
    void caixa.offsetWidth;
    caixa.classList.add("tremer");
  }

  function confirmar() {
    if (digitado.length < TAM_MIN) { avisar("Use pelo menos " + TAM_MIN + " números.", true); tremer(); return; }
    if (modo === "entrar") {
      conferir(digitado).then(function (ok) {
        if (ok) { fechar(); }
        else { avisar("Senha incorreta.", true); tremer(); digitado = ""; pintarBolinhas(); }
      });
    } else if (modo === "criar") {
      primeira = digitado; digitado = ""; modo = "confirmar";
      document.getElementById("bloqueioTexto").textContent = "Digite a senha de novo para confirmar";
      avisar(""); pintarBolinhas();
    } else {
      if (digitado === primeira) {
        definir(digitado).then(function () { avisar(""); fechar(); if (aoDesbloquear) aoDesbloquear(true); });
      } else {
        avisar("As senhas não coincidem. Vamos começar de novo.", true); tremer();
        modo = "criar"; primeira = ""; digitado = "";
        document.getElementById("bloqueioTexto").textContent = "Escolha uma senha de " + TAM_MIN + " a " + TAM_MAX + " números";
        pintarBolinhas();
      }
    }
  }

  function tecla(t) {
    if (t === "apagar") { digitado = digitado.slice(0, -1); avisar(""); }
    else if (t === "ok") { confirmar(); return; }
    else if (digitado.length < TAM_MAX) { digitado += t; }
    pintarBolinhas();
    if (modo === "entrar" && digitado.length >= TAM_MIN) {
      // tenta sozinho quando o tamanho bate com o da senha salva
      var c = ler();
      if (c && c.tamanho && digitado.length === c.tamanho) confirmar();
    }
  }

  function abrir(opcoes) {
    opcoes = opcoes || {};
    modo = opcoes.modo || "entrar";
    digitado = ""; primeira = "";
    aoDesbloquear = opcoes.aoDesbloquear || null;
    var tela = document.createElement("div");
    tela.className = "tela-bloqueio";
    tela.id = "telaBloqueio";
    tela.innerHTML = telaHTML();
    document.body.appendChild(tela);
    if (modo === "criar") document.getElementById("bloqueioTexto").textContent = "Escolha uma senha de " + TAM_MIN + " a " + TAM_MAX + " números";
    pintarBolinhas();
    tela.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tecla]");
      if (b) { tecla(b.dataset.tecla); return; }
      if (e.target.closest("#btnBio")) tentarBiometria();
    });
    if (modo === "entrar" && biometriaAtiva()) setTimeout(tentarBiometria, 250);
    document.addEventListener("keydown", pelaTeclado);
  }

  function tentarBiometria() {
    if (!biometriaAtiva()) return;
    avisar("Aguardando a digital ou o Face ID…");
    pedirBiometria().then(function () {
      fechar();
      if (aoDesbloquear) aoDesbloquear(true);
    }).catch(function () {
      avisar("Não reconhecido. Use a senha ou toque no botão para tentar de novo.", true);
    });
  }

  function pelaTeclado(e) {
    if (!document.getElementById("telaBloqueio")) return;
    if (e.key >= "0" && e.key <= "9") tecla(e.key);
    else if (e.key === "Backspace") tecla("apagar");
    else if (e.key === "Enter") tecla("ok");
  }

  function fechar() {
    var tela = document.getElementById("telaBloqueio");
    if (tela) tela.remove();
    document.removeEventListener("keydown", pelaTeclado);
  }

  // exibe a tela logo de cara, antes de qualquer dado aparecer
  function protegerAoAbrir() { if (ativo()) abrir({ modo: "entrar" }); }

  global.Bloqueio = {
    ativo: ativo,
    abrir: abrir,
    fechar: fechar,
    definir: definir,
    conferir: conferir,
    remover: function () { remover(); removerBiometria(); },
    biometriaDisponivel: biometriaDisponivel,
    biometriaAtiva: biometriaAtiva,
    ativarBiometria: ativarBiometria,
    removerBiometria: removerBiometria,
    pedirBiometria: pedirBiometria,
    protegerAoAbrir: protegerAoAbrir
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", protegerAoAbrir);
  else protegerAoAbrir();
})(window);
