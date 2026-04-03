import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { handlePinataJsonRequest } from "./server/pinata.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env = {
    ...process.env,
    ...env,
  };

  function createJsonApiMiddleware(path, handler) {
    return {
      configureServer(server) {
        server.middlewares.use(path, async (request, response, next) => {
          if (request.method !== "POST") {
            next();
            return;
          }

          try {
            const chunks = [];

            for await (const chunk of request) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }

            const rawBody = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
            const payload = await handler(rawBody);

            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify(payload));
          } catch (error) {
            response.statusCode = 500;
            response.setHeader("Content-Type", "application/json");
            response.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : "请求失败。",
              }),
            );
          }
        });
      },
      name: `seamphore-dev-api:${path}`,
    };
  }

  return {
    define: {
      global: "globalThis",
    },
    plugins: [
      react(),
      tailwindcss(),
      createJsonApiMiddleware("/api/pinata-json", handlePinataJsonRequest),
    ],
    resolve: {
      alias: {
        buffer: "buffer/",
        process: "process/browser",
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
  };
});
