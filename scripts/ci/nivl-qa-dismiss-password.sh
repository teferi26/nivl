#!/usr/bin/env bash
# Runner-local only. Input screenshots/OCR/driver logs are never uploaded.
set -euo pipefail
umask 077
UDID="$1"
PRIVATE="$2"
mkdir -p "$PRIVATE"
inspect_dialog() {
  xcrun simctl io "$UDID" screenshot "$PRIVATE/current-modal.png" > "$PRIVATE/screenshot-command.log" 2>&1
  swift scripts/ci/nivl-qa-ocr.swift --dismiss-password-point "$PRIVATE/current-modal.png" > "$PRIVATE/modal-state.json" 2> "$PRIVATE/ocr-command.log"
}
inspect_dialog
POINT=$(python3 - "$PRIVATE/modal-state.json" <<'PY'
import json,re,sys
try:
    state=json.load(open(sys.argv[1]))
    if state.get('ocr_available') is not True: sys.exit(2)
    point=state.get('point')
    if state.get('password_dialog') is True:
        if not isinstance(point,str) or not re.fullmatch(r'\d{1,2}%,\d{1,2}%',point): sys.exit(3)
        x,y=(int(part.rstrip('%')) for part in point.split(','))
        if not (1 <= x <= 99 and 1 <= y <= 99): sys.exit(3)
        print(point)
    elif state.get('modal_hint') is not False or state.get('known_screen') is not True:
        sys.exit(3)
except Exception:
    sys.exit(4)
PY
) || { echo 'QA_PASSWORD_MODAL_STATE UNVERIFIED'; exit 1; }
if [ -z "$POINT" ]; then
  echo 'QA_PASSWORD_MODAL_STATE ABSENT_VERIFIED'
  exit 0
fi
maestro --device "$UDID" test -e QA_MODAL_POINT="$POINT" \
  --test-output-dir "$PRIVATE/tap-artifacts" --debug-output "$PRIVATE/tap-artifacts" \
  e2e/maestro/dismiss-password-point.yaml > "$PRIVATE/tap-command.log" 2>&1
inspect_dialog
python3 - "$PRIVATE/modal-state.json" <<'PY'
import json,sys
try:
    state=json.load(open(sys.argv[1]))
    if (state.get('ocr_available') is not True or state.get('password_dialog') is not False
        or state.get('modal_hint') is not False or state.get('known_screen') is not True): sys.exit(1)
    print('QA_PASSWORD_MODAL_STATE DISMISSED_VERIFIED')
except Exception:
    sys.exit(1)
PY
