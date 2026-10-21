/* Les icônes PNG du manifeste, rendues depuis le sigle SVG par Chromium.
   Un manifeste veut du PNG en 192 et 512 : le SVG seul ne suffit pas à
   Android. */
import { chromium } from "/tmp/claude-0/-home-user-site-avec-papa/029eaf86-024b-5d15-a09c-b072079f1bba/scratchpad/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(RACINE, "assets/favicon.svg"), "utf8");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

for (const [taille, nom, marge] of [[192, "icone-192.png", 0], [512, "icone-512.png", 0],
                                    [512, "icone-512-pleine.png", 0.12], [180, "icone-apple.png", 0]]) {
  const ctx = await nav.newContext({ viewport: { width: taille, height: taille }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  // « maskable » : Android rogne jusqu'à 20 % du bord, d'où la marge.
  const echelle = 1 - marge * 2;
  await p.setContent(`<!doctype html><meta charset="utf-8">
    <style>html,body{margin:0;width:${taille}px;height:${taille}px;background:#4A2BE8}
      div{position:absolute;inset:${marge * 100}%;}
      svg{width:100%;height:100%;display:block}</style>
    <div>${svg.replace('rx="14"', marge ? 'rx="0"' : 'rx="14"')}</div>`);
  await p.waitForTimeout(120);
  await p.screenshot({ path: resolve(RACINE, "assets/icones", nom), omitBackground: false });
  console.log("  " + nom.padEnd(24) + taille + "px" + (marge ? "  (maskable)" : "") + " échelle " + echelle.toFixed(2));
  await ctx.close();
}
await nav.close();
