// No authentication credentials, owner data, or network services are used.
// Require React Native before replacing its installed networking globals.
const { Linking } = require('react-native');

// The catalogue capture uses the app's normal free-account state. Every
// other route uses the fictional Pro example, including its example chat.
global.__NIVL_SCREENSHOT_OFFER__ = false;
Linking.addEventListener('url', ({ url }) => {
  global.__NIVL_SCREENSHOT_OFFER__ = /^nivl-capture:\/\/pro(?:[/?#]|$)/.test(url);
});

const RealDate = Date;
const offset = new RealDate(2026, 8, 28, 9, 41, 0).getTime() - RealDate.now();
class ScreenshotDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + offset);
    else super(...args);
  }
  static now() { return RealDate.now() + offset; }
}
global.Date = ScreenshotDate;

const rejectNetwork = () => {
  throw new Error('SCREENSHOT_NETWORK_BLOCKED: this build uses local fixtures only.');
};
global.fetch = async () => rejectNetwork();
global.XMLHttpRequest = class ScreenshotXMLHttpRequest {
  open() { rejectNetwork(); }
  send() { rejectNetwork(); }
};
global.WebSocket = class ScreenshotWebSocket {
  constructor() { rejectNetwork(); }
};
