import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

interface SharedGroupInterface {
  getAppGroupPath(): string | null;
  reloadWidget(): void;
}

let SharedGroup: any = null;

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    SharedGroup = requireNativeModule<SharedGroupInterface>('SharedGroup');
  } catch (err) {
    console.warn('[SharedGroup] Native module not available. Widgets will not auto-refresh.');
  }
}

const fallbackSharedGroup: SharedGroupInterface = {
  getAppGroupPath() {
    return SharedGroup?.getAppGroupPath() ?? null;
  },
  reloadWidget() {
    SharedGroup?.reloadWidget();
  }
};

export default fallbackSharedGroup;
