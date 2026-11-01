"""Gera os ícones: quadrado arredondado escuro, borda ciano, barras ciano e linha dourada com pontos."""
# Uso (na raiz do repositório): python3 desktop/build/gerar-icones.py . desktop
import sys
from PIL import Image, ImageDraw, ImageFilter

FUNDO = (10, 20, 30, 255)      # #0A141E (o fundo escuro do app)
CIANO = (0, 229, 255, 255)     # #00E5FF (--cy do app)
OURO = (255, 198, 74, 255)     # dourado da linha
SS = 4                          # desenha 4x maior e reduz (bordas lisas)

def desenhar(S, margem, raio, borda, fundo_total=False, escala_conteudo=1.0):
    """S: tamanho final; margem/raio/borda: frações de S.
    fundo_total: pinta o quadrado inteiro de escuro (iPhone/iPad e maskable).
    escala_conteudo: encolhe o desenho todo (para a área segura do maskable)."""
    T = S * SS
    im = Image.new("RGBA", (T, T), FUNDO if fundo_total else (0, 0, 0, 0))
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
    d.rounded_rectangle([x0, y0, x0 + lado, y0 + lado], radius=r, fill=CIANO)
    d.rounded_rectangle([x0 + b, y0 + b, x0 + lado - b, y0 + lado - b], radius=max(1, r - b), fill=FUNDO)
    # barras e linha (frações do lado do cartão)
    P = lambda fx, fy: (x0 + fx * lado, y0 + fy * lado)
    w, g = 0.09, 0.056
    inicio = (1 - (4 * w + 3 * g)) / 2
    base, topos = 0.74, [0.53, 0.45, 0.38, 0.29]
    pontos = []
    for i, topo in enumerate(topos):
        bx = inicio + i * (w + g)
        (ax, ay), (cx, cy) = P(bx, topo), P(bx + w, base)
        d.rounded_rectangle([ax, ay, cx, cy], radius=lado * 0.018, fill=CIANO)
        pontos.append(P(bx + w / 2, topo))   # pontos em cima das barras
    d.line(pontos, fill=OURO, width=int(lado * 0.026), joint="curve")
    rp = lado * 0.03
    for (px, py) in pontos:
        d.ellipse([px - rp, py - rp, px + rp, py + rp], fill=OURO)
    return im.resize((S, S), Image.LANCZOS)

raiz, desk = sys.argv[1], sys.argv[2]
# programa (Windows) e ícones do navegador: cartão com cantos transparentes
normal = lambda S: desenhar(S, margem=0.05, raio=0.21, borda=0.03)
# iPhone/iPad: o iOS arredonda sozinho e não aceita transparência → fundo inteiro
ios = lambda S: desenhar(S, margem=0.035, raio=0.2, borda=0.03, fundo_total=True)
# maskable (Android): o desenho dentro da área segura (círculo de 80%)
mask = lambda S: desenhar(S, margem=0.0, raio=0.21, borda=0.03, fundo_total=True, escala_conteudo=0.74)

normal(512).save(f"{raiz}/assets/icons/icon-512.png")
normal(192).save(f"{raiz}/assets/icons/icon-192.png")
mask(512).save(f"{raiz}/assets/icons/icon-maskable-512.png")
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
print("ícones gerados")
