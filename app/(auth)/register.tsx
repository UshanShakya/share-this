import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { Colors } from '../../src/constants/Colors';
import { KnoodleIcon, KnoodleWordmark } from '../../src/components/KnoodleBrand';

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'dark'];
  const router = useRouter();
  const { signUp, signInWithGoogle, error: authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const validate = () => {
    const errors: { [key: string]: string } = {};

    if (!email) {
      errors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (!username) {
      errors.username = 'Username is required.';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.username = 'Only alphanumeric, underscores, and dashes allowed.';
    }

    if (!displayName.trim()) {
      errors.displayName = 'Display Name is required.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    const result = await signUp(email, password, username, displayName);
    setLoading(false);

    if (result.success) {
      router.replace('/(app)');
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);

    if (result.success) {
      router.replace('/(app)');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={{ marginBottom: 16 }}>
            <KnoodleIcon size={80} theme="transparent" />
          </View>
          <KnoodleWordmark width={180} height={45} theme={colorScheme === 'dark' ? 'dark' : 'light'} />
          <Text style={[styles.subtitle, { color: colors.textSecondary, marginTop: 12 }]}>
            Join Knoodle and sketch together
          </Text>
        </View>

        <View style={styles.form}>
          {authError && (
            <View style={[styles.errorBox, { backgroundColor: colors.destructive + '15' }]}>
              <Text style={[styles.errorBoxText, { color: colors.destructive }]}>{authError}</Text>
            </View>
          )}

          {/* Display Name Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Display Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: validationErrors.displayName ? colors.destructive : colors.border,
                },
              ]}
              placeholder="e.g. John Doe"
              placeholderTextColor={colors.textSecondary}
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                if (validationErrors.displayName) {
                  setValidationErrors((prev) => ({ ...prev, displayName: '' }));
                }
              }}
            />
            {validationErrors.displayName && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {validationErrors.displayName}
              </Text>
            )}
          </View>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: validationErrors.username ? colors.destructive : colors.border,
                },
              ]}
              placeholder="e.g. johndoe"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (validationErrors.username) {
                  setValidationErrors((prev) => ({ ...prev, username: '' }));
                }
              }}
            />
            {validationErrors.username && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {validationErrors.username}
              </Text>
            )}
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: validationErrors.email ? colors.destructive : colors.border,
                },
              ]}
              placeholder="e.g. john@example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (validationErrors.email) {
                  setValidationErrors((prev) => ({ ...prev, email: '' }));
                }
              }}
            />
            {validationErrors.email && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {validationErrors.email}
              </Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
            <View
              style={[
                styles.passwordInputWrapper,
                {
                  backgroundColor: colors.surface,
                  borderColor: validationErrors.password ? colors.destructive : colors.border,
                },
              ]}
            >
              <TextInput
                style={[
                  styles.passwordInput,
                  {
                    color: colors.text,
                  },
                ]}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (validationErrors.password) {
                    setValidationErrors((prev) => ({ ...prev, password: '' }));
                  }
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {validationErrors.password && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {validationErrors.password}
              </Text>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={handleRegister}
            disabled={loading || googleLoading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Google Sign-in Button */}
          <TouchableOpacity
            style={[styles.googleButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleGoogleRegister}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.text} style={{ marginRight: 8 }} />
                <Text style={[styles.googleButtonText, { color: colors.text }]}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Switch to Login */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={[styles.linkText, { color: colors.accent }]}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 50,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  errorBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(229, 72, 77, 0.2)',
  },
  errorBoxText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    padding: 0,
  },
  eyeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 10,
  },
});
