// 精神力：ダンジョンに侵食される度合い。
//   ・ダンジョンにいる間は drainEvery ターンごとに1ずつ、少しずつ減っていく
//   ・同じフロアに「長居の猶予」ターンを超えて居続けると、ダンジョンの気配に強く心をむしばまれ、
//     lingerDrainEvery ターンごとに1ずつ減るようになる。
//     猶予は階の広さに比例する：graceTurns ×（その階の床のマス数 ÷ refFloorTiles）。広い階ほど長く居られる
//   ・半分を切るとオオカミの遠吠え、4分の1を切るとささやき声（ひそひそひそ）が聞こえる（その後もときどき）
//   ・0になるとカウントダウンが始まり、zeroCountdown ターンのうちに1以上に戻さないと、
//     ダンジョンに取り込まれて倒れる。1以上に回復すればカウントダウンは止まる
//   ・階段を降りると、新しい空気で少し持ち直す（descendRecover）。香・煙草・六面パズル・リボルバートイでも回復する
//   ・拠点に戻る（冒険を始める）と満タン
Game.mind = {
  floorTurns: 0, // 今の階に来てからのターン数
  grace: null, // この階の長居の猶予（ターン）。階に着いてから最初のターンに広さから決める
  zeroTurns: 0, // 精神力0が続いているターン数（1以上に回復すると0に戻る。カウントダウンに使う）
  warned: {}, // 一度出した警告（同じ警告をくり返さない）

  // 冒険の開始時
  reset: function () {
    var p = Game.player;
    p.maxMind = Game.config.mind.max;
    p.mind = p.maxMind;
    this.floorTurns = 0;
    this.zeroTurns = 0;
    this.warned = {};
  },

  // 取り込まれるまでの残りターン（精神力が0でなければ null）。0 になったら取り込まれる
  countdownLeft: function () {
    if (Game.player.mind > 0) return null;
    return Game.config.mind.zeroCountdown - (this.zeroTurns - 1);
  },

  // 新しい階に着いた時。recover = true なら少し回復（階段を降りた時）
  onNewFloor: function (recover) {
    this.floorTurns = 0;
    this.grace = null;
    this.warned = {};
    if (recover) this.restore(Game.config.mind.descendRecover, false);
  },

  restore: function (amount, withLog) {
    var p = Game.player;
    var before = p.mind;
    p.mind = Math.min(p.maxMind, p.mind + amount);
    if (withLog) Game.log.add("精神力が " + (p.mind - before) + " 回復した。", "good");
  },

  // この階の長居の猶予（ターン）：床のマスが多い（広い）ほど長い
  graceFor: function () {
    var cfg = Game.config.mind;
    var tiles = 0;
    for (var y = 0; y < Game.map.height; y++) {
      for (var x = 0; x < Game.map.width; x++) if (Game.map.tiles[y][x] !== "#") tiles++;
    }
    return Math.max(60, Math.round((cfg.graceTurns * tiles) / cfg.refFloorTiles));
  },

  // 1ターンごとに呼ぶ
  tick: function () {
    var cfg = Game.config.mind;
    var p = Game.player;
    if (this.grace === null) this.grace = this.graceFor();
    this.floorTurns++;
    if (this.floorTurns === this.grace) {
      Game.log.add("…空気が重い。この階の闇が、じわじわと心にしみこんでくる。（長居しすぎている）", "warn");
    }
    var every = this.floorTurns > this.grace ? cfg.lingerDrainEvery : cfg.drainEvery;
    if (this.floorTurns % every === 0) p.mind = Math.max(0, p.mind - 1);
    var ratio = p.mind / p.maxMind;
    this.zeroTurns = p.mind <= 0 ? this.zeroTurns + 1 : 0; // 1以上に戻ればカウントダウンは止まる
    if (this.warnOnce(0.5, ratio, "遠くで、オオカミの遠吠えが聞こえた…（精神力が半分を切った）")) {
      Game.sound.play("howl");
    } else if (ratio < 0.5 && this.floorTurns % cfg.howlEvery === 0) {
      Game.sound.play("howl"); // 半分を切っている間は、ときどき遠吠えが聞こえる
    }
    if (this.warnOnce(0.25, ratio, "頭の奥で、知らない声がひそひそとささやいている…（精神力が残りわずか）")) {
      Game.sound.play("whisper");
    } else if (ratio < 0.25 && this.floorTurns % cfg.whisperEvery === 0) {
      Game.sound.play("whisper"); // 4分の1を切っている間は、ときどきささやきが聞こえる
    }
    this.warnOnce(0.1, ratio, "体が闇に溶けはじめている！ 早く階段へ！（精神力が危険）");
    this.warnOnce(0, ratio, "精神力が尽きた！ " + cfg.zeroCountdown + " ターンのうちに精神力を戻さないと、ダンジョンに取り込まれる。階段か精神回復の道具を！");
  },

  // 警告を1度だけ出す。出したら true
  warnOnce: function (threshold, ratio, text) {
    if (ratio > threshold || this.warned[threshold]) return false;
    this.warned[threshold] = true;
    Game.log.add("⚠ " + text, "warn");
    return true;
  },

  isGone: function () {
    return Game.player.mind <= 0;
  },

  // カウントダウンが尽きて、ダンジョンに取り込まれたか
  isTaken: function () {
    var left = this.countdownLeft();
    return left !== null && left <= 0;
  },
};
