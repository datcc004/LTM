'use strict';

/* Biểu đồ báo cáo: ưu tiên dữ liệu nhúng sẵn, làm mới qua /reports/data (không inline script vì CSP). */
(function () {
  function parse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function css(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  const root = document.getElementById('reportRoot');
  if (!root || typeof Chart === 'undefined') return;

  const palette = ['#1e40af', '#3b82f6', '#0ea5e9', '#14b8a6', '#8b5cf6', '#f59e0b', '#059669', '#e11d48'];
  const gridColor = css('--chart-grid', 'rgba(15, 23, 42, 0.08)');
  const textColor = css('--chart-text', '#475569');
  const charts = {};

  function initialData() {
    return {
      statusChart: {
        labels: parse(root.dataset.statusLabels, []),
        values: parse(root.dataset.statusValues, []),
      },
      attendanceChart: parse(root.dataset.attendanceTrend, []),
      leaveChart: {
        labels: parse(root.dataset.leaveLabels, []),
        values: parse(root.dataset.leaveValues, []),
      },
      payrollChart: {
        labels: parse(root.dataset.payrollLabels, []),
        values: parse(root.dataset.payrollValues, []),
      },
    };
  }

  function render(data) {
    const status = data.statusChart || {};
    const leave = data.leaveChart || {};
    const payroll = data.payrollChart || {};
    const trend = data.attendanceChart || [];

    function replace(id, config) {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      if (charts[id]) charts[id].destroy();
      charts[id] = new Chart(canvas, config);
    }

    replace('reportStatusChart', {
      type: 'doughnut',
      data: {
        labels: status.labels || [],
        datasets: [{
          data: status.values || [],
          backgroundColor: palette,
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: { legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12 } } },
      },
    });

    replace('reportAttendanceChart', {
      type: 'line',
      data: {
        labels: trend.map((row) => row.label),
        datasets: [
          {
            label: 'Đúng giờ',
            data: trend.map((row) => Number(row.on_time) || 0),
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.12)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Trễ / thiếu giờ',
            data: trend.map((row) => Number(row.late) || 0),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } },
        },
        plugins: { legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12 } } },
      },
    });

    const barOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, maxRotation: 45, minRotation: 0 } },
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
      },
    };

    replace('reportLeaveChart', {
      type: 'bar',
      data: {
        labels: leave.labels || [],
        datasets: [{
          data: leave.values || [],
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          maxBarThickness: 42,
        }],
      },
      options: barOptions,
    });

    replace('reportPayrollChart', {
      type: 'bar',
      data: {
        labels: payroll.labels || [],
        datasets: [{
          data: payroll.values || [],
          backgroundColor: '#8b5cf6',
          borderRadius: 6,
          maxBarThickness: 42,
        }],
      },
      options: Object.assign({}, barOptions, {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return new Intl.NumberFormat('vi-VN', {
                  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
                }).format(context.parsed.y);
              },
            },
          },
        },
      }),
    });
  }

  render(initialData());

  fetch(root.dataset.endpoint, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (payload) {
      if (payload && payload.success && payload.data && payload.data.charts) {
        render(payload.data.charts);
      }
    })
    .catch(function () { /* Giữ dữ liệu nhúng sẵn nếu làm mới thất bại. */ });
}());
