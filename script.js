document.getElementById("year").textContent = new Date().getFullYear();

const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
toggle?.addEventListener("click", () => {
  if (!nav) return;
  const aberto = nav.classList.toggle("ynk-menu-open");
  toggle.setAttribute("aria-expanded", String(aberto));
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
      assets.some(asset => asset.value_usd == null)
        ? `${formatUSD(total)} (parcial)`
        : formatUSD(total);

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

      const networkLabel =
        asset.symbol === "ETH"
          ? "Ethereum"
          : "Ethereum · ERC-20";

      row.innerHTML = `
        <td>${asset.symbol}</td>
        <td>${networkLabel}</td>
        <td>${formatAmount(asset.balance)}</td>
        <td>${asset.price_usd == null ? "Sem cotação" : formatUSD(asset.price_usd)}</td>
        <td>${asset.value_usd == null ? "Sem cotação" : formatUSD(asset.value_usd)}</td>
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


async function loadEthereumTransactions() {
  try {
    const response = await fetch(`${YNK_API}/wallet/ethereum/transactions`);
    const data = await response.json();

    const receivedEl = document.getElementById("received-transfers");
    const sentEl = document.getElementById("sent-transfers");

    if (!data.connected) {
      if (receivedEl) receivedEl.textContent = "—";
      if (sentEl) sentEl.textContent = "—";
      return;
    }

    if (receivedEl) receivedEl.textContent = data.received ?? "—";
    if (sentEl) sentEl.textContent = data.sent ?? "—";
  } catch (error) {
    const receivedEl = document.getElementById("received-transfers");
    const sentEl = document.getElementById("sent-transfers");

    if (receivedEl) receivedEl.textContent = "—";
    if (sentEl) sentEl.textContent = "—";
  }
}

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

    const visible = candles.slice(-70);

    const width = 1100;
    const height = 430;

    const left = 18;
    const right = 76;
    const top = 22;
    const bottom = 58;
    const volumeHeight = 62;

    const chartBottom = height - bottom - volumeHeight;
    const volumeTop = chartBottom + 18;

    const highs = visible.map(c => Number(c.high));
    const lows = visible.map(c => Number(c.low));
    const volumes = visible.map(c => Number(c.volume));

    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const maxVolume = Math.max(...volumes, 1);

    const padding = (maxPrice - minPrice) * 0.07 || 1;
    const priceMax = maxPrice + padding;
    const priceMin = minPrice - padding;
    const range = priceMax - priceMin;

    const plotWidth = width - left - right;
    const xStep = plotWidth / visible.length;
    const candleWidth = Math.max(3, xStep * 0.62);

    const priceToY = price =>
      top + ((priceMax - price) / range) * (chartBottom - top);

    const gridCount = 5;

    const horizontalGrid = Array.from({ length: gridCount + 1 }, (_, i) => {
      const y = top + ((chartBottom - top) / gridCount) * i;
      const price = priceMax - (range / gridCount) * i;

      return `
        <line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"
          stroke="rgba(255,255,255,.055)" stroke-width="1"/>
        <text x="${width-right+10}" y="${y+4}"
          fill="#718197" font-size="11">${price.toFixed(2)}</text>
      `;
    }).join("");

    const verticalGrid = Array.from({ length: 7 }, (_, i) => {
      const x = left + (plotWidth / 6) * i;

      return `
        <line x1="${x}" y1="${top}" x2="${x}" y2="${chartBottom}"
          stroke="rgba(255,255,255,.035)" stroke-width="1"/>
      `;
    }).join("");

    const svgCandles = visible.map((c, i) => {
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);
      const volume = Number(c.volume);

      const x = left + i * xStep + xStep / 2;

      const yHigh = priceToY(high);
      const yLow = priceToY(low);
      const yOpen = priceToY(open);
      const yClose = priceToY(close);

      const rising = close >= open;
      const color = rising ? "#1fc78a" : "#ef5964";

      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(2, Math.abs(yClose - yOpen));

      const volumeH = (volume / maxVolume) * volumeHeight;

      return `
        <line
          x1="${x}" y1="${yHigh}"
          x2="${x}" y2="${yLow}"
          stroke="${color}"
          stroke-width="1.4"
        />

        <rect
          x="${x - candleWidth / 2}"
          y="${bodyY}"
          width="${candleWidth}"
          height="${bodyH}"
          fill="${color}"
          rx="1"
        />

        <rect
          x="${x - candleWidth / 2}"
          y="${volumeTop + volumeHeight - volumeH}"
          width="${candleWidth}"
          height="${volumeH}"
          fill="${color}"
          opacity=".24"
        />
      `;
    }).join("");

    const latest = visible[visible.length - 1];
    const latestClose = Number(latest.close);
    const latestY = priceToY(latestClose);

    const timeLabels = visible.map((c, i) => {
      if (i % 12 !== 0 && i !== visible.length - 1) return "";

      const d = new Date(Number(c.time));
      const label = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      const x = left + i * xStep + xStep / 2;

      return `
        <text x="${x}" y="${height-10}"
          text-anchor="middle"
          fill="#69798e"
          font-size="10">${label}</text>
      `;
    }).join("");

    container.innerHTML = `
      <div class="market-chart-meta">
        <span>O <strong>${formatUSD(latest.open)}</strong></span>
        <span>H <strong>${formatUSD(latest.high)}</strong></span>
        <span>L <strong>${formatUSD(latest.low)}</strong></span>
        <span>C <strong>${formatUSD(latest.close)}</strong></span>
        <span>VOL <strong>${Number(latest.volume).toLocaleString("en-US", {maximumFractionDigits:2})}</strong></span>
      </div>

      <div class="market-chart-price">
        ${formatUSD(latestClose)}
      </div>

      <svg
        viewBox="0 0 ${width} ${height}"
        preserveAspectRatio="none"
        class="market-candle-svg"
        role="img"
        aria-label="WBETH USDT live one hour candlestick chart"
      >
        ${horizontalGrid}
        ${verticalGrid}

        <line
          x1="${left}"
          y1="${latestY}"
          x2="${width-right}"
          y2="${latestY}"
          stroke="#d5c080"
          stroke-width="1"
          stroke-dasharray="5 5"
          opacity=".55"
        />

        ${svgCandles}

        <rect
          x="${width-right+5}"
          y="${latestY-10}"
          width="64"
          height="20"
          rx="4"
          fill="#b99c54"
        />

        <text
          x="${width-right+37}"
          y="${latestY+4}"
          text-anchor="middle"
          fill="#07111d"
          font-size="10"
          font-weight="700"
        >${latestClose.toFixed(2)}</text>

        ${timeLabels}
      </svg>
    `;

  } catch (error) {
    container.textContent = "Unable to load live market candles.";
    console.error("YNK Market Candle Error:", error);
  }
}

loadMarketCandles();

loadEthereumTransactions();

/* YNK Exchange — pesquisa local de ativos */
document.addEventListener('DOMContentLoaded', () => {
  const busca = document.getElementById('ynk-asset-search');
  const tabela = document.getElementById('portfolio-table-body');

  if (!busca || !tabela) return;

  const filtrar = () => {
    const termo = busca.value.trim().toLocaleLowerCase('pt-BR');

    tabela.querySelectorAll('tr').forEach(linha => {
      const conteudo = linha.textContent.toLocaleLowerCase('pt-BR');
      linha.hidden = termo !== '' && !conteudo.includes(termo);
    });
  };

  busca.addEventListener('input', filtrar);

  new MutationObserver(filtrar).observe(tabela, {
    childList: true,
    subtree: true,
    characterData: true
  });
});
