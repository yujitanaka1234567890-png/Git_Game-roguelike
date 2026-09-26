// 画面左下のメッセージログ。新しい行が一番上に表示され、スクロールすると古い行も見られる（最大 max 行）。
// 技の名前が入った行は、その名前をクリックすると技の説明が出る（meta.skill に技のIDを入れて add する）。
Game.log = {
  lines: [],
  max: 300,
  version: 0, // 中身が変わった回数（変わった時だけ描き直す）
  drawnVersion: -1,

  clear: function () {
    this.lines = [];
    this.version++;
  },

  // type: "good"（有利） / "bad"（不利） / "miss" / "warn"（敵の予兆） / "ally"（仲間の予兆） / "info" → 文字色が変わる
  // meta: { skill: 技のID } を渡すと、技の名前がクリックできるようになる
  add: function (text, type, meta) {
    this.lines.push({ text: text, type: type || "info", meta: meta || null });
    if (this.lines.length > this.max) this.lines.shift();
    this.version++;
  },

  render: function () {
    if (this.drawnVersion === this.version) return;
    this.drawnVersion = this.version;
    var el = document.getElementById("log");
    el.innerHTML = "";
    for (var i = this.lines.length - 1; i >= 0; i--) {
      var line = this.lines[i];
      var div = document.createElement("div");
      div.className = "log-" + line.type;
      this.fillLine(div, line);
      el.appendChild(div);
    }
    el.scrollTop = 0; // 新しい行（一番上）を見せる
  },

  // 1行を作る。技の名前があればクリックできる部分にする
  fillLine: function (div, line) {
    var skillId = line.meta && line.meta.skill;
    var def = skillId && Game.SKILLS[skillId];
    var at = def ? line.text.indexOf(def.name) : -1;
    var add = function (text) {
      var span = document.createElement("span");
      Game.icons.fill(span, text); // [[tile:H]] などの印はドット絵のアイコンになる（icons.js）
      div.appendChild(span);
    };
    if (at < 0) {
      add(line.text);
      return;
    }
    add(line.text.slice(0, at));
    var link = document.createElement("span");
    link.className = "skill-link";
    link.textContent = def.name;
    link.title = "クリックで技の説明";
    link.addEventListener("click", function () {
      Game.specials.showInfo(skillId);
    });
    div.appendChild(link);
    add(line.text.slice(at + def.name.length));
  },
};
