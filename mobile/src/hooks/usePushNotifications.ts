import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Registers this device for push notifications and hands the Expo push
// token to the backend. Expo's push service relays to both APNs and FCM —
// no Apple/Google credentials needed for this to work.
//
// Two real-world caveats this can't route around: (1) remote push requires
// a physical device (simulators/emulators can't receive them), and
// (2) as of Expo SDK 53+, remote push notifications require a development
// or production build — Expo Go can no longer receive them. Both failure
// modes are caught and swallowed here rather than surfaced to the user,
// since push is a enhancement, not a feature the rest of the app depends on.
export function useRegisterPushToken(authToken: string | null) {
  useEffect(() => {
    if (!authToken || Platform.OS === 'web') return;

    (async () => {
      try {
        if (!Device.isDevice) return; // simulators/emulators can't receive push

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const pushToken = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

        await api.registerPushToken(authToken, pushToken.data, Platform.OS);
      } catch (err) {
        console.log('push registration skipped:', err instanceof Error ? err.message : err);
      }
    })();
  }, [authToken]);
}
