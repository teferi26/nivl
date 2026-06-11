# NIVL — El sistema

App móvil personal gamificada estilo Solo Leveling: misiones diarias con XP, niveles, rangos de cazador (E→S), 5 estadísticas (FUE, VIT, INT, AGI, PER), rachas con multiplicador, evidencias con bonus (+25 %) y penalización dura por misiones falladas.

Stack: Expo (React Native + TypeScript) · expo-router · Supabase (Postgres, Auth, Storage).

## Puesta en marcha (una sola vez)

1. **Base de datos** — En [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → SQL Editor, pega y ejecuta EN ORDEN: `supabase/migrations/0001_init.sql` y después `supabase/migrations/0002_fases.sql`. Crean tablas, RLS, trigger de perfil, buckets `evidence`/`avatars`, y los módulos de mazmorras, agenda, gym, dieta, compra, diario y logros.
2. **Login sin fricción** — Authentication → Sign In / Providers → Email → desactiva **Confirm email** (es una app personal; así "Crear cuenta" entra directamente).
3. **Claves** — Ya están en `.env` (`EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY`, la publishable). La `secret`/`service_role` **nunca** van en este proyecto.
4. **El Oráculo (opcional)** — Para generar misiones con IA desde un objetivo, crea una API key en [console.anthropic.com](https://console.anthropic.com) y pégala dentro de la app (Sistema → Oráculo). Se guarda solo en tu dispositivo; usa `claude-haiku-4-5` (céntimos por consulta).

## Desarrollo diario

```bash
npm start
```

Instala **Expo Go** en el móvil y escanea el QR (misma red WiFi que el PC). La primera vez: "Crear cuenta" con tu correo y una contraseña — el sistema te dará la bienvenida con 5 misiones de ejemplo.

## Cómo funciona el juego

- XP por dificultad: trivial 10 · fácil 25 · media 50 · difícil 100 · épica 250.
- Evidencia (foto en el momento): +25 % XP. El % de misiones con evidencia sale en el perfil.
- Racha: cada 7 días completos +0,1 al multiplicador (máx ×1,5). Fallar un día la reinicia.
- Penalización (al abrir la app tras medianoche): −50 % del XP base de cada misión fallada (puedes bajar de nivel), con **tope de 150 XP/día**, y aparece una **misión de penalización** que, si la completas ese día, recupera exactamente lo perdido.
- **Válvulas de escape**: cada semana perfecta forja una Piedra de Protección (máx 3) que se consume sola al fallar un día y absorbe todo el daño; y desde Perfil puedes **pausar el sistema** (exámenes, enfermedad, vacaciones) sin perder nada.
- Nivel: curva `100 × nivel^1.5` XP. Rangos: E (1-10) · D (11-25) · C (26-45) · B (46-70) · A (71-99) · S (100+).
- Mazmorras (proyectos): tareas dan XP base, jefes ×2, y despejarla da botín único (E 50 → S 600 XP). Gym: sesión 50 XP a FUE + 25 por récord personal. Diario: 15 XP a PER al día. Los logros son cualitativos (sin XP) y algunos desbloquean títulos equipables.

## Mapa de la app

5 pestañas: **Sistema** (misiones de hoy + módulos), **Misiones** (CRUD), **Mazmorras**, **Agenda** (14 días), **Perfil** (stats, válvulas, logros, compartir, export). Módulos desde Sistema: Gym, Dieta, Compra, Diario, Informe y Oráculo.

Verificación: `npm run typecheck` · `npm test` (23 tests del motor) · `npx expo export --platform android`.

## Notas

- Las notificaciones locales (8:00 misiones nuevas, 21:30 aviso de cierre) pueden no sonar dentro de Expo Go; en un development build (`npx expo run:android` o EAS Build) funcionan siempre.
- Evidencias comprimidas (calidad 0.4) para cuidar el free tier de Supabase Storage (1 GB).
- Fase 2 prevista: proyectos como mazmorras + calendario. Fase 3: gym + dieta + lista de la compra. Fase 4: diario completo + informes. Fase 5: pulido visual (partículas, sonido, widgets).
