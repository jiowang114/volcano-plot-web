import React, { useState, useCallback } from 'react';
import { UploadCloud, AlertCircle, FileText, Activity } from 'lucide-react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, ReferenceLine 
} from 'recharts';

// 定义散点图点的颜色
const COLORS = {
  up: '#ef4444',    // 红色: 上调
  down: '#3b82f6',  // 蓝色: 下调
  ns: '#d1d5db'     // 灰色: 不显著
};

export default function App() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  // 处理文件拖拽
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  }, []);

  // 处理文件选择
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (file) => {
    setError('');
    if (file && file.name.endsWith('.csv')) {
      setFile(file);
    } else {
      setError('请上传有效的 .csv 文件！');
      setFile(null);
    }
  };

  // 生成测试数据 (当后端未启动时可用作演示)
  const generateMockData = () => {
    const mockData = [];
    for (let i = 0; i < 500; i++) {
      const log2FC = (Math.random() - 0.5) * 6;
      const pValue = Math.pow(10, -(Math.random() * 6));
      const y = -Math.log10(pValue);
      
      let status = 'ns';
      if (Math.abs(log2FC) >= 1 && pValue < 0.05) {
        status = log2FC > 0 ? 'up' : 'down';
      }

      mockData.push({
        gene_name: `GENE_${i + 1}`,
        x: parseFloat(log2FC.toFixed(4)),
        y: parseFloat(y.toFixed(4)),
        p_value: pValue,
        status: status,
        is_top_10: false
      });
    }
    
    // 手动制造几个 Top 10 点
    for (let i = 0; i < 10; i++) {
        mockData[i].x = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
        mockData[i].y = 4 + Math.random() * 4;
        mockData[i].status = mockData[i].x > 0 ? 'up' : 'down';
        mockData[i].is_top_10 = true;
    }

    setData(mockData);
    setStats({ total: 500 });
  };

  // 上传至 FastAPI 后端
  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 请确保你的 FastAPI 运行在此地址
      const response = await fetch('https://biotifyjio.onrender.com/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || '处理失败');
      }

      setData(result.data);
      setStats({ total: result.total_genes });
    } catch (err) {
      console.error(err);
      setError(`请求失败: ${err.message} (检查后端是否已在端口 8000 启动)`);
    } finally {
      setLoading(false);
    }
  };

  // 自定义散点图悬浮提示 (Tooltip)
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 text-white p-3 rounded-lg shadow-xl text-sm border border-slate-700">
          <p className="font-bold text-base mb-1 border-b border-slate-600 pb-1 text-blue-300">
            {data.gene_name} {data.is_top_10 && '⭐ (Top 10)'}
          </p>
          <p>Log₂ FC: <span className={data.x > 0 ? "text-red-400" : "text-blue-400"}>{data.x}</span></p>
          <p>-Log₁₀ P-value: {data.y}</p>
          <p className="text-slate-400 text-xs mt-1">
            原始 P-value: {data.p_value.toExponential(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex items-center space-x-3 mb-8">
          <Activity className="w-8 h-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-slate-900">交互式生信火山图 (Volcano Plot)</h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左侧：操作面板 */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4 text-slate-700">数据上传</h2>
              
              {/* 拖拽上传区域 */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer group"
                onClick={() => document.getElementById('file-upload').click()}
              >
                <input 
                  id="file-upload" 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleFileSelect}
                />
                <UploadCloud className="w-12 h-12 text-slate-400 group-hover:text-indigo-500 mb-3" />
                <p className="font-medium text-slate-700 mb-1">点击或拖拽 CSV 文件至此处</p>
                <p className="text-sm text-slate-500">仅支持 .csv 格式</p>
              </div>

              {/* 数据格式要求提示 */}
              <div className="mt-6 bg-blue-50 text-blue-800 rounded-lg p-4 text-sm flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <p className="font-semibold mb-1">文件必须包含以下三列：</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700/80">
                    <li><code className="bg-blue-100 px-1 py-0.5 rounded">gene_name</code> (基因名称)</li>
                    <li><code className="bg-blue-100 px-1 py-0.5 rounded">log2FC</code> (差异倍数)</li>
                    <li><code className="bg-blue-100 px-1 py-0.5 rounded">p_value</code> 或 <code className="bg-blue-100 px-1 py-0.5 rounded">p_adj_value</code></li>
                  </ul>
                </div>
              </div>

              {/* 文件信息与操作按钮 */}
              {file && (
                <div className="mt-4 flex items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <FileText className="w-5 h-5 text-slate-400 mr-2" />
                  <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                </div>
              )}

              {error && (
                <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              <div className="mt-6 space-y-3">
                <button 
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex justify-center items-center"
                >
                  {loading ? '处理中...' : '生成火山图'}
                </button>
                <button 
                  onClick={generateMockData}
                  className="w-full bg-white text-indigo-600 border border-indigo-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  无后端？加载演示数据
                </button>
              </div>
            </div>

            {/* Top 10 列表展示 */}
            {data.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4 text-slate-700 flex items-center">
                  <span className="text-xl mr-2">⭐</span> Top 10 显著差异基因
                </h2>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {data.filter(d => d.is_top_10).sort((a,b) => b.y - a.y).map((gene, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100">
                      <span className="font-semibold text-sm text-slate-700">{gene.gene_name}</span>
                      <div className="flex space-x-3 text-xs">
                        <span className={gene.x > 0 ? "text-red-500 font-medium" : "text-blue-500 font-medium"}>
                          FC: {gene.x > 0 ? '+' : ''}{gene.x.toFixed(2)}
                        </span>
                        <span className="text-slate-500">
                          -log P: {gene.y.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧：图表渲染区域 */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
            <h2 className="text-lg font-semibold mb-2 text-slate-700">表达量散点图</h2>
            {stats && <p className="text-sm text-slate-500 mb-6">共加载 {stats.total} 个基因数据</p>}
            
            <div className="flex-1 w-full min-h-[500px] relative">
              {data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      name="Log2FC" 
                      label={{ value: 'Log₂ Fold Change', position: 'bottom', offset: 0 }}
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="y" 
                      name="-Log10 P" 
                      label={{ value: '-Log₁₀ (P-value)', angle: -90, position: 'left' }}
                      tick={{ fill: '#64748b' }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} />
                    
                    {/* 参考线：阈值 |log2FC| = 1, -log10(p)=1.3 (约 p=0.05) */}
                    <ReferenceLine x={1} stroke="#94a3b8" strokeDasharray="3 3" />
                    <ReferenceLine x={-1} stroke="#94a3b8" strokeDasharray="3 3" />
                    <ReferenceLine y={-Math.log10(0.05)} stroke="#94a3b8" strokeDasharray="3 3" />

                    <Scatter name="Genes" data={data}>
                      {data.map((entry, index) => {
                        // Top 10 的点可以变大以突出显示
                        const radius = entry.is_top_10 ? 6 : 3;
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[entry.status]} 
                            r={radius}
                            // 为 top 10 添加黑边突出
                            stroke={entry.is_top_10 ? '#1e293b' : 'none'}
                            strokeWidth={entry.is_top_10 ? 1.5 : 0}
                          />
                        );
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <ScatterChart className="w-16 h-16 opacity-20 mb-4" />
                  <p>请上传数据或加载演示数据生成火山图</p>
                </div>
              )}
            </div>

            {/* 图例 */}
            {data.length > 0 && (
              <div className="flex justify-center space-x-6 mt-6 border-t border-slate-100 pt-4">
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>上调显著 (Up)</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>下调显著 (Down)</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                  <span>不显著 (NS)</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}