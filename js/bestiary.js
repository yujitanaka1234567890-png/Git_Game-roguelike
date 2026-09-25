// プレイヤー用のモンスター図鑑（拠点の「図」）。管理者用の admin/bestiary.html とは別物。
// 載るのは「出会ったことのある」モンスターだけ：
//   ・敵として姿を見た（視界に入った）  ・仲間にした・仲間が進化した  ・牧場にいる  ・交配で生まれた
// まだ出会っていないモンスターは「？？？」で、どんな姿かもわからない。
// 出会った記録は base.seen に保存される（ブラウザの自動記録・記録の呪文の両方に入る）。
Game.bestiary = {
  // 出会ったことがあるか
  known: function (id) {
    var base = Game.base;
    if (base.seen[id] || base.discovered[id]) return true;
    return base.ranch.some(function (r) { return r.type === id; });
  },

  // 画面を描き直すたびに呼ぶ：見えている敵・連れている仲間を「出会った」ことにする
  observe: function () {
    if (Game.state === "base") return;
    var seen = Game.base.seen;
    var es = Game.enemies.list;
    for (var i = 0; i < es.length; i++) if (Game.fov.isVisible(es[i].x, es[i].y)) seen[es[i].type] = true;
    var al = Game.allies.list;
    for (var j = 0; j < al.length; j++) seen[al[j].type] = true;
  },

  ids: function () {
    return Object.keys(Game.MONSTERS);
  },

  no: function (index) {
    return "No." + (index + 1 < 10 ? "0" : "") + (index + 1);
  },

  // 一覧
  open: function (cursor) {
    var self = this;
    var ids = this.ids();
    var count = ids.filter(function (id) { return self.known(id); }).length;
    var options = ids.map(function (id, idx) {
      var t = Game.MONSTERS[id];
      if (!self.known(id)) {
        return {
          label: self.no(idx) + "　？？？",
          keepOpen: true,
          onChoose: function () { Game.log.add("まだ出会っていないモンスターだ。", "miss"); },
        };
      }
      return {
        label: self.no(idx) + "　" + t.symbol + " " + t.name + "（" + Game.enemies.rarityOf(id).label + "）",
        onChoose: function () { self.openDetail(id, idx); },
      };
    });
    options.push({ label: "閉じる" });
    Game.dialog.open(
      {
        title: "モンスター図鑑（出会った数 " + count + " / " + ids.length + "）",
        lines: ["敵として見かけた・仲間にした・交配で生まれたモンスターがくわしく載る。"],
        options: options,
      },
      cursor
    );
  },

  // くわしい情報
  openDetail: function (id, cursor) {
    var self = this;
    var t = Game.MONSTERS[id];
    var s = Game.enemies.statsOf(id);
    var r = Game.enemies.rarityOf(id);
    var lines = [
      "HP " + s.hp + "　攻撃力 " + s.atk + "　防御力 " + s.def + "（Lv1の時）　倒した時の経験値 " + s.exp,
      "レア度：" + r.label + (t.boss ? "（ボスは仲間にならない）" : "（倒した時に仲間になる確率 " + Math.round(r.recruit * 100) + "%）"),
    ];
    var skills = Game.specials.skillsOf({ type: id });
    if (skills.length === 0) lines.push("技：なし");
    skills.forEach(function (sk) {
      lines.push("技「" + sk.def.name + "」：" + Game.specials.shapeText(sk.def) + "に 攻撃力×" + sk.def.mult +
        (sk.def.hits ? "（" + sk.def.hits + "連撃）" : "") + "。予兆「" + sk.def.windup + "」");
    });
    var feats = [];
    if (t.phasing) feats.push("壁をすり抜ける");
    if (t.breath) feats.push("離れた相手にブレス（" + t.breath.range + "マス先まで・" + t.breath.cooldown + "ターンに1度）");
    if (t.humanoid) feats.push("人型（救出隊・分隊の隊長になれる）");
    if (t.element === "water") feats.push("水属性（水たまりの上で攻撃力" + Game.water.powerMul + "倍・毎ターン" + Game.water.heal + "回復）");
    if (t.boss) feats.push("ダンジョン最下層の主");
    if (feats.length > 0) lines.push("特徴：" + feats.join("・"));
    if (t.evolvesTo) {
      lines.push("進化：仲間が Lv" + t.evolveLevel + " になると「" + (this.known(t.evolvesTo) ? Game.MONSTERS[t.evolvesTo].name : "？？？") + "」に進化する");
    }
    lines.push("見つかる場所：" + this.whereText(id));
    Game.dialog.open({
      title: this.no(cursor) + "　" + t.name,
      image: Game.pixel.build(t.sprite, t.overlay, t.color, true),
      lines: lines,
      options: [
        { label: "一覧に戻る", onChoose: function () { self.open(cursor); } },
        { label: "閉じる" },
      ],
      onCancel: function () { self.open(cursor); },
    });
  },

  // 出現するダンジョンと階・交配の組み合わせ・ボス（わかる範囲で）
  whereText: function (id) {
    var self = this;
    var places = [];
    Object.keys(Game.DUNGEONS).forEach(function (did) {
      var d = Game.DUNGEONS[did];
      d.spawns.forEach(function (sp) {
        if (sp.type === id) places.push(d.name + " B" + sp.from + "F〜" + (sp.to ? "B" + sp.to + "F" : "最下層"));
      });
      if (d.boss === id) places.push(d.name + " 最下層（ボス）");
    });
    Game.BREEDING.forEach(function (b) {
      if (b.child !== id) return;
      var names = b.parents.map(function (p) { return self.known(p) ? Game.MONSTERS[p].name : "？？？"; });
      places.push("交配（" + names.join(" × ") + "）");
    });
    Object.keys(Game.MONSTERS).forEach(function (pid) {
      if (Game.MONSTERS[pid].evolvesTo === id) places.push((self.known(pid) ? Game.MONSTERS[pid].name : "？？？") + "の進化");
    });
    return places.length > 0 ? places.join("／") : "不明";
  },
};
