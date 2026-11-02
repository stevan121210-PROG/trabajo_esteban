import fs from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("dist");
const htmlPath = path.join(outputDirectory, "dev.html");
const standalonePath = path.join(outputDirectory, "index.html");
let html = await fs.readFile(htmlPath, "utf8");

const scriptMatch = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const styleMatch = html.match(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/);

if (!scriptMatch || !styleMatch) {
  throw new Error("Could not find the built JavaScript and CSS assets in dist/index.html.");
}

const assetDirectory = path.join(outputDirectory, "assets");
const scriptPath = path.join(assetDirectory, path.basename(new URL(scriptMatch[1], "https://pages.invalid").pathname));
const stylePath = path.join(assetDirectory, path.basename(new URL(styleMatch[1], "https://pages.invalid").pathname));
const [script, styles] = await Promise.all([
  fs.readFile(scriptPath, "utf8"),
  fs.readFile(stylePath, "utf8"),
]);
const encodedScript = Buffer.from(script, "utf8").toString("base64");
const scriptLoader = `const bytes=Uint8Array.from(atob("${encodedScript}"),character=>character.charCodeAt(0));const moduleUrl=URL.createObjectURL(new Blob([bytes],{type:"text/javascript"}));import(moduleUrl).catch(error=>{document.getElementById("root").textContent="No se pudo iniciar la demo. Recarga la página e inténtalo de nuevo.";console.error(error)});`;

html = html
  .replace(scriptMatch[0], `<script type="module">${scriptLoader}</script>`)
  .replace(styleMatch[0], `<style>${styles}</style>`);

await fs.writeFile(standalonePath, html, "utf8");
await fs.rm(htmlPath);
await fs.copyFile(standalonePath, path.resolve("index.html"));
console.log("Created standalone dist/index.html for GitHub Pages.");
