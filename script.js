document.getElementById("year").textContent = new Date().getFullYear();

const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
toggle?.addEventListener("click", () => {
  const open = nav.style.display === "flex";
  nav.style.display = open ? "" : "flex";
  nav.style.flexDirection = "column";
  nav.style.position = "absolute";
  nav.style.top = "70px";
  nav.style.left = "20px";
  nav.style.right = "20px";
  nav.style.padding = "18px";
  nav.style.background = "rgba(4,8,13,.98)";
  nav.style.border = "1px solid rgba(183,154,89,.25)";
});

document.getElementById("asset-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const asset = document.getElementById("asset").value;
  const amount = document.getElementById("amount").value;
  const status = document.getElementById("form-status");
  status.hidden = false;
  status.textContent =
    `Request received for ${amount} ${asset}. This demo does not process payments or transfer assets. ` +
    `In production, the request will be routed to the responsible operations workflow after the required checks.`;
});

/* YNK Exchange — Live blockchain portfolio */
const YNK_API = "https://ynk-and-co-exchange.onrender.com";

function formatUSD(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatAmount(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6
  }).format(Number(value || 0));
}

async function loadYNKPortfolio() {
  const status = document.getElementById("portfolio-status");
  const connection = document.getElementById("portfolio-connection");

  try {
    const [portfolioResponse, ethResponse] = await Promise.all([
      fetch(`${YNK_API}/wallet/ethereum/approved-portfolio`),
      fetch(`${YNK_API}/wallet/ethereum`)
    ]);

    if (!portfolioResponse.ok) {
      throw new Error("Portfolio API unavailable");
    }

    const portfolio = await portfolioResponse.json();
    const eth = ethResponse.ok ? await ethResponse.json() : null;

    const assets = portfolio.assets || [];

    const total = assets.reduce(
      (sum, asset) => sum + Number(asset.value_usd || 0),
      0
    );

    document.getElementById("portfolio-total").textContent =
      formatUSD(total);

    document.getElementById("portfolio-asset-count").textContent =
      portfolio.asset_count ?? assets.length;

    document.getElementById("portfolio-eth-balance").textContent =
      eth?.balance_eth !== undefined
        ? `${formatAmount(eth.balance_eth)} ETH`
        : "Unavailable";

    connection.textContent =
      portfolio.connected ? "LIVE" : "OFFLINE";

    const table = document.getElementById("portfolio-table-body");
    table.innerHTML = "";

    assets.forEach((asset) => {
      const allocation =
        total > 0
          ? (Number(asset.value_usd || 0) / total) * 100
          : 0;

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${asset.symbol}</td>
        <td>${formatAmount(asset.balance)}</td>
        <td>${formatUSD(asset.price_usd)}</td>
        <td>${formatUSD(asset.value_usd)}</td>
        <td>${allocation.toFixed(2)}%</td>
      `;

      table.appendChild(row);
    });

    const chart = document.getElementById("portfolio-chart");
    chart.innerHTML = "";

    const maxValue = Math.max(
      ...assets.map(asset => Number(asset.value_usd || 0)),
      1
    );

    assets.forEach((asset) => {
      const value = Number(asset.value_usd || 0);
      const allocation = total > 0 ? (value / total) * 100 : 0;
      const width = (value / maxValue) * 100;

      const item = document.createElement("div");
      item.className = "portfolio-bar-item";

      item.innerHTML = `
        <div class="portfolio-bar-head">
          <strong>${asset.symbol}</strong>
          <span>${formatUSD(value)} · ${allocation.toFixed(2)}%</span>
        </div>
        <div class="portfolio-bar-track">
          <div class="portfolio-bar-fill" style="width:${width}%"></div>
        </div>
        <small>Quantity: ${formatAmount(asset.balance)}</small>
      `;

      chart.appendChild(item);
    });

    status.textContent =
      "Live blockchain data · Ethereum Mainnet · Read Only · Market values are indicative.";

  } catch (error) {
    connection.textContent = "ERROR";

    status.textContent =
      "Unable to load live portfolio data.";

    console.error("YNK Portfolio Error:", error);
  }
}

loadYNKPortfolio();

async function loadMarketCandles() {
  const container = document.getElementById("market-candlestick-chart");
  if (!container) return;

  try {
    const response = await fetch(`${YNK_API}/market/candles`);
    if (!response.ok) throw new Error("Market API unavailable");

    const data = await response.json();
    const candles = data.candles || [];

    if (!data.connected || !candles.length) {
      throw new Error(data.error || "No candle data");
    }

    const width = 1000;
    const height = 360;
    const pad = 28;

    const highs = candles.map(c => Number(c.high));
    const lows = candles.map(c => Number(c.low));

    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const range = Math.max(maxPrice - minPrice, 1);

    const xStep = (width - pad * 2) / candles.length;
    const candleWidth = Math.max(2, xStep * 0.55);

    const priceToY = (price) =>
      pad + ((maxPrice - price) / range) * (height - pad * 2);

    const svgCandles = candles.map((c, i) => {
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);

      const x = pad + i * xStep + xStep / 2;
      const yHigh = priceToY(high);
      const yLow = priceToY(low);
      const yOpen = priceToY(open);
      const yClose = priceToY(close);

      const rising = close >= open;
      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
      const color = rising ? "#39c58a" : "#e15b64";

      return `
        <line
          x1="${x}" y1="${yHigh}"
          x2="${x}" y2="${yLow}"
          stroke="${color}"
          stroke-width="1.2"
        />
        <rect
          x="${x - candleWidth / 2}"
          y="${bodyY}"
          width="${candleWidth}"
          height="${bodyH}"
          fill="${color}"
          rx="1"
        />
      `;
    }).join("");

    const latest = candles[candles.length - 1];

    container.innerHTML = `
      <div class="market-chart-meta">
        <span>Open: ${formatUSD(latest.open)}</span>
        <span>High: ${formatUSD(latest.high)}</span>
        <span>Low: ${formatUSD(latest.low)}</span>
        <span>Close: ${formatUSD(latest.close)}</span>
      </div>

      <svg
        viewBox="0 0 ${width} ${height}"
        preserveAspectRatio="none"
        class="market-candle-svg"
        role="img"
        aria-label="WBETH USDT one hour candlestick chart"
      >
        ${svgCandles}
      </svg>
    `;
  } catch (error) {
    container.textContent = "Unable to load live market candles.";
    console.error("YNK Market Candle Error:", error);
  }
}

loadMarketCandles();
