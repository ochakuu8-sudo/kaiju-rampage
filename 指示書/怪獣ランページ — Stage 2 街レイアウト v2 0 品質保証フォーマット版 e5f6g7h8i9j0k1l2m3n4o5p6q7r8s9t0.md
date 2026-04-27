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

# §10 変更履歴

- **v1.0**: Stage 2 「夜の歓楽街 NEON DISTRICT」の新規設計指示書。Stage 1 v6.3 のフォーマットを継承し、4 Acts × 12 chunks で再配置を設計。
- **v1.1**: 密度目安「建物 20-30 / 家具 80-120」に達するため各 chunk を 2.7-3.5 倍密度に強化。
- **v1.2**: ロット物語強化版 (§4.6 ロット単位の物語デザイン新設)。
- **v1.3 Stage1形式準拠版**: ロット用語廃止、Stage 1 の 4 層 (焦点/取り巻き/境界/動線) + アンビエント 3 セル + 取り巻き 3 パターン形式へ完全準拠。`tools/self-check-specs.ts` で 12 chunks × 12 セクション全準拠 ✅。ただし **散文のみで TS skeleton が無く、実装時にクラスタ未宣言・密度不足・対称過多が発生** した。実装の粗を spec から検出する手段が無かった。
- **v2.0 品質保証フォーマット版 (本版)**: §2 Quality Gate を新設し、Q1-Q15 ルールで実装の粗を機械的に検出。各 §9.N に **paste-ready な TypeScript スケルトン** (per-item コメント + cluster 宣言込み) を内蔵し、実装は spec からコピペで完結する設計に変更。Ch0-Ch2 の 3 chunks を **見本** として完全展開し、残り Ch3-Ch11 は同フォーマットを v2.0.1 で展開する。`tools/check-placement.ts` を Stage 2 に対応させて Quality Gate を CI 相当で実行可能にする。

**重要**: v2.0 では散文と TS skeleton が **両方** あることが品質保証の核。散文だけ更新して TS を更新し忘れる事故を防ぐため、`tools/check-spec-quality.ts` が散文と TS の整合性 (cluster id、focal 名、densit y 数値) を相互検証する。
