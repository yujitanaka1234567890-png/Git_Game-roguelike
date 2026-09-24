// モンスター図鑑（管理者用）の表示と、図鑑データの設定ミスのチェック。
// ゲーム本体には影響しない（このページだけで動く）。
(function () {
  var M = Game.MONSTERS, S = Game.SKILLS, D = Game.DUNGEONS, B = Game.BREEDING, W = Game.WORLDS, DR = Game.DIMENSION_RULES;
  var R = Game.config.rarities;
  var content = document.getElementById("content");
  var checks = [];

  // ---------- 便利関数 ----------
  function stats(id) {
    var t = M[id], mul = R[t.rarity] ? R[t.rarity].mul : 1;
    return {
      hp: Math.round(t.hp * mul), atk: Math.round(t.atk * mul),
      def: Math.round(t.def * mul), exp: Math.round(t.exp * mul),
    };
  }
  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function table(headers, rows) {
    var t = el("table");
    var tr = el("tr");
    headers.forEach(function (h) { tr.appendChild(el("th", h)); });
    t.appendChild(tr);
    rows.forEach(function (row) {
      var r = el("tr");
      row.forEach(function (cell) {
        var td = el("td");
        if (cell instanceof Node) td.appendChild(cell);
        else if (cell && typeof cell === "object") {
          td.textContent = cell.text;
          if (cell.cls) td.className = cell.cls;
          if (cell.color) td.style.color = cell.color;
        } else td.textContent = cell === undefined ? "" : cell;
        r.appendChild(td);
      });
      t.appendChild(r);
    });
    return t;
  }
  function tags(list, cls) {
    var span = el("span");
    list.forEach(function (x) { span.appendChild(el("span", x, "tag" + (cls ? " " + cls : ""))); });
    return span;
  }
  function name(id) { return M[id] ? M[id].name : "【存在しない:" + id + "】"; }
  // ドット絵を3倍に拡大して表示する（ゲームの pixelart.js と同じ色の決め方）
  function shade(hex, amt) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var t = amt < 0 ? 0 : 255, f = Math.abs(amt);
    return "rgb(" + Math.round(r + (t - r) * f) + "," + Math.round(g + (t - g) * f) + "," + Math.round(b + (t - b) * f) + ")";
  }
  function spriteCanvas(spriteName, overlayName, color, fallback) {
    var rows = (Game.SPRITES || {})[spriteName];
    if (!rows) return el("span", fallback, "sym");
    var cv = el("canvas");
    var n = rows.length, px = n === 16 ? 3 : 4; // 16×16 は 48px、12×12 も 48px で見せる
    cv.width = n * px;
    cv.height = n * px;
    cv.style.background = "#222";
    var ctx = cv.getContext("2d");
    var pal = { a: color, b: shade(color, -0.35), c: shade(color, 0.45), d: shade(color, -0.6), e: shade(color, 0.75) };
    var paint = function (grid) {
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var ch = (grid[y] || "")[x];
        if (!ch || ch === ".") continue;
        ctx.fillStyle = pal[ch] || Game.SPRITE_COLORS[ch] || color;
        ctx.fillRect(x * px, y * px, px, px);
      }
    };
    paint(rows);
    if (overlayName && Game.SPRITE_OVERLAYS[overlayName]) paint(Game.SPRITE_OVERLAYS[overlayName]);
    return cv;
  }
  function check(level, msg) { checks.push({ level: level, msg: msg }); }

  // ---------- 入手方法を集計 ----------
  var howToGet = {}; // id -> [文字列]
  function addHow(id, text) { (howToGet[id] = howToGet[id] || []).push(text); }
  Object.keys(D).forEach(function (did) {
    D[did].spawns.forEach(function (s) {
      addHow(s.type, D[did].name + " B" + s.from + "F〜" + (s.to ? "B" + s.to + "F" : ""));
    });
  });
  Object.keys(M).forEach(function (id) {
    if (M[id].evolvesTo) addHow(M[id].evolvesTo, name(id) + " がLv" + M[id].evolveLevel + "で進化");
  });
  B.forEach(function (r) { addHow(r.child, "交配：" + name(r.parents[0]) + " × " + name(r.parents[1])); });
  Object.keys(D).forEach(function (did) { if (D[did].boss) addHow(D[did].boss, "ボス：" + D[did].name + " 最下層"); });

  // ---------- 設定チェック ----------
  Object.keys(M).forEach(function (id) {
    var t = M[id];
    if (!R[t.rarity]) check("err", name(id) + "：レア度 " + t.rarity + " が config.js の rarities にない");
    (t.skills || []).forEach(function (sk) { if (!S[sk]) check("err", name(id) + "：技「" + sk + "」が skills.js にない"); });
    if (!t.skills || t.skills.length === 0) check("warn", name(id) + "：技を1つも持っていない");
    if (t.evolvesTo) {
      if (!M[t.evolvesTo]) check("err", name(id) + "：進化先「" + t.evolvesTo + "」が存在しない");
      else if ((M[t.evolvesTo].stage || 1) !== (t.stage || 1) + 1) check("warn", name(id) + "：進化先の stage が1つ上になっていない");
      if (!t.evolveLevel) check("err", name(id) + "：evolveLevel（進化するLv）がない");
      if (!t.enemyEvoExp) check("warn", name(id) + "：enemyEvoExp（敵として進化に必要な経験値）がない（自分の経験値×" + Game.config.enemyEvoFactor + " で代用）");
    }
    if (!t.growth) check("err", name(id) + "：growth（仲間の成長量）がない");
    if (!howToGet[id]) check("warn", name(id) + "：どこにも出現せず、進化・交配でも手に入らない");
    if (t.breedOnly && D && Object.keys(D).some(function (did) { return D[did].spawns.some(function (s) { return s.type === id; }); })) {
      check("warn", name(id) + "：breedOnly なのにダンジョンに出現する設定がある");
    }
  });
  Object.keys(D).forEach(function (did) {
    var d = D[did];
    if (d.unlockedBy && !D[d.unlockedBy]) check("err", d.name + "：解放条件のダンジョン「" + d.unlockedBy + "」が存在しない");
    if (!W[d.world]) check("err", d.name + "：世界「" + d.world + "」が worlds.js にない");
    if (d.boss && !(M[d.boss] && M[d.boss].boss)) check("err", d.name + "：ボス「" + d.boss + "」が monsters.js にない（または boss: true がない）");
    d.spawns.forEach(function (s) { if (!M[s.type]) check("err", d.name + "：出現モンスター「" + s.type + "」が存在しない"); });
    if (!d.spawns.some(function (s) { return s.from <= 1; })) check("err", d.name + "：B1Fに出る敵がいない");
    for (var f = 1; f <= d.floors; f++) {
      var any = d.spawns.some(function (s) { return s.from <= f && (!s.to || f <= s.to); });
      if (!any) check("err", d.name + "：B" + f + "F に出る敵がいない");
    }
    d.spawns.forEach(function (s) {
      if (M[s.type] && (M[s.type].stage || 1) >= 3 && !d.unlockedBy) {
        check("warn", d.name + "：最初から行けるダンジョンに3段階目（" + name(s.type) + "）が出る");
      }
    });
  });
  var seen = {};
  B.forEach(function (r) {
    r.parents.forEach(function (p) { if (!M[p]) check("err", "交配：親「" + p + "」が存在しない"); });
    if (!M[r.child]) { check("err", "交配：子「" + r.child + "」が存在しない"); return; }
    var key = r.parents.slice().sort().join("+");
    if (seen[key]) check("err", "交配：" + name(r.parents[0]) + " × " + name(r.parents[1]) + " が2回書かれている");
    seen[key] = true;
    if (r.parents.every(function (p) { return M[p]; })) {
      var c = stats(r.child);
      var maxHp = Math.max(stats(r.parents[0]).hp, stats(r.parents[1]).hp);
      var maxAtk = Math.max(stats(r.parents[0]).atk, stats(r.parents[1]).atk);
      if (c.hp <= maxHp || c.atk <= maxAtk) {
        check("warn", "交配：" + name(r.child) + " が親より強くない（HP " + c.hp + "/" + maxHp + "、攻撃力 " + c.atk + "/" + maxAtk + "）");
      }
    }
  });
  // ドット絵：指定された絵があるか、12×12 か 16×16 の正方形になっているか
  var SP = Game.SPRITES || {}, OV = Game.SPRITE_OVERLAYS || {};
  Object.keys(SP).concat(Object.keys(OV).map(function (k) { return "overlay:" + k; })).forEach(function (key) {
    var grid = key.indexOf("overlay:") === 0 ? OV[key.slice(8)] : SP[key];
    var n = grid.length;
    if ((n !== 12 && n !== 16) || grid.some(function (row) { return row.length !== n; })) {
      check("err", "ドット絵「" + key + "」が 12×12 か 16×16 になっていない");
    }
  });
  Object.keys(M).forEach(function (id) {
    if (!M[id].sprite) check("warn", name(id) + "：ドット絵（sprite）が指定されていない（文字で表示される）");
    else if (!SP[M[id].sprite]) check("err", name(id) + "：ドット絵「" + M[id].sprite + "」が sprites.js にない");
    if (M[id].overlay && !OV[M[id].overlay]) check("err", name(id) + "：重ねる小物「" + M[id].overlay + "」が sprites.js にない");
    else if (M[id].overlay && SP[M[id].sprite] && OV[M[id].overlay].length !== SP[M[id].sprite].length) check("err", name(id) + "：絵と重ねる小物の大きさが違う");
  });

  Object.keys(S).forEach(function (sk) {
    var used = Object.keys(M).some(function (id) { return (M[id].skills || []).indexOf(sk) >= 0; });
    if (!used) check("warn", "技「" + S[sk].name + "」を持っているモンスターがいない");
  });

  var ul = document.getElementById("checks");
  if (checks.length === 0) ul.appendChild(el("li", "問題なし（" + Object.keys(M).length + " 種類・技 " + Object.keys(S).length + " 個・ダンジョン " + Object.keys(D).length + " 個・交配 " + B.length + " 通り）", "ok"));
  checks.forEach(function (c) { ul.appendChild(el("li", (c.level === "err" ? "✖ エラー：" : "⚠ 注意：") + c.msg, c.level)); });

  // ---------- モンスター一覧（系統ごと） ----------
  content.appendChild(el("h2", "モンスター（" + Object.keys(M).length + " 種類）"));
  var shapeLabel = { single: "隣の1体", around: "隣の全員", sight: "見えている全員" };
  var rows = Object.keys(M).map(function (id) {
    var t = M[id], s = stats(id), r = R[t.rarity] || {};
    var sym = spriteCanvas(t.sprite, t.overlay, t.color, t.symbol);
    sym.style.color = t.color;
    var feats = [];
    if (t.phasing) feats.push("壁抜け");
    if (t.breath) feats.push("ブレス（" + t.breath.range + "マス・" + t.breath.cooldown + "ターンに1度）");
    if (t.breedOnly) feats.push("交配専用");
    if (t.humanoid) feats.push("人型（救出隊に派遣できる）");
    if (t.boss) feats.push("ボス（仲間にならない）");
    return [
      sym, id, t.name, "段階" + (t.stage || 1),
      (r.label || "?") + "（仲間化 " + Math.round((r.recruit || 0) * 100) + "%）",
      { text: s.hp, cls: "num" }, { text: s.atk, cls: "num" }, { text: s.def, cls: "num" }, { text: s.exp, cls: "num" },
      "HP+" + t.growth.hp + " 攻+" + t.growth.atk,
      tags((t.skills || []).map(function (sk) { return S[sk] ? S[sk].name : "【?" + sk + "】"; })),
      t.evolvesTo ? tags(["Lv" + t.evolveLevel + " → " + name(t.evolvesTo)], "evo") : "—",
      tags(howToGet[id] || ["（入手方法なし）"], t.breedOnly ? "breed" : ""),
      feats.join("・"),
    ];
  });
  content.appendChild(table(
    ["", "ID", "名前", "段階", "レア度", "HP", "攻撃力", "防御力", "経験値", "成長/Lv", "技", "進化", "入手方法", "特徴"],
    rows
  ));

  // ---------- 敵としての進化（敵が敵を倒した時） ----------
  content.appendChild(el("h2", "敵としての進化（倒された時に与える経験値と、進化に必要な経験値）"));
  content.appendChild(el("p", "敵の範囲技に巻き込まれて別の敵が倒れると、倒した敵は「倒された敵の経験値」をもらう。たまった量が「進化に必要な経験値」に届くと、その場で進化する（余りは持ち越し、続けて届けば2段階進化）。" +
    "例：赤龍は " + (M.redDragon ? M.redDragon.enemyEvoExp : "?") + " 必要、ぬめりんは倒されると " + (M.numerin ? stats("numerin").exp : "?") + " くれる → ぬめりんを " +
    (M.redDragon && M.numerin ? Math.ceil(M.redDragon.enemyEvoExp / stats("numerin").exp) : "?") + " 体倒すと赤龍は進化する。", "note"));
  var sample = ["numerin", "togemogura", "redDragon"].filter(function (x) { return M[x]; });
  var evoHeaders = ["", "名前", "レア度", "倒された時に与える経験値", "敵として進化に必要な経験値", "進化先"];
  sample.forEach(function (x) { evoHeaders.push(M[x].name + "なら何体"); });
  var evoRows = Object.keys(M).filter(function (id) { return !M[id].breedOnly; }).map(function (id) {
    var t = M[id], s = stats(id);
    var sym = spriteCanvas(t.sprite, t.overlay, t.color, t.symbol);
    sym.style.color = t.color;
    var need = t.evolvesTo ? (t.enemyEvoExp || Math.max(1, Math.round(s.exp * Game.config.enemyEvoFactor))) : 0;
    var row = [
      sym, t.name, (R[t.rarity] || {}).label || "?",
      { text: s.exp, cls: "num" },
      t.boss ? "（ボスは進化しない）" : t.evolvesTo ? { text: need + (t.enemyEvoExp ? "" : "（仮）"), cls: "num" } : "（最終段階）",
      t.evolvesTo && !t.boss ? name(t.evolvesTo) : "—",
    ];
    sample.forEach(function (x) { row.push(need && !t.boss ? { text: Math.ceil(need / stats(x).exp) + "体", cls: "num" } : "—"); });
    return row;
  });
  content.appendChild(table(evoHeaders, evoRows));

  // ---------- 技 ----------
  content.appendChild(el("h2", "技（" + Object.keys(S).length + " 個）"));
  content.appendChild(table(
    ["ID", "名前", "範囲", "倍率", "連撃", "使うモンスター", "予兆（1ターン目）"],
    Object.keys(S).map(function (sk) {
      var d = S[sk];
      var users = Object.keys(M).filter(function (id) { return (M[id].skills || []).indexOf(sk) >= 0; }).map(name);
      return [sk, { text: d.name, color: d.color }, shapeLabel[d.shape] || d.shape, "×" + d.mult, d.hits || 1, tags(users), d.windup];
    })
  ));

  // ---------- ダンジョン ----------
  content.appendChild(el("h2", "ダンジョン（" + Object.keys(D).length + " 個）"));
  Object.keys(D).forEach(function (did) {
    var d = D[did];
    content.appendChild(el("h3", d.name + "（" + did + "）　世界：" + (W[d.world] ? W[d.world].name : "?") + "　全" + d.floors + "階　1階の敵 " + d.enemyBase + " 体　" +
      (d.unlockedBy ? "解放：「" + (D[d.unlockedBy] ? D[d.unlockedBy].name : d.unlockedBy) + "」踏破" : "最初から行ける")));
    // 各階の出現率（レア度の出やすさの比）
    var headers = ["モンスター", "出る階"];
    var sampleFloors = [];
    for (var f = 1; f <= d.floors; f++) if (f === 1 || f % 3 === 0 || f === d.floors) sampleFloors.push(f);
    sampleFloors.forEach(function (f) { headers.push("B" + f + "F"); });
    var rowsD = d.spawns.map(function (s) {
      var row = [name(s.type), "B" + s.from + "F〜" + (s.to ? "B" + s.to + "F" : "")];
      sampleFloors.forEach(function (f) {
        var pool = d.spawns.filter(function (x) { return x.from <= f && (!x.to || f <= x.to) && M[x.type]; });
        var total = pool.reduce(function (a, x) { return a + R[M[x.type].rarity].spawn; }, 0);
        var mine = pool.indexOf(s) >= 0 && M[s.type] ? R[M[s.type].rarity].spawn : 0;
        row.push({ text: mine ? (mine / total * 100).toFixed(1) + "%" : "", cls: "num" });
      });
      return row;
    });
    content.appendChild(table(headers, rowsD));
  });

  // ---------- 世界と次元変換 ----------
  content.appendChild(el("h2", "世界（" + Object.keys(W).length + " 個）と次元変換の読み替え（" + DR.length + " 件）"));
  content.appendChild(table(
    ["ID", "名前", "説明", "この世界のダンジョン"],
    Object.keys(W).map(function (wid) {
      var ds = Object.keys(D).filter(function (did) { return D[did].world === wid; }).map(function (did) { return D[did].name; });
      return [wid, W[wid].name, W[wid].desc, ds.join("・") || "（まだない）"];
    })
  ));
  content.appendChild(DR.length === 0
    ? el("p", "次元変換の読み替えはまだ登録されていない（js/data/worlds.js の DIMENSION_RULES に書き足す）。", "note")
    : table(["アイテム", "拾った世界", "使った世界", "効き目", "説明"], DR.map(function (r) {
        return [r.item, W[r.from] ? W[r.from].name : r.from, W[r.to] ? W[r.to].name : r.to, "×" + (r.powerMul || 1), r.note || ""];
      })));

  // ---------- 交配 ----------
  content.appendChild(el("h2", "交配の組み合わせ（" + B.length + " 通り）"));
  content.appendChild(table(
    ["親1", "親2", "子", "子の能力（HP / 攻撃力 / 防御力）", "子の技"],
    B.map(function (r) {
      var c = M[r.child] ? stats(r.child) : null;
      return [
        name(r.parents[0]), name(r.parents[1]), name(r.child),
        c ? c.hp + " / " + c.atk + " / " + c.def : "",
        M[r.child] ? tags((M[r.child].skills || []).map(function (sk) { return S[sk] ? S[sk].name : sk; })) : "",
      ];
    })
  ));
})();
