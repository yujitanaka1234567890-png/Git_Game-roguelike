// BGM。録音データは使わず、ブラウザの音声合成（Web Audio API）で、このゲームのために作った曲をその場で演奏する。
// 今あるのは「ボス戦」の曲だけ：ボスがいる階にいる間ループ再生し、ボスを倒す・階を出る・倒れると止まる。
// M キー（効果音オフ）の時は鳴らさない。
//
// 曲の作り：テンポ160・イ短調・4小節でループ（1マス＝16分音符）
//   コード進行 Am → F → G → E、ドラム（バスドラ・スネア・ハイハット）、ベース（8分音符）、
//   歪ませたのこぎり波のリード（アルペジオで駆け上がる旋律）
Game.music = {
  current: null, // 鳴っている曲の名前（今は "boss" だけ）
  timer: null,
  gain: null,
  nextTime: 0,
  step: 0,
  volume: 0.55, // BGM の音量（効果音全体の音量に対する割合）

  tempo: 160,
  // 1小節＝16マス。数字は周波数（Hz）、0 は休み
  bass: [
    110, 0, 110, 0, 220, 0, 110, 0, 110, 0, 110, 0, 220, 0, 110, 0, // Am
    87.3, 0, 87.3, 0, 174.6, 0, 87.3, 0, 87.3, 0, 87.3, 0, 174.6, 0, 87.3, 0, // F
    98, 0, 98, 0, 196, 0, 98, 0, 98, 0, 98, 0, 196, 0, 98, 0, // G
    82.4, 0, 82.4, 0, 164.8, 0, 82.4, 0, 82.4, 0, 82.4, 0, 164.8, 0, 123.5, 0, // E
  ],
  lead: [
    440, 0, 523, 0, 659, 0, 880, 0, 784, 0, 659, 0, 523, 0, 659, 0, // Am：ラ ド ミ ラ ソ ミ ド ミ
    698, 0, 659, 0, 523, 0, 440, 0, 523, 0, 698, 0, 659, 0, 523, 0, // F ：ファ ミ ド ラ ド ファ ミ ド
    587, 0, 784, 0, 988, 0, 1175, 0, 1047, 0, 988, 0, 784, 0, 587, 0, // G ：レ ソ シ レ ド シ ソ レ
    659, 0, 831, 0, 988, 0, 1319, 0, 1175, 988, 831, 659, 988, 0, 831, 0, // E ：ミ ソ# シ ミ（駆け降り）
  ],
  // ドラム：k=バスドラ s=スネア h=ハイハット
  drums: "k.h.s.h.k.h.s.hhk.h.s.h.k.hks.hh",

  // 今の状況に合わせて、鳴らす・止める（画面を描き直すたびに呼ぶ）
  update: function () {
    var want = null;
    var inDungeon = Game.state === "playing" || Game.state === "menu" || Game.state === "aim" || Game.state === "animating";
    if (inDungeon && Game.enemies.boss && Game.enemies.boss()) want = "boss";
    if (!Game.sound.enabled || !Game.sound.ctx) want = null;
    if (want === this.current) return;
    this.stop();
    if (want) this.start(want);
  },

  start: function (name) {
    var ctx = Game.sound.ctx;
    this.current = name;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.gain.gain.exponentialRampToValueAtTime(this.volume, ctx.currentTime + 0.4); // ふわっと始める
    this.gain.connect(Game.sound.master);
    this.nextTime = ctx.currentTime + 0.05;
    this.step = 0;
    var self = this;
    this.timer = setInterval(function () { self.schedule(); }, 25);
    this.schedule();
  },

  stop: function () {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.gain) {
      var ctx = Game.sound.ctx;
      var g = this.gain;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3); // すっと消す
      setTimeout(function () { g.disconnect(); }, 400);
    }
    this.gain = null;
    this.current = null;
  },

  // 少し先（0.15秒分）までの音を予約する
  schedule: function () {
    var ctx = Game.sound.ctx;
    var dt = 60 / this.tempo / 4; // 16分音符の長さ
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, dt);
      this.nextTime += dt;
      this.step = (this.step + 1) % this.bass.length;
    }
  },

  playStep: function (i, t, dt) {
    var d = this.drums[i % this.drums.length];
    if (d === "k") this.kick(t);
    if (d === "s") this.snare(t);
    if (d === "h" || d === "s" || d === "k") this.hat(t, d === "h" ? 0.05 : 0.03);
    if (this.bass[i]) this.note(this.bass[i], t, dt * 1.8, "sawtooth", 0.16, 600);
    if (this.lead[i]) this.note(this.lead[i], t, dt * (this.lead[i + 1] ? 0.95 : 1.8), "square", 0.07, 3200);
  },

  // 1音（lowpass でこもらせて、耳に痛くない音に）
  note: function (freq, t, dur, type, vol, cutoff) {
    var ctx = Game.sound.ctx;
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    var f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f);
    f.connect(g);
    g.connect(this.gain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  kick: function (t) {
    var ctx = Game.sound.ctx;
    var osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(g);
    g.connect(this.gain);
    osc.start(t);
    osc.stop(t + 0.16);
  },

  snare: function (t) {
    this.noiseHit(t, 0.12, 0.28, 1800);
  },

  hat: function (t, vol) {
    this.noiseHit(t, 0.03, vol, 7000);
  },

  noiseHit: function (t, dur, vol, highpass) {
    var ctx = Game.sound.ctx;
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = highpass;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.gain);
    src.start(t);
  },
};
