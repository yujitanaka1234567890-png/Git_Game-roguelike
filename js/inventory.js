// 主人公の持ち物と、持ち物メニュー（画面右上に出るウィンドウ）の表示。
// 使う・置くのターン処理は main.js が行い、ここは「持ち物の中身」と「表示」だけを扱う。
Game.inventory = {
  items: [], // 持っているアイテムデータ [{type, uses, origin}]（items.js の makeEntry）
  max: 12, // 持てる数
  selected: 0, // メニューで選んでいる番号
  open: false, // メニューを開いているか

  clear: function () {
    this.items = [];
    this.selected = 0;
    this.open = false;
    Game.equip.reset(); // 冒険の始め・終わりは武器を外した状態
  },

  // 持ち物に加える（種類ID でも アイテムデータ でもよい）。いっぱいなら false
  // 加えたら、効果の分類（体力回復→精神回復→強化→攻撃→道具）の順に自動で並べ直す
  add: function (typeOrEntry, origin) {
    if (this.items.length >= this.max) return false;
    this.items.push(Game.items.makeEntry(typeOrEntry, origin));
    this.sort();
    return true;
  },

  // 分類の順に並べる（同じ分類の中では、先に持っていた物が上。選んでいる物はそのまま選んだまま）
  sort: function () {
    var cur = this.items[this.selected];
    var order = Game.items.groupOrder;
    var rank = function (e) {
      var i = order.indexOf(Game.items.types[e.type].group);
      return i < 0 ? order.length : i;
    };
    var indexed = this.items.map(function (e, i) { return { e: e, i: i }; });
    indexed.sort(function (a, b) { return rank(a.e) - rank(b.e) || a.i - b.i; });
    this.items = indexed.map(function (x) { return x.e; });
    if (cur) this.selected = Math.max(0, this.items.indexOf(cur));
  },

  selectedEntry: function () {
    return this.items[this.selected] || null;
  },

  // 選んでいるアイテムを取り出して返す（持ち物から消える）
  takeSelected: function () {
    if (this.items.length === 0) return null;
    var entry = this.items.splice(this.selected, 1)[0];
    if (this.selected >= this.items.length) this.selected = Math.max(0, this.items.length - 1);
    Game.equip.onRemoved(entry); // 装備中の武器なら外れる
    return entry;
  },

  // 持ち物の中の特定のアイテムを取り除く（使ってなくなった時）
  removeEntry: function (entry) {
    var i = this.items.indexOf(entry);
    if (i < 0) return;
    this.items.splice(i, 1);
    if (this.selected >= this.items.length) this.selected = Math.max(0, this.items.length - 1);
  },

  moveCursor: function (d) {
    if (this.items.length === 0) return;
    this.selected = (this.selected + d + this.items.length) % this.items.length; // 端まで行くと反対側へ
  },

  render: function () {
    var el = document.getElementById("inventory");
    if (!this.open) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = "";

    var title = document.createElement("div");
    title.className = "inv-title";
    title.textContent = "持ち物（" + this.items.length + " / " + this.max + "）";
    el.appendChild(title);

    if (this.items.length === 0) {
      var empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "何も持っていない";
      el.appendChild(empty);
    }

    var ul = document.createElement("ul");
    var lastGroup = null;
    for (var i = 0; i < this.items.length; i++) {
      var t = Game.items.types[this.items[i].type];
      if (t.group !== lastGroup) {
        // 分類の見出し（選択はできない）
        var head = document.createElement("li");
        head.className = "inv-group";
        head.textContent = "― " + (Game.items.groupLabels[t.group] || "その他") + " ―";
        ul.appendChild(head);
        lastGroup = t.group;
      }
      var li = document.createElement("li");
      if (i === this.selected) li.className = "selected";
      var icon = document.createElement("span");
      icon.className = "inv-icon";
      icon.appendChild(Game.icons.make("item:" + this.items[i].type, 18));
      li.appendChild(icon);
      li.appendChild(document.createTextNode(Game.items.displayName(this.items[i])));
      ul.appendChild(li);
    }
    el.appendChild(ul);

    var cur = this.selectedEntry();
    if (cur) {
      var desc = document.createElement("div");
      desc.className = "inv-desc";
      desc.textContent = Game.items.types[cur.type].desc;
      el.appendChild(desc);
      var from = document.createElement("div");
      from.className = "inv-help";
      var rr = Game.items.rarityOf(cur.type);
      from.textContent = "レア度：" + rr.stars + "（" + rr.label + "）　拾った世界：" + Game.dimension.worldName(cur.origin);
      el.appendChild(from);
    }

    var help = document.createElement("div");
    help.className = "inv-help";
    help.textContent = "↑↓：選ぶ　Enter：使う（武器・防具・銃は装備／外す、杖は方向を選ぶ）　T：投げる　D：置く　Esc / I / W：閉じる";
    el.appendChild(help);
  },
};
