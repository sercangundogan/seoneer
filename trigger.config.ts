import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "seoneer",
  runtime: "node",
  maxDuration: 3600,
  dirs: ["./trigger"],
});
