// Loaded only after prepare.mjs in the isolated screenshot job.
if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') {
  throw new Error('The screenshot entry point cannot run outside screenshot mode.');
}
require('./bootstrap');
require('expo-router/entry');
