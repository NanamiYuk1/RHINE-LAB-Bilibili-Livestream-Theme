(function (root) {
  'use strict';
  const W = 1920,
    H = 560,
    clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
    TAU = Math.PI * 2;
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function rand(seed) {
    let n = seed | 0;
    return () => {
      n = (Math.imul(n, 1664525) + 1013904223) | 0;
      return (n >>> 0) / 4294967296;
    };
  }
  const timeText = (v) => {
    v = Math.max(0, Math.floor(v || 0));
    return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
  };
  class HissSpectrum {
    constructor() {
      this.particles = [];
      this.emit = new Float32Array(48);
      this.random = rand(619);
      this.clock = 0;
    }
    reset() {
      this.particles.length = 0;
      this.emit.fill(0);
    }
    draw(ctx, levels, dt, speed) {
      this.clock += dt * speed;
      const x0 = 590,
        y0 = 451,
        width = 1276,
        step = width / 48,
        maxH = 102;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 - 8, y0 - maxH - 3, width + 16, maxH + 10);
      ctx.clip();
      // Each plume is rooted in its measured band; curl changes locally along its height.
      // No minimum fake energy: silence removes both the body and the emitted strands.
      for (let i = 0; i < 48; i++) {
        const e = clamp(levels[i] || 0);
        if (e < 0.012) continue;
        const height = maxH * Math.pow(e, 0.62),
          center = x0 + (i + 0.5) * step,
          phase = i * 2.399,
          t = this.clock;
        const body = ctx.createLinearGradient(0, y0 - height, 0, y0);
        body.addColorStop(0, 'rgba(120,95,60,0)');
        body.addColorStop(0.65, 'rgba(160,125,80,' + e * 0.16 + ')');
        body.addColorStop(1, 'rgba(197,161,107,' + e * 0.22 + ')');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(center - step * 0.44, y0);
        ctx.bezierCurveTo(
          center + 6,
          y0 - height * 0.23,
          center - 8,
          y0 - height * 0.8,
          center,
          y0 - height,
        );
        ctx.bezierCurveTo(
          center + 7,
          y0 - height * 0.75,
          center + step * 0.15,
          y0 - height * 0.2,
          center + step * 0.44,
          y0,
        );
        ctx.fill();
        for (let strand = 0; strand < 4; strand++) {
          const side = strand % 2 ? 1 : -1;
          ctx.beginPath();
          for (let j = 0; j <= 22; j++) {
            const u = j / 22,
              taper = Math.pow(1 - u, 0.8),
              turn = u * 12 - t * 3.4 + phase + strand * 0.85;
            const spread = (4 + e * 12) * taper;
            const bend = Math.sin(u * 8.5 - t * 2.2 + phase) * Math.sin(u * Math.PI) * (2 + e * 6);
            const x =
              center +
              bend +
              side *
                spread *
                (0.42 + 0.46 * Math.sin(turn) + 0.12 * Math.sin(u * 31 + t * 4 + phase));
            const y =
              y0 - u * height + Math.sin(turn * 1.8) * Math.sin(u * Math.PI) * height * 0.032;
            if (!j) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle =
            strand < 2
              ? 'rgba(140,110,70,' + (0.24 + e * 0.28) + ')'
              : 'rgba(197,161,107,' + (0.32 + e * 0.36) + ')';
          ctx.lineWidth = strand < 2 ? 2.8 : 1.2;
          ctx.stroke();
        }
        this.emit[i] += dt * (18 + e * 86) * speed;
        while (this.emit[i] >= 1) {
          this.emit[i]--;
          const r = this.random;
          this.particles.push({
            bin: i,
            x: center + (r() - 0.5) * step * 0.75,
            y: y0 - 1,
            vx: (r() - 0.5) * 30,
            vy: -(35 + e * 210) * speed,
            age: 0,
            life: 0.4 + e * 0.35 + r() * 0.18,
            phase: r() * TAU,
            energy: e,
            history: [],
          });
        }
      }
      const survivors = [];
      ctx.globalCompositeOperation = 'screen';
      const buckets = Array.from({ length: 5 }, () => []);
      for (const p of this.particles) {
        p.age += dt;
        const energy = levels[p.bin] || 0;
        if (p.age > p.life || energy < 0.006) continue;
        const center = x0 + (p.bin + 0.5) * step,
          relative = (y0 - p.y) / maxH,
          travel = this.clock * 2.6 + p.phase;
        const curl =
          Math.sin(relative * 19 + travel) * Math.cos((p.x - center) * 0.11 - travel * 0.7);
        p.vx += (curl * 620 - (p.x - center) * 14 - p.vx * 3) * dt * speed;
        p.vy += (105 + relative * 200 + Math.cos((p.x - center) * 0.2 + travel) * 75) * dt * speed;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > y0 + 2 || p.y < y0 - maxH) continue;
        p.history.push([p.x, p.y, p.age]);
        while (p.history.length > 1 && p.history[0][2] < p.age - 0.34) p.history.shift();
        const fade =
          Math.sin(Math.PI * clamp(p.age / p.life)) *
          Math.min(1, energy / Math.max(0.06, p.energy));
        buckets[Math.min(4, Math.floor(fade * 5))].push(p);
        survivors.push(p);
      }
      // Batch equal-opacity trails to keep many fine fibres affordable at 60 FPS.
      for (let b = 0; b < 5; b++) {
        ctx.beginPath();
        for (const p of buckets[b])
          for (let j = 0; j < p.history.length; j++) {
            const v = p.history[j];
            if (!j) ctx.moveTo(v[0], v[1]);
            else ctx.lineTo(v[0], v[1]);
          }
        ctx.strokeStyle = 'rgba(176,133,84,' + (0.065 + b * 0.072) + ')';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      this.particles = survivors.slice(-1500);
      const average = levels.reduce((a, b) => a + b, 0) / 48;
      if (average > 0.002)
        for (let strand = 0; strand < 3; strand++) {
          ctx.beginPath();
          for (let i = 0; i <= 240; i++) {
            const band = Math.min(47, Math.floor(i / 5)),
              e = levels[band] || 0,
              x = x0 + (width * i) / 240,
              y =
                y0 -
                Math.abs(Math.sin(i * 0.27 + this.clock * 1.8 + strand)) * e * (3 + strand * 2);
            if (!i) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = 'rgba(155,114,71,' + Math.min(0.4, average) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      ctx.restore();
    }
  }
  class NowPlayingRenderer {
    constructor(target) {
      this.canvas = target;
      this.ctx = target.getContext('2d', { alpha: false });
      this.scene = canvas(W, H);
      this.base = this.scene.getContext('2d');
      this.hiss = new HissSpectrum();
      this.material = NowPlayingMaterial.shared();
      this.cover = null;
      this.coverKey = '';
      this.track = null;
      this.switched = -Infinity;
      this.last = NaN;
      this.reference = new Image();
      this.reference.src = 'assets/cover-placeholder.svg?v=rhine1';
    }
    setTrack(track, coverUrl, now) {
      const identity = track.id + '|' + track.title;
      if (this.track && identity !== this.track.id + '|' + this.track.title) this.switched = now;
      this.track = track;
      const words = (track.title || '等待音乐') + ' ' + (track.artist || '打开播放器');
      if (this.fontRequest !== words) {
        this.fontRequest = words;
        this.typeKey = '';
        const specs = [
          NowPlayingType.style(track.title || '等待音乐'),
          NowPlayingType.style(track.artist || '打开播放器'),
        ];
        Promise.all(
          specs.map((spec) =>
            document.fonts.load(spec.weight + ' 80px ' + spec.family.split(',')[0], words),
          ),
        ).then(() => {
          this.typeKey = '';
        });
      }
      if (coverUrl !== this.coverKey) {
        this.coverKey = coverUrl;
        this.cover = null;
        if (coverUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (this.coverKey === coverUrl) this.cover = img;
          };
          img.src = coverUrl;
        }
      }
    }
    replay(now) {
      this.switched = now;
    }
    dispose() {
      this.hiss.dispose?.();
      this.cover = null;
      this.coverSurface = null;
    }
    draw(now, levels, settings, position) {
      const ctx = this.base,
        dt = Number.isFinite(this.last) ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
      this.last = now;
      const texture = clamp(settings.texture);
      this.material.backdrop(ctx);
      const coverSource =
        this.cover ||
        (this.reference.complete && this.reference.naturalWidth ? this.reference : null);
      if (coverSource !== this.coverSurfaceSource || !this.coverSurface) {
        this.coverSurfaceSource = coverSource;
        this.coverSurface = canvas(480, 480);
        const c = this.coverSurface.getContext('2d');
        c.filter = 'contrast(1.02)';
        if (this.cover) {
          const side = Math.min(this.cover.naturalWidth, this.cover.naturalHeight);
          c.drawImage(
            this.cover,
            (this.cover.naturalWidth - side) / 2,
            (this.cover.naturalHeight - side) / 2,
            side,
            side,
            0,
            0,
            480,
            480,
          );
        } else if (coverSource) {
          c.drawImage(
            coverSource,
            0,
            0,
            coverSource.width,
            coverSource.height,
            0,
            0,
            480,
            480,
          );
        } else {
          // RHINE LAB：暖白档案卡 + 黑白双环徽记 + 暖杏金定位点。
          c.fillStyle = '#f7f4ef';
          c.fillRect(0, 0, 480, 480);
          c.strokeStyle = 'rgba(74,66,55,.06)';
          c.lineWidth = 1;
          for (let gx = 40; gx < 480; gx += 40) {
            c.beginPath(); c.moveTo(gx + 0.5, 0); c.lineTo(gx + 0.5, 480); c.stroke();
          }
          for (let gy = 40; gy < 480; gy += 40) {
            c.beginPath(); c.moveTo(0, gy + 0.5); c.lineTo(480, gy + 0.5); c.stroke();
          }
          c.strokeStyle = '#080a08';
          c.lineWidth = 5;
          c.beginPath();
          c.arc(240, 250, 132, 0, Math.PI * 2);
          c.stroke();
          c.lineWidth = 8;
          c.setLineDash([104, 68]);
          c.beginPath();
          c.arc(240, 250, 92, 0, Math.PI * 2);
          c.stroke();
          c.setLineDash([]);
          c.fillStyle = '#080a08';
          c.beginPath();
          c.arc(240, 250, 10, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#c5a16b';
          c.beginPath();
          c.arc(240, 112, 12, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#77756d';
          c.font = '17px "Segoe UI","Microsoft YaHei",sans-serif';
          c.fillText('RHINE LAB / AUDIO ARCHIVE', 34, 438);
          c.fillStyle = '#080a08';
          c.font = '600 17px "Segoe UI","Microsoft YaHei",sans-serif';
          c.fillText('MSR · 内部资料', 34, 462);
        }
      }
      ctx.drawImage(this.coverSurface, 42, 32);
      const glass = ctx.createLinearGradient(42, 0, 522, 0);
      glass.addColorStop(0, 'rgba(255,255,255,.22)');
      glass.addColorStop(0.06, 'rgba(255,255,255,.02)');
      glass.addColorStop(0.94, 'rgba(255,255,255,.02)');
      glass.addColorStop(1, 'rgba(8,10,8,.06)');
      ctx.fillStyle = glass;
      ctx.fillRect(42, 32, 480, 480);
      ctx.strokeStyle = 'rgba(8,10,8,.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(42.5, 32.5, 480, 480);
      const track = this.track || {},
        title = track.hasSong ? track.title : '暂无曲目',
        artist = track.hasSong ? track.artist : '等待播放器 · 内部音频档案',
        typeKey = title + '|' + artist;
      if (this.typeKey !== typeKey) {
        ctx.font = NowPlayingType.font(NowPlayingType.style(artist), 62);
        const longArtist = ctx.measureText(artist).width > 1270;
        this.titleBox = { x: 580, y: 40, width: 1290, height: longArtist ? 190 : 220 };
        this.artistBox = {
          x: 590,
          y: longArtist ? 250 : 264,
          width: 1270,
          height: longArtist ? 92 : 78,
          color: '#dddacf',
        };
        this.titleLayout = NowPlayingType.layout(ctx, title, {
          ...this.titleBox,
          maxSize: 238,
          minSize: 70,
          maxLines: 2,
        });
        this.artistLayout = NowPlayingType.layout(ctx, artist, {
          ...this.artistBox,
          maxSize: 112,
          minSize: 30,
          maxLines: 2,
        });
        this.typeLayer = this.material.typography(
          this.titleLayout,
          this.titleBox,
          this.artistLayout,
          this.artistBox,
        );
        this.typeKey = typeKey;
        this.canvas.setAttribute('aria-label', title + ' / ' + artist);
      }
      this.material.type(ctx, this.typeLayer, texture);
      this.hiss.draw(ctx, levels, dt, settings.flow);
      const row = 493;
      ctx.fillStyle = track.paused ? '#77756d' : '#080a08';
      if (track.paused) {
        ctx.fillRect(590, row - 13, 9, 29);
        ctx.fillRect(607, row - 13, 9, 29);
      } else {
        ctx.beginPath();
        ctx.moveTo(590, row - 17);
        ctx.lineTo(590, row + 18);
        ctx.lineTo(625, row);
        ctx.fill();
      }
      ctx.font = '39px "JetBrains Mono",Consolas,monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#2a2c26';
      ctx.fillText(timeText(position), 658, row - 22);
      ctx.fillText(timeText(track.duration), 1762, row - 22);
      ctx.fillStyle = '#cfc8bc';
      ctx.fillRect(790, row - 3, 921, 3);
      ctx.fillStyle = '#c5a16b';
      ctx.fillRect(790, row - 5, 921 * clamp(position / (track.duration || 1)), 6);
      this.material.finish(this.ctx, this.scene, now, texture, settings.flow);
      const out = this.ctx,
        transition = (now - this.switched) / 1000;
      out.save();
      out.beginPath();
      out.rect(10, 10, 1900, 538);
      out.clip();
      if (transition >= 0 && transition < 0.5) {
        const t = transition / 0.5;
        out.globalAlpha = (1 - t) * 0.55;
        out.fillStyle = '#f7f4ef';
        out.fillRect(10, 10, 1900, 538);
        out.globalAlpha = (1 - t) * 0.45;
        out.fillStyle = '#c5a16b';
        out.fillRect(10, 10, 1900, 5);
        out.globalAlpha = 1;
      }
      out.restore();
    }
  }
  root.NowPlayingRenderer = NowPlayingRenderer;
})(window);
