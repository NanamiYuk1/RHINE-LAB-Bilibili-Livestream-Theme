(function (root) {
  'use strict';
  const W = 1920,
    H = 560,
    clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  function surface(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function random(seed) {
    let n = seed;
    return () => {
      n = (Math.imul(n, 1664525) + 1013904223) | 0;
      return (n >>> 0) / 4294967296;
    };
  }
  function field(seed) {
    const r = random(seed),
      grid = Float32Array.from({ length: 128 * 128 }, r);
    return (x, y) => {
      const ix = Math.floor(x),
        iy = Math.floor(y);
      let fx = x - ix,
        fy = y - iy;
      fx = fx * fx * (3 - 2 * fx);
      fy = fy * fy * (3 - 2 * fy);
      const at = (a, b) => grid[(a & 127) + (b & 127) * 128];
      return (
        (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) +
        (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy
      );
    };
  }
  let shared;
  class NowPlayingMaterial {
    static shared() {
      return shared || (shared = new NowPlayingMaterial());
    }
    constructor() {
      const r = random(6729),
        noise = field(173),
        fibres = field(982);
      this.paper = surface(768, 224);
      this.substrate = surface(768, 224);
      const p = this.paper.getContext('2d'),
        s = this.substrate.getContext('2d'),
        pd = p.createImageData(768, 224),
        sd = s.createImageData(768, 224);
      for (let y = 0; y < 224; y++)
        for (let x = 0; x < 768; x++) {
          const warp = noise(x / 35, y / 25),
            coarse = noise(x / 18 + warp * 2, y / 14 + warp),
            fine = noise(x / 3.7, y / 2.9),
            vein = fibres(x / 8 + warp * 5, y / 7 + coarse * 3);
          const mottling = clamp((coarse - 0.5) * 2.5, -0.65, 0.65),
            crease = Math.pow(1 - Math.abs(vein - 0.5) * 2, 15);
          const v = clamp(
              222 + mottling * 49 + (fine - 0.5) * 26 - crease * 20 + (r() - 0.5) * 22,
              145,
              251,
            ),
            i = (y * 768 + x) * 4;
          pd.data.set([v, v * 0.973, v * 0.917, 255], i);
          const dark = 9 + coarse * 7 + fine * 3 + (r() - 0.5) * 5;
          sd.data.set([dark, dark * 1.015, dark * 0.94, 255], i);
        }
      p.putImageData(pd, 0, 0);
      s.putImageData(sd, 0, 0);
      // Ink surface for RHINE LAB typography: warm near-black, same fibres as the paper.
      this.ink = surface(768, 224);
      const ink = this.ink.getContext('2d'),
        inkData = ink.createImageData(768, 224);
      for (let y = 0; y < 224; y++)
        for (let x = 0; x < 768; x++) {
          const warp = noise(x / 35, y / 25),
            coarse = noise(x / 18 + warp * 2, y / 14 + warp),
            fine = noise(x / 3.7, y / 2.9);
          const value = clamp(17 + coarse * 11 + fine * 5 + (r() - 0.5) * 7, 8, 46),
            i = (y * 768 + x) * 4;
          inkData.data.set([value, value * 0.985, value * 0.94, 255], i);
        }
      ink.putImageData(inkData, 0, 0);
      // Fixed fibres belong to the printed surface; only the recorded signal noise moves.
      for (let i = 0; i < 1600; i++) {
        const x = r() * 768,
          y = r() * 224;
        p.strokeStyle = r() > 0.3 ? 'rgba(78,68,53,.16)' : 'rgba(255,252,232,.30)';
        p.lineWidth = 0.3 + r() * 0.65;
        p.beginPath();
        p.moveTo(x, y);
        p.lineTo(x + 1 + r() * 8, y + (r() - 0.5) * 3);
        p.stroke();
      }
      this.grain = [];
      for (let n = 0; n < 6; n++) {
        const c = surface(768, 224),
          g = c.getContext('2d'),
          d = g.createImageData(768, 224);
        for (let i = 0; i < d.data.length; i += 4) {
          const v = r() > 0.5 ? 230 : 14;
          d.data.set([v, v, v, 8 + r() * 23], i);
        }
        g.putImageData(d, 0, 0);
        this.grain.push(c);
      }
      this.scan = surface(W, H);
      const scan = this.scan.getContext('2d');
      for (let y = 12; y < 548; y += 3) {
        scan.fillStyle = 'rgba(0,0,0,' + (0.06 + r() * 0.05) + ')';
        scan.fillRect(11, y, W - 22, 1);
      }
      this.rim = surface(W, H);
      const rim = this.rim.getContext('2d');
      rim.strokeStyle = '#080a08';
      rim.lineWidth = 1.5;
      rim.strokeRect(9.5, 9.5, W - 19, H - 21);
      rim.strokeStyle = 'rgba(170,165,154,.65)';
      rim.lineWidth = 1;
      rim.strokeRect(13.5, 13.5, W - 27, H - 29);
      // 四角刻线 + 暖杏金定位点
      rim.strokeStyle = '#080a08';
      rim.lineWidth = 2;
      for (const [x, y, sx, sy] of [
        [20, 20, 1, 1],
        [W - 20, 20, -1, 1],
        [20, H - 22, 1, -1],
        [W - 20, H - 22, -1, -1],
      ]) {
        rim.beginPath();
        rim.moveTo(x + 26 * sx, y);
        rim.lineTo(x, y);
        rim.lineTo(x, y + 16 * sy);
        rim.stroke();
      }
      rim.fillStyle = '#c5a16b';
      for (const [x, y] of [
        [20, 20],
        [W - 20, 20],
        [20, H - 22],
        [W - 20, H - 22],
      ])
        rim.fillRect(x - 2, y - 2, 4, 4);
    }
    backdrop(ctx) {
      // RHINE LAB：暖白档案纸 + 细网格 + 轻暖光，不再使用深色 VHS 底。
      ctx.drawImage(this.paper, 0, 0, W, H);
      ctx.fillStyle = 'rgba(234,229,225,.68)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(74,66,55,.055)';
      ctx.lineWidth = 1;
      for (let x = 24; x < W; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 10);
        ctx.lineTo(x + 0.5, H - 10);
        ctx.stroke();
      }
      for (let y = 24; y < H; y += 48) {
        ctx.beginPath();
        ctx.moveTo(10, y + 0.5);
        ctx.lineTo(W - 10, y + 0.5);
        ctx.stroke();
      }
      const glow = ctx.createLinearGradient(0, 0, W, H);
      glow.addColorStop(0, 'rgba(255,248,234,.55)');
      glow.addColorStop(0.5, 'rgba(255,250,240,.16)');
      glow.addColorStop(1, 'rgba(230,224,214,.05)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      const vignette = ctx.createRadialGradient(930, 250, 220, 950, 280, 1100);
      vignette.addColorStop(0, 'rgba(255,255,255,0)');
      vignette.addColorStop(1, 'rgba(74,66,55,.12)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(247,244,239,.85)';
      ctx.fillRect(33, 24, 499, 499);
    }
    typography(titleLayout, titleBox, artistLayout, artistBox) {
      const c = surface(W, H),
        ctx = c.getContext('2d');
      NowPlayingType.draw(ctx, titleLayout, titleBox);
      NowPlayingType.draw(ctx, artistLayout, artistBox);
      ctx.globalCompositeOperation = 'source-in';
      ctx.drawImage(this.ink, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      const recorded = surface(W, H),
        r = recorded.getContext('2d');
      r.globalAlpha = 0.08;
      r.drawImage(c, 1.2, 0.3);
      r.globalAlpha = 1;
      r.drawImage(c, 0, 0);
      return recorded;
    }
    type(ctx, layer, amount) {
      ctx.drawImage(layer, 0, 0);
    }
    finish(out, scene, now, texture, flow) {
      const tick = Math.floor(now / 83),
        r = random(tick + 920),
        amount = clamp(texture);
      out.drawImage(scene, 0, 0);
      out.save();
      out.beginPath();
      out.rect(10, 10, 1900, 538);
      out.clip();
      if (amount > 0.001) {
        // RHINE LAB：只保留很轻的纸张颗粒、扫描线与暖杏金扫光。
        out.globalCompositeOperation = 'multiply';
        out.globalAlpha = amount * 0.60;
        out.drawImage(this.grain[tick % 6], 0, 0, W, H);
        out.globalCompositeOperation = 'source-over';
        out.globalAlpha = amount * 0.30;
        out.drawImage(this.scan, 0, 0);
        const speed = 0.2 + 1.8 * clamp(flow),
          roll = ((now * 0.012 * speed) % 760) - 90,
          band = out.createLinearGradient(0, roll - 42, 0, roll + 42);
        band.addColorStop(0, 'rgba(197,161,107,0)');
        band.addColorStop(0.5, 'rgba(197,161,107,.09)');
        band.addColorStop(1, 'rgba(197,161,107,0)');
        out.globalAlpha = amount * 0.75;
        out.fillStyle = band;
        out.fillRect(11, roll - 42, 1898, 84);
        out.globalAlpha = amount * 0.06;
        out.fillStyle = '#4a4237';
        out.fillRect(12, 12, 1896, 0.6);
      }
      out.restore();
      out.drawImage(this.rim, 0, 0);
    }
  }
  root.NowPlayingMaterial = NowPlayingMaterial;
})(window);
