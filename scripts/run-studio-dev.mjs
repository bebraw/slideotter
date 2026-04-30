import { spawn } from "node:child_process";

const children = [];

function start(command, args) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: "inherit"
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal) {
      return;
    }
    process.exitCode = code || 0;
    shutdown();
  });
  return child;
}

function shutdown() {
  while (children.length) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill();
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});

start("npm", ["run", "studio:client:watch"]);
start("node", ["studio/server/index.ts"]);
