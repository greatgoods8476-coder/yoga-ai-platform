// Web build of the WebView wrapper. react-native-webview has no web target
// (it throws "React Native WebView does not support this platform" there),
// so this drops to a real DOM <iframe>. Ready Player Me's creator already
// calls window.parent.postMessage(...) directly (standard embeddable-widget
// behavior), so on web we can listen with a plain window 'message' listener
// -- no injected bridge script needed, that trick was only for reaching
// across React Native's native WebView bridge.
import React, { useEffect } from 'react';

export type WebViewMessageEvent = { nativeEvent: { data: string } };

export function WebView({
  source, onMessage, style,
}: {
  source: { uri: string } | { html: string };
  onMessage?: (event: WebViewMessageEvent) => void;
  injectedJavaScript?: string;
  style?: any;
}) {
  useEffect(() => {
    if (!onMessage) return;
    function handler(event: MessageEvent) {
      const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      onMessage!({ nativeEvent: { data } });
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  const src = 'uri' in source ? source.uri : undefined;
  const srcDoc = 'html' in source ? source.html : undefined;

  return (
    // eslint-disable-next-line jsx-a11y/iframe-has-title
    <iframe
      src={src}
      srcDoc={srcDoc}
      style={{ border: 'none', width: '100%', height: '100%', flex: 1, ...(style || {}) }}
      allow="camera; microphone"
    />
  );
}
