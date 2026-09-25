// 記録の石碑の「記録の枠」（3つまで）と「最初から始める」。
//   ・ふだんの記録（今遊んでいる世界）は base.js がブラウザに自動で残している（save-v1）。
//   ・それとは別に、今の記録の写しを枠1〜3に残しておける（slotsKey）。あとで枠から読み込むと、その時の状態に戻れる。
//   ・「最初から始める」は今遊んでいる記録だけを新しくする。枠の中身には一切さわらない（消さない）。
//   ・どちらもこのブラウザの中だけ。別のPCへ持っていく時は「記録の呪文」（savecode.js）を使う。
Game.saveSlots = {
  count: 3,
  slotsKey: "dimension-roguelike-slots-v1",

  // 枠の中身 [{ savedAt: 時刻(ms), data: 記録 } または null] × count
  readAll: function () {
    var list = null;
    try {
      list = JSON.parse(window.localStorage.getItem(this.slotsKey) || "null");
    } catch (e) {
      list = null;
    }
    if (!Array.isArray(list)) list = [];
    for (var i = 0; i < this.count; i++) if (!list[i]) list[i] = null;
    return list.slice(0, this.count);
  },

  writeAll: function (list) {
    try {
      window.localStorage.setItem(this.slotsKey, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  },

  // 枠の見出し（中身の要約）
  label: function (i, slot) {
    if (!slot) return "枠" + (i + 1) + "：（空き）";
    var d = slot.data, t = new Date(slot.savedAt);
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var when = t.getFullYear() + "/" + pad(t.getMonth() + 1) + "/" + pad(t.getDate()) + " " + pad(t.getHours()) + ":" + pad(t.getMinutes());
    var cleared = Object.keys(d.cleared || {}).length;
    return "枠" + (i + 1) + "：" + when + "　牧場" + (d.ranch || []).length + "体・倉庫" + (d.storage || []).length + "個・踏破" + cleared;
  },

  // 今の記録を枠 i に残す
  saveTo: function (i) {
    Game.base.save();
    var list = this.readAll();
    list[i] = { savedAt: Date.now(), data: JSON.parse(JSON.stringify(Game.base.getSaveData())) };
    return this.writeAll(list);
  },

  // 石碑のメニュー
  openMenu: function () {
    var self = this;
    Game.dialog.open({
      title: "記録の石碑",
      lines: [
        "今の記録はこのブラウザに自動で残っている。",
        "それとは別に、記録の写しを3つまで石碑に刻んでおける（あとで読み込むと、その時に戻れる）。",
      ],
      options: [
        { label: "記録を刻む（3つまで）", onChoose: function () { self.openSlots("save"); } },
        { label: "刻んだ記録を読み込む", onChoose: function () { self.openSlots("load"); } },
        { label: "最初から始める（刻んだ記録は消えない）", onChoose: function () { self.confirmNewGame(); } },
        { label: "記録の呪文を書き出す（別のPC用）", onChoose: function () { Game.savecode.openExport(); } },
        { label: "記録の呪文を地面に書く（別のPCから）", onChoose: function () { Game.savecode.openImport(); } },
        { label: "閉じる" },
      ],
    });
  },

  // 枠を選ぶ。mode = "save"（刻む）/ "load"（読み込む）/ "saveThenNew"（刻んでから最初から）
  openSlots: function (mode) {
    var self = this;
    var list = this.readAll();
    var options = list.map(function (slot, i) {
      return {
        label: self.label(i, slot),
        onChoose: function () {
          if (mode === "load") {
            if (slot) self.confirmLoad(i, slot);
            else Game.log.add("その枠には何も刻まれていない。", "miss");
          } else if (slot) {
            self.confirmOverwrite(i, mode);
          } else {
            self.doSave(i, mode);
          }
        },
      };
    });
    options.push({ label: "やめる", onChoose: function () { self.openMenu(); } });
    var titles = { save: "記録を刻む枠を選ぶ", load: "読み込む記録を選ぶ", saveThenNew: "今の記録を刻む枠を選ぶ（そのあと最初から）" };
    Game.dialog.open({ title: titles[mode], lines: ["牧場・倉庫・踏破・図鑑・はぐれた仲間の記録が対象（冒険の途中は入らない）。"], options: options });
  },

  confirmOverwrite: function (i, mode) {
    var self = this;
    Game.dialog.open({
      title: "枠" + (i + 1) + "に上書きする？",
      lines: ["今この枠にある記録は消えて、今の記録に置き換わります。"],
      options: [
        { label: "上書きする", onChoose: function () { self.doSave(i, mode); } },
        { label: "やめる", onChoose: function () { self.openSlots(mode); } },
      ],
    });
  },

  doSave: function (i, mode) {
    if (!this.saveTo(i)) {
      Game.log.add("記録を刻めなかった…（ブラウザの保存領域が使えない）", "bad");
      return;
    }
    Game.log.add("石碑の枠" + (i + 1) + "に、今の記録を刻んだ。", "good");
    Game.sound.play("use");
    if (mode === "saveThenNew") this.startNew();
  },

  confirmLoad: function (i, slot) {
    var self = this;
    Game.dialog.open({
      title: "枠" + (i + 1) + "の記録を読み込む？",
      lines: [
        self.label(i, slot),
        "⚠ 今遊んでいる記録は、この枠の記録に置き換わります（残したい時は、先に空いている枠に刻んでください）。",
        "枠の中身はそのまま残ります。",
      ],
      options: [
        {
          label: "読み込む",
          onChoose: function () {
            if (!Game.base.applySaveData(JSON.parse(JSON.stringify(slot.data)))) {
              Game.log.add("この枠の記録は読み取れなかった…", "bad");
              return;
            }
            Game.base.keepLastLog(null);
            Game.base.lastResult = { kind: "info", lines: ["石碑に刻まれた記録（枠" + (i + 1) + "）の世界へ戻ってきた。"] };
            Game.showBase();
            Game.sound.play("rescue");
          },
        },
        { label: "やめる", onChoose: function () { self.openSlots("load"); } },
      ],
    });
  },

  // 最初から始める：今の記録は新しくなる。枠は消さない
  confirmNewGame: function () {
    var self = this;
    var b = Game.base;
    Game.dialog.open({
      title: "最初から始める？",
      lines: [
        "今遊んでいる記録（牧場" + b.ranch.length + "体・倉庫" + b.storage.length + "個）は、最初の状態に戻ります。",
        "石碑に刻んだ3つの記録は消えません。あとで「刻んだ記録を読み込む」で戻れます。",
      ],
      options: [
        { label: "今の記録を枠に刻んでから、最初から始める", onChoose: function () { self.openSlots("saveThenNew"); } },
        { label: "刻まずに、最初から始める", onChoose: function () { self.startNew(); } },
        { label: "やめる", onChoose: function () { self.openMenu(); } },
      ],
    });
  },

  startNew: function () {
    Game.base.resetToNew(); // 今の記録だけを新しくする（枠 slotsKey にはさわらない）
    Game.showBase();
  },
};
