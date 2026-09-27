#!/usr/bin/env bash
set -euo pipefail

mkdir -p screenshots
# Pinned official Maestro CLI. Its native driver accepts the iOS deep-link
# security prompt, then verifies the visible route before taking each PNG.
curl -fLsS 'https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.10.0/maestro.zip' -o "$RUNNER_TEMP/maestro.zip"
curl -fLsS 'https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.10.0/checksums_sha256.txt' -o "$RUNNER_TEMP/maestro-checksums.txt"
(cd "$RUNNER_TEMP" && grep 'maestro.zip' maestro-checksums.txt | shasum -a 256 -c -)
unzip -q -o "$RUNNER_TEMP/maestro.zip" -d "$RUNNER_TEMP/maestro-cli"
MAESTRO=$(find "$RUNNER_TEMP/maestro-cli" -path '*/bin/maestro' -type f -print -quit)
test -n "$MAESTRO"
chmod +x "$MAESTRO"
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
"$MAESTRO" --version
xcrun simctl list devices available -j > "$RUNNER_TEMP/simulators.json"
DEVICE_ID=$(node -e '
  const fs=require("fs"); const list=JSON.parse(fs.readFileSync(process.argv[1]));
  const devices=Object.entries(list.devices).filter(([r])=>r.includes("iOS")).flatMap(([,ds])=>ds);
  const device=devices.find(d=>d.name==="iPhone 16 Pro Max") || devices.find(d=>d.name==="iPhone 17 Pro Max") || devices.find(d=>d.name.includes("Pro Max"));
  if(!device) throw new Error("No iPhone Pro Max simulator is installed");
  console.log(device.udid);
' "$RUNNER_TEMP/simulators.json")
export DEVICE_ID
xcrun simctl boot "$DEVICE_ID" || true
xcrun simctl bootstatus "$DEVICE_ID" -b
xcrun simctl ui "$DEVICE_ID" appearance dark
xcrun simctl status_bar "$DEVICE_ID" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100

APP_PATH=$(find "$RUNNER_TEMP/nivl-derived/Build/Products/Release-iphonesimulator" -maxdepth 1 -name '*.app' -print -quit)
test -n "$APP_PATH"
xcrun simctl install "$DEVICE_ID" "$APP_PATH"
xcrun simctl launch "$DEVICE_ID" com.teferi.nivl.screenshots -AppleLanguages '(es)' -AppleLocale 'es_ES'
sleep 15

set +e
"$MAESTRO" --device "$DEVICE_ID" test --test-output-dir screenshots/maestro-health scripts/screenshots/health-consent.yaml
HEALTH_STATUS=$?
set -e
export HEALTH_STATUS

node -e '
  const fs=require("fs"), crypto=require("crypto");
  function collect(dir) {
    for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
      const path=dir+"/"+item.name;
      if(item.isDirectory()) collect(path);
      else if(/^\d\d-[a-z-]+\.png$/.test(item.name) && dir!=="screenshots") fs.copyFileSync(path,"screenshots/"+item.name);
    }
  }
  collect("screenshots");
  const file="screenshots/provenance.json", p=JSON.parse(fs.readFileSync(file));
  const simulators=JSON.parse(fs.readFileSync(process.env.RUNNER_TEMP+"/simulators.json"));
  const match=Object.entries(simulators.devices).flatMap(([runtime,ds])=>ds.map(d=>({...d,runtime}))).find(d=>d.udid===process.env.DEVICE_ID);
  p.simulator={name:match.name,runtime:match.runtime,udid:match.udid};
  p.capturedAt=new Date().toISOString();
  p.healthConsentStatus=Number(process.env.HEALTH_STATUS);

  p.images=fs.readdirSync("screenshots").filter(f=>f.endsWith(".png")).map(name=>{
    const b=fs.readFileSync("screenshots/"+name);
    return {name,width:b.readUInt32BE(16),height:b.readUInt32BE(20),sha256:crypto.createHash("sha256").update(b).digest("hex")};
  });
  fs.writeFileSync(file,JSON.stringify(p,null,2)+"\n");
  const main=p.images.filter(x=>/^(20-health-guard|21-health-sheet-intro|22-health-unchecked|23-general-without-health|24-health-checked|25-coach-after-consent|26-profile-withdrawal|27-withdrawal-alert|28-withdrawal-cancelled)\.png$/.test(x.name));
  if(p.healthConsentStatus!==0 || main.length!==9) {
    throw new Error("Native consent QA incomplete; inspect Maestro artifacts.");
  }
'

# System logs contain only this isolated fictional app. Useful for diagnosing a
# failed fixture or a crash without publishing device/account credentials.
xcrun simctl spawn "$DEVICE_ID" log show --last 5m --style compact --predicate 'process == "NIVL"' > screenshots/simulator.log 2>/dev/null || true
