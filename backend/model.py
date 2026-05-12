import onnxruntime as ort
import numpy as np

# 加载模型 (在启动时执行一次)
session = ort.InferenceSession("model.onnx")

def predict(feature_data):
    # 将您的模型推理逻辑放入这里
    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: feature_data.astype(np.float32)})
    return outputs[0] # 返回分类结果或概率