// ゲームの起動とターン進行。各部品をつなぐ役。
// 画面の状態（Game.state）：
//   "base"（拠点を歩いている） / "playing"（ダンジョン探索中） / "menu"（持ち物を開いている）
//   "aim"（投げる方向を選んでいる） / "animating"（投げたアイテムが飛んでいる） / "gameover"（倒れた）
// これとは別に、選択ウィンドウ（dialog.js）が開いている間は、どの状態でもウィンドウの操作が優先される。
Game.turn = 0;
Game.floor = 1; // 今いる階（B1F = 1）
Game.state = "base";

// ---------- 画面の更新 ----------

// 画面上部の表示（階・Lv・HPバー・攻撃力・ターン）と、一時メッセージを更新する
Game.updateStatus = function (message) {
  var p = Game.player;
  var ratio = p.hp / p.maxHp;
  var fill = document.getElementById("hp-fill");
  fill.style.width = ratio * 100 + "%";
  fill.className = ratio > 0.5 ? "" : ratio > 0.25 ? "warn" : "danger";
  document.getElementById("hud-floor").textContent =
    Game.state === "base"
      ? "拠点"
      : Game.currentDungeon().name + " B" + Game.floor + "F / B" + Game.currentDungeon().floors + "F";
  document.getElementById("hud-hp").textContent = p.hp + " / " + p.maxHp;
  document.getElementById("hud-lv").textContent =
    "Lv" + p.level + "（経験 " + p.exp + " / " + p.expForLevel(p.level + 1) + "）";
  document.getElementById("hud-atk").textContent = "攻撃力 " + p.atk;
  var mindRatio = p.mind / p.maxMind;
  var mfill = document.getElementById("mind-fill");
  mfill.style.width = mindRatio * 100 + "%";
  mfill.className = mindRatio > 0.5 ? "" : mindRatio > 0.25 ? "warn" : "danger";
  document.getElementById("hud-mind").textContent = p.mind + " / " + p.maxMind;
  document.getElementById("hud-turn").textContent = "ターン " + Game.turn;
  // ボスがいればボスの体力を表示
  var bossRow = document.getElementById("hud-boss");
  var boss = Game.state === "base" ? null : Game.enemies.boss();
  bossRow.hidden = !boss;
  if (boss) {
    bossRow.innerHTML = "";
    var nm = document.createElement("span");
    nm.textContent = "ボス " + boss.name;
    var bar = document.createElement("div");
    bar.className = "boss-bar";
    var bf = document.createElement("div");
    bf.className = "boss-fill";
    bf.style.width = (boss.hp / boss.maxHp) * 100 + "%";
    bar.appendChild(bf);
    var num = document.createElement("span");
    num.textContent = boss.hp + "/" + boss.maxHp;
    bossRow.appendChild(nm);
    bossRow.appendChild(bar);
    bossRow.appendChild(num);
  }
  document.getElementById("status").textContent = message || "";
};

Game.refresh = function (message) {
  Game.fov.update();
  Game.items.markSeen();
  Game.rescue.markSeen();
  Game.updateStatus(message);
  Game.bestiary.observe(); // 見えているモンスターを図鑑に載せる
  Game.music.update(); // ボスがいればボス戦の曲を流す
  Game.log.render();
  if (Game.state === "base") Game.base.renderPartyPanel();
  else Game.allies.render();
  Game.inventory.render();
  Game.dialog.render();
  Game.renderer.draw();
};

// 行動が終わった後に呼ぶ：仲間の入れ替え確認が待っていれば確認ウィンドウを出す
Game.afterAction = function () {
  if (Game.state === "playing" && Game.allies.pending.length > 0 && !Game.dialog.isOpen()) {
    Game.allies.openRecruitDialog(Game.afterAction); // 選び終わったら、次の候補がいればまた開く
  }
  Game.refresh();
};

// ---------- 入力 ----------

// 階段・R キーの「2回押し」確認待ち
Game.stairsPending = false;
Game.giveUpPending = false;

// 方向キー・スペース（isRepeat：押しっぱなしによる連続入力か）
Game.onPlayerMove = function (dx, dy, isRepeat) {
  if (Game.dialog.isOpen()) {
    if (dx === 0 && dy !== 0) Game.dialog.move(dy);
    else if (dx === 0 && dy === 0 && !isRepeat) Game.dialog.choose(); // スペースで決定
    Game.refresh();
    return;
  }
  if (Game.state === "base") {
    if (dx !== 0 || dy !== 0) Game.baseScene.move(dx, dy);
    Game.refresh();
    return;
  }
  if (Game.state === "menu") {
    // 持ち物メニュー中は ↑↓ でカーソル移動
    if (dx === 0 && dy !== 0) {
      Game.inventory.moveCursor(dy);
      Game.refresh();
    }
    return;
  }
  if (Game.state === "aim") {
    if (dx !== 0 || dy !== 0) Game.throwSelectedItem(dx, dy);
    return;
  }
  if (Game.state !== "playing" || Game.dashing) return;
  // 押しっぱなしで歩いている時、ダメージを受けた直後は少しの間止める（被弾に気づけるように）
  if (isRepeat && Date.now() < Game.hitPauseUntil) return;
  Game.giveUpPending = false;

  // 階段の上で、その階段の方向キー → 1回目は確認、2回目で使う
  var st = Game.player.stairsHere();
  if (st && dx === st.dir[0] && dy === st.dir[1]) {
    if (isRepeat) return; // 押しっぱなしで勝手に使わないように
    if (Game.stairsPending) {
      Game.stairsPending = false;
      Game.useStairs(st);
    } else {
      Game.stairsPending = true;
      Game.refresh("もう一度 " + st.key + " で" + st.verb + "（他の方向キーで取り消し）");
    }
    return;
  }

  Game.stairsPending = false;
  Game.playTurn(dx, dy);
};

// 方向キー・スペース以外のキー
Game.onKey = function (key) {
  var lower = key.length === 1 ? key.toLowerCase() : key;

  // V：ドット絵／文字表示の切り替え、M：効果音のオン／オフ（いつでも使える）
  if (lower === "v") {
    Game.refresh(Game.pixel.toggle() ? "表示：ドット絵" : "表示：文字");
    return;
  }
  if (lower === "3") {
    Game.refresh(Game.view3d.toggle());
    return;
  }
  // N：全体マップの大きさ（3D表示の時）、＋／－：カメラを寄せる・引く（3D表示の時）
  if (lower === "n") {
    Game.refresh(Game.minimap.cycle());
    return;
  }
  if (key === "+" || key === ";" || key === "=" || key === "-") {
    Game.refresh(Game.view3d.zoomBy(key === "-" ? 1 : -1));
    return;
  }
  // .（ドット）：分隊への指示（ダンジョンで、ウィンドウが開いていない時）
  if (key === "." && Game.state === "playing" && !Game.dialog.isOpen()) {
    Game.squad.openMenu();
    Game.refresh();
    return;
  }
  if (lower === "m") {
    Game.refresh(Game.sound.toggle() ? "効果音：オン" : "効果音：オフ");
    return;
  }

  if (Game.dialog.isOpen()) {
    if (key === "Enter") Game.dialog.choose();
    else if (key === "Escape") Game.dialog.cancel();
    Game.refresh();
    return;
  }

  if (Game.state === "base") return;

  if (Game.state === "gameover") {
    if (key === "Enter" || lower === "r") Game.showBase();
    return;
  }

  if (Game.state === "playing" && !Game.dashing) {
    if (lower === "i") {
      Game.state = "menu";
      Game.inventory.open = true;
      Game.stairsPending = false;
      Game.giveUpPending = false;
      Game.refresh();
    } else if (lower === "r") {
      // 冒険をあきらめる（2回押しで確定。倒れた時と同じ扱い）
      if (Game.giveUpPending) {
        Game.giveUpPending = false;
        Game.log.add("冒険をあきらめた…", "bad");
        Game.onDeath("冒険をあきらめて、拠点へ戻った。");
        Game.showBase();
      } else {
        Game.giveUpPending = true;
        Game.refresh("もう一度 R で冒険をあきらめて拠点へ戻る（倒れた時と同じく、新しい仲間と持ち物は失われる）");
      }
    }
    return;
  }

  if (Game.state === "menu") {
    if (key === "Escape" || lower === "i") Game.closeMenu();
    else if (key === "Enter" || lower === "z") Game.useSelectedItem();
    else if (lower === "d") Game.dropSelectedItem();
    else if (lower === "t" && Game.inventory.items.length > 0) {
      // 投げる方向の選択へ（アイテムはまだ持ち物に残しておく）
      Game.state = "aim";
      Game.inventory.open = false;
      Game.refresh(Game.aimMessage());
    }
    return;
  }

  if (Game.state === "aim" && key === "Escape") {
    // 取り消してメニューに戻る
    Game.state = "menu";
    Game.inventory.open = true;
    Game.refresh();
  }
};

// ---------- ターン進行 ----------

// 主人公が1歩動く（または足踏み）1ターン。
// 壁に向かって進もうとした場合も、その場で足踏みしたことになり1ターン進む
Game.playTurn = function (dx, dy) {
  if (dx !== 0 || dy !== 0) Game.player.tryMove(dx, dy);
  Game.endTurn();
  Game.afterAction();
};

// 主人公の行動の後始末：仲間全員の行動 → 敵全員の行動 → ターン経過 → 自然回復 → 精神力 → 敵の湧き直し → 死亡判定
// （移動・アイテム使用など、ターンを使う行動は必ずこれを呼ぶ）
Game.endTurn = function () {
  Game.player.wasHit = false;
  Game.allies.takeTurn();
  Game.enemies.takeTurn();
  Game.turn++;
  Game.player.regen(Game.turn);
  Game.allies.regen(Game.turn);
  Game.mind.tick();
  Game.enemies.tryRespawn();
  var byMind = false;
  if (Game.mind.isGone() && Game.player.hp > 0) {
    // 精神力が0の間は、闇に心身をむしばまれて毎ターンダメージ。0が続くと zeroDoubleEvery ターンごとに倍になる
    var dmg = Math.min(Game.mind.zeroDamage(), Game.player.hp);
    Game.player.hp -= dmg;
    Game.player.wasHit = true;
    Game.log.add("闇が心身をむしばむ… " + dmg + " のダメージ（精神力が0。" + Game.config.mind.zeroDoubleEvery + "ターンごとに倍になる）", "bad");
    byMind = Game.player.hp <= 0;
  }
  if (Game.player.wasHit) Game.hitPauseUntil = Date.now() + Game.config.hitPauseMs;
  if (Game.player.hp <= 0) {
    Game.log.add("あなたは B" + Game.floor + "F で倒れた… Enter で拠点へ戻る", "bad");
    Game.onDeath(byMind
      ? "B" + Game.floor + "F で精神力が尽き、闇にむしばまれて倒れてしまった…"
      : "B" + Game.floor + "F で倒れてしまった…");
  }
};

// 倒れた（またはあきらめた）時：この冒険で仲間になった子は「はぐれた仲間」になり、持ち物は失われる。
// はぐれた仲間は、その階に自分でたどり着くか救出隊を送れば取り戻せる（rescue.js）。
// 拠点から連れてきた子は牧場にいるまま。この冒険中の進化は取り消し（牧場の記録は書き換えていない）
Game.onDeath = function (headline) {
  Game.sound.play("gameover");
  Game.state = "gameover";
  Game.dashToken++;
  Game.dialog.close();
  var newcomers = Game.allies.list.filter(function (a) { return !a.fromBase; });
  // 進化は取り消しなので、仲間になった時の姿の名前で表示する
  // （一度救出した子は「はぐれる」のではなくダンジョンに帰るので、ここには含めない）
  var lost = newcomers.filter(function (a) { return !a.rescued; }).map(function (a) { return Game.MONSTERS[a.origType || a.type].name; });
  var revoked = Game.allies.list.filter(function (a) {
    return a.fromBase && Game.base.ranchEntry(a.ranchId) && Game.base.ranchEntry(a.ranchId).type !== a.type;
  });
  if (lost.length > 0) Game.log.add("新しい仲間たちは散り散りになってしまった…", "bad");
  Game.allies.clear();
  var lines = [headline];
  var missionLines = Game.rescue.resolveMissions().concat(Game.rescue.expireOld()); // 救出隊の結果と期限切れ（新しい記録を足す前に）
  var lostNote = Game.rescue.recordLost(newcomers);
  lines.push(lost.length > 0 ? "この冒険で仲間になった " + lost.join("・") + " とはぐれてしまった…" : "はぐれた仲間はいない。");
  if (lostNote) lines.push(lostNote);
  var released = newcomers.filter(function (a) { return a.rescued; }).map(function (a) { return Game.MONSTERS[a.origType || a.type].name; });
  if (released.length > 0) lines.push("一度救出した " + released.join("・") + " は、2度目は戻らずダンジョンに帰っていった…");
  if (revoked.length > 0) {
    lines.push(revoked.map(function (a) { return a.baseName; }).join("・") + " は元の姿に戻ってしまった…（進化は取り消し）");
  }
  if (Game.inventory.items.length > 0) lines.push("持ち物はすべて失った。");
  Game.inventory.clear();
  Game.base.save();
  Game.base.keepLastLog(Game.log.lines); // なぜ倒れたのか、拠点に戻ってからも読めるように
  Game.base.lastResult = { kind: "death", lines: lines.concat(missionLines) };
};

// 生きて拠点に帰る（脱出口・帰還の鈴）：新しい仲間は牧場へ、持ち物は倉庫へ。
// この冒険中の進化はここで確定する（拠点から連れてきた子は牧場の記録を進化後の種類に書き換える）。
// cleared = 脱出口から出た（そのダンジョンを踏破した）
Game.escapeDungeon = function (headline, cleared) {
  Game.dashToken++;
  Game.sound.play("escape");
  var lines = [headline];
  var newcomers = Game.allies.list.filter(function (a) { return !a.fromBase; });
  var veterans = Game.allies.list.filter(function (a) { return a.fromBase; });
  var brought = [], full = [];
  for (var i = 0; i < newcomers.length; i++) {
    if (Game.base.addToRanch(newcomers[i].type)) brought.push(newcomers[i].baseName);
    else full.push(newcomers[i].baseName);
  }
  if (brought.length > 0) lines.push("新しい仲間 " + brought.join("・") + " を牧場に連れ帰った！");
  if (full.length > 0) lines.push("牧場がいっぱいで " + full.join("・") + " は連れ帰れなかった…");
  for (var v = 0; v < veterans.length; v++) {
    var entry = Game.base.ranchEntry(veterans[v].ranchId);
    if (entry && entry.type !== veterans[v].type) {
      lines.push(Game.MONSTERS[entry.type].name + " は " + veterans[v].baseName + " に進化した姿で帰ってきた！");
      entry.type = veterans[v].type;
    }
  }
  if (veterans.length > 0) lines.push(veterans.map(function (a) { return a.baseName; }).join("・") + " も一緒に帰ってきた。");
  if (cleared) {
    var opened = Game.base.markCleared(Game.dungeonId);
    for (var o = 0; o < opened.length; o++) {
      lines.push("新しいダンジョン「" + Game.DUNGEONS[opened[o]].name + "」への道が開けた！");
    }
  }

  var carried = Game.inventory.items.slice();
  var overflow = Game.base.storeItems(carried);
  if (carried.length > 0) lines.push("持ち物 " + (carried.length - overflow.length) + " 個を倉庫にしまった。");
  if (overflow.length > 0) lines.push("倉庫がいっぱいで " + overflow.join("・") + " は置いてきた…");

  lines = lines.concat(Game.rescue.resolveMissions(), Game.rescue.expireOld()); // 救出隊の結果と期限切れ
  Game.allies.clear();
  Game.inventory.clear();
  Game.base.save();
  Game.base.lastResult = { kind: "escape", lines: lines };
  Game.showBase();
};

// ---------- 階段 ----------

Game.useStairs = function (st) {
  if (st.action === "descend") Game.descend();
  else if (st.action === "escape" && Game.enemies.boss()) {
    Game.refresh("「" + Game.enemies.boss().name + "」がいる間は帰れない！");
  } else if (st.action === "escape") {
    Game.escapeDungeon(Game.currentDungeon().name + " B" + Game.floor + "F の脱出口から脱出した！ ダンジョン踏破！", true);
  }
  // 将来：if (st.action === "ascend") Game.ascend();
};

Game.descend = function () {
  Game.sound.play("stairs");
  Game.floor++;
  Game.enterFloor();
  Game.mind.onNewFloor(true); // 新しい空気で精神力が少し回復
  Game.log.add("B" + Game.floor + "F に降りた。", "good");
  if (Game.floor >= Game.currentDungeon().floors) Game.log.add("この階のどこかに脱出口（◎）がある。", "good");
  Game.refresh();
};

// ---------- ダッシュ ----------
// 同じ方向へ1ターンずつ自動で進み続ける（1歩ごとに敵も動く）。仲間がいたら位置を入れ替えて進む。
// 止まる条件：Shift を離した ／ 前が壁 ／ 前に敵 ／ 隣に敵が来た ／ 新しい敵が見えた ／
//             新しく通路（分かれ道・部屋の出入口）が隣に現れた ／ 部屋の出入口に着いた ／
//             階段に乗った ／ アイテムに乗った ／ 確認画面が出た ／ ゲームオーバー
// ダメージを受けても止まらないが、次の1歩まで hitPauseMs だけ間をあける（被弾に気づけるように）
Game.dashing = false;
Game.dashToken = 0; // 拠点へ戻る・階移動の時に、古いダッシュや投げアニメを確実に止めるための番号
Game.hitPauseUntil = 0; // この時刻（ミリ秒）までは、押しっぱなしの移動を受け付けない（被弾した直後）

Game.startDash = function (dx, dy) {
  if (Game.state !== "playing" || Game.dashing || Game.dialog.isOpen()) return;
  if (!Game.canDashStep(dx, dy)) {
    Game.refresh("そこへは進めない");
    return;
  }
  Game.dashing = true;
  Game.stairsPending = false;
  Game.giveUpPending = false;
  Game.dashStep(dx, dy, Game.dashToken);
};

// 次の1歩を進めるか（壁・敵がいたら不可。仲間なら入れ替えて進む。ダッシュでは攻撃はしない）
Game.canDashStep = function (dx, dy) {
  var p = Game.player;
  return Game.map.canStep(p.x, p.y, dx, dy) && !Game.enemies.at(p.x + dx, p.y + dy);
};

// マス (x, y) の種類：部屋の中 "room" ／ 部屋の出入口 "door" ／ 通路 "corr"
Game.placeKind = function (x, y) {
  var r = Game.map.roomAt(x, y);
  if (!r) return "corr";
  return x < r.x1 || x > r.x2 || y < r.y1 || y > r.y2 ? "door" : "room";
};

// (x, y) の周り8マスのうち、通路・出入口になっているマス（進む方向の1マス先と、来た方向の1マスは除く）
Game.dashOpenings = function (x, y, dx, dy) {
  var set = {};
  for (var i = 0; i < Game.DIRS8.length; i++) {
    var d = Game.DIRS8[i];
    if ((d[0] === dx && d[1] === dy) || (d[0] === -dx && d[1] === -dy)) continue;
    var nx = x + d[0], ny = y + d[1];
    if (!Game.map.isWalkable(nx, ny)) continue;
    if (Game.placeKind(nx, ny) !== "room") set[nx + "," + ny] = true;
  }
  return set;
};

Game.dashStep = function (dx, dy, token) {
  if (token !== Game.dashToken) return;
  var p = Game.player;
  var seenBefore = Game.enemies.visibleCount();
  var bagBefore = Game.inventory.items.length;
  var alliesBefore = Game.allies.list.length;
  var openBefore = Game.dashOpenings(p.x, p.y, dx, dy);
  Game.playTurn(dx, dy);
  var openAfter = Game.dashOpenings(p.x, p.y, dx, dy);
  var newOpening = Object.keys(openAfter).some(function (k) { return !openBefore[k]; });
  var stop =
    Game.state !== "playing" ||
    Game.dialog.isOpen() ||
    !Game.input.shiftHeld ||
    Game.enemies.visibleCount() > seenBefore ||
    newOpening || // 分かれ道・出入口が隣に現れた
    Game.placeKind(p.x, p.y) === "door" || // 部屋の出入口に着いた
    p.onStairs() ||
    Game.items.at(p.x, p.y) || // 拾えなかったアイテムの上
    Game.allies.list.length !== alliesBefore || // はぐれた仲間を救出した・仲間が倒れた
    Game.inventory.items.length !== bagBefore || // アイテムを拾った
    Game.enemies.adjacentTo(p.x, p.y) ||
    !Game.canDashStep(dx, dy);
  if (stop) {
    Game.dashing = false;
    return;
  }
  // ダメージを受けた直後は、次の1歩まで長めに間をあける
  setTimeout(function () {
    Game.dashStep(dx, dy, token);
  }, p.wasHit ? Game.config.hitPauseMs : Game.config.dashDelay);
};

// ---------- 持ち物 ----------

Game.closeMenu = function () {
  Game.state = "playing";
  Game.inventory.open = false;
  Game.refresh();
};

Game.aimMessage = function () {
  var t = Game.items.types[Game.inventory.selectedEntry().type];
  return t.name + "を投げる方向は？（矢印／Shift＋矢印2つで斜め／Esc で戻る）";
};

// 選んだアイテムを使う（1ターン消費）。使ってもなくならない物（リボルバートイ等）は持ち物に残る
Game.useSelectedItem = function () {
  var entry = Game.inventory.selectedEntry();
  if (!entry) return;
  Game.inventory.open = false;
  Game.state = "playing";
  var consumed = Game.items.use(entry);
  if (Game.state === "base") return; // 帰還の鈴で拠点に帰った
  if (consumed) Game.inventory.removeEntry(entry);
  Game.endTurn();
  Game.afterAction();
};

// 選んだアイテムを (dx, dy) 方向へ投げる（1ターン消費）
Game.throwSelectedItem = function (dx, dy) {
  var entry = Game.inventory.takeSelected();
  if (!entry) return;
  Game.state = "animating"; // 飛んでいる間は操作を受け付けない
  Game.refresh();
  Game.throwing.start(entry, dx, dy, function () {
    Game.state = "playing";
    Game.endTurn();
    Game.afterAction();
  });
};

// 選んだアイテムを足元に置く（1ターン消費）。階段や他のアイテムの上には置けない
Game.dropSelectedItem = function () {
  var p = Game.player;
  if (Game.inventory.items.length === 0) return;
  if (Game.items.at(p.x, p.y) || p.onStairs()) {
    Game.refresh("ここには置けない");
    return;
  }
  var dropped = Game.inventory.takeSelected();
  Game.items.place(p.x, p.y, dropped);
  Game.log.add(Game.items.displayName(dropped) + "を足元に置いた。");
  Game.inventory.open = false;
  Game.state = "playing";
  Game.endTurn();
  Game.afterAction();
};

// ---------- 拠点・冒険の開始 ----------

// 拠点に入る：拠点のマップを歩ける状態にし、直前の冒険の結果があればウィンドウで見せる
Game.showBase = function () {
  Game.state = "base";
  Game.dashing = false;
  Game.dashToken++;
  Game.fx.clear();
  Game.throwing.projectile = null;
  Game.rescue.marker = null;
  Game.enemies.list = [];
  Game.items.floorItems = [];
  Game.allies.clear();
  Game.inventory.clear();
  Game.base.tidy();
  Game.fov.revealAll = true;
  Game.baseScene.enter();
  document.body.classList.add("in-base");

  Game.log.clear();
  // 倒れた冒険のログを下（古い側）に残しておく
  var prev = Game.base.lastLog;
  if (prev && prev.length > 0) {
    for (var p = 0; p < prev.length; p++) Game.log.add(prev[p].text, prev[p].type, prev[p].meta);
    Game.log.add("―――― ここから下は、倒れた冒険のログ（次の冒険に出るまで残る） ――――", "warn");
  }
  Game.log.add("拠点に戻ってきた。");
  var res = Game.base.lastResult;
  if (res) {
    for (var i = 0; i < res.lines.length; i++) {
      Game.log.add(res.lines[i], res.kind === "death" ? "bad" : res.kind === "escape" ? "good" : "info");
    }
    Game.dialog.open({
      title: res.kind === "escape" ? "おかえりなさい！" : res.kind === "death" ? "冒険の結果" : "拠点",
      lines: res.lines,
      options: [{ label: "OK" }],
    });
    Game.base.lastResult = null;
  }
  Game.refresh();
  document.getElementById("game").focus();
};

// 拠点から出発：選んだ仲間（Lv1で作り直す）と、倉庫から選んだ持ち物を持ってB1Fへ
Game.startAdventure = function (dungeonId) {
  Game.dungeonId = dungeonId || "beginnerCave";
  Game.rescue.countDive(); // はぐれた仲間の期限を1つ進める
  var party = Game.base.partyEntries();
  var items = Game.base.takeItemsOut();
  document.body.classList.remove("in-base");
  Game.fov.revealAll = false;
  Game.turn = 0;
  Game.floor = 1;
  Game.state = "playing";
  Game.stairsPending = false;
  Game.giveUpPending = false;
  Game.allies.clear();
  for (var i = 0; i < party.length; i++) {
    Game.allies.list.push(Game.allies.create(party[i].type, -1, -1, party[i].id));
  }
  Game.enterFloor();
  Game.player.init(Game.map.startX, Game.map.startY);
  Game.inventory.clear();
  for (var j = 0; j < items.length; j++) Game.inventory.add(items[j]);
  Game.base.keepLastLog(null);
  Game.log.clear();
  Game.log.add(Game.currentDungeon().name + "に入った。（全" + Game.currentDungeon().floors + "階）");
  if (party.length > 0) {
    Game.log.add(party.map(function (r) { return Game.enemies.types[r.type].name; }).join("・") + " が一緒だ。", "good");
  }
  Game.refresh();
  document.getElementById("game").focus();
};

// 新しい階を作って主人公・仲間・敵・アイテムを配置する（仲間は全員ついてくる）
Game.enterFloor = function () {
  Game.dashing = false;
  Game.dashToken++;
  Game.stairsPending = false;
  Game.fx.clear();
  Game.mind.onNewFloor(false);
  Game.map.generate(Game.floor);
  Game.fov.reset();
  Game.renderer.init();
  Game.player.placeAt(Game.map.startX, Game.map.startY);
  Game.enemies.init(Game.map.enemySpawns, Game.floor);
  Game.items.init(Game.map.itemSpawns);
  Game.enemies.spawnBoss(); // 最下層ならボスを置く
  Game.allies.placeNear(Game.player.x, Game.player.y);
  Game.rescue.setupFloor(); // はぐれた仲間がいる階なら気配を置く
};

Game.start = function () {
  Game.pixel.init();
  Game.view3d.init();
  Game.minimap.init();
  Game.sound.init();
  Game.input.init(Game.onPlayerMove, Game.startDash, Game.onKey);
  Game.base.load();
  Game.base.loadLastLog();
  Game.showBase();
};

Game.start();
