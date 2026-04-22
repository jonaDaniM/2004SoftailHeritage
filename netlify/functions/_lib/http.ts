import type { HandlerResponse } from "@netlify/functions";

export const json = (statusCode: number, body: unknown, headers?: Record<string, string>): HandlerResponse => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...headers
  },
  body: JSON.stringify(body)
});

export const parseBody = <T>(raw: string | null): T => {
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
};

export const methodNotAllowed = (method: string) =>
  json(405, { error: `Method ${method} not allowed` });
