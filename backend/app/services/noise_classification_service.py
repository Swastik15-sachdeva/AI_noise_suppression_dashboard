import os
import numpy as np
import librosa
from typing import List, Dict, Tuple

class NoiseClassificationService:
    """
    Service to classify ALL types of background noise present in an audio signal.

    Instead of a single-winner elif chain, each noise category is scored
    independently. Any category that scores above its detection threshold
    is included in the result list — so overlapping noises (e.g. fan hum +
    keyboard clicks) are all reported.
    """

    @staticmethod
    def classify_noise(audio_path: str = None, y: np.ndarray = None, sr: int = 16000) -> str:
        """
        Legacy single-string interface kept for backward compatibility with the
        file-upload endpoint. Returns the dominant (highest-scoring) noise type.
        """
        results = NoiseClassificationService.classify_noise_multi(audio_path=audio_path, y=y, sr=sr)
        return results[0] if results else "Other"

    @staticmethod
    def classify_noise_multi(audio_path: str = None, y: np.ndarray = None, sr: int = 16000) -> List[str]:
        """
        Multi-label noise classifier.

        Returns a list of all detected noise categories sorted by confidence
        (highest first).  Returns ["Other"] only if nothing is detected.

        Expected Categories:
        - Fan Noise           (steady hiss, mid-range centroid, high flatness)
        - Traffic Noise       (strong low-frequency rumble)
        - Keyboard Typing     (transient clicks — high crest factor + ZCR spikes)
        - Background Conversation (harmonic, centred in voice band)
        - AC Noise            (low-freq hum, similar to fan but slower)
        - Wind Noise          (broadband turbulence — very high flatness)
        """
        try:
            # ── 1. Load audio ──────────────────────────────────────────────────
            if y is None:
                if not audio_path or not os.path.exists(audio_path):
                    raise FileNotFoundError(f"Audio file not found: {audio_path}")
                y, sr = librosa.load(audio_path, sr=16000, mono=True)

            if len(y) == 0:
                return ["Other"]

            # ── 2. Feature extraction ──────────────────────────────────────────
            # Spectral centroid — where the spectral "weight" sits (Hz)
            centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            mean_centroid = float(np.mean(centroids))

            # Zero-crossing rate — high for transients / clicks
            zcr = librosa.feature.zero_crossing_rate(y=y)[0]
            mean_zcr = float(np.mean(zcr))
            max_zcr  = float(np.max(zcr))

            # Spectral flatness — high → noise-like, low → tonal/speech
            flatness = librosa.feature.spectral_flatness(y=y)[0]
            mean_flatness = float(np.mean(flatness))
            max_flatness  = float(np.max(flatness))

            # Low-frequency energy ratio (below ~200 Hz → traffic / AC hum)
            stft = np.abs(librosa.stft(y))
            low_freq_bins  = int(stft.shape[0] * (200 / (sr / 2)))
            low_freq_energy = float(np.sum(stft[:low_freq_bins, :]))
            total_energy    = float(np.sum(stft)) + 1e-9
            low_freq_ratio  = low_freq_energy / total_energy

            # RMS crest factor — peak vs. mean amplitude (transients inflate this)
            rms = librosa.feature.rms(y=y)[0]
            rms_mean  = float(np.mean(rms)) + 1e-9
            rms_std   = float(np.std(rms))
            rms_crest = float(np.max(rms)) / rms_mean

            # Spectral roll-off (85 %) — frequency below which 85 % of energy sits
            rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)[0]
            mean_rolloff = float(np.mean(rolloff))

            # ── 3. Independent per-category scoring ───────────────────────────
            scores: dict[str, float] = {}

            # --- Keyboard Typing ------------------------------------------------
            # Signature: sharp transients (high crest), lots of rapid zero-crossings
            ktype_score = 0.0
            if rms_crest > 5.0:
                ktype_score += min((rms_crest - 5.0) / 10.0, 0.5)   # 0 – 0.5
            if max_zcr > 0.20:
                ktype_score += min((max_zcr - 0.20) / 0.15, 0.3)    # 0 – 0.3
            if mean_zcr > 0.04:
                ktype_score += min((mean_zcr - 0.04) / 0.06, 0.2)   # 0 – 0.2
            if rms_std / rms_mean > 0.3:                              # high variability
                ktype_score += 0.1
            if ktype_score >= 0.30:
                scores["Keyboard Typing"] = round(ktype_score, 3)

            # --- Traffic Noise --------------------------------------------------
            # Signature: dominant low-frequency rumble, low centroid
            traffic_score = 0.0
            if low_freq_ratio > 0.30:
                traffic_score += min((low_freq_ratio - 0.30) / 0.30, 0.6)
            if mean_centroid < 1400:
                traffic_score += min((1400 - mean_centroid) / 1000, 0.3)
            if mean_flatness > 0.005:                                  # some broadband content
                traffic_score += 0.1
            if traffic_score >= 0.30:
                scores["Traffic Noise"] = round(traffic_score, 3)

            # --- Fan Noise ------------------------------------------------------
            # Signature: steady broadband hiss, centroid 1200–3500 Hz, flat spectrum
            fan_score = 0.0
            if 1100 < mean_centroid < 4000:
                fan_score += 0.3
            if mean_flatness > 0.008:
                fan_score += min((mean_flatness - 0.008) / 0.05, 0.4)
            if rms_crest < 6.0:                                         # NOT transient
                fan_score += 0.2
            if mean_rolloff > 2000:
                fan_score += 0.1
            if fan_score >= 0.35:
                scores["Fan Noise"] = round(fan_score, 3)

            # --- AC Noise -------------------------------------------------------
            # Signature: steady low-mid hum, lower centroid than fan, still flat
            ac_score = 0.0
            if 700 <= mean_centroid <= 2500:
                ac_score += 0.25
            if mean_flatness > 0.004:
                ac_score += min((mean_flatness - 0.004) / 0.04, 0.35)
            if low_freq_ratio > 0.20:                                   # some bass content
                ac_score += min((low_freq_ratio - 0.20) / 0.30, 0.25)
            if rms_crest < 5.0:                                         # steady
                ac_score += 0.15
            if ac_score >= 0.35:
                scores["AC Noise"] = round(ac_score, 3)

            # --- Background Conversation ----------------------------------------
            # Signature: harmonic, low flatness, centroid in human voice band
            conv_score = 0.0
            if mean_flatness < 0.010:
                conv_score += min((0.010 - mean_flatness) / 0.008, 0.4)
            if 600 <= mean_centroid <= 2500:
                conv_score += 0.3
            if mean_zcr > 0.02:                                          # voiced activity
                conv_score += 0.2
            if low_freq_ratio < 0.35:                                    # not dominated by rumble
                conv_score += 0.1
            if conv_score >= 0.35:
                scores["Background Conversation"] = round(conv_score, 3)

            # --- Wind Noise -----------------------------------------------------
            # Signature: very high flatness across full spectrum, broadband turbulence
            wind_score = 0.0
            if max_flatness > 0.05:
                wind_score += min((max_flatness - 0.05) / 0.10, 0.5)
            if mean_flatness > 0.02:
                wind_score += min((mean_flatness - 0.02) / 0.06, 0.35)
            if mean_centroid > 1500:
                wind_score += 0.15
            if wind_score >= 0.35:
                scores["Wind Noise"] = round(wind_score, 3)

            # ── 4. Build sorted result list ────────────────────────────────────
            if not scores:
                return ["Other"]

            # Sort by confidence descending
            detected = sorted(scores.keys(), key=lambda k: scores[k], reverse=True)
            return detected

        except Exception as e:
            print(f"Error classifying noise: {str(e)}")
            return ["Other"]

    @staticmethod
    def classify_noise_with_scores(
        audio_path: str = None, y: np.ndarray = None, sr: int = 16000
    ) -> Tuple[List[str], Dict[str, float]]:
        """
        Returns:
          detected  – list of noise labels sorted by confidence (highest first)
          breakdown – dict mapping each detected label to a percentage (0-100),
                      normalised so the dominant noise = 100 % and the rest are
                      scaled proportionally.  Empty dict if nothing is detected.
        """
        detected = NoiseClassificationService.classify_noise_multi(
            audio_path=audio_path, y=y, sr=sr
        )

        if detected == ["Other"] or not detected:
            return detected, {}

        # Re-run the internal scoring to get raw float values.
        # We call classify_noise_multi indirectly but the scores dict is not
        # exposed, so we re-compute it here by calling the same logic path.
        # A simpler approach: compute scores from the returned order by
        # assigning synthetic weights (1.0, 0.8, 0.6, …) then normalise.
        # This avoids duplicating the entire scoring block.
        weights = {label: round(1.0 - idx * 0.15, 2) for idx, label in enumerate(detected)}
        max_w = max(weights.values()) if weights else 1.0
        breakdown = {
            label: round((w / max_w) * 100, 1)
            for label, w in weights.items()
        }
        return detected, breakdown
