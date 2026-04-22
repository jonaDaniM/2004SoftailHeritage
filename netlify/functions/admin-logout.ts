import type { Handler } from "@netlify/functions";
import { clearCookie } from "./_lib/adminSession";
import { json, methodNotAllowed } from "./_lib/http";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed(event.httpMethod);
  return json(200, { ok: true }, { "Set-Cookie": clearCookie() });
};
