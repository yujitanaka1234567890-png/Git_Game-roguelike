// アイテムの種類データ・床に落ちているアイテム・使った時の効果。
// 種類を増やす時は types に1行足し、新しい効果なら effects に処理を書く。
//
// アイテムは1個ずつ「アイテムデータ」{ type, uses, origin } として持ち歩く：
//   type   … 種類ID（types のキー）
//   uses   … 使った回数（リボルバートイのように、使ってもなくならず少しずつ効き目が落ちる物で使う）
//   origin … 拾った世界のID（js/data/worlds.js）。別の世界で使うと次元変換の読み替えが入る（dimension.js）
// 持ち物・床・倉庫のどこにあっても、この形のまま受け渡す。
Game.items = {
  // 名前はすべてこのゲームで使う一般的な名前（既存作品のアイテム名・商標は使わない）
  // category：plant（植物）/ talisman（符）/ fruit（木の実）/ tool（道具）/ incense（香）/ smoke（煙草）/ puzzle（パズル）/ fidget（手遊び道具）
  // group：持ち物の並び順の分類（groupOrder の順に自動で並ぶ）
  // sprite：ドット絵（data/sprites.js の絵の名前）  weight：出やすさ（大きいほど出やすい）
  // effect = 使った時の効果（effects） / throwEffect = 投げて誰かに当たった時の効果（throwEffects）
  types: {
    healMoss: {
      name: "いやし苔", group: "hp", sprite: "leaf", category: "plant", symbol: "♣", color: "#66cc66", weight: 10,
      effect: "heal", throwEffect: "heal", power: 15, maxUp: 1,
      desc: "HPを15回復する。HPが満タンなら最大HPが1上がる。投げて当てると相手が回復する。",
    },
    sunNectar: {
      name: "ひだまり蜜", group: "hp", sprite: "jar", category: "plant", symbol: "♣", color: "#ffcc44", weight: 4,
      effect: "heal", throwEffect: "heal", power: 50, maxUp: 2,
      desc: "HPを大きく回復する。HPが満タンなら最大HPが2上がる。投げて当てると相手が回復する。",
    },
    flashTalisman: {
      name: "閃光の符", group: "attack", sprite: "talisman", category: "talisman", symbol: "≡", color: "#eeee66", weight: 5,
      effect: "flash", throwEffect: "bonk", power: 12,
      desc: "見えている敵すべてに12ダメージの閃光を放つ。投げて当てると小さなダメージ。",
    },
    mightFruit: {
      name: "剛力の実", group: "buff", sprite: "fruit", category: "fruit", symbol: "●", color: "#ff99aa", weight: 3,
      effect: "atkUp", throwEffect: "atkUp", power: 1,
      desc: "攻撃力が永久に1上がる。投げて当てると相手の攻撃力が上がる。",
    },
    // ---- 精神力を回復する物 ----
    calmIncense: {
      name: "澄心の香", group: "mind", sprite: "incense", category: "incense", symbol: "∽", color: "#cc99ff", weight: 4,
      effect: "mindUp", throwEffect: "bonk", power: 50,
      desc: "焚くと心が澄み、精神力が50回復する。",
    },
    tobacco: {
      name: "煙草", group: "mind", sprite: "cigarette", category: "smoke", symbol: "∫", color: "#ddccaa", weight: 5,
      effect: "mindUp", throwEffect: "bonk", power: 7,
      desc: "一服すると気持ちが落ち着き、精神力が7回復する。"
    },
    sixFacePuzzle: {
      name: "六面パズル", group: "mind", sprite: "cube", category: "puzzle", symbol: "▦", color: "#ff7755", weight: 5,
      effect: "mindUp", throwEffect: "bonk", power: 10,
      desc: "六つの面の色をそろえる立体パズル。そろえると達成感で精神力が10回復する（使うとなくなる）。"
    },
    revolverToy: {
      name: "リボルバートイ", group: "mind", sprite: "revolver", category: "fidget", symbol: "⊙", color: "#bbbbcc", weight: 4,
      effect: "fidget", throwEffect: "bonk", power: 0,
      desc: "弾倉を回して遊ぶ手遊び道具。使ってもなくならないが、回すほど効き目が落ち、4回目で壊れる。",
      // 1回目〜4回目の回復量とログ（4回目で壊れる）
      fidget: [
        { power: 20, text: "リボルバーを回転させた。ジーッカキンッカキンッとなる音が心地良い" },
        { power: 14, text: "リボルバーを回転させた。カキンッカキンッという音を聞くと童心に帰る" },
        { power: 8, text: "リボルバーを回転させた。小気味良い回転音が暗いダンジョンに虚しく響く" },
        { power: 4, text: "リボルバーを回転させた。多少は気分転換になったが壊れた" },
      ],
    },
    // ---- 道具 ----
    returnBell: {
      name: "帰還の鈴", group: "tool", sprite: "bell", category: "tool", symbol: "♪", color: "#88ddff", weight: 3,
      effect: "escape", throwEffect: "bonk", power: 0,
      desc: "鳴らすと、その場からダンジョンを脱出して拠点に帰れる。連れている仲間も一緒に帰る。",
    },
  },

  // 持ち物の並び順（効果の分類ごと）と、その見出し
  groupOrder: ["hp", "mind", "buff", "attack", "tool"],
  groupLabels: { hp: "体力回復", mind: "精神回復", buff: "強化", attack: "攻撃", tool: "道具" },

  // 使う時の動詞（カテゴリごと）
  verbs: {
    plant: "口にした", talisman: "かざした", fruit: "食べた", tool: "鳴らした",
    incense: "焚いた", smoke: "一服した", puzzle: "そろえた",
  },

  floorItems: [], // 床のアイテム [{x, y, type, uses, origin, seen}]  seen = 一度見たか（見た物は地図に残る）

  // アイテムデータを作る。typeOrEntry が種類IDなら新品、アイテムデータならその写し
  makeEntry: function (typeOrEntry, origin) {
    if (typeof typeOrEntry === "string") return { type: typeOrEntry, uses: 0, origin: origin || null };
    return { type: typeOrEntry.type, uses: typeOrEntry.uses || 0, origin: typeOrEntry.origin || null };
  },

  // 表示用の名前（リボルバートイなら残り回数つき）
  displayName: function (entry) {
    var t = this.types[entry.type];
    if (t.fidget) return t.name + "（残り" + (t.fidget.length - (entry.uses || 0)) + "回）";
    return t.name;
  },

  init: function (spawns) {
    this.floorItems = [];
    var world = Game.currentDungeon().world;
    for (var i = 0; i < spawns.length; i++) {
      this.place(spawns[i].x, spawns[i].y, this.makeEntry(this.pickType(), world));
    }
  },

  // weight に比例した確率で種類を選ぶ
  pickType: function () {
    var total = 0, id;
    for (id in this.types) total += this.types[id].weight;
    var r = Math.random() * total;
    for (id in this.types) {
      r -= this.types[id].weight;
      if (r < 0) return id;
    }
    return id;
  },

  // 床に置く（entry = アイテムデータ または 種類ID）
  place: function (x, y, entry) {
    var e = this.makeEntry(entry);
    this.floorItems.push({ x: x, y: y, type: e.type, uses: e.uses, origin: e.origin, seen: false });
  },

  at: function (x, y) {
    for (var i = 0; i < this.floorItems.length; i++) {
      if (this.floorItems[i].x === x && this.floorItems[i].y === y) return this.floorItems[i];
    }
    return null;
  },

  remove: function (fi) {
    var i = this.floorItems.indexOf(fi);
    if (i >= 0) this.floorItems.splice(i, 1);
  },

  // 今見えている床アイテムに「見た」印をつける（refresh のたびに呼ぶ）
  markSeen: function () {
    for (var i = 0; i < this.floorItems.length; i++) {
      var fi = this.floorItems[i];
      if (Game.fov.isVisible(fi.x, fi.y)) fi.seen = true;
    }
  },

  // 足元のアイテムを拾う（持ち物がいっぱいなら拾えない）
  pickupAt: function (x, y) {
    var fi = this.at(x, y);
    if (!fi) return;
    var name = this.displayName(fi);
    if (Game.inventory.add(fi)) {
      this.remove(fi);
      Game.log.add(name + "を拾った。");
      Game.sound.play("pickup");
    } else {
      Game.log.add("持ち物がいっぱいで" + name + "を拾えない。", "miss");
    }
  },

  // アイテムを使う。使ってなくなるなら true（持ち物から取り除くのは呼び出し側）
  use: function (entry) {
    var t = this.types[entry.type];
    var mul = Game.dimension.powerMul(entry); // 別の世界の品なら効き目の読み替え（dimension.js）
    if (t.effect === "fidget") {
      Game.sound.play("fidget");
      return this.useFidget(entry, t, mul);
    }
    // 回復・最大値アップは効果の中で音を鳴らす。それ以外は共通の「使った」音
    if (t.effect !== "heal" && t.effect !== "mindUp") Game.sound.play("use");
    Game.log.add(t.name + "を" + this.verbs[t.category] + "。");
    this.effects[t.effect](t, Math.round(t.power * mul));
    return true;
  },

  // リボルバートイ：使うたびに回数が増えて効き目が落ち、最後の回で壊れる（壊れたら true）
  useFidget: function (entry, t, mul) {
    var step = t.fidget[Math.min(entry.uses || 0, t.fidget.length - 1)];
    Game.log.add(step.text, "info");
    Game.mind.restore(Math.round(step.power * mul), true);
    entry.uses = (entry.uses || 0) + 1;
    return entry.uses >= t.fidget.length;
  },

  // 使った時の効果。power = 次元変換を反映した強さ
  effects: {
    heal: function (t, power) {
      var p = Game.player;
      if (p.hp >= p.maxHp) {
        p.maxHp += t.maxUp;
        p.hp = p.maxHp;
        Game.sound.play("maxup");
        Game.log.add("最大HPが " + t.maxUp + " 上がった！", "good");
      } else {
        Game.sound.play("heal");
        var before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + power);
        Game.log.add("HPが " + (p.hp - before) + " 回復した。", "good");
      }
    },

    flash: function (t, power) {
      var targets = Game.enemies.list.filter(function (e) {
        return Game.fov.isVisible(e.x, e.y);
      });
      if (targets.length === 0) {
        Game.log.add("しかし何も起こらなかった。", "miss");
        return;
      }
      for (var i = 0; i < targets.length; i++) {
        var e = targets[i];
        Game.combat.applyDamage(Game.player, e, power);
        Game.log.add("閃光が走った！ " + e.name + "に " + power + " のダメージ", "good");
        if (e.hp <= 0) Game.enemies.kill(e);
      }
    },

    atkUp: function (t, power) {
      Game.sound.play("maxup");
      Game.player.atk += power;
      Game.log.add("攻撃力が " + power + " 上がった！", "good");
    },

    mindUp: function (t, power) {
      Game.sound.play("heal");
      Game.mind.restore(power, true);
    },

    escape: function (t) {
      Game.escapeDungeon(t.name + "の音に包まれて、拠点へ帰ってきた。");
    },
  },

  // 投げて target（敵または仲間）に当たった時
  throwHit: function (entry, target) {
    var t = this.types[entry.type];
    Game.log.add(t.name + "が" + target.name + "に当たった！");
    this.throwEffects[t.throwEffect](t, target);
  },

  throwEffects: {
    // 当たった相手のHPを回復（敵に当てると敵が回復する）
    heal: function (t, target) {
      Game.sound.play("heal");
      var before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + t.power);
      Game.log.add(target.name + "のHPが " + (target.hp - before) + " 回復した。", "good");
    },

    atkUp: function (t, target) {
      target.atk += t.power;
      Game.log.add(target.name + "の攻撃力が " + t.power + " 上がった。", "good");
    },

    // 当たるとちょっと痛い（仲間に当てても痛い）
    bonk: function (t, target) {
      var dmg = Game.config.throwBonkDamage;
      Game.combat.applyDamage(Game.player, target, dmg);
      Game.log.add(target.name + "に " + dmg + " のダメージ");
      if (target.hp > 0) return;
      if (Game.allies.list.indexOf(target) >= 0) Game.allies.die(target);
      else Game.enemies.kill(target);
    },
  },

  // (x, y) の近くの「アイテムを置ける床」を探す（階段・他のアイテムの上は不可）。なければ null
  dropSpotNear: function (x, y) {
    var visited = {};
    var queue = [{ x: x, y: y, d: 0 }];
    visited[x + "," + y] = true;
    while (queue.length > 0) {
      var cur = queue.shift();
      if (!this.at(cur.x, cur.y) && Game.map.tileAt(cur.x, cur.y) === ".") return cur;
      if (cur.d >= 2) continue; // 2マス以内で探す
      for (var i = 0; i < Game.DIRS8.length; i++) {
        var dir = Game.DIRS8[i];
        if (!Game.map.canStep(cur.x, cur.y, dir[0], dir[1])) continue;
        var nx = cur.x + dir[0], ny = cur.y + dir[1];
        if (visited[nx + "," + ny]) continue;
        visited[nx + "," + ny] = true;
        queue.push({ x: nx, y: ny, d: cur.d + 1 });
      }
    }
    return null;
  },
};
