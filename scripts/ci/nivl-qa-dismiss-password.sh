#!/usr/bin/env bash
# Runner-local only. Input screenshots/OCR/driver logs are never uploaded.
#
# Waits for the login to settle: against the real server it takes seconds, and
# the system alert appears after it. One look right after Enter can catch an
# unknown screen, or the login itself with the alert still to come.
set -euo pipefail
umask 077
UDID="$1"
PRIVATE="$2"
mkdir -p "$PRIVATE"
inspect_dialog() {
  rm -f "$PRIVATE/modal-state.json"
  xcrun simctl io "$UDID" screenshot "$PRIVATE/current-modal.png" > "$PRIVATE/screenshot-command.log" 2>&1 \
    && swift scripts/ci/nivl-qa-ocr.swift --dismiss-password-point "$PRIVATE/current-modal.png" > "$PRIVATE/modal-state.json" 2> "$PRIVATE/ocr-command.log" \
    || true
}
# Prints DIALOG <point>, SETTLED or WAIT.
classify() {
  python3 - "$PRIVATE/modal-state.json" <<'PY'
import json,re,sys
try:
    s=json.load(open(sys.argv[1]))
except Exception:
    print('WAIT'); sys.exit()
point=s.get('point')
if s.get('ocr_available') is True and s.get('password_dialog') is True and isinstance(point,str) and re.fullmatch(r'\d{1,2}%,\d{1,2}%',point):
    print('DIALOG',point)
elif (s.get('ocr_available') is True and s.get('password_dialog') is False and s.get('modal_hint') is False
      and s.get('known_screen') is True and s.get('login_visible') is False):
    print('SETTLED')
else:
    print('WAIT')
PY
}
POINT=''
SETTLED=0
LIMIT=$((SECONDS + 90))
while [ "$SECONDS" -lt "$LIMIT" ]; do
  inspect_dialog
  STATE=$(classify)
  case "$STATE" in
    DIALOG*) POINT="${STATE#DIALOG }"; break ;;
    SETTLED) SETTLED=$((SETTLED + 1)) ;;
    *) SETTLED=0 ;;
  esac
  # The alert can come a moment after the next screen: require three looks in a row.
  if [ "$SETTLED" -ge 3 ]; then
    echo 'QA_PASSWORD_MODAL_STATE ABSENT_VERIFIED'
    exit 0
  fi
  sleep 2
done
if [ -z "$POINT" ]; then
  echo 'QA_PASSWORD_MODAL_STATE UNVERIFIED'
  exit 1
fi
maestro --device "$UDID" test -e QA_MODAL_POINT="$POINT" \
  --test-output-dir "$PRIVATE/tap-artifacts" --debug-output "$PRIVATE/tap-artifacts" \
  e2e/maestro/dismiss-password-point.yaml > "$PRIVATE/tap-command.log" 2>&1
LIMIT=$((SECONDS + 30))
while [ "$SECONDS" -lt "$LIMIT" ]; do
  inspect_dialog
  if [ "$(classify)" = 'SETTLED' ]; then
    echo 'QA_PASSWORD_MODAL_STATE DISMISSED_VERIFIED'
    exit 0
  fi
  sleep 2
done
echo 'QA_PASSWORD_MODAL_STATE UNVERIFIED'
exit 1
