const { spawnSync } = require("node:child_process");
const { existsSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const codesign = (args) => {
  const result = spawnSync("codesign", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "codesign failed");
  }
};

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const appexPath = join(appPath, "Contents", "PlugIns", "EdgeEverShare.appex");
  const extensionEntitlements = join(
    __dirname,
    "..",
    "share-extension",
    "EdgeEverShare.entitlements",
  );
  if (!existsSync(appPath) || !existsSync(appexPath) || !existsSync(extensionEntitlements)) {
    throw new Error(`macOS share extension is incomplete in ${appPath}`);
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "edgeever-adhoc-entitlements-"));
  const appEntitlements = join(temporaryDirectory, "app.plist");
  writeFileSync(appEntitlements, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict>
</plist>
`);

  try {
    codesign([
      "--force",
      "--sign",
      "-",
      "--generate-entitlement-der",
      "--entitlements",
      extensionEntitlements,
      appexPath,
    ]);
    codesign([
      "--force",
      "--deep",
      "--sign",
      "-",
      "--entitlements",
      appEntitlements,
      appPath,
    ]);
    codesign(["--verify", "--deep", "--strict", "--verbose=1", appPath]);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};
