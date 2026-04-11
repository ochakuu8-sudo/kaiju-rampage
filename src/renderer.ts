import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './constants';

// ========== Matrix Utilities ==========
export function ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array {
  const mat = new Float32Array(16);
  const rl = 1 / (right - left);
  const tb = 1 / (top - bottom);
  const fn = 1 / (far - near);

  mat[0] = 2 * rl;
  mat[5] = 2 * tb;
  mat[10] = -2 * fn;
  mat[12] = -(right + left) * rl;
  mat[13] = -(top + bottom) * tb;
  mat[14] = -(far + near) * fn;
  mat[15] = 1;

  return mat;
}

export function translate(mat: Float32Array, x: number, y: number, z: number = 0): Float32Array {
  const result = new Float32Array(mat);
  result[12] += x;
  result[13] += y;
  result[14] += z;
  return result;
}

// ========== Shader Compilation ==========
function compileShader(gl: WebGL2RenderingContext, source: string, type: GLenum): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${log}`);
  }

  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking failed: ${log}`);
  }

  return program;
}

// ========== Shader Sources ==========
const QUAD_INSTANCED_VS = `#version 300 es
precision highp float;

// Per-vertex (quad corners)
in vec2 position;

// Per-instance
in vec2 i_position;
in vec2 i_size;
in vec4 i_color;
in float i_rotation;

// Uniforms
uniform mat4 u_projection;
uniform vec2 u_shake_offset;

// Output
out vec4 v_color;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 pos = position * i_size;
  pos = rotate2d(i_rotation) * pos;
  pos += i_position + u_shake_offset;

  gl_Position = u_projection * vec4(pos, 0.0, 1.0);
  v_color = i_color;
}`;

const QUAD_INSTANCED_FS = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 outColor;

void main() {
  outColor = v_color;
}`;

const CIRCLE_INSTANCED_VS = `#version 300 es
precision highp float;

in vec2 position;
in vec2 i_position;
in float i_radius;
in vec4 i_color;

uniform mat4 u_projection;
uniform vec2 u_shake_offset;

out vec4 v_color;
out vec2 v_uv;

void main() {
  vec2 pos = position * i_radius;
  pos += i_position + u_shake_offset;

  gl_Position = u_projection * vec4(pos, 0.0, 1.0);
  v_color = i_color;
  v_uv = position;
}`;

const CIRCLE_INSTANCED_FS = `#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_uv;
out vec4 outColor;

void main() {
  float dist = length(v_uv);
  if (dist > 1.0) discard;
  outColor = v_color;
}`;

const FULLSCREEN_QUAD_VS = `#version 300 es
in vec2 position;
out vec2 v_uv;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
  v_uv = position * 0.5 + 0.5;
}`;

const FULLSCREEN_QUAD_FS = `#version 300 es
precision highp float;

uniform vec4 u_color;
out vec4 outColor;

void main() {
  outColor = u_color;
}`;

// ========== Renderer Class ==========
export class Renderer {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;

  // Programs
  quadProgram!: WebGLProgram;
  circleProgram!: WebGLProgram;
  fullscreenProgram!: WebGLProgram;

  // VAOs
  quadVAO!: WebGLVertexArrayObject;
  circleVAO!: WebGLVertexArrayObject;
  fullscreenVAO!: WebGLVertexArrayObject;

  // Uniforms
  quadProjectionLoc!: WebGLUniformLocation;
  circleProjectionLoc!: WebGLUniformLocation;
  fullscreenColorLoc!: WebGLUniformLocation;

  // Shake offset
  shakeOffset = new Float32Array([0, 0]);
  shakeRotation = 0;

  // Projection matrix
  projectionMatrix: Float32Array;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 not supported');

    this.canvas = canvas;
    this.gl = gl;

    // Setup projection: origin at center, Y+ up
    this.projectionMatrix = ortho(-LOGICAL_WIDTH / 2, LOGICAL_WIDTH / 2, -LOGICAL_HEIGHT / 2, LOGICAL_HEIGHT / 2, -1, 1);

    this.initPrograms();
    this.initGeometry();
    this.initUniforms();

    gl.clearColor(0.05, 0.05, 0.08, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private initPrograms() {
    const { gl } = this;

    // Quad program
    const quadVS = compileShader(gl, QUAD_INSTANCED_VS, gl.VERTEX_SHADER);
    const quadFS = compileShader(gl, QUAD_INSTANCED_FS, gl.FRAGMENT_SHADER);
    this.quadProgram = linkProgram(gl, quadVS, quadFS);
    gl.deleteShader(quadVS);
    gl.deleteShader(quadFS);

    // Circle program
    const circleVS = compileShader(gl, CIRCLE_INSTANCED_VS, gl.VERTEX_SHADER);
    const circleFS = compileShader(gl, CIRCLE_INSTANCED_FS, gl.FRAGMENT_SHADER);
    this.circleProgram = linkProgram(gl, circleVS, circleFS);
    gl.deleteShader(circleVS);
    gl.deleteShader(circleFS);

    // Fullscreen program
    const fsVS = compileShader(gl, FULLSCREEN_QUAD_VS, gl.VERTEX_SHADER);
    const fsFS = compileShader(gl, FULLSCREEN_QUAD_FS, gl.FRAGMENT_SHADER);
    this.fullscreenProgram = linkProgram(gl, fsVS, fsFS);
    gl.deleteShader(fsVS);
    gl.deleteShader(fsFS);
  }

  private initGeometry() {
    const { gl } = this;

    // ===== Quad VAO =====
    this.quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVAO);

    const quadVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5,
       0.5, -0.5,
       0.5,  0.5,
      -0.5,  0.5,
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.quadProgram, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 8, 0);

    // ===== Circle VAO =====
    this.circleVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.circleVAO);

    const circleVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, circleVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
       1,  1,
      -1,  1,
    ]), gl.STATIC_DRAW);

    const circlePosLoc = gl.getAttribLocation(this.circleProgram, 'position');
    gl.enableVertexAttribArray(circlePosLoc);
    gl.vertexAttribPointer(circlePosLoc, 2, gl.FLOAT, false, 8, 0);

    // ===== Fullscreen Quad VAO =====
    this.fullscreenVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.fullscreenVAO);

    const fsVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, fsVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
       1,  1,
      -1,  1,
    ]), gl.STATIC_DRAW);

    const fsPosLoc = gl.getAttribLocation(this.fullscreenProgram, 'position');
    gl.enableVertexAttribArray(fsPosLoc);
    gl.vertexAttribPointer(fsPosLoc, 2, gl.FLOAT, false, 8, 0);

    gl.bindVertexArray(null);
  }

  private initUniforms() {
    const { gl } = this;

    this.quadProjectionLoc = gl.getUniformLocation(this.quadProgram, 'u_projection')!;
    this.circleProjectionLoc = gl.getUniformLocation(this.circleProgram, 'u_projection')!;
    this.fullscreenColorLoc = gl.getUniformLocation(this.fullscreenProgram, 'u_color')!;
  }

  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  setShakeOffset(x: number, y: number) {
    this.shakeOffset[0] = x;
    this.shakeOffset[1] = y;
  }

  getShakeOffset(): [number, number] {
    return [this.shakeOffset[0], this.shakeOffset[1]];
  }

  // Draw instanced quads
  drawQuads(
    positions: Float32Array, sizes: Float32Array, colors: Float32Array, rotations: Float32Array, count: number
  ) {
    const { gl } = this;

    gl.useProgram(this.quadProgram);
    gl.bindVertexArray(this.quadVAO);

    // Position attribute
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions.slice(0, count * 2), gl.DYNAMIC_DRAW);
    const posLoc = gl.getAttribLocation(this.quadProgram, 'i_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(posLoc, 1);

    // Size attribute
    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes.slice(0, count * 2), gl.DYNAMIC_DRAW);
    const sizeLoc = gl.getAttribLocation(this.quadProgram, 'i_size');
    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(sizeLoc, 1);

    // Color attribute
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors.slice(0, count * 4), gl.DYNAMIC_DRAW);
    const colorLoc = gl.getAttribLocation(this.quadProgram, 'i_color');
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(colorLoc, 1);

    // Rotation attribute
    const rotBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, rotBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, rotations.slice(0, count), gl.DYNAMIC_DRAW);
    const rotLoc = gl.getAttribLocation(this.quadProgram, 'i_rotation');
    gl.enableVertexAttribArray(rotLoc);
    gl.vertexAttribPointer(rotLoc, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(rotLoc, 1);

    gl.uniformMatrix4fv(this.quadProjectionLoc, false, this.projectionMatrix);
    gl.uniform2fv(gl.getUniformLocation(this.quadProgram, 'u_shake_offset'), this.shakeOffset);

    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count);

    // Cleanup
    gl.deleteBuffer(posBuffer);
    gl.deleteBuffer(sizeBuffer);
    gl.deleteBuffer(colorBuffer);
    gl.deleteBuffer(rotBuffer);
    gl.bindVertexArray(null);
  }

  // Draw instanced circles
  drawCircles(
    positions: Float32Array, radii: Float32Array, colors: Float32Array, count: number
  ) {
    const { gl } = this;

    gl.useProgram(this.circleProgram);
    gl.bindVertexArray(this.circleVAO);

    // Position attribute
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions.slice(0, count * 2), gl.DYNAMIC_DRAW);
    const posLoc = gl.getAttribLocation(this.circleProgram, 'i_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(posLoc, 1);

    // Radius attribute
    const radiusBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, radii.slice(0, count), gl.DYNAMIC_DRAW);
    const radiusLoc = gl.getAttribLocation(this.circleProgram, 'i_radius');
    gl.enableVertexAttribArray(radiusLoc);
    gl.vertexAttribPointer(radiusLoc, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(radiusLoc, 1);

    // Color attribute
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors.slice(0, count * 4), gl.DYNAMIC_DRAW);
    const colorLoc = gl.getAttribLocation(this.circleProgram, 'i_color');
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(colorLoc, 1);

    gl.uniformMatrix4fv(this.circleProjectionLoc, false, this.projectionMatrix);
    gl.uniform2fv(gl.getUniformLocation(this.circleProgram, 'u_shake_offset'), this.shakeOffset);

    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count);

    // Cleanup
    gl.deleteBuffer(posBuffer);
    gl.deleteBuffer(radiusBuffer);
    gl.deleteBuffer(colorBuffer);
    gl.bindVertexArray(null);
  }

  // Draw fullscreen overlay
  drawFullscreenOverlay(r: number, g: number, b: number, a: number) {
    const { gl } = this;

    gl.useProgram(this.fullscreenProgram);
    gl.bindVertexArray(this.fullscreenVAO);

    gl.uniformMatrix4fv(gl.getUniformLocation(this.fullscreenProgram, 'u_projection'), false, new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]));
    gl.uniform4f(this.fullscreenColorLoc, r, g, b, a);

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  }
}
