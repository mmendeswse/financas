"""Gera os ícones: quadrado arredondado escuro, borda ciano, barras ciano e linha dourada com pontos."""
# Uso (na raiz do repositório): python3 desktop/build/gerar-icones.py . desktop
import sys
from PIL import Image, ImageDraw, ImageFilter

FUNDO = (10, 20, 30, 255)      # #0A141E (o fundo escuro do app)
CIANO = (0, 229, 255, 255)     # #00E5FF (--cy do app)
OURO = (255, 198, 74, 255)     # dourado da linha
SS = 4                          # desenha 4x maior e reduz (bordas lisas)

# proporções do desenho (frações do lado do cartão)
PADRAO = dict(w=0.09, g=0.056, base=0.74, topos=[0.53, 0.45, 0.38, 0.29], linha=0.026, ponto=0.03, raio_barra=0.018)
# favicon: barras e linha bem maiores, ocupando o quadrado (como os outros ícones da barra do navegador)
COMPACTO = dict(w=0.155, g=0.05, base=0.86, topos=[0.6, 0.47, 0.36, 0.22], linha=0.075, ponto=0.085, raio_barra=0.03)

def desenhar(S, margem, raio, borda, fundo_total=False, escala_conteudo=1.0, layout=PADRAO, cor_fundo=FUNDO, cor_borda=CIANO):
    """S: tamanho final; margem/raio/borda: frações de S.
    fundo_total: pinta o quadrado inteiro de escuro (iPhone/iPad e maskable).
    escala_conteudo: encolhe o desenho todo (para a área segura do maskable)."""
    T = S * SS
    im = Image.new("RGBA", (T, T), cor_fundo if fundo_total else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # o "cartão" com borda, centrado
    lado = T * (1 - 2 * margem) * escala_conteudo
    x0 = (T - lado) / 2; y0 = x0
    r, b = lado * raio, lado * borda
    if not fundo_total and margem > 0:
        # brilho suave da borda, como no desenho de referência
        brilho = Image.new("RGBA", (T, T), (0, 0, 0, 0))
        ImageDraw.Draw(brilho).rounded_rectangle([x0, y0, x0 + lado, y0 + lado], radius=r, outline=(0, 229, 255, 150), width=int(b * 1.6))
        im.alpha_composite(brilho.filter(ImageFilter.GaussianBlur(T * 0.012)))
        d = ImageDraw.Draw(im)
    d.rounded_rectangle([x0, y0, x0 + lado, y0 + lado], radius=r, fill=cor_borda)
    d.rounded_rectangle([x0 + b, y0 + b, x0 + lado - b, y0 + lado - b], radius=max(1, r - b), fill=FUNDO)
    # barras e linha (frações do lado do cartão)
    P = lambda fx, fy: (x0 + fx * lado, y0 + fy * lado)
    w, g = layout["w"], layout["g"]
    inicio = (1 - (4 * w + 3 * g)) / 2
    base, topos = layout["base"], layout["topos"]
    pontos = []
    for i, topo in enumerate(topos):
        bx = inicio + i * (w + g)
        (ax, ay), (cx, cy) = P(bx, topo), P(bx + w, base)
        d.rounded_rectangle([ax, ay, cx, cy], radius=lado * layout["raio_barra"], fill=CIANO)
        pontos.append(P(bx + w / 2, topo))   # pontos em cima das barras
    d.line(pontos, fill=OURO, width=max(1, int(lado * layout["linha"])), joint="curve")
    rp = lado * layout["ponto"]
    for (px, py) in pontos:
        d.ellipse([px - rp, py - rp, px + rp, py + rp], fill=OURO)
    return im.resize((S, S), Image.LANCZOS)

raiz, desk = sys.argv[1], sys.argv[2]
# programa (Windows) e ícones do navegador: cartão com cantos transparentes
normal = lambda S: desenhar(S, margem=0.05, raio=0.21, borda=0.03)
# iPhone/iPad: o mesmo desenho do Android — fundo escuro até a borda (o iOS
# recorta os cantos sozinho e não aceita transparência) e só as barras/linha.
ios = lambda S: desenhar(S, margem=0.0, raio=0.21, borda=0.0, fundo_total=True, cor_borda=FUNDO)
# maskable (Android): fundo escuro até as bordas (o Android recorta no formato
# do aparelho: círculo, gota, quadrado...) e só as barras/linha, dentro da área
# segura (círculo de 80%). Sem a borda ciano interna: ela ficava cortada ou
# parecia um ícone pequeno dentro de outro.
mask = lambda S: desenhar(S, margem=0.0, raio=0.21, borda=0.0, fundo_total=True, cor_borda=FUNDO)

normal(512).save(f"{raiz}/assets/icons/icon-512.png")
normal(192).save(f"{raiz}/assets/icons/icon-192.png")
mask(512).save(f"{raiz}/assets/icons/icon-maskable-512.png")
mask(192).save(f"{raiz}/assets/icons/icon-maskable-192.png")
for nome, S in [("apple-touch-icon", 180), ("apple-touch-icon-180", 180), ("apple-touch-icon-167", 167),
                ("apple-touch-icon-152", 152), ("apple-touch-icon-precomposed", 180)]:
    im = ios(S).convert("RGB")
    im.save(f"{raiz}/{nome}.png")
    im.save(f"{raiz}/assets/icons/{nome}.png") if nome != "apple-touch-icon-precomposed" else None
grande = normal(1024)
grande.resize((512, 512), Image.LANCZOS).save(f"{desk}/build/icon.png")
# .ico com cada tamanho desenhado à parte (fica nítido também em 16 e 32 px)
tamanhos = [16, 24, 32, 48, 64, 128, 256]
normal(256).save(f"{desk}/build/icon.ico", sizes=[(s, s) for s in tamanhos],
                 append_images=[normal(s) for s in tamanhos[:-1]])
# favicon (aba do navegador): borda mais grossa para aparecer em 16–48 px
fav = lambda S: desenhar(S, margem=0.0, raio=0.2, borda=0.07, layout=COMPACTO)
fav(48).save(f"{raiz}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[fav(16), fav(32)])
fav(32).save(f"{raiz}/favicon-32.png")
# mesmo desenho em SVG (nítido em qualquer tamanho)
L = COMPACTO
w, g = L["w"] * 100, L["g"] * 100
x0 = (100 - (4 * w + 3 * g)) / 2
topos, base = [t * 100 for t in L["topos"]], L["base"] * 100
barras = "".join(f'<rect x="{x0 + i * (w + g):.1f}" y="{t:.1f}" width="{w:.1f}" height="{base - t:.1f}" rx="{L['raio_barra'] * 100:.1f}" fill="#00E5FF"/>' for i, t in enumerate(topos))
pts = [(x0 + i * (w + g) + w / 2, t) for i, t in enumerate(topos)]
linha = " ".join(f"{px:.1f},{py:.1f}" for px, py in pts)
pontos = "".join(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{L['ponto'] * 100:.1f}" fill="#FFC64A"/>' for px, py in pts)
open(f"{raiz}/favicon.svg", "w").write(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    '<rect width="100" height="100" rx="20" fill="#00E5FF"/>'
    '<rect x="7" y="7" width="86" height="86" rx="13" fill="#0A141E"/>'
    + barras + f'<polyline points="{linha}" fill="none" stroke="#FFC64A" stroke-width="{L['linha'] * 100:.1f}" stroke-linejoin="round" stroke-linecap="round"/>'
    + pontos + '</svg>\n')
print("ícones gerados")
