# 怪獣ランページ — Stage 2 街レイアウト v3.0 設計哲学版（§1 + §3）

**版**: v3.0 試作（§1 + §3 のみ、Stage 1 v6.1 と同等の散文密度を目指す）
**目的**: Stage 1 v6.1 整合性アップデート版の §1 / §3 と並べて深さを比較し、Stage 2-5 の本格指示書フォーマットを確定する材料にする。
**比較対象**: `怪獣ランページ — Stage 1 街レイアウト v6 1 整合性アップデート版 9876eb7e8fc34a538afbf278edbf3460.md` の §1（行 56-86）と §3（行 122-216）。

---

# §1 Stage 2 の実コンセプト

`src/stages.ts` の `STAGE_2_TEMPLATES`（v1.3 散文・v2.0 paste-ready 試作・現行 12 chunks 実装）と、`怪獣ランページ — Stage 2 街レイアウト v1 3 Stage1形式準拠版` の §9 を一次資料として抽出。

## 全体像

- タイトル: **NEON DISTRICT — 終電後の歓楽街から朝の表参道へ**
- 12 チャンク（北→南、y=0 → 2400）
- プレイヤーは怪獣として **終電後 23:30 ごろ** から **薄明け 05:00 ごろ** まで、ひと晩かけて街を横断する
- チャンク高さ = 200（ローカル dy ∈ [0, 200]）
- 世界幅 X ∈ [-180, +180]
- Stage 1 が **昼の住宅街** で「閑静 → 街はずれ」を描いたのに対し、Stage 2 は **夜の歓楽街** で「ピーク賑わい → 静寂朝霧」を描く。Stage 1 の桜吹雪に対する Stage 2 の **ネオンと提灯と濡れた路面**

## 4 Acts

| Act | チャンク | テーマ | 既存シグネチャ要素 |
| --- | --- | --- | --- |
| Act I | Ch0-2 | 駅前繁華（終電後） | 地方駅 + 北口ロータリー / 3 連飲食街（ramen+izakaya+karaoke）/ 提灯アーケード入口 |
| Act II | Ch3-5 | 歓楽街最盛期（深夜ピーク） | 高層雑居（karaoke+apartment_tall+club）/ ★パチンコ+交番交差点 / 老舗飲み屋横丁 5 連 |
| Act III | Ch6-8 | ホテルと屋台（深夜後半） | ラブホテル街（NW 隔離型）/ 屋台横丁（merged 中央集約）/ 映画館 + ミニシアター |
| Act IV | Ch9-11 | 静寂への転換（朝近く） | 24h パーキング + 裏通り / 神社の裏 + 蔵集落 / **★torii 表参道**（Stage 3 への handoff） |

## 既存の連続軸

- 主要通り x=0 のファサード連続（Stage 1 から継承）
- **`chouchin` + `noren`** の飲食街帯が Ch0-Ch7 まで連続、Ch8 で映画館の `banner_pole` に質感変化、Ch9 で 1 本だけ残して寂寥感、Ch10-11 で消滅し `noren` だけが和風のまま残る（Stage 3 handoff）
- **`puddle_reflection`** が全チャンク 2-4 個。雨上がり後の路面が街灯を反射する湿り気。Stage 1 では Ch11 にのみ予兆として登場した要素を、Stage 2 で本格展開
- **`oil_stained_concrete`** が avenue 中央に小パッチで散在。Ch4 ★クライマックスではパチンコ前路地に拡張、Ch9 では駐車場全面に到達。Stage 1 では Ch10 の倉庫前にのみあった素材
- 街路樹は Ch0-Ch5 で **無し**（夜街は街灯ネオンが主光源）→ Ch6 ラブホ前で `hedge` が目隠しとして登場 → Ch10 で `bamboo_fence` → Ch11 で `sakura_tree` × 2（神社参道の唯一の桜、Stage 3 への予告）。Stage 1 の桜並木が Ch5 で終端し Stage 2 ではほぼ不在 → Stage 3 で別形式の街路樹として復活する物語
- `power_pole` + `power_line` を奥層 y=92/195 の 4 隅に対で固定（Stage 1 から継承、孤立電柱禁止）。Stage 2 では `cable_junction_box` が追加され、深夜の電気設備の存在感を増す
- 歩道帯 `stone_pavement` (x=-65) は Stage 1 から継続。Ch11 の表参道で太く展開し Stage 3 公共広場へ受け渡す
- 人流グラデ（駅員・終電客・酔客 → ホスト/ホステス・客引き → 屋台客・映画客 → 深夜散歩・cat × 多 → 早朝参拝者）

## 時間帯の細かいグラデーション

Stage 2 はひと晩を通して描くため、Act 間で時刻が動く:

- Ch0-Ch1 = **23:30-24:00**（終電直後、まだサラリーマンが多い）
- Ch2-Ch3 = **24:00-25:00**（アーケードを越えて雑居街へ、人が酔客に切り替わる）
- Ch4 = **25:00 ピーク**（パチンコ + 交番、最大密度の交差点）
- Ch5-Ch7 = **25:30-27:00**（横丁・ラブホ・屋台、密度は高いが客層が偏る）
- Ch8 = **27:00**（映画館深夜上映）
- Ch9 = **28:00 = 04:00**（静寂転換、cat × 多）
- Ch10 = **04:30**（朝霧の予兆）
- Ch11 = **05:00**（薄明、表参道、Stage 3 朝へ）

時間帯は地面の `puddle_reflection` の数（Ch4 = 4 個でピーク → Ch11 = 0 個で消失）と `chouchin` の有無（Ch0-Ch7 = 多数 → Ch9 = 1 個のみ → Ch10-11 = 0 個）で**視覚的に表現**する。

---

# §3 階層 1 — Act レベル方針

## Act I — 駅前繁華（Ch0-2）

- 詳細

    **時間帯**: 23:30〜24:30（終電直後の地方駅、ホームの最終列車のテールランプがまだ Ch0 NE に見えている。街灯ネオンが完全点灯、`chouchin` も全部点いている。サラリーマンの帰宅ラッシュ末端で、まだ「家路を急ぐ人」と「夜食を取る人」が同居）

    **性格**: 駅から街への入口。終電を逃した人と、これから飲み始める人が混在する。Stage 1 の Ch0「日本庭園と縁側」の静寂とは正反対の、**人の声・客引きの呼び込み・ラーメン屋の暖簾**が同時に押し寄せる序章。アーケード入口（Ch2）でゲートをくぐる感覚を作り、Act II の歓楽街最盛期へ視線を引っ張る。

    **密度下限目安**: 建物 18+ / 家具 75+ / humans 8+（**上限なし**。実装後の密度・可読性・処理負荷・当たり判定を見ながら増やしてよい）。Stage 1 Act I より家具を 15 個ほど多めに（夜街は装飾密度が命）

    **地面基調**: `asphalt`（夜の路面ベース）+ `concrete`（駅舎前広場・3 連店前）+ `tile`（ホテルロビー前・コンビニ）+ `wood_deck`（カフェテラス、SE 隅に控えめ）+ `stone_pavement`（歩道 x=-65 連続、Stage 1 から継承）+ `oil_stained_concrete`（avenue 中央のアクセント、夜街シグネチャ）。Stage 1 の `residential_tile` は Stage 2 では完全消失

    **ランドマーク（公園モデル完成候補）**:

    - Ch0: 終電後の地方駅と北口ロータリー（NE オープンスペース ヒーロー）。`train_station` 中央 + `platform_edge` × 2 + `railway_track` × 4（ホームのレール表現）+ `signal_tower` を NE セルに集約。広場側に `bench` × 4 不揃い + `bus_terminal_shelter` + `taxi_rank_sign` × 2 + `bus_stop` × 2。SW セルに `ramen` + `izakaya` の終電客向け飲食を配置し、`chouchin` × 2 + `noren` × 2 で夜街の入口感を出す
    - Ch1: 終電後の食事街（SW = 3 連飲食店、基本形 C クラスター）。`ramen` + `izakaya` + `karaoke` の dy=128 揃え 3 連。各店前に `chouchin` × 2 + `noren` + `a_frame_sign`、店間に `flower_planter_row`、店裏に `oil_stained_concrete` の路地裏。客引きは SW 端 (x=-178) に立たせる
    - Ch2: 商店街アーケード入口（NW+NE merged ヒーロー）。`shotengai_arcade` × 2 をゲート両柱として配置（x=-118/+118）、その間に `chouchin` × 14 を不揃い間隔（22-32px）で並べる「提灯ガーランド」を avenue 全幅に渡す。`banner_pole` × 4 を各端に。下段は `pachinko` 予告（SW）と `club` 予告（SE）で Act II への伏線

    **Act II への handoff**: アーケード Ch2 の `chouchin` × 14 がそのまま Ch3 facade に流れ込む。Ch2 SW の `pachinko`（予告 = 小型）が Ch4 の `pachinko ★`（クライマックス = 大型）に対応する物語的橋渡し。`_TOP_HR` を Ch2 にだけ追加して「Act 境界の予告」にする（Stage 1 Ch2 の手法を踏襲）

## Act II — 歓楽街最盛期（Ch3-5）

- 詳細

    **時間帯**: 24:00〜25:30（深夜のピーク。Ch4 が 25:00 ちょうどで Stage 2 全体の最大密度地点。`puddle_reflection` × 4（Stage 2 最多）+ `street_mirror` × 2 + ネオン屋上看板 × 2 で「街中の光が湿った路面に反射する」絵を作る）

    **性格**: 街の心臓。Stage 1 の Act II「生活と小商店」とは対極の、**ホスト/ホステス・酔客・客引き・パチンコ客**が混在する暴力的な賑わい。Ch4 のクライマックスで「街が人で詰まっている」感を出し、Ch5 で横丁に密度を絞り込んで「狭い空間に人が溢れる」効果を作る。Stage 1 のクライマックスが Ch6 小学校の「全マージ・空間の広さ」だったのに対し、Stage 2 のクライマックスは Ch4 の「全マージ・空間の人口密度」で対比

    **密度下限目安**: 建物 22+ / 家具 90+ / humans 12+（**上限なし**。Ch4 ★クライマックスは家具 100+ / humans 16+ を目安に。Stage 1 Act II より 30% 増し）

    **地面基調**: `asphalt` ベース + `tile`（パチンコ前・コンビニ・銀行）+ `concrete`（交番前・横丁通り）+ `red_carpet`（club・love_hotel 前 = ネオン色面）+ `oil_stained_concrete`（avenue 中央 + パチンコ前路地）。Ch3 雑居ビル間に裏路地の `_VR(-90, 0, 100)` を入れて「ビル間の細い隙間」を表現

    **ランドマーク（公園モデル完成候補）**:

    - Ch3: 高層雑居ビル（NE = ヒーロー、基本形 B 高層）。`karaoke` + `apartment_tall` + `club` の高層 3 棟を NE 上段に縦帯で並べ、屋上 y=8 に `sign_board` 大ネオンを置く。下段は `business_hotel` + `townhouse` + `mahjong_parlor` の混在で「飲み屋の上に住む人がいる雑多さ」を出す。雑居ビル間に **裏路地 `_VR(-90, 0, 100)`** を縦に通し、avenue 以外の縦動線を 1 本だけ追加
    - Ch4 ★: パチンコ + 交番交差点（全マージ merged ヒーロー、Stage 2 クライマックス）。`pachinko ★`（NW 上段）+ `police_station ★`（中央 SW 上段境界）+ `game_center`（NE 上段）の 3 大焦点を avenue 中央に配置。交番前に `flag_pole` × 2 + `traffic_cone` × 4 + `street_mirror` × 2 で交差点感、パチンコ前に `barrier` × 2 + `bicycle_rack`、ゲーセン前に `barrier` × 2 + `vending` × 2。`_TOP_HR` を入れて「4 方向交差点」の絵を完成させる
    - Ch5: 老舗飲み屋横丁（SW+SE merged ヒーロー、5 連店並び）。`snack` + `mahjong_parlor` + `izakaya` + `snack` + `sushi_ya` の 5 軒並び（x=-160/-100/-30/+60/+130, y=130 揃え）。各店前に `chouchin` + `noren` + `a_frame_sign`、両端に `wood_fence`（横丁の入口を作る）、店前路地に `puddle_reflection` × 4。**部分幅 `_HR(165, -180, 0)`** を SW 横丁の路地として追加し、avenue 以外の横動線を出す

    **Act III への handoff**: Ch5 の横丁から Ch6 ラブホ街への密度減 → 客層変化（飲み客 → カップル）→ ネオン色変化（赤・黄 → ピンク・黒+金）。Ch5 SW snack の `chouchin` ピンクが Ch6 ラブホ前 `sign_board` ピンクへの色受け渡し

## Act III — ホテルと屋台（Ch6-8）

- 詳細

    **時間帯**: 25:30〜27:30（深夜後半。Ch6 ラブホ街の `hedge` × 5（高め目隠し）で「人通りはあるが顔は見えない」匿名性を出し、Ch7 屋台横丁で再び中央集約の賑わい、Ch8 映画館深夜上映で「無音の集中」に転調）

    **性格**: Act II のピークを越えて密度が分散し始める。Ch6 はラブホ NW 隔離（hedge で目隠し、入口にしか焦点を持たない型）。Ch7 は逆に **横道路ゼロ**（`horizontalRoads: []`）で屋台 5 連を中央集約し「歩行者専用の祭り空間」を作る。Ch8 は映画館 SE 単独焦点で深夜上映の客が SE に集中。Stage 1 Act III の「下校小学生 + 商店街」とは違い、**人が場所ごとに偏在する**夜の特徴を強調

    **密度下限目安**: 建物 20+ / 家具 85+ / humans 10+（**上限なし**。Ch7 屋台横丁は yatai × 5 の周辺に屋台客 × 8 + 屋台店主 × 5 を集めるため humans 14+ を目安）

    **地面基調**: `asphalt` ベース + `red_carpet`（ラブホ・club・屋台床、ネオン色面が拡大）+ `concrete`（屋台前・mansion 駐車）+ `wood_deck`（cafe・SE 映画館近く）+ `tile`（mahjong・SE 映画館前）+ `oil_stained_concrete`（路地裏）。Ch7 では `red_carpet` を屋台床 240×30 で全幅近く展開し「祭り感」を出す

    **ランドマーク（公園モデル完成候補）**:

    - Ch6: ラブホテル街（NW = ヒーロー、基本形 B 隔離型）。`love_hotel` × 3（NW 上段に大 2 軒 + NW 下段隅に小 1 軒）。`sign_board` ピンクネオン × 2 を屋上 y=8、入口に `parasol` × 2 + `flag_pole` × 2、外周に **`hedge` × 5 高め目隠し**（x=-178 列 y=10/50/90 + x=10 列 y=10/50）。NE は `club` × 2 + `mahjong_parlor`、SW は `snack` 通り、SE は `mansion` + `cafe`。ラブホ前の `red_carpet` を 100×40 で大きめに敷いて「特別感」を演出
    - Ch7: 屋台横丁（NW+NE merged ヒーロー、基本形 A 中央集約 + 横道路ゼロ）。`yatai` × 5 を avenue 中央 y=68 に微不揃い間隔（x=-110/-55/0/+55/+108）で並べる。各屋台に `chouchin` 上空 + `parasol` + `noren`、屋台間に `bench` × 5（屋台客の溜まり）、両端に `popcorn_cart` × 2 + `balloon_cluster` × 3 上空（祭り感）。**`horizontalRoads: []` を採用**して `_MID_HR` を省略し、avenue を屋台前のオープンスペースとして開放する。Stage 1 Ch1 児童公園の「中央集約 + 入口動線のみ」の構造を屋台に置き換えた変奏
    - Ch8: 映画館 + ミニシアター街（SE = ヒーロー、基本形 B 中型）。`movie_theater ★` + `cafe` を SE に置き、入口前に `sign_board` ポスター見立て + `banner_pole` × 3（壁面飾り）+ `flag_pole` × 2 + `shop_awning` × 2。客の待ち列 `bench` × 3 + `puddle_reflection` × 2。NW は `karaoke` + `club` + `snack`、NE は `pachinko` + `game_center` + `snack`、SW は `mansion` × 2 + `mahjong_parlor`。**部分幅 `_HR(155, 30, 180)`** を SE 映画館前のサービス道として追加

    **Act IV への handoff**: Ch8 SE 映画館深夜上映の客 × 5 が Ch9 NE パーキングの depth = 静寂に変わる。Ch8 でまだ点いていた `chouchin`（NW snack 前）が Ch9 では 1 本だけ残り（x=-45, y=38）「閉店間際の店」の符号として寂寥感を作る。`puddle_reflection` の数も Ch7 = 4 → Ch8 = 3 → Ch9 = 3 → Ch10-11 = 3 と減少カーブ

## Act IV — 静寂への転換（Ch9-11）

- 詳細

    **時間帯**: 28:00（= 04:00）〜05:00（朝近く。Ch9 で **cat × 5**（Stage 2 最多）を SE に集中させ「人が消えて猫だけが残る街」を表現。Ch10 で朝霧の `puddle_reflection` × 3 を維持しつつ `bamboo_fence` で和風成分を導入、Ch11 で完全に Stage 3 朝の表参道に切り替わる）

    **性格**: 商店街・歓楽街を抜けた郊外。Stage 1 Act IV「街はずれ」の田園農家・倉庫・踏切とは違い、Stage 2 では **「夜街の終わり」が「神社の朝」に変わる時間遷移** を描く。Ch9 = 24h パーキングの硬質な静寂、Ch10 = 古民家集落と神社の裏（chouchin が完全に消える）、Ch11 = ★torii と表参道（Stage 3 への完全移行点）。Stage 1 Ch11 が Stage 2 への handoff として **踏切で空間を物理的に分断** したのに対し、Stage 2 Ch11 は Stage 3 への handoff として **時間的（夜→朝）+ 文化的（夜街→和風）の二重切替** を担う

    **密度下限目安**: 建物 15+ / 家具 70+ / humans 5+（**上限なし**。Ch11 は早朝のため humans 控えめだが、`cat` × 3 + 早朝参拝者 × 2 で「人気 = 少」を表現。家具は神社系 `stone_lantern` / `koma_inu` / `sando_stone_pillar` 等で密度確保）

    **地面基調**: `asphalt` 主体だが、Ch9 で `oil_stained_concrete`（駐車場 100×50 全面）と `stone_pavement`（SW 神社予兆 80×40）+ `fallen_leaves`（神社予兆）を初登場させ、Ch10 で `stone_pavement`（神社境内 80×80）+ `moss`（苔）+ `gravel`（玉砂利）+ `fallen_leaves` × 2 を本格展開、Ch11 で表参道 `stone_pavement` 100×100 + `gravel` 80×30 + `fallen_leaves` × 4 + `moss` で完全に和風に切り替える。Stage 1 の Ch10 倉庫前 `oil_stained_concrete` のリプライズが Ch9 で逆方向（夜街 → 静寂）に作用する

    **ランドマーク（公園モデル完成候補）**:

    - Ch9: 駐車場と裏通り（NE = ヒーロー、基本形 A オープンスペース・静寂転換）。`parking`（NE 上段、x=130 y=68）+ `gas_station`（avenue 寄り、x=30 y=22）+ `traffic_cone` × 4 + `barrier` × 2 + `car` × 3（駐車車両）。NW は古い `house` × 2 + `snack`（x=-45 閉店間際）+ `mailbox` × 4 不揃い（**Stage 2 で唯一の "古い住宅街" セル**、Stage 1 Act I への遠い echo）。SW は `kura` + `machiya` + `wood_fence` × 3 で神社予兆。SE は `townhouse` × 2 + `apartment` + **`cat` × 4**（静寂の主役）。**部分幅 `_HR(80, 65, 180)`** を NE パーキング入口専用道として追加
    - Ch10: 古い住宅 + 神社の裏手（SW = ヒーロー、基本形 B 神社モデル）。`kura`（神社蔵見立て、x=-100 y=130）+ `shed`（摂社見立て、x=-160 y=130）を SW セルに集約。境内に `stone_lantern` × 3 準対称 + `bamboo_water_fountain` + `bamboo_fence` × 4（境内輪郭）。NW は `kominka` + `chaya` + `wagashi` の 3 連和風店（`noren` × 3 で連続）。NE は `townhouse` × 2 + `machiya` + `bonsai`（庭木）。SE は `shed` × 2 + `machiya` + `kura` で蔵集落を形成。**部分幅 `_HR(165, -180, 0)`** を SW 蔵集落の小道として追加（Ch5 横丁の `_HR(165, -180, 0)` のリプライズ、夜街→朝への対比）
    - Ch11: ★神社の表参道（NE = ヒーロー、Stage 3 への handoff）。`torii` 鳥居（NE 上段中央、x=80 y=22、★ ランドマーク）+ `offering_box` + `omikuji_stand` + `ema_rack` を参道中央に。`sando_stone_pillar` × 3 + `stone_lantern` × 2 + `koma_inu` × 2 で参道の格式を作る。境界に `bamboo_fence` × 6（参道両側 x=10/150 列）+ `shrine_fence_red` × 2（赤柵）。動線として参道 `stone_pavement` 100×100 + `shinto_rope`（鳥居上）。**`sakura_tree` × 2（x=±30, y=88）が Stage 2 唯一の桜** として表参道脇に咲く（Stage 1 から継承し Stage 3 へ受け渡す唯一の植栽）。NW は `chaya` + `wagashi` + `kominka` の 3 連、SW は `kura` × 2 + `machiya`、SE は `kominka` + `chaya`、すべてに `noren` を入れて和風 facade を完成させる

    **Stage 3 への handoff**: 街灯ネオン → Stage 3 でオフィス街路樹 `tree` に切替（Stage 1 → Stage 2 で sakura → chouchin に切り替えたのと逆向きの動き）。`stone_pavement` 神社参道帯（Ch11 で太く拡張）が Stage 3 公共広場の `stone_pavement` 大パッチに直接連続する。`chouchin` は Ch11 で 2 本だけ残し（x=-100/+130, y=22）、Stage 3 で完全消失（オフィス街には提灯は無い）

## Act 間の連続軸サマリ

| 連続軸 | Act I（駅前） | Act II（歓楽街） | Act III（ホテル/屋台） | Act IV（静寂） |
| --- | --- | --- | --- | --- |
| 主光源 | 駅舎ネオン + chouchin | 屋上ネオン + 街灯 | パステルネオン + 屋台提灯 | 街灯のみ → 朝光 |
| 主路面 | asphalt + concrete | asphalt + tile + red_carpet | asphalt + red_carpet | asphalt → stone_pavement |
| 連続装飾 | chouchin × 4-14（増加） | chouchin × 多 + sign_board 大 | chouchin × 5 + balloon | chouchin × 1 → 0 |
| 湿り気 | puddle × 2 | puddle × 4（ピーク） | puddle × 3 | puddle × 3（朝霧） |
| 人流 | サラリーマン・終電客・酔客 | ホスト/ホステス・客引き・パチンコ客 | カップル・屋台客・映画客 | 深夜散歩・cat × 多・参拝者 |
| 象徴猫 | SE 駅裏 | SW 横丁 | SW 屋台裏 | NW/SW/SE 全方位（Ch9 = 5 匹） |
| 道路の個性 | _MID_HR + _TOP_HR (Ch2) | _VR 裏路地 (Ch3) + _HR 横丁 (Ch5) + _TOP_HR (Ch4) | _HR ゼロ (Ch7) + _HR サービス道 (Ch8) | _HR パーキング入口 (Ch9) + _HR 蔵小道 (Ch10) |

---

# §3 と §1 の整合性メモ（自己チェック）

| Stage 1 §1 / §3 が含む要素 | Stage 2 v3.0 §1 / §3 で対応しているか |
| --- | --- |
| 全体像（タイトル / チャンク数 / 座標系） | ✅（§1 全体像） |
| 4 Acts テーブル（Act / チャンク / テーマ / シグネチャ） | ✅（§1 4 Acts） |
| 既存の連続軸（並木・電柱・人流・道路方針） | ✅（§1 既存の連続軸、Stage 2 固有 4 軸: chouchin / puddle / oil_stained / 街灯ネオン） |
| Act ごとに 時間帯 / 性格 / 密度下限 / 地面基調 | ✅（§3 各 Act） |
| Act ごとに ランドマーク（公園モデル完成候補） を 3 個ずつ詳述 | ✅（§3 各 Act、各ランドマークは焦点 + 取り巻き + 境界 + 動線 + ロット を具体名で記述） |
| Act 間 handoff の物語 | ✅（§3 各 Act 末尾） |
| Act 間連続軸サマリ table | ✅（§3 末尾） |
| 時間帯遷移の細かいグラデ | ✅（§1 時間帯の細かいグラデーション、Stage 2 固有の追加要素） |

---

**この §1 + §3 を Stage 1 v6.1 の §1（行 56-86、約 30 行）と §3（行 122-216、約 95 行）と並べて、深さが追いついているか判定してください。**

OK なら同じ密度で §4 (公園モデル + 取り巻き辞書 + 不対称原則 + 痕跡カタログ) → §5 (道路設計) → §6 (精巧さの最低ライン) → §7 (SemanticCluster Stage 2 適用ガイド) → §9 (各チャンク詳細) を書きます。

NG ならどの軸が薄いか指摘してください（情景描写 / 連続軸の物語 / ランドマークの具体性 / Act 間 handoff / 時間帯遷移 等）。
