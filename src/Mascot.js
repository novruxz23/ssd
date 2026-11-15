import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Ellipse, Circle } from 'react-native-svg';

// Görsel: assets/mascot.png (senin attığın görsel, gözleri silinmiş hâli, 640x686)
// Göz davranışı DeXCode index.html'deki maskotla aynı: fare yerine "gaze" izler,
// gaze yoksa etrafa bakınır. Üstel yumuşatma, göz kırpma, yana bakınca göz daralması, hafif 3B eğim.
const IW = 640, IH = 686;
const EYES = [{ cx: 244.5, cy: 489.6 }, { cx: 324, cy: 489 }];
const RX = 11.2, RY = 35.6;
const U = 2.226; // index.html (320 birim) -> görsel pikseli çarpanı

function Eye({ k, cx, cy, ex, ey, sx, sy }) {
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: (cx - RX) * k, top: (cy - RY) * k, width: 2 * RX * k, height: 2 * RY * k,
      transform: [{ translateX: ex }, { translateY: ey }, { scaleX: sx }, { scaleY: sy }],
    }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${2 * RX} ${2 * RY}`}>
        <Defs>
          <LinearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#212121" /><Stop offset="1" stopColor="#03050c" />
          </LinearGradient>
        </Defs>
        <Ellipse cx={RX} cy={RY} rx={RX} ry={RY} fill="url(#eg)" />
        <Circle cx={RX - 1.5 * U} cy={RY - 7 * U} r={1.8 * U} fill="#fff" opacity={0.85} />
      </Svg>
    </Animated.View>
  );
}

export default function Mascot({ size = 290, gaze = null, shake = 0 }) {
  const k = size / IW;
  const v = useRef({
    ex: new Animated.Value(0), ey: new Animated.Value(0), sx: new Animated.Value(1), sy: new Animated.Value(1),
    rx: new Animated.Value(0), ry: new Animated.Value(0), bob: new Animated.Value(0),
    enter: new Animated.Value(0), sh: new Animated.Value(0), jump: new Animated.Value(0),
  }).current;
  const gz = useRef(gaze);
  gz.current = gaze;

  useEffect(() => {
    Animated.spring(v.enter, { toValue: 1, friction: 6, tension: 45, useNativeDriver: false }).start();
    const S = { rx: 0, ry: 0, ex: 0, ey: 0, blinkT: -1, nextBlink: 1.5, look: { x: 0, y: 0, t: 0 } };
    let raf, alive = true, last = Date.now();
    const clamp = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
    const frame = () => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const now = Date.now(), dt = Math.min(0.05, (now - last) / 1000), t = now / 1000;
      last = now;
      let dx, dy;
      const g = gz.current;
      if (g) { dx = g.x; dy = g.y; }
      else {
        if (t > S.look.t) S.look = { x: (Math.random() * 2 - 1) * 0.85, y: (Math.random() * 2 - 1) * 0.55, t: t + 1.1 + Math.random() * 2.2 };
        dx = S.look.x; dy = S.look.y;
      }
      dx = clamp(dx, -1, 1); dy = clamp(dy, -1, 1);
      const kk = 1 - Math.exp(-dt * 6), ke = 1 - Math.exp(-dt * 13);
      S.rx += (-dy * 11 - S.rx) * kk; S.ry += (dx * 17 - S.ry) * kk;
      S.ex += (dx * 9 - S.ex) * ke; S.ey += (dy * 6 - S.ey) * ke;
      let s = 1;
      if (S.blinkT < 0 && t > S.nextBlink) S.blinkT = t;
      if (S.blinkT >= 0) {
        const p = (t - S.blinkT) / 0.17;
        if (p >= 1) { S.blinkT = -1; S.nextBlink = t + 2.2 + Math.random() * 3.2; }
        else s = 1 - 0.93 * Math.sin(p * Math.PI);
      }
      v.rx.setValue(S.rx); v.ry.setValue(S.ry);
      v.ex.setValue(S.ex * U * k); v.ey.setValue(S.ey * U * k);
      v.sx.setValue(1 - 0.14 * Math.abs(dx)); v.sy.setValue(s);
      v.bob.setValue(Math.sin(t * 1.6) * 7);
    };
    frame();
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [k]);

  useEffect(() => {
    if (!shake) return;
    Animated.sequence([-14, 14, -10, 10, -5, 0].map((x) =>
      Animated.timing(v.sh, { toValue: x, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: false }))).start();
  }, [shake]);

  const tap = () => {
    v.jump.setValue(0);
    Animated.timing(v.jump, { toValue: 1, duration: 750, easing: Easing.bezier(0.3, 0.7, 0.4, 1), useNativeDriver: false }).start();
  };
  const deg = (a) => a.interpolate({ inputRange: [-30, 30], outputRange: ['-30deg', '30deg'] });
  const jy = v.jump.interpolate({ inputRange: [0, 0.18, 0.5, 0.82, 1], outputRange: [0, 6, -48, 0, 0] });
  const jsx = v.jump.interpolate({ inputRange: [0, 0.18, 0.5, 0.82, 1], outputRange: [1, 1.08, 0.96, 1.06, 1] });
  const jsy = v.jump.interpolate({ inputRange: [0, 0.18, 0.5, 0.82, 1], outputRange: [1, 0.9, 1.06, 0.93, 1] });

  return (
    <Pressable onPress={tap}>
      <Animated.View style={{
        width: size, height: size * IH / IW, opacity: v.enter,
        transform: [
          { translateX: v.sh }, { translateY: jy }, { scaleX: jsx }, { scaleY: jsy },
          { scale: v.enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
          { perspective: 900 }, { translateY: v.bob }, { rotateX: deg(v.rx) }, { rotateY: deg(v.ry) },
        ],
      }}>
        <Image source={require('../assets/mascot.png')} style={{ width: size, height: size * IH / IW }} />
        {EYES.map((e, i) => <Eye key={i} k={k} cx={e.cx} cy={e.cy} ex={v.ex} ey={v.ey} sx={v.sx} sy={v.sy} />)}
      </Animated.View>
    </Pressable>
  );
}
