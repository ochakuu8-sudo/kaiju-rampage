# 怪獣ランページ — Stage 2 街レイアウト v1.3 Stage1形式準拠版

<aside>
📋

**このドキュメントの位置づけ（v1.3 Stage1形式準拠版）**

Stage 2「夜の歓楽街 NEON DISTRICT」の **再配置のための設計指示書**。Stage 1 v6.3 と同じフォーマット。

**Stage 1 v6.3 の §2 / §4 / §5 / §6 / §6.5 / §6.6 はそのまま継承**。Stage 2 では Stage 固有のコンセプト・取り巻き辞書・連続軸を §1 / §3 / §4.5 / §6.5 で書き直す。

**v1.2 で追加**: §4.6「ロット単位の物語デザイン」を新設。各セルを **2-4 ロットに分け、各ロットに 1 行のキャラを与え、建物・取り巻き・ground を物語で紐付ける** 設計法を明文化（Stage 1 Ch0「古民家邸 = kominka 母屋 + kura 蔵 + chaya 茶屋 + 庭」のような深さを再現）。§9 各チャンクに「ロット内訳」セクションを追加。

</aside>

<aside>
🌙

**Stage 2 のテーマ宣言**

Stage 1 末尾の踏切（Ch11）を越えると、街が **夜** に切り替わる。ネオンサインの色温度、濡れた路面の puddle_reflection、提灯の連続帯が支配する **夜の歓楽街**。プレイヤーは怪獣としてサラリーマン街→ラブホテル街→屋台横丁→静寂の神社へと進み、Stage 3「都心オフィス街」（朝）への引き渡しを担う。

**コアトーン**: 雑多 / 高密度 / 赤と青のネオン / 雨上がりの濡れた路面 / 提灯と暖簾の温かい光 / 看板の重なり

</aside>

<aside>
🆕

**v1.0 → v1.1 → v1.2 の変更点**

- **v1.0**: 方針確立。4 Acts × 12 chunks、SemanticCluster、`_AVE` 固定の道路ポリシー
- **v1.1（実装ラウンド）**: 密度目安「建物 20-30 / 家具 80-120 / 人 10-22 / ground 5-8」を満たすため建物・家具を 2.7-3.5 倍に増やし、ground 多様化を実施
- **v1.2（本版）**: **§4.6 ロット単位の物語デザインを新設**。Stage 1 Ch0 のような「邸 = 母屋+蔵+茶屋+庭」レベルの **ロット単位の意味付け** を Stage 2 にも要求。§9 各チャンクに「ロット内訳」を追加し、各セルを 2-4 ロットに分けて物語を宣言する形式に。`v1.1` の実装は密度を満たしたが「業種別建物の羅列」になっており、ロット間の関係性・地面差・境界が薄かった。本版でその不足を仕様レベルで補強する。

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

---
# §8 変更履歴

- **v1.0**: Stage 2 「夜の歓楽街 NEON DISTRICT」の新規設計指示書。Stage 1 v6.3 のフォーマットを継承し、4 Acts × 12 チャンクで再配置を設計。実装の Stage 2 (10 chunks) は **コンセプトのみ引き継ぎ**、本指示書で 12 chunks に拡張・再配置する前提。chouchin / 暖簾 / puddle_reflection / 街灯ネオンを連続軸とし、Ch4 パチンコ+交番をクライマックスに、Ch11 神社で Stage 3 への handoff を作る構成。
- **v1.1（実装ラウンド・履歴）**: 密度目安「建物 20-30 / 家具 80-120 / 人 10-22 / ground 5-8」に達するため、各 chunk の建物を平均 7 → 19.3、家具を 30 → 103.9、ground を 5 → 16.8 に強化（2.7-3.5 倍密度）。ground 多様化（asphalt + tile + concrete + wood_deck + red_carpet + stone_pavement + oil_stained_concrete + fallen_leaves + moss + gravel + grass + dirt 等を chunk ごと使い分け）。ただし「ロット単位の物語」が薄く、業種別建物の羅列に留まったため v1.2 で補強。
- **v1.2**: ロット物語強化版。Stage 1 Ch0「古民家邸 = kominka 母屋 + kura 蔵 + chaya 茶屋 + 庭」レベルの **ロット単位の意味付け** を Stage 2 にも要求するため、§4.6「ロット単位の物語デザイン」を新設。各セルを 2-4 ロットに分割し、各ロットに 1 行のキャラ宣言 + 建物 + 取り巻き + 個別 ground を要求。§9 全 12 chunks をロット内訳形式に。
- **v1.3（本版）**: Stage 1 v6.3 と完全に同じ §9 フォーマットに統一。v1.2 で追加した §4.6「ロット単位の物語デザイン」を撤回（Stage 1 にはロット概念がないため）。各セルを 4 層構造（焦点・取り巻き・境界・動線）+ アンビエント 3 セル + 取り巻き 3 パターン（facade 沿い / 焦点囲み / 歩道沿い）+ 人配置 + 地面パッチ + 道路 + 生活痕跡・スケール・向き + Handoff という Stage 1 と同じ項目で記述。1 chunk あたり 35-50 行程度に圧縮し、コードの可読性を優先。Stage 2 固有のキャラ感は §1 / §3 のテーマ宣言で扱い、§9 は配置仕様に専念。
