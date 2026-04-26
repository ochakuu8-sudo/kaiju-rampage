# 怪獣ランページ — Stage 2 街レイアウト v1.0 設計指示書

<aside>
📋

**このドキュメントの位置づけ（v1.0 新規設計版）**

Stage 2「夜の歓楽街 NEON DISTRICT」の **再配置のための設計指示書**。Stage 1 v6.3 と同じフォーマットで書かれた **方針 + 詳細フェーズ** の一体版。§1〜§7 が方針、§9 が全 12 チャンクの設計指示。

**Stage 1 v6.3 の §2 / §4 / §5 / §6 / §6.5 / §6.6 (公園モデル / 道路ポリシー / 横断要件 / SemanticCluster) はそのまま継承する。** Stage 2 では Stage 固有のコンセプト・取り巻き辞書・連続軸を §1 / §3 / §4.5 / §6.5 で書き直す。

</aside>

<aside>
🌙

**Stage 2 のテーマ宣言**

Stage 1 末尾の踏切（Ch11）を越えると、街が **夜** に切り替わる。ネオンサインの色温度、濡れた路面の puddle_reflection、提灯の連続帯が支配する **夜の歓楽街**。プレイヤーは怪獣としてサラリーマン街→ラブホテル街→屋台横丁→静寂の神社へと進み、Stage 3「都心オフィス街」（朝）への引き渡しを担う。

**コアトーン**: 雑多 / 高密度 / 赤と青のネオン / 雨上がりの濡れた路面 / 提灯と暖簾の温かい光 / 看板の重なり

</aside>

<aside>
🆕

**v1.0 の方針**

- Stage 1 v6.3 の **公園モデル 4 層構造 (§4)** と **SemanticCluster (§6.6)** をそのまま採用
- 道路は Stage 1 同様、**中央 `_AVE` のみ固定**、それ以外はチャンクのコンセプトに沿って都度設計（§5 継承）
- 12 チャンクで構成（Stage 1 と同じ尺度）。物語は 4 Acts で配分
- 連続軸は **chouchin 帯 / 暖簾の連なり / puddle_reflection / 街灯ネオン** の 4 本
- 既存実装の Stage 2 (10 chunks) は **コンセプトのみ引き継ぎ**、配置は本指示書で再設計

</aside>

---

# §1 Stage 2 の実コンセプト

## 全体像

- タイトル: **夜の歓楽街** (NEON DISTRICT)
- 12 チャンク（北→南、y=2400 → 4800、Stage 1 末尾を継ぐ）
- プレイヤーは怪獣として **夜の街** を横断する
- チャンク高さ = 200（ローカル dy ∈ [0, 200]）
- 世界幅 X ∈ [-180, +180]

## 4 Acts

| Act | チャンク | テーマ | 既存シグネチャ要素 |
| --- | --- | --- | --- |
| Act I | Ch0-2 | 駅前繁華 | 終電の駅 / ラーメン+居酒屋 / ビジネスホテル |
| Act II | Ch3-5 | 歓楽街最盛期 | カラオケ / パチンコ / 交番 / 雑居ビル |
| Act III | Ch6-8 | ホテルと屋台 | ラブホテル / 屋台横丁 / 映画館 / クラブ |
| Act IV | Ch9-11 | 静寂への転換 | 駐車場 / 神社の裏手 / 夜明け前 (Stage 3 handoff) |

## 既存の連続軸

- 主要通り x=0 のファサード連続（Stage 1 から継承）
- **提灯帯 chouchin** Ch0-Ch7（避けが y=22 facade 線、または店前 y=56-90 の高さで連続）
- **暖簾 noren** Ch1-Ch7（飲食店の入口に集約、店前 y=28-32）
- **puddle_reflection** 全チャンク（夜の濡れた路面、focal cell の access として）
- **街灯ネオン (street_lamp + sign_board)** Ch1-Ch8 の avenue 沿い
- 縦道路は **中央 `_AVE`（x=0 avenue）のみを基本骨格**（Stage 1 v6.2 方針継承）
- ground 基調は **asphalt**（夜の濡れた歩道感）。focal cell のみ `tile` / `concrete` / `red_carpet`（club/love_hotel）で強調

## 時間帯と人流グラデ

| Act | 時間帯 | 人流 |
| --- | --- | --- |
| Act I | 終電 23:00 | サラリーマン (adult_m × 多)・終電客 (adult_m,f mix) |
| Act II | 23:30 | 飲み客・ホスト/ホステス・客引き |
| Act III | 0:30 | 酔客・カップル・屋台の店主・帰宅組 |
| Act IV | 3:00-5:00 | 野良猫・寝静まる路地・神社の参拝者（早朝） |

---

# §3 Act レベル方針

## Act I — 駅前繁華（Ch0-2）

**テーマ**: Stage 1 末尾の踏切から、再開発された地方駅の北口ロータリーへ。「終電が出たばかり」のしっとりした賑わい。

- **Ch0**: train_station + bus_terminal_shelter / taxi_rank_sign / ラーメン店からの蒸気
- **Ch1**: ラーメン+居酒屋+カラオケが並ぶ「終電後の食事街」
- **Ch2**: 商店街アーケード入口、提灯ガーランドが avenue 全幅を覆う

**人流**: サラリーマン × 多、終電客 × 中、客引き × 少
**連続軸**: chouchin 帯 (上段 y=22 / 下段 y=118)、puddle_reflection 散在

## Act II — 歓楽街最盛期（Ch3-5）

**テーマ**: ネオン看板が乱立する高密度の雑居ビル街。カラオケ・パチンコ・クラブの 1F 店舗群と、上層階のオフィス/雀荘の重ね合わせ。

- **Ch3**: 高層雑居ビル（karaoke / club / business_hotel）の縦に伸びるファサード
- **Ch4**: パチンコ + 交番の交差点、客引き多数（**hero merged: 6 セル全部に焦点**）
- **Ch5**: 老舗飲み屋横丁 + ビジネスホテル + 銀行カプセルホテル

**人流**: 飲み客 × 多、ホスト/ホステス × 中、警察官 × 1 (交番前)
**連続軸**: ネオン sign_board が avenue 沿いに連続、雑居ビル ファサード y=22-90 の縦帯

## Act III — ホテルと屋台（Ch6-8）

**テーマ**: ラブホテル街、屋台横丁、映画街。賑わいのピークを過ぎ、人が裏路地に流れ込む時間帯。

- **Ch6**: ラブホテル区画 + クラブ街、ピンク・赤のネオン
- **Ch7**: 屋台横丁、yatai × 5 が中央に集約された夜店通り（**hero NW**）
- **Ch8**: 映画館 + ミニシアター街、ポスター看板の重なり

**人流**: 酔客 × 多、カップル × 中（Ch6）、屋台店主 × 1-2 / 屋台 (Ch7)、映画客 × 中
**連続軸**: yatai 帯 (Ch7 中央)、movie_theater のネオン (Ch8)

## Act IV — 静寂への転換（Ch9-11）

**テーマ**: 賑わいが消え、駐車場・廃屋・夜明け前の神社へ。Stage 3「都心オフィス街」（朝）への handoff を作る。

- **Ch9**: 駐車場 + 裏通り、夜風が吹く静かな区画
- **Ch10**: 古い住宅 + 神社の裏手、stone_pavement と落ち葉
- **Ch11**: 小さな神社の表参道、torii と石灯籠（朝靄予告、Stage 3 handoff）

**人流**: 野良猫 × 多、深夜の散歩客 × 少、参拝者 × 1（早朝、Ch11）
**連続軸**: chouchin → 街灯のみへ移行、puddle_reflection 増加（朝霧の予兆）、ground が `asphalt` → `stone_pavement` へグラデ

## Act 間の連続軸サマリ

- 桜並木は Stage 1 で終わり、Stage 2 では **chouchin 帯** が連続軸
- 電柱+電線は Stage 1 から継続、ただし夜は **cable_junction_box** が増える（電気街の表現）
- 人流は **adult_m 多 → adult_f 中 → cat 多 → 早朝参拝者** とグラデ
- ground は **asphalt 全面 → stone_pavement (Ch10-11) へ夕焼け** を示唆

---

# §3.6 ヒーロー / アンビエント階層（Stage 2 固有のジグザグ流れ）

| Chunk | ヒーロー位置 | テーマ |
| --- | --- | --- |
| Ch0 | NE | train_station |
| Ch1 | SW | ラーメン+居酒屋 (3連飲食) |
| Ch2 | NW+NE merged | 商店街アーケード入口 |
| Ch3 | NE | karaoke 高層雑居ビル |
| Ch4 | merged (全マージ) | パチンコ+交番交差点（クライマックス） |
| Ch5 | SW+SE merged | 飲み屋横丁 |
| Ch6 | NW | ラブホテル街 |
| Ch7 | NW+NE merged | 屋台横丁 |
| Ch8 | SE | 映画館 |
| Ch9 | NE | 駐車場 (静寂転換) |
| Ch10 | SW | 古い住宅+神社の裏 |
| Ch11 | NE | 神社表参道 (Stage 3 handoff) |

**Stage 2 のクライマックス**: Ch4 全マージ（パチンコ+交番）。これが Stage 2 全体の視覚的ピーク。Ch7 屋台横丁が二次クライマックス。

---

# §4.5 Stage 2 固有の建物→取り巻き辞書

| 建物 | 必須取り巻き | 補助取り巻き | 痕跡 |
| --- | --- | --- | --- |
| `train_station` | platform_edge + railway_track + bus_stop + taxi_rank_sign | flag_pole + bench × 2 + flower_planter_row | newspaper_stand |
| `ramen` | chouchin × 2 + noren + a_frame_sign | bicycle_rack + milk_crate_stack | bicycle |
| `izakaya` | chouchin × 2 + noren + a_frame_sign | sign_board + bench | garbage |
| `karaoke` | sign_board (大) + chouchin + a_frame_sign | bicycle_rack + vending | recycling_bin |
| `pachinko` | sign_board (大、ネオン) + a_frame_sign × 2 + chouchin | bench (待ち客) + traffic_cone | garbage + dumpster |
| `mahjong_parlor` | sign_board (緑、老舗) + noren | wood_fence + potted_plant | bicycle |
| `business_hotel` | sign_board (青、英字) + flag_pole | flower_planter_row + bench | mailbox |
| `capsule_hotel` | sign_board (タワー) + a_frame_sign | newspaper_stand + vending | garbage |
| `love_hotel` | sign_board (ピンク・赤) + parasol | hedge (高め、目隠し) + flower_bed | (痕跡控えめ) |
| `club` | sign_board (黒+金) + parasol + flag_pole | hedge + bollard | recycling_bin |
| `snack` | chouchin (ピンク) + noren + a_frame_sign | potted_plant + ac_unit | garbage |
| `movie_theater` | sign_board (大、ポスター見立て) + banner_pole × 2 | flag_pole + flower_planter_row | bench |
| `bank` | flag_pole + atm + flower_planter_row | bench + post_box | (痕跡控えめ) |
| `police_station (koban)` | flag_pole (×2) + traffic_cone (×2) + bicycle_rack | bench + post_box | bicycle |
| `convenience` | shop_awning + a_frame_sign + vending + bicycle_rack | parasol + newspaper_stand | bicycle + garbage |
| `yatai` (家具) | parasol + chouchin + popcorn_cart (jpn 屋台はないので近似) | bench (客 1-2) + balloon_cluster | (店主が痕跡) |
| `shrine` (Stage 末尾) | torii + stone_lantern × 2 + ema_rack + omikuji_stand | bamboo_water_fountain + sando_stone_pillar × 2 | fallen_leaves (ground) |

**ネオン色の使い分け（sign_board の見立て）**:
- 赤・ピンク → snack / love_hotel / pachinko
- 青・緑 → business_hotel / mahjong_parlor / bank
- 黄・橙 → karaoke / ramen / izakaya
- 黒・金 → club / movie_theater / capsule_hotel

---

# §5 Stage 2 の道路設計（Stage 1 v6.2 ポリシー継承）

**Stage 2 でも固定するのは中央 `_AVE`（x=0 縦軸）のみ**。横道路（`_MID_HR` 含む）と他の縦道路はチャンクのコンセプトに沿って都度設計する。

## Act ごとの道路性格

| Act | 道路性格 | 設計のヒント |
| --- | --- | --- |
| Act I 駅前 | 駅前ロータリー、バス導線 | Ch0 は `_AVE` のみ + 駅前広場を `asphalt` ground で広場化（道路セグメントを増やさない）。Ch1-2 は `_AVE` + `_MID_HR`。 |
| Act II 歓楽街 | 高密度、雑居ビル間の細い裏道 | Ch3-5 は `_AVE` + `_MID_HR` + 雑居ビル間の `_VR(±90, 0, 100)` 短い裏道 1-2 本（必要なチャンクのみ）。 |
| Act III ホテル+屋台 | 屋台が中央に集まるため道路は減らす | Ch6-7 は `_AVE` のみ（屋台は道路ではなく ground/家具で表現）。Ch8 は `_AVE` + `_MID_HR`。 |
| Act IV 静寂 | 道路が減り、stone_pavement の参道が登場 | Ch9 は `_AVE` + `_MID_HR`、Ch10-11 は `_AVE` のみ + 参道を `stone_pavement` ground 帯で表現。 |

## 道路に置かない / 置くべきもの

- **ネオン看板の重なり**は道路ではなく facade y=22-90 の縦帯で表現
- **屋台横丁** (Ch7) は中央広場として `tile` / `red_carpet` ground で広場化、道路は最小限
- **駅前ロータリー** (Ch0) は `asphalt` 大パッチ + `bus_stop` / `taxi_rank_sign` 家具で表現
- **客引き・酔客の溜まり**は `_MID_HR` 沿いに humans を配置

---

# §6.5 Stage 2 で使う実 union（建物・家具・地面）

## 建物 (BuildingSize)

**主役（Stage 2 で多用）**: `train_station` / `ramen` / `izakaya` / `karaoke` / `pachinko` / `mahjong_parlor` / `business_hotel` / `capsule_hotel` / `love_hotel` / `club` / `snack` / `bank` / `police_station` / `movie_theater` / `convenience` / `shotengai_arcade` / `bus_terminal_shelter` / `shrine`

**脇役（背景・住宅）**: `townhouse` / `house` / `mansion` / `apartment` / `apartment_tall` / `garage` / `shed` / `kura` / `ramen` / `wagashi`

**避けたい**: `kominka` / `chaya` / `machiya` 等の和風住宅は Stage 2 では使わない（Stage 3「都心」に温存）

## 家具 (FurnitureType)

**Stage 2 シグネチャ**: `chouchin` / `noren` / `sign_board` / `a_frame_sign` / `flag_pole` / `banner_pole` / `puddle_reflection` / `cable_junction_box` / `manhole_cover` / `bollard` / `street_lamp` / `traffic_cone` / `bus_stop` / `taxi_rank_sign` / `bicycle_rack` / `newspaper_stand` / `vending` / `parasol`

**屋台（Ch7 のみ集中）**: `popcorn_cart` / `balloon_cluster` / `parasol` / `bench`

**神社（Ch11 のみ）**: `torii` / `stone_lantern` / `ema_rack` / `omikuji_stand` / `sando_stone_pillar` / `koma_inu` / `shinto_rope` / `offering_box`

**生活痕跡（全チャンク）**: `garbage` / `recycling_bin` / `dumpster` / `bicycle` / `cat` / `mailbox` / `potted_plant`

## 地面 (GroundType)

- **基調**: `asphalt`（全チャンク y=88 帯と裏路地）
- **focal 強調**: `tile` / `concrete` / `red_carpet`（club / love_hotel）
- **Act IV 移行**: `stone_pavement` (Ch10-11 神社参道)
- **アクセント**: `puddle_reflection` は **家具** (FurnitureType) であって ground ではない点に注意

---

# §6.6 SemanticCluster の Stage 2 適用ガイド

各チャンクで `clusters?: SemanticCluster[]` を宣言する。Stage 2 固有のヒント:

## hero クラスタの focal 候補

- **オープンスペース型** (基本形 A): Ch0 駅前広場 (`focal: train_station` 建物 or `bus_stop` 家具) / Ch4 パチンコ街頭 (`focal: pachinko` 建物) / Ch7 屋台広場 (`focal: 中央 yatai` 建物)
- **焦点建物型** (基本形 B): Ch3 karaoke / Ch6 love_hotel / Ch8 movie_theater / Ch11 shrine
- **3 連焦点型** (基本形 C): Ch1 ramen+izakaya+karaoke / Ch5 snack+mahjong+izakaya 横丁

## ambient クラスタの focal 候補

- 各セルに 1 つ、ヒーローでない建物の中で最大のもの（business_hotel / convenience / mansion など）

## boundary 候補（Stage 2 固有）

- `bollard` 列（avenue 沿い、夜の歓楽街では交通整理が密）
- `traffic_cone` 列（パチンコ前・交番前）
- `hedge` (love_hotel の目隠し)
- `flag_pole` 列 (movie_theater 前)

## access 候補（Stage 2 固有）

- `street_lamp` (ネオン光源として avenue 両脇 y=92 / y=108 に配置)
- `manhole_cover` (avenue 横断地点)
- `puddle_reflection` (focal 周辺に 2-3 個、夜の濡れた路面感)
- `street_mirror` (Ch4 交番前、Ch11 神社参道)

## livingTrace 候補（Stage 2 固有）

- `garbage` (Ch1-Ch7 各セル、飲食店の出し)
- `bicycle` (放置自転車、Ch3-Ch5 の業務側)
- `cat` (Ch9-Ch11 の静寂側、各セル 1 匹以上)
- `recycling_bin` (Ch6 ラブホ街、Ch9 駐車場)

---

# §9 詳細フェーズ: 各チャンクレイアウト（再配置のための設計指示）

<aside>
📐

**読み方**: 各チャンクは以下 7 項目で構成。(1) ヒーロー/アンビエント割当 / (2) ヒーローセルの焦点 4 層 / (3) 取り巻き 3 パターン / (4) 人配置 / (5) 地面パッチ・追加道路 / (6) 生活の痕跡・スケール階層 / (7) Handoff 4 項目（前後チャンクへの引き継ぎ）。座標は dx ∈ [-180, +180] / dy ∈ [0, 200] のチャンクローカル。

**🛣️ 道路注意（Stage 1 v6.2 と同じ）**: 各チャンクの道路指定は **コンセプトに沿って都度設計**。固定するのは `_AVE`（x=0）のみ。

</aside>

## Act I — 駅前繁華

### Ch0: 終電後の地方駅と北口ロータリー

**ヒーロー / アンビエント**: **NE = ヒーロー**（train_station + 駅前広場、基本形 A）/ NW・SW・SE = アンビエント（ホテル / 飲食 / 住宅）

**NE ヒーロー 4 層**:
- **焦点**: `train_station` (x=80, y=22) + `platform_edge` (x=80, y=70) + `railway_track` × 3 (y=78-86)
- **取り巻き（駅前広場）**: `bus_stop` × 2 (x=30/130, y=68)、`taxi_rank_sign` (x=130, y=72)、`bench` × 3 (準対称、x=20/65/120, y=85)
- **境界**: `flag_pole` (x=10, y=62)、`flower_planter_row` × 2 (x=80, y=60 / y=92)、`bollard` (x=160, y=92)
- **動線**: 駅前 `asphalt` 大パッチ、`manhole_cover` × 2、`street_lamp` × 2 (x=20/140, y=88)

**アンビエント 3 セル**:
- **NW**: `business_hotel` (x=-130, y=22) + `sign_board` (青) + `mailbox` (痕跡)
- **SW**: `ramen` (x=-100, y=130) + `chouchin` × 2 + `noren` + `bicycle` (痕跡)
- **SE**: `convenience` (x=130, y=130) + `shop_awning` + `vending` + `bicycle_rack`

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board`（business_hotel 大、ramen 中、convenience 小）
- **焦点囲み**: 駅前広場の bench × 3、flag_pole、flower_planter_row
- **歩道沿い** (avenue 両脇): `street_lamp` × 4、`bollard` × 4

**人配置**: 終電客（adult_m × 多 7-8 人、駅前広場・avenue を歩く）、待ち客（adult_f × 2、bench）、駅員（adult_m × 1、改札）、cat × 2 (NW 業務側、SE 裏)

**地面パッチ**:
- 基調: `asphalt` 全面
- NE 焦点: `concrete` 駅舎前 (x=80, y=80, 180×120)、`tile` ホーム部分 (x=80, y=70, 80×20)
- 歩道帯: `stone_pavement` (x=-65, y=100, 12×200) 継続軸
- ロット: `concrete` (NW business_hotel)、`tile` (SE convenience)、`asphalt` (SW ramen)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（追加なし、駅前は asphalt 大パッチで広場化）

**生活の痕跡 / スケール / 向き**:
- **痕跡**: NW `mailbox`、NE `newspaper_stand`、SW `bicycle`、SE `garbage` — 4 セル全て痕跡 ✅
- **スケール**: 大 `train_station` / 中 `business_hotel` × 1・`ramen` × 1・`convenience` × 1 / 小 `bench` × 3・`bollard` × 4・`mailbox` × 3 — 1:3:20 比
- **向き**: bench は train_station 向き、flag_pole は avenue 向き、taxi_rank_sign は道路向き

**Handoff (Stage 1 Ch11 → Stage 2 Ch0)**:
- **並木**: Stage 1 の `pine_tree` (Ch11) → Stage 2 では並木なし。代わりに `street_lamp` ネオン列が連続軸開始
- **歩道**: `stone_pavement` (x=-65) 帯継続
- **電柱/電線**: `power_pole` × 4 (4 隅 y=5/195) 対 + `power_line` × 2
- **予兆**: 駅舎の上空で `power_line` が密、cable_junction_box が増えていく Act II の予告

**TS スケルトン（例示）**:

```ts
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  };
  // NE ヒーロー: train_station
  const station = $B(out, 'train_station', 80, 22);
  const platform = $F(out, 'platform_edge', 80, 70);
  const track = $F(out, 'railway_track', 80, 78);
  // ... (12 chunks 分は実装時に肉付け)
  _CLUSTER(out, {
    id: 'ch0.NE.station', role: 'hero', cell: 'NE',
    focal: station, companions: [platform, track, /* bus_stop refs */],
    boundary: [/* flag_pole, planter */],
    access: [/* manhole, lamp */],
    livingTrace: /* newspaper_stand */ { kind: 'f', i: 0 } as any,
  });
  return out;
})() },
```

### Ch1: 終電後の食事街（ramen / izakaya / karaoke 3 連）

**ヒーロー / アンビエント**: **SW = ヒーロー**（基本形 C: 3 連飲食店）/ NW・NE・SE = アンビエント

**SW ヒーロー 4 層**:
- **焦点**: `ramen` (x=-145, y=128) + `izakaya` (x=-95, y=128) + `karaoke` (x=-35, y=128) の 3 連（dy 揃え）
- **取り巻き（各店）**: 各店 `chouchin` × 2 (店前 y=120 / y=135) + `noren` (y=125) + `a_frame_sign` (y=148)
- **境界**: `bollard` × 2 (x=-160 / -10, y=110)、`flower_planter_row` × 2 (店間に)
- **動線**: `street_lamp` × 2 (x=-90 / -10, y=130)、`puddle_reflection` × 3 (店前 y=145)

**アンビエント 3 セル**:
- **NW**: `business_hotel` (x=-130, y=22) + `sign_board` (青) + `mailbox` (痕跡)
- **NE**: `convenience` (x=110, y=22) + `vending` × 2 + `bicycle_rack` (痕跡: bicycle)
- **SE**: `townhouse` × 2 (x=80/140, y=130) + `mailbox` × 2 + `cat` (痕跡)

**人配置**: 飲み客（adult_m × 6 が ramen/izakaya/karaoke 各店前）、サラリーマン × 2 (avenue 歩く)、客引き × 1 (Ch1 SE 端)、cat × 1 (Ch SE)

**地面パッチ**:
- 基調: `asphalt`
- SW 焦点: `concrete` 3 連店前 (x=-90, y=145, 160×40)
- アクセント: `puddle_reflection` × 3 が店前歩道に散在

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（追加なし）

**Handoff (Ch0 → Ch1)**:
- **並木**: なし（並木は Stage 1 で終了）
- **歩道**: `stone_pavement` (x=-65) 帯継続
- **電柱/電線**: 4 隅で対
- **予兆**: SW ヒーローの 3 連店が Ch2 商店街アーケードへ繋がる（chouchin 帯が連続）

### Ch2: 商店街アーケード入口（merged hero）

**ヒーロー**: **NW+NE merged = ヒーロー**（提灯ガーランドの大アーケード）/ SW・SE = アンビエント

**merged ヒーロー 4 層**:
- **焦点**: `shotengai_arcade` (x=-118, y=22) + `shotengai_arcade` (x=118, y=22) の 2 棟が左右両端でアーケードのゲートを成す
- **取り巻き**: `chouchin` × 14 (avenue 全幅、y=22 連続帯) + `banner_pole` × 4 (各端、y=28)
- **境界**: `flag_pole` × 2 (中央 x=-30 / +30, y=12 上空)、`flower_planter_row` × 2 (左右端)
- **動線**: `street_lamp` × 4 (avenue 両脇)、`puddle_reflection` × 4 (avenue 中央)

**アンビエント**:
- **SW**: `pachinko` 予告 (x=-130, y=130) + `sign_board` (赤、ネオン) + `garbage` (痕跡)
- **SE**: `karaoke` 予告 (x=130, y=130) + `sign_board` (黄) + `bicycle` (痕跡)

**人配置**: 商店街客 × 多 (avenue 全幅、両側 y=92/108)、客引き × 2 (Ch2 SE)、cat × 1

**地面パッチ**: `asphalt` 全面、avenue 中央 `tile` (x=0, y=100, 360×24) — アーケード床

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR]`（Act 境界の予告として _TOP_HR を追加）

**Handoff (Ch1 → Ch2)**: chouchin 帯が連続、ramen/izakaya/karaoke の客が商店街へ流れる

---

## Act II — 歓楽街最盛期

### Ch3: 高層雑居ビル（karaoke / club / business_hotel）

**ヒーロー**: **NE = ヒーロー**（karaoke 大看板の縦帯）/ NW・SW・SE = アンビエント

**NE ヒーロー 4 層**:
- **焦点**: `karaoke` (x=130, y=22) + `apartment_tall` (x=80, y=22) の 2 棟で「高層雑居ビル」を成す
- **取り巻き**: `sign_board` (大、x=130, y=8 ファサード上端) × 1 + `chouchin` × 4 (店前 y=58) + `a_frame_sign` × 2 (1F 入口)
- **境界**: `bollard` × 3 (x=70/100/170, y=92)、`flag_pole` (x=130, y=12)
- **動線**: `street_lamp` × 2 (x=80/170, y=88)、`puddle_reflection` × 2 (store front y=110)

**アンビエント**:
- **NW**: `club` (x=-130, y=22) + `sign_board` (黒+金) + `parasol` (痕跡: recycling_bin)
- **SW**: `business_hotel` (x=-100, y=130) + `sign_board` (青) + `mailbox` (痕跡)
- **SE**: `mansion` × 2 (x=80/140, y=130) + 上層階窓表現 + `bicycle_rack` (痕跡)

**人配置**: ホスト/ホステス × 4 (NW club 周辺), 飲み客 × 5 (NE karaoke 周辺), サラリーマン × 3 (avenue), cat × 1

**地面パッチ**: `asphalt` 全面、NW club 前 `red_carpet` (-130, y=58, 60×20)、NE karaoke 前 `concrete` (130, y=58, 60×30)

**道路**: `verticalRoads: [_AVE, _VR(-90, 0, 100)]`（雑居ビル裏路地）/ `horizontalRoads: [_MID_HR]`

### Ch4: パチンコ + 交番交差点（merged hero / 全マージ）

**ヒーロー**: **全マージ merged = ヒーロー**（Stage 2 の視覚的ピーク）

**merged 4 層**:
- **焦点**: `pachinko` (x=-100, y=22) 大、`police_station` (x=0, y=130) 中央交番、`game_center` (x=100, y=22)
- **取り巻き**: `sign_board` (パチンコ巨大、x=-100, y=8) + `flag_pole` × 2 (交番前 x=-12/+12) + `traffic_cone` × 4 (交番前路上)
- **境界**: `bollard` × 6 (avenue 横断帯)、`barrier` × 2 (パチンコ前)
- **動線**: `street_lamp` × 4 (avenue), `street_mirror` × 2 (交差点)、`puddle_reflection` × 4

**人配置**: パチンコ客 × 6 (待ち列)、交番警察官 × 1、客引き × 3 (ホテル方向)、酔客 × 4、cat × 1

**地面パッチ**: `asphalt` 全面、パチンコ前 `tile` (x=-100, y=58, 90×40), 交番前 `concrete` (x=0, y=130, 80×40)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR]` — 4 方向交差点感

**Handoff**: パチンコ大看板 + 交番が Ch4 の中心、Ch5 飲み屋横丁への引き継ぎは avenue の chouchin 連続

### Ch5: 老舗飲み屋横丁（merged hero）

**ヒーロー**: **SW+SE merged = ヒーロー**（横丁感、3-4 連の小店並び）

**merged 下段 4 層**:
- **焦点**: `snack` × 2 (x=-160 / 60) + `mahjong_parlor` (x=-100, y=130) + `izakaya` (x=-30, y=130) の混在 4 軒
- **取り巻き**: 各店前 `chouchin` × 1 (y=125) + `noren` (y=128)、`a_frame_sign` × 3 (y=148 不揃い)
- **境界**: `wood_fence` × 2 (横丁の入口、x=-178/178, y=120)、`hedge` (x=20, y=145)
- **動線**: `street_lamp` × 3 (中央 + 端)、`puddle_reflection` × 5 (横丁感)

**アンビエント**:
- **NW**: `bank` (x=-130, y=22) + `flag_pole` + `atm` + `mailbox` (痕跡)
- **NE**: `capsule_hotel` (x=130, y=22) + `sign_board` + `vending` + `garbage` (痕跡)

**人配置**: 飲み客 × 8 (横丁狭い空間に密)、ママさん × 1 (snack 前)、cat × 2

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

---

## Act III — ホテルと屋台

### Ch6: ラブホテル街

**ヒーロー**: **NW = ヒーロー**（love_hotel の派手な看板）/ NE・SW・SE = アンビエント

**NW 4 層**:
- **焦点**: `love_hotel` (x=-110, y=22) 大 + `love_hotel` (x=-50, y=22) 小（2 軒並び）
- **取り巻き**: `sign_board` (ピンク大) × 1 + `parasol` × 2 (入口) + `flag_pole` (x=-110, y=8)
- **境界**: `hedge` × 4 (高め、目隠し用、x=-178/-178, y=10/50/90 / x=10, y=10/50)
- **動線**: `street_lamp` (x=-150, y=88)、`puddle_reflection` × 2

**アンビエント**:
- **NE**: `club` (x=130, y=22) + `sign_board` (黒+金) + `parasol`
- **SW**: `snack` (x=-130, y=130) + `chouchin` (ピンク) + `garbage` (痕跡)
- **SE**: `mahjong_parlor` (x=130, y=130) + `sign_board` (緑) + `bicycle` (痕跡)

**人配置**: カップル × 2 (NW)、ホステス × 2 (NE)、酔客 × 3 (SW snack)、cat × 1

**地面パッチ**: `asphalt`、NW love_hotel 前 `red_carpet` (-80, y=58, 100×40)

**道路**: `verticalRoads: [_AVE]`（追加なし）/ `horizontalRoads: [_MID_HR]`

### Ch7: 屋台横丁（merged hero）

**ヒーロー**: **NW+NE merged = ヒーロー**（屋台 5 連が中央集約、基本形 A オープンスペース）

**merged 4 層**:
- **焦点**: `yatai` × 5 (x=-100/-50/0/50/100, y=68 等間隔やや崩し: -105/-52/0/55/105)
- **取り巻き（屋台周辺）**: 各屋台 `chouchin` × 1 (上空 y=58) + `parasol` × 1、客 `bench` × 3 (準対称、屋台間)
- **境界**: `wood_fence` × 4 (横丁入口、avenue 端)、`flower_planter_row` × 2
- **動線**: `popcorn_cart` × 1 (西端)、`balloon_cluster` × 2 (上空)、`street_lamp` × 2

**アンビエント**:
- **SW**: `chaya` (x=-100, y=130) + `noren` + `cat` (痕跡)
- **SE**: `ramen` (x=100, y=130) + `chouchin` × 2 + `bicycle` (痕跡)

**人配置**: 屋台客 × 8 (各屋台 1-2 人)、屋台店主 × 3、酔客 × 2、cat × 1

**地面パッチ**: `asphalt` 基調、屋台中央 `red_carpet` (x=0, y=68, 220×30) 屋台床、店前 `concrete`

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: []`（横道路ゼロ：屋台の中央集約を活かす）

**Handoff**: yatai 連続が Ch8 movie_theater のネオン看板へ、chouchin 帯が継続

### Ch8: 映画館 + ミニシアター街

**ヒーロー**: **SE = ヒーロー**（movie_theater の大ポスター）/ NW・NE・SW = アンビエント

**SE 4 層**:
- **焦点**: `movie_theater` (x=130, y=130) 大
- **取り巻き**: `sign_board` (ポスター見立て、x=130, y=118) + `banner_pole` × 2 (左右、y=120) + `flag_pole` (x=130, y=128)
- **境界**: `flower_planter_row` × 2 (x=110/170, y=170)、`bollard` × 2 (x=80/180, y=140)
- **動線**: `street_lamp` × 2、`bench` × 2 (待ち客、x=110/150, y=148)

**アンビエント**:
- **NW**: `karaoke` (x=-130, y=22) + `sign_board` (黄)
- **NE**: `pachinko` (x=130, y=22) + `sign_board` (赤)
- **SW**: `mansion` (x=-100, y=130) + `mailbox` (痕跡)

**人配置**: 映画客 × 5 (SE)、酔客 × 3 (NW/NE)、cat × 1

---

## Act IV — 静寂への転換

### Ch9: 駐車場と裏通り（静寂転換の入口）

**ヒーロー**: **NE = ヒーロー**（コインパーキング、基本形 A オープンスペース）

**NE 4 層**:
- **焦点**: `parking` (x=130, y=68) 大駐車場
- **取り巻き**: `traffic_cone` × 4、`barrier` × 2、駐車車両 (`car` × 3、x=80/130/170, y=80)
- **境界**: `wood_fence` × 4 (区画)、`hedge` × 2
- **動線**: `street_lamp` × 1 (寂しい)、`vending` × 1 (孤立)

**アンビエント**:
- **NW**: 古い `house` × 2 + `mailbox` (痕跡)
- **SW**: `kura` (x=-130, y=130) + `garbage` (痕跡: 寂しさ表現)
- **SE**: `townhouse` × 2 + `cat` × 2 (痕跡: 静寂の主役)

**人配置**: 深夜の散歩客 × 1、cat × 4 (静寂の街の主役)

**地面パッチ**: `asphalt` 基調、駐車場 `oil_stained_concrete` (x=130, y=68, 100×80)

### Ch10: 古い住宅 + 神社の裏手

**ヒーロー**: **SW = ヒーロー**（神社の裏、stone_pavement 参道予告）/ NW・NE・SE = アンビエント

**SW 4 層**:
- **焦点**: `shrine` の小社 (x=-100, y=130) または `kura` 蔵 (神社蔵見立て)
- **取り巻き**: `stone_lantern` × 2 (準対称、x=-130/-70, y=145)、`bamboo_fence` × 3 (境界)
- **境界**: `hedge` × 4 (神社の輪郭)、`bamboo_water_fountain` (x=-70, y=158)
- **動線**: 参道 `stone_pavement` 帯 (x=-100, y=130, 12×80)、`fallen_leaves` ground × 3

**アンビエント**:
- **NW**: `kominka` × 1 (x=-130, y=22) + `noren` + `mailbox` (痕跡)
- **NE**: `townhouse` × 2 + `cat` × 1 (痕跡)
- **SE**: `shed` × 2 + `garbage` (痕跡)

**人配置**: 早朝散歩 × 1、cat × 3

**地面パッチ**: `asphalt` 残り、SW 神社 `stone_pavement` (-100, y=145, 80×80)、`fallen_leaves` × 3

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

### Ch11: 神社の表参道（Stage 3 への handoff）

**ヒーロー**: **NE = ヒーロー**（torii と表参道、Stage 3 への移行点）

**NE 4 層**:
- **焦点**: `torii` 鳥居 (x=80, y=22) ★ ランドマーク
- **取り巻き**: `sando_stone_pillar` × 2 (準対称、x=40/120, y=58)、`stone_lantern` × 2 (x=40/120, y=88)、`koma_inu` × 2 (x=60/100, y=68)
- **境界**: `bamboo_fence` × 6 (参道両側、x=10/150, y=10/50/90)
- **動線**: 参道 `stone_pavement` 帯 (x=80, y=100, 100×100)、`shinto_rope` (x=80, y=22 鳥居上)

**アンビエント**:
- **NW**: `chaya` (x=-100, y=22) + `noren` (Stage 3 予告) + `bicycle` (痕跡)
- **SW**: `kura` × 2 (x=-130/-70, y=130) + `wood_fence` + `garbage` (痕跡)
- **SE**: `kominka` (x=130, y=130) + `mailbox` (痕跡) + `cat`

**人配置**: 早朝参拝者 × 2 (NE 参道)、cat × 3 (静寂の主役)

**地面パッチ**: `asphalt` 縮小、NE 参道 `stone_pavement` (x=80, y=100, 100×100)、`fallen_leaves` × 4 (境内アクセント)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**Handoff (Ch11 → Stage 3 Ch0)**:
- **並木**: 桜 → 街灯 → 街灯のみ → Stage 3 でオフィス街路樹（街路樹 `tree`）に切替
- **歩道**: `stone_pavement` 神社参道帯が Stage 3 へ継続
- **電柱/電線**: 4 隅で対
- **予兆**: torii と stone_pavement が Stage 3 のオフィス街公共広場 (`stone_pavement` 大パッチ) を予告

---

# §8 変更履歴

- **v1.0（本版）**: Stage 2 「夜の歓楽街 NEON DISTRICT」の新規設計指示書。Stage 1 v6.3 のフォーマットを継承し、4 Acts × 12 チャンクで再配置を設計。実装の Stage 2 (10 chunks) は **コンセプトのみ引き継ぎ**、本指示書で 12 chunks に拡張・再配置する前提。chouchin / 暖簾 / puddle_reflection / 街灯ネオンを連続軸とし、Ch4 パチンコ+交番をクライマックスに、Ch11 神社で Stage 3 への handoff を作る構成。
