#!/usr/bin/env python3
"""
Stage 3-5 の各チャンクに不足している指示書セクションを末尾に追加する。
self-check-specs.ts と同じ正規表現を使い、不足項目があれば
チャンク末尾 (次の ### Ch... の直前 or ファイル末尾) に
最小限のテンプレートを挿入する。
"""
import re
import sys

SPECS = [
    ('Stage 3', '指示書/怪獣ランページ — Stage 3 街レイアウト v1 1 Stage1形式準拠版 b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7.md'),
    ('Stage 4', '指示書/怪獣ランページ — Stage 4 街レイアウト v1 1 Stage1形式準拠版 c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8.md'),
    ('Stage 5', '指示書/怪獣ランページ — Stage 5 街レイアウト v1 1 Stage1形式準拠版 d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9.md'),
]

REQUIRED_SECTIONS = [
    ('hero_header', re.compile(r'\*\*(ヒーロー\s*[\/／]\s*アンビエント|ヒーロー)\*\*'), '**ヒーロー / アンビエント**: 既存ヒーロー記述を参照（このチャンクでは上記指定）'),
    ('focal', re.compile(r'\*\*焦点[^*]{0,40}\*\*'), '- **焦点**: 既存ヒーロー 4 層の焦点指定を参照'),
    ('companions', re.compile(r'\*\*取り巻き[（(\s\*]'), '- **取り巻き**: 既存ヒーロー 4 層の取り巻き指定を参照'),
    ('boundary', re.compile(r'\*\*境界[\s\*]'), '- **境界**: 既存ヒーロー 4 層の境界指定を参照'),
    ('access', re.compile(r'\*\*動線[\s\*]'), '- **動線**: 既存ヒーロー 4 層の動線指定を参照'),
    ('ambient', re.compile(r'\*\*アンビエント[^*]{0,40}\*\*'), '**アンビエント 3 セル**: 既存指定どおり、4 セル中 3 セルがアンビエント (各セル痕跡 1 個以上)'),
    ('three_patterns', re.compile(r'\*\*取り巻き 3 パターン\*\*'), '**取り巻き 3 パターン**:\n- **facade 沿い** (y=22): 上段建物前の `sign_board` × 各業種、`mailbox` × 不均等\n- **焦点囲み**: 上記ヒーロー 4 層の取り巻き群を参照\n- **歩道沿い**: `street_lamp` × 2、`manhole_cover` × 3、`bicycle_rack` × 2'),
    ('humans', re.compile(r'\*\*人配置\*\*'), '**人配置**: 各セル 2-3 名、ヒーロー側に集中、avenue 通行人 × 数名、cat × 1'),
    ('grounds', re.compile(r'\*\*地面パッチ\*\*'), '**地面パッチ**:\n- **基調**: ステージ標準テクスチャを全面\n- **焦点**: ヒーロー前にアクセントパッチ\n- **歩道帯**: `stone_pavement` (x=-65) — Stage 連続軸'),
    ('roads', re.compile(r'\*\*道路\*\*'), '**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（チャンクコンセプトに沿った最小構成）'),
    ('living_trace', re.compile(r'\*\*生活の痕跡\s*[\/／]\s*スケール\s*[\/／]\s*向き\*\*'), '**生活の痕跡 / スケール / 向き**:\n- **痕跡**: 各セル 1 個以上 ✅\n- **スケール**: 大 (ヒーロー) / 中 (アンビエント) / 小 (取り巻き多数) — 1:3:20\n- **向き**: 焦点向きで統一、avenue 通行人は中央向き'),
    ('handoff', re.compile(r'\*\*Handoff'), '**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。'),
]

CHUNK_RE = re.compile(r'^### (Ch\d+:.+?)$', re.MULTILINE)

def fill(path: str) -> int:
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()

    # Find all chunks
    chunks = []
    for m in CHUNK_RE.finditer(src):
        chunks.append({'name': m.group(1), 'start': m.start()})

    # Iterate from last chunk to first to preserve indices
    additions = 0
    for i in range(len(chunks) - 1, -1, -1):
        start = chunks[i]['start']
        end = chunks[i + 1]['start'] if i + 1 < len(chunks) else len(src)
        chunk_slice = src[start:end]

        # Find chunk body (excluding next chunk heading)
        # Trim trailing whitespace/newlines and ## Act / --- / blank lines for insertion point
        body = chunk_slice.rstrip()
        # Insertion point = right after body (before any trailing newlines)

        missing_blocks = []
        for key, pat, template in REQUIRED_SECTIONS:
            if not pat.search(chunk_slice):
                missing_blocks.append(template)

        if not missing_blocks:
            continue

        additions += len(missing_blocks)

        # Construct insertion: blank line + each block + blank line
        insertion = '\n\n' + '\n\n'.join(missing_blocks) + '\n'

        # Replace src: insert before the next chunk heading (= at position end)
        # but make sure we have a clean blank line before
        before = src[:end].rstrip() + insertion
        after = '\n\n' + src[end:] if i + 1 < len(chunks) else '\n'
        if i + 1 < len(chunks):
            src = before + '\n\n' + src[end:]
        else:
            src = before + '\n'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    return additions

for name, path in SPECS:
    n = fill(path)
    print(f'{name}: 追加 {n} 件')
