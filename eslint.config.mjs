import js from "@eslint/js";
import convexPlugin from "@convex-dev/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "media/**",
      "backups/**",
      "vendors/**",
      "reports/**",
      "test-results/**",
      "playwright-report/**",
      "_restos_exras_bloqueados/**",
      "convex/_generated/**",
      // Generated embed packages: 130k+ line data literals, not hand-written code.
      "convex/lib/campusSpatialPackage.ts",
      "convex/lib/pilotA11yPackage.ts",
      "styles(old_together).css",
    ],
  },

  js.configs.recommended,

  // Convex backend: type-aware rules + Convex-specific checks.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["convex/**/*.ts"],
  })),
  ...convexPlugin.configs.recommended,
  {
    files: ["convex/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./convex/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Deuda conocida: ~77 llamadas `ctx.db.get(id)` sin nombre de tabla.
      // Migración planificada (docs/arquitectura/01-auditoria-2026-09-29.md); warn hasta entonces.
      "@convex-dev/explicit-table-ids": "warn",
    },
  },

  // Node tooling (build scripts, dev server, unit tests).
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "*.mjs", "audit-runner.js", "playwright.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        structuredClone: "readonly",
        __dirname: "readonly",
        module: "writable",
        require: "readonly",
        // Varios scripts inyectan funciones en el navegador vía page.evaluate().
        window: "readonly",
        document: "readonly",
        getComputedStyle: "readonly",
        location: "readonly",
        navigator: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },

  // Browser motor (plain ES modules, no bundler).
  {
    files: [
      "src/**/*.js",
      "control-web/**/*.js",
      "plataforma/**/*.js",
      "orbe-config.js",
      "tests/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        getComputedStyle: "readonly",
        history: "readonly",
        performance: "readonly",
        AbortController: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        crypto: "readonly",
        matchMedia: "readonly",
        screen: "readonly",
        speechRecognition: "readonly",
        process: "readonly",
        location: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        navigator: "readonly",
        Audio: "readonly",
        Image: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        Node: "readonly",
        Element: "readonly",
        HTMLElement: "readonly",
        HTMLImageElement: "readonly",
        structuredClone: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        speechSynthesis: "readonly",
        SpeechSynthesisUtterance: "readonly",
        Marzipano: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
];
