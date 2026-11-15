import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

function Star({ x, y, s, d, delay }) {
  const o = useRef(new Animated.Value(0.1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.9, duration: d, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.1, duration: d, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: `${x}%`, top: `${y}%`, width: s, height: s, borderRadius: s,
      backgroundColor: '#fff', opacity: o, shadowColor: '#fff', shadowOpacity: 1, shadowRadius: 4,
    }} />
  );
}

export default function Stars({ count = 26 }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => {
    const r = (n) => { const v = Math.sin(i * 97.13 + n * 12.7) * 43758.5453; return v - Math.floor(v); };
    return { x: r(1) * 100, y: r(2) * 100, s: 1 + r(3) * 2.5, d: 1800 + r(4) * 2600, delay: r(5) * 2500 };
  }), [count]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((s, i) => <Star key={i} {...s} />)}
    </View>
  );
}
