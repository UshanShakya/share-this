import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface KnoodleSplashScreenProps {
  onAnimationComplete?: () => void;
}

const SVG_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #0f0f0f;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    svg {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
    }
    @keyframes draw {
      0%   { stroke-dashoffset: 320; }
      50%  { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: -320; }
    }
    @keyframes pulse1 { 0%,100%{opacity:1} 50%{opacity:0.2} }
    @keyframes pulse2 { 0%,100%{opacity:0.2} 50%{opacity:1} }
    @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @media (prefers-reduced-motion: no-preference) {
      .lp { stroke-dasharray: 320; animation: draw 2s cubic-bezier(0.4,0,0.2,1) infinite; }
      .d1 { animation: pulse1 2s ease-in-out infinite; }
      .d2 { animation: pulse2 2s ease-in-out infinite; }
      .k-word { animation: fadein 0.4s ease forwards 1.0s; opacity: 0; }
      .k-tag  { animation: fadein 0.4s ease forwards 1.3s; opacity: 0; }
    }
  </style>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid meet">
    <rect width="390" height="844" fill="#0f0f0f"/>
    <g transform="translate(135, 342)">
      <path class="lp"
        d="M36 84 C36 66 48 54 60 60 C72 66 72 78 84 72 C96 66 96 48 84 42 C72 36 60 45 60 60 C60 75 72 84 84 78"
        fill="none" stroke="#D4537E" stroke-width="6" stroke-linecap="round"/>
      <circle class="d1" cx="36" cy="84" r="8" fill="#7F77DD"/>
      <circle class="d2" cx="84" cy="78" r="8" fill="#EF9F27"/>
    </g>
    <g class="k-word">
      <text x="195" y="490" font-family="Georgia, serif" font-size="48" font-weight="500"
        letter-spacing="-1.5" fill="#ffffff" text-anchor="middle">kn<tspan fill="#F06292">oo</tspan>dle</text>
    </g>
    <g class="k-tag">
      <text x="195" y="524" font-family="Georgia, serif" font-size="15"
        fill="#555555" text-anchor="middle" letter-spacing="0.06em">draw together</text>
    </g>
  </svg>
</body>
</html>
`;

export function KnoodleSplashScreen({ onAnimationComplete }: KnoodleSplashScreenProps) {
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Keep splash visible for 2.0 seconds (snappy loading)
    const timer = setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]} pointerEvents="none">
      <WebView
        originWhitelist={['*']}
        source={{ html: SVG_HTML }}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
        scrollEnabled={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        pointerEvents="none"
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0f0f0f',
    zIndex: 99999,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
});

