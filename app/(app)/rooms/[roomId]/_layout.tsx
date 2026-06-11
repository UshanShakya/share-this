import { Stack } from 'expo-router';

export default function RoomLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="canvas" />
      <Stack.Screen name="members" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
