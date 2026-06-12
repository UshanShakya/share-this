import React from 'react';
import { Text, Platform, TextStyle } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

interface KnoodleIconProps {
  size?: number;
  theme?: 'dark' | 'light' | 'transparent';
}

export function KnoodleIcon({ size = 120, theme = 'transparent' }: KnoodleIconProps) {
  const isDark = theme === 'dark';
  const isLight = theme === 'light';

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      {isDark && <Rect width="512" height="512" rx="114" fill="#0f0f0f" />}
      {isLight && <Rect width="512" height="512" rx="114" fill="#FBEAF0" />}
      <Path
        d="M154 358 C154 282 205 230 256 256 C307 282 307 333 358 307 C410 282 410 205 358 179 C307 154 256 192 256 256 C256 320 307 358 358 333"
        fill="none"
        stroke="#D4537E"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <Circle cx="154" cy="358" r="38" fill="#7F77DD" />
      <Circle cx="358" cy="333" r="38" fill="#EF9F27" />
    </Svg>
  );
}

interface KnoodleWordmarkProps {
  fontSize?: number;
  theme?: 'dark' | 'light' | 'blush';
  style?: TextStyle;
}

export function KnoodleWordmark({
  fontSize = 38,
  theme = 'light',
  style,
}: KnoodleWordmarkProps) {
  let textColor = '#1a1a1a';
  let ooColor = '#D4537E';

  if (theme === 'dark') {
    textColor = '#FFFFFF';
    ooColor = '#F06292';
  } else if (theme === 'blush') {
    textColor = '#993556';
    ooColor = '#D4537E';
  }

  const fontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif';

  return (
    <Text
      style={[
        {
          fontFamily,
          fontSize,
          fontWeight: '500',
          color: textColor,
          letterSpacing: -1.5,
        },
        style,
      ]}
    >
      kn<Text style={{ color: ooColor }}>oo</Text>dle
    </Text>
  );
}
