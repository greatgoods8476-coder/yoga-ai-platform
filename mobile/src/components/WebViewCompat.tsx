// Native (iOS/Android) implementation -- just the real thing. The web
// build uses WebViewCompat.web.tsx instead (Metro/Expo picks it up
// automatically for web bundles), since react-native-webview has no web
// target at all and throws "does not support this platform" there.
export { WebView } from 'react-native-webview';
export type { WebViewMessageEvent } from 'react-native-webview';
