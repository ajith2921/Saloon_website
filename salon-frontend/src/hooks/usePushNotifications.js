import { useState, useEffect } from 'react';
import api from '../lib/api';

// Use the same public key used on the backend
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BG9g0z-4i4b0M7v4y2h4z0yRj9xZ8yWwG7tT5bE5eD7cI5rY2hE_r_F-mY2h4z0yRj9xZ8yWwG7tT5bE5eD7cI5rY2hE=";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error('Error checking subscription', e);
    }
  };

  const subscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      
      // Send to backend
      await api.post('/api/notifications/push/subscribe', subscription.toJSON());
      
      setIsSubscribed(true);
      setPermission('granted');
    } catch (e) {
      console.error('Subscription failed', e);
      if (Notification.permission === 'denied') {
        setPermission('denied');
      }
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Remove from backend
        await api.post('/api/notifications/push/unsubscribe', { endpoint: subscription.endpoint });
        // Unsubscribe locally
        await subscription.unsubscribe();
        setIsSubscribed(false);
      }
    } catch (e) {
      console.error('Unsubscribe failed', e);
    } finally {
      setLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe
  };
}
