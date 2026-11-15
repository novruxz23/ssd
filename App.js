import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Animated, Easing, StyleSheet, BackHandler, Keyboard, FlatList,
  ScrollView, Dimensions, Share,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import Mascot from './src/Mascot';
import Stars from './src/Stars';
import { isBlockedQuery, isBlockedUrl, PAGE_GUARD_JS } from './src/guard';

SplashScreen.preventAutoHideAsync().catch(() => {});

const BG = '#0a0a0c';
const { width: W, height: SH } = Dimensions.get('window');
const MW = 290, MH = (MW * 686) / 640, SC = 0.5, BAR = 62;
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
const ENGINES = [
  { n: 'Google', f: (q) => `https://www.google.com/search?q=${q}&safe=active&hl=tr` },
  { n: 'DuckDuckGo', f: (q) => `https://duckduckgo.com/?q=${q}&kp=1` },
  { n: 'Bing', f: (q) => `https://www.bing.com/search?q=${q}&adlt=strict` },
  { n: 'Yandex', f: (q) => `https://yandex.com/search/?text=${q}&family=yes` },
];
const QUICK = [['YouTube', 'youtube.com'], ['Google', 'google.com'], ['Wikipedia', 'wikipedia.org'], ['GitHub', 'github.com'],
  ['Reddit', 'reddit.com'], ['X', 'x.com'], ['Instagram', 'instagram.com'], ['Çeviri', 'translate.google.com']];
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const AD_HOSTS = ['doubleclick.net', 'googlesyndication.com', 'adservice.google', 'taboola.com', 'outbrain.com', 'adnxs.com', 'popads.net'];
const DARK_CSS = 'html{filter:invert(1) hue-rotate(180deg)!important;background:#fff}img,video,picture,canvas{filter:invert(1) hue-rotate(180deg)!important}';
const AD_CSS = 'ins.adsbygoogle,[id*="google_ads"],[class*="adsbygoogle"],iframe[src*="doubleclick"],[id^="ad-"],[class^="ad-"]{display:none!important}';
const styleJs = (cfg) => `(function(){try{var c=${JSON.stringify((cfg.dark ? DARK_CSS : '') + (cfg.ads ? AD_CSS : ''))};if(c){var s=document.createElement('style');s.innerHTML=c;(document.head||document.documentElement).appendChild(s);}}catch(e){}})();true;`;

const looksLikeUrl = (t) => !/\s/.test(t) && /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?([\/?#]\S*)?$/i.test(t);
const hostOf = (u) => ((/^[a-z]+:\/\/([^\/?#]+)/i.exec(u || '') || [])[1] || '').replace(/^www\./, '');

export default function App() {
  return <SafeAreaProvider><Root /></SafeAreaProvider>;
}

function Root() {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState('home');
  const [tabs, setTabs] = useState([]);
  const [active, setActive] = useState(null);
  const [info, setInfo] = useState({});
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [sugg, setSugg] = useState([]);
  const [recent, setRecent] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [history, setHistory] = useState([]);
  const [cfg, setCfg] = useState({ engine: 0, desktop: false, dark: false, ads: true });
  const [menu, setMenu] = useState(false);
  const [hh, setHh] = useState(SH - 120);
  const refs = useRef({});
  const input = useRef(null);
  const focRef = useRef(false);
  const page = useRef(new Animated.Value(1)).current;
  const foc = useRef(new Animated.Value(0)).current;
  const prog = useRef(new Animated.Value(0)).current;
  const send = useRef(new Animated.Value(0)).current;

  const persist = (k, v) => AsyncStorage.setItem(k, JSON.stringify(v)).catch(() => {});
  useEffect(() => {
    (async () => {
      try {
        const g = async (k, d) => JSON.parse((await AsyncStorage.getItem(k)) || d);
        setBookmarks(await g('bm', '[]')); setHistory(await g('hs', '[]')); setRecent(await g('rs', '[]'));
        const c = await g('cfg', 'null'); if (c) setCfg((o) => ({ ...o, ...c }));
      } catch (e) {}
      SplashScreen.hideAsync().catch(() => {});
    })();
  }, []);
  useEffect(() => { persist('cfg', cfg); }, [cfg]);

  // --- Arama çubuğu: odaklanınca animasyonla yukarı çıkar ---
  useEffect(() => {
    focRef.current = focused;
    Animated.spring(foc, { toValue: focused ? 1 : 0, friction: 9, tension: 70, useNativeDriver: true }).start();
  }, [focused]);
  useEffect(() => {
    Animated.spring(send, { toValue: text.trim() ? 1 : 0, friction: 7, tension: 120, useNativeDriver: true }).start();
  }, [text]);
  useEffect(() => {
    if (!focused || !text.trim() || isBlockedQuery(text)) { setSugg([]); return; }
    const h = setTimeout(async () => {
      try {
        const r = await fetch('https://suggestqueries.google.com/complete/search?client=firefox&hl=tr&q=' + encodeURIComponent(text));
        const j = await r.json();
        setSugg((j[1] || []).filter((x) => !isBlockedQuery(x)).slice(0, 7));
      } catch (e) { setSugg([]); }
    }, 180);
    return () => clearTimeout(h);
  }, [text, focused]);

  const swap = (fn) => {
    Animated.timing(page, { toValue: 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      fn();
      Animated.timing(page, { toValue: 1, duration: 280, easing: ease, useNativeDriver: true }).start();
    });
  };
  const blur = () => { Keyboard.dismiss(); input.current && input.current.blur(); setFocused(false); };
  const goHome = () => { blur(); swap(() => { setScreen('home'); setEditing(null); setMenu(false); setText(''); }); };
  const closeTab = (id) => {
    setTabs((ts) => {
      const next = ts.filter((t) => t.id !== id);
      if (id === active) setActive(next.length ? next[next.length - 1].id : null);
      if (!next.length) setScreen((s) => (s === 'web' ? 'home' : s));
      return next;
    });
  };
  const block = (tabId) => {
    blur();
    swap(() => { if (tabId) closeTab(tabId); setScreen('blocked'); setMenu(false); setText(''); });
  };
  const openUrl = (u, rep) => {
    if (isBlockedUrl(u)) return block();
    blur();
    swap(() => {
      if (rep && tabs.some((t) => t.id === rep)) {
        setTabs((ts) => ts.map((t) => (t.id === rep ? { ...t, url: u, v: (t.v || 0) + 1 } : t)));
        setActive(rep);
      } else {
        const id = String(Date.now());
        setTabs((ts) => [...ts, { id, url: u, v: 0 }]);
        setActive(id);
      }
      setScreen('web'); setMenu(false); setEditing(null); setText('');
    });
  };
  const submit = (raw) => {
    const t = (raw || '').trim();
    if (!t) return;
    if (isBlockedQuery(t)) return block();
    let target;
    if (looksLikeUrl(t)) target = /^https?:\/\//i.test(t) ? t : 'https://' + t;
    else {
      target = ENGINES[cfg.engine].f(encodeURIComponent(t));
      const r = [t, ...recent.filter((x) => x !== t)].slice(0, 8);
      setRecent(r); persist('rs', r);
    }
    openUrl(target, editing);
  };
  const newTab = () => {
    setEditing(null); setText('');
    swap(() => { setScreen('home'); setMenu(false); });
    setTimeout(() => input.current && input.current.focus(), 420);
  };
  const editUrl = () => {
    setEditing(active); setText(cur.url || '');
    swap(() => setScreen('home'));
    setTimeout(() => input.current && input.current.focus(), 420);
  };

  const cur = info[active] || {};
  const curTab = tabs.find((t) => t.id === active);
  const isMarked = bookmarks.some((b) => b.url === cur.url);
  const toggleMark = () => {
    const next = isMarked ? bookmarks.filter((b) => b.url !== cur.url) : [{ url: cur.url, title: cur.title || hostOf(cur.url) }, ...bookmarks];
    setBookmarks(next); persist('bm', next);
  };
  const addHistory = (st) => {
    if (!st.url) return;
    setHistory((h) => {
      const n = [{ url: st.url, title: st.title || hostOf(st.url) }, ...h.filter((x) => x.url !== st.url)].slice(0, 100);
      persist('hs', n); return n;
    });
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (focRef.current) { blur(); return true; }
      if (menu) { setMenu(false); return true; }
      if (screen === 'web' && cur.canGoBack && refs.current[active]) { refs.current[active].goBack(); return true; }
      if (screen === 'tabs') { swap(() => setScreen(tabs.length ? 'web' : 'home')); return true; }
      if (screen !== 'home') { goHome(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [screen, cur.canGoBack, menu, active, tabs.length]);

  const gaze = (focused || text.length > 0)
    ? { x: text.length === 0 ? 0 : Math.max(-1, Math.min(1, -1 + (caret / 24) * 2)), y: 0.9 }
    : null;
  const typingBlocked = isBlockedQuery(text);

  // konumlar
  const mTop = (hh - BAR - 36 - MH) / 2, T = insets.top + 6;
  const barBase = hh - BAR - 18, barFocus = T + MH * SC + 4;
  const mTy = foc.interpolate({ inputRange: [0, 1], outputRange: [0, T + (MH * SC) / 2 - (mTop + MH / 2)] });
  const mSc = foc.interpolate({ inputRange: [0, 1], outputRange: [1, SC] });
  const barTy = foc.interpolate({ inputRange: [0, 1], outputRange: [0, barFocus - barBase] });

  const tabIdx = screen === 'home' ? 0 : screen === 'bookmarks' ? 1 : screen === 'history' ? 2 : screen === 'tabs' ? 3 : -1;
  const list = screen === 'bookmarks' ? bookmarks : history;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />
      <Animated.View style={{ flex: 1, opacity: page, transform: [{ scale: page.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>

        {screen === 'home' && (
          <View style={{ flex: 1 }} onLayout={(e) => { if (!focRef.current) setHh(e.nativeEvent.layout.height); }}>
            <Stars count={14} />
            <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: mTop, alignItems: 'center', transform: [{ translateY: mTy }, { scale: mSc }] }}>
              <Mascot size={MW} gaze={gaze} />
            </Animated.View>

            {focused && (
              <Animated.View style={{ position: 'absolute', left: 16, right: 16, top: barFocus + BAR + 8, bottom: 0, opacity: foc }}>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {text.trim() === '' ? (
                    <>
                      {recent.length > 0 && <Text style={s.cap}>Son aramalar</Text>}
                      <View style={s.chips}>
                        {recent.slice(0, 6).map((r) => (
                          <Pressable key={r} style={s.chip} onPress={() => submit(r)}><Text style={s.chipT} numberOfLines={1}>{r}</Text></Pressable>
                        ))}
                      </View>
                      <Text style={s.cap}>Hızlı erişim</Text>
                      <View style={s.quick}>
                        {QUICK.map(([n, h], i) => (
                          <FadeIn key={h} delay={i * 35} slide={10}>
                            <Pressable style={s.qi} onPress={() => openUrl('https://' + h, editing)}>
                              <View style={s.qc}><Text style={s.qL}>{n[0]}</Text></View>
                              <Text style={s.qT} numberOfLines={1}>{n}</Text>
                            </Pressable>
                          </FadeIn>
                        ))}
                      </View>
                    </>
                  ) : (
                    <>
                      {typingBlocked
                        ? <Text style={[s.cap, { color: '#d96b6b' }]}>Bu arama engelli</Text>
                        : [text.trim(), ...sugg.filter((x) => x !== text.trim())].map((x, i) => (
                          <FadeIn key={x} delay={i * 30} slide={8} wide>
                            <Pressable style={s.srow} onPress={() => submit(x)}>
                              <Ionicons name={i === 0 ? 'arrow-forward' : 'search-outline'} size={18} color="#8a8a92" />
                              <Text style={s.srowT} numberOfLines={1}>{x}</Text>
                            </Pressable>
                          </FadeIn>
                        ))}
                    </>
                  )}
                </ScrollView>
              </Animated.View>
            )}

            <Animated.View style={{ position: 'absolute', left: 16, right: 16, top: barBase, transform: [{ translateY: barTy }] }}>
              <View style={[s.bar, focused && { borderColor: typingBlocked ? '#7a3434' : '#4a4a52' }]}>
                <Ionicons name="search" size={22} color="#85858c" />
                <TextInput
                  ref={input} style={s.input} value={text} onChangeText={setText}
                  placeholder="Bir şey ara veya site adresi yaz..." placeholderTextColor="#6d6d73"
                  autoCapitalize="none" autoCorrect={false} returnKeyType="go" selectionColor="#d8d8e0"
                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                  onSelectionChange={(e) => setCaret(e.nativeEvent.selection.end)} onSubmitEditing={() => submit(text)}
                />
                {focused && (
                  <Pressable hitSlop={10} onPress={blur}><Ionicons name="close-circle" size={22} color="#6d6d73" /></Pressable>
                )}
                <Animated.View style={{
                  opacity: send.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                  transform: [{ scale: send.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
                }}>
                  <Pressable style={s.go} onPress={() => submit(text)}><Ionicons name="arrow-up" size={22} color="#111" /></Pressable>
                </Animated.View>
              </View>
            </Animated.View>
          </View>
        )}

        {screen === 'blocked' && (
          <View style={s.center}>
            <Stars count={14} />
            <Mascot size={230} gaze={{ x: 0, y: 0.9 }} shake={1} />
            <FadeIn delay={250}>
              <Text style={s.h1}>Bu içerik engellendi</Text>
              <Text style={s.sub}>Yetişkin içerikli arama ve siteler bu tarayıcıda kapalı.</Text>
              <Pressable style={s.btn} onPress={goHome}><Text style={s.btnT}>Ana sayfa</Text></Pressable>
            </FadeIn>
          </View>
        )}

        {screen === 'tabs' && (
          <View style={{ flex: 1, paddingTop: insets.top + 16 }}>
            <Text style={[s.h1, { marginLeft: 20, textAlign: 'left' }]}>Sekmeler ({tabs.length})</Text>
            <FlatList
              data={tabs} numColumns={2} keyExtractor={(t) => t.id} contentContainerStyle={{ padding: 12 }}
              ListEmptyComponent={<Text style={[s.sub, { marginTop: 40 }]}>Açık sekme yok.</Text>}
              renderItem={({ item, index }) => {
                const i = info[item.id] || {};
                return (
                  <FadeIn delay={Math.min(index, 8) * 45} slide={14} wide>
                    <Pressable style={[s.card, item.id === active && { borderColor: '#8d8d96' }]}
                      onPress={() => swap(() => { setActive(item.id); setScreen('web'); })}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={s.cardH} numberOfLines={1}>{hostOf(i.url || item.url)}</Text>
                        <Pressable hitSlop={10} onPress={() => closeTab(item.id)}><Ionicons name="close" size={20} color="#9a9aa2" /></Pressable>
                      </View>
                      <Text style={s.cardT} numberOfLines={3}>{i.title || item.url}</Text>
                    </Pressable>
                  </FadeIn>
                );
              }}
            />
            <Pressable style={s.fab} onPress={newTab}><Ionicons name="add" size={28} color="#111" /></Pressable>
          </View>
        )}

        {(screen === 'bookmarks' || screen === 'history') && (
          <View style={{ flex: 1, paddingTop: insets.top + 16 }}>
            <Text style={[s.h1, { marginLeft: 20, textAlign: 'left' }]}>{screen === 'bookmarks' ? 'Yer imleri' : 'Geçmiş'}</Text>
            <FlatList
              data={list} keyExtractor={(i) => i.url} contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={[s.sub, { marginTop: 40 }]}>Henüz bir şey yok.</Text>}
              renderItem={({ item, index }) => (
                <FadeIn delay={Math.min(index, 8) * 40} slide={14} wide>
                  <Pressable style={s.row} onPress={() => openUrl(item.url)}>
                    <Ionicons name="globe-outline" size={20} color="#9a9aa2" />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={s.rowT}>{item.title}</Text>
                      <Text numberOfLines={1} style={s.rowS}>{hostOf(item.url)}</Text>
                    </View>
                  </Pressable>
                </FadeIn>
              )}
            />
          </View>
        )}

        {/* Sekmeler hep açık kalır; sadece etkin olan görünür */}
        <View style={[{ flex: 1 }, screen === 'web' ? null : { display: 'none' }]}>
          <View style={[s.top, { paddingTop: insets.top + 8 }]}>
            <IconBtn name="chevron-back" onPress={() => (cur.canGoBack && refs.current[active] ? refs.current[active].goBack() : goHome())} />
            <IconBtn name="chevron-forward" onPress={() => refs.current[active] && refs.current[active].goForward()} color={cur.canGoForward ? '#cfcfd6' : '#4a4a50'} />
            <Pressable style={s.pill} onPress={editUrl}>
              <Ionicons name="lock-closed" size={13} color="#8c8c94" />
              <Text numberOfLines={1} style={s.pillT}>{hostOf(cur.url || (curTab && curTab.url))}</Text>
            </Pressable>
            <IconBtn name={isMarked ? 'star' : 'star-outline'} onPress={toggleMark} color={isMarked ? '#f5d76e' : '#cfcfd6'} />
            <IconBtn name="refresh" onPress={() => refs.current[active] && refs.current[active].reload()} />
          </View>
          <Animated.View style={[s.prog, { transform: [{ scaleX: prog }] }]} />
          <View style={{ flex: 1 }}>
            {tabs.map((t) => (
              <View key={t.id + '-' + t.v + '-' + cfg.desktop} style={[StyleSheet.absoluteFill, t.id === active ? null : { display: 'none' }]}>
                <WebView
                  ref={(r) => { refs.current[t.id] = r; }}
                  source={{ uri: t.url }}
                  style={{ flex: 1, backgroundColor: BG }}
                  userAgent={cfg.desktop ? DESKTOP_UA : undefined}
                  javaScriptEnabled domStorageEnabled pullToRefreshEnabled allowsFullscreenVideo
                  setSupportMultipleWindows
                  injectedJavaScriptBeforeContentLoaded={styleJs(cfg)}
                  injectedJavaScript={PAGE_GUARD_JS}
                  onOpenWindow={(e) => openUrl(e.nativeEvent.targetUrl)}
                  onShouldStartLoadWithRequest={(r) => {
                    if (isBlockedUrl(r.url)) { block(t.id); return false; }
                    if (cfg.ads && AD_HOSTS.some((h) => r.url.includes(h))) return false;
                    return true;
                  }}
                  onNavigationStateChange={(st) => {
                    if (isBlockedUrl(st.url)) return block(t.id);
                    setInfo((o) => ({ ...o, [t.id]: st }));
                    if (!st.loading) addHistory(st);
                  }}
                  onLoadProgress={(e) => t.id === active && Animated.timing(prog, { toValue: e.nativeEvent.progress, duration: 160, useNativeDriver: true }).start()}
                  onLoadEnd={() => Animated.timing(prog, { toValue: 0, duration: 400, delay: 200, useNativeDriver: true }).start()}
                  onMessage={(e) => { if (e.nativeEvent.data === 'adult') block(t.id); }}
                />
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      <NavBar
        active={tabIdx} bottom={insets.bottom} count={tabs.length} hide={foc}
        onPress={(i) => {
          if (i === 4) return setMenu(true);
          const t = ['home', 'bookmarks', 'history', 'tabs'][i];
          if (t === 'home') return goHome();
          if (t !== screen) swap(() => { setScreen(t); setMenu(false); });
        }}
      />

      {menu && (
        <Menu
          onClose={() => setMenu(false)} bottom={insets.bottom}
          items={[
            { icon: 'add', label: 'Yeni sekme', run: newTab },
            ...(screen === 'web' ? [
              { icon: isMarked ? 'star' : 'star-outline', label: isMarked ? 'Yer imini kaldır' : 'Yer imi ekle', run: () => { toggleMark(); setMenu(false); } },
              { icon: 'share-outline', label: 'Paylaş', run: () => { setMenu(false); Share.share({ message: cur.url || '' }); } },
            ] : []),
            { icon: 'desktop-outline', label: 'Masaüstü sitesi', toggle: cfg.desktop, run: () => setCfg((c) => ({ ...c, desktop: !c.desktop })) },
            { icon: 'moon-outline', label: 'Karanlık sayfalar', toggle: cfg.dark, run: () => setCfg((c) => ({ ...c, dark: !c.dark })) },
            { icon: 'shield-checkmark-outline', label: 'Reklam engelleyici', toggle: cfg.ads, run: () => setCfg((c) => ({ ...c, ads: !c.ads })) },
            { icon: 'compass-outline', label: 'Arama motoru: ' + ENGINES[cfg.engine].n, run: () => setCfg((c) => ({ ...c, engine: (c.engine + 1) % ENGINES.length })) },
            { icon: 'trash-outline', label: 'Geçmişi ve aramaları temizle', run: () => { setHistory([]); setRecent([]); persist('hs', []); persist('rs', []); setMenu(false); } },
          ]}
        />
      )}
    </View>
  );
}

function IconBtn({ name, onPress, color = '#cfcfd6' }) {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <Pressable hitSlop={8} onPress={onPress}
      onPressIn={() => Animated.spring(sc, { toValue: 0.82, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, friction: 4, useNativeDriver: true }).start()}>
      <Animated.View style={{ transform: [{ scale: sc }], padding: 6 }}><Ionicons name={name} size={22} color={color} /></Animated.View>
    </Pressable>
  );
}

function FadeIn({ children, delay = 0, slide = 18, wide }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 480, delay, easing: ease, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[wide ? { flex: 1 } : { alignItems: 'center' }, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [slide, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

const TABS = ['home', 'book-outline', 'time-outline', 'copy-outline', 'menu'];
function NavBar({ active, onPress, bottom, count, hide }) {
  const slot = W / 5;
  const x = useRef(new Animated.Value(Math.max(active, 0) * slot)).current;
  useEffect(() => { Animated.spring(x, { toValue: Math.max(active, 0) * slot, friction: 8, tension: 90, useNativeDriver: true }).start(); }, [active]);
  return (
    <Animated.View style={[s.nav, {
      paddingBottom: bottom + 8, opacity: hide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      transform: [{ translateY: hide.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }) }],
    }]}>
      <View style={{ flexDirection: 'row' }}>
        {TABS.map((n, i) => (
          <Pressable key={n} style={{ width: slot, alignItems: 'center', paddingVertical: 12 }} onPress={() => onPress(i)}>
            <Ionicons name={n} size={26} color={active === i ? '#f6f0fa' : '#9a9aa2'} />
            {i === 3 && count > 0 && <View style={s.badge}><Text style={s.badgeT}>{count}</Text></View>}
          </Pressable>
        ))}
      </View>
      <Animated.View style={{ height: 3, width: 34, borderRadius: 2, backgroundColor: '#f6f0fa', marginLeft: (slot - 34) / 2, opacity: active < 0 ? 0 : 1, transform: [{ translateX: x }] }} />
    </Animated.View>
  );
}

function Switch({ on }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.spring(v, { toValue: on ? 1 : 0, friction: 8, tension: 120, useNativeDriver: true }).start(); }, [on]);
  return (
    <View style={[s.sw, on && { backgroundColor: '#6b6b74' }]}>
      <Animated.View style={[s.knob, { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }] }]} />
    </View>
  );
}

function Menu({ items, onClose, bottom }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 320, easing: ease, useNativeDriver: true }).start(); }, []);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, { paddingBottom: bottom + 16, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] }]}>
        {items.map((it) => (
          <Pressable key={it.label} style={s.sheetRow} onPress={it.run}>
            <Ionicons name={it.icon} size={22} color="#e8e8ee" />
            <Text style={s.sheetT}>{it.label}</Text>
            {it.toggle !== undefined && <Switch on={it.toggle} />}
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: BAR, borderRadius: BAR / 2, backgroundColor: '#141416', borderWidth: 1, borderColor: '#26262b', paddingLeft: 18, paddingRight: 8 },
  input: { flex: 1, color: '#f2f2f6', fontSize: 16, paddingVertical: 0 },
  go: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e9e6f2', alignItems: 'center', justifyContent: 'center' },
  cap: { color: '#7d7d85', fontSize: 13, marginTop: 14, marginBottom: 8, marginLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#151518', borderWidth: 1, borderColor: '#25252a', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, maxWidth: W * 0.6 },
  chipT: { color: '#d6d6dc', fontSize: 14 },
  quick: { flexDirection: 'row', flexWrap: 'wrap' },
  qi: { width: (W - 32) / 4, alignItems: 'center', marginBottom: 14 },
  qc: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#17171a', borderWidth: 1, borderColor: '#26262b', alignItems: 'center', justifyContent: 'center' },
  qL: { color: '#ececf1', fontSize: 20, fontWeight: '700' },
  qT: { color: '#9a9aa2', fontSize: 11.5, marginTop: 6 },
  srow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 6 },
  srowT: { flex: 1, color: '#e6e6ec', fontSize: 16 },
  nav: { backgroundColor: '#101013', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderBottomWidth: 0, borderColor: '#1e1e22' },
  badge: { position: 'absolute', top: 6, right: W / 10 - 22, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#e9e6f2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeT: { color: '#111', fontSize: 10, fontWeight: '700' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 8, backgroundColor: '#101013' },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1e', borderRadius: 18, paddingHorizontal: 14, height: 36, marginHorizontal: 4 },
  pillT: { flex: 1, color: '#d6d6dc', fontSize: 14 },
  prog: { height: 2, backgroundColor: '#e9e6f2', width: '100%', transformOrigin: 'left' },
  h1: { color: '#f4f4f8', fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  sub: { color: '#8a8a92', fontSize: 15, textAlign: 'center', marginTop: 8, paddingHorizontal: 36 },
  btn: { marginTop: 22, backgroundColor: '#e9e6f2', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 24 },
  btnT: { color: '#111', fontWeight: '700', fontSize: 15 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#131316', borderRadius: 16, padding: 14, marginBottom: 10 },
  rowT: { color: '#ececf1', fontSize: 15 },
  rowS: { color: '#7d7d85', fontSize: 12, marginTop: 2 },
  card: { flex: 1, backgroundColor: '#131316', borderRadius: 18, borderWidth: 1, borderColor: '#25252a', padding: 14, margin: 6, minHeight: 130 },
  cardH: { flex: 1, color: '#9a9aa2', fontSize: 12 },
  cardT: { color: '#ececf1', fontSize: 15, marginTop: 10 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#e9e6f2', alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#141417', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 12 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 15, paddingHorizontal: 14 },
  sheetT: { flex: 1, color: '#ececf1', fontSize: 16 },
  sw: { width: 42, height: 24, borderRadius: 12, backgroundColor: '#2a2a2f', padding: 3 },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
});
