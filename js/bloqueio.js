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
      if (b) tecla(b.dataset.tecla);
    });
    document.addEventListener("keydown", pelaTeclado);
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
    remover: remover,
    protegerAoAbrir: protegerAoAbrir
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", protegerAoAbrir);
  else protegerAoAbrir();
})(window);
