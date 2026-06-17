import * as fs from "node:fs";
import * as path from "node:path";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function projectPath(fileName: string): string {
  return path.join(process.cwd(), fileName);
}

export function readClientSource(fileName: string): string {
  return fs.readFileSync(projectPath(path.join("studio/client", fileName)), "utf8");
}

export function readProjectSource(fileName: string): string {
  return fs.readFileSync(projectPath(fileName), "utf8");
}

export function clientModuleLoaded(fileName: string, sources: string[]): boolean {
  const escaped = escapeRegExp(fileName);
  const pattern = new RegExp(`import (?:\\{[^}]+\\} from )?"\\./${escaped}";`);
  return sources.some((source) => pattern.test(source));
}

export function clientModuleLazyLoaded(fileName: string, source: string): boolean {
  const escaped = escapeRegExp(fileName);
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(source);
}
