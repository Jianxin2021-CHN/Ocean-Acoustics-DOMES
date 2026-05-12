import os
import uvicorn
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from core.processor import preprocess_audio
from core.inference import ModelEngine

app = FastAPI()

# 1. 解决跨域问题 (重要：确保前端能正常调用接口)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 初始化模型引擎
# 请确保您的模型文件放置在 backend/models/ 目录下
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models\cnn_net.onnx")
engine = ModelEngine(MODEL_PATH)

@app.post("/api/recognize")
async def recognize(file: UploadFile = File(...)):
    """
    接收前端上传的音频文件，进行预处理、推理并返回分类结果
    """
    try:
        # 读取上传的文件流
        content = await file.read()
        
        # 3. 预处理 (调用 core/processor.py)
        # 将音频转换为 [1, 1, 311, 128] 的特征矩阵
        features = preprocess_audio(content)
        
        # 4. 模型推理 (调用 core/inference.py)
        # 使用新版 ModelEngine，内置了 softmax 和 Top-K 排序
        inference_data = engine.run(features, top_k=3)
        
        # 5. 返回结果给前端
        return {
            "status": "success",
            "result": inference_data["result"],      # 最高置信度的分类结果
            "candidates": inference_data["candidates"] # 备选列表 (前端可选显示)
        }
        
    except Exception as e:
        # 记录错误日志，方便调试
        print(f"Server Error: {str(e)}")
        return {
            "status": "error", 
            "message": str(e)
        }

if __name__ == "__main__":
    # 在 backend 目录下直接运行: python main.py
    uvicorn.run(app, host="0.0.0.0", port=8000)