import pluginCommonJS from "@rollup/plugin-commonjs"
import pluginResolve from "@rollup/plugin-node-resolve"
import pluginTerser from "@rollup/plugin-terser"
import pluginTypescript from "@rollup/plugin-typescript"
import { defineConfig } from "rollup"
import pluginDTS from "rollup-plugin-dts"

const outputDir = "dist"

export default defineConfig([
  {
    input: "src/index.ts",
    output: [
      {
        file: `${outputDir}/index.umd.cjs`,
        format: "cjs",
      },
      {
        file: `${outputDir}/index.esm.js`,
        format: "esm",
      },
    ],
    external: id => id.startsWith("node:"),
    plugins: [
      pluginResolve(),
      pluginCommonJS(),
      pluginTypescript(),
      pluginTerser(),
    ],
  },
  {
    input: "src/index.ts",
    output: [
      {
        file: `${outputDir}/index.d.ts`,
        format: "esm",
      },
    ],
    external: id => id.startsWith("node:"),
    plugins: [
      pluginTypescript(),
      pluginDTS(),
    ],
  },
])
