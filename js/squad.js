// 分隊：人型の仲間を隊長に、最大4体で独立行動させる（.（ドット）キーで指示）。
//   ・指示が出せるのは、主人公が分隊と同じ部屋にいる時だけ
//     （分隊を作る時は、同じ部屋にいる仲間から選ぶ。呼び戻す時も、分隊の誰かと同じ部屋にいる必要がある）
//   ・分隊は主人公から離れて階を自由に探索し、見つけた敵を自分たちで倒す（隊長が行き先の部屋を決め、隊員は隊長についていく）
//   ・別の部屋へ行ってしまったら、次に同じ部屋で会うまで指示は出せない
//   ・階を移る時は自動で合流する
//   ・離れていても、分隊の仲間が倒れるとログに赤字で出る（allies.die）
Game.squad = {
  nextId: 1,

  // 今ある分隊 [{id, info（分隊の共有データ）, members:[仲間], leader}]
  list: function () {
    var map = {};
    var out = [];
    Game.allies.list.forEach(function (a) {
      if (!a.squad) return;
      if (!map[a.squad.id]) {
        map[a.squad.id] = { id: a.squad.id, info: a.squad, members: [] };
        out.push(map[a.squad.id]);
      }
      map[a.squad.id].members.push(a);
    });
    out.forEach(function (sq) {
      sq.leader = sq.members.filter(function (a) { return Game.MONSTERS[a.type].humanoid; })[0] || sq.members[0];
    });
    return out;
  },

  names: function (members) {
    return members.map(function (a) { return a.baseName; }).join("・");
  },

  // 主人公が今いる部屋（通路なら null）
  playerRoom: function () {
    return Game.map.roomAt(Game.player.x, Game.player.y);
  },

  // 主人公と同じ部屋にいるか（＝指示が出せる相手か）
  canOrder: function (a) {
    var room = this.playerRoom();
    return !!room && a.x >= 0 && Game.map.roomAt(a.x, a.y) === room;
  },

  // 仲間の行動（allies.act から）。分隊の子なら動いて true を返す
  act: function (a) {
    if (!a.squad) return false;
    var path = Game.path;
    var info = a.squad;
    var sq = this.list().filter(function (s) { return s.id === info.id; })[0];
    var leader = sq ? sq.leader : a;

    // 1. 見えている一番近い敵へ向かう（隣なら allies.act の方で攻撃済み）
    var target = null, best = 999;
    for (var i = 0; i < Game.enemies.list.length; i++) {
      var e = Game.enemies.list[i];
      if (!Game.fov.canSee(a.x, a.y, e.x, e.y)) continue;
      var d = path.dist(a.x, a.y, e.x, e.y);
      if (d < best) { best = d; target = e; }
    }
    var step = null;
    if (target) {
      step = path.stepToward(a, target.x, target.y);
    } else if (a === leader) {
      // 2. 隊長：行き先の部屋を決めて探索する（着いたら・進めなくなったら次の部屋へ）
      var here = Game.map.roomAt(a.x, a.y);
      if (!info.dest || here === info.dest.room || info.stuck > 4) {
        var rooms = Game.map.rooms.filter(function (r) { return r !== here; });
        if (rooms.length === 0) rooms = Game.map.rooms;
        var r = Game.pick(rooms);
        info.dest = { room: r, x: Math.floor((r.x1 + r.x2) / 2), y: Math.floor((r.y1 + r.y2) / 2) };
        info.stuck = 0;
      }
      step = path.stepToward(a, info.dest.x, info.dest.y);
      if (!step) info.stuck = (info.stuck || 0) + 1;
    } else if (path.dist(a.x, a.y, leader.x, leader.y) > 1) {
      // 3. 隊員：隊長についていく
      step = path.stepToward(a, leader.x, leader.y);
    }
    if (step && Game.map.canStep(a.x, a.y, step[0], step[1]) && path.isFree(a.x + step[0], a.y + step[1])) {
      a.x += step[0];
      a.y += step[1];
    } else if (a === leader && !target) {
      info.stuck = (info.stuck || 0) + 1;
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

  // ---------- 指示のウィンドウ（.キー） ----------
  openMenu: function () {
    var self = this;
    var room = this.playerRoom();
    var options = [];
    var free = Game.allies.list.filter(function (a) { return !a.squad && self.canOrder(a); });
    if (free.some(function (a) { return Game.MONSTERS[a.type].humanoid; })) {
      options.push({ label: "分隊を作って、独立行動させる", onChoose: function () { self.openCreate({}, 0); } });
    }
    this.list().forEach(function (sq) {
      var here = sq.members.some(function (a) { return self.canOrder(a); });
      options.push(here
        ? { label: "分隊" + sq.id + "（" + self.names(sq.members) + "）を呼び戻す", onChoose: function () { self.release(sq.id); } }
        : {
          label: "分隊" + sq.id + "（" + self.names(sq.members) + "）… 別の場所で行動中（同じ部屋で会えば指示できる）",
          keepOpen: true,
          onChoose: function () { Game.log.add("分隊" + sq.id + "には、同じ部屋で会わないと指示が届かない。", "miss"); },
        });
    });
    options.push({ label: "閉じる" });
    Game.dialog.open({
      title: "分隊への指示",
      lines: [
        "人型の仲間を隊長に、最大 " + Game.config.squad.maxMembers + " 体の分隊を作れる。分隊は階を自由に探索して、見つけた敵を倒す。",
        "指示（作る・呼び戻す）は、分隊と同じ部屋にいる時だけ出せる。",
        room ? "" : "※今は部屋の中にいないので、指示は出せない。",
      ].filter(function (t) { return t; }),
      options: options,
    });
  },

  // 隊員を選ぶ（picked = { 仲間の番号: true }）
  openCreate: function (picked, cursor) {
    var self = this;
    var max = Game.config.squad.maxMembers;
    var cands = Game.allies.list.filter(function (a) { return !a.squad && self.canOrder(a); });
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
      label: ready ? "この分隊で独立行動させる" : team.length === 0 ? "（隊員を選んでください）" : "（人型の仲間を1体は入れてください）",
      keepOpen: !ready,
      onChoose: function () {
        if (!ready) return;
        var info = { id: self.nextId++, dest: null, stuck: 0 };
        team.forEach(function (a) { a.squad = info; });
        Game.log.add("分隊" + info.id + "（" + self.names(team) + "）が独立行動を始めた。", "ally");
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
