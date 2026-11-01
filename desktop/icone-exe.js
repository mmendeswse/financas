/**
 * icone-exe.js — depois de empacotar, troca o ícone e os dados de versão do
 * .exe (o padrão é o ícone do Electron). Feito em JavaScript puro (resedit),
 * para gerar o instalador do Windows também a partir do Linux/Mac.
 */
const fs = require("fs");
const path = require("path");

exports.default = async function (context) {
  if (context.electronPlatformName !== "win32") return;
  const ResEdit = await import("resedit");
  const PE = await import("pe-library");

  const info = context.packager.appInfo;
  const exe = path.join(context.appOutDir, info.productFilename + ".exe");
  const binario = PE.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = PE.NtExecutableResource.from(binario);

  // ícone: substitui todos os grupos de ícone do executável
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, "build", "icon.ico")));
  ResEdit.Resource.IconGroupEntry.fromEntries(res.entries).forEach((g) => {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map((i) => i.data));
  });

  // versão e nome que o Windows mostra (Propriedades do arquivo, Gerenciador de Tarefas)
  const [a, b, c] = String(info.version).split(".").map((n) => Number(n) || 0);
  ResEdit.Resource.VersionInfo.fromEntries(res.entries).forEach((vi) => {
    vi.getAllLanguagesForStringValues().forEach((lc) => {
      vi.setFileVersion(a, b, c, 0, lc.lang);
      vi.setProductVersion(a, b, c, 0, lc.lang);
      vi.setStringValues(lc, {
        FileDescription: info.productName,
        ProductName: info.productName,
        CompanyName: "Muller Mendes",
        LegalCopyright: "Muller Mendes",
        OriginalFilename: info.productFilename + ".exe",
        InternalName: info.productFilename
      });
    });
    vi.outputToResourceEntries(res.entries);
  });

  res.outputResource(binario);
  fs.writeFileSync(exe, Buffer.from(binario.generate()));
  console.log("  • ícone e versão aplicados em " + path.basename(exe));
};
