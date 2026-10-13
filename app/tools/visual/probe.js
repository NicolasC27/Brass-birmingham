(() => {
  const out = { url: location.pathname, theme: document.documentElement.dataset.theme, w: innerWidth };
  const parse = (c) => {
    const m = /^rgba?\(([^)]+)\)$/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const path = (el) => { const p = []; let n = el; for (let i = 0; n && i < 4; i++, n = n.parentElement) { let s = n.tagName.toLowerCase(); if (n.id) s += '#' + n.id; const cls = (n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className) || ''; const c = String(cls).trim().split(/\s+/).filter((x) => /^(gz-|micro|eyebrow|platform)/.test(x)).slice(0, 2); if (c.length) s += '.' + c.join('.'); p.unshift(s); } return p.join('>'); };
  const vis = (el, cs) => { if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.06) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };

  const all = [...document.querySelectorAll('.platform-root *, .platform-root')];
  const els = all.length > 40 ? all : [...document.body.querySelectorAll('*')];
  out.count = els.length;

  const bgOf = (el) => {
    /* gather the translucent washes from the element up to the first opaque
       ground, then paint them back down in that order — compositing them the
       other way round invents a colour nobody ever sees */
    let n = el, layers = [], tex = false;
    while (n) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') tex = true;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.999) break; }
      n = n.parentElement;
    }
    const grounded = layers.length > 0 && layers[layers.length - 1].a >= 0.999;
    let base = grounded ? layers.pop() : { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    /* nothing opaque underneath: the text floats over a canvas or the bare
       page, and the ground it is read against is painted, not declared —
       the ratio below is a guess, and says so */
    return { c: base, tex, grounded };
  };

  const contrast = [], colorCensus = {}, bgCensus = {}, borderCensus = {}, fonts = {}, sizes = {}, radii = {}, spacing = {}, shadows = {};
  const clipped = [], small = [], noName = [], noAlt = [];
  const bump = (o, k) => { if (!k) return; o[k] = (o[k] || 0) + 1; };

  for (const el of els) {
    const cs = getComputedStyle(el);
    if (!vis(el, cs)) continue;
    bump(colorCensus, cs.color);
    bump(bgCensus, cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : null);
    if (cs.borderTopWidth !== '0px' || cs.borderBottomWidth !== '0px' || cs.borderLeftWidth !== '0px') bump(borderCensus, cs.borderTopColor);
    bump(fonts, (cs.fontFamily || '').split(',')[0].replace(/"/g, ''));
    bump(sizes, cs.fontSize);
    if (cs.borderRadius && cs.borderRadius !== '0px') bump(radii, cs.borderRadius);
    if (cs.boxShadow && cs.boxShadow !== 'none') bump(shadows, cs.boxShadow.slice(0, 60));
    for (const p of ['paddingTop', 'paddingLeft', 'marginTop', 'marginBottom', 'gap', 'rowGap']) { const v = cs[p]; if (v && v !== '0px' && v !== 'normal' && !v.includes('%')) bump(spacing, v); }

    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (txt.length > 0) {
      const fg0 = parse(cs.color);
      const { c: bg, tex, grounded } = bgOf(el);
      if (fg0) {
        const fg = fg0.a < 1 ? over(fg0, bg) : fg0;
        const r = ratio(fg, bg);
        const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight) || 400;
        const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
        const need = large ? 3 : 4.5;
        if (r < need) contrast.push({ sel: path(el), txt: txt.slice(0, 48), fg: hex(fg), bg: hex(bg), ratio: +r.toFixed(2), need, fs, fw, tex, large, grounded });
      }
      const rect = el.getBoundingClientRect();
      if (el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX) && rect.width > 20) clipped.push({ sel: path(el), txt: txt.slice(0, 48), cw: el.clientWidth, sw: el.scrollWidth, ell: cs.textOverflow });
      if (el.scrollHeight > el.clientHeight + 2 && /hidden|clip/.test(cs.overflowY) && rect.height > 12 && !/auto|scroll/.test(cs.overflowY)) clipped.push({ sel: path(el), txt: txt.slice(0, 48), ch: el.clientHeight, sh: el.scrollHeight, dir: 'y' });
    }
  }

  for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select, summary, [tabindex]:not([tabindex="-1"])')) {
    const cs = getComputedStyle(el);
    if (!vis(el, cs)) continue;
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || '').trim();
    if (!name && !el.querySelector('img[alt]:not([alt=""])')) noName.push({ sel: path(el), html: el.outerHTML.slice(0, 90) });
    if ((r.height < 32 || r.width < 32) && r.width > 0) small.push({ sel: path(el), name: name.slice(0, 30), w: +r.width.toFixed(0), h: +r.height.toFixed(0) });
  }
  for (const img of document.querySelectorAll('img')) { if (!img.hasAttribute('alt')) noAlt.push(img.src.slice(-60)); }

  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => vis(h, getComputedStyle(h))).map((h) => ({ l: +h.tagName[1], t: h.innerText.trim().slice(0, 44), fs: getComputedStyle(h).fontSize }));
  const ids = {}; for (const el of document.querySelectorAll('[id]')) bump(ids, el.id);

  const top = (o, n = 24) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k + ' ×' + v);
  out.contrast = contrast.sort((a, b) => a.ratio - b.ratio).slice(0, 40);
  out.contrastTotal = contrast.length;
  out.clipped = clipped.slice(0, 25);
  out.smallTargets = small.slice(0, 25);
  out.noAccessibleName = noName.slice(0, 15);
  out.imgNoAlt = noAlt.slice(0, 10);
  out.headings = heads.slice(0, 40);
  out.dupIds = Object.entries(ids).filter(([, v]) => v > 1).map(([k]) => k);
  out.colors = top(colorCensus);
  out.backgrounds = top(bgCensus);
  out.borders = top(borderCensus, 14);
  out.fonts = top(fonts, 12);
  out.fontSizes = top(sizes, 22);
  out.radii = top(radii, 12);
  out.spacing = top(spacing, 26);
  out.shadows = top(shadows, 10);
  out.hOverflow = document.documentElement.scrollWidth > innerWidth + 1 ? { doc: document.documentElement.scrollWidth, vw: innerWidth } : null;
  out.offGrid = Object.keys(spacing).filter((v) => { const n = parseFloat(v); return v.endsWith('px') && n > 0 && n % 4 !== 0; }).slice(0, 20);
  out.lang = document.documentElement.lang;
  out.title = document.title;
  return JSON.stringify(out);
})()
