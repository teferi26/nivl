// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // dist*/: exports; .expo/: tipos generados; supabase/functions: Deno (lo
    // validan `deno check` y `deno test`, no las reglas de Node/React Native).
    ignores: ["dist/*", "dist-creadores/*", ".expo/*", "supabase/functions/**"],
  },
  // Scripts de Node: Buffer, process y demás globales de Node.
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { Buffer: "readonly", process: "readonly", console: "readonly", URL: "readonly", fetch: "readonly", setTimeout: "readonly", __dirname: "readonly" },
    },
  },
  // FASE3 (Lote Z): piezas viejas del kit en desuso. Solo aviso: `--quiet` no
  // las cuenta. Lo nuevo vive en '@/components/arena' (EncabezadoArena,
  // Entrada, FranjaCifras, Barra, TarjetaArena) y en Button/Avatar del kit.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["warn", {
        paths: [
          {
            name: "@/components/ui",
            importNames: ["ScreenHeader"],
            message: "En desuso (FASE3): usa EncabezadoArena de '@/components/arena'.",
          },
          {
            name: "@/components/ui",
            importNames: ["FadeIn", "Stagger"],
            message: "En desuso (FASE3): usa Entrada de '@/components/arena'.",
          },
          {
            name: "@/components/ui",
            importNames: ["Stat", "StatRow"],
            message: "En desuso (FASE3): usa FranjaCifras de '@/components/arena'.",
          },
        ],
        patterns: [
          {
            group: ["**/XPBar"],
            message: "En desuso (FASE3): usa Barra de '@/components/arena'.",
          },
          {
            group: ["**/SystemButton"],
            message: "En desuso (FASE3): usa Button de '@/components/ui'.",
          },
        ],
      }],
    },
  },
]);
