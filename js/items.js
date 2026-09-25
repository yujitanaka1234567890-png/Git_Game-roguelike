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
  //           weapon（近接武器）/ armor（防具）/ gun（銃）/ staff（杖）/ ofuda（お札）
  // 近接武器：weapon = { atk: 攻撃力の上乗せ, hit: 命中率の増減, pierce: 防御力を無視, stun: ひるませる確率 }（equip.js）
  // 防具：armor = { def: 防御力の上乗せ }（equip.js）
  // 銃：effect "gun"（使うと装備、V で撃つ）。杖：effect "aim"（方向を選んで使う）。charges＝使える回数、shot＝当たった時の効果（shoot.js）、range＝届くマス数
  // group：持ち物の並び順の分類（groupOrder の順に自動で並ぶ）
  // sprite：ドット絵（data/item_sprites.js の絵の名前）
  // rarity：レア度 1〜5（強い・便利な物ほど高い）。出やすさは config.itemRarities の spawn（レアなほど出にくい）
  // effect = 使った時の効果（effects） / throwEffect = 投げて誰かに当たった時の効果（throwEffects）
  types: {
    healMoss: {
      name: "いやし苔", group: "hp", sprite: "leaf", category: "plant", symbol: "♣", color: "#6f9a5c", rarity: 1,
      effect: "heal", throwEffect: "heal", power: 15, maxUp: 1,
      desc: "HPを15回復する。HPが満タンなら最大HPが1上がる。投げて当てると相手が回復する。",
    },
    sunNectar: {
      name: "ひだまり蜜", group: "hp", sprite: "jar", category: "plant", symbol: "♣", color: "#c49a48", rarity: 2,
      effect: "heal", throwEffect: "heal", power: 50, maxUp: 2,
      desc: "HPを大きく回復する。HPが満タンなら最大HPが2上がる。投げて当てると相手が回復する。",
    },
    flashTalisman: {
      name: "閃光の符", group: "attack", sprite: "talisman", category: "talisman", symbol: "≡", color: "#d6c98e", rarity: 2,
      effect: "flash", throwEffect: "bonk", power: 12,
      desc: "見えている敵すべてに12ダメージの閃光を放つ。投げて当てると小さなダメージ。",
    },
    mightFruit: {
      name: "剛力の実", group: "buff", sprite: "fruit", category: "fruit", symbol: "●", color: "#a8555a", rarity: 4,
      effect: "atkUp", throwEffect: "atkUp", power: 1,
      desc: "攻撃力が永久に1上がる。投げて当てると相手の攻撃力が上がる。",
    },
    // ---- 精神力を回復する物 ----
    calmIncense: {
      name: "澄心の香", group: "mind", sprite: "incense", category: "incense", symbol: "∽", color: "#8a7aa4", rarity: 3,
      effect: "mindUp", throwEffect: "bonk", power: 50,
      desc: "焚くと心が澄み、精神力が50回復する。",
    },
    tobacco: {
      name: "煙草", group: "mind", sprite: "tobaccoBox", category: "smoke", symbol: "∫", color: "#7e4a3c", rarity: 1,
      effect: "mindUp", throwEffect: "bonk", power: 7,
      desc: "一服すると気持ちが落ち着き、精神力が7回復する。"
    },
    sixFacePuzzle: {
      name: "六面パズル", group: "mind", sprite: "cube", category: "puzzle", symbol: "▦", color: "#8a8f98", rarity: 2,
      effect: "mindUp", throwEffect: "bonk", power: 10, sound: "puzzle",
      desc: "六つの面の色をそろえる立体パズル。そろえると達成感で精神力が10回復する（使うとなくなる）。"
    },
    revolverToy: {
      name: "リボルバートイ", group: "mind", sprite: "revolver", category: "fidget", symbol: "⊙", color: "#7d848c", rarity: 3,
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
    // ---- 近接武器（装備すると主人公の攻撃力が上がる） ----
    knife: {
      name: "ナイフ", group: "weapon", sprite: "knife", category: "weapon", symbol: "ナ", color: "#9aa2aa", rarity: 2,
      effect: "equip", throwEffect: "bonk", power: 0, weapon: { atk: 2, hit: 0.08, note: "軽くて当てやすい" },
      desc: "装備すると攻撃力+2。軽くて扱いやすく、攻撃が少し当たりやすくなる。",
    },
    katana: {
      name: "刀", group: "weapon", sprite: "katana", category: "weapon", symbol: "刀", color: "#aab0b8", rarity: 3,
      effect: "equip", throwEffect: "bonk", power: 0, weapon: { atk: 4 },
      desc: "装備すると攻撃力+4。よく切れる片刃の刀。",
    },
    hammer: {
      name: "ハンマー", group: "weapon", sprite: "hammer", category: "weapon", symbol: "槌", color: "#7a7068", rarity: 3,
      effect: "equip", throwEffect: "bonk", power: 0, weapon: { atk: 6, hit: -0.15, note: "重くて外しやすい" },
      desc: "装備すると攻撃力+6。とても重く、攻撃が少し外れやすくなる。",
    },
    drill: {
      name: "ドリル", group: "weapon", sprite: "drill", category: "weapon", symbol: "螺", color: "#a88a48", rarity: 4,
      effect: "equip", throwEffect: "bonk", power: 0, weapon: { atk: 3, pierce: true, note: "硬い相手にも効く" },
      desc: "装備すると攻撃力+3。回転する刃で相手の防御力を無視する。ただしダメージは「ドリルの3＋主人公の攻撃力の半分」になる。",
    },
    glove: {
      name: "グローブ", group: "weapon", sprite: "glove", category: "weapon", symbol: "拳", color: "#8e4a3c", rarity: 3,
      effect: "equip", throwEffect: "bonk", power: 0, weapon: { atk: 2, stun: 0.2, note: "当てると時々ひるませる" },
      desc: "装備すると攻撃力+2。攻撃が当たると、20%の確率で相手をよろめかせ1ターン動けなくする（ボスには効かない）。",
    },
    // ---- 防具（装備すると防御力が上がる。受けるダメージ＝相手の攻撃力−防御力） ----
    leatherVest: {
      name: "革の胸当て", group: "armor", sprite: "vest", category: "armor", symbol: "鎧", color: "#8a6440", rarity: 1,
      effect: "equip", throwEffect: "bonk", power: 0, armor: { def: 1 },
      desc: "装備すると防御力+1。なめした革の軽い胸当て。",
    },
    chainMail: {
      name: "鎖かたびら", group: "armor", sprite: "mail", category: "armor", symbol: "鎧", color: "#8a929c", rarity: 3,
      effect: "equip", throwEffect: "bonk", power: 0, armor: { def: 3 },
      desc: "装備すると防御力+3。細かい鉄の輪を編んだ服。",
    },
    steelArmor: {
      name: "鋼の鎧", group: "armor", sprite: "plate", category: "armor", symbol: "鎧", color: "#9aa4b0", rarity: 4,
      effect: "equip", throwEffect: "bonk", power: 0, armor: { def: 5 },
      desc: "装備すると防御力+5。重く頑丈な板金の鎧。強い敵の多いダンジョンでは頼りになる。",
    },
    // ---- 銃（遠くから撃てるが弱め。装備して V で撃つ） ----
    gun: {
      name: "銃", group: "attack", sprite: "gun", category: "gun", symbol: "銃", color: "#5e656e", rarity: 3,
      effect: "gun", throwEffect: "bonk", shot: "bullet", power: 4, charges: 6, range: 8,
      boltSymbol: "•", boltColor: "#ffe066", emptyText: "弾が残っていない。",
      desc: "使うと装備（近接武器とは別）。装備中は V キーで方向を選んで撃つ（8マスまで・6発）。ダメージは攻撃力に関係なく4（相手の防御力を引く）。",
    },
    // ---- 杖（方向を選んで振る。当たった相手に特殊な効果） ----
    dreamStaff: {
      name: "夢見の杖", group: "staff", sprite: "staff", category: "staff", symbol: "杖", color: "#9086b8", rarity: 3,
      effect: "aim", throwEffect: "bonk", shot: "sleep", power: 5, charges: 4, range: 10,
      boltSymbol: "✦", boltColor: "#b9a8ff", emptyText: "杖にもう力が残っていない。",
      desc: "振ると光の玉が飛び、当たった相手を5ターン眠らせる（攻撃を受けると起きる。ボスは2ターン）。4回使える。",
    },
    repelStaff: {
      name: "反発の杖", group: "staff", sprite: "staff", category: "staff", symbol: "杖", color: "#6a9cb4", rarity: 3,
      effect: "aim", throwEffect: "bonk", shot: "knock", power: 5, charges: 4, range: 10,
      boltSymbol: "✦", boltColor: "#88ddff", emptyText: "杖にもう力が残っていない。",
      desc: "当たった相手を向こうへ5マスはじき飛ばす。壁などにぶつかると3ダメージ。4回使える。",
    },
    banishStaff: {
      name: "放逐の杖", group: "staff", sprite: "staff", category: "staff", symbol: "杖", color: "#946eae", rarity: 4,
      effect: "aim", throwEffect: "bonk", shot: "banish", power: 0, charges: 3, range: 10,
      boltSymbol: "✦", boltColor: "#cc88ff", emptyText: "杖にもう力が残っていない。",
      desc: "当たった相手を、この階のどこか遠くへ飛ばす（ボスには効かない）。3回使える。",
    },
    // ---- お札（読み上げると特殊な効果） ----
    seerOfuda: {
      name: "千里眼の札", group: "ofuda", sprite: "ofuda", category: "ofuda", symbol: "札", color: "#4d7194", rarity: 2,
      effect: "reveal", throwEffect: "bonk", power: 0,
      desc: "読み上げると、この階の地形と落ちているアイテムがすべてわかる。",
    },
    guardOfuda: {
      name: "守護の札", group: "ofuda", sprite: "ofuda", category: "ofuda", symbol: "札", color: "#5d8a50", rarity: 3,
      effect: "guard", throwEffect: "bonk", power: 15,
      desc: "読み上げると、15ターンの間、受けるダメージが3/4になる。",
    },
    hushOfuda: {
      name: "静寂の札", group: "ofuda", sprite: "ofuda", category: "ofuda", symbol: "札", color: "#9e453b", rarity: 4,
      effect: "hush", throwEffect: "bonk", power: 20,
      desc: "読み上げると、見えている敵すべてが20ターンの間、技を使えなくなる（溜めている技も止まる。ボスには効かない）。",
    },
    // ---- 道具 ----
    returnBell: {
      name: "帰還の鈴", group: "tool", sprite: "bell", category: "tool", symbol: "♪", color: "#b09450", rarity: 4,
      effect: "escape", throwEffect: "bonk", power: 0,
      desc: "鳴らすと、その場からダンジョンを脱出して拠点に帰れる。連れている仲間も一緒に帰る。",
    },
  },

  // 持ち物の並び順（効果の分類ごと）と、その見出し
  groupOrder: ["hp", "mind", "buff", "weapon", "armor", "attack", "staff", "ofuda", "tool"],
  groupLabels: { hp: "体力回復", mind: "精神回復", buff: "強化", weapon: "武器（使うと装備）", armor: "防具（使うと装備）", attack: "攻撃（銃は使うと装備・V で撃つ）", staff: "杖", ofuda: "お札", tool: "道具" },

  // 使う時の動詞（カテゴリごと）
  verbs: {
    plant: "口にした", talisman: "かざした", fruit: "食べた", tool: "鳴らした",
    incense: "焚いた", smoke: "一服した", puzzle: "そろえた",
    gun: "撃った", staff: "振った", ofuda: "読み上げた",
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
    var mark = Game.equip && Game.equip.isEquipped(entry) ? "［装備中］" : "";
    if (t.charges) return t.name + "（残り" + Math.max(0, t.charges - (entry.uses || 0)) + "）" + mark;
    return t.name + mark;
  },

  init: function (spawns) {
    this.floorItems = [];
    var world = Game.currentDungeon().world;
    for (var i = 0; i < spawns.length; i++) {
      this.place(spawns[i].x, spawns[i].y, this.makeEntry(this.pickType(), world));
    }
  },

  // 出やすさ（レア度の spawn）
  weightOf: function (id) {
    return Game.config.itemRarities[this.types[id].rarity || 1].spawn;
  },

  rarityOf: function (id) {
    return Game.config.itemRarities[this.types[id].rarity || 1];
  },

  // 出やすさに比例した確率で種類を選ぶ（レアな物ほど出にくい）
  pickType: function () {
    var total = 0, id;
    for (id in this.types) total += this.weightOf(id);
    var r = Math.random() * total;
    for (id in this.types) {
      r -= this.weightOf(id);
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
    if (t.effect === "equip" || t.effect === "gun") {
      Game.equip.toggle(entry); // 近接武器・防具・銃
      return false; // 装備してもなくならない
    }
    var mul = Game.dimension.powerMul(entry); // 別の世界の品なら効き目の読み替え（dimension.js）
    if (t.effect === "fidget") {
      Game.sound.play("fidget");
      return this.useFidget(entry, t, mul);
    }
    // 回復・最大値アップは効果の中で音を鳴らす。それ以外は共通の「使った」音
    if (t.sound) Game.sound.play(t.sound); // アイテム専用の音（六面パズルの「カチャカチャ」など）
    else if (t.effect !== "heal" && t.effect !== "mindUp") Game.sound.play("use");
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
      if (!t.sound) Game.sound.play("heal");
      Game.mind.restore(power, true);
    },

    // 千里眼の札：この階の地形とアイテムがすべてわかる
    reveal: function () {
      for (var y = 0; y < Game.map.height; y++) {
        for (var x = 0; x < Game.map.width; x++) Game.fov.explored[y][x] = true;
      }
      Game.items.floorItems.forEach(function (fi) { fi.seen = true; });
      Game.log.add("頭の中に、この階の姿がはっきりと浮かんだ！", "good");
    },

    // 守護の札：しばらく受けるダメージが3/4
    guard: function (t, power) {
      Game.player.guardTurns = power;
      Game.log.add("淡い光の膜に包まれた。" + power + "ターンの間、受けるダメージが3/4になる。", "good");
    },

    // 静寂の札：見えている敵が技を使えなくなる（ボスには効かない）
    hush: function (t, power) {
      var n = 0, resisted = [];
      Game.enemies.list.forEach(function (e) {
        if (!Game.fov.isVisible(e.x, e.y)) return;
        var turns = Game.equip.statusTurns(e, "debuff", power);
        if (turns === 0) {
          resisted.push(e.name);
          return;
        }
        e.silenced = turns;
        e.charge = null;
        n++;
      });
      if (n > 0) Game.log.add("あたりが静まりかえった。見えている敵は " + power + " ターンの間、技を使えない。", "good");
      if (resisted.length > 0) Game.log.add(resisted.join("・") + "には効果がなかった…（ボスには技封じが効かない）", "miss");
      if (n === 0 && resisted.length === 0) Game.log.add("しかし何も起こらなかった。", "miss");
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
      if (!this.at(cur.x, cur.y) && Game.map.isFloor(Game.map.tileAt(cur.x, cur.y))) return cur;
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
