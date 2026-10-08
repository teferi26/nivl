"""Read private native evidence; emit only fixed booleans and counts."""
import json
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
    'crash': 'EL SISTEMA HA FALLADO',
    'bad_credentials': 'Correo o contraseña incorrectos.',
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
for item in sorted(trees, key=lambda p: p.stat().st_mtime, reverse=True)[:3]:
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
prefix = 'QA_RECOVERY_SCREEN_STATE' if recovery else 'QA_ORIGINAL_SCREEN_STATE'
print(prefix + ' ' + json.dumps({
    'diagnostic_available': parsed_count > 0,
    'ocr_available': ocr_available,
    'node_count': node_count,
    **found,
    **technical_found,
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
