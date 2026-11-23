// The start screen's picture: one WebGL smoke shader, a lit cloud bank that rolls like a drum,
// with each character billowing out of smoke in their own shape. Swipes, the fold and the
// cloud travel into a shelf only feed it numbers; `self` is the Home component that holds them.
export function makeStage(self, cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const still = self.reduced();
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const noStage = { paint: () => {}, stop: () => {}, resize: () => {} };
  const gl = cv.getContext('webgl2', { alpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) { self.setState({ noGL: true }); return noStage; }

  const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const FS = `#version 300 es
precision highp float;
uniform sampler2D uN, uTa, uTb;
uniform vec2 uRes, uBc;
uniform float uDpr, uT, uPos, uFloor, uCx, uS, uRing, uEnergy, uVeil, uBurst, uSmoke, uDir, uClear, uPalMix;
uniform vec3 uPal[7];
uniform vec4 uRa, uRb;
uniform vec3 uCa, uCb;
out vec4 o;
const vec3 BG = vec3(0.961, 0.918, 0.847);
const vec3 HI = vec3(1.0, 0.992, 0.969);
const vec3 MID = vec3(0.925, 0.855, 0.757);
const vec3 LOW = vec3(0.690, 0.561, 0.443);
const mat2 M = mat2(0.8, 0.6, -0.6, 0.8);
float n(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*f*(f*(f*6.0-15.0)+10.0); return textureLod(uN, (i+f+0.5)/256.0, 0.0).r; }
float fbm(vec2 p, float t){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*n(p + vec2(t*(1.0+float(i)*0.35), -t*0.7)); p = M*p*2.03 + 7.1; a *= 0.5; } return v/0.9375; }
vec2 flow(vec2 p, float t){ return vec2(fbm(p + vec2(0.0, t*0.6), t*0.25), fbm(p + vec2(5.2, 1.3) - t*0.5, t*0.2))*2.0 - 1.0; }
vec2 gP;
// a shelf's own palette, laid out like a sunset: deep colours up top, warm ones low down, lit wisps warmer still
vec3 pal(float s){ s = clamp(s, 0.0, 1.0)*6.0; int i = int(min(floor(s), 5.0)); return mix(uPal[i], uPal[i + 1], s - float(i)); }
vec3 sunset(float l){ vec3 c = pal(gP.y/uRes.y*0.9 + (l - 0.7)*0.9 + 0.08); return mix(c, vec3(1.0, 0.88, 0.74), smoothstep(0.86, 1.0, l)*0.35); }
vec3 tint(float l){ vec3 c = l < 0.5 ? mix(LOW, MID, l*2.0) : mix(MID, HI, l*2.0-1.0); return uPalMix > 0.0 ? mix(c, sunset(l), uPalMix) : c; }
vec3 hi(){ return uPalMix > 0.0 ? mix(HI, sunset(0.95), uPalMix) : HI; }
vec3 mid(){ return uPalMix > 0.0 ? mix(MID, sunset(0.6), uPalMix) : MID; }

vec4 cloud(vec2 p, float par, float lift){
float top = uFloor - lift*uS;
float h = (p.y - top)/(95.0*uS);
if (h < -1.3) return vec4(0.0);
float rawX = (p.x - uCx)/uRing;
float x = clamp(rawX, -0.97, 0.97);
float u = uRing*(asin(x) + (rawX - x)*2.0) + uPos*0.873*uRing*par;
vec2 b = vec2(u*0.0085/uS, p.y*0.0115/uS) + par*3.7;
float t = uT*0.05;
vec2 q = flow(b*0.7, t);
float g = fbm(b + q*0.62, t*0.8);
float g2 = fbm(b + q*0.62 + vec2(-0.12, -0.22), t*0.8);
float d = smoothstep(0.0, 0.5, g*1.3 - 0.6 + h*1.75);
float l = clamp(0.74 + (g - g2)*2.5 + h*0.1, 0.0, 1.0);
vec3 c = mix(tint(l), hi(), smoothstep(0.75, 1.7, h));
return vec4(c, d);
}

// One Evan. c = (reveal 0..1, side, mip level)
vec3 evan(vec3 col, vec2 p, sampler2D tex, vec4 r, vec3 c){
float R = c.x;
if (R <= 0.001) return col;
vec2 uv0 = (p - r.xy)/r.zw;
if (R >= 0.999) {
  if (uv0.x < 0.0 || uv0.x > 1.0 || uv0.y < 0.0 || uv0.y > 1.0) return col;
  vec4 s = textureLod(tex, uv0, c.z)*(1.0 - smoothstep(0.92, 1.0, uv0.y));
  return col*(1.0 - s.a) + s.rgb;
}
float k = 1.0 - R;
float t = uT*0.09;
vec2 sc = p*0.0058/uS + c.y*1.7;
vec2 f = flow(sc, t);
vec2 f2 = flow(sc*2.3 + f*0.7, t*1.5);
vec2 drift = vec2(c.y*190.0, 120.0)*uS*k*k;
// the soft silhouette gives the smoke Evan's shape
vec2 suv = (p - drift*0.8 - (f*120.0 + f2*42.0)*uS*(0.35 + k) - r.xy)/r.zw;
float inS = smoothstep(-0.1, 0.03, suv.x)*smoothstep(1.1, 0.97, suv.x)*smoothstep(-0.12, 0.02, suv.y)*smoothstep(1.12, 1.0, suv.y);
float soft = textureLod(tex, clamp(suv, 0.0, 1.0), 4.6).a*inS;
float g = fbm(p*0.0125/uS + f*1.5 + f2*0.5, t*1.6);
float g2 = fbm(p*0.0125/uS + f*1.5 + f2*0.5 + vec2(-0.08, -0.15), t*1.6);
float wisp = smoothstep(0.30, 0.68, g);
float S = soft*wisp*sin(3.14159*R)*1.45*uSmoke;
float l = clamp(0.7 + (g - g2)*3.4, 0.0, 1.0);
col = mix(col, tint(l), clamp(S*0.92, 0.0, 0.96));
// the image itself: pulled along the flow until it settles into place
vec2 uv = (p - drift - (f*105.0 + f2*30.0)*uS*k*k - r.xy)/r.zw;
float inside = step(0.0, uv.x)*step(uv.x, 1.0)*step(0.0, uv.y)*step(uv.y, 1.0);
vec4 s = textureLod(tex, clamp(uv, 0.0, 1.0), c.z + 1.6*k)*inside*(1.0 - smoothstep(0.92, 1.0, uv.y));
float th = mix(g, 1.0 - clamp(uv0.y, 0.0, 1.0), 0.55);
float rev = smoothstep(th - 0.2, th + 0.05, R*1.34 - 0.12);
vec3 rgb = mix(s.rgb, tint(l)*s.a, (1.0 - rev)*0.8*k);
float a = s.a*rev;
col = col*(1.0 - a) + rgb*rev;
// a veil of smoke over the edge that is still forming
float edge = rev*(1.0 - rev)*4.0;
col = mix(col, tint(l), clamp(edge*soft*wisp*0.6*uSmoke, 0.0, 0.8));
return col;
}

void main(){
vec2 p = vec2(gl_FragCoord.x, uRes.y*uDpr - gl_FragCoord.y)/uDpr;
gP = p;
vec3 col = BG;
vec4 b = cloud(p, 0.62, 26.0);
b.rgb = mix(b.rgb, mid(), 0.28);
col = mix(col, b.rgb, b.a);
col = evan(col, p, uTb, uRb, uCb);
col = evan(col, p, uTa, uRa, uCa);
vec4 fr = cloud(p, 1.0, 0.0);
col = mix(col, fr.rgb, fr.a);
// tendrils whipped up off the cloud while the wheel is moving
if (uEnergy > 0.01) {
  float up = smoothstep(uFloor - 330.0*uS, uFloor - 20.0*uS, p.y)*smoothstep(uFloor + 40.0*uS, uFloor - 10.0*uS, p.y);
  if (up > 0.001) {
    float t = uT*0.2;
    vec2 sp = vec2((p.x + uPos*180.0)*0.0105/uS, p.y*0.0042/uS + t*1.4);
    vec2 q = flow(sp*0.7, t*0.5);
    float g = fbm(sp + q*1.5 + vec2(uDir*t, 0.0), t);
    float g2 = fbm(sp + q*1.5 + vec2(uDir*t - 0.06, -0.08), t);
    float T = smoothstep(0.5, 0.78, g)*up*uEnergy*uSmoke;
    col = mix(col, tint(clamp(0.7 + (g - g2)*3.4, 0.0, 1.0)), clamp(T*0.8, 0.0, 0.8));
  }
}
// the fold: a ring of smoke rolling outward from the middle of the screen
if (uBurst > 0.0 && uBurst < 1.0) {
  vec2 d = (p - uBc)/max(uRes.x, uRes.y);
  float rr = length(d);
  float rad = uBurst*1.05;
  float ring = exp(-pow((rr - rad)*4.2, 2.0))*(1.0 - uBurst*uBurst);
  float fill = smoothstep(rad + 0.06, rad - 0.28, rr)*(1.0 - smoothstep(0.0, 0.7, uBurst));
  vec2 q = flow(p*0.0026/uS - d*uBurst*1.6, uT*0.05);
  float g = fbm(p*0.0039/uS + q*0.85, uT*0.05);
  float g2 = fbm(p*0.0039/uS + q*0.85 + vec2(-0.09, -0.16), uT*0.05);
  float A = clamp((ring*1.5 + fill)*smoothstep(0.16, 0.62, g)*1.5, 0.0, 0.97);
  col = mix(col, tint(clamp(0.8 + (g - g2)*2.2, 0.0, 1.0)), A);
}
if (uVeil > 0.0) {
  vec2 q = flow(p*0.0026/uS, uT*0.05);
  float g = fbm(p*0.0039/uS + q*0.85, uT*0.05);
  float g2 = fbm(p*0.0039/uS + q*0.85 + vec2(-0.09, -0.16), uT*0.05);
  float A = smoothstep(0.0, 0.55, uVeil*1.5 - (1.0 - g)*0.9 + (uFloor - p.y)*0.0);
  col = mix(col, tint(clamp(0.8 + (g - g2)*2.2, 0.0, 1.0)), clamp(A, 0.0, 1.0));
}
// the clouds part: the thinnest smoke goes first, so the shelf shows through gaps that widen
float a = 1.0;
if (uClear > 0.0) {
  vec2 q = flow(p*0.0026/uS, uT*0.05);
  float g = fbm(p*0.0039/uS + q*0.85, uT*0.05);
  a = 1.0 - smoothstep(0.0, 0.26, uClear*1.5 - g);
}
o = vec4(col*a, a);
}`;
  const comp = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, comp(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, comp(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.error(err);
    self.setState({ noGL: true });
    return noStage;
  }
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());
  const U = {};
  ['uN', 'uTa', 'uTb', 'uRes', 'uBc', 'uDpr', 'uT', 'uPos', 'uFloor', 'uCx', 'uS', 'uRing', 'uEnergy', 'uVeil', 'uBurst', 'uSmoke', 'uDir', 'uClear', 'uPalMix', 'uPal', 'uRa', 'uRb', 'uCa', 'uCb'].forEach((k) => { U[k] = gl.getUniformLocation(prog, k); });

  // noise lives in a small repeating texture, so the many samples per pixel stay cheap on a phone
  const noise = new Uint8Array(256 * 256);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.floor(Math.random() * 256);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 256, 0, gl.RED, gl.UNSIGNED_BYTE, noise);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.uniform1i(U.uN, 0);

  const chars = self.items.map((it, i) => ({ i, ready: false, unit: i + 1, nw: 1, nh: 1, tex: [] }));
  const upload = (c, n, source, nw, nh) => {
    gl.activeTexture(gl.TEXTURE0 + c.unit);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    c.tex[n] = tex;
    c.nw = nw; c.nh = nh; c.ready = true;
  };
  chars.forEach((c) => {
    const urls = self.items[c.i].frames || [self.items[c.i].src];
    const rest = urls.length - 1;
    urls.forEach((url, n) => {
      fetch(url).then((r) => r.blob()).then((b) => createImageBitmap(b, { premultiplyAlpha: 'premultiply' })).then((bmp) => {
        upload(c, n, bmp, bmp.width, bmp.height);
        if (still) paint(performance.now(), true);
      }).catch((err) => {
        console.error(err);
        // a missing in-between frame only makes the flipbook coarser; the resting frame is the one that matters
        if (n === rest) self.setState({ noGL: true });
      });
    });
  });
  // Flipbook: the wheel's position picks the frame, so a swipe scrubs it and swiping away plays it backwards.
  const frameTex = (c) => {
    const last = c.tex.length - 1;
    const a = Math.abs(self.wrap(c.i - self.pos));
    const want = Math.round((1 - Math.min(1, a / (self.props.flipReach ?? 0.5))) * last);
    for (let d = 0; d <= last; d++) {
      if (c.tex[want + d]) return c.tex[want + d];
      if (c.tex[want - d]) return c.tex[want - d];
    }
    return null;
  };

  const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
  const palettes = self.items.map((it) => (it.palette ? new Float32Array(it.palette.flatMap(hex)) : null));
  let palMix = 0, palOn = -1;

  let g = self.geom(self.state.key);
  const setLayout = (key) => {
    g = self.geom(key);
    cv.width = g.w * dpr;
    cv.height = g.h * dpr;
    gl.viewport(0, 0, cv.width, cv.height);
  };
  setLayout(g.key);

  const rectOf = (c, key) => {
    const q = self.geom(key);
    const hgt = q.heights[c.i];
    const wid = (hgt * c.nw) / c.nh;
    return { x: q.cx - wid / 2, y: q.base - q.lift[c.i] - hgt + smooth(0, 0.6, self.tr) * 90, w: wid, h: hgt, lod: Math.max(0, Math.log2(c.nw / (wid * dpr))) };
  };
  const setChar = (slot, c, key, R, side) => {
    const uT = slot === 'a' ? U.uTa : U.uTb, uR = slot === 'a' ? U.uRa : U.uRb, uC = slot === 'a' ? U.uCa : U.uCb;
    if (!c || !c.ready || R <= 0) { gl.uniform3f(uC, 0, 1, 0); gl.uniform4f(uR, 0, 0, 1, 1); gl.uniform1i(uT, 1); return; }
    const r = rectOf(c, key);
    gl.activeTexture(gl.TEXTURE0 + c.unit);
    gl.bindTexture(gl.TEXTURE_2D, frameTex(c));
    gl.uniform1i(uT, c.unit);
    gl.uniform4f(uR, r.x, r.y, r.w, r.h);
    gl.uniform3f(uC, R, side, r.lod);
  };

  let last = performance.now(), prev = self.pos, raf = 0, energy = 0, skip = 0;

  const sync = (pos, ft) => {
    const br = Math.round(self.breath * 50) / 50;
    if (Math.abs(pos - self.state.pos) > 0.0005 || ft !== self.state.ft || self.tr !== (self.state.tr || 0) || br !== (self.state.br || 0)) self.setState({ pos, ft, tr: self.tr, br });
  };

  const paint = (now, force) => {
    const dt = Math.min(0.05, (now - last) / 1000) || 0;
    last = now;
    // the sheet covers the whole picture, so don't spend the battery drawing it
    if (self.trDone && self.tr >= 1 && self.trT === 1 && !self.foldDir && !force) return;
    if (!self.drag && !still) {
      const gap = self.target - self.pos;
      self.pos = Math.abs(gap) < 0.0015 ? self.target : self.pos + gap * (1 - Math.exp(-dt * 5));
    }
    if (self.foldT < 1) {
      self.foldT = Math.min(1, self.foldT + dt / (self.props.foldSeconds ?? 1.8));
      if (self.foldT >= 1) self.foldDir = null;
    }
    if (self.tr !== self.trT && !(self.drag && self.drag.vert)) {
      const st = dt / (self.props.travelSeconds ?? 1.4);
      self.tr = self.trT > self.tr ? Math.min(self.trT, self.tr + st) : Math.max(self.trT, self.tr - st);
    }
    // going back, the detail gives way to the list while the cloud hides the swap
    if (self.trT === 0 && self.state.detail && self.tr > 0 && self.tr < 0.55) self.setState({ detail: null });
    const ft = self.foldT, dir = self.foldDir;
    const pos = self.pos;
    const vel = dt > 0 ? (pos - prev) / dt : 0;
    prev = pos;
    const between = Math.abs(pos - Math.round(pos));
    // left alone, the cloud breathes upward now and then: the word lifts and wisps rise, inviting the swipe
    if (!still && !self.drag && between < 0.002 && self.tr === 0 && !dir && self.state.key === 'closed') self.idleT += dt;
    else self.idleT = 0;
    const breathEvery = self.opened ? 9 : 4.2;
    const breathAt = self.idleT > 1.8 ? ((self.idleT - 1.8) % breathEvery) / 1.6 : 2;
    self.breath = breathAt < 1 ? Math.pow(Math.sin(Math.PI * breathAt), 2) : 0;
    const want = Math.max(Math.min(1, Math.abs(vel) * 0.9), smooth(0.02, 0.3, between), dir ? 1 - ft : 0, self.tr > 0 && self.tr < 1 ? 1 : 0, self.breath * 0.55);
    energy += (want - energy) * (1 - Math.exp(-dt * 7));
    if (force) energy = Math.max(energy, want);

    // quiet screen: 30 frames a second is plenty for drifting cloud
    const moving = force || dir || between > 0.001 || energy > 0.02 || (self.tr > 0 && !self.trDone);
    if (!moving && (skip = (skip + 1) % 2)) {
      sync(pos, ft);
      return;
    }

    let cx = g.cx, floor = g.floor, burst = 0, veil = 0, clear = 0;
    if (self.state.key === 'closed' && (self.tr > 0 || self.breath > 0)) {
      floor -= smooth(0, 0.6, self.tr) * g.h * 0.95 + self.breath * 16;
      veil = smooth(0.28, 0.58, self.tr);
      clear = smooth(0.62, 1, self.tr);
    }
    if (dir === 'open') {
      const e = smooth(0, 0.8, ft);
      cx = lerp(g.w / 2, g.cx, e);
      floor = lerp(g.floor - 70, g.floor, e);
      burst = Math.min(0.999, ft * 1.25);
    } else if (dir === 'close') {
      floor = lerp(g.floor - g.h * 0.4, g.floor, smooth(0.05, 1, ft));
      veil = 1 - smooth(0.0, 0.72, ft);
    }

    const order = chars.map((c, i) => ({ c, o: self.wrap(i - pos) })).sort((a, b) => Math.abs(a.o) - Math.abs(b.o));
    const reveal = (a) => 1 - smooth(0.0, 0.9, a);
    const sideOf = (o) => (o < 0 ? -1 : 1);
    if (dir === 'open') {
      const near = order[0];
      setChar('a', near.c, g.key, smooth(0.25, 1, ft) * reveal(Math.abs(near.o)), 1);
      setChar('b', near.c, 'openFrom', 1 - smooth(0, 0.45, ft), -1);
    } else if (dir === 'close') {
      const near = order[0];
      setChar('a', near.c, g.key, smooth(0.12, 1, ft) * reveal(Math.abs(near.o)), 1);
      setChar('b', null, g.key, 0, 1);
    } else {
      setChar('a', order[0].c, g.key, reveal(Math.abs(order[0].o)), sideOf(order[0].o));
      setChar('b', order[1].c, g.key, reveal(Math.abs(order[1].o)), sideOf(order[1].o));
    }

    gl.uniform2f(U.uRes, g.w, g.h);
    gl.uniform2f(U.uBc, g.w / 2, g.h * 0.72);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uT, still ? 12 : (now / 1000) % 1000);
    gl.uniform1f(U.uPos, pos);
    gl.uniform1f(U.uFloor, floor);
    gl.uniform1f(U.uCx, cx);
    gl.uniform1f(U.uS, g.s);
    gl.uniform1f(U.uRing, g.ring * 1.3);
    gl.uniform1f(U.uEnergy, energy);
    gl.uniform1f(U.uVeil, veil);
    gl.uniform1f(U.uClear, clear);
    // the shelf being opened brings its own colours: they bloom as the cloud rises and drain back as it sinks
    const N = self.items.length;
    const shelf = ((Math.round(pos) % N) + N) % N;
    const palWant = palettes[shelf] && self.state.key === 'closed' ? smooth(0.0, 0.3, self.tr) : 0;
    palMix = still ? palWant : palMix + (palWant - palMix) * (1 - Math.exp(-dt * 6));
    if (palWant > 0 && palOn !== shelf) { gl.uniform3fv(U.uPal, palettes[shelf]); palOn = shelf; }
    gl.uniform1f(U.uPalMix, palOn >= 0 ? palMix : 0);
    gl.uniform1f(U.uBurst, burst);
    gl.uniform1f(U.uSmoke, self.props.smoke ?? 1);
    gl.uniform1f(U.uDir, vel > 0 ? -1 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    self.trDone = self.tr >= 1;

    sync(pos, ft);
  };

  const loop = (t) => { paint(t); raf = requestAnimationFrame(loop); };
  if (!still) raf = requestAnimationFrame(loop);
  else setTimeout(() => paint(performance.now()), 400);

  return {
    gl,
    paint: () => paint(performance.now(), true),
    stop: () => { if (raf) cancelAnimationFrame(raf); raf = 0; },
    // the screen changed shape or size: redraw at the new layout
    resize: () => {
      setLayout(self.curKey);
      self.trDone = false;
      paint(performance.now(), true);
    }
  };
}
