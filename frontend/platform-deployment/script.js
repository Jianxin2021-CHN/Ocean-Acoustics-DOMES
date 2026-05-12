// ============================================
// Platform Deployment - Trajectory Visualization
// ============================================

let historyDataRaw = [];
let historyChart = null;
const buoyColors = ['#8562F0', '#00D1FF', '#FF3D71', '#00E096', '#FFAB00', '#FF708D'];

document.addEventListener('DOMContentLoaded', () => {
    initHistoryChart();
});

function initHistoryChart() {
    const chartDom = document.getElementById('trajectoryChart');
    if (!historyChart) {
        historyChart = echarts.init(chartDom);
    }
    window.addEventListener('resize', () => {
        historyChart && historyChart.resize();
    });
}

async function handleHistoryFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let json;
            if (file.name.endsWith('.csv')) {
                json = parseCSV(e.target.result);
            } else {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            }
            
            historyDataRaw = json;
            updateUIComponents(file.name);
            updateTrajectoryChart();
            
            document.getElementById('emptyState').style.display = 'none';
        } catch (err) {
            console.error("Data parse error", err);
            alert("Failed to parse file: " + err.message);
        }
    };
    
    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] ? values[idx].trim() : '';
        });
        result.push(row);
    }
    return result;
}

function updateUIComponents(fileName) {
    document.getElementById('trackFileName').innerText = fileName;
    const buoyIds = [...new Set(historyDataRaw.map(item => item.buoy_id || item.platform_id || item.id))].sort();
    
    const select = document.getElementById('buoySelect');
    select.innerHTML = '<option value="all">View All Tracks</option>';
    
    const legendList = document.getElementById('buoyLegend');
    legendList.innerHTML = '';

    buoyIds.forEach((id, index) => {
        const color = buoyColors[index % buoyColors.length];
        
        const opt = document.createElement('option');
        opt.value = id;
        opt.text = `Platform ${id}`;
        select.appendChild(opt);

        legendList.innerHTML += `
            <div class="legend-card" style="border-left-color: ${color}">
                <div style="font-size:0.8rem; font-weight:bold; color:var(--text-main)">ID: ${id}</div>
            </div>
        `;
    });
}

function updateTrajectoryChart() {
    if (!historyChart) initHistoryChart();
    
    const selectedId = document.getElementById('buoySelect').value;
    const filteredData = (selectedId === 'all') 
        ? historyDataRaw 
        : historyDataRaw.filter(d => String(d.buoy_id || d.platform_id || d.id) === String(selectedId));

    const groups = {};
    filteredData.forEach(row => {
        const id = row.buoy_id || row.platform_id || row.id;
        if (!groups[id]) groups[id] = [];
        const lon = parseFloat(row.buoy_lon || row.longitude || row.lon);
        const lat = parseFloat(row.buoy_lat || row.latitude || row.lat);
        if (!isNaN(lon) && !isNaN(lat)) {
            groups[id].push([lon, lat]);
        }
    });

    const series = [];
    Object.keys(groups).forEach((id, index) => {
        const color = buoyColors[index % buoyColors.length];
        const path = groups[id];
        if (path.length === 0) return;
        
        const lastPoint = path[path.length - 1];

        series.push({
            name: `Platform ${id}`,
            type: 'line',
            data: path,
            smooth: true,
            showSymbol: false,
            lineStyle: { 
                width: 3, 
                color: color, 
                cap: 'round',
                join: 'round'
            },
            endLabel: {
                show: true,
                formatter: `Platform ${id}`,
                color: color,
                fontWeight: 'bold',
                fontSize: 11,
                distance: 8
            },
            markPoint: {
                data: [{ coord: lastPoint }],
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { 
                    color: color, 
                    shadowBlur: 15, 
                    shadowColor: color 
                },
                label: { show: false }
            }
        });
    });

    const option = {
        animationDuration: 1500,
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(23, 23, 25, 0.9)',
            borderColor: '#333',
            textStyle: { color: '#ccc', fontSize: 11 },
            formatter: function(params) {
                let result = '';
                params.forEach(p => {
                    result += `${p.marker} ${p.seriesName}<br/>`;
                    result += `  Lon: ${p.data[0].toFixed(4)}°<br/>`;
                    result += `  Lat: ${p.data[1].toFixed(4)}°<br/>`;
                });
                return result;
            }
        },
        grid: { 
            top: 50, 
            bottom: 80, 
            left: 110, 
            right: 120 
        },
        xAxis: {
            name: '经度 (°)',
            type: 'value', 
            scale: true,
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
            axisLabel: { color: '#666', fontSize: 10 },
            nameTextStyle: { color: '#666', fontSize: 11 }
        },
        yAxis: {
            name: '纬度 (°)',
            type: 'value', 
            scale: true,
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
            axisLabel: { color: '#666', fontSize: 10 },
            nameTextStyle: { color: '#666', fontSize: 11 }
        },
        dataZoom: [
            { 
                type: 'slider', 
                show: true,
                xAxisIndex: [0], 
                bottom: 25, 
                height: 12,
                borderColor: 'transparent',
                fillerColor: 'rgba(112, 71, 235, 0.15)',
                handleStyle: { color: '#7047EB' },
                showDetail: false,
                realtime: true
            },
            { 
                type: 'slider', 
                show: true,
                yAxisIndex: [0], 
                left: 35,      
                width: 12,
                borderColor: 'transparent',
                fillerColor: 'rgba(112, 71, 235, 0.15)',
                handleStyle: { color: '#7047EB' },
                showDetail: false,
                realtime: true
            },
            { 
                type: 'inside', 
                xAxisIndex: [0],
                zoomOnMouseWheel: true 
            },
            { 
                type: 'inside', 
                yAxisIndex: [0],
                zoomOnMouseWheel: 'shift'
            }
        ],
        series: series
    };

    historyChart.setOption(option, true);
}

function resetZoom() {
    if (!historyChart) return;
    historyChart.dispatchAction({
        type: 'dataZoom',
        start: 0,
        end: 100
    });
}

function exportTrajectoryImage() {
    if (!historyChart) return;
    const url = historyChart.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#111113'
    });
    const a = document.createElement('a');
    a.href = url;
    a.download = `trajectory_${new Date().toISOString().slice(0,10)}.png`;
    a.click();
}