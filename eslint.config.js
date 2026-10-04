// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
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
          {
            name: "@/components/Avatar",
            message: "En desuso (FASE3): el retrato es Avatar de '@/components/ui'; useRetrato está en '@/components/ui/useRetrato'.",
          },
        ],
        patterns: [
          {
            group: ["**/XPBar"],
            message: "En desuso (FASE3): usa Barra de '@/components/arena'.",
          },
          {
            group: ["**/Hexagon"],
            message: "En desuso (FASE3): usa Avatar de '@/components/ui'.",
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
