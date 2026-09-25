// 拠点のデータ（牧場・倉庫・出発準備）と保存。拠点の画面・歩き回りは basemap.js。
//   ・牧場（ranch）：連れ帰った仲間。種類だけを記録し、冒険に連れて行く時はLv1で作り直す
//   ・倉庫（storage）：生きて帰った時の持ち物をしまう。出発前に持って行く物を選ぶ
//   ・ブラウザの保存領域（localStorage）に保存する。このPCのブラウザ内だけで、外部には送らない
Game.base = {
  ranch: [], // [{id, type, onMission?}]  type = 敵の種類ID / onMission = 救出に出かけている記録のID
  storage: [], // [{id, type, uses, origin}]  アイテムデータ（items.js の makeEntry）に倉庫用の番号 id をつけたもの
  nextId: 1,
  selected: {}, // 牧場から連れて行く子 { id: true }
  taking: {}, // 倉庫から持って行く物 { id: true }
  cleared: {}, // 踏破したダンジョン { dungeonId: true }
  discovered: {}, // 交配で生まれたことのある種類 { typeId: true }（まだの子は「？？？」と表示）
  seen: {}, // 出会ったことのある種類 { typeId: true }（プレイヤー用の図鑑 bestiary.js に載る）
  lost: [], // はぐれた仲間の記録 [{id, dungeonId, floor, members: [種類ID], mission: null | {team, chance}}]（rescue.js）
  lastResult: null, // 直前の冒険の結果 { kind: "escape" | "death" | "info", lines: [...] }
  firstTime: false, // 初めて遊ぶ（保存データがなかった）。拠点に着いたら遊び方の説明を読むかたずねる
  lastLog: null, // 倒れた冒険のログ（拠点のログの下に続けて出す。次の冒険に出るまで残る）[{text, type, meta}]
  lastLogKey: "dimension-roguelike-lastlog",
  saveKey: "dimension-roguelike-save-v1",

  load: function () {
    var data = null;
    try {
      var raw = window.localStorage.getItem(this.saveKey);
      if (raw) data = JSON.parse(raw);
    } catch (e) {
      data = null; // 保存領域が使えない環境（プライベートモード等）でも遊べるようにする
    }
    if (!data) {
      this.resetToNew(); // 初めて遊ぶ
      return;
    }
    this.nextId = data.nextId || 1;
    // もう存在しない種類は読み飛ばす
    this.ranch = (data.ranch || []).filter(function (r) { return Game.enemies.types[r.type]; });
    this.storage = (data.storage || []).filter(function (s) { return Game.items.types[s.type]; });
    this.cleared = data.cleared || {};
    this.discovered = data.discovered || {};
    this.seen = data.seen || {};
    this.lost = (data.lost || []).filter(function (r) {
      return Game.DUNGEONS[r.dungeonId] && r.members.every(function (t) { return Game.MONSTERS[t]; });
    });
  },

  // 最初の状態にする（初めて遊ぶ時・石碑の「最初から始める」）。
  // 今遊んでいる記録（saveKey）だけを新しくする。石碑に刻んだ記録（saveslots.js）にはさわらない
  resetToNew: function () {
    this.nextId = 1;
    this.ranch = [];
    this.storage = [];
    this.cleared = {};
    this.discovered = {};
    this.seen = {};
    this.lost = [];
    this.selected = {};
    this.taking = {};
    for (var i = 0; i < Game.config.starterStorage.length; i++) this.addToStorage(Game.config.starterStorage[i]);
    this.lastResult = null;
    this.firstTime = true; // 拠点に着いたら、遊び方の説明を読むかたずねる（tutorial.js）
    this.keepLastLog(null);
    this.save();
  },

  // 倒れた冒険のログを覚えておく（ブラウザを閉じても、次の冒険に出るまで拠点で読める。記録の呪文には入れない）
  keepLastLog: function (lines) {
    this.lastLog = lines ? lines.slice() : null;
    try {
      if (this.lastLog) window.localStorage.setItem(this.lastLogKey, JSON.stringify(this.lastLog));
      else window.localStorage.removeItem(this.lastLogKey);
    } catch (e) {
      // 覚えておけなくても遊べる
    }
  },

  loadLastLog: function () {
    try {
      var raw = window.localStorage.getItem(this.lastLogKey);
      this.lastLog = raw ? JSON.parse(raw) : null;
    } catch (e) {
      this.lastLog = null;
    }
  },

  // 保存する中身（ブラウザの自動記録と、記録の呪文 savecode.js で共通）
  getSaveData: function () {
    return {
      ranch: this.ranch, storage: this.storage, nextId: this.nextId,
      cleared: this.cleared, discovered: this.discovered, seen: this.seen, lost: this.lost,
    };
  },

  save: function () {
    try {
      window.localStorage.setItem(this.saveKey, JSON.stringify(this.getSaveData()));
    } catch (e) {
      // 保存できなくてもゲームは続ける
    }
  },

  // 記録の呪文から読み込む。形がおかしければ false（今の記録はそのまま）
  applySaveData: function (data) {
    if (!data || !Array.isArray(data.ranch) || !Array.isArray(data.storage) || typeof data.nextId !== "number") return false;
    try {
      window.localStorage.setItem(this.saveKey, JSON.stringify(data));
    } catch (e) {
      // 保存領域が使えなくても、この場では読み込む
    }
    this.nextId = data.nextId;
    this.ranch = data.ranch.filter(function (r) { return Game.enemies.types[r.type]; });
    this.storage = data.storage.filter(function (s) { return Game.items.types[s.type]; });
    this.cleared = data.cleared || {};
    this.discovered = data.discovered || {};
    this.seen = data.seen || {};
    this.lost = (data.lost || []).filter(function (r) {
      return Game.DUNGEONS[r.dungeonId] && r.members.every(function (t) { return Game.MONSTERS[t]; });
    });
    this.selected = {};
    this.taking = {};
    return true;
  },

  ranchEntry: function (id) {
    for (var i = 0; i < this.ranch.length; i++) if (this.ranch[i].id === id) return this.ranch[i];
    return null;
  },

  // ---------- ダンジョンの解放 ----------

  isUnlocked: function (dungeonId) {
    var by = Game.DUNGEONS[dungeonId].unlockedBy;
    return !by || !!this.cleared[by];
  },

  // 踏破を記録する。今回新しく行けるようになったダンジョンのIDを返す
  markCleared: function (dungeonId) {
    var before = {};
    var id;
    for (id in Game.DUNGEONS) before[id] = this.isUnlocked(id);
    this.cleared[dungeonId] = true;
    var opened = [];
    for (id in Game.DUNGEONS) if (!before[id] && this.isUnlocked(id)) opened.push(id);
    return opened;
  },

  // ---------- 交配 ----------

  // 牧場の2体を交配する。親は牧場からいなくなり（ダンジョンへ帰る）、子が牧場に加わる。
  // 生まれた子の種類IDを返す。組み合わせ表にない時は null（何も起きない）
  breed: function (idA, idB) {
    var a = this.ranchEntry(idA), b = this.ranchEntry(idB);
    if (!a || !b || a === b) return null;
    if (a.onMission || b.onMission) return null; // 救出に出かけている子は交配できない
    var child = Game.breedResult(a.type, b.type);
    if (!child) return null;
    this.ranch = this.ranch.filter(function (r) { return r !== a && r !== b; });
    delete this.selected[idA];
    delete this.selected[idB];
    this.addToRanch(child);
    this.discovered[child] = true;
    this.save();
    return child;
  },

  addToRanch: function (typeId) {
    if (this.ranch.length >= Game.config.ranchMax) return false;
    this.ranch.push({ id: this.nextId++, type: typeId });
    return true;
  },

  // 倉庫に入れる（種類ID でも アイテムデータ でもよい）。いっぱいなら false
  addToStorage: function (typeOrEntry) {
    if (this.storage.length >= Game.config.storageMax) return false;
    var e = Game.items.makeEntry(typeOrEntry);
    e.id = this.nextId++;
    this.storage.push(e);
    return true;
  },

  // 次の冒険に連れて行く子（救出に出かけている子は除く）
  partyEntries: function () {
    var self = this;
    return this.ranch.filter(function (r) { return self.selected[r.id] && !r.onMission; });
  },

  // 連れて行く／やめるを切り替える。結果："added" / "removed" / "full"
  toggleParty: function (id) {
    var e = this.ranchEntry(id);
    if (e && e.onMission) return "away";
    if (this.selected[id]) {
      delete this.selected[id];
      return "removed";
    }
    if (this.partyEntries().length >= Game.config.maxAllies) return "full";
    this.selected[id] = true;
    return "added";
  },

  countTaking: function () {
    var n = 0;
    for (var id in this.taking) if (this.taking[id]) n++;
    return n;
  },

  // 持って行く／やめるを切り替える。結果："added" / "removed" / "full"
  toggleTaking: function (id) {
    if (this.taking[id]) {
      delete this.taking[id];
      return "removed";
    }
    if (this.countTaking() >= Game.inventory.max) return "full";
    this.taking[id] = true;
    return "added";
  },

  // 出発時：選んだ物を倉庫から取り出して返す（倉庫から消える）
  takeItemsOut: function () {
    var self = this;
    var out = this.storage.filter(function (s) { return self.taking[s.id]; });
    this.storage = this.storage.filter(function (s) { return !self.taking[s.id]; });
    this.taking = {};
    this.save();
    return out.map(function (s) { return Game.items.makeEntry(s); });
  },

  // 帰還時：持ち物（アイテムデータ）を倉庫にしまう。入りきらなかった物の名前を返す
  storeItems: function (entries) {
    var overflow = [];
    for (var i = 0; i < entries.length; i++) {
      if (!this.addToStorage(entries[i])) overflow.push(Game.items.displayName(entries[i]));
    }
    return overflow;
  },

  // 牧場・倉庫の中身が変わった後、無くなったものの選択を消す
  tidy: function () {
    var ids = {};
    var all = this.ranch.concat(this.storage);
    for (var i = 0; i < all.length; i++) ids[all[i].id] = true;
    for (var a in this.selected) if (!ids[a]) delete this.selected[a];
    for (var b in this.taking) if (!ids[b]) delete this.taking[b];
  },

  // 画面上部の「連れて行く仲間」欄（拠点にいる間）
  renderPartyPanel: function () {
    var el = document.getElementById("party");
    el.innerHTML = "";
    var title = document.createElement("span");
    title.className = "party-title";
    title.textContent = "連れて行く仲間 " + this.partyEntries().length + "/" + Game.config.maxAllies;
    el.appendChild(title);
    var party = this.partyEntries();
    if (party.length === 0) {
      var none = document.createElement("span");
      none.className = "party-none";
      none.textContent = "（牧場の仲間に話しかけて選ぶ）";
      el.appendChild(none);
    }
    for (var i = 0; i < party.length; i++) {
      var t = Game.enemies.types[party[i].type];
      var item = document.createElement("span");
      item.className = "party-member";
      var sym = document.createElement("b");
      sym.style.color = t.color;
      sym.textContent = t.symbol + " ";
      item.appendChild(sym);
      item.appendChild(document.createTextNode(t.name));
      el.appendChild(item);
    }
    var bag = document.createElement("span");
    bag.className = "party-title";
    bag.textContent = "持って行く道具 " + this.countTaking() + "/" + Game.inventory.max;
    el.appendChild(bag);
  },
};
