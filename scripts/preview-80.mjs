import { spawn, spawnSync } from "node:child_process";

function hasDockerCompose() {
  const result = spawnSync("docker", ["compose", "version"], {
    stdio: "ignore"
  });

  return result.status === 0;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: "inherit",
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

function runPnpm(args) {
  if (process.env.npm_execpath) {
    return run(process.execPath, [process.env.npm_execpath, ...args]);
  }

  return run("pnpm", args);
}

if (hasDockerCompose()) {
  console.log("Docker detected. Starting the full 80-port stack...");
  await run("docker", [
    "compose",
    "-p",
    "zhanji-universe",
    "--env-file",
    ".env.new-api.example",
    "up",
    "-d",
    "--build"
  ]);
  console.log("Preview ready: http://127.0.0.1/");
  console.log("Lingqiong API console: http://127.0.0.1:30001");
} else {
  console.log("Docker was not found. Starting the website-only 80-port preview...");
  await runPnpm(["exec", "next", "build"]);
  await runPnpm(["exec", "next", "start", "-H", "0.0.0.0", "-p", "80"]);
}
