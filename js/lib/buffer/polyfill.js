// Buffer polyfill for Service Worker environment
// 实现 isomorphic-git 所需的最小 Buffer API

(function(global) {
  'use strict';

  // 检查是否已经存在 Buffer 实现
  if (global.buffer && global.buffer.Buffer) {
    return;
  }

  // 创建 buffer 命名空间
  const buffer = {};

  // 简化版 Buffer 实现，只包含 isomorphic-git 所需的方法
  class Buffer extends Uint8Array {
    constructor(arg, encoding, offset) {
      if (typeof arg === 'number') {
        super(arg);
      } else if (typeof arg === 'string') {
        // 处理字符串
        const bytes = [];
        if (encoding === 'base64') {
          // 简化的 base64 解码
          const binaryString = atob(arg);
          for (let i = 0; i < binaryString.length; i++) {
            bytes.push(binaryString.charCodeAt(i));
          }
        } else {
          // 默认 utf8
          const encoder = new TextEncoder();
          const encoded = encoder.encode(arg);
          super(encoded);
          return;
        }
        super(bytes);
      } else if (arg instanceof ArrayBuffer) {
        super(arg, offset);
      } else if (arg instanceof Uint8Array) {
        super(arg);
      } else {
        super();
      }
    }

    static from(value, encodingOrOffset, length) {
      if (typeof value === 'string') {
        return new Buffer(value, encodingOrOffset);
      } else if (value instanceof ArrayBuffer) {
        return new Buffer(value, encodingOrOffset, length);
      } else if (value instanceof Uint8Array) {
        return new Buffer(value);
      }
      return new Buffer(0);
    }

    static alloc(size, fill, encoding) {
      const buf = new Buffer(size);
      if (fill !== undefined) {
        buf.fill(fill, undefined, undefined, encoding);
      }
      return buf;
    }

    static isBuffer(obj) {
      return obj instanceof Buffer;
    }

    toString(encoding) {
      if (encoding === 'base64') {
        // 简化的 base64 编码
        let binary = '';
        const len = this.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(this[i]);
        }
        return btoa(binary);
      } else {
        // 默认 utf8
        const decoder = new TextDecoder();
        return decoder.decode(this);
      }
    }

    equals(otherBuffer) {
      if (!Buffer.isBuffer(otherBuffer)) return false;
      if (this.length !== otherBuffer.length) return false;
      for (let i = 0; i < this.length; i++) {
        if (this[i] !== otherBuffer[i]) return false;
      }
      return true;
    }

    fill(val, start, end, encoding) {
      if (typeof val === 'string') {
        val = val.charCodeAt(0);
      }
      start = start || 0;
      end = end || this.length;
      for (let i = start; i < end; i++) {
        this[i] = val;
      }
      return this;
    }

    // 添加其他可能需要的方法
    write(string, offset, length, encoding) {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(string);
      const len = Math.min(bytes.length, length !== undefined ? length : this.length - offset);
      for (let i = 0; i < len; i++) {
        this[offset + i] = bytes[i];
      }
      return len;
    }
  }

  // 添加 concat 方法
  Buffer.concat = function(list, length) {
    if (list.length === 0) return new Buffer(0);
    if (list.length === 1) return list[0];

    let totalLength = 0;
    for (let i = 0; i < list.length; i++) {
      totalLength += list[i].length;
    }

    const result = new Buffer(totalLength);
    let offset = 0;
    for (let i = 0; i < list.length; i++) {
      result.set(list[i], offset);
      offset += list[i].length;
    }
    return result;
  };

  // 导出到全局作用域
  buffer.Buffer = Buffer;
  buffer.from = Buffer.from;
  buffer.alloc = Buffer.alloc;
  buffer.isBuffer = Buffer.isBuffer;
  buffer.concat = Buffer.concat;

  // 在全局作用域中设置
  global.buffer = buffer;
  global.Buffer = Buffer;

})(self);