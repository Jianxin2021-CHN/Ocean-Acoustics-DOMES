import onnxruntime as ort
import numpy as np

class ModelEngine:
    def __init__(self, model_path: str):
        # 初始化 ONNX 运行环境，优先尝试 GPU (CUDA)
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        self.session = ort.InferenceSession(model_path, providers=providers)
        
        # 获取模型输入节点的名称
        self.input_name = self.session.get_inputs()[0].name

    def _softmax(self, x):

        # 减去最大值以防 exp(x) 产生数值溢出
        e_x = np.exp(x - np.max(x, axis=1, keepdims=True))
        return e_x / e_x.sum(axis=1, keepdims=True)

    def run(self, features: np.ndarray, top_k: int = 3):
        """
        输入: 预处理后的特征矩阵 (期望形状: [1, 1, 187, 128])
        输出: 包含 [0, 1] 置信度的结果字典
        """
        # 1. 确保输入维度为 4D
        if features.ndim == 3:
            features = np.expand_dims(features, axis=0)
        elif features.ndim == 2:
            features = np.expand_dims(np.expand_dims(features, axis=0), axis=0)
            
        # 2. 执行模型推理获取原始 Logits
        outputs = self.session.run(None, {self.input_name: features.astype(np.float32)})
        logits = outputs[0]
        
        # 3. 归一化处理：将 Logits 转为 [0, 1] 的概率 (置信度)
        probs = self._softmax(logits)[0]
        
        # 4. 获取 Top-K 索引 (按置信度从高到低)
        top_indices = np.argsort(probs)[-top_k:][::-1]
        
        # 5. 构建包含置信度分数的候选列表
        candidates = []
        for idx in top_indices:
            candidates.append({
                "label": int(idx),
                "confidence": float(probs[idx])  
            })
            
        return {
            "result": candidates[0],      # 置信度最高的单条结果
            "candidates": candidates      # 完整候选清单
        }