import os
import urllib.request
import numpy as np

# Try importing onnxruntime. Falls back gracefully to classical DSP if unavailable.
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ort = None
    ONNX_AVAILABLE = False

# Public pretrained ONNX model weight URLs
DTLN_URL     = "https://github.com/breizhn/DTLN/raw/master/pretrained_model/model_1.onnx"
RNNOISE_URL  = "https://github.com/shome-r/rnnoise-onnx/raw/main/rnnoise.onnx"

# ── DTLN constants (confirmed by model inspection) ────────────────────────────
# Input  0:  input_2          [1, 1, 257]    – FFT magnitude spectrum (257 bins)
# Input  1:  input_3          [1, 2, 128, 2] – LSTM hidden + cell state
# Output 0:  activation_2     [1, 1, 257]    – suppression mask (0–1 per bin)
# Output 1:  tf_op_layer_stack_2 [1, 2, 128, 2] – updated LSTM state
DTLN_FFT_SIZE   = 512   # 512-pt FFT → 257 unique frequency bins
DTLN_HOP_SIZE   = 256   # 50 % overlap
DTLN_FRAME_SIZE = 512   # analysis / synthesis window length


class ONNXSuppressionService:
    """
    Wraps DTLN and RNNoise ONNX models behind a unified process_chunk() API.

    Architecture
    ────────────
    DTLN  → frequency-domain: overlap-add STFT processing
              frame: 512 samples, hop: 256 samples, Hann window
              model predicts a multiplicative magnitude mask per FFT bin

    RNNoise → time-domain GRU: adaptive frame size probed from model metadata
              model predicts a per-sample gain mask (or cleaned audio directly)

    Fallback
    ────────
    If onnxruntime is not installed, or the model cannot be loaded / downloaded,
    process_chunk() returns the original audio unchanged so the classical
    noisereduce pipeline can take over.
    """

    def __init__(self):
        self.models_dir = "models/onnx"
        os.makedirs(self.models_dir, exist_ok=True)

        self.dtln_path    = os.path.join(self.models_dir, "dtln.onnx")
        self.rnnoise_path = os.path.join(self.models_dir, "rnnoise.onnx")

        # Loaded ONNX InferenceSession cache
        self._sessions: dict = {}

        # ── DTLN stateful buffers ──────────────────────────────────────────────
        self._dtln_lstm_state = None   # np [1, 2, 128, 2]  LSTM h/c
        self._dtln_in_buf     = None   # np [DTLN_FRAME_SIZE] – leftover input samples
        self._dtln_ola_buf    = None   # np [DTLN_FRAME_SIZE] – overlap-add accumulator

        # ── RNNoise stateful buffers ───────────────────────────────────────────
        self._rnn_gru_state   = None   # dict name → np array
        self._rnn_in_buf      = None   # np leftover input samples

    # ── Utility ───────────────────────────────────────────────────────────────

    def _download_file(self, url: str, dest: str) -> bool:
        try:
            print(f"[ONNX] Downloading model from {url} …")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp, open(dest, "wb") as f:
                f.write(resp.read())
            print(f"[ONNX] Saved to {dest}  ({os.path.getsize(dest)//1024} KB)")
            return True
        except Exception as exc:
            print(f"[ONNX] Download failed: {exc}")
            return False

    def _get_session(self, model_name: str):
        """Return a cached InferenceSession, loading / downloading the model as needed."""
        if not ONNX_AVAILABLE:
            return None

        if model_name in self._sessions:
            return self._sessions[model_name]

        path_map = {"dtln": (self.dtln_path, DTLN_URL),
                    "rnnoise": (self.rnnoise_path, RNNOISE_URL)}
        if model_name not in path_map:
            return None

        path, url = path_map[model_name]
        if not os.path.exists(path):
            if not self._download_file(url, path):
                return None

        try:
            sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
            self._sessions[model_name] = sess
            ins  = [(i.name, i.shape) for i in sess.get_inputs()]
            outs = [(o.name, o.shape) for o in sess.get_outputs()]
            print(f"[ONNX] '{model_name}' loaded — inputs: {ins}  outputs: {outs}")
            return sess
        except Exception as exc:
            print(f"[ONNX] Failed to load '{model_name}': {exc}")
            return None

    def reset_states(self, model_name: str):
        """
        Reset all stateful buffers for a model.
        Call at the START of every new file upload or live-mic session so
        LSTM/GRU hidden states and overlap-add buffers do not bleed across requests.
        """
        if model_name == "dtln":
            self._dtln_lstm_state = None
            self._dtln_in_buf     = None
            self._dtln_ola_buf    = None
        elif model_name == "rnnoise":
            self._rnn_gru_state = None
            self._rnn_in_buf    = None

    # ── DTLN  (frequency-domain, overlap-add) ─────────────────────────────────

    def _process_dtln(self, audio: np.ndarray, sess) -> np.ndarray:
        """
        Correct DTLN inference pipeline:
          1. Accumulate incoming samples in an input buffer.
          2. For each full 512-sample frame (stride 256):
               a. Apply Hann window.
               b. 512-pt rfft → 257-bin magnitude + phase.
               c. Run ONNX: mag [1,1,257] → mask [1,1,257], update LSTM state.
               d. mask * mag * exp(j*phase) → irfft → windowed output frame.
               e. Overlap-add into OLA accumulator.
          3. Return the portion of the OLA buffer that corresponds to input length.
        """
        # ── Initialise on first call ──────────────────────────────────────────
        if self._dtln_lstm_state is None:
            self._dtln_lstm_state = np.zeros((1, 2, 128, 2), dtype=np.float32)
        if self._dtln_in_buf is None:
            self._dtln_in_buf = np.zeros(DTLN_FRAME_SIZE, dtype=np.float32)
        if self._dtln_ola_buf is None:
            self._dtln_ola_buf = np.zeros(DTLN_FRAME_SIZE, dtype=np.float32)

        win       = np.hanning(DTLN_FRAME_SIZE).astype(np.float32)
        in_name   = sess.get_inputs()[0].name   # "input_2"
        st_name   = sess.get_inputs()[1].name   # "input_3"
        out_name  = sess.get_outputs()[0].name  # "activation_2"
        st_out    = sess.get_outputs()[1].name  # "tf_op_layer_stack_2"

        # Prepend leftover from previous call
        combined  = np.concatenate([self._dtln_in_buf, audio.astype(np.float32)])
        n_in      = len(audio)
        # Allocate output buffer (same length as input)
        out_full  = np.zeros(len(combined), dtype=np.float32)
        # Copy OLA tail from previous call
        out_full[:DTLN_FRAME_SIZE] += self._dtln_ola_buf

        frame_start = 0
        while frame_start + DTLN_FRAME_SIZE <= len(combined):
            frame    = combined[frame_start : frame_start + DTLN_FRAME_SIZE] * win

            # FFT
            spec     = np.fft.rfft(frame, n=DTLN_FFT_SIZE)            # complex [257]
            mag      = np.abs(spec).astype(np.float32)                 # float  [257]
            phase    = np.angle(spec)

            # ONNX inference
            ort_out  = sess.run(
                [out_name, st_out],
                {in_name: mag.reshape(1, 1, 257),
                 st_name: self._dtln_lstm_state}
            )
            mask                  = np.clip(ort_out[0].reshape(257), 0.0, 1.0)
            self._dtln_lstm_state = ort_out[1]

            # Reconstruct & IFFT
            out_spec  = (mask * mag) * np.exp(1j * phase)
            out_frame = np.fft.irfft(out_spec, n=DTLN_FRAME_SIZE).astype(np.float32)
            out_frame *= win

            # Overlap-add (factor ×2 compensates Hann² energy at 50% overlap)
            out_full[frame_start : frame_start + DTLN_FRAME_SIZE] += out_frame * 2.0
            frame_start += DTLN_HOP_SIZE

        # Save leftover input samples and OLA tail for the next call
        self._dtln_in_buf = combined[frame_start:].copy() \
            if frame_start < len(combined) \
            else np.zeros(DTLN_FRAME_SIZE, dtype=np.float32)

        ola_tail_start = len(combined) - DTLN_FRAME_SIZE
        if ola_tail_start >= 0:
            self._dtln_ola_buf = out_full[ola_tail_start:].copy()
        else:
            self._dtln_ola_buf = np.zeros(DTLN_FRAME_SIZE, dtype=np.float32)

        # Return only the samples corresponding to the new input
        result = out_full[DTLN_FRAME_SIZE : DTLN_FRAME_SIZE + n_in]
        # Pad/trim to exact input length
        if len(result) < n_in:
            result = np.pad(result, (0, n_in - len(result)))

        return np.clip(result, -1.0, 1.0)

    # ── RNNoise  (time-domain GRU, adaptive frame size) ───────────────────────

    def _process_rnnoise(self, audio: np.ndarray, sess) -> np.ndarray:
        """
        Adaptive RNNoise inference:
          - Frame size is probed from the first input's shape at runtime.
          - GRU hidden states are carried across chunks.
        """
        inputs_meta = sess.get_inputs()

        # Probe frame size from the largest dimension of input[0]
        first_shape = inputs_meta[0].shape
        block_size  = max((d for d in first_shape if isinstance(d, int) and d > 1),
                          default=480)

        # Initialise GRU states on first call
        if self._rnn_gru_state is None:
            self._rnn_gru_state = {}
            for inp in inputs_meta[1:]:
                shape = [1 if (d is None or not isinstance(d, int) or d < 1) else d
                         for d in inp.shape]
                self._rnn_gru_state[inp.name] = np.zeros(shape, dtype=np.float32)

        if self._rnn_in_buf is None:
            self._rnn_in_buf = np.array([], dtype=np.float32)

        combined  = np.concatenate([self._rnn_in_buf, audio.astype(np.float32)])
        out_blocks = []
        i = 0

        while i + block_size <= len(combined):
            block = combined[i : i + block_size].reshape(1, block_size)

            ort_inputs  = {inputs_meta[0].name: block}
            ort_inputs.update(self._rnn_gru_state)
            ort_out     = sess.run(None, ort_inputs)

            out_blocks.append(ort_out[0].flatten())

            # Update GRU states
            state_names = list(self._rnn_gru_state.keys())
            for j, name in enumerate(state_names):
                if j + 1 < len(ort_out):
                    self._rnn_gru_state[name] = ort_out[j + 1]

            i += block_size

        # Save leftover samples
        self._rnn_in_buf = combined[i:].copy() if i < len(combined) \
            else np.array([], dtype=np.float32)

        if not out_blocks:
            return audio

        result = np.concatenate(out_blocks)
        # Trim / pad to input length
        n = len(audio)
        if len(result) >= n:
            return np.clip(result[:n], -1.0, 1.0)
        return np.clip(np.pad(result, (0, n - len(result))), -1.0, 1.0)

    # ── Public API ─────────────────────────────────────────────────────────────

    def process_chunk(self, audio_chunk: np.ndarray, model_name: str) -> np.ndarray:
        """
        Run ONNX noise suppression on audio_chunk.

        Parameters
        ----------
        audio_chunk : np.ndarray  float32, 1-D, 16 kHz mono
        model_name  : str         "dtln" | "rnnoise"

        Returns
        -------
        np.ndarray  Suppressed audio (same shape & dtype).
                    Returns original chunk unchanged on any failure.
        """
        if not ONNX_AVAILABLE or model_name not in ("dtln", "rnnoise"):
            return audio_chunk

        sess = self._get_session(model_name)
        if sess is None:
            return audio_chunk

        try:
            if model_name == "dtln":
                return self._process_dtln(audio_chunk, sess)
            elif model_name == "rnnoise":
                return self._process_rnnoise(audio_chunk, sess)
        except Exception as exc:
            print(f"[ONNX] Inference error [{model_name}]: {exc}")

        return audio_chunk
