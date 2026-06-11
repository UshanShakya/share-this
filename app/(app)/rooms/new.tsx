import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useRoom } from '@/hooks/useRoom';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';

export default function NewRoomModal() {
  const theme = useTheme();
  const router = useRouter();
  const { createRoom } = useRoom();

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setName('');
    setError(null);
    setRefreshing(false);
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Room name cannot be empty.');
      return;
    }
    if (trimmedName.length > 40) {
      setError('Room name must be 40 characters or less.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const room = await createRoom(trimmedName);
      if (room) {
        // Successfully created! Navigate to canvas
        router.replace(`/rooms/${room.id}/canvas` as any);
      } else {
        setError('Failed to create room. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const isValid = name.trim().length >= 1 && name.trim().length <= 40;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.headerTitle} type="smallBold">
              New Canvas
            </ThemedText>
            <View style={styles.placeholder} />
          </View>

          {/* Form Content */}
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#7C7CF0"
                colors={['#7C7CF0']}
              />
            }
          >
            <ThemedText style={styles.label} type="code">
              CANVAS NAME
            </ThemedText>
            
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement || '#212225',
                  borderColor: theme.backgroundSelected || '#2E3135',
                },
              ]}
              placeholder="e.g. Brainstorming session"
              placeholderTextColor={theme.textSecondary || '#B0B4BA'}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (error) setError(null);
              }}
              maxLength={40}
              autoFocus
              editable={!isSubmitting}
            />
            
            <ThemedText style={styles.hint} type="code">
              {name.trim().length}/40 characters
            </ThemedText>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={(theme as any).destructive || '#ef4444'} />
                <ThemedText style={[styles.errorText, { color: (theme as any).destructive || '#ef4444' }]} type="code">
                  {error}
                </ThemedText>
              </View>
            )}

            <Pressable
              onPress={handleCreate}
              disabled={!isValid || isSubmitting}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: '#7C7CF0',
                  opacity: pressed || !isValid ? 0.8 : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <ThemedText style={styles.submitText} type="smallBold">
                    Create Room
                  </ThemedText>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    height: 56,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  form: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.5,
    marginBottom: Spacing.two,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  hint: {
    fontSize: 10,
    opacity: 0.4,
    textAlign: 'right',
    marginTop: Spacing.one,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.five,
    shadowColor: '#7C7CF0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
