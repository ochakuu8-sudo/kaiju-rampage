/**
 * renderer.ts — WebGL2 描画エンジン
 * インスタンシングで全エンティティを 10 draw call 以下に収める
 */

import { CANVAS_WIDTH, CANVAS_HEIGHT, WORLD_MIN_Y, WORLD_MAX_Y } from './constants';

// ===== シェーダーソース =====

const VS_INST = `#version 300 es
precision highp float;
in vec2  a_vert;
// per-instance
in vec2  i_pos;
in vec2  i_size;
in vec4  i_color;
in float i_rot;
in float i_circle;

uniform mat4 u_proj;
uniform vec2 u_shake;

out vec4  v_color;
out vec2  v_uv;
out vec2  v_size;
out float v_circle;

void main() {
  float c = cos(i_rot), s = sin(i_rot);
  vec2 scaled  = a_vert * i_size;
  vec2 rotated = vec2(c*scaled.x - s*scaled.y, s*scaled.x + c*scaled.y);
  vec2 world   = rotated + i_pos + u_shake;
  gl_Position  = u_proj * vec4(world, 0.0, 1.0);
  v_color  = i_color;
  v_uv     = a_vert;       // -0.5..0.5
  v_size   = i_size;       // pixel size of the quad
  v_circle = i_circle;
}`;

const FS_INST = `#version 300 es
precision highp float;
in vec4  v_color;
in vec2  v_uv;
in vec2  v_size;
in float v_circle;
out vec4 fragColor;

void main() {
  if (v_circle > 0.5) {
    // 円描画
    float d = length(v_uv) * 2.0;
    if (d > 1.0) discard;
    float glow = 1.0 - smoothstep(0.6, 1.0, d);
    fragColor = vec4(v_color.rgb + glow * 0.4, v_color.a);
  } else {
    // プレーン矩形 — 建物のディテールはすべて TS 側でハードコード描画する
    fragColor = v_color;
  }
}`;

const VS_FS = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FS_FS = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 fragColor;
void main() { fragColor = u_color; }`;

const VS_BG = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); v_uv = a_pos * 0.5 + 0.5; }`;

const FS_BG = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform vec3 u_top;
uniform vec3 u_bot;
out vec4 fragColor;
void main() { fragColor = vec4(mix(u_bot, u_top, v_uv.y), 1.0); }`;

// ===== ユーティリティ =====

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
    throw new Error(`Shader compile: ${gl.getShaderInfoLog(sh)}\n${src}`);
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error('Link: ' + gl.getProgramInfoLog(p));
  return p;
}

// per-instance layout (floats): pos(2) size(2) color(4) rot(1) circle(1) = 10
export const INST_F = 10;
const MAX_INST = 20000; // 5000 humans×2 + 2000 particles + 8000 scene/vehicles/misc

export class Renderer {
  readonly gl: WebGL2RenderingContext;

  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private instVBO: WebGLBuffer;
  private u_proj: WebGLUniformLocation;
  private u_shake: WebGLUniformLocation;

  private fsProg: WebGLProgram;
  private fsVAO: WebGLVertexArrayObject;
  private u_fsColor: WebGLUniformLocation;

  private bgProg: WebGLProgram;
  private u_bgTop: WebGLUniformLocation;
  private u_bgBot: WebGLUniformLocation;

  // 共有インスタンスバッファ（呼び出し元が直接書き込む）
  readonly instBuf: Float32Array;

  private proj: Float32Array;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    // ---- instanced program ----
    this.prog = linkProgram(gl, VS_INST, FS_INST);
    this.vao  = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    // 単位クワッド
    const quad = new Float32Array([-0.5,-0.5, 0.5,-0.5, -0.5,0.5, 0.5,0.5]);
    const qVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const aVert = gl.getAttribLocation(this.prog, 'a_vert');
    gl.enableVertexAttribArray(aVert);
    gl.vertexAttribPointer(aVert, 2, gl.FLOAT, false, 0, 0);

    // instance buffer
    this.instBuf = new Float32Array(MAX_INST * INST_F);
    this.instVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.instBuf.byteLength, gl.DYNAMIC_DRAW);

    const stride = INST_F * 4;
    const ia = (name: string, sz: number, off: number) => {
      const loc = gl.getAttribLocation(this.prog, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, sz, gl.FLOAT, false, stride, off * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    ia('i_pos',    2, 0);
    ia('i_size',   2, 2);
    ia('i_color',  4, 4);
    ia('i_rot',    1, 8);
    ia('i_circle', 1, 9);

    gl.bindVertexArray(null);
    this.u_proj  = gl.getUniformLocation(this.prog,  'u_proj')!;
    this.u_shake = gl.getUniformLocation(this.prog,  'u_shake')!;

    // ---- fullscreen quad ----
    this.fsProg = linkProgram(gl, VS_FS, FS_FS);
    this.fsVAO  = gl.createVertexArray()!;
    gl.bindVertexArray(this.fsVAO);
    const fsVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, fsVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aFP = gl.getAttribLocation(this.fsProg, 'a_pos');
    gl.enableVertexAttribArray(aFP);
    gl.vertexAttribPointer(aFP, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.u_fsColor = gl.getUniformLocation(this.fsProg, 'u_color')!;

    // ---- background gradient program (shares fsVAO) ----
    this.bgProg  = linkProgram(gl, VS_BG, FS_BG);
    this.u_bgTop = gl.getUniformLocation(this.bgProg, 'u_top')!;
    this.u_bgBot = gl.getUniformLocation(this.bgProg, 'u_bot')!;

    // orthographic projection: world(-180..180, WORLD_MIN_Y..WORLD_MAX_Y) → clip
    this.proj = this.makeOrtho(-180, 180, WORLD_MIN_Y, WORLD_MAX_Y);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  private makeOrtho(l: number, r: number, b: number, t: number): Float32Array {
    // column-major
    return new Float32Array([
      2/(r-l),        0,              0,  0,
      0,              2/(t-b),        0,  0,
      0,              0,             -1,  0,
      -(r+l)/(r-l),  -(t+b)/(t-b),   0,  1,
    ]);
  }

  /** カメラY座標に合わせて投影行列を更新する（毎フレーム呼ぶ） */
  updateProjection(cameraY: number) {
    this.proj = this.makeOrtho(-180, 180, cameraY + WORLD_MIN_Y, cameraY + WORLD_MAX_Y);
  }

  clear(r = 0.06, g = 0.06, b = 0.10) {
    const gl = this.gl;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** 空グラデーション背景を描画（clearの代わりに使用） */
  drawBackground(tr = 0.03, tg = 0.03, tb = 0.12, br = 0.08, bg = 0.06, bb = 0.06) {
    const gl = this.gl;
    gl.useProgram(this.bgProg);
    gl.uniform3f(this.u_bgTop, tr, tg, tb);
    gl.uniform3f(this.u_bgBot, br, bg, bb);
    gl.bindVertexArray(this.fsVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /**
   * インスタンスを一括描画
   * @param buf     INST_F floats per instance
   * @param count   instance count
   * @param shake   screen shake offset [sx, sy]
   */
  drawInstances(buf: Float32Array, count: number, shake: [number, number] = [0, 0]) {
    if (count <= 0) return;
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u_proj, false, this.proj);
    gl.uniform2fv(this.u_shake, shake);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf, 0, count * INST_F);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
  }

  drawFlash(r: number, g: number, b: number, a: number) {
    if (a <= 0.001) return;
    const gl = this.gl;
    gl.useProgram(this.fsProg);
    gl.uniform4f(this.u_fsColor, r, g, b, a);
    gl.bindVertexArray(this.fsVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}

/** インスタンスバッファへ1インスタンス書き込む */
export function writeInst(
  buf: Float32Array, idx: number,
  px: number, py: number,
  sw: number, sh: number,
  r: number, g: number, b: number, a: number,
  rot = 0, circle = 0
) {
  const o = idx * INST_F;
  buf[o]   = px; buf[o+1] = py;
  buf[o+2] = sw; buf[o+3] = sh;
  buf[o+4] = r;  buf[o+5] = g; buf[o+6] = b; buf[o+7] = a;
  buf[o+8] = rot; buf[o+9] = circle;
}
