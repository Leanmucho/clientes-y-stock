import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// On web, use localStorage (works natively in browsers).
// On native (Android/iOS), use expo-file-system to persist the session across app restarts.
// Without a storage adapter, React Native has no localStorage and sessions are lost on close.

function makeWebStorage() {
  return {
    getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
    removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
  };
}

async function makeNativeStorage() {
  const FileSystem = await import('expo-file-system');
  const SESSION_FILE = `${FileSystem.documentDirectory}sb-session.json`;

  async function readStore(): Promise<Record<string, string>> {
    try {
      const info = await FileSystem.getInfoAsync(SESSION_FILE);
      if (!info.exists) return {};
      const content = await FileSystem.readAsStringAsync(SESSION_FILE);
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  async function writeStore(store: Record<string, string>): Promise<void> {
    try {
      await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify(store));
    } catch {}
  }

  return {
    getItem: async (key: string): Promise<string | null> => {
      const store = await readStore();
      return store[key] ?? null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      const store = await readStore();
      store[key] = value;
      await writeStore(store);
    },
    removeItem: async (key: string): Promise<void> => {
      const store = await readStore();
      delete store[key];
      await writeStore(store);
    },
  };
}

// Build storage synchronously for web, lazily for native
const storage = Platform.OS === 'web'
  ? makeWebStorage()
  : (() => {
      // Lazy proxy: each call awaits the real storage
      let _storage: Awaited<ReturnType<typeof makeNativeStorage>> | null = null;
      const pending = makeNativeStorage().then(s => { _storage = s; });

      return {
        getItem: async (key: string) => {
          if (!_storage) await pending;
          return _storage!.getItem(key);
        },
        setItem: async (key: string, value: string) => {
          if (!_storage) await pending;
          return _storage!.setItem(key, value);
        },
        removeItem: async (key: string) => {
          if (!_storage) await pending;
          return _storage!.removeItem(key);
        },
      };
    })();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
