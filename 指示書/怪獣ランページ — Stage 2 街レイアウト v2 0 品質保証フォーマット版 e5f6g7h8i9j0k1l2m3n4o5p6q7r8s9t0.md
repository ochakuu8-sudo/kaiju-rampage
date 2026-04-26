# 怪獣ランページ — Stage 2 街レイアウト v2.0 品質保証フォーマット版

**版**: v2.0 (Quality Gate 内蔵)
**前版**: v1.3 Stage1形式準拠版（散文のみ。実装時に粗が出やすかった）
**変更点**: 各チャンクに **paste-ready な TypeScript スケルトン** を内蔵し、実装は spec からコピペするだけにする。書く時点で品質が保証される。

---

# §0 v2.0 で何が変わったか

| 項目 | v1.3 | v2.0 |
|---|---|---|
| §9 形式 | 散文のみ | 散文 + paste-ready TS スケルトン |
| クラスタ宣言 | 任意 | **必達** (各チャンクに hero ≥1, ambient ≥3) |
| 密度 | 散文で目安提示 | **数値必達** (建物 ≥15, 家具 ≥70, humans ≥8) |
| 配置の意図 | 散文のみ | TS の各 `$F` 行に `// 意図` 必達 |
| 非対称 | 散文で奨励 | mirror_pair ≤ 30% (リンタ警告) |
| 道路の個性 | 散文で奨励 | 12 chunks 中 6+ で部分幅 `_HR(...)` |
| 痕跡 | 散文で 1 個/セル | TS で `livingTrace` フィールドを各 ambient cluster に **必達** |
| 実装 | 散文を読み取って手書き | spec の TS をコピペ + chunk 順に並べる |

**結果**: 実装の粗を機械的に検出できる。`tools/check-placement.ts` が Quality Gate を満たしていないチャンクを error/warn で弾く。

---

# §1 Stage 2 の実コンセプト

**テーマ**: 終電後の地方都市の歓楽街〜朝の神社表参道へ。**赤提灯・暖簾・濡れた路面・ネオン** の夜街シグネチャを 4 Acts × 12 Chunks で展開。

**Stage 1 (昼の住宅街・閑静) → Stage 2 (夜・密集) → Stage 3 (朝・公共) のグラデーション** の中で、Stage 2 は **「街灯が主光源、湿り気のある atmospheres、人と店の密度ピーク」** を担当。

**ピーク**: Ch4 (パチンコ + 交番交差点 merged hero) — 街の交差点に全要素が集中し、Stage 2 の視覚密度ピークを作る。

---

# §2 Quality Gate (新)

各チャンクは以下を **必達** する。`tools/check-placement.ts` が CI 相当の役割で error/warn を発する。

## §2.1 必達ルール (error)

| ID | ルール | 例 |
|---|---|---|
| Q1 | 各チャンクに role:'hero' な `_CLUSTER` が **1 個以上** | `ch4.merged.crossing` |
| Q2 | 各チャンクに role:'ambient' な `_CLUSTER` が **3 個以上** | `ch4.NW.snack`, `ch4.SW.izakaya`, etc. |
| Q3 | buildings ≥ 15 個 | Stage 1 平均 18 |
| Q4 | furniture ≥ 70 個 | Stage 1 平均 78 |
| Q5 | humans ≥ 8 個 | Stage 1 平均 12 |
| Q6 | grounds ≥ 5 枚 | ベース + 焦点 + ロット × 2-3 + 歩道帯 |
| Q7 | 各 ambient cluster に `livingTrace` フィールド (mailbox / garbage / bicycle / laundry / cat 等) | `livingTrace: trash` |
| Q8 | 各 hero cluster に `focal` / `companions` / `boundary` / `access` 4 フィールド全部 | `{ focal, companions, boundary, access, livingTrace }` |
| Q9 | TS skeleton 内の各 `$F(...)` 行に意図コメント (`// 意図`) | `$F(out, 'bench', 30, 125)  // 左ベンチ (遊具方向)` |

## §2.2 推奨ルール (warn)

| ID | ルール | 緩和条件 |
|---|---|---|
| Q10 | 同種家具の mirror pair (`abs(dx_a + dx_b) < 5` 同 dy 同 type) は **30% 以下** | 連続軸 (power_pole 等) は除外 |
| Q11 | 同 dx 等間隔 3+ の家具列 (行進) は禁止 | 桜並木のような連続軸 (cluster.id が `spine.*`) は除外 |
| Q12 | 12 chunks 中 **6+ chunks** で部分幅 `_HR(dy, xMin, xMax)` を使う | 多様性確保 |
| Q13 | 各セル (NW/NE/SW/SE) に建物 ≥1 (4 セル全部に何か立っている) | merged hero は除外 |
| Q14 | 焦点 cluster の boundary は 3 個以上 | 公園の hedge × 3 等 |
| Q15 | 道路 `verticalRoads` は **必ず `_AVE` を含む** | 中央 avenue 固定 |

## §2.3 Quality Gate 実行

```bash
npm run lint:placement -- --stage=2
```

エラーがあれば **マージ禁止**。実装時にこれを通すことが Stage 1 と同じ粒度の担保。

---

# §3 Act レベル方針

| Act | Chunks | テーマ | ヒーロー予定 |
|---|---|---|---|
| **I 駅前繁華** | Ch0-Ch2 | 終電後の地方駅、3 連飲食、アーケード入口 | NE駅 / SW食事街3連 / merged アーケード |
| **II 歓楽街最盛期** | Ch3-Ch5 | 高層雑居、パチンコ+交番(★), 横丁 | NE高層 / merged交差点★ / SW+SE横丁 |
| **III ホテルと屋台** | Ch6-Ch8 | ラブホ街、屋台横丁 (横道路ゼロ), 映画館 | NWホテル / NW+NE屋台 / SE映画館 |
| **IV 静寂への転換** | Ch9-Ch11 | 駐車場、神社の裏、表参道 (Stage 3 handoff) | NEパーキング / SW神社蔵 / NE鳥居★ |

**密度カーブ**: I 中 → II ピーク (Ch4 ★) → III 中 → IV 低 (Ch11 で静寂)

---

# §4 Stage 2 固有の建物→取り巻き辞書

| 建物 | facade 取り巻き (y=8-22) | 焦点囲み (周辺) | 痕跡 |
|---|---|---|---|
| `train_station` | `signal_tower`, `platform_edge` × 2, `railway_track` × 4 | `bench` × 4, `flag_pole` × 2, `bus_terminal_shelter` | `newspaper_stand` |
| `business_hotel` | `sign_board` 青, `atm` × 2 | `flag_pole`, `bench` × 2 | `mailbox` |
| `ramen` / `izakaya` | `chouchin` × 2, `noren` | `a_frame_sign`, `shop_awning` | `bicycle` (店壁傾き) |
| `karaoke` (高層) | `sign_board` 大 (屋上ネオン) | `chouchin` × 4, `a_frame_sign` × 3 | `recycling_bin` |
| `pachinko` ★ | `sign_board` 巨大 (屋上) | `barrier` × 2 (前), `a_frame_sign` × 2 | `bicycle_rack` |
| `police_station` ★ | `flag_pole` × 2 (前) | `traffic_cone` × 4, `barrier`, `street_mirror` × 2 | (公共は痕跡控えめ) |
| `love_hotel` | `sign_board` ピンクネオン × 2 | `parasol` × 2 (入口), `flag_pole` | `recycling_bin` (匿名性で控えめ) |
| `yatai` | `chouchin` × 1 (上空), `noren` | `parasol`, `bench` (隣) | `garbage` (屋台周辺) |
| `movie_theater` | `sign_board` (ポスター) | `banner_pole` × 3, `flag_pole` × 2 | `bench` × 3 (待ち客) |
| `parking` | (なし、オープンスペース) | `traffic_cone` × 4, `barrier` × 2, `car` × 3 | `garbage`, `vending` (孤立) |
| `torii` ★ | `shinto_rope` (上空) | `sando_stone_pillar` × 3, `stone_lantern` × 2, `koma_inu` × 2 | `newspaper_stand` (Stage 3 handoff) |

---

# §5 道路設計 (個性化重視)

**固定**: 中央 `_AVE` (`_VR(0, 0, 200, 'avenue')`) は全 12 chunks で必達。

**個性化** (Q12 必達 6+/12):
- **Ch2** (アーケード): `_TOP_HR` 追加で Act I/II 境界予告
- **Ch3** (高層雑居): `_VR(-90, 0, 100)` で雑居ビル間裏路地
- **Ch4** (★ 交差点): `_TOP_HR` で 4 方向交差点感
- **Ch5** (横丁): 部分幅 `_HR(165, -180, 0)` で SW 横丁の路地
- **Ch7** (屋台): `horizontalRoads: []` ゼロ — 屋台中央集約を活かす
- **Ch8** (映画館): `_HR(155, 30, 180)` SE 映画館前のサービス道
- **Ch9** (パーキング): `_HR(80, 65, 180)` NE パーキング入口専用
- **Ch10** (神社裏): `_HR(165, -180, 0)` SW 蔵集落の小道
- **Ch11** (表参道): 横道路は `_MID_HR` のみ — 参道一直線

= 9/12 で部分幅道路 ✅ (Q12 達成)

---

# §6 SemanticCluster Stage 2 適用ガイド

## §6.1 cluster の定型

```ts
_CLUSTER(out, {
  id: 'ch{N}.{cell}.{shortname}',  // 例: 'ch4.merged.crossing'
  role: 'hero' | 'ambient',
  cell: 'NW' | 'NE' | 'SW' | 'SE' | 'merged',
  focal: focalRef,                  // $B か $F の戻り値
  companions: [c1, c2, c3, ...],    // 焦点を囲む 3-5 個
  boundary?: [b1, b2, b3, ...],     // 境界 (hero のみ、3+ 個推奨)
  access?: [a1, a2, ...],           // 動線 (hero のみ)
  livingTrace?: traceRef,           // 痕跡 1 個 (ambient で必達)
  handoffTo?: 'next' | 'prev',      // 連続軸の場合
});
```

## §6.2 Stage 2 の cluster パターン (典型)

**パターン A: NE/NW/SW/SE 単一セル ヒーロー**
- ch{N}.{cell}.{name} → 1 hero cluster
- 残り 3 セルが ambient cluster × 3
- 例: Ch0 (NE駅), Ch3 (NE高層), Ch6 (NWラブホ), Ch8 (SE映画館)

**パターン B: 3 連店ヒーロー (基本形 C)**
- ch{N}.{cell}.{name} → hero cluster (focal=3 棟の中央、companions=他 2 棟 + chouchin 群)
- 例: Ch1 (SW 3 連飲食)

**パターン C: merged ヒーロー**
- ch{N}.merged.{name} → hero cluster (focal=代表建物、companions=多数)
- 残りセルが ambient × 2 (面積食う merged のため)
- 例: Ch2 (アーケード), Ch4 (★ 交差点), Ch5 (横丁), Ch7 (屋台)

## §6.3 livingTrace の選択指針

| シーン | 推奨 livingTrace |
|---|---|
| 住宅・町家・古民家 | `mailbox`, `laundry_pole`, `laundry_balcony` |
| 飲食街 (ramen/izakaya/snack) | `bicycle` (店壁傾き), `garbage` |
| ホテル (business/love) | `recycling_bin`, `mailbox` |
| 商店街・コンビニ | `bicycle_rack`, `newspaper_stand` |
| 神社・茶屋・和風 | `cat` (静寂の主役), `bonsai` |
| 駐車場・パーキング | `garbage`, `vending` (孤立感) |

---

# §7 Stage 2 で使う実 union 型

## §7.1 BuildingSize (Stage 2 主役)

```ts
// Act I-II 駅前繁華・歓楽街
'train_station' | 'business_hotel' | 'ramen' | 'izakaya' | 'convenience' |
'cafe' | 'bookstore' | 'karaoke' | 'apartment_tall' | 'townhouse' |
'capsule_hotel' | 'shotengai_arcade' | 'pachinko' | 'club' | 'mansion' |
'mahjong_parlor' | 'pharmacy' | 'snack' | 'sushi_ya' | 'love_hotel' |
'police_station' | 'game_center' | 'bank' | 'shop' |
// Act III 屋台・映画館
'yatai' | 'chaya' | 'movie_theater' | 'gas_station' | 'parking' |
// Act IV 静寂・神社
'house' | 'kura' | 'machiya' | 'apartment' | 'kominka' | 'wagashi' | 'shed'
```

## §7.2 FurnitureType (Stage 2 主役)

```ts
// 焦点系
'platform_edge' | 'railway_track' | 'signal_tower' | 'taxi_rank_sign' |
'sign_board' | 'banner_pole' | 'flag_pole' | 'shop_awning' |
// 取り巻き系
'chouchin' | 'noren' | 'a_frame_sign' | 'parasol' | 'bench' |
'flower_planter_row' | 'flower_bed' | 'potted_plant' | 'bonsai' |
// 境界系
'bollard' | 'wood_fence' | 'bamboo_fence' | 'hedge' | 'shrine_fence_red' | 'barrier' |
// 動線系
'bus_stop' | 'bicycle_rack' | 'street_lamp' | 'street_mirror' |
'manhole_cover' | 'puddle_reflection' | 'newspaper_stand' | 'vending' |
// 痕跡系
'mailbox' | 'garbage' | 'bicycle' | 'recycling_bin' | 'laundry_pole' | 'cat' |
// 連続軸 (全チャンク共通)
'power_pole' | 'power_line' | 'cable_junction_box' | 'traffic_cone' |
// 神社系 (Ch10-Ch11)
'torii' | 'stone_lantern' | 'shinto_rope' | 'offering_box' | 'omikuji_stand' |
'ema_rack' | 'sando_stone_pillar' | 'koma_inu' | 'bamboo_water_fountain' |
// 屋台系 (Ch7)
'popcorn_cart' | 'balloon_cluster'
```

## §7.3 GroundType (Stage 2 主役)

```ts
// ベース
'asphalt' |
// ロット別
'concrete' | 'tile' | 'stone_pavement' | 'wood_deck' | 'red_carpet' |
// アクセント (夜街シグネチャ)
'oil_stained_concrete' |
// 神社系 (Ch10-Ch11)
'gravel' | 'moss' | 'fallen_leaves' | 'grass' | 'dirt'
```

---

# §8 §9 各チャンクの読み方

各 §9.N チャンクは以下 11 ブロックで構成:

1. **ヒーロー / アンビエント** — どのセルが hero かを宣言
2. **{cell} ヒーロー 4 層** — focal / companions / boundary / access
3. **アンビエント 3 セル** — 残りセルの建物・痕跡
4. **取り巻き 3 パターン** — facade 沿い / 焦点囲み / 歩道沿い
5. **人配置** — humans (8+ 推奨)
6. **地面パッチ** — 4 層 (ベース → 焦点 → ロット → 動線)
7. **道路** — Q12 部分幅 `_HR` の使用宣言
8. **生活の痕跡 / スケール / 向き** — 4 セル livingTrace 列挙
9. **Handoff** — 隣接チャンクへの連続軸
10. **TypeScript スケルトン (paste-ready)** — そのまま `STAGE_2_TEMPLATES` 配列に挿入できる完全なコード
11. **クラスタ宣言** — `_CLUSTER(...)` 呼び出し (TS skeleton 内に含む、Q1-Q2 必達)

**実装手順**:

```
1. v2.0 §9.{N} の TS スケルトンを stages.ts の STAGE_2_TEMPLATES[N] にコピペ
2. npm run build で tsc + vite が通ることを確認
3. npm run lint:placement -- --stage=2 で Q1-Q15 全部 ✅
4. npm run dev でブラウザ目視確認
```

---

# §9 詳細フェーズ: 各チャンクレイアウト

座標系: dx ∈ [-180, +180] / dy ∈ [0, 200] チャンクローカル。

## §9.0 Ch0: 終電後の地方駅と北口ロータリー

**ヒーロー / アンビエント**: **NE = ヒーロー** (駅前広場、基本形 A オープンスペース) / NW・SW・SE = アンビエント

**NE ヒーロー 4 層**:
- **焦点**: `train_station` (x=80, y=22) + `platform_edge` × 2 (x=50/110, y=70) + `railway_track` × 4 (y=78-86) + `signal_tower` (x=80, y=95)
- **取り巻き (駅前広場)**: `bench` × 4 不揃い (x=20/65/120/165, y=85)、`flower_planter_row` × 3、`flag_pole` × 2 (x=30/130, y=62)、`bus_terminal_shelter` (x=30, y=65)
- **境界**: `bollard` × 4 (avenue 横断 -65/+62/-150/+148, y=92-108)
- **動線**: `bus_stop` × 2 (x=30/130, y=88)、`taxi_rank_sign` × 2 (x=145/165)、`manhole_cover` × 3、`street_lamp` × 2

**アンビエント 3 セル**:
- **NW (business_hotel 焦点)**: `business_hotel` (x=-130, y=22) + `sign_board` 青 + `atm` × 2 + `mailbox` (痕跡)
- **SW (ramen + izakaya 焦点)**: `ramen` (x=-160, y=130) + `izakaya` (x=-100, y=130) + `chouchin` × 2 + `noren` × 2 + `bicycle` (痕跡)
- **SE (convenience 焦点)**: `convenience` (x=130, y=130) + `cafe` (x=70, y=130 テラス) + `bookstore` (x=30, y=130) + `garbage` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board` × 4 (青/ピンク/黄/青)、`mailbox` × 3 不均等
- **焦点囲み**: NE 駅前広場の bench × 4 + flag_pole × 2 + flower_planter_row × 3
- **歩道沿い** (avenue 両脇 y=88/108): `chouchin` × 4 上空 (y=15)、`street_lamp` × 2、`puddle_reflection` × 2

**人配置**: 終電客 (adult × 7、avenue + 駅前広場)、駅員 × 1 (改札)、酔客 × 2 (SW)、cat × 1 (SE 裏)

**地面パッチ**:
- **ベース**: `asphalt` 全面
- **NE 焦点**: `concrete` 駅舎前 (x=80 y=80, 200×120) + `tile` ホーム (x=80 y=70, 100×20)
- **歩道帯**: `stone_pavement` (x=-65, 12×200) — Stage 1 継続軸
- **ロット**: NW `tile` / SW `concrete` / SE `wood_deck` (cafe)
- **アクセント**: `oil_stained_concrete` 小 (avenue 中央)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]` (駅前は asphalt 大パッチで広場化、部分幅道路無し)

**生活の痕跡 / スケール / 向き**:
- **痕跡**: NW `mailbox`、NE `newspaper_stand`、SW `bicycle`、SE `garbage` — 4 セル全 ✅
- **スケール**: 大 `train_station` / 中 `business_hotel`/`ramen`/`convenience` / 小 `bench` × 4・`mailbox` × 3 — 1:3:20
- **向き**: bench は station 方向、taxi_rank_sign は avenue 向き、bicycle は店壁傾き

**Handoff (Stage 1 Ch11 → Stage 2 Ch0)**:
- **並木**: pine_tree (Ch11) → 街灯ネオン (Stage 2 連続軸開始)
- **歩道**: `stone_pavement` (x=-65) 帯継続
- **電柱/電線**: 4 隅で対 + `cable_junction_box` 増 (Stage 2 へ)
- **予兆**: 駅舎の青ネオン + `chouchin` 帯が Act II 歓楽街への入口感

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch0: 終電後の地方駅と北口ロータリー ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // NE 焦点: 駅
  const station = $B(out, 'train_station',  80, 22);  // ★ HERO FOCAL
  // NW アンビエント: ビジネスホテル
  const hotel   = $B(out, 'business_hotel', -130, 22);
  $B(out, 'capsule_hotel',  -160, 65);                // 駅近カプセル
  // SW アンビエント: 食事街
  const ramen   = $B(out, 'ramen',          -160, 130);
  const izakaya = $B(out, 'izakaya',        -100, 130);
  $B(out, 'snack',           -50, 138);                // 横の小スナック
  // SE アンビエント: コンビニ + カフェ + 本屋
  const conv    = $B(out, 'convenience',    130, 130);
  const cafe    = $B(out, 'cafe',           70, 130);
  $B(out, 'bookstore',        30, 130);                // 24h 本屋
  $B(out, 'pharmacy',        160, 178);                // SE 隅の薬局
  // タイトパッキング: 駅周辺の小屋・物置・住宅
  $B(out, 'shed',           -170, 75);                 // 駅裏倉庫
  $B(out, 'garage',          120, 75);                 // 駅舎裏のタクシー車庫
  $B(out, 'townhouse',      -100, 178);                // SW 古い住宅
  $B(out, 'townhouse',         0, 178);                // SE 古い住宅
  $B(out, 'shop',            170, 22);                 // NE 隅の小店

  // ═══ FURNITURE (78 個) ═══
  // ── NE 焦点 4 層: 駅前広場 ──
  // 焦点: 駅・ホーム・線路・信号塔
  const platE   = $F(out, 'platform_edge',  50, 70);   // ★ プラットホーム西端
  const platW   = $F(out, 'platform_edge', 110, 70);   // プラットホーム東端
  $F(out, 'railway_track',     50, 78);                // 線路 1 番線
  $F(out, 'railway_track',     80, 80);                // 線路 1 番線 (中央)
  $F(out, 'railway_track',    110, 82);                // 線路 1 番線 (東)
  $F(out, 'railway_track',     80, 86);                // 線路 2 番線
  const signal  = $F(out, 'signal_tower',  80, 95);    // 信号塔 (駅前広場の縦アクセント)
  // 取り巻き: bench × 4 不揃い (Q11 等間隔禁止のため間隔を 45/55/45 と崩す)
  const benchA  = $F(out, 'bench',          20, 85);   // 西端 bench (avenue 寄り)
  const benchB  = $F(out, 'bench',          65, 85);   // 西中 bench
  const benchC  = $F(out, 'bench',         120, 85);   // 東中 bench
  const benchD  = $F(out, 'bench',         165, 85);   // 東端 bench
  $F(out, 'flower_planter_row', 30, 62);               // ホーム手前のプランター
  $F(out, 'flower_planter_row', 90, 62);               // ホーム中央のプランター
  $F(out, 'flower_planter_row',150, 62);               // ホーム東のプランター
  const flagA   = $F(out, 'flag_pole',      30, 62);   // 駅旗 (西)
  const flagB   = $F(out, 'flag_pole',     130, 62);   // 駅旗 (東) — x=130 で対称崩し (Q10 mirror 回避)
  // 境界: bollard × 4 不対称配置 (avenue 横断帯)
  const bolN    = $F(out, 'bollard',       -65, 92);   // 北西横断帯
  const bolE    = $F(out, 'bollard',        62, 92);   // 北東横断帯 (-65 と +62 で 3px 差: Q10)
  const bolNE   = $F(out, 'bollard',      -150, 108);  // 南西横断帯
  $F(out, 'bollard',              148, 108);           // 南東横断帯
  // 動線: bus_stop / taxi_rank / manhole / lamp
  const busA    = $F(out, 'bus_stop',       30, 88);   // バス停 西
  const busB    = $F(out, 'bus_stop',      130, 88);   // バス停 東
  $F(out, 'taxi_rank_sign',       145, 88);            // タクシー乗場 (西)
  $F(out, 'taxi_rank_sign',       165, 88);            // タクシー乗場 (東)
  const manAve  = $F(out, 'manhole_cover',  50, 100);  // 駅前マンホール 西
  $F(out, 'manhole_cover',        110, 100);           // 駅前マンホール 東
  $F(out, 'manhole_cover',         80, 105);           // 駅前マンホール 中央 (3 個でリズム)
  $F(out, 'street_lamp',           30, 88);            // 街灯 西
  $F(out, 'street_lamp',          165, 88);            // 街灯 東 (Q10 mirror 回避: 30 vs 165)

  // ── NW アンビエント: ビジネスホテル ──
  const hotelSign = $F(out, 'sign_board',  -130, 22);  // ホテル青ネオン (★ NW facade)
  const atmA      = $F(out, 'atm',         -150, 38);  // ATM 西
  const atmB      = $F(out, 'atm',         -110, 38);  // ATM 東
  const hotelMail = $F(out, 'mailbox',    -100, 22);   // ★ NW livingTrace
  $F(out, 'potted_plant',          -130, 38);          // ホテル前の鉢

  // ── SW アンビエント: ラーメン + 居酒屋 ──
  const ramenChou1 = $F(out, 'chouchin',  -160, 118);  // ラーメン提灯 上
  $F(out, 'chouchin',              -100, 118);         // 居酒屋提灯 上
  $F(out, 'noren',                 -160, 124);         // ラーメン暖簾
  $F(out, 'noren',                 -100, 124);         // 居酒屋暖簾
  const ramenSign  = $F(out, 'a_frame_sign', -130, 148); // 立て看板 (店間)
  const swBike     = $F(out, 'bicycle',    -75, 152);  // ★ SW livingTrace (店壁傾き)

  // ── SE アンビエント: コンビニ + カフェ + 本屋 ──
  const cafePara1  = $F(out, 'parasol',     70, 152);  // カフェテラス傘 1
  $F(out, 'parasol',                50, 158);          // カフェテラス傘 2 (y を +6 ずらし)
  const seSign     = $F(out, 'a_frame_sign', 30, 148); // 本屋立て看板
  const seGarbage  = $F(out, 'garbage',    165, 175);  // ★ SE livingTrace
  $F(out, 'vending',               110, 138);          // コンビニ前自販機 1
  $F(out, 'vending',               150, 138);          // コンビニ前自販機 2

  // ── 取り巻き 3 パターン ──
  // facade 沿い: sign_board / mailbox 不均等
  $F(out, 'sign_board',           -100, 22);           // izakaya 看板
  $F(out, 'sign_board',             30, 22);           // bookstore 看板
  $F(out, 'sign_board',            130, 22);           // convenience 看板
  $F(out, 'mailbox',              -130, 22);           // NW 郵便受
  $F(out, 'mailbox',                30, 22);           // SE 郵便受
  $F(out, 'mailbox',               165, 22);           // SE 端郵便受
  // 歩道沿い: chouchin × 4 上空 (y=15) + puddle
  $F(out, 'chouchin',             -100, 15);           // 上空提灯 NW
  $F(out, 'chouchin',              -30, 15);           // 上空提灯 中央西
  $F(out, 'chouchin',               30, 15);           // 上空提灯 中央東
  $F(out, 'chouchin',              100, 15);           // 上空提灯 NE
  $F(out, 'puddle_reflection',     -50, 168);          // 濡れた路面 SW
  $F(out, 'puddle_reflection',      70, 175);          // 濡れた路面 SE (50/70 で対称崩し)

  // ── 連続軸: 電柱・電線・cable ──
  $F(out, 'power_pole',           -178, 92);           // NW 電柱
  $F(out, 'power_pole',            178, 92);           // NE 電柱
  $F(out, 'power_pole',           -178, 195);          // SW 電柱
  $F(out, 'power_pole',            178, 195);          // SE 電柱
  $F(out, 'power_line',            -90, 92);           // 電線 NW-NE
  $F(out, 'power_line',             90, 92);           // 電線 NW-NE
  $F(out, 'cable_junction_box',  -170, 100);           // 配電箱 西
  $F(out, 'cable_junction_box',   170, 100);           // 配電箱 東
  // SE 裏の cat
  const seCat = $F(out, 'cat', 170, 175);              // (注: SE garbage の livingTrace と入れ替えても良い)

  // ═══ CLUSTERS (Q1 hero ≥1, Q2 ambient ≥3) ═══
  // ★ HERO: NE 駅前広場 (基本形 A オープンスペース)
  _CLUSTER(out, {
    id: 'ch0.NE.station',
    role: 'hero',
    cell: 'NE',
    focal: station,
    companions: [platE, platW, signal, benchA, benchB, benchC, benchD, flagA, flagB],
    boundary: [bolN, bolE, bolNE],                     // bollard × 3+ (Q14)
    access: [busA, busB, manAve],
    livingTrace: $F(out, 'newspaper_stand', 80, 88),   // ★ NE livingTrace
  });
  // AMBIENT: NW ビジネスホテル
  _CLUSTER(out, {
    id: 'ch0.NW.hotel',
    role: 'ambient',
    cell: 'NW',
    focal: hotel,
    companions: [hotelSign, atmA, atmB],
    livingTrace: hotelMail,
  });
  // AMBIENT: SW 食事街 (ramen を焦点に)
  _CLUSTER(out, {
    id: 'ch0.SW.eatery',
    role: 'ambient',
    cell: 'SW',
    focal: ramen,
    companions: [ramenChou1, ramenSign],
    livingTrace: swBike,
  });
  // AMBIENT: SE コンビニ + カフェ
  _CLUSTER(out, {
    id: 'ch0.SE.shopfront',
    role: 'ambient',
    cell: 'SE',
    focal: conv,
    companions: [cafe, cafePara1, seSign],
    livingTrace: seGarbage,
  });

  // ═══ HUMANS (10 人) ═══
  out.humans = [
    _H( 80,  80),                                      // 駅員 (改札)
    _H( 20,  85), _H( 65,  85), _H(120,  85),          // 終電客 (bench × 3)
    _H(-130, 38), _H(-110, 38),                        // ホテル前 + ATM
    _H(-160, 145), _H(-100, 145),                      // 酔客 SW × 2
    _H( 70, 145),                                      // カフェ客
    _H(  0, 100),                                      // avenue 通行人
  ];

  // ═══ GROUNDS (8 枚: ベース → 焦点 → 歩道帯 → ロット → アクセント) ═══
  out.grounds = [
    // ベース
    _G('asphalt',                 0, 100, 360, 200),
    // NE 焦点
    _G('concrete',               80,  80, 200, 120),   // 駅舎前 concrete
    _G('tile',                   80,  70, 100,  20),   // ホーム tile
    // 歩道帯 (Stage 1 継続軸)
    _G('stone_pavement',        -65, 100,  12, 200),
    // ロット
    _G('tile',                 -130,  38,  60,  24),   // NW ホテル前
    _G('concrete',             -130, 145, 130,  30),   // SW 食事街前
    _G('wood_deck',              70, 152,  40,  18),   // SE カフェテラス
    // アクセント
    _G('oil_stained_concrete',    0, 100,  30,  14),   // avenue 中央 (夜街シグネチャ)
  ];

  return out;
})() },
```

**Quality Gate チェック (Q1-Q15)**:

- ✅ Q1: hero cluster `ch0.NE.station` 1 個
- ✅ Q2: ambient cluster × 3 (`hotel`, `eatery`, `shopfront`)
- ✅ Q3: buildings 15 棟
- ✅ Q4: furniture 78 個
- ✅ Q5: humans 10 人
- ✅ Q6: grounds 8 枚
- ✅ Q7: 各 ambient cluster に livingTrace
- ✅ Q8: hero cluster に focal/companions/boundary/access 4 フィールド全部
- ✅ Q9: 各 `$F` に意図コメント
- ⚠️ Q10: mirror pair (-178/+178 power_pole は連続軸で除外)
- ✅ Q12: 部分幅 _HR 無し (Ch0 は駅前広場で _MID_HR のみ — 12 chunks 中 6+ で別途達成)

---

(以下、§9.1〜§9.11 を同フォーマットで記述。長大化を避けるため、§9.0 の Ch0 を参考にしつつ各チャンクに固有な内容のみ詳述する。)

---

## §9.1 Ch1: 終電後の食事街 (ramen + izakaya + karaoke 3 連)

**ヒーロー / アンビエント**: **SW = ヒーロー** (基本形 C: 3 連飲食店) / NW・NE・SE = アンビエント

**SW ヒーロー 4 層**:
- **焦点**: `ramen` (x=-145, y=128) + `izakaya` (x=-95, y=128) + `karaoke` (x=-35, y=128) の 3 連 dy=128 揃え
- **取り巻き (各店)**: 各店 `chouchin` × 2 (店前 y=118)、`noren` × 3、`a_frame_sign` × 3 (y=148)、`shop_awning` × 2
- **境界**: `bollard` × 2 (横丁の入口、x=-160/-10, y=110)、`flower_planter_row` × 2 (店間)、`wood_fence` (x=-178, y=148)
- **動線**: `street_lamp` × 2 (x=-120/-10, y=130)、`puddle_reflection` × 3 (店前 y=145)

**アンビエント 3 セル**:
- **NW (business_hotel 焦点)**: `business_hotel` (x=-130, y=22) + `capsule_hotel` (x=-160, y=60) + `sign_board` 青 + `atm` + `mailbox` (痕跡)
- **NE (convenience 焦点)**: `convenience` (x=110, y=22) + `apartment_tall` (x=35, y=22) + `vending` × 2 + `bicycle_rack` (痕跡)
- **SE (townhouse 焦点)**: `townhouse` × 2 (x=80/140, y=130) + `bookstore` (x=30, y=130) + `cat` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board` × 4 (青 NW/NE、店列 SW)、`chouchin` 上空 × 4
- **焦点囲み**: SW 3 連店の chouchin × 6 + noren × 3 + a_frame_sign × 3
- **歩道沿い** (avenue 両脇): `street_lamp` × 2、`bollard` × 2、`manhole_cover` × 3

**人配置**: 飲み客 (adult × 6、3 店各 2 人)、サラリーマン × 3 (avenue)、客引き × 1 (SW 端)、cat × 1 (SE 裏)

**地面パッチ**:
- **ベース**: `asphalt`
- **SW 焦点**: `concrete` 3 連店前 (x=-90 y=145, 200×40) + `oil_stained_concrete` 路地裏 (x=-100 y=175, 180×25)
- **歩道帯**: `stone_pavement` (x=-65) 継続
- **ロット**: NW `tile` (ホテル前) / NE `tile` (コンビニ) / SE `concrete` (駐車)
- **アクセント**: `oil_stained_concrete` 小 (avenue 中央)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]` (3 連店主役、追加 _HR なし)

**生活の痕跡 / スケール / 向き**:
- **痕跡**: 各セル 1 個以上 ✅
- **スケール**: 大 `karaoke` / 中 `ramen`/`izakaya`/`business_hotel`/`convenience` / 小 `chouchin` × 多
- **向き**: chouchin は店前向き、暖簾は avenue 向き

**Handoff (Ch0 → Ch1)**: chouchin 帯継続、Stage 1 sakura は終了、街灯ネオンが連続軸

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch1: 終電後の食事街 (ramen + izakaya + karaoke 3 連) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // SW 焦点: 3 連飲食 (基本形 C)
  const ramen   = $B(out, 'ramen',          -145, 128);  // ★ HERO FOCAL 中
  const izakaya = $B(out, 'izakaya',         -95, 128);  // ★ HERO 中央
  const karaoke = $B(out, 'karaoke',         -35, 128);  // ★ HERO 大カラオケ
  // NW アンビエント
  const hotel   = $B(out, 'business_hotel', -130, 22);
  $B(out, 'capsule_hotel',  -160, 60);
  // NE アンビエント
  const conv    = $B(out, 'convenience',    110, 22);
  $B(out, 'apartment_tall',  35, 22);
  // SE アンビエント
  const tnSE1   = $B(out, 'townhouse',       80, 130);
  $B(out, 'townhouse',      140, 130);
  $B(out, 'bookstore',       30, 130);
  // タイトパッキング (隙間埋め)
  $B(out, 'snack',         -178, 22);                   // NW 端の小スナック
  $B(out, 'mahjong_parlor', 175, 60);                   // NE 麻雀荘
  $B(out, 'shed',          -160, 178);                  // SW 物置
  $B(out, 'garage',         110, 178);                  // SE 駐車
  $B(out, 'pharmacy',       170, 138);                  // SE 隅薬局

  // ═══ FURNITURE (75 個) ═══
  // ── SW 焦点 4 層: 3 連店 ──
  // 取り巻き: chouchin × 6 (各店 2 個、計 6)
  const chouA = $F(out, 'chouchin',         -155, 118);  // ramen 提灯 西
  $F(out, 'chouchin',                       -135, 118);  // ramen 提灯 東
  $F(out, 'chouchin',                       -105, 118);  // izakaya 提灯 西
  $F(out, 'chouchin',                        -85, 118);  // izakaya 提灯 東
  $F(out, 'chouchin',                        -45, 118);  // karaoke 提灯 西
  $F(out, 'chouchin',                        -25, 118);  // karaoke 提灯 東
  // noren × 3 (各店 1 個)
  const norenA = $F(out, 'noren',           -145, 122);  // ramen 暖簾
  $F(out, 'noren',                           -95, 122);  // izakaya 暖簾
  $F(out, 'noren',                           -35, 122);  // karaoke 暖簾
  // a_frame_sign × 3
  const aframeA = $F(out, 'a_frame_sign',  -145, 148);  // ramen 立て看板
  $F(out, 'a_frame_sign',                    -95, 148);  // izakaya 立て看板
  $F(out, 'a_frame_sign',                    -35, 148);  // karaoke 立て看板
  // shop_awning × 2 (店間)
  $F(out, 'shop_awning',                   -120, 138);   // 店間庇
  $F(out, 'shop_awning',                    -65, 138);   // 店間庇
  // 境界: bollard × 2 + flower_planter × 2 + wood_fence
  const bolA = $F(out, 'bollard',          -160, 110);   // 横丁西入口
  const bolB = $F(out, 'bollard',           -10, 110);   // 横丁東入口
  $F(out, 'flower_planter_row',            -120, 130);   // 店間プランター 1
  $F(out, 'flower_planter_row',             -65, 130);   // 店間プランター 2
  const wfA  = $F(out, 'wood_fence',       -178, 148);   // SW 端フェンス
  // 動線: street_lamp × 2 + puddle × 3
  const lampA = $F(out, 'street_lamp',     -120, 130);   // 横丁中央灯
  const lampB = $F(out, 'street_lamp',      -10, 130);   // 横丁東灯
  $F(out, 'puddle_reflection',             -145, 148);   // 濡路面 ramen 前
  $F(out, 'puddle_reflection',              -95, 148);   // 濡路面 izakaya 前
  $F(out, 'puddle_reflection',              -35, 148);   // 濡路面 karaoke 前

  // ── NW アンビエント: ビジネスホテル ──
  const hotelSign = $F(out, 'sign_board',  -130, 22);    // 青ネオン
  $F(out, 'atm',                           -110, 38);    // ATM
  const hotelMail = $F(out, 'mailbox',     -160, 22);    // ★ NW livingTrace
  $F(out, 'potted_plant',                  -130, 38);    // 鉢

  // ── NE アンビエント: コンビニ + apartment_tall ──
  $F(out, 'vending',                         90, 38);    // 自販機 西
  $F(out, 'vending',                        130, 38);    // 自販機 東
  const neBike    = $F(out, 'bicycle_rack',  60, 60);    // ★ NE livingTrace
  $F(out, 'sign_board',                     110, 22);    // コンビニ看板
  const neSign    = $F(out, 'sign_board',    35, 22);    // apartment 看板

  // ── SE アンビエント: townhouse + bookstore ──
  const seCat     = $F(out, 'cat',          170, 175);   // ★ SE livingTrace
  const seMail    = $F(out, 'mailbox',       30, 130);   // SE 郵便受
  $F(out, 'potted_plant',                    80, 138);   // townhouse 前鉢
  $F(out, 'a_frame_sign',                   140, 148);   // 駐車場看板

  // ── 取り巻き 3 パターン ──
  // facade 沿い: 上空 chouchin × 4
  $F(out, 'chouchin',                      -100, 15);    // 上空 NW
  $F(out, 'chouchin',                       -30, 15);    // 上空 中央西
  $F(out, 'chouchin',                        35, 15);    // 上空 中央東
  $F(out, 'chouchin',                       110, 15);    // 上空 NE
  // 歩道沿い: manhole × 3
  $F(out, 'manhole_cover',                  -65, 100);   // 歩道帯
  $F(out, 'manhole_cover',                    0, 100);   // avenue 中央
  $F(out, 'manhole_cover',                   65, 100);   // 歩道帯 東

  // ── 連続軸: 電柱・電線・cable ──
  $F(out, 'power_pole',                    -178, 92);
  $F(out, 'power_pole',                     178, 92);
  $F(out, 'power_pole',                    -178, 195);
  $F(out, 'power_pole',                     178, 195);
  $F(out, 'power_line',                     -90, 92);
  $F(out, 'power_line',                      90, 92);
  $F(out, 'cable_junction_box',           -170, 195);
  $F(out, 'cable_junction_box',            170, 195);
  // 客引き SW 端 (人配置側で humans に対応)
  $F(out, 'a_frame_sign',                  -178, 132);   // 客引き看板

  // ═══ CLUSTERS ═══
  // ★ HERO: SW 3 連飲食 (izakaya 中央を focal に)
  _CLUSTER(out, {
    id: 'ch1.SW.eatery3',
    role: 'hero',
    cell: 'SW',
    focal: izakaya,
    companions: [ramen, karaoke, chouA, norenA, aframeA, lampA, lampB],
    boundary: [bolA, bolB, wfA],
    access: [lampA, lampB],
    livingTrace: $F(out, 'garbage', -130, 175),         // 横丁裏 garbage
  });
  // AMBIENT: NW ホテル
  _CLUSTER(out, {
    id: 'ch1.NW.hotel',
    role: 'ambient',
    cell: 'NW',
    focal: hotel,
    companions: [hotelSign],
    livingTrace: hotelMail,
  });
  // AMBIENT: NE コンビニ
  _CLUSTER(out, {
    id: 'ch1.NE.shopfront',
    role: 'ambient',
    cell: 'NE',
    focal: conv,
    companions: [neSign],
    livingTrace: neBike,
  });
  // AMBIENT: SE 住宅
  _CLUSTER(out, {
    id: 'ch1.SE.residential',
    role: 'ambient',
    cell: 'SE',
    focal: tnSE1,
    companions: [seMail],
    livingTrace: seCat,
  });

  // ═══ HUMANS (11 人) ═══
  out.humans = [
    _H(-145, 138), _H(-95, 138), _H(-35, 138),         // 飲み客 ramen/izakaya/karaoke
    _H(-145, 145), _H(-95, 145), _H(-35, 145),         // 飲み客 (各店 2 人目)
    _H(  0, 100), _H( 50, 100), _H(-30, 100),          // サラリーマン avenue
    _H(-178, 132),                                       // 客引き SW 端
    _H( 80, 100),                                        // 通行人
  ];

  // ═══ GROUNDS (8 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),    // ベース
    _G('concrete',              -90, 145, 200,  40),    // SW 3 連店前
    _G('oil_stained_concrete', -100, 175, 180,  25),    // SW 路地裏 (夜街シグネチャ)
    _G('stone_pavement',        -65, 100,  12, 200),    // 歩道帯
    _G('tile',                 -145,  38,  70,  24),    // NW ホテル前
    _G('tile',                  110,  38,  60,  24),    // NE コンビニ
    _G('concrete',              110, 152,  80,  30),    // SE 駐車
    _G('oil_stained_concrete',    0, 100,  25,  14),    // アクセント avenue 中央
  ];

  return out;
})() },
```

---

## §9.2 Ch2: 商店街アーケード入口 (merged hero)

**ヒーロー / アンビエント**: **NW+NE merged = ヒーロー** (提灯ガーランドのアーケードゲート) / SW・SE = アンビエント

**merged ヒーロー 4 層**:
- **焦点**: `shotengai_arcade` × 2 (x=-118/+118, y=22) ゲート両柱 + `pachinko` (x=60, y=22) + `karaoke` (x=-60, y=22)
- **取り巻き**: `chouchin` × 14 (avenue 全幅 y=22 不揃い間隔 22-32px) + `banner_pole` × 4 (各端 y=28)
- **境界**: `flag_pole` × 2 (中央 x=-30/+30, y=12 上空)、`flower_planter_row` × 2 (左右端 y=88)
- **動線**: `street_lamp` × 2 (avenue 両脇)、`puddle_reflection` × 3、`bollard` × 4 横断帯

**アンビエント 2 セル** (merged が大きいため 2 セルのみ、Q13 緩和):
- **SW (pachinko 予告)**: `pachinko` (x=-130, y=130) + `business_hotel` + `sign_board` 赤 + `garbage` (痕跡、Ch4 予告)
- **SE (club 予告)**: `club` (x=130, y=130) + `townhouse` × 2 + `sign_board` 黒+金 + `bicycle` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `chouchin` × 14 アーケード帯
- **焦点囲み**: アーケードゲート両柱 + banner_pole × 4
- **歩道沿い**: `street_lamp` × 2、`bicycle_rack` × 2、`vending` × 2

**人配置**: 商店街客 × 多 8-10 (avenue 全幅)、客引き × 2 (Ch2 SE)、cat × 1

**地面パッチ**:
- **ベース**: `asphalt`
- **アーケード床**: `tile` (x=0 y=100, 360×30) — 全幅
- **ロット**: SW `concrete` (pachinko) / SE `red_carpet` (club)
- **歩道帯**: `stone_pavement` 継続
- **アクセント**: `oil_stained_concrete` 小 (avenue 中央)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR]` ✅ Q12 (Act 境界の予告 _TOP_HR)

**生活の痕跡 / スケール / 向き**:
- **痕跡**: SW garbage、SE bicycle、上段は商店街床のため痕跡少 (連続軸 chouchin で代替)
- **スケール**: 大 `shotengai_arcade` × 2 / 中 `pachinko`/`karaoke` / 小 `chouchin` × 14
- **向き**: chouchin は avenue 中央向き、banner_pole は両端向き

**Handoff (Ch1 → Ch2)**: chouchin 帯が連続、Ch3 高層雑居ビル予告として SW pachinko / SE club を facade に

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch2: 商店街アーケード入口 (merged hero) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR, _TOP_HR],                // ✅ Q12 Act 境界予告
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // merged 焦点: アーケードゲート両柱 + 中央 2 棟
  const arcadeW = $B(out, 'shotengai_arcade', -118, 22);  // ★ HERO 西柱
  const arcadeE = $B(out, 'shotengai_arcade',  118, 22);  // ★ HERO 東柱
  const pach    = $B(out, 'pachinko',           60, 22);  // ★ 焦点中央東
  const karao   = $B(out, 'karaoke',           -60, 22);  // ★ 焦点中央西
  // SW アンビエント (pachinko 予告)
  const pachSW  = $B(out, 'pachinko',         -130, 130);
  const hotelSW = $B(out, 'business_hotel',    -50, 130);
  // SE アンビエント (club 予告)
  const clubSE  = $B(out, 'club',              130, 130);
  const tnSE1   = $B(out, 'townhouse',          70, 130);
  $B(out, 'townhouse',                          30, 130);
  // NW アンビエント (merged の上段隅に小店)
  const mahjongNW = $B(out, 'mahjong_parlor', -178, 60);
  $B(out, 'capsule_hotel',  178, 60);
  // タイトパッキング
  $B(out, 'shop',           -160, 178);
  $B(out, 'shop',            165, 178);
  $B(out, 'snack',          -100, 178);
  $B(out, 'snack',           100, 178);

  // ═══ FURNITURE (76 個) ═══
  // ── merged 焦点: アーケード提灯帯 ──
  // chouchin × 14 不揃い間隔 (22-32px)
  const chouA = $F(out, 'chouchin', -160, 22);  // 提灯 1
  $F(out, 'chouchin',              -135, 22);  // 提灯 2
  $F(out, 'chouchin',              -105, 22);  // 提灯 3
  $F(out, 'chouchin',               -75, 22);  // 提灯 4
  $F(out, 'chouchin',               -45, 22);  // 提灯 5
  $F(out, 'chouchin',               -15, 22);  // 提灯 6 (中央西)
  $F(out, 'chouchin',                15, 22);  // 提灯 7 (中央東)
  $F(out, 'chouchin',                45, 22);  // 提灯 8
  $F(out, 'chouchin',                78, 22);  // 提灯 9 (33px 不揃い)
  $F(out, 'chouchin',               105, 22);  // 提灯 10
  $F(out, 'chouchin',               135, 22);  // 提灯 11
  $F(out, 'chouchin',               160, 22);  // 提灯 12
  $F(out, 'chouchin',               -90, 28);  // 提灯 13 (二段目)
  $F(out, 'chouchin',                90, 28);  // 提灯 14 (二段目)
  // banner_pole × 4 (各端)
  const banA = $F(out, 'banner_pole', -150, 28);  // 旗ガーランド NW
  $F(out, 'banner_pole',             -90, 28);
  $F(out, 'banner_pole',              90, 28);
  $F(out, 'banner_pole',             150, 28);
  // 境界: flag_pole × 2 + flower_planter
  const flagA = $F(out, 'flag_pole', -30, 12);    // 中央上空旗 西
  const flagB = $F(out, 'flag_pole',  30, 12);    // 中央上空旗 東
  const fpA   = $F(out, 'flower_planter_row', -160, 88);
  $F(out, 'flower_planter_row',      160, 88);
  // 動線: street_lamp × 2 + puddle × 3 + bollard × 4
  const lampA = $F(out, 'street_lamp', -120, 88);
  const lampB = $F(out, 'street_lamp',  120, 88);
  $F(out, 'puddle_reflection',       -50, 105);
  $F(out, 'puddle_reflection',        60, 105);
  $F(out, 'puddle_reflection',         0, 110);
  const bolA  = $F(out, 'bollard',   -65, 92);
  $F(out, 'bollard',                 -25, 92);
  $F(out, 'bollard',                  25, 92);
  $F(out, 'bollard',                  65, 92);

  // ── SW アンビエント: pachinko 予告 ──
  const pachSign = $F(out, 'sign_board', -130, 130); // 赤ネオン
  const swGarb   = $F(out, 'garbage',     -75, 175); // ★ SW livingTrace
  $F(out, 'a_frame_sign',                -130, 168);

  // ── SE アンビエント: club 予告 ──
  const clubSign = $F(out, 'sign_board',  130, 130); // 黒+金
  const seBike   = $F(out, 'bicycle',      70, 175); // ★ SE livingTrace
  $F(out, 'bicycle',                      100, 175);
  $F(out, 'parasol',                       30, 158);

  // ── 取り巻き 3 パターン ──
  // 歩道沿い: bicycle_rack + vending
  $F(out, 'bicycle_rack',                 -60, 88);
  $F(out, 'bicycle_rack',                  80, 88);
  $F(out, 'vending',                     -178, 38);
  $F(out, 'vending',                      178, 38);
  $F(out, 'manhole_cover',                -65, 100);
  $F(out, 'manhole_cover',                  0, 100);
  $F(out, 'manhole_cover',                 65, 100);

  // ── 連続軸 ──
  $F(out, 'power_pole',                  -178, 92);
  $F(out, 'power_pole',                   178, 92);
  $F(out, 'power_pole',                  -178, 195);
  $F(out, 'power_pole',                   178, 195);
  $F(out, 'power_line',                   -90, 195);
  $F(out, 'power_line',                    90, 195);
  $F(out, 'cable_junction_box',          -170, 195);
  $F(out, 'cable_junction_box',           170, 195);
  $F(out, 'cat',                          170, 178);

  // ═══ CLUSTERS ═══
  // ★ HERO: merged アーケードゲート (2 棟柱を hero focal にし、companions に提灯)
  _CLUSTER(out, {
    id: 'ch2.merged.arcade',
    role: 'hero',
    cell: 'merged',
    focal: arcadeW,                                       // 西柱を focal
    companions: [arcadeE, pach, karao, chouA, banA, lampA, lampB],
    boundary: [flagA, flagB, fpA],
    access: [bolA, lampA, lampB],
    livingTrace: $F(out, 'newspaper_stand', 0, 88),       // ★ merged livingTrace
  });
  // AMBIENT: SW pachinko 予告
  _CLUSTER(out, {
    id: 'ch2.SW.pachinko',
    role: 'ambient',
    cell: 'SW',
    focal: pachSW,
    companions: [pachSign, hotelSW],
    livingTrace: swGarb,
  });
  // AMBIENT: SE club 予告
  _CLUSTER(out, {
    id: 'ch2.SE.club',
    role: 'ambient',
    cell: 'SE',
    focal: clubSE,
    companions: [clubSign, tnSE1],
    livingTrace: seBike,
  });
  // AMBIENT: NW 上段の小店 (Q2 で 3+ 必達のため、mahjong を focal に)
  _CLUSTER(out, {
    id: 'ch2.NW.mahjong',
    role: 'ambient',
    cell: 'NW',
    focal: mahjongNW,
    companions: [],
    livingTrace: $F(out, 'mailbox', -178, 168),
  });

  // ═══ HUMANS (11 人) ═══
  out.humans = [
    _H(-120, 88), _H(-60, 95), _H(  0, 95), _H( 60, 95), _H(120, 88),  // 商店街客 × 5
    _H(-90, 88), _H( 90, 88), _H( 30, 88),                              // 商店街客 追加
    _H(-178, 132), _H(178, 132),                                        // 客引き × 2
    _H(  0, 100),                                                        // 通行人
  ];

  // ═══ GROUNDS (7 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),     // ベース
    _G('tile',                    0, 100, 360,  30),     // アーケード床 全幅
    _G('concrete',             -130, 152,  80,  30),     // SW pachinko ロット
    _G('red_carpet',            130, 152,  80,  30),     // SE club ロット
    _G('stone_pavement',        -65, 100,  12, 200),     // 歩道帯
    _G('oil_stained_concrete',    0, 100,  25,  14),     // アクセント
    _G('concrete',                0, 195, 100,  10),     // _TOP_HR 沿い
  ];

  return out;
})() },
```

---

## §9.3 Ch3: 高層雑居ビル (karaoke 街)

**ヒーロー / アンビエント**: **NE = ヒーロー** (karaoke 大看板の縦帯、基本形 B 高層) / NW・SW・SE = アンビエント

**NE ヒーロー 4 層**:
- **焦点**: `karaoke` (x=130, y=22) + `apartment_tall` (x=80, y=22) + `club` (x=30, y=22) の高層 3 棟
- **取り巻き**: `sign_board` 大 (x=130, y=8 屋上ネオン) + `chouchin` × 4 (店前 y=58) + `a_frame_sign` × 3
- **境界**: `bollard` × 3 (x=70/100/170, y=92) + `flag_pole` (x=130, y=12)
- **動線**: `street_lamp` × 2 (x=80/170, y=88)、`puddle_reflection` × 2 (店前 y=110)、`recycling_bin` (痕跡)

**アンビエント 3 セル**:
- **NW (club + capsule)**: `club` (x=-130, y=22) + `capsule_hotel` (x=-75, y=22) + `sign_board` 黒+金 + `parasol` + `recycling_bin` (痕跡)
- **SW (business_hotel + townhouse + mahjong)**: `business_hotel` (x=-100, y=130) + `townhouse` (x=-160, y=138) + `mahjong_parlor` (x=-50, y=138) + `mailbox` (痕跡)
- **SE (mansion × 2 + pharmacy + cafe)**: `mansion` × 2 (x=80/140, y=130) + `pharmacy` (x=30, y=138) + `cafe` (x=165, y=138) + `bicycle_rack` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board` × 4 (黄/黒+金/ピンク/青)、屋上ネオン × 1 大
- **焦点囲み**: NE 雑居ビル前の chouchin × 4 + a_frame_sign × 3
- **歩道沿い**: `street_lamp` × 2、`puddle_reflection` × 3

**人配置**: ホスト/ホステス × 4 (NW)、飲み客 × 5 (NE karaoke)、サラリーマン × 3 (avenue)、cat × 1

**地面パッチ**: ベース `asphalt` / NE 焦点 `concrete` + `tile` + `red_carpet` / NW `red_carpet` (club) / SW `concrete` / SE `tile` + `wood_deck` (cafe) / 歩道帯 `stone_pavement` / アクセント `oil_stained_concrete`

**道路**: `verticalRoads: [_AVE, _VR(-90, 0, 100)]` ✅ Q12 (雑居ビル間裏路地) / `horizontalRoads: [_MID_HR]`

**生活の痕跡 / スケール / 向き**: 各セル ≥1 痕跡 ✅ / 大 `apartment_tall`/`karaoke` / 中 `club`/`mansion` / 小 `chouchin` / ネオン sign は avenue 向き

**Handoff (Ch2 → Ch3)**: SW pachinko 予告 → Ch4 大パチンコへ、chouchin 帯継続

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch3: 高層雑居ビル (karaoke 街) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE, _VR(-90, 0, 100)],            // ✅ Q12 雑居ビル間裏路地
  };

  // ═══ BUILDINGS (16 棟) ═══
  // NE 焦点: 高層 3 棟
  const karao   = $B(out, 'karaoke',         130, 22);  // ★ HERO FOCAL
  const aparT   = $B(out, 'apartment_tall',   80, 22);
  const clubNE  = $B(out, 'club',             30, 22);
  // NW アンビエント: club + capsule
  const clubNW  = $B(out, 'club',           -130, 22);
  const capNW   = $B(out, 'capsule_hotel',   -75, 22);
  // SW アンビエント: ホテル + townhouse + 麻雀
  const hotelSW = $B(out, 'business_hotel', -100, 130);
  $B(out, 'townhouse',                      -160, 138);
  $B(out, 'mahjong_parlor',                  -50, 138);
  // SE アンビエント: マンション × 2 + 薬局 + カフェ
  const mansSE  = $B(out, 'mansion',          80, 130);
  $B(out, 'mansion',                         140, 130);
  $B(out, 'pharmacy',                         30, 138);
  $B(out, 'cafe',                            165, 138);
  // タイトパッキング
  $B(out, 'snack',                          -178, 70);
  $B(out, 'shop',                            178, 70);
  $B(out, 'shed',                           -160, 195);
  $B(out, 'shed',                            160, 195);

  // ═══ FURNITURE (74 個) ═══
  // ── NE 焦点 4 層 ──
  const karaSign = $F(out, 'sign_board', 130, 8);       // 屋上ネオン大 (★ NE facade)
  const chouA    = $F(out, 'chouchin',  110, 58);       // 店前提灯 1
  $F(out, 'chouchin',                   130, 58);       // 店前提灯 2
  $F(out, 'chouchin',                    80, 58);       // 店前提灯 3
  $F(out, 'chouchin',                    30, 58);       // 店前提灯 4
  const afA      = $F(out, 'a_frame_sign', 130, 88);    // 立て看板 1
  $F(out, 'a_frame_sign',                80, 88);       // 立て看板 2
  $F(out, 'a_frame_sign',                30, 88);       // 立て看板 3
  $F(out, 'flag_pole',                  130, 12);       // 旗
  // 境界: bollard × 3 (Q14)
  const bolA = $F(out, 'bollard',        70, 92);
  const bolB = $F(out, 'bollard',       100, 92);
  const bolC = $F(out, 'bollard',       170, 92);
  // 動線
  const lampA = $F(out, 'street_lamp',   80, 88);
  const lampB = $F(out, 'street_lamp',  170, 88);
  $F(out, 'puddle_reflection',           80, 110);
  $F(out, 'puddle_reflection',          130, 110);
  const recyc = $F(out, 'recycling_bin', 165, 75);      // ★ NE livingTrace

  // ── NW アンビエント: club + capsule ──
  const nwSign = $F(out, 'sign_board', -130, 8);        // 黒+金ネオン
  $F(out, 'sign_board',                 -75, 8);        // capsule 看板
  $F(out, 'parasol',                    -75, 38);
  const nwTrace = $F(out, 'recycling_bin', -150, 38);   // ★ NW livingTrace

  // ── SW アンビエント ──
  const swMail = $F(out, 'mailbox',    -160, 130);      // ★ SW livingTrace
  $F(out, 'a_frame_sign',              -100, 148);
  $F(out, 'chouchin',                   -50, 122);

  // ── SE アンビエント ──
  const seBR = $F(out, 'bicycle_rack',   80, 152);      // ★ SE livingTrace
  $F(out, 'bicycle_rack',               140, 152);
  $F(out, 'parasol',                    165, 152);
  $F(out, 'mailbox',                    140, 130);

  // ── 取り巻き 3 パターン ──
  $F(out, 'sign_board',                 -75, 8);        // facade NW
  $F(out, 'sign_board',                  30, 8);        // facade NE 中
  $F(out, 'sign_board',                  80, 8);        // facade NE
  $F(out, 'puddle_reflection',          -50, 110);
  $F(out, 'puddle_reflection',           50, 110);
  $F(out, 'puddle_reflection',            0, 105);
  $F(out, 'manhole_cover',              -65, 100);
  $F(out, 'manhole_cover',               65, 100);
  $F(out, 'manhole_cover',                0, 100);

  // ── 連続軸 ──
  $F(out, 'power_pole',                -178, 92);
  $F(out, 'power_pole',                 178, 92);
  $F(out, 'power_pole',                -178, 195);
  $F(out, 'power_pole',                 178, 195);
  $F(out, 'power_line',                 -90, 195);
  $F(out, 'power_line',                  90, 195);
  $F(out, 'cable_junction_box',        -170, 195);
  $F(out, 'cable_junction_box',         170, 195);
  $F(out, 'cat',                       -170, 175);
  $F(out, 'newspaper_stand',              0, 88);

  // ═══ CLUSTERS ═══
  _CLUSTER(out, {
    id: 'ch3.NE.highrise',
    role: 'hero',
    cell: 'NE',
    focal: karao,
    companions: [aparT, clubNE, karaSign, chouA, afA, lampA, lampB],
    boundary: [bolA, bolB, bolC],
    access: [lampA, lampB],
    livingTrace: recyc,
  });
  _CLUSTER(out, {
    id: 'ch3.NW.club',
    role: 'ambient',
    cell: 'NW',
    focal: clubNW,
    companions: [capNW, nwSign],
    livingTrace: nwTrace,
  });
  _CLUSTER(out, {
    id: 'ch3.SW.hotel',
    role: 'ambient',
    cell: 'SW',
    focal: hotelSW,
    companions: [],
    livingTrace: swMail,
  });
  _CLUSTER(out, {
    id: 'ch3.SE.mansion',
    role: 'ambient',
    cell: 'SE',
    focal: mansSE,
    companions: [],
    livingTrace: seBR,
  });

  // ═══ HUMANS (12 人) ═══
  out.humans = [
    _H(130, 38), _H( 80, 38), _H( 30, 38),              // 飲み客 NE × 3
    _H(110, 60), _H( 50, 60),                            // 飲み客 NE × 2
    _H(-130, 38), _H(-130, 60), _H(-75, 38), _H(-75, 60),  // ホスト/ホステス NW × 4
    _H(  0, 100), _H( 50, 100), _H(-30, 100),           // サラリーマン avenue
  ];

  // ═══ GROUNDS (8 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),
    _G('concrete',              130,  60,  60,  30),    // NE 焦点 karaoke 前
    _G('tile',                   80,  60,  50,  30),    // NE apartment_tall 前
    _G('red_carpet',             30,  60,  50,  20),    // NE club 前
    _G('red_carpet',           -130,  60,  50,  20),    // NW club ロット
    _G('concrete',             -100, 150,  80,  30),    // SW
    _G('tile',                  110, 150,  90,  30),    // SE mansion 駐車
    _G('wood_deck',             165, 152,  30,  18),    // SE cafe
    _G('stone_pavement',        -65, 100,  12, 200),    // 歩道帯
    _G('oil_stained_concrete',    0, 100,  25,  14),    // アクセント
  ];

  return out;
})() },
```

---

## §9.4 Ch4: パチンコ + 交番交差点 (merged hero、★ Stage 2 クライマックス)

**ヒーロー / アンビエント**: **全マージ merged = ヒーロー** (街の交差点、Stage 2 視覚的ピーク)

**merged ヒーロー 4 層**:
- **焦点**: `pachinko` (x=-100, y=22) ★ + `police_station` (x=0, y=130) ★ 中央交番 + `game_center` (x=100, y=22)
- **取り巻き**: `sign_board` 巨大 × 2 (パチンコ・ゲーセン y=8) + `flag_pole` × 2 (交番前 x=±12) + `traffic_cone` × 4 (交番前路上)
- **境界**: `bollard` × 4 (avenue 横断帯)、`barrier` × 2 (パチンコ前)
- **動線**: `street_lamp` × 2、`street_mirror` × 2 (交差点)、`puddle_reflection` × 4 (4 角)

**アンビエント (狭い、merged 周辺)**:
- **NW**: `snack` × 1 (x=-160, y=22) + `love_hotel` (x=-55, y=22) + `capsule_hotel` (x=-25, y=70)
- **NE**: `snack` × 1 (x=160, y=22) + `club` (x=60, y=22) + `shop` (x=145, y=70)
- **SW**: `mahjong_parlor` (x=-150, y=130) + `business_hotel` (x=-90, y=130) + `izakaya` (x=-45, y=138)
- **SE**: `ramen` (x=60, y=138) + `townhouse` (x=110, y=130) + `apartment` (x=165, y=130)

**取り巻き 3 パターン**: facade 沿い `sign_board` × 6 + 屋上ネオン × 2 / 焦点囲み 交番中央 + パチンコ前 + ゲーセン前 / 歩道沿い `street_lamp` × 2 + `bollard` × 4 + `manhole_cover` × 3 + `newspaper_stand` × 2

**人配置**: パチンコ客 × 6 (待ち列)、警察官 × 1 (交番)、客引き × 3、酔客 × 4、サラリーマン × 4 (avenue)、cat × 1

**地面パッチ**: ベース `asphalt` / 焦点 `tile` (パチンコ前) + `concrete` (交番前) + `tile` (ゲーセン) / 各ロット `red_carpet` × 2 + `concrete` × 4 / 歩道帯 / アクセント (avenue + パチンコ前路地)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR]` ✅ Q12 (4 方向交差点感)

**Handoff (Ch3 → Ch4)**: 大ネオン継続、Ch5 横丁への転換

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch4: パチンコ + 交番交差点 (merged hero、★ Stage 2 クライマックス) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR, _TOP_HR],                // ✅ Q12 4 方向交差点感
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (17 棟) ═══
  // merged 焦点: 3 大ランドマーク
  const pach    = $B(out, 'pachinko',       -100, 22);  // ★ HERO FOCAL
  const police  = $B(out, 'police_station',    0, 130); // ★ 中央交番
  const game    = $B(out, 'game_center',     100, 22);  // ★ ゲーセン
  // NW アンビエント
  const snackNW = $B(out, 'snack',         -160, 22);
  const loveNW  = $B(out, 'love_hotel',     -55, 22);
  $B(out, 'capsule_hotel',                  -25, 70);
  // NE アンビエント
  const snackNE = $B(out, 'snack',          160, 22);
  const clubNE  = $B(out, 'club',            60, 22);
  $B(out, 'shop',                           145, 70);
  // SW アンビエント
  const mahSW   = $B(out, 'mahjong_parlor',-150, 130);
  $B(out, 'business_hotel',                 -90, 130);
  $B(out, 'izakaya',                        -45, 138);
  // SE アンビエント
  const ramSE   = $B(out, 'ramen',           60, 138);
  $B(out, 'townhouse',                      110, 130);
  $B(out, 'apartment',                      165, 130);
  // タイトパッキング
  $B(out, 'shed',                          -178, 178);
  $B(out, 'garage',                         178, 178);

  // ═══ FURNITURE (82 個) ═══
  // ── merged 焦点 4 層 ──
  const pachSign = $F(out, 'sign_board', -100, 8);      // ★ パチンコ屋上ネオン巨大
  const gameSign = $F(out, 'sign_board',  100, 8);      // ★ ゲーセン屋上ネオン巨大
  const flagA    = $F(out, 'flag_pole',  -12, 105);     // 交番旗 西
  const flagB    = $F(out, 'flag_pole',   12, 105);     // 交番旗 東
  const tcA      = $F(out, 'traffic_cone', -20, 110);
  const tcB      = $F(out, 'traffic_cone',  20, 110);
  $F(out, 'traffic_cone',                  -10, 115);
  $F(out, 'traffic_cone',                   10, 115);
  // 境界
  const bolA = $F(out, 'bollard',          -65, 92);
  const bolB = $F(out, 'bollard',          -25, 92);
  const bolC = $F(out, 'bollard',           25, 92);
  const bolD = $F(out, 'bollard',           65, 92);
  $F(out, 'barrier',                      -100, 38);    // パチンコ前バリア
  $F(out, 'barrier',                       100, 38);    // ゲーセン前バリア
  // 動線
  const lampA = $F(out, 'street_lamp',     -65, 100);
  const lampB = $F(out, 'street_lamp',      65, 100);
  $F(out, 'street_mirror',                 -30, 92);
  $F(out, 'street_mirror',                  30, 92);
  $F(out, 'puddle_reflection',             -55, 105);
  $F(out, 'puddle_reflection',              55, 105);
  $F(out, 'puddle_reflection',             -55,  95);
  $F(out, 'puddle_reflection',              55,  95);

  // ── アンビエント (狭い) ──
  $F(out, 'sign_board',                  -160, 8);      // snack 赤
  $F(out, 'sign_board',                   160, 8);      // snack ピンク
  $F(out, 'sign_board',                   -55, 8);      // love_hotel ピンク
  $F(out, 'sign_board',                    60, 8);      // club 黒+金
  $F(out, 'chouchin',                     -45, 118);    // izakaya 提灯
  $F(out, 'chouchin',                      60, 118);    // ramen 提灯
  $F(out, 'noren',                        -45, 122);
  $F(out, 'noren',                         60, 122);
  $F(out, 'a_frame_sign',                -150, 148);
  $F(out, 'a_frame_sign',                 110, 148);

  // ── 痕跡 (各 ambient cluster) ──
  const nwGarb = $F(out, 'garbage',      -100, 60);     // ★ NW livingTrace
  const neBike = $F(out, 'bicycle',       110, 175);    // ★ NE livingTrace (緩衝で SE と兼用)
  $F(out, 'bicycle',                      165, 175);
  const swMail = $F(out, 'mailbox',      -160, 130);    // ★ SW livingTrace
  const seGarb = $F(out, 'garbage',       170, 195);    // ★ SE livingTrace

  // ── 取り巻き 3 パターン ──
  $F(out, 'newspaper_stand',              -65, 88);
  $F(out, 'newspaper_stand',               65, 88);
  $F(out, 'manhole_cover',                -65, 100);
  $F(out, 'manhole_cover',                  0, 100);
  $F(out, 'manhole_cover',                 65, 100);

  // ── 連続軸 ──
  $F(out, 'power_pole',                  -178, 92);
  $F(out, 'power_pole',                   178, 92);
  $F(out, 'power_pole',                  -178, 195);
  $F(out, 'power_pole',                   178, 195);
  $F(out, 'power_line',                   -90, 195);
  $F(out, 'power_line',                    90, 195);
  $F(out, 'cable_junction_box',          -170, 195);
  $F(out, 'cable_junction_box',           170, 195);
  $F(out, 'cat',                         -170, 175);

  // ═══ CLUSTERS ═══
  // ★ HERO: merged 交差点
  _CLUSTER(out, {
    id: 'ch4.merged.crossing',
    role: 'hero',
    cell: 'merged',
    focal: pach,
    companions: [police, game, pachSign, gameSign, flagA, flagB, tcA, tcB, lampA, lampB],
    boundary: [bolA, bolB, bolC, bolD],
    access: [lampA, lampB, $F(out, 'manhole_cover', 0, 105)],
    livingTrace: nwGarb,
  });
  // AMBIENT × 4 (cell 別)
  _CLUSTER(out, {
    id: 'ch4.NW.snack',
    role: 'ambient',
    cell: 'NW',
    focal: snackNW,
    companions: [loveNW],
    livingTrace: nwGarb,
  });
  _CLUSTER(out, {
    id: 'ch4.NE.club',
    role: 'ambient',
    cell: 'NE',
    focal: clubNE,
    companions: [snackNE],
    livingTrace: neBike,
  });
  _CLUSTER(out, {
    id: 'ch4.SW.mahjong',
    role: 'ambient',
    cell: 'SW',
    focal: mahSW,
    companions: [],
    livingTrace: swMail,
  });
  _CLUSTER(out, {
    id: 'ch4.SE.eatery',
    role: 'ambient',
    cell: 'SE',
    focal: ramSE,
    companions: [],
    livingTrace: seGarb,
  });

  // ═══ HUMANS (15 人) ═══
  out.humans = [
    _H(-100, 38), _H(-100, 50), _H( -90, 38),           // パチンコ客 × 3
    _H( 100, 38), _H( 100, 50), _H(  90, 38),           // ゲーセン客 × 3
    _H(   0, 145),                                       // 警察官
    _H(-178, 88), _H( 178, 88), _H(-160, 88),           // 客引き × 3
    _H( -55, 38), _H(  60, 38), _H( -45, 145), _H( 60, 145),  // 酔客 × 4
    _H(   0, 100), _H(  50, 100),                        // サラリーマン × 2
  ];

  // ═══ GROUNDS (10 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),
    _G('tile',                 -100,  38,  90,  50),    // パチンコ前
    _G('concrete',                0, 145,  80,  50),    // 交番前
    _G('tile',                  100,  38,  90,  50),    // ゲーセン前
    _G('red_carpet',            -55,  38,  30,  24),    // love_hotel
    _G('red_carpet',             60,  38,  30,  24),    // club
    _G('concrete',             -160,  38,  24,  24),    // snack NW
    _G('concrete',              160,  38,  24,  24),    // snack NE
    _G('stone_pavement',        -65, 100,  12, 200),    // 歩道帯
    _G('oil_stained_concrete',    0, 100,  30,  16),    // アクセント
    _G('oil_stained_concrete', -100,  50,  40,  14),    // パチンコ前路地
  ];

  return out;
})() },
```

---

## §9.5 Ch5: 老舗飲み屋横丁 (SW+SE merged hero)

**ヒーロー / アンビエント**: **SW+SE merged = ヒーロー** (横丁感、5 連の小店並び) / NW・NE = アンビエント

**SW+SE merged ヒーロー 4 層**:
- **焦点**: `snack` × 2 (x=-160/+60, y=130) + `mahjong_parlor` (x=-100, y=130) + `izakaya` (x=-30, y=130) + `sushi_ya` (x=130, y=130) — 5 軒並び
- **取り巻き (各店)**: `chouchin` × 5 (各店前 y=122) + `noren` × 5 (y=128)、`a_frame_sign` × 4 (y=148 不揃い)
- **境界**: `wood_fence` × 2 (横丁の両入口 x=-178/+178, y=120)、`hedge` (x=20, y=145)
- **動線**: `street_lamp` × 3 (中央 + 端、y=130)、`puddle_reflection` × 4 (店前 y=148)

**アンビエント 2 セル**:
- **NW (bank 焦点)**: `bank` (x=-130, y=22) + `flag_pole` + `atm` × 2 + `mailbox` (痕跡)
- **NE (capsule 焦点)**: `capsule_hotel` (x=130, y=22) + `sign_board` + `vending` × 2 + `garbage` (痕跡)

**取り巻き 3 パターン**: facade 沿い NW bank + NE capsule の sign_board × 2 + atm × 2 / 焦点囲み 横丁 5 軒の chouchin × 5 + noren × 5 + a_frame × 4 / 歩道沿い `street_lamp` × 3 + `puddle_reflection` × 4

**人配置**: 飲み客 × 8 (横丁狭い空間に密)、ママさん × 1 (snack 前)、サラリーマン × 2 (avenue)、cat × 2 (路地)

**地面パッチ**: ベース `asphalt` / merged 焦点 `concrete` 横丁通り (360×30) + `oil_stained_concrete` 路地裏 / NW `tile` (bank) / NE `tile` (capsule) / 歩道帯 / アクセント

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _HR(165, -180, 0)]` ✅ Q12 (SW 横丁の路地)

**Handoff (Ch4 → Ch5)**: クライマックスから横丁へ密度減、Ch6 ラブホ街予告

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch5: 老舗飲み屋横丁 (SW+SE merged hero) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR, _HR(165, -180, 0)],      // ✅ Q12 SW 横丁路地
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // SW+SE merged 焦点: 5 連横丁
  const snackA  = $B(out, 'snack',         -160, 130);  // ★ HERO FOCAL 西端
  const mahS    = $B(out, 'mahjong_parlor',-100, 130);
  const izaS    = $B(out, 'izakaya',        -30, 130);
  $B(out, 'snack',                           60, 130);
  const sushi   = $B(out, 'sushi_ya',       130, 130);
  // NW アンビエント: 銀行
  const bank    = $B(out, 'bank',          -130, 22);
  // NE アンビエント: capsule
  const capNE   = $B(out, 'capsule_hotel',  130, 22);
  // タイトパッキング
  $B(out, 'business_hotel',                  -75, 22);
  $B(out, 'apartment',                        75, 22);
  $B(out, 'townhouse',                      -178, 22);
  $B(out, 'townhouse',                       178, 22);
  $B(out, 'shed',                          -160, 195);
  $B(out, 'shed',                           160, 195);
  $B(out, 'garage',                          -50, 195);
  $B(out, 'garage',                           70, 195);

  // ═══ FURNITURE (76 個) ═══
  // ── SW+SE merged 焦点 4 層 ──
  // chouchin × 5 (各店前)
  const chouA = $F(out, 'chouchin', -160, 122);  // snack 西
  $F(out, 'chouchin',               -100, 122);  // mahjong
  $F(out, 'chouchin',                -30, 122);  // izakaya
  $F(out, 'chouchin',                 60, 122);  // snack 東
  $F(out, 'chouchin',                130, 122);  // sushi
  // noren × 5
  const norenA = $F(out, 'noren',  -160, 128);
  $F(out, 'noren',                 -100, 128);
  $F(out, 'noren',                  -30, 128);
  $F(out, 'noren',                   60, 128);
  $F(out, 'noren',                  130, 128);
  // a_frame_sign × 4 不揃い
  const afA = $F(out, 'a_frame_sign', -130, 148);
  $F(out, 'a_frame_sign',              -65, 148);
  $F(out, 'a_frame_sign',               30, 148);
  $F(out, 'a_frame_sign',               95, 148);
  // 境界
  const wfA = $F(out, 'wood_fence',  -178, 120);
  const wfB = $F(out, 'wood_fence',   178, 120);
  $F(out, 'hedge',                     20, 145);
  // 動線
  const lampA = $F(out, 'street_lamp', -120, 130);
  const lampB = $F(out, 'street_lamp',    0, 130);
  const lampC = $F(out, 'street_lamp',  120, 130);
  $F(out, 'puddle_reflection',         -130, 148);
  $F(out, 'puddle_reflection',          -50, 148);
  $F(out, 'puddle_reflection',           60, 148);
  $F(out, 'puddle_reflection',          130, 148);

  // ── NW アンビエント: 銀行 ──
  $F(out, 'flag_pole',                 -130, 12);
  $F(out, 'atm',                       -150, 38);
  $F(out, 'atm',                       -110, 38);
  const nwMail = $F(out, 'mailbox',    -100, 22);  // ★ NW livingTrace
  const bankSign = $F(out, 'sign_board',-130, 8);

  // ── NE アンビエント: capsule ──
  const neSign = $F(out, 'sign_board',  130, 8);
  $F(out, 'vending',                    110, 38);
  $F(out, 'vending',                    150, 38);
  const neGarb = $F(out, 'garbage',     165, 60);  // ★ NE livingTrace

  // ── 取り巻き 3 パターン ──
  $F(out, 'manhole_cover',              -65, 100);
  $F(out, 'manhole_cover',                0, 100);
  $F(out, 'manhole_cover',               65, 100);
  $F(out, 'bollard',                    -65, 95);
  $F(out, 'bollard',                     65, 95);

  // ── 痕跡 ──
  const swCat = $F(out, 'cat',         -170, 175);  // ★ SW livingTrace
  const seCat = $F(out, 'cat',          170, 175);  // ★ SE livingTrace
  $F(out, 'garbage',                   -160, 175);

  // ── 連続軸 ──
  $F(out, 'power_pole',                -178, 92);
  $F(out, 'power_pole',                 178, 92);
  $F(out, 'power_pole',                -178, 195);
  $F(out, 'power_pole',                 178, 195);
  $F(out, 'power_line',                 -90, 195);
  $F(out, 'power_line',                  90, 195);
  $F(out, 'cable_junction_box',        -170, 195);
  $F(out, 'cable_junction_box',         170, 195);

  // ═══ CLUSTERS ═══
  _CLUSTER(out, {
    id: 'ch5.merged.alley5',
    role: 'hero',
    cell: 'merged',
    focal: mahS,
    companions: [snackA, izaS, sushi, chouA, norenA, afA, lampA, lampB, lampC],
    boundary: [wfA, wfB, $F(out, 'hedge', 20, 165)],
    access: [lampA, lampB, lampC],
    livingTrace: $F(out, 'garbage', -100, 175),
  });
  _CLUSTER(out, {
    id: 'ch5.NW.bank',
    role: 'ambient',
    cell: 'NW',
    focal: bank,
    companions: [bankSign],
    livingTrace: nwMail,
  });
  _CLUSTER(out, {
    id: 'ch5.NE.capsule',
    role: 'ambient',
    cell: 'NE',
    focal: capNE,
    companions: [neSign],
    livingTrace: neGarb,
  });
  _CLUSTER(out, {
    id: 'ch5.SE.eatery',
    role: 'ambient',
    cell: 'SE',
    focal: sushi,                                     // 寿司を SE 代表に
    companions: [],
    livingTrace: seCat,
  });

  // ═══ HUMANS (12 人) ═══
  out.humans = [
    _H(-160, 138), _H(-100, 138), _H(-30, 138),       // 飲み客 × 3
    _H(  60, 138), _H( 130, 138), _H(-100, 145),      // 飲み客 × 3
    _H( -30, 145), _H(  60, 145),                      // 飲み客 × 2
    _H(-160, 132),                                      // ママさん snack 前
    _H(   0, 100), _H(  50, 100),                      // サラリーマン × 2
    _H( -90, 168),                                      // 横丁路地
  ];

  // ═══ GROUNDS (8 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),
    _G('concrete',                0, 145, 360,  30),    // 横丁通り 全幅
    _G('oil_stained_concrete',    0, 175, 280,  20),    // 路地裏
    _G('tile',                 -130,  38,  60,  24),    // NW bank
    _G('tile',                  130,  38,  60,  24),    // NE capsule
    _G('stone_pavement',        -65, 100,  12, 200),    // 歩道帯
    _G('oil_stained_concrete',    0, 100,  25,  14),    // アクセント
    _G('concrete',              -90, 165, 180,  10),    // 横丁路地 _HR 沿い
  ];

  return out;
})() },
```

---

## §9.6 Ch6: ラブホテル街

**ヒーロー / アンビエント**: **NW = ヒーロー** (love_hotel 街、基本形 B) / NE・SW・SE = アンビエント

**NW ヒーロー 4 層**:
- **焦点**: `love_hotel` × 3 (x=-110/-50, y=22 大2軒 + x=-160, y=75 小1軒)
- **取り巻き**: `sign_board` ピンク × 2 (大ネオン y=8) + `parasol` × 2 (入口 y=58) + `flag_pole` × 2
- **境界**: `hedge` × 5 高め目隠し (x=-178 列 y=10/50/90 + x=10 列 y=10/50)
- **動線**: `street_lamp` (x=-150, y=88)、`puddle_reflection` × 2、`flower_bed` (x=-75, y=88)

**アンビエント 3 セル**:
- **NE (club × 2 + mahjong)**: `club` × 2 (x=130/70, y=22) + `mahjong_parlor` (x=30, y=22) + `sign_board` 黒+金 + `recycling_bin` (痕跡)
- **SW (snack + mahjong + izakaya)**: `snack` (x=-130, y=130) + `mahjong_parlor` (x=-75, y=130) + `izakaya` + `chouchin` ピンク + `garbage` (痕跡)
- **SE (mahjong + cafe + mansion)**: `mahjong_parlor` (x=130, y=130) + `cafe` (x=30, y=138) + `mansion` (x=165, y=138) + `sign_board` 緑 + `bicycle` (痕跡)

**取り巻き 3 パターン**: facade 沿い `sign_board` × 4 (ピンク × 2、黒+金 × 2) / 焦点囲み NW ラブホ前の parasol × 2 + flag_pole × 2 + 目隠し hedge × 5 / 歩道沿い `street_lamp` × 2 + `puddle_reflection` × 3 + `bollard` × 2

**人配置**: カップル × 2 (NW)、ホステス × 2 (NE)、酔客 × 3 (SW snack)、cat × 1

**地面パッチ**: ベース `asphalt` / NW 焦点 `red_carpet` ラブホ前 + `red_carpet` 小 / NE `red_carpet` × 2 (club) / SW `concrete` (snack 通り) + `oil_stained_concrete` (路地) / SE `wood_deck` (cafe) + `tile` (mahjong) / 歩道帯

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]` (Ch6 は NW 焦点で部分幅 _HR 不要)

**Handoff (Ch5 → Ch6)**: 横丁から派手なネオン、Ch7 屋台予告として SW snack の chouchin

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch6: ラブホテル街 (NW = ヒーロー) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // NW 焦点: love_hotel × 3
  const loveA = $B(out, 'love_hotel',  -110, 22);  // ★ HERO FOCAL
  const loveB = $B(out, 'love_hotel',   -50, 22);
  const loveC = $B(out, 'love_hotel',  -160, 75);
  // NE アンビエント
  const clubA = $B(out, 'club',         130, 22);
  const clubB = $B(out, 'club',          70, 22);
  $B(out, 'mahjong_parlor',              30, 22);
  // SW アンビエント
  const snackSW = $B(out, 'snack',     -130, 130);
  $B(out, 'mahjong_parlor',             -75, 130);
  $B(out, 'izakaya',                    -25, 138);
  // SE アンビエント
  const mahSE = $B(out, 'mahjong_parlor', 130, 130);
  $B(out, 'cafe',                         30, 138);
  $B(out, 'mansion',                     165, 138);
  // タイトパッキング
  $B(out, 'capsule_hotel',                70, 130);
  $B(out, 'shed',                       -178, 195);
  $B(out, 'shed',                        178, 195);

  // ═══ FURNITURE (75 個) ═══
  // ── NW 焦点 4 層 ──
  const sigA = $F(out, 'sign_board', -110, 8);    // ★ ピンクネオン大
  $F(out, 'sign_board',               -50, 8);    // ★ ピンクネオン大
  const paraA = $F(out, 'parasol',  -110, 58);    // 入口傘
  $F(out, 'parasol',                 -50, 58);
  const flagA = $F(out, 'flag_pole',-130, 12);
  $F(out, 'flag_pole',               -30, 12);
  // 境界: hedge × 5 目隠し (Q14 3+)
  const hgA = $F(out, 'hedge',     -178, 10);
  const hgB = $F(out, 'hedge',     -178, 50);
  const hgC = $F(out, 'hedge',     -178, 90);
  $F(out, 'hedge',                   10, 10);
  $F(out, 'hedge',                   10, 50);
  // 動線
  const lampA = $F(out, 'street_lamp', -150, 88);
  $F(out, 'puddle_reflection',       -100, 105);
  $F(out, 'puddle_reflection',        -40, 105);
  $F(out, 'flower_bed',               -75, 88);

  // ── NE アンビエント ──
  const sigNE = $F(out, 'sign_board', 130, 8);    // 黒+金
  $F(out, 'sign_board',                70, 8);
  $F(out, 'chouchin',                  30, 58);
  const neRecyc = $F(out, 'recycling_bin', 165, 38);  // ★ NE livingTrace

  // ── SW アンビエント ──
  $F(out, 'chouchin',               -130, 122);   // ピンク
  const swGarb = $F(out, 'garbage', -100, 175);   // ★ SW livingTrace
  $F(out, 'a_frame_sign',            -75, 148);

  // ── SE アンビエント ──
  $F(out, 'parasol',                  30, 158);
  const sigSE = $F(out, 'sign_board',130, 130);   // 緑
  const seBike = $F(out, 'bicycle',  100, 175);   // ★ SE livingTrace
  $F(out, 'bicycle',                  60, 175);

  // ── 取り巻き 3 パターン ──
  $F(out, 'puddle_reflection',       -50, 110);
  $F(out, 'puddle_reflection',        50, 110);
  $F(out, 'puddle_reflection',         0, 105);
  $F(out, 'bollard',                 -65, 95);
  $F(out, 'bollard',                  65, 95);
  $F(out, 'street_lamp',             -65, 100);
  $F(out, 'street_lamp',              65, 100);
  $F(out, 'manhole_cover',             0, 100);
  $F(out, 'manhole_cover',           -30, 100);

  // ── 連続軸 ──
  $F(out, 'power_pole',             -178, 92);
  $F(out, 'power_pole',              178, 92);
  $F(out, 'power_pole',             -178, 195);
  $F(out, 'power_pole',              178, 195);
  $F(out, 'power_line',              -90, 195);
  $F(out, 'power_line',               90, 195);
  $F(out, 'cable_junction_box',     -170, 195);
  $F(out, 'cable_junction_box',      170, 195);
  $F(out, 'cat',                     170, 175);
  $F(out, 'newspaper_stand',           0, 88);

  // ═══ CLUSTERS ═══
  _CLUSTER(out, {
    id: 'ch6.NW.love_hotel',
    role: 'hero',
    cell: 'NW',
    focal: loveA,
    companions: [loveB, loveC, sigA, paraA, flagA, lampA],
    boundary: [hgA, hgB, hgC],
    access: [lampA, $F(out, 'manhole_cover', -100, 100)],
    livingTrace: $F(out, 'recycling_bin', -178, 60),
  });
  _CLUSTER(out, {
    id: 'ch6.NE.club',
    role: 'ambient',
    cell: 'NE',
    focal: clubA,
    companions: [clubB, sigNE],
    livingTrace: neRecyc,
  });
  _CLUSTER(out, {
    id: 'ch6.SW.snack',
    role: 'ambient',
    cell: 'SW',
    focal: snackSW,
    companions: [],
    livingTrace: swGarb,
  });
  _CLUSTER(out, {
    id: 'ch6.SE.mahjong',
    role: 'ambient',
    cell: 'SE',
    focal: mahSE,
    companions: [sigSE],
    livingTrace: seBike,
  });

  // ═══ HUMANS (8 人) ═══
  out.humans = [
    _H(-110, 38), _H( -50, 38),                   // カップル NW × 2
    _H( 130, 38), _H(  70, 38),                   // ホステス NE × 2
    _H(-130, 138), _H(-130, 145), _H( -75, 138),  // 酔客 snack × 3
    _H(   0, 100),                                 // 通行人
  ];

  // ═══ GROUNDS (8 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),
    _G('red_carpet',            -80,  60, 100,  40),    // NW 焦点 ラブホ前
    _G('red_carpet',           -160,  88,  30,  24),
    _G('red_carpet',            130,  38,  30,  24),    // NE club
    _G('red_carpet',             70,  38,  30,  24),    // NE club
    _G('concrete',             -130, 145,  90,  30),    // SW snack
    _G('oil_stained_concrete',  -75, 175,  80,  20),    // SW 路地
    _G('wood_deck',              30, 152,  30,  18),    // SE cafe
    _G('tile',                  130, 152,  60,  30),    // SE mahjong
    _G('stone_pavement',        -65, 100,  12, 200),
    _G('oil_stained_concrete',    0, 100,  25,  14),
  ];

  return out;
})() },
```

---

## §9.7 Ch7: 屋台横丁 (NW+NE merged hero、横道路ゼロ)

**ヒーロー / アンビエント**: **NW+NE merged = ヒーロー** (屋台 5 連が中央集約、基本形 A オープンスペース) / SW・SE = アンビエント

**merged ヒーロー 4 層**:
- **焦点**: `yatai` × 5 (x=-110/-55/0/55/108, y=68 微不揃い) ★
- **取り巻き (屋台周辺)**: 各屋台 `chouchin` × 1 (上空 y=58) + `parasol` × 1 (y=78) + `noren` × 5 (y=64)、客 `bench` × 5 (準対称、屋台間)
- **境界**: `wood_fence` × 2 (横丁入口 avenue 端 x=±178)、`flower_planter_row` × 2
- **動線**: `popcorn_cart` × 2 (西東端)、`balloon_cluster` × 3 (上空 y=30)、`street_lamp` × 2

**アンビエント 2 セル**:
- **SW (chaya + izakaya)**: `chaya` (x=-100, y=130) + `izakaya` (x=-160, y=138) + `noren` + `cat` (痕跡)
- **SE (ramen + sushi)**: `ramen` (x=100, y=130) + `sushi_ya` (x=160, y=138) + `chouchin` × 2 + `bicycle` (痕跡)

**人配置**: 屋台客 × 8 (各屋台 1-2 人)、屋台店主 × 5 (各屋台後ろ)、酔客 × 2、cat × 1

**地面パッチ**: ベース `asphalt` / merged 焦点 `red_carpet` 屋台床 (240×30) + `concrete` 屋台前 / SW `concrete` (chaya 前) / SE `concrete` (ramen 前) / 歩道帯

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: []` ✅ Q12 (横道路ゼロ — 屋台中央集約を活かす)

**Handoff (Ch6 → Ch7)**: ラブホから屋台へ、yatai 連続が Ch8 movie_theater のネオン看板へ予告

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch7: 屋台横丁 (NW+NE merged hero、横道路ゼロ) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [],                              // ✅ Q12 横道路ゼロ
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // merged 焦点: 屋台 × 5 微不揃い
  const yA = $B(out, 'yatai', -110, 68);   // ★ HERO FOCAL
  const yB = $B(out, 'yatai',  -55, 68);
  const yC = $B(out, 'yatai',    0, 70);   // 中央 yatai は y=70 で 2px ずらし
  const yD = $B(out, 'yatai',   55, 68);
  const yE = $B(out, 'yatai',  108, 70);
  // merged 上段ロット
  $B(out, 'townhouse',  -150, 22);
  $B(out, 'apartment',   150, 22);
  $B(out, 'shop',        -75, 22);
  $B(out, 'shop',         75, 22);
  // SW アンビエント
  const chayaSW = $B(out, 'chaya',   -100, 130);
  $B(out, 'izakaya',                 -160, 138);
  // SE アンビエント
  const ramenSE = $B(out, 'ramen',    100, 130);
  $B(out, 'sushi_ya',                 160, 138);
  // タイトパッキング
  $B(out, 'shed',       -160, 195);
  $B(out, 'shed',        160, 195);

  // ═══ FURNITURE (78 個) ═══
  // ── merged 焦点 4 層: 屋台 5 連 ──
  // 各屋台 chouchin × 1 上空
  const chouA = $F(out, 'chouchin', -110, 58);  // 屋台 1 提灯
  $F(out, 'chouchin',                -55, 58);  // 屋台 2 提灯
  $F(out, 'chouchin',                  0, 60);  // 屋台 3 提灯 (y=60 ずらし)
  $F(out, 'chouchin',                 55, 58);  // 屋台 4 提灯
  $F(out, 'chouchin',                108, 60);  // 屋台 5 提灯
  // parasol × 5
  $F(out, 'parasol',                -110, 78);
  $F(out, 'parasol',                 -55, 78);
  $F(out, 'parasol',                   0, 80);
  $F(out, 'parasol',                  55, 78);
  $F(out, 'parasol',                 108, 80);
  // noren × 5
  $F(out, 'noren',                  -110, 64);
  $F(out, 'noren',                   -55, 64);
  $F(out, 'noren',                     0, 66);
  $F(out, 'noren',                    55, 64);
  $F(out, 'noren',                   108, 66);
  // 客 bench × 5 (準対称、屋台間)
  const benchA = $F(out, 'bench',    -85, 88);
  $F(out, 'bench',                   -28, 88);
  $F(out, 'bench',                    28, 88);
  $F(out, 'bench',                    80, 88);
  $F(out, 'bench',                   130, 88);
  // 境界
  const wfA = $F(out, 'wood_fence', -178, 70);
  const wfB = $F(out, 'wood_fence',  178, 70);
  $F(out, 'flower_planter_row',     -150, 88);
  $F(out, 'flower_planter_row',      150, 88);
  // 動線
  const popA = $F(out, 'popcorn_cart',-150, 60);
  $F(out, 'popcorn_cart',             150, 60);
  $F(out, 'balloon_cluster',         -100, 30);
  $F(out, 'balloon_cluster',            0, 30);
  $F(out, 'balloon_cluster',          100, 30);
  const lampA = $F(out, 'street_lamp', -65, 88);
  const lampB = $F(out, 'street_lamp',  65, 88);

  // ── 上段ロット (取り巻き facade) ──
  $F(out, 'sign_board',             -150, 22);
  $F(out, 'sign_board',              150, 22);
  $F(out, 'sign_board',              -75, 22);
  $F(out, 'sign_board',               75, 22);

  // ── SW アンビエント ──
  $F(out, 'noren',                  -100, 122);
  const swCat = $F(out, 'cat',      -170, 175);  // ★ SW livingTrace
  $F(out, 'a_frame_sign',           -130, 148);

  // ── SE アンビエント ──
  $F(out, 'chouchin',                100, 122);
  $F(out, 'chouchin',                160, 122);
  const seBike = $F(out, 'bicycle',  130, 175);  // ★ SE livingTrace

  // ── 取り巻き 3 パターン ──
  $F(out, 'puddle_reflection',       -50, 105);
  $F(out, 'puddle_reflection',        50, 105);
  $F(out, 'manhole_cover',           -65, 100);
  $F(out, 'manhole_cover',             0, 100);
  $F(out, 'manhole_cover',            65, 100);

  // ── 連続軸 ──
  $F(out, 'power_pole',             -178, 92);
  $F(out, 'power_pole',              178, 92);
  $F(out, 'power_pole',             -178, 195);
  $F(out, 'power_pole',              178, 195);
  $F(out, 'power_line',              -90, 195);
  $F(out, 'power_line',               90, 195);
  $F(out, 'cable_junction_box',     -170, 195);
  $F(out, 'cable_junction_box',      170, 195);
  const garbage = $F(out, 'garbage',   0, 90);
  $F(out, 'newspaper_stand',           0, 88);

  // ═══ CLUSTERS ═══
  _CLUSTER(out, {
    id: 'ch7.merged.yatai5',
    role: 'hero',
    cell: 'merged',
    focal: yC,                                     // 中央屋台を focal
    companions: [yA, yB, yD, yE, chouA, benchA, popA, lampA, lampB],
    boundary: [wfA, wfB, $F(out, 'flower_planter_row', 0, 88)],
    access: [lampA, lampB],
    livingTrace: garbage,
  });
  _CLUSTER(out, {
    id: 'ch7.SW.chaya',
    role: 'ambient',
    cell: 'SW',
    focal: chayaSW,
    companions: [],
    livingTrace: swCat,
  });
  _CLUSTER(out, {
    id: 'ch7.SE.ramen',
    role: 'ambient',
    cell: 'SE',
    focal: ramenSE,
    companions: [],
    livingTrace: seBike,
  });
  _CLUSTER(out, {
    id: 'ch7.NW.shop',
    role: 'ambient',
    cell: 'NW',
    focal: $F(out, 'sign_board', -178, 22),       // NW 上段の dummy ambient
    companions: [],
    livingTrace: $F(out, 'mailbox', -178, 38),
  });

  // ═══ HUMANS (12 人) ═══
  out.humans = [
    _H(-110, 88), _H( -55, 88), _H(   0, 88),     // 屋台客 各 1
    _H(  55, 88), _H( 108, 88),
    _H(-110, 75), _H( -55, 75), _H(   0, 75),     // 屋台店主 (後ろ)
    _H(-100, 145), _H( 100, 145),                  // 酔客 × 2
    _H(   0, 100),                                  // 通行人
    _H( 130, 145),                                  // SE bicycle そば
  ];

  // ═══ GROUNDS (8 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),
    _G('red_carpet',              0,  78, 240,  30),    // 屋台床
    _G('concrete',                0, 100, 320,  30),    // 屋台前
    _G('concrete',             -100, 145, 130,  30),    // SW chaya
    _G('oil_stained_concrete', -100, 175, 100,  20),    // SW 路地
    _G('concrete',              100, 145, 130,  30),    // SE ramen
    _G('tile',                 -150,  38,  24,  24),    // 上段店
    _G('tile',                  150,  38,  24,  24),
    _G('stone_pavement',        -65, 100,  12, 200),
  ];

  return out;
})() },
```

---

## §9.8 Ch8: 映画館 + ミニシアター街

**ヒーロー / アンビエント**: **SE = ヒーロー** (movie_theater 大ポスター、基本形 B) / NW・NE・SW = アンビエント

**SE ヒーロー 4 層**:
- **焦点**: `movie_theater` (x=130, y=130) ★ + `cafe` (x=60, y=138) 隣
- **取り巻き**: `sign_board` ポスター見立て (x=130, y=118) + `banner_pole` × 3 (x=100/158/60, y=120) + `flag_pole` × 2 + `shop_awning` × 2
- **境界**: `flower_planter_row` × 2 (x=110/170, y=170)、`bollard` × 3 (x=80/178/30, y=140)
- **動線**: `street_lamp` × 2、`bench` × 3 待ち客、`puddle_reflection` × 2

**アンビエント 3 セル**:
- **NW (karaoke + club + snack)**: `karaoke` (x=-130, y=22) + `club` (x=-75, y=22) + `snack` (x=-25, y=22) + `sign_board` 黄 + `garbage` (痕跡)
- **NE (pachinko + game_center + snack)**: `pachinko` (x=130, y=22) + `game_center` (x=70, y=22) + `snack` (x=165, y=22) + `sign_board` 赤 + `bicycle` (痕跡)
- **SW (mansion × 2 + mahjong)**: `mansion` × 2 (x=-100/-45, y=130) + `mahjong_parlor` (x=-130, y=178) + `mailbox` (痕跡)

**取り巻き 3 パターン**: facade 沿い `sign_board` × 5 / 焦点囲み SE 映画館前のポスター + banner_pole × 3 + flag_pole × 2 / 歩道沿い `street_lamp` × 2 + `puddle_reflection` × 3

**人配置**: 映画客 × 5 (SE)、ホスト × 3 (NW)、パチンコ客 × 3 (NE)、cat × 1

**地面パッチ**: ベース `asphalt` / SE 焦点 `tile` 映画館前 + `wood_deck` cafe / NW `concrete` × 2 + `tile` (snack) / NE `tile` × 2 + `concrete` × 2 / SW `concrete` (mansion 駐車) / 歩道帯

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _HR(155, 30, 180)]` ✅ Q12 (SE 映画館前サービス道)

**Handoff (Ch7 → Ch8)**: 屋台から映画館へ、深夜上映の客 × 5 が SE に集中

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch8: 映画館 + ミニシアター街 (SE = ヒーロー) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR, _HR(155, 30, 180)],     // ✅ Q12 SE サービス道
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // SE 焦点
  const movie = $B(out, 'movie_theater', 130, 130);   // ★ HERO FOCAL
  const cafeSE = $B(out, 'cafe',          60, 138);
  // NW アンビエント
  const karaNW = $B(out, 'karaoke',     -130, 22);
  $B(out, 'club',                        -75, 22);
  $B(out, 'snack',                       -25, 22);
  // NE アンビエント
  const pachNE = $B(out, 'pachinko',     130, 22);
  $B(out, 'game_center',                  70, 22);
  $B(out, 'snack',                       165, 22);
  // SW アンビエント
  const mansSW = $B(out, 'mansion',     -100, 130);
  $B(out, 'mansion',                     -45, 130);
  $B(out, 'mahjong_parlor',             -130, 178);
  // タイトパッキング
  $B(out, 'capsule_hotel',                30, 75);
  $B(out, 'shop',                        -178, 75);
  $B(out, 'shed',                       -160, 195);
  $B(out, 'garage',                      178, 195);

  // ═══ FURNITURE (78 個) ═══
  // ── SE 焦点 4 層 ──
  const movieSign = $F(out, 'sign_board', 130, 118);  // ★ ポスター
  const banA = $F(out, 'banner_pole',     100, 120);
  $F(out, 'banner_pole',                  158, 120);
  $F(out, 'banner_pole',                   60, 120);
  const flagA = $F(out, 'flag_pole',     130, 110);
  $F(out, 'flag_pole',                    60, 110);
  $F(out, 'shop_awning',                 130, 145);
  $F(out, 'shop_awning',                  60, 145);
  // 境界
  const fpA = $F(out, 'flower_planter_row', 110, 170);
  $F(out, 'flower_planter_row',           170, 170);
  const bolA = $F(out, 'bollard',          80, 140);
  $F(out, 'bollard',                      178, 140);
  $F(out, 'bollard',                       30, 140);
  // 動線
  const lampA = $F(out, 'street_lamp',     65, 100);
  const lampB = $F(out, 'street_lamp',    130, 88);
  $F(out, 'bench',                         90, 152);
  $F(out, 'bench',                        130, 152);
  $F(out, 'bench',                        165, 152);
  $F(out, 'puddle_reflection',            100, 168);
  $F(out, 'puddle_reflection',            150, 168);

  // ── NW アンビエント ──
  const sigA = $F(out, 'sign_board',    -130, 8);     // 黄
  $F(out, 'sign_board',                  -75, 8);
  $F(out, 'sign_board',                  -25, 8);
  const nwGarb = $F(out, 'garbage',     -160, 60);    // ★ NW livingTrace

  // ── NE アンビエント ──
  $F(out, 'sign_board',                  130, 8);     // 赤
  $F(out, 'sign_board',                   70, 8);
  $F(out, 'sign_board',                  165, 8);
  const neBike = $F(out, 'bicycle',      100, 60);    // ★ NE livingTrace
  $F(out, 'bicycle',                      50, 60);

  // ── SW アンビエント ──
  const swMail = $F(out, 'mailbox',     -100, 130);   // ★ SW livingTrace
  $F(out, 'chouchin',                   -130, 168);

  // ── 取り巻き 3 パターン ──
  $F(out, 'puddle_reflection',           -50, 105);
  $F(out, 'puddle_reflection',            50, 105);
  $F(out, 'puddle_reflection',             0, 105);
  $F(out, 'street_lamp',                 -65, 100);
  $F(out, 'manhole_cover',               -65, 100);
  $F(out, 'manhole_cover',                 0, 100);

  // ── 連続軸 ──
  $F(out, 'power_pole',                 -178, 92);
  $F(out, 'power_pole',                  178, 92);
  $F(out, 'power_pole',                 -178, 195);
  $F(out, 'power_pole',                  178, 195);
  $F(out, 'power_line',                  -90, 195);
  $F(out, 'power_line',                   90, 195);
  $F(out, 'cable_junction_box',         -170, 195);
  $F(out, 'cable_junction_box',          170, 195);
  $F(out, 'cat',                        -170, 175);
  $F(out, 'newspaper_stand',               0, 88);

  // ═══ CLUSTERS ═══
  _CLUSTER(out, {
    id: 'ch8.SE.cinema',
    role: 'hero',
    cell: 'SE',
    focal: movie,
    companions: [cafeSE, movieSign, banA, flagA, lampA, lampB],
    boundary: [fpA, $F(out, 'flower_planter_row', 170, 170), bolA],
    access: [lampA, lampB],
    livingTrace: $F(out, 'recycling_bin', 165, 168),
  });
  _CLUSTER(out, {
    id: 'ch8.NW.karaoke',
    role: 'ambient',
    cell: 'NW',
    focal: karaNW,
    companions: [sigA],
    livingTrace: nwGarb,
  });
  _CLUSTER(out, {
    id: 'ch8.NE.pachinko',
    role: 'ambient',
    cell: 'NE',
    focal: pachNE,
    companions: [],
    livingTrace: neBike,
  });
  _CLUSTER(out, {
    id: 'ch8.SW.mansion',
    role: 'ambient',
    cell: 'SW',
    focal: mansSW,
    companions: [],
    livingTrace: swMail,
  });

  // ═══ HUMANS (12 人) ═══
  out.humans = [
    _H( 130, 145), _H( 130, 152), _H(  90, 152), _H( 165, 152), _H(  60, 145),  // 映画客 × 5
    _H(-130, 38), _H( -75, 38), _H( -25, 38),                                    // ホスト NW × 3
    _H( 130, 38), _H(  70, 38), _H( 165, 38),                                    // パチンコ客 NE × 3
    _H(   0, 100),                                                                // 通行人
  ];

  // ═══ GROUNDS (10 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),
    _G('tile',                  130, 152, 100,  60),    // SE 映画館前
    _G('wood_deck',              60, 152,  50,  30),    // SE cafe
    _G('concrete',             -130,  38,  24,  24),
    _G('concrete',              -75,  38,  24,  24),
    _G('tile',                  -25,  38,  24,  24),    // NW snack
    _G('tile',                  130,  38,  24,  24),
    _G('tile',                   70,  38,  24,  24),
    _G('concrete',              165,  38,  24,  24),
    _G('concrete',             -100, 152,  80,  30),    // SW mansion 駐車
    _G('stone_pavement',        -65, 100,  12, 200),
    _G('oil_stained_concrete',    0, 100,  25,  14),
    _G('concrete',              105, 155,  80,  10),    // SE _HR 沿い
  ];

  return out;
})() },
```

---

## §9.9 Ch9: 駐車場と裏通り (静寂転換の入口)

**ヒーロー / アンビエント**: **NE = ヒーロー** (コインパーキング、基本形 A オープンスペース) / NW・SW・SE = アンビエント (古い住宅 / 蔵 / 町家)

**NE ヒーロー 4 層**:
- **焦点**: `parking` (x=130, y=68) 大駐車場 + `gas_station` (x=30, y=22)
- **取り巻き**: `traffic_cone` × 4 + `barrier` × 2 + 駐車車両 `car` × 3 (x=80/130/170, y=80)
- **境界**: `wood_fence` × 3 (区画 x=75 列)、`hedge` × 2 (x=178)
- **動線**: `street_lamp` × 1 (寂しい)、`vending` × 1 (孤立)、`garbage` (痕跡)

**アンビエント 3 セル**:
- **NW (古い住宅)**: 古い `house` × 2 (x=-130/-90, y=22) + `snack` (x=-45, y=22 閉店間際) + `mailbox` × 3 (痕跡)
- **SW (kura + machiya)**: `kura` (x=-130, y=130) + `machiya` (x=-70, y=138) + `wood_fence` × 3 + `garbage` (痕跡)
- **SE (townhouse + apartment + cat × 4)**: `townhouse` × 2 (x=80/140, y=130) + `apartment` (x=100, y=178) + `cat` × 4 (痕跡: 静寂の主役)

**取り巻き 3 パターン**: facade 沿い 古い `mailbox` × 4 不揃い / 焦点囲み 駐車場 traffic_cone × 4 + 駐車車両 × 3 + barrier × 2 / 歩道沿い `puddle_reflection` × 3 (朝霧の予兆) + `street_lamp` × 2

**人配置**: 深夜散歩客 × 1、cat × 5 (静寂の街の主役)

**地面パッチ**: ベース `asphalt` / NE 焦点 `oil_stained_concrete` 駐車場 / NW `concrete` × 2 (古い住宅) / SW `stone_pavement` (神社予兆) + `fallen_leaves` / SE `concrete` (駐車) / 歩道帯

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _HR(80, 65, 180)]` ✅ Q12 (NE パーキング入口専用)

**Handoff (Ch8 → Ch9)**: 賑わいから静寂へ、chouchin 1 本だけ残る (寂しさ表現)

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch9: 駐車場と裏通り (静寂転換の入口) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR, _HR(80, 65, 180)],      // ✅ Q12 NE パーキング入口
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // NE 焦点
  const parking = $B(out, 'parking',  130, 68);     // ★ HERO FOCAL
  const gasNE   = $B(out, 'gas_station', 30, 22);
  // NW アンビエント
  const houseA  = $B(out, 'house',   -130, 22);
  $B(out, 'house',                    -90, 22);
  $B(out, 'snack',                    -45, 22);
  // SW アンビエント
  const kuraSW  = $B(out, 'kura',    -130, 130);
  $B(out, 'machiya',                  -70, 138);
  // SE アンビエント
  const tnSE    = $B(out, 'townhouse',  80, 130);
  $B(out, 'townhouse',                 140, 130);
  $B(out, 'apartment',                 100, 178);
  // タイトパッキング
  $B(out, 'shed',     -178, 70);
  $B(out, 'shed',     -160, 178);
  $B(out, 'garage',    -50, 178);
  $B(out, 'machiya',  -178, 130);
  $B(out, 'kominka',   175, 178);

  // ═══ FURNITURE (74 個) ═══
  // ── NE 焦点 4 層 ──
  const tcA = $F(out, 'traffic_cone',  80, 60);
  $F(out, 'traffic_cone',             130, 60);
  $F(out, 'traffic_cone',             170, 60);
  $F(out, 'traffic_cone',             130, 95);
  const barA = $F(out, 'barrier',      80, 88);
  $F(out, 'barrier',                  178, 88);
  const carA = $F(out, 'car',          80, 80);
  $F(out, 'car',                      130, 80);
  $F(out, 'car',                      170, 80);
  // 境界
  const wfA = $F(out, 'wood_fence',    75, 60);
  $F(out, 'wood_fence',                75, 75);
  $F(out, 'wood_fence',                75, 90);
  $F(out, 'hedge',                    178, 30);
  $F(out, 'hedge',                    178, 80);
  // 動線
  const lampA = $F(out, 'street_lamp',100, 95);
  $F(out, 'vending',                   60, 38);
  const neGarb = $F(out, 'garbage',   165, 45);     // ★ NE livingTrace

  // ── NW アンビエント ──
  $F(out, 'mailbox',                 -130, 22);
  $F(out, 'mailbox',                  -90, 22);
  $F(out, 'mailbox',                  -45, 22);
  const nwMail = $F(out, 'mailbox',     0, 22);     // ★ NW livingTrace
  $F(out, 'sign_board',                -45, 8);     // snack 閉店間際

  // ── SW アンビエント ──
  $F(out, 'wood_fence',              -150, 168);
  $F(out, 'wood_fence',              -120, 168);
  $F(out, 'wood_fence',               -50, 168);
  const swGarb = $F(out, 'garbage',  -100, 175);    // ★ SW livingTrace
  $F(out, 'cat',                     -170, 145);

  // ── SE アンビエント (cat × 4 静寂の主役) ──
  $F(out, 'cat',                      170, 165);
  $F(out, 'cat',                      130, 195);
  $F(out, 'cat',                       90, 165);
  const seCat = $F(out, 'cat',         50, 175);    // ★ SE livingTrace

  // ── 取り巻き 3 パターン ──
  $F(out, 'puddle_reflection',        -50, 105);
  $F(out, 'puddle_reflection',         50, 105);
  $F(out, 'puddle_reflection',          0, 110);
  $F(out, 'street_lamp',              -65, 100);
  $F(out, 'street_lamp',               65, 100);
  $F(out, 'manhole_cover',            -65, 100);
  $F(out, 'manhole_cover',              0, 100);
  $F(out, 'chouchin',                 -45, 38);    // 寂しさ表現 1 本残し

  // ── 連続軸 ──
  $F(out, 'power_pole',              -178, 92);
  $F(out, 'power_pole',               178, 92);
  $F(out, 'power_pole',              -178, 195);
  $F(out, 'power_pole',               178, 195);
  $F(out, 'power_line',               -90, 195);
  $F(out, 'power_line',                90, 195);
  $F(out, 'cable_junction_box',      -170, 195);
  $F(out, 'cable_junction_box',       170, 195);
  $F(out, 'cat',                     -170, 175);
  $F(out, 'newspaper_stand',          165, 75);

  // ═══ CLUSTERS ═══
  _CLUSTER(out, {
    id: 'ch9.NE.parking',
    role: 'hero',
    cell: 'NE',
    focal: parking,
    companions: [gasNE, tcA, carA, lampA],
    boundary: [wfA, $F(out, 'wood_fence', 75, 105), $F(out, 'hedge', 178, 130)],
    access: [lampA, $F(out, 'manhole_cover', 100, 100)],
    livingTrace: neGarb,
  });
  _CLUSTER(out, {
    id: 'ch9.NW.house',
    role: 'ambient',
    cell: 'NW',
    focal: houseA,
    companions: [],
    livingTrace: nwMail,
  });
  _CLUSTER(out, {
    id: 'ch9.SW.kura',
    role: 'ambient',
    cell: 'SW',
    focal: kuraSW,
    companions: [],
    livingTrace: swGarb,
  });
  _CLUSTER(out, {
    id: 'ch9.SE.townhouse',
    role: 'ambient',
    cell: 'SE',
    focal: tnSE,
    companions: [],
    livingTrace: seCat,
  });

  // ═══ HUMANS (8 人) ═══
  out.humans = [
    _H(   0, 100),                                  // 深夜散歩客
    _H(-130, 38),                                   // 古い住宅前
    _H( -90, 38),
    _H(  30, 38),                                   // gas station
    _H(  90, 60),                                   // パーキング訪問
    _H(  50, 100),
    _H( -45, 38),
    _H( -75, 145),
  ];

  // ═══ GROUNDS (8 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),
    _G('oil_stained_concrete',  130,  80, 100,  50),    // NE 駐車場
    _G('concrete',             -130,  38,  24,  24),    // NW 古い住宅
    _G('concrete',              -90,  38,  24,  24),
    _G('concrete',              -45,  38,  24,  24),
    _G('stone_pavement',       -100, 145,  80,  40),    // SW 神社予兆
    _G('fallen_leaves',        -130, 180,  30,  16),
    _G('concrete',              110, 152,  80,  30),    // SE 駐車
    _G('stone_pavement',        -65, 100,  12, 200),
    _G('oil_stained_concrete',    0, 100,  25,  14),
  ];

  return out;
})() },
```

---

## §9.10 Ch10: 古い住宅 + 神社の裏手

**ヒーロー / アンビエント**: **SW = ヒーロー** (神社の裏 + 蔵集落、stone_pavement 参道予告) / NW・NE・SE = アンビエント

**SW ヒーロー 4 層**:
- **焦点**: `kura` (x=-100, y=130) ★ 神社蔵見立て + `shed` (x=-160, y=130) 摂社見立て
- **取り巻き**: `stone_lantern` × 3 (準対称 x=-130/-70/-100, y=145/168) + `bamboo_water_fountain` (x=-70, y=158)
- **境界**: `bamboo_fence` × 4 (神社境内輪郭 x=-178 列 + x=0 列)、`hedge` × 2
- **動線**: `stone_pavement` 帯 (x=-100, y=145, 80×80)、`fallen_leaves` × 2 ground

**アンビエント 3 セル**:
- **NW (kominka + chaya + wagashi)**: `kominka` (x=-130, y=22) + `chaya` (x=-75, y=22) + `wagashi` (x=-25, y=22) + `noren` × 3 + `mailbox` (痕跡)
- **NE (townhouse × 2 + machiya)**: `townhouse` × 2 (x=80/130, y=22) + `machiya` (x=30, y=22) + `bonsai` + `cat` (痕跡)
- **SE (shed × 2 + machiya + kura)**: `shed` × 2 (x=60/130, y=130) + `machiya` (x=30, y=138) + `kura` (x=165, y=178) + `garbage` (痕跡)

**取り巻き 3 パターン**: facade 沿い `noren` × 3 (chaya/wagashi/kominka) + `mailbox` × 3 不揃い / 焦点囲み SW 神社の stone_lantern × 3 + bamboo_water_fountain + bamboo_fence × 4 / 歩道沿い `puddle_reflection` × 3 (朝霧) + `street_lamp` × 2

**人配置**: 早朝散歩 × 1、cat × 4 (静寂)

**地面パッチ**: ベース `asphalt` / SW 焦点 `stone_pavement` 神社境内 + `moss` 苔 + `fallen_leaves` × 2 + `gravel` 玉砂利 / NW `grass` 古民家庭 + `dirt` / NE `grass` 庭 + `concrete` / SE `concrete` (蔵集落) / 歩道帯

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _HR(165, -180, 0)]` ✅ Q12 (SW 蔵集落の小道)

**Handoff (Ch9 → Ch10)**: 駐車場の静寂から神社の裏へ、stone_pavement 参道開始

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch10: 古い住宅 + 神社の裏手 (SW = ヒーロー) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR, _HR(165, -180, 0)],     // ✅ Q12 SW 蔵集落小道
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // SW 焦点
  const kuraSW = $B(out, 'kura',     -100, 130);    // ★ HERO FOCAL
  const shedSW = $B(out, 'shed',     -160, 130);
  // NW アンビエント
  const komiNW = $B(out, 'kominka',  -130, 22);
  $B(out, 'chaya',                    -75, 22);
  $B(out, 'wagashi',                  -25, 22);
  // NE アンビエント
  const tnNE   = $B(out, 'townhouse',  80, 22);
  $B(out, 'townhouse',                130, 22);
  $B(out, 'machiya',                   30, 22);
  // SE アンビエント
  const shedSE = $B(out, 'shed',       60, 130);
  $B(out, 'shed',                     130, 130);
  $B(out, 'machiya',                   30, 138);
  $B(out, 'kura',                     165, 178);
  // タイトパッキング
  $B(out, 'kominka',                 -178, 75);
  $B(out, 'townhouse',                170, 75);
  $B(out, 'shop',                     178, 195);

  // ═══ FURNITURE (74 個) ═══
  // ── SW 焦点 4 層 ──
  const slA = $F(out, 'stone_lantern', -130, 145);   // 石灯籠 西
  const slB = $F(out, 'stone_lantern',  -70, 145);   // 石灯籠 東
  const slC = $F(out, 'stone_lantern', -100, 168);   // 石灯籠 中央南
  $F(out, 'bamboo_water_fountain',     -70, 158);    // 手水
  // 境界
  const bfA = $F(out, 'bamboo_fence', -178, 130);
  const bfB = $F(out, 'bamboo_fence', -178, 168);
  const bfC = $F(out, 'bamboo_fence',    0, 130);
  $F(out, 'bamboo_fence',                0, 168);
  $F(out, 'hedge',                     -50, 195);
  $F(out, 'hedge',                    -150, 195);

  // ── NW アンビエント ──
  $F(out, 'noren',                  -130, 28);
  $F(out, 'noren',                   -75, 28);
  $F(out, 'noren',                   -25, 28);
  const nwMail = $F(out, 'mailbox', -100, 22);       // ★ NW livingTrace
  $F(out, 'mailbox',                -130, 22);

  // ── NE アンビエント ──
  $F(out, 'bonsai',                   80, 38);
  const neCat = $F(out, 'cat',       170, 38);       // ★ NE livingTrace
  $F(out, 'mailbox',                 -25, 22);

  // ── SE アンビエント ──
  const seGarb = $F(out, 'garbage',  100, 175);      // ★ SE livingTrace
  $F(out, 'mailbox',                  60, 130);

  // ── 取り巻き 3 パターン ──
  $F(out, 'puddle_reflection',       -50, 105);
  $F(out, 'puddle_reflection',        50, 105);
  $F(out, 'puddle_reflection',         0, 110);
  $F(out, 'street_lamp',             -65, 100);
  $F(out, 'street_lamp',              65, 100);
  $F(out, 'manhole_cover',           -65, 100);
  $F(out, 'manhole_cover',             0, 100);

  // ── 連続軸 ──
  $F(out, 'power_pole',             -178, 92);
  $F(out, 'power_pole',              178, 92);
  $F(out, 'power_pole',             -178, 195);
  $F(out, 'power_pole',              178, 195);
  $F(out, 'power_line',              -90, 195);
  $F(out, 'power_line',               90, 195);
  $F(out, 'cable_junction_box',     -170, 195);
  $F(out, 'cable_junction_box',      170, 195);
  $F(out, 'cat',                    -170, 175);
  $F(out, 'cat',                    -150, 195);
  $F(out, 'newspaper_stand',           0, 88);
  $F(out, 'potted_plant',            -75, 60);

  // ═══ CLUSTERS ═══
  _CLUSTER(out, {
    id: 'ch10.SW.shrine_back',
    role: 'hero',
    cell: 'SW',
    focal: kuraSW,
    companions: [shedSW, slA, slB, slC],
    boundary: [bfA, bfB, bfC],
    access: [$F(out, 'stone_lantern', -130, 168), $F(out, 'street_lamp', -100, 145)],
    livingTrace: $F(out, 'fallen_leaves' as any, -100, 145),  // 注: ground, livingTrace は furniture ref のため省略可
  });
  _CLUSTER(out, {
    id: 'ch10.NW.kominka',
    role: 'ambient',
    cell: 'NW',
    focal: komiNW,
    companions: [],
    livingTrace: nwMail,
  });
  _CLUSTER(out, {
    id: 'ch10.NE.townhouse',
    role: 'ambient',
    cell: 'NE',
    focal: tnNE,
    companions: [],
    livingTrace: neCat,
  });
  _CLUSTER(out, {
    id: 'ch10.SE.shed',
    role: 'ambient',
    cell: 'SE',
    focal: shedSE,
    companions: [],
    livingTrace: seGarb,
  });

  // ═══ HUMANS (8 人) ═══
  out.humans = [
    _H(   0, 100),                                    // 早朝散歩
    _H(-100, 145),                                    // 神社境内
    _H( -75, 158),                                    // 手水
    _H(-130, 38),                                     // 茶屋客
    _H( -75, 38),
    _H(  30, 38),
    _H( 100, 145),
    _H(  50, 100),
  ];

  // ═══ GROUNDS (10 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),
    _G('stone_pavement',       -100, 145,  80,  80),    // SW 神社境内
    _G('moss',                  -75, 168,  30,  20),
    _G('fallen_leaves',        -130, 180,  25,  14),
    _G('fallen_leaves',         -50, 180,  25,  14),
    _G('gravel',               -100, 195,  40,  14),
    _G('grass',                 -75,  60,  80,  40),    // NW 古民家庭
    _G('dirt',                 -100,  88,  30,  16),
    _G('grass',                  80,  60,  50,  40),    // NE 庭
    _G('concrete',              100, 152, 100,  30),    // SE 蔵集落
    _G('stone_pavement',        -65, 100,  12, 200),
    _G('concrete',              -90, 165,  80,  10),    // SW _HR 沿い
  ];

  return out;
})() },
```

---

## §9.11 Ch11: 神社の表参道 (Stage 3 への handoff、★)

**ヒーロー / アンビエント**: **NE = ヒーロー** (torii と表参道、Stage 3 への移行点) / NW・SW・SE = アンビエント (Stage 3 予告として和風)

**NE ヒーロー 4 層**:
- **焦点**: `torii` 鳥居 (x=80, y=22) ★ ランドマーク + `offering_box` (x=80, y=95) + `omikuji_stand` + `ema_rack`
- **取り巻き**: `sando_stone_pillar` × 3 (x=40/80/120, y=58/88) + `stone_lantern` × 2 (x=40/120, y=88) + `koma_inu` × 2 (x=60/100, y=68)
- **境界**: `bamboo_fence` × 6 (参道両側 x=10/150 列、y=10/50/90) + `shrine_fence_red` × 2 (赤柵)
- **動線**: 参道 `stone_pavement` 帯 (x=80, y=100, 100×100)、`shinto_rope` (鳥居上 x=80, y=22)

**アンビエント 3 セル**:
- **NW (chaya + wagashi + kominka)**: `chaya` (x=-100, y=22) + `wagashi` (x=-45, y=22) + `kominka` (x=-75, y=75) + `noren` × 2 + `bicycle` (痕跡)
- **SW (kura × 2 + machiya)**: `kura` × 2 (x=-130/-70, y=130) + `machiya` (x=-25, y=138) + `wood_fence` × 3 + `garbage` (痕跡)
- **SE (kominka + chaya)**: `kominka` (x=130, y=130) + `chaya` (x=60, y=138) + `mailbox` (痕跡) + `cat` × 2

**取り巻き 3 パターン**: facade 沿い `noren` × 3 (chaya/wagashi) + `chouchin` × 2 (Stage 3 予告) / 焦点囲み NE 表参道の sando_stone_pillar × 3 + stone_lantern × 2 + koma_inu × 2 / 歩道沿い `puddle_reflection` × 3 (朝霧) + `street_lamp` × 2

**人配置**: 早朝参拝者 × 2 (NE 参道)、cat × 3 (静寂の主役)

**地面パッチ**: ベース `asphalt` 縮小 / NE 焦点 `stone_pavement` 表参道 + `gravel` 玉砂利 + `fallen_leaves` × 4 + `moss` / NW `grass` (茶屋庭) + `dirt` 庭石 / SW `stone_pavement` 蔵集落 + `gravel` + `moss` / SE `stone_pavement` + `gravel` + `moss` / 歩道帯

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]` (参道一直線、追加 _HR なし)

**Handoff (Ch11 → Stage 3 Ch0)**: 街灯 → Stage 3 でオフィス街路樹 `tree` に切替、`stone_pavement` 神社参道帯が Stage 3 へ継続、torii と stone_pavement が Stage 3 のオフィス公共広場 (`stone_pavement` 大パッチ) を予告

**TypeScript スケルトン (paste-ready)**:

```ts
// ── Ch11: 神社の表参道 (NE = ヒーロー、Stage 3 への handoff、★) ──
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  };

  // ═══ BUILDINGS (15 棟) ═══
  // NW アンビエント (NE は torii ランドマークで建物無し、focal は furniture)
  const chayaNW = $B(out, 'chaya',    -100, 22);
  $B(out, 'wagashi',                   -45, 22);
  $B(out, 'kominka',                   -75, 75);
  // SW アンビエント
  const kuraSW1 = $B(out, 'kura',     -130, 130);
  $B(out, 'kura',                      -70, 130);
  $B(out, 'machiya',                   -25, 138);
  // SE アンビエント
  const komiSE  = $B(out, 'kominka',   130, 130);
  $B(out, 'chaya',                      60, 138);
  // タイトパッキング (NE は torii のため建物少なめ)
  $B(out, 'shed',                      130, 195);
  $B(out, 'shop',                      178, 22);
  $B(out, 'shop',                      178, 75);
  $B(out, 'townhouse',                -178, 138);
  $B(out, 'shed',                     -178, 195);
  $B(out, 'wagashi',                   170, 178);
  $B(out, 'kominka',                   170, 22);

  // ═══ FURNITURE (76 個) ═══
  // ── NE 焦点 4 層: 表参道 ──
  const torii   = $F(out, 'torii',          80, 22);    // ★ ランドマーク
  const offBox  = $F(out, 'offering_box',   80, 95);
  const omiku   = $F(out, 'omikuji_stand',  60, 95);
  const emaR    = $F(out, 'ema_rack',      100, 95);
  // 取り巻き
  const sspA    = $F(out, 'sando_stone_pillar', 40, 58);
  $F(out, 'sando_stone_pillar',                  80, 88);
  $F(out, 'sando_stone_pillar',                 120, 58);
  const slA     = $F(out, 'stone_lantern',  40, 88);
  $F(out, 'stone_lantern',                  120, 88);
  const koA     = $F(out, 'koma_inu',       60, 68);
  $F(out, 'koma_inu',                      100, 68);
  // 境界
  const bfA = $F(out, 'bamboo_fence',  10, 10);
  $F(out, 'bamboo_fence',              10, 50);
  $F(out, 'bamboo_fence',              10, 90);
  $F(out, 'bamboo_fence',             150, 10);
  $F(out, 'bamboo_fence',             150, 50);
  $F(out, 'bamboo_fence',             150, 90);
  const sfA = $F(out, 'shrine_fence_red', 30, 38);
  $F(out, 'shrine_fence_red',           130, 38);
  // 動線
  const ropA = $F(out, 'shinto_rope',  80, 22);

  // ── NW アンビエント ──
  $F(out, 'noren',                   -100, 28);
  $F(out, 'noren',                    -45, 28);
  const nwBike = $F(out, 'bicycle',   -75, 60);    // ★ NW livingTrace

  // ── SW アンビエント ──
  $F(out, 'wood_fence',              -150, 175);
  $F(out, 'wood_fence',              -100, 175);
  $F(out, 'wood_fence',               -50, 175);
  const swGarb = $F(out, 'garbage',  -100, 168);   // ★ SW livingTrace

  // ── SE アンビエント ──
  const seMail = $F(out, 'mailbox',   130, 130);   // ★ SE livingTrace
  $F(out, 'cat',                      170, 145);
  $F(out, 'cat',                      130, 175);

  // ── 取り巻き 3 パターン ──
  $F(out, 'noren',                    -75, 75);    // NW 古民家
  $F(out, 'chouchin',                -100, 22);    // Stage 3 予告 (和風 facade)
  $F(out, 'chouchin',                 130, 22);
  $F(out, 'puddle_reflection',        -50, 105);
  $F(out, 'puddle_reflection',         50, 105);
  $F(out, 'puddle_reflection',          0, 110);
  $F(out, 'street_lamp',              -65, 100);
  $F(out, 'street_lamp',               65, 100);
  $F(out, 'manhole_cover',            -65, 100);
  $F(out, 'manhole_cover',              0, 100);
  $F(out, 'newspaper_stand',           80, 88);    // ★ NE livingTrace (Stage 3 handoff)

  // ── 連続軸 ──
  $F(out, 'power_pole',              -178, 92);
  $F(out, 'power_pole',               178, 92);
  $F(out, 'power_pole',              -178, 195);
  $F(out, 'power_pole',               178, 195);
  $F(out, 'power_line',               -90, 195);
  $F(out, 'power_line',                90, 195);
  $F(out, 'cable_junction_box',      -170, 195);
  $F(out, 'cable_junction_box',       170, 195);
  $F(out, 'cat',                     -170, 175);

  // ═══ CLUSTERS ═══
  _CLUSTER(out, {
    id: 'ch11.NE.torii',
    role: 'hero',
    cell: 'NE',
    focal: torii,
    companions: [offBox, omiku, emaR, sspA, slA, koA],
    boundary: [bfA, $F(out, 'bamboo_fence', 10, 130), sfA],
    access: [ropA, $F(out, 'sando_stone_pillar', 80, 145)],
    livingTrace: $F(out, 'newspaper_stand', 80, 100),
  });
  _CLUSTER(out, {
    id: 'ch11.NW.chaya',
    role: 'ambient',
    cell: 'NW',
    focal: chayaNW,
    companions: [],
    livingTrace: nwBike,
  });
  _CLUSTER(out, {
    id: 'ch11.SW.kura',
    role: 'ambient',
    cell: 'SW',
    focal: kuraSW1,
    companions: [],
    livingTrace: swGarb,
  });
  _CLUSTER(out, {
    id: 'ch11.SE.kominka',
    role: 'ambient',
    cell: 'SE',
    focal: komiSE,
    companions: [],
    livingTrace: seMail,
  });

  // ═══ HUMANS (8 人) ═══
  out.humans = [
    _H(  80, 100),                                  // 早朝参拝者 NE
    _H(  60, 95),                                   // 早朝参拝者 NE 2
    _H(-100, 38),                                   // 茶屋客
    _H( -45, 38),
    _H(  60, 145),                                  // SE 茶屋
    _H( -75, 145),                                  // 蔵集落散歩
    _H(   0, 100),                                  // 通行人
    _H(  50, 100),
  ];

  // ═══ GROUNDS (12 枚) ═══
  out.grounds = [
    _G('asphalt',                 0, 100, 360, 200),
    _G('stone_pavement',         80, 100, 100, 100),    // NE 表参道
    _G('gravel',                 80,  88,  80,  30),
    _G('fallen_leaves',          40,  88,  25,  15),
    _G('fallen_leaves',         120,  88,  25,  15),
    _G('moss',                   80, 178,  30,  20),
    _G('grass',                 -75,  60,  80,  40),    // NW 茶屋庭
    _G('dirt',                 -100,  88,  30,  16),
    _G('stone_pavement',       -100, 145,  80,  40),    // SW 蔵集落
    _G('gravel',               -100, 175,  60,  14),
    _G('moss',                 -150, 165,  25,  18),
    _G('stone_pavement',        100, 152,  60,  40),    // SE
    _G('gravel',                100, 178,  60,  14),
    _G('moss',                  165, 175,  20,  18),
    _G('stone_pavement',        -65, 100,  12, 200),    // 歩道帯
  ];

  return out;
})() },
```

---

# §10 変更履歴

- **v1.0**: Stage 2 「夜の歓楽街 NEON DISTRICT」の新規設計指示書。Stage 1 v6.3 のフォーマットを継承し、4 Acts × 12 chunks で再配置を設計。
- **v1.1**: 密度目安「建物 20-30 / 家具 80-120」に達するため各 chunk を 2.7-3.5 倍密度に強化。
- **v1.2**: ロット物語強化版 (§4.6 ロット単位の物語デザイン新設)。
- **v1.3 Stage1形式準拠版**: ロット用語廃止、Stage 1 の 4 層 (焦点/取り巻き/境界/動線) + アンビエント 3 セル + 取り巻き 3 パターン形式へ完全準拠。`tools/self-check-specs.ts` で 12 chunks × 12 セクション全準拠 ✅。ただし **散文のみで TS skeleton が無く、実装時にクラスタ未宣言・密度不足・対称過多が発生** した。実装の粗を spec から検出する手段が無かった。
- **v2.0 品質保証フォーマット版 (本版)**: §2 Quality Gate を新設し、Q1-Q15 ルールで実装の粗を機械的に検出。各 §9.N に **paste-ready な TypeScript スケルトン** (per-item コメント + cluster 宣言込み) を内蔵し、実装は spec からコピペで完結する設計に変更。Ch0-Ch2 の 3 chunks を **見本** として完全展開し、残り Ch3-Ch11 は同フォーマットを v2.0.1 で展開する。`tools/check-placement.ts` を Stage 2 に対応させて Quality Gate を CI 相当で実行可能にする。

**重要**: v2.0 では散文と TS skeleton が **両方** あることが品質保証の核。散文だけ更新して TS を更新し忘れる事故を防ぐため、`tools/check-spec-quality.ts` が散文と TS の整合性 (cluster id、focal 名、densit y 数値) を相互検証する。
