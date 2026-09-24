// 分隊：人型の仲間を隊長に、最大4体で「この部屋を任せる」独立行動の指示を出す（O キー）。
//   ・作れるのは、主人公と同じ部屋にいる仲間だけ。人型（humanoid）が1体は必要
//   ・分隊はその部屋の中だけで動き、部屋にいる敵を自分たちで探して倒す（主人公にはついてこない）
//   ・部屋に敵がいなければ、その部屋で待つ。部屋の外へは出ない
//   ・O キーの指示で呼び戻せる（解除）。階を移る時は自動で合流する
//   ・離れていても、分隊の仲間が倒れるとログに赤字で出る（allies.die）
Game.squad = {
  nextId: 1,

  // (x, y) が部屋 room の中（出入口を含む）か
  inRoom: function (room, x, y) {
    return Game.map.roomAt(x, y) === room;
  },

  // 今ある分隊 [{id, room, members:[仲間]}]
  list: function () {
    var map = {};
    var out = [];
    Game.allies.list.forEach(function (a) {
      if (!a.squad) return;
      if (!map[a.squad.id]) {
        map[a.squad.id] = { id: a.squad.id, room: a.squad.room, members: [] };
        out.push(map[a.squad.id]);
      }
      map[a.squad.id].members.push(a);
    });
    return out;
  },

  names: function (members) {
    return members.map(function (a) { return a.baseName; }).join("・");
  },

  // 仲間の行動（allies.act から）。分隊の子なら動いて true を返す
  act: function (a) {
    if (!a.squad) return false;
    var room = a.squad.room;
    var path = Game.path;
    var target = null, best = 999;
    for (var i = 0; i < Game.enemies.list.length; i++) {
      var e = Game.enemies.list[i];
      if (!this.inRoom(room, e.x, e.y)) continue;
      var d = path.dist(a.x, a.y, e.x, e.y);
      if (d < best) { best = d; target = e; }
    }
    var step = null;
    if (target) step = path.stepToward(a, target.x, target.y);
    else if (!this.inRoom(room, a.x, a.y)) step = path.stepToward(a, room.x1 + 1, room.y1 + 1); // 部屋の外に押し出されたら戻る
    else if (Math.random() < 0.25) step = Game.pick(Game.DIRS8); // 見張りでうろうろ
    if (step && (!this.inRoom(room, a.x + step[0], a.y + step[1]) && this.inRoom(room, a.x, a.y))) step = null; // 部屋からは出ない
    if (step && Game.map.canStep(a.x, a.y, step[0], step[1]) && path.isFree(a.x + step[0], a.y + step[1])) {
      a.x += step[0];
      a.y += step[1];
    }
    return true;
  },

  // 階を移る時：分隊は解散して主人公と合流
  onNewFloor: function () {
    var had = false;
    Game.allies.list.forEach(function (a) {
      if (a.squad) had = true;
      a.squad = null;
    });
    if (had) Game.log.add("分隊の仲間たちも合流して、一緒に階を移った。", "ally");
  },

  // ---------- 指示のウィンドウ（O キー） ----------
  openMenu: function () {
    var self = this;
    var p = Game.player;
    var room = Game.map.roomAt(p.x, p.y);
    var options = [];
    var free = Game.allies.list.filter(function (a) { return !a.squad && a.x >= 0 && room && self.inRoom(room, a.x, a.y); });
    if (room && free.some(function (a) { return Game.MONSTERS[a.type].humanoid; })) {
      options.push({ label: "分隊を作って、この部屋を任せる", onChoose: function () { self.openCreate({}, 0); } });
    }
    this.list().forEach(function (sq) {
      options.push({
        label: "分隊" + sq.id + "（" + self.names(sq.members) + "）を呼び戻す",
        onChoose: function () { self.release(sq.id); },
      });
    });
    options.push({ label: "閉じる" });
    Game.dialog.open({
      title: "分隊への指示",
      lines: [
        "人型の仲間を隊長に、同じ部屋にいる仲間で最大 " + Game.config.squad.maxMembers + " 体の分隊を作れる。",
        "分隊はその部屋の中だけで動き、部屋の敵を自分たちで倒す（部屋からは出ない）。",
        room ? "" : "※今は部屋の中にいないので、新しい分隊は作れない。",
      ].filter(function (t) { return t; }),
      options: options,
    });
  },

  // 隊員を選ぶ（picked = { 仲間の番号: true }）
  openCreate: function (picked, cursor) {
    var self = this;
    var p = Game.player;
    var room = Game.map.roomAt(p.x, p.y);
    var max = Game.config.squad.maxMembers;
    var cands = Game.allies.list.filter(function (a) { return !a.squad && a.x >= 0 && room && self.inRoom(room, a.x, a.y); });
    var team = cands.filter(function (a) { return picked[Game.allies.list.indexOf(a)]; });
    var ready = team.length > 0 && team.some(function (a) { return Game.MONSTERS[a.type].humanoid; });
    var options = cands.map(function (a, idx) {
      var key = Game.allies.list.indexOf(a);
      return {
        label: (picked[key] ? "【隊員】" : "　　　　") + a.symbol + " " + a.baseName + " Lv" + a.level +
          "（HP " + a.hp + "/" + a.maxHp + "）" + (Game.MONSTERS[a.type].humanoid ? "　★人型" : ""),
        keepOpen: true,
        onChoose: function () {
          if (picked[key]) delete picked[key];
          else if (team.length < max) picked[key] = true;
          else Game.log.add("分隊は " + max + " 体までだ。", "miss");
          self.openCreate(picked, idx);
        },
      };
    });
    options.push({
      label: ready ? "この分隊に部屋を任せる" : team.length === 0 ? "（隊員を選んでください）" : "（人型の仲間を1体は入れてください）",
      keepOpen: !ready,
      onChoose: function () {
        if (!ready) return;
        var sq = { id: self.nextId++, room: room };
        team.forEach(function (a) { a.squad = sq; });
        Game.log.add("分隊" + sq.id + "（" + self.names(team) + "）に、この部屋を任せた。", "ally");
        Game.refresh();
      },
    });
    options.push({ label: "やめる" });
    Game.dialog.open(
      { title: "分隊を作る（" + team.length + " / " + max + "）", lines: ["この部屋にいる仲間から選ぶ（★人型が1体は必要）。"], options: options },
      cursor
    );
  },

  release: function (id) {
    var members = Game.allies.list.filter(function (a) { return a.squad && a.squad.id === id; });
    members.forEach(function (a) { a.squad = null; });
    if (members.length > 0) Game.log.add("分隊" + id + "（" + this.names(members) + "）を呼び戻した。", "ally");
    Game.refresh();
  },
};
