// Katmanlı +18 engelleme: arama kelimeleri, alan adı, URL parametreleri, sayfa içeriği.
const fold = (s) => {
  let t = (s || '').toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ə/g, 'e');
  if (t.normalize) t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t;
};
const leet = (s) => s.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
  .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a').replace(/\$/g, 's');
const SPLIT = /[^a-z0-9\u0400-\u04ff\u0600-\u06ff]+/;
const STRIP = /[^a-z0-9\u0400-\u04ff\u0600-\u06ff]/g;

// Tam kelime eşleşmesi (yanlış pozitifi azaltmak için: "seksen", "essex" engellenmez)
export const WORDS = [
  'sex','seks','sekss','sexy','seksi','sexs','porn','porno','pornos','pornosu','pornolar','pornu','xxx',
  'sikis','sikisme','sikisen','sikiyor','sikmek','sikerim','sikik','amcik','amcigi','yarak','yarrak',
  'blowjob','handjob','cumshot','creampie','gangbang','milf','bdsm','bukkake','anal','dildo','fetish',
  'hentai','nude','nudes','naked','nsfw','erotik','erotic','erotica','escort','escorts','camgirl','camgirls',
  'livecam','onlyfans','pornhub','xvideos','xnxx','xhamster','redtube','youporn','brazzers','rule34','jav',
  'cilpaq','cilpak','ciplak','ciplaklar','masturbate','masturbation','masturbasyon','orgasm','orgazm',
  'pussy','boobs','titty','stripper','striptiz','striptease','incest','loli','lolicon','shota',
  'hotwife','swinger','swingers','sexcam','sextape','sexvideo','sexchat',
  'порно','секс','сиськи','хентай','эротика','голая','голые','шлюха','интим',
  'سكس','سيكس','نيك','اباحي','إباحي','بورن','سكسي'
];
const WORDSET = new Set(WORDS);

// Alt dize eşleşmesi (boşluk/nokta ile kaçırmaya karşı)
const STRONG = [
  'porn','xvideo','xnxx','xhamster','hentai','nsfw','sikis','erotik','erotic','camgirl','livejasmin',
  'chaturbate','stripchat','bongacams','brazzers','youporn','redtube','spankbang','onlyfans','rule34',
  'sexcam','sextape','escort','blowjob','gangbang','cumshot','creampie','bukkake','amcik',
  'порно','секс','سكس','اباحي','إباحي'
];

const KNOWN = [
  'pornhub.com','xvideos.com','xnxx.com','xnxx.tv','xhamster.com','xhamster.desi','redtube.com','youporn.com',
  'spankbang.com','eporner.com','tube8.com','tnaflix.com','txxx.com','hqporner.com','porntrex.com','beeg.com',
  'drtuber.com','youjizz.com','4tube.com','motherless.com','thumbzilla.com','pornone.com','sunporno.com',
  'nuvid.com','porndig.com','fapello.com','erome.com','chaturbate.com','stripchat.com','bongacams.com',
  'livejasmin.com','cam4.com','myfreecams.com','camsoda.com','onlyfans.com','fansly.com','brazzers.com',
  'realitykings.com','naughtyamerica.com','bangbros.com','mofos.com','nhentai.net','hanime.tv','e621.net',
  'gelbooru.com','danbooru.donmai.us','efukt.com','heavy-r.com','xtube.com','tubegalore.com','porngo.com',
  'pornpics.com','sex.com','xxnx.com','literotica.com','sexstories.com','ashemaletube.com','rule34.us'
];

const wordHit = (text) => {
  const f = fold(text);
  for (const x of [f, leet(f)]) {
    if (x.split(SPLIT).some((t) => t && WORDSET.has(t))) return true;
  }
  return false;
};

export function isBlockedQuery(q) {
  if (!q) return false;
  if (wordHit(q)) return true;
  const f = fold(q);
  for (const x of [f, leet(f)]) {
    const c = x.replace(STRIP, '');
    if (STRONG.some((k) => c.includes(k))) return true;
  }
  return false;
}

export function isBlockedHost(host) {
  const h = (host || '').toLowerCase().replace(/^www\./, '');
  if (!h) return false;
  if (KNOWN.some((d) => h === d || h.endsWith('.' + d))) return true;
  if (/\.(xxx|porn|sex|adult|sexy)$/.test(h)) return true;
  const hf = fold(h);
  if (hf.split(/[.\-_]/).some((p) => WORDSET.has(p))) return true;
  const c = hf.replace(STRIP, '');
  return STRONG.some((k) => c.includes(k));
}

const SEARCH_KEYS = ['q', 'query', 'search_query', 'k', 'p', 'text', 'wd', 'word', 'keyword', 'term', 'search', 's'];
export function isBlockedUrl(url) {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#:]+)(?::\d+)?([^?#]*)(\?[^#]*)?/i.exec(url || '');
  if (!m) return false;
  if (isBlockedHost(m[1])) return true;
  const dec = (v) => { try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { return v; } };
  if (wordHit(dec(m[2] || ''))) return true;
  if (m[3]) {
    for (const part of m[3].slice(1).split('&')) {
      const i = part.indexOf('=');
      if (i < 0) continue;
      const key = part.slice(0, i).toLowerCase();
      const val = dec(part.slice(i + 1));
      if (val.length > 150) continue;
      if (SEARCH_KEYS.includes(key) ? isBlockedQuery(val) : wordHit(val)) return true;
    }
  }
  return false;
}

// Sayfa yüklendikten sonra içeriği tarar (başlık, meta, RTA etiketi, görünen metin)
export const PAGE_GUARD_JS = `(function(){try{
var W=${JSON.stringify(WORDS)}, S=${JSON.stringify(STRONG)};
function fold(s){s=(s||'').toLowerCase().replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c').replace(/ə/g,'e');try{s=s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}catch(e){}return s;}
function meta(n){var e=document.querySelector('meta[name="'+n+'"]');return e?e.content:'';}
function scan(){
 if(/adult|mature|rta-5042/i.test(meta('rating'))) return true;
 var qs=fold(decodeURIComponent((location.search+' '+location.hash).replace(/\\+/g,' ')));
 var toks=qs.split(/[^a-z0-9\\u0400-\\u04ff\\u0600-\\u06ff]+/);
 for(var i=0;i<toks.length;i++){ if(W.indexOf(toks[i])>-1) return true; }
 var head=fold(document.title+' '+meta('description')+' '+meta('keywords'));
 var body=fold((document.body&&document.body.innerText||'').slice(0,6000));
 var hits=0;
 for(var j=0;j<S.length;j++){ if(head.indexOf(S[j])>-1) hits+=3; if(body.indexOf(S[j])>-1) hits+=1; }
 return hits>=4;
}
function check(){ if(scan()) window.ReactNativeWebView.postMessage('adult'); }
check(); setTimeout(check,1200); setTimeout(check,3500);
}catch(e){}})(); true;`;
