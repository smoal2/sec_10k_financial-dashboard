
"use strict";

// ======================================================
// 1. CONFIGURATION
// ======================================================

const $ = (id) => document.getElementById(id);

const COLORS = {
    MSFT: "#1673f9",
    AAPL: "#8d4fea"
};

const METRICS = {
    currentRatio: {
        label: "Current Ratio",
        type: "multiple"
    },
    debtRatio: {
        label: "Debt-to-Assets",
        type: "percent"
    },
    assetTurnover: {
        label: "Asset Turnover",
        type: "multiple"
    },
    profitMargin: {
        label: "Net Profit Margin",
        type: "percent"
    }
};

const FIELDS = {
    income: [
        ["Revenue", "revenue", "money"],
        ["Net income", "netIncome", "money"],
        ["Net profit margin", "profitMargin", "percent"]
    ],
    balance: [
        ["Current assets", "currentAssets", "money"],
        ["Current liabilities", "currentLiabilities", "money"],
        ["Total assets", "totalAssets", "money"],
        ["Total liabilities", "totalLiabilities", "money"]
    ],
    cash: [
        ["Operating cash flow", "operatingCashFlow", "money"],
        ["Capital expenditures", "capitalExpenditures", "money"],
        ["Free cash flow", "freeCashFlow", "money"]
    ],
    sentiment: [
        ["Positive words", "positive", "count"],
        ["Negative words", "negative", "count"],
        ["Positive / negative ratio", "sentimentRatio", "multiple"]
    ],
    stock: [
        ["Fiscal year-end closing price", "stockPrice", "price"]
    ]
};

let records = [];
let charts = {};
let activeTab = "ratios";

// ======================================================
// 2. HELPER FUNCTIONS
// ======================================================

function valid(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function divide(a, b) {
    if (!valid(a) || !valid(b) || b === 0) {
        return null;
    }

    return a / b;
}

function formatValue(value, type = "multiple") {
    if (!valid(value)) {
        return "N/A";
    }

    switch (type) {
        case "percent":
            return (value * 100).toFixed(2) + "%";

        case "price":
            return "$" + value.toFixed(2);

        case "money":
            return "$" +
                Math.round(value).toLocaleString("en-US") +
                "M";

        case "count":
            return Math.round(value).toLocaleString("en-US");

        default:
            return value.toFixed(2);
    }
}

function getYears() {
    return [...new Set(records.map((row) => row.year))]
        .sort((a, b) => a - b);
}

function findRecord(company, year) {
    return records.find(
        (row) => row.company === company && row.year === year
    );
}

// ======================================================
// 3. CALCULATE FINANCIAL RATIOS
// ======================================================

function calculateMetrics(company, year) {
    const current = findRecord(company, year);

    if (!current) {
        return null;
    }

    const previous = findRecord(company, year - 1);

    const currentRatio = divide(
        current.currentAssets,
        current.currentLiabilities
    );

    const debtRatio = divide(
        current.totalLiabilities,
        current.totalAssets
    );

    let assetTurnover = null;

    if (
        previous &&
        valid(previous.totalAssets) &&
        valid(current.totalAssets)
    ) {
        const averageAssets =
            (current.totalAssets + previous.totalAssets) / 2;

        assetTurnover = divide(
            current.revenue,
            averageAssets
        );
    }

    const profitMargin = divide(
        current.netIncome,
        current.revenue
    );

    const sentimentRatio = divide(
        current.positive,
        current.negative
    );

    // Capex may be recorded as a positive expenditure
    // or as a negative cash outflow.
    // This assumes capitalExpenditures is a positive amount.
    const freeCashFlow =
        valid(current.operatingCashFlow) &&
        valid(current.capitalExpenditures)
            ? current.operatingCashFlow -
              current.capitalExpenditures
            : null;

    return {
        ...current,
        currentRatio,
        debtRatio,
        assetTurnover,
        profitMargin,
        sentimentRatio,
        freeCashFlow
    };
}

// ======================================================
// 4. CHART FUNCTIONS
// ======================================================

function createChart(id, configuration) {
    const canvas = $(id);

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    if (charts[id]) {
        charts[id].destroy();
    }

    charts[id] = new Chart(canvas, configuration);
}

function chartOptions(
    percentage = false,
    hideLegend = false
) {
    return {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
            mode: "index",
            intersect: false
        },

        plugins: {
            legend: {
                display: !hideLegend,
                position: "bottom",

                labels: {
                    usePointStyle: true,
                    boxWidth: 9,
                    color: "#617692",
                    padding: 18,
                    font: {
                        size: 11
                    }
                }
            },

            tooltip: {
                callbacks: {
                    label: (context) => {
                        const value = context.parsed.y;

                        if (value === null) {
                            return context.dataset.label + ": N/A";
                        }

                        return (
                            context.dataset.label +
                            ": " +
                            Number(value).toLocaleString(
                                "en-US",
                                { maximumFractionDigits: 2 }
                            ) +
                            (percentage ? "%" : "")
                        );
                    }
                }
            }
        },

        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: "#6e819b",
                    maxRotation: 0,
                    autoSkip: true
                }
            },

            y: {
                beginAtZero: false,
                grid: {
                    color: "#e8eef7"
                },
                ticks: {
                    color: "#6e819b"
                }
            }
        }
    };
}

function createSeries(
    field,
    percentage = false,
    companies = ["MSFT", "AAPL"]
) {
    return companies.map((company) => {
        const values = getYears().map((year) => {
            const result = calculateMetrics(company, year);
            const value = result?.[field];

            if (!valid(value)) {
                return null;
            }

            return percentage ? value * 100 : value;
        });

        return {
            label: company === "MSFT" ? "Microsoft" : "Apple",
            data: values,
            borderColor: COLORS[company],
            backgroundColor: COLORS[company],
            pointBackgroundColor: COLORS[company],
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2.5,
            tension: 0.28,
            spanGaps: false
        };
    });
}

function renderSparkline(company, field) {
    const id = company === "MSFT"
        ? "msftSpark"
        : "aaplSpark";

    createChart(id, {
        type: "line",

        data: {
            labels: getYears(),

            datasets: [{
                data: getYears().map((year) => {
                    return calculateMetrics(company, year)?.[field] ?? null;
                }),

                borderColor: COLORS[company],

                backgroundColor:
                    company === "MSFT"
                        ? "#1673f91c"
                        : "#8d4fea1c",

                fill: true,
                tension: 0.35,
                pointRadius: 0,
                borderWidth: 2.5,
                spanGaps: false
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },

            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}

// ======================================================
// 5. UPDATE COMPANY COMPARISON CARDS
// ======================================================

function updateCompany(company, year, metricKey) {
    const prefix = company === "MSFT" ? "msft" : "aapl";

    const current = calculateMetrics(company, year)?.[metricKey];

    const previous = calculateMetrics(
        company,
        year - 1
    )?.[metricKey];

    const metric = METRICS[metricKey];

    const metricName = $(prefix + "MetricName");
    const primary = $(prefix + "Primary");
    const change = $(prefix + "Change");

    if (metricName) {
        metricName.textContent =
            metric.label + " (" + year + ")";
    }

    if (primary) {
        primary.textContent = formatValue(
            current,
            metric.type
        );
    }

    if (change) {
        change.className = "change";

        if (
            valid(current) &&
            valid(previous) &&
            previous !== 0
        ) {
            const percentChange =
                ((current - previous) / Math.abs(previous)) * 100;

            change.textContent =
                (percentChange >= 0 ? "▲ +" : "▼ ") +
                percentChange.toFixed(1) +
                "% vs. " +
                (year - 1);

            change.classList.add(
                percentChange >= 0 ? "up" : "down"
            );
        } else {
            change.textContent =
                "Prior-year comparison unavailable";
        }
    }

    renderSparkline(company, metricKey);
}

function updateSummaryCards(year) {
    const metrics = [
        ["Current", "currentRatio"],
        ["Debt", "debtRatio"],
        ["Turnover", "assetTurnover"],
        ["Margin", "profitMargin"]
    ];

    for (const [suffix, key] of metrics) {
        for (const company of ["MSFT", "AAPL"]) {
            const id =
                (company === "MSFT" ? "msft" : "aapl") +
                suffix;

            const element = $(id);

            if (element) {
                element.textContent = formatValue(
                    calculateMetrics(company, year)?.[key],
                    METRICS[key].type
                );
            }
        }
    }
}

// ======================================================
// 6. FINANCIAL STATEMENT TABLES
// ======================================================

function createTableRows(fields, year) {
    const rows = fields.map(([label, key, type]) => {
        const microsoft = calculateMetrics("MSFT", year)?.[key];
        const apple = calculateMetrics("AAPL", year)?.[key];

        return `
            <tr>
                <td>${label}</td>
                <td>${formatValue(microsoft, type)}</td>
                <td>${formatValue(apple, type)}</td>
            </tr>
        `;
    }).join("");

    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Measure</th>
                    <th>Microsoft (MSFT)</th>
                    <th>Apple (AAPL)</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function renderDetails(year, companies) {
    const detailBody = $("detailBody");

    if (!detailBody) {
        return;
    }

    const titles = {
        ratios: "Financial Ratios",
        income: "Income Statement",
        balance: "Balance Sheet",
        cash: "Cash Flow Statement",
        sentiment: "MD&A Sentiment Analysis",
        stock: "Fiscal Year-End Stock Prices"
    };

    const descriptions = {
        ratios:
            "Side-by-side liquidity, solvency, efficiency and profitability.",
        income:
            "Revenue and earnings in USD millions.",
        balance:
            "Selected balance sheet measures in USD millions.",
        cash:
            "Operating cash flow, capital expenditures and free cash flow.",
        sentiment:
            "Loughran-McDonald dictionary word counts and sentiment.",
        stock:
            "Last trading-day closing price on or before fiscal year-end."
    };

    if ($("detailTitle")) {
        $("detailTitle").textContent = titles[activeTab];
    }

    if ($("detailDesc")) {
        $("detailDesc").textContent = descriptions[activeTab];
    }

    if ($("detailYear")) {
        $("detailYear").textContent = "FY " + year;
    }

    if (activeTab === "ratios") {
        const fields = Object.entries(METRICS).map(
            ([key, metric]) => [
                metric.label,
                key,
                metric.type
            ]
        );

        detailBody.innerHTML = createTableRows(fields, year);
        return;
    }

    const fields = FIELDS[activeTab];

    if (!fields) {
        return;
    }

    let markup = createTableRows(fields, year);

    if (["sentiment", "stock", "cash"].includes(activeTab)) {
        const metric =
            activeTab === "sentiment"
                ? "sentimentRatio"
                : activeTab === "stock"
                    ? "stockPrice"
                    : "freeCashFlow";

        const title =
            activeTab === "sentiment"
                ? "Positive / Negative Ratio"
                : activeTab === "stock"
                    ? "Historical Closing Price"
                    : "Free Cash Flow";

        markup += `
            <div class="mini-chart" style="margin-top:25px">
                <h3>${title} Trend</h3>
                <div style="height:215px">
                    <canvas id="detailChart"></canvas>
                </div>
            </div>
        `;

        if (charts.detailChart) {
            charts.detailChart.destroy();
            delete charts.detailChart;
        }

        detailBody.innerHTML = markup;

        createChart("detailChart", {
            type: "line",
            data: {
                labels: getYears(),
                datasets: createSeries(
                    metric,
                    false,
                    companies
                )
            },
            options: chartOptions()
        });

        return;
    }

    detailBody.innerHTML = markup;
}

// ======================================================
// 7. RENDER THE COMPLETE DASHBOARD
// ======================================================

function render() {
    if (!records.length) {
        return;
    }

    const allYears = getYears();

    const yearFilter = $("yearFilter");
    const ratioFilter = $("ratioFilter");
    const companyFilter = $("companyFilter");

    const year =
        !yearFilter || yearFilter.value === "latest"
            ? allYears[allYears.length - 1]
            : Number(yearFilter.value);

    const metricKey =
        ratioFilter && METRICS[ratioFilter.value]
            ? ratioFilter.value
            : "currentRatio";

    const companySelection =
        companyFilter?.value || "both";

    const companies =
        companySelection === "both"
            ? ["MSFT", "AAPL"]
            : [companySelection];

    const percentage =
        METRICS[metricKey].type === "percent";

    updateCompany("MSFT", year, metricKey);
    updateCompany("AAPL", year, metricKey);

    updateSummaryCards(year);

    if ($("msftPanel")) {
        $("msftPanel").style.opacity =
            companies.includes("MSFT") ? "1" : "0.46";
    }

    if ($("aaplPanel")) {
        $("aaplPanel").style.opacity =
            companies.includes("AAPL") ? "1" : "0.46";
    }

    if ($("trendTitle")) {
        $("trendTitle").textContent =
            METRICS[metricKey].label + " Trend";
    }

    if ($("ratioChartTitle")) {
        $("ratioChartTitle").textContent =
            METRICS[metricKey].label + " by Year";
    }

    if (typeof Chart === "undefined") {
        if ($("status")) {
            $("status").textContent =
                "Financial data loaded, but Chart.js is unavailable.";
        }

        renderDetails(year, companies);
        return;
    }

    createChart("trendChart", {
        type: "line",

        data: {
            labels: allYears,
            datasets: createSeries(
                metricKey,
                percentage,
                companies
            )
        },

        options: chartOptions(
            percentage,
            true
        )
    });

    createChart("ratioChart", {
        type: "bar",

        data: {
            labels: allYears,

            datasets: createSeries(
                metricKey,
                percentage,
                companies
            ).map((series) => ({
                ...series,
                backgroundColor: series.borderColor,
                borderRadius: 4,
                maxBarThickness: 26
            }))
        },

        options: chartOptions(
            percentage,
            true
        )
    });

    renderDetails(year, companies);
}

// ======================================================
// 8. LOAD EXPORTED EXCEL DATA
// ======================================================

async function loadData() {
    const status = $("status");

    try {
        const response = await fetch(
            "data/data.json",
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(
                "Cannot load data/data.json (HTTP " +
                response.status +
                ")"
            );
        }

        const raw = await response.json();

        if (!Array.isArray(raw)) {
            throw new Error(
                "data/data.json must contain an array."
            );
        }

        records = raw.filter((row) => {
            return (
                ["MSFT", "AAPL"].includes(row.company) &&
                Number.isInteger(row.year)
            );
        });

        if (!records.length) {
            throw new Error(
                "No valid Microsoft or Apple records found."
            );
        }

        const allYears = getYears();

        const yearFilter = $("yearFilter");

        if (yearFilter) {
            yearFilter.innerHTML =
                '<option value="latest">Latest available</option>' +
                allYears
                    .slice()
                    .reverse()
                    .map((year) => {
                        return `<option value="${year}">${year}</option>`;
                    })
                    .join("");
        }

        if ($("coverage")) {
            $("coverage").textContent =
                allYears[0] +
                "–" +
                allYears[allYears.length - 1] +
                " · " +
                records.length +
                " company-year records";
        }

        const hasData = records.some((row) => {
            return (
                valid(row.revenue) ||
                valid(row.currentAssets) ||
                valid(row.stockPrice)
            );
        });

        if (status) {
            status.classList.remove("error");

            status.textContent = hasData
                ? "Financial data loaded. Use the filters to explore."
                : "No financial values found. Run export_dashboard_data.py.";
        }

        render();

    } catch (error) {
        console.error("Dashboard error:", error);

        if (status) {
            status.classList.add("error");

            status.textContent =
                "Data loading error: " +
                error.message +
                ". Check your exporter and web server.";
        }
    }
}

// ======================================================
// 9. EVENT LISTENERS
// ======================================================

function initializeEvents() {
    // Only attach listeners to existing elements.
    [
        "yearFilter",
        "ratioFilter",
        "companyFilter"
    ].forEach((id) => {
        const element = $(id);

        if (element) {
            element.addEventListener(
                "change",
                render
            );
        }
    });

    // Reset button is optional.
    const resetButton = $("resetBtn");

    if (resetButton) {
        resetButton.addEventListener("click", () => {
            if ($("yearFilter")) {
                $("yearFilter").value = "latest";
            }

            if ($("ratioFilter")) {
                $("ratioFilter").value = "currentRatio";
            }

            if ($("companyFilter")) {
                $("companyFilter").value = "both";
            }

            render();
        });
    }

    // Financial statement navigation tabs.
    document.querySelectorAll(".tab").forEach((button) => {
        button.addEventListener("click", () => {
            activeTab = button.dataset.tab;

            document.querySelectorAll(".tab").forEach(
                (tab) => {
                    tab.classList.toggle(
                        "active",
                        tab === button
                    );
                }
            );

            render();
        });
    });
}

// ======================================================
// 10. START WEBSITE
// ======================================================

function initializeDashboard() {
    initializeEvents();
    loadData();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard
    );
} else {
    initializeDashboard();
}
