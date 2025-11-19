document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calcForm');
    const submitBtn = document.getElementById('submitBtn');
    const resultSection = document.getElementById('resultSection');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // UI Loading State
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = '計算中...';
        submitBtn.disabled = true;

        const formData = {
            ticker: document.getElementById('ticker').value,
            amount: document.getElementById('amount').value,
            start_date: document.getElementById('start_date').value,
            end_date: document.getElementById('end_date').value
        };

        try {
            const response = await fetch('/api/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '計算發生錯誤');
            }

            displayResults(data);
            resultSection.classList.remove('hidden');
            resultSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            alert(error.message);
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
        }
    });

    function displayResults(data) {
        // Update Summary Cards
        document.getElementById('totalInvested').innerText = formatCurrency(data.summary.total_invested);

        document.getElementById('finalValuePrice').innerText = formatCurrency(data.summary.final_value_price);
        const roiPriceElem = document.getElementById('roiPrice');
        roiPriceElem.innerText = `${data.summary.total_roi_price}%`;
        roiPriceElem.style.color = data.summary.total_roi_price >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        document.getElementById('finalValueDrip').innerText = formatCurrency(data.summary.final_value_drip);
        const roiDripElem = document.getElementById('roiDrip');
        roiDripElem.innerText = `${data.summary.total_roi_drip}%`;
        roiDripElem.style.color = data.summary.total_roi_drip >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        // Render Charts
        renderCharts(data.portfolio);
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value);
    }

    let charts = {};

    function renderCharts(portfolio) {
        const labels = portfolio.map(p => p.date);

        // Destroy existing charts
        Object.values(charts).forEach(chart => chart.destroy());
        charts = {};

        // 1. Asset Growth Chart
        createChart('assetChart', labels, [
            {
                label: '總投入成本',
                data: portfolio.map(p => p.total_invested),
                borderColor: '#a0a0a0',
                backgroundColor: 'rgba(160, 160, 160, 0.1)',
                fill: true
            },
            {
                label: '資產市值 (不含息)',
                data: portfolio.map(p => p.portfolio_value),
                borderColor: '#03dac6',
                backgroundColor: 'rgba(3, 218, 198, 0.05)',
                fill: false
            },
            {
                label: '資產市值 (含息)',
                data: portfolio.map(p => p.portfolio_value_drip),
                borderColor: '#bb86fc',
                backgroundColor: 'rgba(187, 134, 252, 0.1)',
                fill: true
            }
        ], 'TWD');

        // 2. Cost vs Price Chart
        createChart('costChart', labels, [
            {
                label: '平均成本',
                data: portfolio.map(p => p.average_cost),
                borderColor: '#ffb74d',
                borderDash: [5, 5],
                borderWidth: 2,
                fill: false
            },
            {
                label: '月收盤價',
                data: portfolio.map(p => p.price),
                borderColor: '#bb86fc',
                borderWidth: 1,
                pointRadius: 0,
                fill: false
            }
        ], 'TWD');

        // 3. ROI Chart
        createChart('roiChart', labels, [
            {
                label: '報酬率 (不含息) %',
                data: portfolio.map(p => p.roi),
                borderColor: '#03dac6',
                fill: false
            },
            {
                label: '報酬率 (含息) %',
                data: portfolio.map(p => p.roi_drip),
                borderColor: '#bb86fc',
                fill: false
            }
        ], '%');

        // 4. Shares Chart
        createChart('sharesChart', labels, [
            {
                label: '累積股數',
                data: portfolio.map(p => p.total_shares),
                borderColor: '#2196f3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                fill: true
            }
        ], '股');
    }

    function createChart(canvasId, labels, datasets, unit) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets.map(ds => ({
                    ...ds,
                    borderWidth: ds.borderWidth || 2,
                    pointRadius: ds.pointRadius !== undefined ? ds.pointRadius : 0,
                    tension: 0.1
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        labels: { color: '#e0e0e0' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    if (unit === 'TWD') {
                                        label += new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(context.parsed.y);
                                    } else if (unit === '%') {
                                        label += context.parsed.y.toFixed(2) + '%';
                                    } else {
                                        label += Math.round(context.parsed.y) + ' ' + unit;
                                    }
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#a0a0a0', maxTicksLimit: 8 },
                        grid: { color: '#333' }
                    },
                    y: {
                        ticks: { color: '#a0a0a0' },
                        grid: { color: '#333' }
                    }
                }
            }
        });
    }
});
