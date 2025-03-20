import antfu from "@antfu/eslint-config"

export default antfu({
  type: "lib",

  stylistic: {
    indent: 2,
    quotes: "double",
  },

  rules: {
    "node/prefer-global/buffer": "off",
  },
})
