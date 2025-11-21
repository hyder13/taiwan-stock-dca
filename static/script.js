document.addEventListener('DOMContentLoaded', () => {
    // --- Tab Switching ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });

            // Add active class to clicked tab and target content
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            targetContent.classList.remove('hidden');
            targetContent.classList.add('active');
        });
    });

    // --- DCA Calculator Logic ---
    const form = document.getElementById('calcForm');
    const submitBtn = document.getElementById('submitBtn');
    const resultSection = document.getElementById('resultSection');
    const tickerInput = document.getElementById('ticker');
    const amountInput = document.getElementById('amount');
    const marketRadios = document.getElementsByName('market');

    // Handle Market Selection Change (DCA)
    marketRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updatePlaceholders(e.target.value, tickerInput, amountInput);
        });
    });

    function updatePlaceholders(market, tickerEl, amountEl) {
        if (market === 'tw') {
            tickerEl.placeholder = '2330';
            if (amountEl) {
                amountEl.placeholder = '10000';
                document.querySelector('label[for="amount"]').innerText = '每月投資金額 (TWD)';
            }
        } else if (market === 'us') {
            tickerEl.placeholder = 'AAPL';
            if (amountEl) {
                amountEl.placeholder = '500';
                document.querySelector('label[for="amount"]').innerText = '每月投資金額 (USD)';
            }
        } else {
            tickerEl.placeholder = 'BTC';
            if (amountEl) {
                amountEl.placeholder = '100';
                document.querySelector('label[for="amount"]').innerText = '每月投資金額 (USD)';
            }
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // UI Loading State
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = '計算中...';
        submitBtn.disabled = true;

        const formData = {
            ticker: tickerInput.value,
            amount: amountInput.value,
            start_date: document.getElementById('start_date').value,
            end_date: document.getElementById('end_date').value,
            market: document.querySelector('input[name="market"]:checked').value
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

    // --- Trend Comparison Logic ---
    const compareForm = document.getElementById('compareForm');
    const compareBtn = document.getElementById('compareBtn');
    const compareResultSection = document.getElementById('compareResultSection');
    const market1Select = document.getElementById('market1');
    const market2Select = document.getElementById('market2');
    const ticker1Input = document.getElementById('ticker1');
    const ticker2Input = document.getElementById('ticker2');

    // Handle Market Selection Change (Comparison)
    market1Select.addEventListener('change', (e) => updatePlaceholders(e.target.value, ticker1Input, null));
    market2Select.addEventListener('change', (e) => updatePlaceholders(e.target.value, ticker2Input, null));

    compareForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const originalBtnText = compareBtn.innerText;
        compareBtn.innerText = '比較中...';
        compareBtn.disabled = true;

        const formData = {
            ticker1: ticker1Input.value,
            market1: market1Select.value,
            ticker2: ticker2Input.value,
            market2: market2Select.value,
            start_date: document.getElementById('comp_start_date').value,
            end_date: document.getElementById('comp_end_date').value
        };

        try {
            const response = await fetch('/api/compare_trends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '比較發生錯誤');
            }

            displayComparisonResults(data);
            compareResultSection.classList.remove('hidden');
            compareResultSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            alert(error.message);
        } finally {
            compareBtn.innerText = originalBtnText;
            compareBtn.disabled = false;
        }
    });

    function displayResults(data) {
        const currency = data.summary.currency || 'TWD';

        // Update Summary Cards
        document.getElementById('totalInvested').innerText = formatCurrency(data.summary.total_invested, currency);

        document.getElementById('finalValuePrice').innerText = formatCurrency(data.summary.final_value_price, currency);
        const roiPriceElem = document.getElementById('roiPrice');
        roiPriceElem.innerText = `${data.summary.total_roi_price}%`;
        roiPriceElem.style.color = data.summary.total_roi_price >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        document.getElementById('finalValueDrip').innerText = formatCurrency(data.summary.final_value_drip, currency);
        const roiDripElem = document.getElementById('roiDrip');
        roiDripElem.innerText = `${data.summary.total_roi_drip}%`;
        roiDripElem.style.color = data.summary.total_roi_drip >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        // Lump Sum Summary
        document.getElementById('finalValueLump').innerText = formatCurrency(data.summary.final_value_lump, currency);
        const roiLumpElem = document.getElementById('roiLump');
        roiLumpElem.innerText = `${data.summary.total_roi_lump}%`;
        roiLumpElem.style.color = data.summary.total_roi_lump >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        // Render Charts
        renderCharts(data.portfolio, currency);
    }

    function displayComparisonResults(data) {
        // Update Correlation
        const corrElem = document.getElementById('correlationValue');
        corrElem.innerText = data.correlation;

        // Color code correlation
        if (data.correlation > 0.7) corrElem.style.color = 'var(--success-color)';
        else if (data.correlation < -0.7) corrElem.style.color = 'var(--danger-color)';
        else corrElem.style.color = 'var(--accent-color)';

        // Render Comparison Chart
        renderComparisonChart(data);
    }

    function formatCurrency(value, currency) {
        return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(value);
    }

    let charts = {};

    function renderCharts(portfolio, currency) {
        const labels = portfolio.map(p => p.date);

        // Destroy existing charts (only DCA ones)
        ['assetChart', 'costChart', 'roiChart', 'sharesChart'].forEach(id => {
            if (charts[id]) charts[id].destroy();
        });

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
                label: 'DCA 市值 (含息)',
                data: portfolio.map(p => p.portfolio_value_drip),
                borderColor: '#bb86fc',
                backgroundColor: 'rgba(187, 134, 252, 0.1)',
                fill: true
            },
            {
                label: 'Lump Sum 市值',
                data: portfolio.map(p => p.lump_sum_value),
                borderColor: '#ff4081',
                borderDash: [5, 5],
                fill: false
            }
        ], currency);

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
        ], currency);

        // 3. ROI Chart
        createChart('roiChart', labels, [
            {
                label: 'DCA 報酬率 (含息) %',
                data: portfolio.map(p => p.roi_drip),
                borderColor: '#bb86fc',
                fill: false
            },
            {
                label: 'Lump Sum 報酬率 %',
                data: portfolio.map(p => p.roi_lump),
                borderColor: '#ff4081',
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

    function renderComparisonChart(data) {
        const ctx = document.getElementById('compareChart').getContext('2d');
        const labels = data.data.map(d => d.date);

        if (charts['compareChart']) charts['compareChart'].destroy();

        charts['compareChart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `${data.ticker1} 漲跌幅 (%)`,
                        data: data.data.map(d => d.pct1),
                        borderColor: '#bb86fc',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    },
                    {
                        label: `${data.ticker2} 漲跌幅 (%)`,
                        data: data.data.map(d => d.pct2),
                        borderColor: '#06b6d4',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: { labels: { color: '#e0e0e0' } },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + '%';
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
                                    if (unit === '%') {
                                        label += context.parsed.y.toFixed(2) + '%';
                                    } else if (unit === '股') {
                                        label += Math.round(context.parsed.y) + ' ' + unit;
                                    } else {
                                        // Dynamic Currency
                                        label += new Intl.NumberFormat('zh-TW', { style: 'currency', currency: unit, maximumFractionDigits: 0 }).format(context.parsed.y);
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
