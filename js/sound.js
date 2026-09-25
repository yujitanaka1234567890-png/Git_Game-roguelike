// 効果音。録音データや外部の音素材は一切使わず、ブラウザの音声合成（Web Audio API）で
// その場で波形（音の高さ・長さ・音色）を組み立てて鳴らす。すべてこのゲームのためのオリジナル。
// ・レベルアップの「ジャジャーン」は、のこぎり波を歪ませてエレキギター風のパワーコードにしている。
// ・ボス戦のBGMは、このゲームのために作ったオリジナルの曲（music.js）。
// ・ゲームオーバーの曲は、J.S.バッハ「トッカータとフーガ ニ短調」の冒頭（18世紀の曲で著作権は切れている）を
//   この場で合成して鳴らしている（録音は使っていない）。
// ブラウザの決まりで、最初にキーを押すまでは音が出ない（unlock）。M キーで音のオン／オフ。
Game.sound = {
  enabled: true,
  volume: 0.22, // 全体の音量（0〜1）
  ctx: null,
  master: null,
  prefKey: "dimension-roguelike-sound",

  init: function () {
    try {
      if (window.localStorage.getItem(this.prefKey) === "off") this.enabled = false;
    } catch (e) {
      // 覚えておけなくても音は鳴らせる
    }
  },

  // 最初のキー入力で音の準備をする（ブラウザは操作の前に音を出させてくれないため）
  unlock: function () {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // 音声合成に対応していないブラウザでは鳴らさない
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  },

  toggle: function () {
    this.enabled = !this.enabled;
    try {
      window.localStorage.setItem(this.prefKey, this.enabled ? "on" : "off");
    } catch (e) {
      // 覚えておけなくても切り替えはできる
    }
    return this.enabled;
  },

  // 単音：freq(Hz) から toFreq へ音程を動かしながら dur 秒鳴らす。type = 波形（sine/square/triangle/sawtooth）
  tone: function (freq, dur, type, vol, toFreq, delay) {
    var ctx = this.ctx;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  // 雑音（打撃・炎・カチッという音など）。lowpass = こもらせる周波数 / highpass = 低い音を削る周波数
  noise: function (dur, vol, delay, lowpass, highpass) {
    var ctx = this.ctx;
    var t0 = ctx.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var node = src;
    if (lowpass) {
      var f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lowpass;
      node.connect(f);
      node = f;
    }
    if (highpass) {
      var h = ctx.createBiquadFilter();
      h.type = "highpass";
      h.frequency.value = highpass;
      node.connect(h);
      node = h;
    }
    node.connect(g);
    g.connect(this.master);
    src.start(t0);
  },

  // 歪み（ディストーション）の形。エレキギターのような「ジャーン」という音にするのに使う
  distCurve: null,
  distortion: function () {
    if (!this.distCurve) {
      var n = 1024, curve = new Float32Array(n), k = 40;
      for (var i = 0; i < n; i++) {
        var x = (i * 2) / n - 1;
        curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
      }
      this.distCurve = curve;
    }
    var ws = this.ctx.createWaveShaper();
    ws.curve = this.distCurve;
    ws.oversample = "4x";
    return ws;
  },

  // エレキギター風のパワーコード（freqs の音を同時に、歪ませて鳴らす）
  guitar: function (freqs, dur, delay, vol) {
    var ctx = this.ctx;
    var t0 = ctx.currentTime + (delay || 0);
    var dist = this.distortion();
    var tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2800;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.01);
    g.gain.setValueAtTime(vol || 0.3, t0 + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    dist.connect(tone);
    tone.connect(g);
    g.connect(this.master);
    for (var i = 0; i < freqs.length; i++) {
      for (var d = -1; d <= 1; d += 2) {
        var osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freqs[i];
        osc.detune.value = d * 7; // 少しずらして厚みを出す
        var pre = ctx.createGain();
        pre.gain.value = 0.35;
        osc.connect(pre);
        pre.connect(dist);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      }
    }
  },

  // 音の高さを順番に鳴らす（メロディ）
  seq: function (freqs, step, type, vol) {
    for (var i = 0; i < freqs.length; i++) this.tone(freqs[i], step * 1.4, type, vol, null, i * step);
  },

  // 効果音の名前で鳴らす
  // 攻撃の音（見た目の攻撃に合わせて少し遅らせて鳴らす。fx.js の soundDelay）
  combatSounds: { hit: true, hurt: true, kill: true, miss: true, death: true },

  play: function (name) {
    if (!this.enabled || !this.ctx) return;
    var self = this;
    var r = this.recipes[name];
    if (!r) return;
    var run = function () {
      try {
        r.call(self);
      } catch (e) {
        // 音が鳴らせなくてもゲームは止めない
      }
    };
    var delay = this.combatSounds[name] && Game.fx ? Game.fx.soundDelay() : 0;
    if (delay > 5) setTimeout(run, delay);
    else run();
  },

  // 声（ブラウザの読み上げ機能）。使えないブラウザでは何もしない
  say: function (text, lang, pitch, rate) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    var u = new window.SpeechSynthesisUtterance(text);
    u.lang = lang || "en-US";
    u.pitch = pitch || 1.2;
    u.rate = rate || 1.1;
    u.volume = Math.min(1, this.volume * 4);
    window.speechSynthesis.speak(u);
    return true;
  },

  recipes: {
    // 敵への攻撃「バシュ」：空気を切る音＋軽い打撃
    hit: function () {
      this.noise(0.13, 0.4, 0, null, 1400);
      this.tone(190, 0.07, "square", 0.2, 90, 0.02);
    },
    hurt: function () { this.tone(160, 0.16, "sawtooth", 0.35, 70); this.noise(0.08, 0.3, 0, 1200); }, // 攻撃を受けた
    miss: function () { this.tone(700, 0.06, "sine", 0.15, 520); },
    // 敵を倒した「ザンッ」：鋭い斬撃音＋余韻
    kill: function () {
      this.noise(0.2, 0.45, 0, null, 2800);
      this.tone(1500, 0.14, "sawtooth", 0.18, 380);
      this.tone(95, 0.12, "sine", 0.3, 60, 0.05);
    },
    // レベルアップ「ジャジャーン」：エレキギター風のパワーコードを短く→長く
    // 精神力が半分を切った時など：遠くでオオカミが「ウォーン」と遠吠えする
    //   低い声（のこぎり波）を「ウ」→「オ」の口の形（こもり方）で響かせ、高さをゆっくり上げてから下げる。
    //   息の音を少し混ぜて、生き物の声らしくする
    howl: function () {
      var ctx = this.ctx, t0 = ctx.currentTime + 0.02, dur = 3.0;
      var out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t0);
      out.gain.exponentialRampToValueAtTime(0.5, t0 + 0.5);
      out.gain.setValueAtTime(0.5, t0 + 2.0);
      out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      var lp = ctx.createBiquadFilter(); // 遠くで鳴っている感じにこもらせる
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      out.connect(lp);
      lp.connect(this.master);
      // 声の高さ（ウォ〜〜ン）：140Hz から 230Hz へ上がり、最後は 150Hz へ下がる
      var voice = ctx.createOscillator();
      voice.type = "sawtooth";
      voice.frequency.setValueAtTime(140, t0);
      voice.frequency.linearRampToValueAtTime(215, t0 + 0.6);
      voice.frequency.linearRampToValueAtTime(230, t0 + 1.9);
      voice.frequency.exponentialRampToValueAtTime(150, t0 + dur);
      var vib = ctx.createOscillator();
      vib.frequency.value = 4.5;
      var vibAmt = ctx.createGain();
      vibAmt.gain.value = 3;
      vib.connect(vibAmt);
      vibAmt.connect(voice.frequency);
      // 口の形：最初は「ウ」（低くこもる）、だんだん「オ」（少し開く）へ
      var f1 = ctx.createBiquadFilter();
      f1.type = "bandpass";
      f1.Q.value = 4;
      f1.frequency.setValueAtTime(330, t0);
      f1.frequency.linearRampToValueAtTime(480, t0 + 0.8);
      f1.frequency.linearRampToValueAtTime(420, t0 + dur);
      var f2 = ctx.createBiquadFilter();
      f2.type = "bandpass";
      f2.Q.value = 5;
      f2.frequency.setValueAtTime(700, t0);
      f2.frequency.linearRampToValueAtTime(850, t0 + 0.8);
      var g1 = ctx.createGain();
      g1.gain.value = 0.9;
      var g2 = ctx.createGain();
      g2.gain.value = 0.35;
      voice.connect(f1);
      voice.connect(f2);
      f1.connect(g1);
      f2.connect(g2);
      g1.connect(out);
      g2.connect(out);
      // 胸に響く低い成分（1オクターブ下）
      var body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(70, t0);
      body.frequency.linearRampToValueAtTime(110, t0 + 0.6);
      body.frequency.linearRampToValueAtTime(115, t0 + 1.9);
      body.frequency.exponentialRampToValueAtTime(75, t0 + dur);
      var bg = ctx.createGain();
      bg.gain.value = 0.25;
      body.connect(bg);
      bg.connect(out);
      // 息の音
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var k = 0; k < len; k++) data[k] = Math.random() * 2 - 1;
      var breath = ctx.createBufferSource();
      breath.buffer = buf;
      var bf = ctx.createBiquadFilter();
      bf.type = "bandpass";
      bf.frequency.value = 600;
      bf.Q.value = 1.2;
      var bgn = ctx.createGain();
      bgn.gain.value = 0.06;
      breath.connect(bf);
      bf.connect(bgn);
      bgn.connect(out);
      [voice, vib, body, breath].forEach(function (n) {
        n.start(t0);
        n.stop(t0 + dur + 0.05);
      });
    },
    // 「ひそひそひそ…」：声を出さずに息だけで話す音（ささやき）を、子音と母音に分けて合成する
    //   ひ＝息の「h」→ 口のすぼまった「i」、そ＝鋭い「s」→ 丸い「o」。これを小声で早口にくり返す
    whisper: function () {
      var ctx = this.ctx, master = this.master;
      var len = Math.floor(ctx.sampleRate * 0.4);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      var out = ctx.createGain();
      out.gain.value = 0.9;
      if (pan) {
        out.connect(pan);
        pan.connect(master);
      } else {
        out.connect(master);
      }
      // 息の音を1つ：filters = [[種類, 周波数, Q, 強さ], ...] を並列に通して足す
      var puff = function (t, dur, peak, filters) {
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, dur / 3));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        filters.forEach(function (f) {
          var bq = ctx.createBiquadFilter();
          bq.type = f[0];
          bq.frequency.value = f[1];
          bq.Q.value = f[2];
          var fg = ctx.createGain();
          fg.gain.value = f[3];
          src.connect(bq);
          bq.connect(fg);
          fg.connect(g);
        });
        g.connect(out);
        src.start(t, Math.random() * 0.2);
        src.stop(t + dur + 0.02);
      };
      var H = [["bandpass", 1800, 0.8, 0.5]];
      var I = [["bandpass", 320, 6, 2.2], ["bandpass", 2400, 8, 2.6], ["bandpass", 3200, 8, 1.2]];
      var S = [["highpass", 5200, 0.9, 0.9]];
      var O = [["bandpass", 520, 6, 2.6], ["bandpass", 880, 7, 2.2], ["bandpass", 2600, 6, 0.5]];
      var t = ctx.currentTime + 0.05;
      var start = t;
      var phrases = [3, 2, 3]; // 「ひそひそひそ」「ひそひそ」「ひそひそひそ」
      for (var p = 0; p < phrases.length; p++) {
        for (var k = 0; k < phrases[p]; k++) {
          var v = 0.8 + Math.random() * 0.4; // 1音ずつ少し強さを変える
          puff(t, 0.05, 0.05 * v, H);
          puff(t + 0.035, 0.08, 0.09 * v, I);
          puff(t + 0.11, 0.07, 0.07 * v, S);
          puff(t + 0.17, 0.09, 0.09 * v, O);
          t += 0.27;
        }
        t += 0.35 + Math.random() * 0.2; // 息つぎ
      }
      if (pan) {
        pan.pan.setValueAtTime(-0.7, start);
        pan.pan.linearRampToValueAtTime(0.7, t); // 耳元を横切る
      }
    },
    levelup: function () {
      this.guitar([82.4, 123.5, 164.8], 0.16, 0, 0.3); // ジャ（E のパワーコード）
      this.guitar([110, 164.8, 220], 1.3, 0.2, 0.34); // ジャーン（A のパワーコード）
    },
    allyLevelup: function () { this.seq([659, 880], 0.06, "square", 0.15); }, // 仲間のレベルアップ（控えめ）
    pickup: function () { this.seq([880, 1175], 0.05, "sine", 0.3); },
    use: function () { this.tone(520, 0.18, "triangle", 0.3, 1040); },
    // 回復「しゅぴんっ！」：シュッと上がる音＋キラッとした高い音
    heal: function () {
      this.noise(0.08, 0.15, 0, null, 3000);
      this.tone(700, 0.11, "sine", 0.28, 2600);
      this.tone(2600, 0.16, "triangle", 0.22, null, 0.1);
      this.tone(3900, 0.12, "sine", 0.12, null, 0.12);
    },
    // 最大値が上がった「ぐぐぐっ」：低い音が3段階せり上がる
    maxup: function () {
      var f = [98, 117, 139, 165];
      for (var i = 0; i < f.length; i++) this.tone(f[i], i === 3 ? 0.18 : 0.09, "square", 0.3, f[i] * 1.06, i * 0.11);
    },
    // リボルバーの弾倉を回す音：ジーッ（ラチェット音がだんだん速くなる）→ カキンッカキンッ（金属音）
    fidget: function () {
      var t = 0, gap = 0.09;
      for (var i = 0; i < 9; i++) {
        this.noise(0.018, 0.3, t, 6000);
        this.tone(2600, 0.015, "square", 0.05, null, t);
        t += gap;
        gap = Math.max(0.03, gap * 0.8);
      }
      this.tone(2400, 0.18, "triangle", 0.25, 2300, t + 0.05);
      this.tone(3600, 0.12, "sine", 0.15, null, t + 0.05);
      this.tone(2400, 0.18, "triangle", 0.22, 2300, t + 0.22);
      this.tone(3600, 0.12, "sine", 0.12, null, t + 0.22);
    },
    // 六面パズルを回す「カチャカチャ」：短いプラスチックの音を不規則なリズムで重ねる
    puzzle: function () {
      var times = [0, 0.09, 0.2, 0.27, 0.4, 0.48, 0.6];
      for (var i = 0; i < times.length; i++) {
        var f = 1800 + (i % 3) * 450;
        this.noise(0.03, 0.35, times[i], 3200 + (i % 2) * 1200, 900);
        this.tone(f, 0.02, "square", 0.06, f * 0.8, times[i]);
      }
    },
    throw: function () { this.noise(0.12, 0.2, 0, 1800); this.tone(500, 0.12, "sine", 0.1, 300); },
    // 階段の上り下り「ざっざっざっ」：足音3回
    stairs: function () {
      for (var i = 0; i < 3; i++) {
        this.noise(0.1, 0.5, i * 0.2, 1100, 180);
        this.tone(70, 0.06, "sine", 0.2, 50, i * 0.2);
      }
    },
    warn: function () { this.tone(880, 0.07, "square", 0.15); this.tone(660, 0.07, "square", 0.15, null, 0.1); },
    special: function () { this.noise(0.35, 0.45, 0, 900); this.tone(120, 0.35, "sawtooth", 0.35, 50); },
    breath: function () { this.noise(0.45, 0.4, 0, 700); this.tone(200, 0.4, "sawtooth", 0.2, 90); },
    evolve: function () { this.seq([392, 523, 659, 784, 1047, 1319], 0.07, "sine", 0.3); },
    recruit: function () { this.seq([523, 784, 1047], 0.09, "triangle", 0.3); },
    rescue: function () { this.seq([659, 880, 1175, 1568], 0.08, "sine", 0.3); },
    escape: function () { this.seq([392, 523, 659, 784, 1047], 0.1, "triangle", 0.3); },
    // ゲームオーバー「チャラリ〜 チャラチャラ〜」：パイプオルガン風（トッカータとフーガ ニ短調 冒頭）
    gameover: function () {
      var self = this;
      var organ = function (freq, t, dur) {
        self.tone(freq, dur, "square", 0.12, null, t);
        self.tone(freq / 2, dur, "sine", 0.22, null, t);
        self.tone(freq * 2, dur, "sine", 0.05, null, t);
      };
      // チャラリ〜（ラ・ソ・ラ〜）
      organ(880, 0.0, 0.13);
      organ(784, 0.13, 0.13);
      organ(880, 0.26, 1.0);
      // チャラチャラ〜（ソ・ファ・ミ・レ・ド#・レ〜）
      var run = [784, 698, 659, 587, 554];
      for (var i = 0; i < run.length; i++) organ(run[i], 1.5 + i * 0.14, i === 4 ? 0.5 : 0.15);
      organ(587, 1.5 + 5 * 0.14 + 0.36, 1.6);
      organ(294, 1.5 + 5 * 0.14 + 0.36, 1.6); // 低いレを重ねて重々しく
    },
    death: function () { this.tone(330, 0.5, "sawtooth", 0.25, 110); }, // 仲間が倒れた
    cursor: function () { this.tone(1200, 0.025, "sine", 0.08); },
  },
};
