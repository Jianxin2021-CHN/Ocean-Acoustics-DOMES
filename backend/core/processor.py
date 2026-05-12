import torch
import torchaudio
import torch.nn.functional as F
import io
import numpy as np
import math

class InferenceConfig:
    f_min = 0
    f_max = 22050
    win_length_ms = 32
    hop_length_ms = 16
    n_mels = 128              
    sample_rate = 44100      
    target_time_steps = 187   

def preprocess_audio(file_content: bytes):
    # 1. 加载音频
    buffer = io.BytesIO(file_content)
    waveform, sr = torchaudio.load(buffer)
    
    # 2. 重采样与单声道处理
    if sr != InferenceConfig.sample_rate:
        resampler = torchaudio.transforms.Resample(sr, InferenceConfig.sample_rate)
        waveform = resampler(waveform)
        sr = InferenceConfig.sample_rate

    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)

    # 3. 计算窗长和帧移 (保持与 AudioDataLoader 逻辑一致)
    win_length = math.floor(InferenceConfig.win_length_ms / 1000 * sr + 1)
    hop_length = math.floor(InferenceConfig.hop_length_ms / 1000 * sr + 1)

    # 4. 计算梅尔频谱
    mel_transform = torchaudio.transforms.MelSpectrogram(
        sample_rate=sr,
        n_fft=win_length,
        win_length=win_length,
        hop_length=hop_length,
        f_min=InferenceConfig.f_min,
        f_max=InferenceConfig.f_max,
        n_mels=InferenceConfig.n_mels,
        pad=hop_length // 2,
        center=False,        
        normalized=True,     
        power=2.0
    )
    mel_spec = mel_transform(waveform) # 原始形状: [1, n_mels, Time]

    # 5. 分贝转换
    log_mel_spec = torchaudio.transforms.AmplitudeToDB()(mel_spec)

    # 6. 【核心对齐】执行转置以匹配训练端 transpose(1, 2)
    # 转换后形状: [1, Time, n_mels]
    log_mel_spec = log_mel_spec.transpose(1, 2)

    # 7. 维度修正与插值适配
    # 增加 batch 维度 -> [1, 1, Time, n_mels]
    final_features = log_mel_spec.unsqueeze(0) 
    
    # 使用双线性插值强制对齐到目标形状 (187, 128)
    final_features = F.interpolate(
        final_features,
        size=(InferenceConfig.target_time_steps, InferenceConfig.n_mels),
        mode='bilinear',
        align_corners=False
    )

    return final_features.numpy().astype(np.float32)