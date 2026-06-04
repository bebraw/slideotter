import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readSkill(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("slideotter agent command skill preserves guarded workflow boundaries", () => {
  const skill = readSkill("skills/slideotter-agent-commands/SKILL.md");

  assert.match(skill, /candidate\/review\/apply boundaries|candidate, material, validation, or apply path/i);
  assert.match(skill, /Do not write generated slide specs directly/i);
  assert.match(skill, /SVGL material-provider flow from ADR 0054/i);
  assert.match(skill, /npm run quality:gate/i);
  assert.match(skill, /outline approval explicit/i);
});

test("slideotter agent command skill has OpenAI metadata", () => {
  const metadata = readSkill("skills/slideotter-agent-commands/agents/openai.yaml");

  assert.match(metadata, /display_name: Slideotter Agent Commands/);
  assert.match(metadata, /short_description:/);
  assert.match(metadata, /default_prompt:/);
});
