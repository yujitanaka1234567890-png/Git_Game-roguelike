// 効果音。録音データや外部の音素材は一切使わず、ブラウザの音声合成（Web Audio API）で
// その場で波形（音の高さ・長さ・音色）を組み立てて鳴らす。すべてこのゲームのためのオリジナル。
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

  // 雑音（打撃・炎・カチッという音など）。lowpass = こもらせる周波数
  noise: function (dur, vol, delay, lowpass) {
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
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master);
    src.start(t0);
  },

  // 音の高さを順番に鳴らす（メロディ）
  seq: function (freqs, step, type, vol) {
    for (var i = 0; i < freqs.length; i++) this.tone(freqs[i], step * 1.4, type, vol, null, i * step);
  },

  // 効果音の名前で鳴らす
  play: function (name) {
    if (!this.enabled || !this.ctx) return;
    try {
      var r = this.recipes[name];
      if (r) r.call(this);
    } catch (e) {
      // 音が鳴らせなくてもゲームは止めない
    }
  },

  recipes: {
    hit: function () { this.tone(260, 0.08, "square", 0.35, 120); this.noise(0.05, 0.25, 0, 2500); }, // こちらの攻撃が当たった
    hurt: function () { this.tone(160, 0.16, "sawtooth", 0.35, 70); this.noise(0.08, 0.3, 0, 1200); }, // 攻撃を受けた
    miss: function () { this.tone(700, 0.06, "sine", 0.15, 520); },
    kill: function () { this.tone(440, 0.1, "triangle", 0.35, 880); this.tone(660, 0.12, "triangle", 0.3, null, 0.09); },
    levelup: function () { this.seq([523, 659, 784, 1047], 0.08, "square", 0.25); },
    pickup: function () { this.seq([880, 1175], 0.05, "sine", 0.3); },
    use: function () { this.tone(520, 0.18, "triangle", 0.3, 1040); },
    fidget: function () {
      this.noise(0.03, 0.35, 0, 5000);
      this.noise(0.03, 0.35, 0.12, 5000);
      this.noise(0.03, 0.35, 0.24, 5000);
      this.tone(1800, 0.03, "square", 0.08, null, 0.24);
    },
    throw: function () { this.noise(0.12, 0.2, 0, 1800); this.tone(500, 0.12, "sine", 0.1, 300); },
    stairs: function () { this.seq([784, 659, 523, 392], 0.07, "triangle", 0.3); },
    warn: function () { this.tone(880, 0.07, "square", 0.15); this.tone(660, 0.07, "square", 0.15, null, 0.1); },
    special: function () { this.noise(0.35, 0.45, 0, 900); this.tone(120, 0.35, "sawtooth", 0.35, 50); },
    breath: function () { this.noise(0.45, 0.4, 0, 700); this.tone(200, 0.4, "sawtooth", 0.2, 90); },
    evolve: function () { this.seq([392, 523, 659, 784, 1047, 1319], 0.07, "sine", 0.3); },
    recruit: function () { this.seq([523, 784, 1047], 0.09, "triangle", 0.3); },
    rescue: function () { this.seq([659, 880, 1175, 1568], 0.08, "sine", 0.3); },
    escape: function () { this.seq([392, 523, 659, 784, 1047], 0.1, "triangle", 0.3); },
    death: function () { this.tone(330, 0.9, "sawtooth", 0.35, 55); this.noise(0.5, 0.2, 0.1, 600); },
    cursor: function () { this.tone(1200, 0.025, "sine", 0.08); },
  },
};
