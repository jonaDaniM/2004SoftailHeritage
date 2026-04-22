import type { Handler } from "@netlify/functions";
import { cookieFromToken, createSessionToken } from "./_lib/adminSession";
import { json, methodNotAllowed, parseBody } from "./_lib/http";

type LoginBody = { password?: string };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed(event.httpMethod);

  const body = parseBody<LoginBody>(event.body);
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return json(500, { error: "ADMIN_PASSWORD is not configured." });
  }

  if (!body.password || body.password !== expected) {
    return json(401, { error: "Invalid admin password." });
  }

  const token = createSessionToken();

  return json(200, { ok: true }, { "Set-Cookie": cookieFromToken(token) });
};
