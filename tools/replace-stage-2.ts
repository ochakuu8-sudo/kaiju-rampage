/**
 * tools/replace-stage-2.ts
 *
 * 現行 Stage 2 (line 3229-4325 の STAGE_2_TEMPLATES、10 chunks 旧形式)
 * を /tmp/stage2_new.txt の内容 (12 chunks v1.0 設計指示書準拠) で置換する。
 */
import * as fs from 'fs';

const STAGES_PATH = '/home/user/kaiju-rampage/src/stages.ts';
const NEW_CONTENT_PATH = '/tmp/stage2_new.txt';

const src = fs.readFileSync(STAGES_PATH, 'utf8');
const newContent = fs.readFileSync(NEW_CONTENT_PATH, 'utf8');

// 範囲: 'const STAGE_2_TEMPLATES: ChunkTemplate[] = [' から、その配列の閉じ ']' まで
const startMarker = 'const STAGE_2_TEMPLATES: ChunkTemplate[] = [';
const startIdx = src.indexOf(startMarker);
if (startIdx < 0) throw new Error('STAGE_2_TEMPLATES not found');

// 配列の閉じを探す: 直後の '\n];' (Stage 3 開始の `\n\n// ─── Stage 3` の手前)
const endMarker = '\n];\n\n// ─── Stage 3:';
const endIdx = src.indexOf(endMarker, startIdx);
if (endIdx < 0) throw new Error('Stage 2 end not found');

// 置換
const before = src.slice(0, startIdx);
const after = src.slice(endIdx + 3);  // 'n];' の 3 文字後 (改行 + ; + 改行)
// newContent は冒頭コメント + `const STAGE_2_TEMPLATES = [...`+`];` を含む
const result = before + newContent + '\n' + after;

fs.writeFileSync(STAGES_PATH, result);
console.log(`Stage 2 を置換しました (${(endIdx + 3 - startIdx)} 文字 → ${newContent.length} 文字)`);
