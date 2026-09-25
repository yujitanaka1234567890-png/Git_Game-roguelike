// 救出システム：倒れた時にはぐれた仲間（その冒険の新入り）を取り戻す。
//   ・倒れる（あきらめる）と、新入りは「はぐれた仲間」として、倒れたダンジョン・階に記録される（Game.base.lost）
//   ・【自分で救出】同じダンジョンの同じ階にたどり着くと、その階に「気配（◇）」が現れる。踏むと仲間に戻る
//     （戻った子はまた新入り扱い。生きて帰れば牧場へ。ただしその冒険でまた倒れたら、2度目は記録されず
//       そのままダンジョンに帰る＝リリース）
//   ・【救出隊】拠点の掲示板から、仲間を最大4体派遣できる（人型 humanoid が1体は必須）。派遣中の子は冒険に連れて行けない。
//     結果は次の冒険から戻った時にわかる。成功ならはぐれた仲間は牧場へ、
//     失敗なら、はぐれた仲間はダンジョンに帰る（＝仲間にならなかったことになる）。隊員は無事に戻る。
Game.rescue = {
  marker: null, // 今の階にいるはぐれた仲間 { recordId, type（見える姿）, x, y, seen }。紫の枠の中にじっと立っている

  // ---------- はぐれた記録 ----------

  // ---------- 記録の期限 ----------
  // はぐれた仲間は、助けられないまま主人公が3回（config.lostDives）ダンジョンに潜ると、ダンジョンへ帰ってしまう。
  // 冒険に出るたびに数え（countDive）、冒険が終わった時に期限切れを消す（expireOld）。

  countDive: function () {
    for (var i = 0; i < Game.base.lost.length; i++) {
      if (!Game.base.lost[i].mission) Game.base.lost[i].dives = (Game.base.lost[i].dives || 0) + 1;
    }
  },

  // 期限切れの記録を消して、結果の文章を返す
  expireOld: function () {
    var self = this;
    var lines = [];
    Game.base.lost = Game.base.lost.filter(function (rec) {
      if (rec.mission || (rec.dives || 0) < Game.config.lostDives) return true;
      lines.push(self.placeName(rec) + " にはぐれていた " + self.memberNames(rec) + " は、待ちきれずにダンジョンへ帰っていった…");
      return false;
    });
    return lines;
  },

  // あと何回の冒険で帰ってしまうか
  divesLeft: function (rec) {
    return Math.max(0, Game.config.lostDives - (rec.dives || 0));
  },

  // 倒れた時：新入りの種類（進化は取り消しなので仲間になった時の姿）を記録する。記録の説明文を返す（なければ null）
  // 一度救出された子（rescued）は記録しない（2度目ははぐれずにダンジョンへ帰る）
  recordLost: function (newcomers) {
    newcomers = newcomers.filter(function (a) { return !a.rescued; });
    if (newcomers.length === 0) return null;
    var base = Game.base;
    var members = newcomers.map(function (a) { return a.origType || a.type; });
    base.lost.push({ id: base.nextId++, dungeonId: Game.dungeonId, floor: Game.floor, members: members, mission: null, dives: 0 });
    var note = "";
    while (base.lost.length > Game.config.lostMax) {
      var gone = base.lost.shift();
      note = "（古い記録の " + this.memberNames(gone) + " は気配が消えてしまった）";
    }
    return Game.currentDungeon().name + " B" + Game.floor + "F に、はぐれた " + this.memberNames(base.lost[base.lost.length - 1]) +
      " の気配が残っている。その階にもう一度たどり着くか、救出隊を送れば取り戻せるかもしれない。" + note;
  },

  memberNames: function (rec) {
    return rec.members.map(function (t) { return Game.MONSTERS[t].name; }).join("・");
  },

  placeName: function (rec) {
    return Game.DUNGEONS[rec.dungeonId].name + " B" + rec.floor + "F";
  },

  // ---------- 自分で救出 ----------

  // 新しい階に入った時：この階に（救出隊を送っていない）はぐれた仲間がいれば、気配を置く
  setupFloor: function () {
    this.marker = null;
    var rec = null;
    for (var i = 0; i < Game.base.lost.length; i++) {
      var r = Game.base.lost[i];
      if (r.dungeonId === Game.dungeonId && r.floor === Game.floor && !r.mission) { rec = r; break; }
    }
    if (!rec) return;
    var start = Game.map.roomAt(Game.map.startX, Game.map.startY);
    var rooms = Game.map.rooms.filter(function (rm) { return rm !== start; });
    for (var tries = 0; tries < 30; tries++) {
      var t = Game.dungeon.randomTileIn(Game.pick(rooms.length > 0 ? rooms : Game.map.rooms));
      if (Game.map.tileAt(t.x, t.y) !== "." || Game.items.at(t.x, t.y) || Game.path.isOccupied(t.x, t.y)) continue;
      this.marker = { recordId: rec.id, type: rec.members[0], x: t.x, y: t.y, seen: false };
      Game.log.add("…この階のどこかに、はぐれた " + this.memberNames(rec) + " の気配を感じる。（紫の枠の中で待っている姿を探そう）", "ally");
      return;
    }
  },

  markerAt: function (x, y) {
    return this.marker && this.marker.x === x && this.marker.y === y ? this.marker : null;
  },

  markSeen: function () {
    if (this.marker && Game.fov.isVisible(this.marker.x, this.marker.y)) this.marker.seen = true;
  },

  // 主人公が (x, y) に乗った時：気配なら、はぐれた仲間が戻ってくる
  checkStep: function (x, y) {
    var m = this.markerAt(x, y);
    if (!m) return;
    this.marker = null;
    var rec = this.takeRecord(m.recordId);
    if (!rec) return;
    Game.log.add("はぐれていた " + this.memberNames(rec) + " を見つけた！", "good");
    Game.sound.play("rescue");
    for (var i = 0; i < rec.members.length; i++) {
      if (!Game.allies.isFull()) Game.allies.join(rec.members[i], x, y).rescued = true;
      else Game.allies.pending.push({ type: rec.members[i], x: x, y: y, rescued: true }); // いっぱいなら入れ替え確認へ
    }
    Game.log.add("（救出した仲間は、この冒険でまた倒れるともう戻らない。生きて連れ帰ろう）", "ally");
    Game.fx.flash(Game.fx.around(x, y, 1), "#66ffee", 600);
    Game.base.save();
  },

  // 記録を取り出して消す
  takeRecord: function (id) {
    var list = Game.base.lost;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list.splice(i, 1)[0];
    }
    return null;
  },

  // ---------- 救出隊 ----------

  // 派遣できる隊員：牧場で派遣中でない子（人型が1体以上いないと派遣できない）
  candidates: function () {
    return Game.base.ranch.filter(function (r) { return !r.onMission; });
  },

  hasHumanoid: function (entries) {
    return entries.some(function (r) { return Game.MONSTERS[r.type].humanoid; });
  },

  // 成功率：隊員が多く・強い（進化段階・レア度が高い）ほど上がり、深い階・難しいダンジョンほど下がる
  successChance: function (rec, teamEntries) {
    var cfg = Game.config.rescue;
    var c = cfg.base;
    for (var i = 0; i < teamEntries.length; i++) {
      var t = Game.MONSTERS[teamEntries[i].type];
      c += (t.humanoid ? cfg.perMember : cfg.perNonHumanoid) + cfg.perStage * ((t.stage || 1) - 1) + cfg.perRarity * t.rarity;
    }
    c -= cfg.perFloor * (rec.floor - 1);
    c -= Game.DUNGEONS[rec.dungeonId].rescueDifficulty || 0;
    return Math.max(cfg.min, Math.min(cfg.max, c));
  },

  // 派遣する（牧場の隊員に「派遣中」の印をつける。連れて行く予定だった子は外す）
  dispatch: function (rec, teamIds) {
    var base = Game.base;
    var team = teamIds.map(function (id) { return base.ranchEntry(id); }).filter(Boolean);
    rec.mission = { team: teamIds.slice(), chance: this.successChance(rec, team) };
    for (var i = 0; i < team.length; i++) {
      team[i].onMission = rec.id;
      delete base.selected[team[i].id];
    }
    base.save();
  },

  // 冒険から戻った時：派遣中の救出隊の結果を決める。結果の文章の配列を返す
  resolveMissions: function () {
    var base = Game.base;
    var lines = [];
    var self = this;
    base.lost.slice().forEach(function (rec) {
      if (!rec.mission) return;
      var teamNames = rec.mission.team
        .map(function (id) { return base.ranchEntry(id); })
        .filter(Boolean)
        .map(function (r) { return Game.MONSTERS[r.type].name; });
      // 隊員は必ず無事に戻る
      base.ranch.forEach(function (r) { if (r.onMission === rec.id) delete r.onMission; });
      self.takeRecord(rec.id);
      if (Math.random() < rec.mission.chance) {
        var saved = [], full = [];
        rec.members.forEach(function (t) {
          if (base.addToRanch(t)) saved.push(Game.MONSTERS[t].name);
          else full.push(Game.MONSTERS[t].name);
        });
        lines.push("救出隊（" + teamNames.join("・") + "）が " + self.placeName(rec) + " から " + saved.join("・") + " を連れ帰った！");
        if (full.length > 0) lines.push("牧場がいっぱいで " + full.join("・") + " は受け入れられなかった…");
      } else {
        lines.push("救出隊（" + teamNames.join("・") + "）は " + self.placeName(rec) + " で " + self.memberNames(rec) +
          " を見つけられなかった… " + self.memberNames(rec) + " はダンジョンに帰っていった。");
      }
    });
    if (lines.length > 0) base.save();
    return lines;
  },

  // ---------- 拠点の掲示板 ----------

  openBoard: function () {
    var self = this;
    var base = Game.base;
    if (base.lost.length === 0) {
      Game.dialog.open({ title: "救出の掲示板", lines: ["今、はぐれている仲間はいない。"], options: [{ label: "閉じる" }] });
      return;
    }
    var options = base.lost.map(function (rec) {
      if (rec.mission) {
        return {
          label: self.placeName(rec) + "：" + self.memberNames(rec) + "　【救出隊 派遣中・成功率 " + Math.round(rec.mission.chance * 100) + "%】",
          keepOpen: true,
          onChoose: function () { Game.log.add("救出隊の帰りを待とう。結果は次の冒険から戻った時にわかる。"); },
        };
      }
      return {
        label: self.placeName(rec) + "：" + self.memberNames(rec) + "　（あと " + self.divesLeft(rec) + " 回の冒険で帰ってしまう）",
        onChoose: function () { self.openTeamSelect(rec, {}); },
      };
    });
    options.push({ label: "閉じる" });
    Game.dialog.open({
      title: "救出の掲示板",
      lines: [
        "はぐれた仲間は、その階に自分でたどり着けば取り戻せる。助けないまま " + Game.config.lostDives + " 回冒険に出ると、ダンジョンへ帰ってしまう。",
        "仲間を最大4体（★人型が1体は必須）救出隊として送ることもできる（失敗すると、はぐれた仲間はダンジョンに帰ってしまう）。",
      ],
      options: options,
    });
  },

  // 隊員を選ぶ（picked = 選んだ牧場ID { id: true }）
  openTeamSelect: function (rec, picked, cursor) {
    var self = this;
    var base = Game.base;
    var cands = this.candidates();
    if (!this.hasHumanoid(cands)) {
      Game.dialog.open({
        title: "救出隊",
        lines: ["救出隊には、人型（人形系など）の仲間が1体は必要。牧場にまだいない（または全員出かけている）。"],
        options: [{ label: "戻る", onChoose: function () { self.openBoard(); } }],
      });
      return;
    }
    var team = cands.filter(function (r) { return picked[r.id]; });
    var chance = this.successChance(rec, team);
    var ready = team.length > 0 && this.hasHumanoid(team);
    var options = cands.map(function (r, idx) {
      var t = Game.MONSTERS[r.type];
      return {
        label: (picked[r.id] ? "【派遣】" : "　　　　") + t.symbol + " " + t.name + "（" + Game.enemies.rarityOf(r.type).label + "）" +
          (t.humanoid ? "　★人型" : ""),
        keepOpen: true,
        onChoose: function () {
          if (picked[r.id]) delete picked[r.id];
          else if (team.length < Game.config.rescue.maxTeam) picked[r.id] = true;
          else Game.log.add("救出隊は " + Game.config.rescue.maxTeam + " 体までだ。", "miss");
          self.openTeamSelect(rec, picked, idx);
        },
      };
    });
    options.push({
      label: ready
        ? "この隊で派遣する（成功率 " + Math.round(chance * 100) + "%）"
        : team.length === 0 ? "（隊員を選んでください）" : "（人型の仲間を1体は入れてください）",
      keepOpen: !ready,
      onChoose: function () {
        if (!ready) return;
        self.dispatch(rec, team.map(function (r) { return r.id; }));
        Game.baseScene.syncMonsters();
        Game.log.add(team.map(function (r) { return Game.MONSTERS[r.type].name; }).join("・") +
          " が " + self.placeName(rec) + " へ救出に向かった。結果は次の冒険から戻った時にわかる。", "ally");
      },
    });
    options.push({ label: "やめる" });
    Game.dialog.open(
      {
        title: "救出隊：" + self.placeName(rec) + " の " + self.memberNames(rec),
        lines: [
          "派遣する仲間を選ぶ（最大 " + Game.config.rescue.maxTeam + " 体。★人型が1体は必要）。派遣中の子は冒険に連れて行けない。",
          "失敗すると、はぐれた仲間はダンジョンに帰ってしまう（隊員は無事に戻る）。",
        ],
        options: options,
      },
      cursor || 0
    );
  },
};
