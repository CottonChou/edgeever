import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const run = (command, args, { capture = false, env = process.env } = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    const detail = capture ? (result.stderr || result.stdout || "").trim() : "";
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `:\n${detail}` : ""}`);
  }
  return capture ? result.stdout.trim() : "";
};

const nativeMacArchitecture = () => {
  const machine = run("uname", ["-m"], { capture: true });
  if (machine === "arm64") return "arm64";
  if (machine === "x86_64") return "x64";
  throw new Error(`Unsupported macOS architecture reported by uname: ${machine}`);
};

const requestedArchitecture = () => {
  const override = process.env.EDGE_EVER_DESKTOP_ARCH?.trim();
  if (override) {
    if (!["arm64", "x64"].includes(override)) {
      throw new Error(`EDGE_EVER_DESKTOP_ARCH must be arm64 or x64, received: ${override}`);
    }
    return override;
  }
  if (process.platform === "darwin") return nativeMacArchitecture();
  return process.arch === "arm64" ? "arm64" : "x64";
};

const architectureTarget = (arch) => {
  if (process.platform === "darwin") {
    return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  }
  return null;
};

const inspectArchitecture = (path) => {
  if (process.platform !== "darwin") return "";
  return run("lipo", ["-archs", path], { capture: true });
};

const expectedMachArchitecture = (arch) => arch === "x64" ? "x86_64" : arch;

const prepareMacSidecar = async (arch) => {
  const sidecarOutput = join(projectRoot, "crates/desktop-sidecar/target/release/edgeever-sidecar");
  const overridePath = process.env.EDGE_EVER_SIDECAR_PATH?.trim();
  if (overridePath) {
    const sourcePath = resolve(projectRoot, overridePath);
    const actualArch = inspectArchitecture(sourcePath);
    if (actualArch !== expectedMachArchitecture(arch)) {
      throw new Error(`EDGE_EVER_SIDECAR_PATH targets ${actualArch || "an unknown architecture"}, expected ${expectedMachArchitecture(arch)}`);
    }
    await mkdir(join(projectRoot, "crates/desktop-sidecar/target/release"), { recursive: true });
    await copyFile(sourcePath, sidecarOutput);
    await chmod(sidecarOutput, 0o755);
    return;
  }

  run("cargo", ["build", "--manifest-path", "crates/desktop-sidecar/Cargo.toml", "--release"]);
  let actualArch = inspectArchitecture(sidecarOutput);
  if (actualArch === expectedMachArchitecture(arch)) return;

  const target = architectureTarget(arch);
  if (!target) {
    throw new Error(`Desktop sidecar targets ${actualArch}, expected ${expectedMachArchitecture(arch)}`);
  }

  // A Rosetta-hosted Node/cargo process reports x86_64 even on Apple Silicon.
  // Rebuild explicitly for the native target so the packaged app never depends
  // on Rosetta being installed.
  run("cargo", [
    "build",
    "--manifest-path",
    "crates/desktop-sidecar/Cargo.toml",
    "--release",
    "--target",
    target,
  ]);
  const targetedSidecar = join(
    projectRoot,
    "crates/desktop-sidecar/target",
    target,
    "release",
    "edgeever-sidecar",
  );
  actualArch = inspectArchitecture(targetedSidecar);
  if (actualArch !== expectedMachArchitecture(arch)) {
    throw new Error(`Targeted Rust sidecar contains ${actualArch}, expected ${expectedMachArchitecture(arch)}`);
  }
  await copyFile(targetedSidecar, sidecarOutput);
  await chmod(sidecarOutput, 0o755);
};

const main = async () => {
  const arch = requestedArchitecture();
  const desktopEnv = {
    ...process.env,
    EDGE_EVER_DESKTOP_BUILD: "1",
    EDGE_EVER_DESKTOP_ARCH: arch,
  };

  run("bun", ["run", "prepare:desktop:icons"], { env: desktopEnv });
  run("bun", ["run", "build:web"], { env: desktopEnv });
  if (process.platform === "darwin") {
    await prepareMacSidecar(arch);
  } else {
    run("bun", ["run", "build:desktop:sidecar"], { env: desktopEnv });
  }

  run("bun", ["scripts/run-desktop-builder.mjs", "--publish", "never"], { env: desktopEnv });

  const unpackedDirectory = process.platform !== "darwin"
    ? null
    : arch === "x64" ? "mac" : `mac-${arch}`;
  if (unpackedDirectory) {
    const executable = join(projectRoot, "release/desktop", unpackedDirectory, "EdgeEver.app/Contents/MacOS/EdgeEver");
    if (!existsSync(executable)) throw new Error(`Packaged macOS executable is missing: ${executable}`);
    run("bun", ["run", "verify:desktop-package"], {
      env: { ...desktopEnv, EDGE_EVER_VERIFY_TARGET: "darwin" },
    });
  }

  console.log(`[build-desktop] packaged ${process.platform} ${arch}`);
};

await main();
