// NIVL · Modos (fase 1). Importa desde '@/modos' en pantallas y componentes.
// Las pruebas importan '@/modos/tipos' (puro): este índice arrastra Supabase.
export * from './tipos';
export { cabecerasModoCoach, fijarModoCoach } from './coach';
export { ModoProvider, useModo, type ModoContexto } from './ModoProvider';
