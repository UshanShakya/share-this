import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import SharedGroup from 'shared-group';

const getSharedDirectory = (): string | null => {
  if (Platform.OS === 'ios') {
    const groupPath = SharedGroup.getAppGroupPath();
    if (groupPath) {
      return `file://${groupPath}/`;
    }
    return null;
  } else {
    return FileSystem.documentDirectory;
  }
};

const writeSharedJSON = async (filename: string, data: any) => {
  const dir = getSharedDirectory();
  if (!dir) {
    console.warn(`[sharedStorage] Shared directory not available for ${filename}`);
    return;
  }
  
  const fileUri = `${dir}${filename}`;
  try {
    const jsonString = JSON.stringify(data, null, 2);
    await FileSystem.writeAsStringAsync(fileUri, jsonString);
    console.log(`[sharedStorage] Wrote ${filename} to ${fileUri}`);
  } catch (err) {
    console.error(`[sharedStorage] Error writing ${filename}:`, err);
  }
};

export const sharedStorage = {
  syncAuth: async (jwt: string | null) => {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
    
    await writeSharedJSON('widget_auth.json', {
      supabaseUrl,
      supabaseAnonKey,
      jwt,
    });
  },

  syncRooms: async (rooms: { id: string; name: string }[]) => {
    // Format to clean up fields
    const formattedRooms = rooms.map(r => ({ id: r.id, name: r.name }));
    await writeSharedJSON('widget_rooms.json', {
      rooms: formattedRooms,
    });
  },

  syncActiveRoom: async (roomId: string | null) => {
    await writeSharedJSON('widget_active.json', {
      roomId,
    });
  },

  reloadWidget: () => {
    if (reloadTimeout) {
      clearTimeout(reloadTimeout);
    }
    reloadTimeout = setTimeout(() => {
      try {
        SharedGroup.reloadWidget();
        console.log('[sharedStorage] Triggered widget reload');
      } catch (err) {
        console.error('[sharedStorage] Error reloading widget:', err);
      }
    }, 2000); // 2-second debounce
  }
};

let reloadTimeout: ReturnType<typeof setTimeout> | null = null;
