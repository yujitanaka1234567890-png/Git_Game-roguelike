// 記録の呪文（セーブ用の長いパスワード）。
// ふだんの記録は、このブラウザの保存領域に自動で残っている（base.js）。
// それとは別に、拠点の「記録の石碑」で記録を1つの長い文字列（呪文）に書き出せる。
// 呪文を控えておけば、別のPC・別のブラウザ・保存領域を消した後でも、呪文を地面に書く（貼り付ける）だけで続きから遊べる。
//
// 呪文の中身：JIGEN1-（打ち間違い検出用の番号）-（記録の中身を文字に変換したもの）
//   ・中身は牧場・倉庫・踏破記録・交配の発見・はぐれた仲間の記録（ブラウザの自動記録と同じもの）
//   ・打ち間違いがあると検出番号が合わなくなり、「呪文が正しくない」と教えてくれる
//   ・外部には一切送らない（ブラウザの中で変換するだけ）
Game.savecode = {
  prefix: "JIGEN1",
  mode: null, // null（閉じている） / "export"（書き出し） / "import"（地面に書く）

  isOpen: function () {
    return this.mode !== null;
  },

  // 打ち間違い検出用の番号（FNV-1a という計算方法）
  checksum: function (text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("0000000" + h.toString(36)).slice(-7);
  },

  // 記録 → 呪文
  encode: function (data) {
    var json = JSON.stringify(data);
    var bytes = new TextEncoder().encode(json);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return this.prefix + "-" + this.checksum(json) + "-" + btoa(bin);
  },

  // 呪文 → 記録。正しくなければ { error: 理由 }
  decode: function (code) {
    var s = (code || "").replace(/\s+/g, "");
    var parts = s.split("-");
    if (parts.length !== 3 || parts[0] !== this.prefix) return { error: "呪文の形が正しくない（JIGEN1- で始まる呪文を、全部貼り付けてください）" };
    var json;
    try {
      var bin = atob(parts[2]);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      json = new TextDecoder().decode(bytes);
    } catch (e) {
      return { error: "呪文の文字が壊れている（途中が欠けていないか確認してください）" };
    }
    if (this.checksum(json) !== parts[1]) return { error: "呪文のどこかが違う（1文字でも違うと、書いても何も起こりません）" };
    try {
      return { data: JSON.parse(json) };
    } catch (e) {
      return { error: "呪文の中身が読めない" };
    }
  },

  close: function () {
    this.mode = null;
    document.getElementById("savecode").hidden = true;
    document.getElementById("game").focus();
    Game.refresh();
  },

  // 書き出し（今の記録を呪文にして見せる）
  openExport: function () {
    Game.base.save();
    var code = this.encode(Game.base.getSaveData());
    this.mode = "export";
    var self = this;
    this.build(
      "記録の呪文（書き出し）",
      [
        "下の呪文が、今の記録（牧場の仲間・倉庫の道具・踏破したダンジョン・はぐれた仲間など）のすべてです。",
        "メモ帳などに貼り付けて保存しておけば、別のPCやブラウザでも「記録の呪文を地面に書く」で続きから遊べます。",
        "※冒険の途中の状態は入りません（拠点にいる時の記録です）。",
      ],
      code,
      true,
      [
        { label: "コピーする", onClick: function (ta, msg) { self.copy(ta, msg); } },
        { label: "閉じる", onClick: function () { self.close(); } },
      ]
    );
  },

  // 地面に書く（呪文を入力して記録を読み込む）
  openImport: function () {
    this.mode = "import";
    var self = this;
    this.build(
      "記録の呪文（地面に書く）",
      [
        "書き出しておいた呪文を、下の欄に全部貼り付けて「地面に書く」を押してください。",
        "⚠ 書くと、今このブラウザにある記録は、呪文に記録された世界線のものに置き換わります。",
      ],
      "",
      false,
      [
        { label: "地面に書く（読み込む）", onClick: function (ta, msg) { self.apply(ta.value, msg); } },
        { label: "閉じる", onClick: function () { self.close(); } },
      ]
    );
  },

  apply: function (code, msg) {
    var r = this.decode(code);
    if (r.error) {
      msg.textContent = "✖ " + r.error;
      return;
    }
    if (!Game.base.applySaveData(r.data)) {
      msg.textContent = "✖ 呪文の記録が読み取れなかった";
      return;
    }
    this.mode = null;
    document.getElementById("savecode").hidden = true;
    Game.base.lastResult = { kind: "info", lines: ["地面に書いた文字が浮かび上がり光った。記録された世界線へ移動した"] };
    Game.showBase();
    Game.sound.play("rescue");
    Game.fx.flash(Game.fx.around(Game.player.x, Game.player.y, 2), "#cfa8ff", 900);
  },

  copy: function (ta, msg) {
    var done = function () { msg.textContent = "コピーしました。メモ帳などに貼り付けて保存してください。"; };
    ta.focus();
    ta.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(done, function () {
        msg.textContent = document.execCommand("copy") ? "コピーしました。" : "自動でコピーできませんでした。選択されている文字を Ctrl+C でコピーしてください。";
      });
    } else {
      msg.textContent = document.execCommand("copy") ? "コピーしました。" : "自動でコピーできませんでした。選択されている文字を Ctrl+C でコピーしてください。";
    }
  },

  // 画面（ゲーム画面の上に重ねる）
  build: function (title, lines, text, readOnly, buttons) {
    var el = document.getElementById("savecode");
    el.innerHTML = "";
    el.hidden = false;
    var h = document.createElement("div");
    h.className = "inv-title";
    h.textContent = title;
    el.appendChild(h);
    for (var i = 0; i < lines.length; i++) {
      var p = document.createElement("div");
      p.className = "inv-desc";
      p.textContent = lines[i];
      el.appendChild(p);
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.readOnly = readOnly;
    ta.spellcheck = false;
    el.appendChild(ta);
    var msg = document.createElement("div");
    msg.className = "sc-msg";
    buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.textContent = b.label;
      btn.addEventListener("click", function () { b.onClick(ta, msg); });
      el.appendChild(btn);
    });
    el.appendChild(msg);
    var hint = document.createElement("div");
    hint.className = "inv-help";
    hint.textContent = "Esc でも閉じられます。";
    el.appendChild(hint);
    if (readOnly) ta.select();
    else ta.focus();
  },

  // 拠点の石碑に触れた時
  openMenu: function () {
    var self = this;
    Game.dialog.open({
      title: "記録の石碑",
      lines: [
        "記録はこのブラウザに自動で残っている。",
        "「記録の呪文」を書き出しておけば、別のPCやブラウザでも続きから遊べる。",
      ],
      options: [
        { label: "記録の呪文を書き出す", onChoose: function () { self.openExport(); } },
        { label: "記録の呪文を地面に書く（続きから）", onChoose: function () { self.openImport(); } },
        { label: "閉じる" },
      ],
    });
  },
};
