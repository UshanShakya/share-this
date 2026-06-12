import React from 'react';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';

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
  width?: number;
  height?: number;
  theme?: 'dark' | 'light' | 'blush';
}

export function KnoodleWordmark({
  width = 240,
  height = 60,
  theme = 'light',
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

  return (
    <Svg width={width} height={height} viewBox="0 0 480 120">
      <Path
        d="M18 84 C18 53 38 35 56 44 C74 53 74 72 92 63 C110 53 110 28 92 19 C74 10 56 22 56 44 C56 66 74 78 92 69"
        fill="none"
        stroke="#D4537E"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <Circle cx="18" cy="84" r="9" fill="#7F77DD" />
      <Circle cx="92" cy="69" r="9" fill="#EF9F27" />
      <SvgText
        x="112"
        y="78"
        fontFamily="Georgia"
        fontSize="64"
        fontWeight="500"
        letterSpacing="-2"
        fill={textColor}
      >
        kn
      </SvgText>
      <SvgText
        x="226"
        y="78"
        fontFamily="Georgia"
        fontSize="64"
        fontWeight="500"
        letterSpacing="-2"
        fill={ooColor}
      >
        oo
      </SvgText>
      <SvgText
        x="332"
        y="78"
        fontFamily="Georgia"
        fontSize="64"
        fontWeight="500"
        letterSpacing="-2"
        fill={textColor}
      >
        dle
      </SvgText>
    </Svg>
  );
}
