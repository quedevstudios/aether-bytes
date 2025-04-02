import antfu from "@antfu/eslint-config"

export default antfu({
  type: "lib",

  stylistic: {
    indent: 2,
    quotes: "double",
  },

  rules: {
    "jsdoc/check-param-names": "off",
    "node/prefer-global/buffer": "off",
  },
})
