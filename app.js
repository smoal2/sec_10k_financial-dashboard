
let records = [];
let sentimentChart = null;
let ratioChart = null;

const byId = id => document.getElementById(id);

function validNumber(value) {
  return typeof value === "number" &&
    Number.isFinite(value);
}

function divide(numerator, denominator) {
  if (!validNumber(numerator) ||
      !validNumber(denominator) ||
      denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function display(value, percentage = false) {
  if (value === null) return "N/A";
  return percentage
    ? (value * 100).toFixed(2) + "%"
    : value.toFixed(2);
}

function prepareRows(company) {
  const rows = records
    .filter(row => row.company === company)
    .sort((a, b) => a.year - b.year);

  return rows.map((row, index) => {
    const previous = rows[index - 1];

    const averageAssets = previous &&
      validNumber(row.totalAssets) &&
      validNumber(previous.totalAssets)
      ? (row.totalAssets + previous.totalAssets) / 2
      : null;

    return {
      ...row,
      currentRatio: divide(
        row.currentAssets, row.currentLiabilities
      ),
      debtRatio: divide(
        row.totalLiabilities, row.totalAssets
      ),
      assetTurnover: divide(
        row.revenue, averageAssets
      ),
      profitMargin: divide(
        row.netIncome, row.revenue
      ),
      pnRatio: divide(
        row.positive, row.negative
      )
    };
  });
}

function updateDashboard() {
  const company = byId("company").value;
  const rows = prepareRows(company);

  if (sentimentChart) sentimentChart.destroy();
  if (ratioChart) ratioChart.destroy();

  if (!rows.length) {
    byId("status").textContent =
      "No verified data loaded for this company yet.";
    byId("selectedYear").textContent = "";
    for (const id of [
      "currentRatio", "debtRatio",
      "assetTurnover", "profitMargin"
    ]) {
      byId(id).textContent = "N/A";
    }
    return;
  }

  byId("status").textContent =
    `${rows.length} fiscal years loaded.`;

  const latest = rows[rows.length - 1];

  byId("selectedYear").textContent =
    `Latest available fiscal year: ${latest.year}`;

  byId("currentRatio").textContent =
    display(latest.currentRatio);

  byId("debtRatio").textContent =
    display(latest.debtRatio, true);

  byId("assetTurnover").textContent =
    display(latest.assetTurnover);

  byId("profitMargin").textContent =
    display(latest.profitMargin, true);

  const years = rows.map(row => row.year);

  sentimentChart = new Chart(
    byId("sentimentChart"),
    {
      type: "line",
      data: {
        labels: years,
        datasets: [
          {
            label: "P/N Sentiment Ratio",
            data: rows.map(row => row.pnRatio),
            borderColor: "#2464aa",
            yAxisID: "sentiment"
          },
          {
            label: "Closing Stock Price ($)",
            data: rows.map(row => row.stockPrice),
            borderColor: "#d97706",
            yAxisID: "price"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        scales: {
          sentiment: {
            type: "linear",
            position: "left",
            title: {
              display: true,
              text: "P/N Ratio"
            }
          },
          price: {
            type: "linear",
            position: "right",
            grid: {
              drawOnChartArea: false
            },
            title: {
              display: true,
              text: "Stock Price ($)"
            }
          }
        }
      }
    }
  );

  ratioChart = new Chart(
    byId("ratioChart"),
    {
      type: "line",
      data: {
        labels: years,
        datasets: [
          {
            label: "Current Ratio",
            data: rows.map(r => r.currentRatio),
            borderColor: "#2464aa"
          },
          {
            label: "Debt-to-Assets",
            data: rows.map(r => r.debtRatio),
            borderColor: "#d97706"
          },
          {
            label: "Asset Turnover",
            data: rows.map(r => r.assetTurnover),
            borderColor: "#16856a"
          },
          {
            label: "Net Profit Margin",
            data: rows.map(r => r.profitMargin),
            borderColor: "#9333ea"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    }
  );
}

async function start() {
  try {
    const response = await fetch("data/data.json");

    if (!response.ok) {
      throw new Error("Cannot load data/data.json");
    }

    records = await response.json();

    if (!Array.isArray(records)) {
      throw new Error("Data must be an array.");
    }

    updateDashboard();
  } catch (error) {
    byId("status").textContent =
      "Data loading error: " + error.message;
  }
}

byId("company").addEventListener(
  "change", updateDashboard
);

start();
