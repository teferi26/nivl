// Expo's fetch uses a separate native request path, so block it as well as
// the React Native globals. Even an accidental send stays entirely offline.
export async function fetch(): Promise<never> {
  throw new Error('SCREENSHOT_NETWORK_BLOCKED: this build uses local fixtures only.');
}
