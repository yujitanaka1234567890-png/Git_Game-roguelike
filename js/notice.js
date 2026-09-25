// 画面下のお知らせ（薄い帯）。大事な出来事をログだけでなく、ゲーム画面の下にも数秒だけ出す。
//   ・精神力の警告（遠吠え・ささやきが聞こえた理由も出す）、HPが残りわずか、レベルアップ など
//   ・見た目だけでルールには影響しない。同時に出すのは max 行まで（古いものから消える）
//   Game.notice.show("文", "warn" | "danger" | "good" | "info")
Game.notice = {
  max: 3,
  showMs: 3500, // 出している時間（ミリ秒）
  items: [], // [{text, type, until}]
  lowHpWarned: false, // HPが残りわずかの警告を出したか（回復したら、また出せる）
  lowHpRatio: 0.25, // HPがこの割合以下で警告
  lowHpReset: 0.4, // この割合を超えたら、次にまた警告できる

  show: function (text, type) {
    this.items.push({ text: text, type: type || "info", until: Date.now() + this.showMs });
    while (this.items.length > this.max) this.items.shift();
    this.render();
    var self = this;
    setTimeout(function () { self.render(); }, this.showMs + 50);
  },

  clear: function () {
    this.items = [];
    this.lowHpWarned = false;
    this.render();
  },

  // ターンの終わりに呼ぶ：HPが残りわずかになったら一度だけ知らせる
  checkHp: function () {
    var p = Game.player;
    if (p.hp <= 0 || !p.maxHp) return;
    var r = p.hp / p.maxHp;
    if (r > this.lowHpReset) this.lowHpWarned = false;
    if (r <= this.lowHpRatio && !this.lowHpWarned) {
      this.lowHpWarned = true;
      this.show("⚠ HPが残りわずか！（" + p.hp + " / " + p.maxHp + "）回復するか、逃げよう", "danger");
    }
  },

  render: function () {
    var el = document.getElementById("notice");
    if (!el) {
      var wrap = document.getElementById("game-wrap");
      if (!wrap) return;
      el = document.createElement("div");
      el.id = "notice";
      wrap.appendChild(el);
    }
    var now = Date.now();
    this.items = this.items.filter(function (n) { return n.until > now; });
    el.innerHTML = "";
    el.hidden = this.items.length === 0;
    for (var i = 0; i < this.items.length; i++) {
      var d = document.createElement("div");
      d.className = "notice-line notice-" + this.items[i].type;
      d.textContent = this.items[i].text;
      el.appendChild(d);
    }
  },
};
