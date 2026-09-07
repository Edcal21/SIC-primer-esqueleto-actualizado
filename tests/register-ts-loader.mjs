// Se carga con `node --import ./tests/register-ts-loader.mjs` para registrar el resolvedor de
// tests/ts-resolve-hooks.mjs antes de que se construya el grafo de módulos de las pruebas.
import { register } from "node:module";

register("./ts-resolve-hooks.mjs", import.meta.url);
