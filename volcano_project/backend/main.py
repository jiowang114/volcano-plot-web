# 导入所需的库
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import io
import math

# 初始化 FastAPI 应用
app = FastAPI(title="Volcano Plot API")

# 配置 CORS，允许前端跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 实际生产环境中请替换为前端实际运行的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/upload")
async def process_volcano_data(file: UploadFile = File(...)):
    """
    接收前端上传的 CSV 文件，处理并返回火山图所需的 JSON 数据。
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="必须上传 .csv 格式的文件")

    # 读取文件内容
    contents = await file.read()
    
    try:
        # 使用 pandas 读取 CSV
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV 文件解析失败: {str(e)}")

    # 1. 验证必需的列名
    required_cols = {'gene_name', 'log2FC'}
    if not required_cols.issubset(df.columns):
        raise HTTPException(status_code=400, detail="文件缺少核心列: 'gene_name' 或 'log2FC'")

    # 自动识别 p_value 或 p_adj_value
    p_col = 'p_adj_value' if 'p_adj_value' in df.columns else 'p_value' if 'p_value' in df.columns else None
    if not p_col:
        raise HTTPException(status_code=400, detail="文件缺少显著性列: 'p_value' 或 'p_adj_value'")

    # 2. 数据清洗
    # 丢弃缺失值并强制转换为数字类型
    df = df.dropna(subset=['gene_name', 'log2FC', p_col])
    df['log2FC'] = pd.to_numeric(df['log2FC'], errors='coerce')
    df[p_col] = pd.to_numeric(df[p_col], errors='coerce')
    df = df.dropna(subset=['log2FC', p_col])

    # 3. 数据计算
    # 为避免 log10(0) 报错，添加一个极小值 epsilon
    epsilon = 1e-300
    df['y'] = -np.log10(df[p_col] + epsilon)

    # 4. 寻找 Top 10 最显著差异的基因 
    # 评分标准：|log2FC| * -log10(p_value) 越大越显著
    df['significance_score'] = abs(df['log2FC']) * df['y']
    top_10_genes = set(df.nlargest(10, 'significance_score')['gene_name'].tolist())

    # 5. 构建前端所需的数据结构
    results = []
    for _, row in df.iterrows():
        # 判断上下调状态 (假设阈值为 |log2FC| >= 1 且 p < 0.05)
        is_significant = abs(row['log2FC']) >= 1.0 and row[p_col] < 0.05
        if is_significant and row['log2FC'] > 0:
            status = "up"
        elif is_significant and row['log2FC'] < 0:
            status = "down"
        else:
            status = "ns" # not significant

        results.append({
            "gene_name": row['gene_name'],
            "x": round(row['log2FC'], 4),        # X 轴坐标
            "y": round(row['y'], 4),             # Y 轴坐标 (-log10 P-value)
            "p_value": row[p_col],
            "status": status,                    # 用于前端标色：上调/下调/不显著
            "is_top_10": row['gene_name'] in top_10_genes
        })

    return {
        "message": "数据处理成功",
        "total_genes": len(results),
        "data": results
    }