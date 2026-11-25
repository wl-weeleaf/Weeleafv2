class LeafyScribePcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 4096;
    this.buffer = new Float32Array(this.chunkSize);
    this.offset = 0;
  }

  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0);
    const input = inputs[0]?.[0];
    if (input) {
      let sourceOffset = 0;
      while (sourceOffset < input.length) {
        const count = Math.min(this.chunkSize - this.offset, input.length - sourceOffset);
        this.buffer.set(input.subarray(sourceOffset, sourceOffset + count), this.offset);
        sourceOffset += count;
        this.offset += count;
        if (this.offset === this.chunkSize) {
          const chunk = this.buffer;
          this.buffer = new Float32Array(this.chunkSize);
          this.offset = 0;
          this.port.postMessage(chunk.buffer, [chunk.buffer]);
        }
      }
    }
    return true;
  }
}

registerProcessor('leafy-scribe-pcm', LeafyScribePcmProcessor);
