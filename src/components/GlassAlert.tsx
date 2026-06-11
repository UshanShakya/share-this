import React from 'react';
import { Modal, StyleSheet, View, Text, Pressable, useColorScheme } from 'react-native';
import { useAlertStore } from '../store/alertStore';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

export function GlassAlert() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'light' ? 'light' : 'dark'];
  const { visible, title, message, buttons, hide } = useAlertStore();

  if (!visible) return null;

  const handleButtonPress = (onPress?: () => void | Promise<void>) => {
    hide();
    if (onPress) {
      // Small timeout to allow Modal closing animation to complete cleanly before triggering actions
      setTimeout(() => {
        onPress();
      }, 100);
    }
  };

  const isDark = scheme === 'dark';

  // Determine Alert Type & Icon
  const titleLower = title.toLowerCase();
  const messageLower = message.toLowerCase();
  const hasDestructive = buttons.some(btn => btn.style === 'destructive');
  
  let iconName: string | null = 'information-circle-outline';
  let iconColor: string = colors.accent || '#7C7CF0';
  let glowColor = 'rgba(124, 124, 240, 0.15)';

  if (titleLower.includes('error') || titleLower.includes('fail') || messageLower.includes('error') || messageLower.includes('failed')) {
    iconName = 'alert-circle-outline';
    iconColor = colors.destructive || '#F16063';
    glowColor = 'rgba(241, 96, 99, 0.15)';
  } else if (titleLower.includes('success') || titleLower.includes('joined') || titleLower.includes('copied')) {
    iconName = 'checkmark-circle-outline';
    iconColor = '#4ade80';
    glowColor = 'rgba(74, 222, 128, 0.15)';
  } else if (hasDestructive || titleLower.includes('remove') || titleLower.includes('delete') || titleLower.includes('sign out') || titleLower.includes('unfriend')) {
    iconName = 'warning-outline';
    iconColor = colors.destructive || '#F16063';
    glowColor = 'rgba(241, 96, 99, 0.15)';
  } else if (titleLower.includes('invite')) {
    iconName = 'mail-open-outline';
    iconColor = colors.accent || '#7C7CF0';
    glowColor = 'rgba(124, 124, 240, 0.15)';
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={hide}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.alertCard,
            {
              backgroundColor: isDark ? 'rgba(26, 27, 30, 0.88)' : 'rgba(255, 255, 255, 0.90)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          {/* Icon Header */}
          {iconName && (
            <View style={[styles.iconWrapper, { backgroundColor: glowColor }]}>
              <Ionicons name={iconName as any} size={28} color={iconColor} />
            </View>
          )}

          {/* Header */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {/* Message */}
          {message ? (
            <Text style={[styles.message, { color: isDark ? '#B0B4BA' : '#666666' }]}>
              {message}
            </Text>
          ) : null}

          {/* Buttons Row / Stack */}
          <View
            style={[
              styles.buttonContainer,
              buttons.length > 2 ? styles.buttonStack : styles.buttonRow,
            ]}
          >
            {buttons.map((btn, idx) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';

              let btnBg: string = colors.accent || '#7C7CF0';
              let textColor = '#FFFFFF';
              let borderColor = 'transparent';
              let borderWidth = 0;

              if (isDestructive) {
                btnBg = colors.destructive || '#ef4444';
              } else if (isCancel) {
                btnBg = 'transparent';
                textColor = colors.text;
                borderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
                borderWidth = 1;
              }

              return (
                <Pressable
                  key={idx}
                  onPress={() => handleButtonPress(btn.onPress)}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      backgroundColor: btnBg,
                      borderColor,
                      borderWidth,
                      opacity: pressed ? 0.8 : 1,
                      flex: buttons.length > 2 ? undefined : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: textColor, fontWeight: isCancel ? '600' : '700' },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonStack: {
    flexDirection: 'column',
  },
  button: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 14,
  },
});
