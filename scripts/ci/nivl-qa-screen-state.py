"""Read private native evidence; emit only fixed booleans and counts."""
import json
import os
import pathlib
import sys
import time

recovery = '--recovery' in sys.argv
if recovery:
    sys.argv.remove('--recovery')
source = pathlib.Path(sys.argv[1])
ocr_path = pathlib.Path(sys.argv[2])
labels = {
    'login_intro': 'Entra con tu correo y tu contraseña de NIVL.',
    'email_field': 'Correo electrónico',
    'password_field': 'Contraseña',
    'submit': 'Entrar',
    'age_heading': 'Tu edad',
    'age_check': 'Tengo 16 años o más',
    'age_confirm': 'Confirmar y continuar',
    'age_retry': 'Volver a comprobar',
    'loading': 'Cargando',
    'retry': 'Reintentar',
    'onboarding_start': 'Entrar en la arena',
    'today': 'Hoy',
    "name_header": "¿Cómo te llamas?",
    "name_inscription": "El nombre",
    "name_field": "Tu nombre",
    "kind_header": "¿Para qué vas a usar NIVL?",
    "kind_inscription": "El camino",
    "kind_general": "En general",
    "goal_header": "¿A qué has venido?",
    "goal_inscription": "El objetivo",
    "goal_field": "Tu objetivo, en una frase",
    "goal_placeholder": "Leer doce libros este año",
    "goal_health_checkbox": "Mi objetivo incluye salud o entrenamiento",
    "quests_header": "Tus primeras misiones",
    "quests_inscription": "Las misiones",
    "quests_training": "Entrenar",
    "quests_work": "Trabajo o estudio 2 h",
    "quests_food": "Registrar comidas del día",
    "quests_reading": "Leer 20 minutos",
    "quests_diary": "Diario del día",
    "quests_skip": "Empezar sin misiones",
    "signature_header": "Fírmalo contigo",
    "signature_inscription": "La firma",
    "signature_label": "Escribe tu nombre",
    "signature_field": "Escribe tu nombre para firmar",
    "signature_hold": "Mantén pulsado para firmar",
    "signature_sealed": "Sellado.",
    "offer_header": "Firmado. Ahora, quién lo dirige.",
    "offer_inscription": "El coach",
    "offer_skip": "Seguir gratis por ahora",
    'crash': 'EL SISTEMA HA FALLADO',
    'bad_credentials': 'Correo o contraseña incorrectos.',
    'invalid_email_format': 'Formato de correo no válido.',
    'invalid_email': 'El correo no tiene un formato válido.',
    'rate_limited': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    'captcha_failed': 'No se ha podido comprobar que no eres un robot. Vuelve a intentarlo.',
    'session_expired': 'Tu sesión ha caducado. Abre de nuevo el enlace del correo.',
    'offline': 'Sin conexión. El sistema lo reintentará cuando vuelvas a tener red.',
    'generic_failure': 'El sistema no ha podido completar la operación.',
    'save_password': 'Guardar contraseña',
    'save_password_en': 'Save Password',
    'not_now': 'Ahora no',
    'not_now_en': 'Not Now',
    'dont_save': 'No guardar',
    'later': 'Más tarde',
    'springboard_search': 'Buscar',
    'springboard_search_en': 'Search',
}
found = {key: False for key in labels}
technical = {
    'FamilyUndefined': ('family', 'undefined'),
    'MissingContext': ('missing context', 'falta contexto', 'must be used within', 'falta edadminimaprovider', 'falta authprovider'),
    'TextOutsideText': ('text strings must be rendered within',),
    'worklet_error': ('worklet',),
    'rnsvg_error': ('rnsvg',),
    'EdadVista': ('edadvista',),
    'EncabezadoArena': ('encabezadoarena',),
    'Entrada': ('entrada',),
    'Screen': ('screen',),
    'ProtectedStack': ('protectedstack',),
}
technical_found = {key: False for key in technical}
node_count = 0
parsed_count = 0
field_states = {'email_equals_fixture': [], 'password_nonempty': [],
                'submit_ax_enabled': [], 'submit_ax_busy': []}


def native_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.casefold() in ('true', 'false'):
        return value.casefold() == 'true'
    return None


def inspect_controls(node, attrs):
    # Unknown remains null: label-only nodes cannot prove control identity.
    label = attrs.get('accessibilityText', attrs.get('label', ''))
    if not isinstance(label, str):
        return
    role = str(attrs.get('role', attrs.get('accessibilityRole', attrs.get('elementType', '')))).casefold()
    focused = node.get('focused') is True or native_bool(attrs.get('focused')) is True
    is_input = focused or role in ('textfield', 'securetextfield', 'xcuielementtypetextfield', 'xcuielementtypesecuretextfield')
    hint = attrs.get('hintText')
    if label.casefold() == 'correo electrónico' and (is_input or hint == 'tu@correo.com'):
        value = attrs.get('value')
        fixture = os.environ.get('NIVL_SHOTS_EMAIL') or os.environ.get('NIVL_QA_EMAIL')
        if isinstance(value, str) and fixture and value != hint:
            field_states['email_equals_fixture'].append(value.strip().casefold() == fixture.strip().casefold())
    if label.casefold() == 'contraseña' and (is_input or hint == '••••••••••'):
        value = attrs.get('value')
        if isinstance(value, str) and value != hint and value != 'Contraseña':
            field_states['password_nonempty'].append(bool(value))
    if label.casefold() == 'entrar' and role in ('button', 'xcuielementtypebutton'):
        enabled = native_bool(node.get('enabled', attrs.get('enabled')))
        busy = native_bool(node.get('busy', attrs.get('busy')))
        if enabled is not None:
            field_states['submit_ax_enabled'].append(enabled)
        if busy is not None:
            field_states['submit_ax_busy'].append(busy)


def match(value):
    if not isinstance(value, str):
        return
    normalized = ' '.join(value.split()).casefold()
    for key, markers in technical.items():
        if key == 'FamilyUndefined':
            technical_found[key] |= all(marker in normalized for marker in markers)
        else:
            technical_found[key] |= any(marker in normalized for marker in markers)
    for key, label in labels.items():
        expected = label.casefold()
        if normalized == expected:
            found[key] = True
    if normalized.startswith('sellado.'):
        found['signature_sealed'] = True
    # Only fixed system-dialog prefixes; never emit their suffix or unknown text.
    for key, prefix in [('save_password', '¿guardar contraseña'),
                        ('save_password_en', 'would you like to save this password'),
                        ('save_password', 'guardar esta contraseña')]:
        if normalized.startswith(prefix):
            found[key] = True


def visit(node):
    global node_count
    if isinstance(node, list):
        for child in node:
            visit(child)
    elif isinstance(node, dict):
        attrs = node.get('attributes')
        if isinstance(attrs, dict):
            node_count += 1
            inspect_controls(node, attrs)
            for field in ('text', 'hintText', 'accessibilityText', 'label'):
                match(attrs.get(field))
        # Wrappers may contain a root/tree or arrays; consume only hierarchy files.
        for key, child in node.items():
            if key != 'attributes' and isinstance(child, (dict, list)):
                visit(child)


# Official Maestro 2.10 layout: screen-hierarchy/<step-stem>.json.
# Never parse commands.json: its expected selectors would create false positives.
trees = [p for p in source.rglob('*.json')
         if 'screen-hierarchy' in p.parts and not p.is_symlink()
         and 'recovery' not in p.relative_to(source).parts and p.stat().st_size <= 20*1024*1024]
for item in sorted(trees, key=lambda p: p.stat().st_mtime, reverse=True)[:1]:
    try:
        visit(json.loads(item.read_text(encoding='utf-8')))
        parsed_count += 1
    except Exception:
        pass
ocr_available = False
try:
    recognized = json.loads(ocr_path.read_text(encoding='utf-8'))
    if isinstance(recognized, list):
        for value in recognized:
            match(value)
        # OCR may split a fixed heading or error across adjacent lines.
        for width in (2, 3):
            for index in range(len(recognized) - width + 1):
                window = recognized[index:index + width]
                if all(isinstance(value, str) for value in window):
                    match(' '.join(window))
        ocr_available = bool(recognized)
except Exception:
    pass
# Command metadata is parsed separately, never fed into label/field matching.
# Official MaestroCommand field names map only to a fixed public enum.
command_types = {
    'tapOnElement': 'TAP_ELEMENT', 'tapOnPoint': 'TAP_POINT',
    'tapOnPointV2Command': 'TAP_POINT', 'assertConditionCommand': 'ASSERT_CONDITION',
    'assertCommand': 'ASSERT_CONDITION', 'inputTextCommand': 'INPUT_TEXT',
    'pressKeyCommand': 'PRESS_KEY', 'launchAppCommand': 'LAUNCH_APP',
    'openLinkCommand': 'OPEN_LINK', 'scrollUntilVisibleCommand': 'SCROLL_UNTIL_VISIBLE',
    'scrollCommand': 'SCROLL', 'runFlowCommand': 'RUN_FLOW',
}
tap_selectors = {
    "^Correo electrónico$": "LOGIN_EMAIL",
    "^Contraseña$": "LOGIN_PASSWORD",
    "^Entrar$": "LOGIN_SUBMIT",
    "Ahora no|Not Now|No guardar|Más tarde": "DISMISS_SYSTEM_DIALOG",
    "^Tengo 16 años o más$": "AGE_CHECKBOX",
    "^Confirmar y continuar$": "AGE_CONFIRM",
    "^Entrar en la arena$": "ONBOARDING_START",
    "^Tu nombre$": "NAME_INPUT",
    "^Continuar$": "CONTINUE",
    "^En general$": "KIND_GENERAL",
    "^Tu objetivo, en una frase$": "GOAL_INPUT",
    "^Leer doce libros este año$": "GOAL_INPUT",
    "^(Tu objetivo, en una frase|Leer doce libros este año)$": "GOAL_INPUT",
    "^Entrenar$": "QUEST_TRAINING",
    "^Trabajo o estudio 2 h$": "QUEST_WORK",
    "^Registrar comidas del día$": "QUEST_FOOD",
    "^Leer 20 minutos$": "QUEST_READING",
    "^Diario del día$": "QUEST_DIARY",
    "^Empezar sin misiones$": "QUEST_SKIP",
    "^Escribe tu nombre$": "SIGNATURE_LABEL",
    "^Escribe tu nombre para firmar$": "SIGNATURE_INPUT",
    "^Mantén pulsado para firmar$": "SIGNATURE_HOLD",
    "^Seguir gratis por ahora$": "OFFER_SKIP",
}
failed_command_type = 'UNKNOWN'
failed_tap_selector = 'UNKNOWN'
command_files = [p for p in source.rglob('commands.json') if not p.is_symlink()
                 and 'recovery' not in p.relative_to(source).parts
                 and p.stat().st_size <= 20*1024*1024]
for command_file in sorted(command_files, key=lambda p: p.stat().st_mtime, reverse=True):
    try:
        records = json.loads(command_file.read_text(encoding='utf-8'))
        if not isinstance(records, list): continue
        for record in reversed(records):
            if not isinstance(record, dict) or record.get('metadata', {}).get('status') != 'FAILED': continue
            command = record.get('command', {})
            if not isinstance(command, dict): continue
            matches = [enum for key, enum in command_types.items() if command.get(key) is not None]
            if len(matches) == 1 and matches[0] != 'RUN_FLOW':
                failed_command_type = matches[0]
                if failed_command_type == 'TAP_POINT':
                    failed_tap_selector = 'POINT'
                elif failed_command_type == 'TAP_ELEMENT':
                    tap = command.get('tapOnElement')
                    if isinstance(tap, dict) and isinstance(tap.get('selector'), dict):
                        selector = tap['selector'].get('textRegex')
                        if isinstance(selector, str):
                            failed_tap_selector = tap_selectors.get(selector, 'UNKNOWN')
                break
        if failed_command_type != 'UNKNOWN': break
    except Exception:
        pass

# Publish only agreement across safely identified controls, otherwise unknown/null.
control_flags = {key: values[0] if values and all(value == values[0] for value in values) else None
                 for key, values in field_states.items()}
prefix = 'QA_RECOVERY_SCREEN_STATE' if recovery else 'QA_ORIGINAL_SCREEN_STATE'
print(prefix + ' ' + json.dumps({
    'diagnostic_available': parsed_count > 0,
    'ocr_available': ocr_available,
    'node_count': node_count,
    'failed_command_type': failed_command_type,
    'failed_tap_selector': failed_tap_selector,
    **found,
    **technical_found,
    **control_flags,
}, sort_keys=True))

crash_count = 0
crash_markers = {name: False for name in ('EXC_BAD_ACCESS', 'SIGABRT', 'reanimated', 'rnsvg')}
for folder_arg in sys.argv[3:]:
    folder = pathlib.Path(folder_arg)
    if not folder.exists():
        continue
    for item in folder.glob('*.ips'):
        if item.is_symlink() or not item.name.lower().startswith('nivl'):
            continue
        if time.time() - item.stat().st_mtime > 300 or item.stat().st_size > 20*1024*1024:
            continue
        try:
            content = item.read_text(encoding='utf-8').casefold()
            crash_count += 1
            for marker in crash_markers:
                crash_markers[marker] |= marker.casefold() in content
        except Exception:
            pass
print('QA_NATIVE_CRASH_STATE ' + json.dumps({'count': crash_count, **crash_markers}, sort_keys=True))
