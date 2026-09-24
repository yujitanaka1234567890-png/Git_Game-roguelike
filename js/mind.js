// 精神力：ダンジョンに侵食される度合い。
//   ・ダンジョンにいる間は drainEvery ターンごとに1ずつ、少しずつ減っていく
//   ・同じフロアに graceTurns ターンを超えて居続けると、ダンジョンの気配に強く心をむしばまれ、
//     lingerDrainEvery ターンごとに1ずつ減るようになる
//   ・0になると、ダンジョンに取り込まれて魔物になってしまう（＝倒れたのと同じ扱い）
//   ・階段を降りると、新しい空気で少し持ち直す（descendRecover）。香・煙草・六面パズル・リボルバートイでも回復する
//   ・拠点に戻る（冒険を始める）と満タン
Game.mind = {
  floorTurns: 0, // 今の階に来てからのターン数
  warned: {}, // 一度出した警告（同じ警告をくり返さない）

  // 冒険の開始時
  reset: function () {
    var p = Game.player;
    p.maxMind = Game.config.mind.max;
    p.mind = p.maxMind;
    this.floorTurns = 0;
    this.warned = {};
  },

  // 新しい階に着いた時。recover = true なら少し回復（階段を降りた時）
  onNewFloor: function (recover) {
    this.floorTurns = 0;
    this.warned = {};
    if (recover) this.restore(Game.config.mind.descendRecover, false);
  },

  restore: function (amount, withLog) {
    var p = Game.player;
    var before = p.mind;
    p.mind = Math.min(p.maxMind, p.mind + amount);
    if (withLog) Game.log.add("精神力が " + (p.mind - before) + " 回復した。心が澄みわたる。", "good");
  },

  // 1ターンごとに呼ぶ
  tick: function () {
    var cfg = Game.config.mind;
    var p = Game.player;
    this.floorTurns++;
    if (this.floorTurns === cfg.graceTurns) {
      Game.log.add("…空気が重い。この階の闇が、じわじわと心にしみこんでくる。（長居しすぎている）", "warn");
    }
    var every = this.floorTurns > cfg.graceTurns ? cfg.lingerDrainEvery : cfg.drainEvery;
    if (this.floorTurns % every === 0) p.mind = Math.max(0, p.mind - 1);
    var ratio = p.mind / p.maxMind;
    this.warnOnce(0.5, ratio, "頭の奥で、知らない声がささやいている…（精神力が半分を切った）");
    this.warnOnce(0.25, ratio, "自分の手が、一瞬ダンジョンの壁と同じ色に見えた…（精神力が残りわずか）");
    this.warnOnce(0.1, ratio, "体が闇に溶けはじめている！ 早く階段へ！（精神力が危険）");
  },

  warnOnce: function (threshold, ratio, text) {
    if (ratio > threshold || this.warned[threshold]) return;
    this.warned[threshold] = true;
    Game.log.add("⚠ " + text, "warn");
  },

  isGone: function () {
    return Game.player.mind <= 0;
  },
};
