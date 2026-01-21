/**
 * AudioWorkletProcessor for capturing audio data
 * Replaces the deprecated ScriptProcessorNode
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._isRecording = true;
  }

  /**
   * Process audio data
   * @param {Float32Array[][]} inputs - Input audio channels
   * @returns {boolean} - Return true to keep processor alive
   */
  process(inputs) {
    if (!this._isRecording) {
      return false;
    }

    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData && channelData.length > 0) {
        // Clone the data and send to main thread
        const audioData = new Float32Array(channelData);
        this.port.postMessage({
          type: 'audio',
          data: audioData,
        });
      }
    }

    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
