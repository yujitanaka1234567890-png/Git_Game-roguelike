// 次元変換：別の世界で拾ったアイテムを使った時の効き目の読み替え。
// 読み替え表は js/data/worlds.js の DIMENSION_RULES（今は空。これから中身を決める）。
// 【原則】表に書かれた組み合わせ以外は、どの世界で使っても効果は同じ（倍率1）。
Game.dimension = {
  // 今いる世界のID（拠点では null）
  currentWorld: function () {
    return Game.state === "base" ? null : Game.currentDungeon().world;
  },

  // 世界IDの表示名（null は拠点で最初から持っていた物）
  worldName: function (id) {
    if (id && Game.WORLDS[id]) return Game.WORLDS[id].name;
    return "拠点（どの世界の物でもない）";
  },

  ruleFor: function (itemType, from, to) {
    for (var i = 0; i < Game.DIMENSION_RULES.length; i++) {
      var r = Game.DIMENSION_RULES[i];
      if (r.item === itemType && r.from === from && r.to === to) return r;
    }
    return null;
  },

  // entry（アイテムデータ）を今の世界で使う時の効き目の倍率。読み替えがあればログに出す
  powerMul: function (entry) {
    var to = this.currentWorld();
    if (!entry.origin || !to || entry.origin === to) return 1;
    var rule = this.ruleFor(entry.type, entry.origin, to);
    if (!rule) return 1;
    Game.log.add("【次元変換】" + (rule.note || "世界の違いで効き目が変わった。"), "warn");
    return rule.powerMul || 1;
  },
};
