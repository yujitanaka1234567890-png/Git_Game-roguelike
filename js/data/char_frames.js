// 【図鑑データ】モンスターの「紙芝居」用の絵（歩き・攻撃）。すべて手描きのオリジナル。
// 1から全部描くのではなく、characters.js の元の絵を少し変えて作る：
//   dx / dy ：絵全体を右（dx）・下（dy）にずらす（マイナスで左・上）
//   squash  ：その行を消して上に空行を入れる（ぷにっと縮む）
//   rows    ：{ 行番号: "16文字" } その行を描き直す（ずらした後の絵に対して）
// できた絵は「元の名前_walk」「元の名前_attack」「元の名前_hurt」になる（例：nume1_walk）。
// hurt（やられ）は指定がなければ、後ろ（左）へ1ドット・下へ1ドットずらした絵になる。
// 3D表示では、歩く時は元の絵と _walk を交互に、攻撃の瞬間は _attack を見せる（anim3d.js）。
Game.CHAR_FRAMES = {
  // ---- ぬめ系：歩きは押しつぶれて横に広がる、攻撃は口を大きく開けて前へ ----
  nume1: {
    walk: { rows: {
      5: "................", 6: "................", 7: "........kkk.....", 8: ".......kceak....",
      9: ".....kkceaaakk..", 10: "....kcaaawaawak.", 11: "...kaaaaakaakak.", 12: "..kaaaaaaaaaaaak",
      13: "..kbaaaapaaaapbk", 14: ".kdbbbbbbbbbbbdk", 15: "..kkkkkkkkkkkkk.",
    } },
    attack: { dx: 1, rows: { 11: "....kaaaaaaakkk.", 12: "....kbaaaapakrrk", 13: "...kbbaaaaaaakk." } },
  },
  nume2: {
    walk: { squash: 10 },
    attack: { rows: { 12: ".kbaaaaakrrrkabk", 13: ".kbbaaaakkkkabbk" } },
  },
  nume3: {
    walk: { squash: 8 },
    attack: { rows: { 9: ".kaakkkkkkkkkaak", 10: ".kaakrrrrrrrkaak", 11: ".kbaakrrrrrkaabk", 12: "kbbaaakkkkkaaabk" } },
  },

  // ---- トゲ系：歩きは足を入れ替える、攻撃は口を開けて前足の爪を振り上げる ----
  toge1: {
    walk: { rows: { 13: "..kkkwkkkkwk....", 14: "...kwkwk.kwkwk.." } },
    attack: { rows: { 10: "kbbaaaaaaaksrrk.", 11: "kdbbaaaaaaakkwk.", 12: ".kdbbbaaaaaakwk.", 13: "..kkwkkkkkk.....", 14: "..kwkwk........." } },
  },
  toge2: {
    walk: { rows: { 13: "..kkklkkkklk....", 14: "...klklk.klklk.." } },
    attack: { rows: { 10: "kdbbaaaaaaaakrrk", 11: "kdbbbaaaaaakllk.", 12: ".kdbbbbbbbbklk..", 13: "..kklkkkkk......", 14: "..klklk........." } },
  },
  toge3: {
    walk: { rows: { 13: "...kwkwk.kwkwk..", 14: "...kkkkk.kkkkk.." } },
    attack: { rows: { 8: "kbaaaaaaaaaksrrk", 9: "kbbaeaeaeaaakkwk", 10: "kdbbaaaaaaaaakwk", 13: "..kwkwk.........", 14: "..kkkkk........." } },
  },

  // ---- 刃系：歩き（浮遊）は上下にゆれる、攻撃は切っ先を突き出して目が赤く光る ----
  blade1: {
    walk: { dy: -1 },
    attack: { dx: 1, dy: -1, rows: { 8: "....krkkbk......", 9: ".....kwkk......." } },
  },
  blade2: {
    walk: { dy: -1 },
    attack: { dy: -1, rows: { 7: "......krkrk....." } },
  },
  blade3: {
    walk: { dy: 1 },
    attack: { rows: {
      1: "..k...kek...k...", 3: "...kakkakkak....", 4: "k...kkrrrkk...k.",
      5: "keeaakrwwrkaaeek", 6: "k...kkrkkrkk..k.", 7: "....kkrrrrkk....",
    } },
  },

  // ---- 龍系：歩きは足を寄せる、攻撃は口を開けて火を吹く ----
  dragon1: {
    walk: { rows: { 13: "......kbkbk.....", 14: ".....kykkyk....." } },
    attack: { rows: { 6: "..kccck.kaaaakro", 7: "...kccckkaaakkoy" } },
  },
  dragon2: {
    walk: { rows: { 14: "......kykkyk...." } },
    attack: { rows: { 6: "..kcccckkaaakkro", 7: "...kccaaaaaakroy" } },
  },
  dragon3: {
    walk: { rows: { 14: ".....kyykkyyk..." } },
    attack: { rows: { 6: ".kcccckaaaakkkro", 7: "..kccaaaaaaakroy" } },
  },

  // ---- 人形系：歩きは足を開く、攻撃は腕を前に振り出す ----
  doll1: {
    walk: { rows: { 13: ".....kak.kak....", 14: "....kkk...kkk..." } },
    attack: { rows: { 9: "...kakbaabakksk.", 10: "..ksk.aaaa.kk...", 11: "..kk.kaaaak....." } },
  },
  doll2: {
    walk: { rows: { 13: ".....kfk.kfk....", 14: "....kkk...kkk..." } },
    attack: { rows: { 9: "...kaceaaaecakk.", 10: "..klkaaaaaakkllk", 11: "..kfkbaaaabk.kfk" } },
  },
  doll3: {
    walk: { rows: { 13: "...kaak...kaak..", 14: "..kkkkk...kkkkk." } },
    attack: { rows: { 7: "..kcaaaaaaaackll", 8: ".kcaaeaaaaeaaklk", 9: "kllkaaaaaaaak.k.", 10: "kfkkabyyyybak...", 11: "kk.kaaaaaaaak..." } },
  },

  // ---- つむじ鳥系：歩き（羽ばたき）は翼を上げる、攻撃はくちばしで突く ----
  bird1: {
    walk: { rows: {
      4: ".kk....kaaak....", 5: "kcck..kaawkak...", 6: "kccck.kaaaaakoo.", 7: ".kccckkaaaakk...",
      8: "..kcceaaaaak....", 9: "...kkkkaeeak....", 10: "......kaeeak....", 11: "......kaaaak....",
    } },
    attack: { dx: 1, rows: { 5: ".......kaawkak..", 6: ".......kaaaaakoo", 7: "...kk..kaaaakko." } },
  },
  bird2: {
    walk: { rows: {
      3: ".kk....kaaaak...", 4: "kcck..kaawkaak..", 5: "kccck.kaaaaaakoo", 6: ".kccckkaaaaakko.",
      7: "..kcceeaaaaak...", 8: "...kkkkaeeaak...", 9: "......kkeeeeak..", 10: "......kaeeeak...", 11: "......kaaaaak...",
    } },
    attack: { rows: { 4: ".......kaawkaak.", 5: ".......kaaaaaakk", 6: ".kk....kaaaaakoo" } },
  },
  bird3: {
    walk: { rows: {
      3: ".kkk...kaaaak...", 4: "kccck.kaawkaak..", 5: "kcccckkaaaaaakyy", 6: ".kccccaaaaaakky.",
      7: "..kccceaaaaak...", 8: "...kkkkaeeaak...", 9: "......keeeeeak..", 10: "......kaeeeeak..", 11: "......kaaaaak...",
    } },
    attack: { rows: { 4: ".......kaawkaak.", 5: ".......kaaaaaakk", 6: ".kkk...kaaaaakyy" } },
  },

  // ---- ボス ----
  golem: {
    walk: { rows: { 13: "....kaak.kaak...", 14: "...kbbk...kbbk..", 15: "...kkkk...kkkk.." } },
    attack: { rows: {
      6: "kvaaaaaaaaaaaavk", 7: "kaacaaaaaaacaakk", 8: "kaaaaavvaaaaakvk",
      9: "kaak.kaaaak.kbbk", 10: "kbbk.kaaaak.kvvk", 11: "kvvk.kbbbbk..kk.",
    } },
  },
  maw: {
    walk: { rows: { 13: "..kbbkbbbbkbbk..", 14: "..kbk.kbbk.kbk..", 15: "..kk...kk...kk.." } },
    attack: { rows: {
      7: "kakwkwkwkwkwkwak", 8: "kakrrrrrrrrrrrak", 9: "kakrrrrrrrrrrrak",
      10: "kakrrrrrrrrrrrak", 11: "kakwkwkwkwkwkwak",
    } },
  },
};

// 元の絵と指定から、歩き・攻撃の絵を作って絵の一覧に足す
(function () {
  function shifted(rows, dx, dy) {
    var n = rows.length, out = [];
    for (var y = 0; y < n; y++) {
      var src = rows[y - dy];
      if (!src) {
        out.push(new Array(n + 1).join("."));
        continue;
      }
      var line = "";
      for (var x = 0; x < n; x++) line += src[x - dx] || ".";
      out.push(line);
    }
    return out;
  }
  function make(base, spec) {
    var rows = base.slice();
    if (spec.squash !== undefined) {
      rows.splice(spec.squash, 1);
      rows.unshift(new Array(base.length + 1).join("."));
    }
    rows = shifted(rows, spec.dx || 0, spec.dy || 0);
    for (var r in spec.rows || {}) rows[r] = spec.rows[r];
    return rows;
  }
  var all = Object.assign({}, Game.CHAR_FRAMES, Game.EXTRA_FRAMES || {}); // EXTRA_FRAMES は sea_characters.js など
  for (var name in all) {
    var base = Game.SPRITES[name];
    if (!base) continue;
    var f = all[name];
    if (f.walk) Game.SPRITES[name + "_walk"] = make(base, f.walk);
    if (f.attack) Game.SPRITES[name + "_attack"] = make(base, f.attack);
    Game.SPRITES[name + "_hurt"] = make(base, f.hurt || { dx: -1, dy: 1 }); // やられ：後ろへのけぞって沈む
  }
})();
