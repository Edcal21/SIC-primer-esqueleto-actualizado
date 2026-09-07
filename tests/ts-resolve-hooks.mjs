// Permite que los archivos de prueba .mjs importen módulos TypeScript relativos del repositorio
// (por ejemplo "../lib/moneda") sin extensión, igual que hace el bundler en tiempo de build.
// Node ejecuta TypeScript directamente (type-stripping nativo) pero, a diferencia del bundler,
// exige la extensión exacta del archivo al resolver especificadores relativos.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  const esRelativo = specifier.startsWith("./") || specifier.startsWith("../");
  const sinExtension = esRelativo && !/\.[a-zA-Z0-9]+$/.test(specifier);
  if (!sinExtension) return nextResolve(specifier, context);

  const base = new URL(context.parentURL);
  for (const extension of [".ts", ".tsx", ".mjs", ".js"]) {
    const candidato = new URL(`${specifier}${extension}`, base);
    if (existsSync(fileURLToPath(candidato))) {
      return nextResolve(pathToFileURL(fileURLToPath(candidato)).href, context);
    }
  }
  // Import de directorio (p. ej. "../db" -> "../db/index.ts"), como resuelve el bundler.
  for (const extension of [".ts", ".tsx", ".mjs", ".js"]) {
    const candidato = new URL(`${specifier}/index${extension}`, base);
    if (existsSync(fileURLToPath(candidato))) {
      return nextResolve(pathToFileURL(fileURLToPath(candidato)).href, context);
    }
  }
  return nextResolve(specifier, context);
}
