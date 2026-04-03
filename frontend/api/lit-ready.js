import { applyCors } from "../server/cors.js";
import { handleLitReadyRequest } from "../server/lit.js";

export default async function handler(request, response) {
  applyCors(request, response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({
      error: "Method Not Allowed",
    });
    return;
  }

  try {
    const payload = await handleLitReadyRequest();

    response.status(200).json(payload);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Lit 连接失败。",
    });
  }
}
