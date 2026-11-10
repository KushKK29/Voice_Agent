// Mic -> 16 kHz mono PCM16 chunks (100 ms) posted to the main thread.
class Pcm extends AudioWorkletProcessor {
  buf = new Int16Array(1600);
  n = 0;
  process(inputs) {
    const ch = inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = Math.max(-1, Math.min(1, ch[i])) * 0x7fff;
      if (this.n === this.buf.length) {
        this.port.postMessage(this.buf.slice().buffer);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm', Pcm);
