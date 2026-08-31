export default {
  input: "./openapi/openapi.json",
  output: "./src/generated",
  plugins: ["@hey-api/client-fetch"],
};
