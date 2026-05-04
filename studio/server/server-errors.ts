import { isJsonObject } from "./api-payloads.ts";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function errorStatusCode(error: unknown): number {
  return isJsonObject(error) && typeof error.statusCode === "number" ? error.statusCode : 500;
}

export function errorCode(error: unknown): string {
  return isJsonObject(error) && typeof error.code === "string" ? error.code : "INTERNAL_ERROR";
}
