'use strict';

/* Biểu đồ dashboard: lấy dữ liệu qua /api/dashboard (không dùng inline script, CSP script-src 'self'). */
(function () {
  function css(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function render(data) {
    if (typeof Chart === 'undefined') return;

    const deptCanvas = document.getElementById('departmentChart');
    if (deptCanvas && data.departmentChart && data.departmentChart.labels.length) {
      new Chart(deptCanvas, {
        type: 'doughnut',
        data: {
          labels: data.departmentChart.labels,
          datasets: [{
            data: data.departmentChart.values,
            backgroundColor: ['#1e40af', '#3b82f6', '#60a5fa', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f59e0b', '#059669'],
            borderWidth: 0,
            hoverOffset: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: { legend: { position: 'right', labels: { padding: 12, font: { size: 11 } } } },
        },
      });
    } else if (deptCanvas) {
      deptCanvas.parentElement.insertAdjacentHTML('beforeend', '<p class="chart-empty">Chưa có dữ liệu phòng ban.</p>');
      deptCanvas.remove();
    }

    const attCanvas = document.getElementById('attendanceChart');
    const trend = data.attendanceChart || [];
    if (attCanvas && trend.length) {
      new Chart(attCanvas, {
        type: 'bar',
        data: {
          labels: trend.map((row) => row.label),
          datasets: [
            { label: 'Đúng giờ', data: trend.map((row) => row.on_time), backgroundColor: '#059669', borderRadius: 3 },
            { label: 'Đi trễ', data: trend.map((row) => row.late), backgroundColor: '#f59e0b', borderRadius: 3 },
            { label: 'Về sớm', data: trend.map((row) => row.early), backgroundColor: '#0ea5e9', borderRadius: 3 },
            { label: 'Thiếu giờ', data: trend.map((row) => row.missing), backgroundColor: '#f97316', borderRadius: 3 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
          },
          plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } } },
        },
      });
    } else if (attCanvas) {
      attCanvas.parentElement.insertAdjacentHTML('beforeend', '<p class="chart-empty">Chưa có dữ liệu chấm công.</p>');
      attCanvas.remove();
    }
  }

  function init() {
    const dept = document.getElementById('departmentChart');
    const att = document.getElementById('attendanceChart');
    if (!dept && !att) return;

    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = "'Be Vietnam Pro', 'Inter', sans-serif";
      Chart.defaults.color = css('--muted', '#475569');
    }

    fetch('/api/dashboard', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('dashboard fetch failed'))))
      .then((payload) => {
        if (payload && payload.success) render(payload.data || {});
      })
      .catch(() => {
        document.querySelectorAll('#departmentChart, #attendanceChart').forEach((canvas) => {
          canvas.parentElement.insertAdjacentHTML('beforeend', '<p class="chart-empty">Không thể tải biểu đồ.</p>');
          canvas.remove();
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
