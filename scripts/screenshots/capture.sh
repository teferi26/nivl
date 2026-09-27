#!/usr/bin/env bash
set -euo pipefail

mkdir -p screenshots
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

capture() {
  local name="$1"
  local route="$2"
  xcrun simctl openurl "$DEVICE_ID" "nivl-capture://$route"
  sleep 8
  xcrun simctl io "$DEVICE_ID" screenshot --type=png "screenshots/$name.png"
}

capture 01-hoy ''
capture 02-plan 'agenda'
capture 03-coach 'coach'
capture 04-gym 'gym'
capture 05-dinero 'economia'
capture 06-amigos 'amigos'
capture 07-avances 'avances'
capture 08-pro 'pro'
capture 09-habitos 'habitos'

node -e '
  const fs=require("fs"), crypto=require("crypto");
  const file="screenshots/provenance.json", p=JSON.parse(fs.readFileSync(file));
  const simulators=JSON.parse(fs.readFileSync(process.env.RUNNER_TEMP+"/simulators.json"));
  const match=Object.entries(simulators.devices).flatMap(([runtime,ds])=>ds.map(d=>({...d,runtime}))).find(d=>d.udid===process.env.DEVICE_ID);
  p.simulator={name:match.name,runtime:match.runtime,udid:match.udid};
  p.capturedAt=new Date().toISOString();
  p.images=fs.readdirSync("screenshots").filter(f=>f.endsWith(".png")).map(name=>{
    const b=fs.readFileSync("screenshots/"+name);
    return {name,width:b.readUInt32BE(16),height:b.readUInt32BE(20),sha256:crypto.createHash("sha256").update(b).digest("hex")};
  });
  fs.writeFileSync(file,JSON.stringify(p,null,2)+"\n");
'

# System logs contain only this isolated fictional app. Useful for diagnosing a
# failed fixture or a crash without publishing device/account credentials.
xcrun simctl spawn "$DEVICE_ID" log show --last 5m --style compact --predicate 'process == "NIVL"' > screenshots/simulator.log 2>/dev/null || true
