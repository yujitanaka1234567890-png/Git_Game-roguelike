// 3D表示の背景（壁・床のない黒い所に見える、ステージごとの動く景色）。見た目だけでゲームの進行には関係しない。
// 3Dの画面（render3d.js）のすぐ後ろに、もう1枚の画用紙を重ねて描く。3Dの画面は何もない所が透けている。
// 景色は時間でくり返し動く（ループ）。カメラが動くと少しだけずれて、奥行きがあるように見せる。
//
// ダンジョンの backdrop（data/dungeons.js）で景色を選ぶ。拠点は THEMES.dusk。
//   後から精緻な絵を使う時：THEMES の景色に image: "img/xxx.png" と scroll: [横, 縦]（1秒に動く点の数）を書くと、
//   その絵を敷き詰めてゆっくり流し、その上に粒の動き（draw）を重ねる。
Game.backdrop = {
  canvas: null,
  ctx: null,
  W: 480, // 画用紙の大きさ（3Dの画面の半分。CSS で引き伸ばす）
  H: 324,
  images: {}, // 読み込んだ絵 { パス: Image }
  seeds: {}, // 景色ごとの粒の並び（最初に1回だけ作る）

  // 3Dの画面 gameCanvas の後ろに画用紙を用意する
  setup: function (gameCanvas) {
    if (this.canvas) return;
    var cv = document.createElement("canvas");
    cv.id = "backdrop3d";
    cv.width = this.W;
    cv.height = this.H;
    cv.style.display = "none";
    gameCanvas.parentNode.insertBefore(cv, gameCanvas);
    this.canvas = cv;
    this.ctx = cv.getContext("2d");
  },

  show: function (on) {
    if (this.canvas) this.canvas.style.display = on ? "" : "none";
  },

  // 3Dの画面にぴったり重ねる（画面の大きさが変わってもずれないよう、毎回合わせる）
  fit: function (gameCanvas) {
    var s = this.canvas.style;
    var left = gameCanvas.offsetLeft + gameCanvas.clientLeft + "px";
    var top = gameCanvas.offsetTop + gameCanvas.clientTop + "px";
    var w = gameCanvas.clientWidth + "px", h = gameCanvas.clientHeight + "px";
    if (s.left !== left) s.left = left;
    if (s.top !== top) s.top = top;
    if (s.width !== w) s.width = w;
    if (s.height !== h) s.height = h;
  },

  // 今の場所の景色
  themeId: function () {
    if (Game.state === "base") return "dusk";
    var dg = Game.currentDungeon();
    return (dg && dg.backdrop) || "starfield";
  },

  // 描く。cam = カメラの位置（マス）。render3d.render から毎回呼ばれる
  draw: function (gameCanvas, cam) {
    if (!this.canvas) return;
    this.fit(gameCanvas);
    var id = this.themeId();
    var th = this.THEMES[id] || this.THEMES.starfield;
    var ctx = this.ctx, t = Date.now() / 1000;
    var px = cam ? cam.x : 0, pz = cam ? cam.z : 0;
    th.sky.call(this, ctx, t);
    if (th.image) this.drawImage(ctx, th, t, px, pz);
    if (!this.seeds[id]) this.seeds[id] = th.seed.call(this);
    th.draw.call(this, ctx, t, this.seeds[id], px, pz);
  },

  // 絵を敷き詰めて流す（後から用意する精緻な背景用）
  drawImage: function (ctx, th, t, px, pz) {
    var img = this.images[th.image];
    if (!img) {
      img = this.images[th.image] = new Image();
      img.src = th.image;
    }
    if (!img.complete || !img.naturalWidth) return;
    var sc = th.scroll || [0, 0];
    var w = img.naturalWidth, h = img.naturalHeight;
    var ox = this.wrap(-(t * sc[0]) - px * 4, w), oy = this.wrap(-(t * sc[1]) - pz * 4, h);
    for (var y = oy - h; y < this.H; y += h) {
      for (var x = ox - w; x < this.W; x += w) ctx.drawImage(img, x, y);
    }
  },

  // 0〜m の範囲にくり返す（ループ）
  wrap: function (v, m) {
    return ((v % m) + m) % m;
  },

  // 決まった並びの乱数（毎回同じ景色になるように）
  rand: function (n) {
    var s = n * 9301 + 49297;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  },

  // 縦のグラデーションで空（海）を塗る
  gradient: function (ctx, top, bottom) {
    var g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  },

  THEMES: {
    // 時空の星空（はじまりの箱庭）：星がゆっくり斜めに流れ、ときどき流れ星。遠い星雲がにじむ
    starfield: {
      sky: function (ctx) { this.gradient(ctx, "#07061a", "#120c24"); },
      seed: function () {
        var r = this.rand(7), stars = [], nebula = [];
        for (var i = 0; i < 140; i++) {
          stars.push({ x: r() * this.W, y: r() * this.H, depth: 0.25 + r() * 0.75, tw: r() * 6.28, size: r() < 0.12 ? 2 : 1 });
        }
        for (var j = 0; j < 4; j++) {
          nebula.push({ x: r() * this.W, y: r() * this.H, rad: 60 + r() * 70, hue: r() < 0.5 ? "90,70,170" : "40,110,140" });
        }
        return { stars: stars, nebula: nebula };
      },
      draw: function (ctx, t, s, px, pz) {
        var W = this.W, H = this.H, i;
        for (i = 0; i < s.nebula.length; i++) {
          var nb = s.nebula[i];
          var nx = this.wrap(nb.x - t * 1.5 - px * 1.5, W + 200) - 100, ny = this.wrap(nb.y + t * 0.6 - pz, H + 200) - 100;
          var g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nb.rad);
          g.addColorStop(0, "rgba(" + nb.hue + ",0.22)");
          g.addColorStop(1, "rgba(" + nb.hue + ",0)");
          ctx.fillStyle = g;
          ctx.fillRect(nx - nb.rad, ny - nb.rad, nb.rad * 2, nb.rad * 2);
        }
        for (i = 0; i < s.stars.length; i++) {
          var st = s.stars[i];
          var x = this.wrap(st.x - t * 8 * st.depth - px * 3 * st.depth, W);
          var y = this.wrap(st.y + t * 3 * st.depth - pz * 3 * st.depth, H);
          var a = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.3 + st.tw)) * st.depth;
          ctx.fillStyle = "rgba(220,230,255," + a.toFixed(2) + ")";
          ctx.fillRect(x | 0, y | 0, st.size, st.size);
        }
        // 流れ星：7秒ごとに1本、場所を変えて
        var cyc = Math.floor(t / 7), ph = t / 7 - cyc;
        if (ph < 0.12) {
          var rr = this.rand(cyc + 3);
          var sx = W * (0.3 + rr() * 0.7), sy = H * rr() * 0.5, k = ph / 0.12;
          var hx = sx - k * 140, hy = sy + k * 60;
          var tg = ctx.createLinearGradient(hx, hy, hx + 40, hy - 17);
          tg.addColorStop(0, "rgba(255,255,255," + (1 - k).toFixed(2) + ")");
          tg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = tg;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx + 40, hy - 17);
          ctx.stroke();
        }
      },
    },

    // 水の中（水底の都）：上から光の筋がゆらめき、泡がゆらゆらと昇る
    underwater: {
      sky: function (ctx) { this.gradient(ctx, "#0d3550", "#04121e"); },
      seed: function () {
        var r = this.rand(11), bubbles = [], rays = [];
        for (var i = 0; i < 45; i++) bubbles.push({ x: r() * this.W, y: r() * this.H, speed: 10 + r() * 22, rad: 1 + r() * 2.5, wob: r() * 6.28 });
        for (var j = 0; j < 6; j++) rays.push({ x: r() * this.W, w: 20 + r() * 40, ph: r() * 6.28 });
        return { bubbles: bubbles, rays: rays };
      },
      draw: function (ctx, t, s, px, pz) {
        var W = this.W, H = this.H, i;
        for (i = 0; i < s.rays.length; i++) {
          var ry = s.rays[i];
          var rx = this.wrap(ry.x + Math.sin(t * 0.4 + ry.ph) * 30 - px * 2, W + 120) - 60;
          var a = 0.06 + 0.05 * Math.sin(t * 0.7 + ry.ph);
          var g = ctx.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, "rgba(150,210,255," + a.toFixed(3) + ")");
          g.addColorStop(1, "rgba(150,210,255,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(rx, 0);
          ctx.lineTo(rx + ry.w, 0);
          ctx.lineTo(rx + ry.w * 2.2 - 60, H);
          ctx.lineTo(rx + ry.w * 1.2 - 60, H);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = "rgba(190,230,255,0.55)";
        ctx.lineWidth = 1;
        for (i = 0; i < s.bubbles.length; i++) {
          var b = s.bubbles[i];
          var by = this.wrap(b.y - t * b.speed - pz * 2, H + 20) - 10;
          var bx = this.wrap(b.x + Math.sin(t * 1.5 + b.wob) * 5 - px * 2, W);
          ctx.beginPath();
          ctx.arc(bx, by, b.rad, 0, Math.PI * 2);
          ctx.stroke();
        }
      },
    },

    // 深海の闇（深淵の迷宮）：ほとんど真っ暗。白い粒（マリンスノー）がゆっくり沈み、ときどき青い光がふっと灯る
    abyss: {
      sky: function (ctx) { this.gradient(ctx, "#030a12", "#010306"); },
      seed: function () {
        var r = this.rand(23), snow = [], glows = [];
        for (var i = 0; i < 90; i++) snow.push({ x: r() * this.W, y: r() * this.H, speed: 3 + r() * 7, drift: r() * 6.28, a: 0.2 + r() * 0.4 });
        for (var j = 0; j < 7; j++) glows.push({ x: r() * this.W, y: r() * this.H, period: 5 + r() * 6, ph: r() });
        return { snow: snow, glows: glows };
      },
      draw: function (ctx, t, s, px, pz) {
        var W = this.W, H = this.H, i;
        for (i = 0; i < s.glows.length; i++) {
          var gl = s.glows[i];
          var k = Math.sin(((t / gl.period + gl.ph) % 1) * Math.PI);
          if (k <= 0.05) continue;
          var gx = this.wrap(gl.x - px * 1.5, W), gy = this.wrap(gl.y - pz * 1.5, H);
          var g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 18);
          g.addColorStop(0, "rgba(90,200,255," + (0.35 * k).toFixed(3) + ")");
          g.addColorStop(1, "rgba(90,200,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(gx - 18, gy - 18, 36, 36);
        }
        for (i = 0; i < s.snow.length; i++) {
          var sn = s.snow[i];
          var y = this.wrap(sn.y + t * sn.speed - pz * 2, H);
          var x = this.wrap(sn.x + Math.sin(t * 0.5 + sn.drift) * 4 - px * 2, W);
          ctx.fillStyle = "rgba(200,220,230," + sn.a.toFixed(2) + ")";
          ctx.fillRect(x | 0, y | 0, 1, 1);
        }
      },
    },

    // 夕暮れ（拠点）：暮れていく空に、ほたるの光がふわふわ漂う
    dusk: {
      sky: function (ctx) { this.gradient(ctx, "#1a1430", "#2a1a22"); },
      seed: function () {
        var r = this.rand(31), flies = [];
        for (var i = 0; i < 26; i++) flies.push({ x: r() * this.W, y: r() * this.H, ph: r() * 6.28, sp: 0.3 + r() * 0.5 });
        return { flies: flies };
      },
      draw: function (ctx, t, s, px, pz) {
        for (var i = 0; i < s.flies.length; i++) {
          var f = s.flies[i];
          var x = this.wrap(f.x + Math.sin(t * f.sp + f.ph) * 20 + t * 4 - px * 2, this.W);
          var y = this.wrap(f.y + Math.cos(t * f.sp * 0.8 + f.ph) * 12 - pz * 2, this.H);
          var a = 0.3 + 0.5 * Math.max(0, Math.sin(t * 1.7 + f.ph * 3));
          ctx.fillStyle = "rgba(230,240,140," + a.toFixed(2) + ")";
          ctx.fillRect(x | 0, y | 0, 2, 2);
        }
      },
    },
  },
};
