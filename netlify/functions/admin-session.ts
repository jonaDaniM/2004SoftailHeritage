import type { Handler } from "@netlify/functions";
import { getCookieToken, verifySessionToken } from "./_lib/adminSession";
import { json, methodNotAllowed } from "./_lib/http";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") return methodNotAllowed(event.httpMethod);
  const token = getCookieToken(event);
  return json(200, { authenticated: verifySessionToken(token) });
};
