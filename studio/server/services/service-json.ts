import * as fs from "fs";
import { writeAllowedJson } from "./write-boundary.ts";

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName: string, value: unknown): void {
  writeAllowedJson(fileName, value);
}

export {
  readJson,
  writeJson
};
