
function formatUSD(value) {
  const numero = Number(value);

  if (!Number.isFinite(numero)) {
    return "—";
  }

  return numero.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const YNK_API = "https://ynk-and-co-exchange.onrender.com";

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
