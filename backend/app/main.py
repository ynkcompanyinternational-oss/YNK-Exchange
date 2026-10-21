import os
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="YNK & Co. Exchange API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ynkcompanyinternational-oss.github.io",
        "https://ynk.exchange",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081"
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)



@app.get("/")
def home():
    return {
        "status": "online",
        "service": "YNK & Co. Exchange API"
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/etherscan/status")
def etherscan_status():
    api_key = os.getenv("ETHERSCAN_API_KEY")

    return {
        "etherscan": "configured" if api_key else "not_configured"
    }


@app.get("/etherscan/test")
def etherscan_test():
    api_key = os.getenv("ETHERSCAN_API_KEY")

    if not api_key:
        return {"connected": False, "error": "API key not configured"}

    try:
        response = requests.get(
            "https://api.etherscan.io/v2/api",
            params={
                "chainid": "1",
                "module": "proxy",
                "action": "eth_blockNumber",
                "apikey": api_key
            },
            timeout=15
        )

        data = response.json()
        result = data.get("result")

        if isinstance(result, str) and result.startswith("0x"):
            return {
                "connected": True,
                "network": "Ethereum Mainnet",
                "latest_block": int(result, 16)
            }

        return {
            "connected": False,
            "response": data
        }

    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }


@app.get("/wallet/ethereum")
def ethereum_wallet():
    wallet = os.getenv("ETH_WALLET_ADDRESS")
    rpc_url = os.getenv(
        "ETH_RPC_URL",
        "https://ethereum-rpc.publicnode.com"
    )

    if not wallet:
        return {
            "connected": False,
            "mode": "READ_ONLY",
            "error": "Wallet address not configured"
        }

    try:
        response = requests.post(
            rpc_url,
            json={
                "jsonrpc": "2.0",
                "method": "eth_getBalance",
                "params": [wallet, "latest"],
                "id": 1
            },
            timeout=15
        )

        data = response.json()

        if "result" not in data:
            return {
                "connected": False,
                "mode": "READ_ONLY",
                "error": "Blockchain RPC error"
            }

        balance_wei = int(data["result"], 16)
        balance_eth = balance_wei / 10**18

        return {
            "connected": True,
            "network": "Ethereum Mainnet",
            "mode": "READ_ONLY",
            "balance_eth": balance_eth
        }

    except Exception as e:
        return {
            "connected": False,
            "mode": "READ_ONLY",
            "error": str(e)
        }


@app.get("/wallet/ethereum/assets")
def ethereum_assets():
    wallet = os.getenv("ETH_WALLET_ADDRESS")

    if not wallet:
        return {
            "connected": False,
            "mode": "READ_ONLY",
            "error": "Wallet address not configured"
        }

    try:
        response = requests.get(
            f"https://eth.blockscout.com/api/v2/addresses/{wallet}/token-balances",
            timeout=20
        )
        response.raise_for_status()
        data = response.json()

        assets = []

        for item in data:
            token = item.get("token") or {}

            if token.get("type") != "ERC-20":
                continue

            decimals = int(token.get("decimals") or 0)
            raw_value = int(item.get("value") or 0)

            balance = (
                raw_value / (10 ** decimals)
                if decimals >= 0 else raw_value
            )

            exchange_rate = token.get("exchange_rate")
            price_usd = float(exchange_rate) if exchange_rate else None

            assets.append({
                "symbol": token.get("symbol"),
                "name": token.get("name"),
                "contract_address": token.get("address_hash"),
                "balance": balance,
                "price_usd": price_usd,
                "value_usd": balance * price_usd if price_usd else None
            })

        return {
            "connected": True,
            "network": "Ethereum Mainnet",
            "mode": "READ_ONLY",
            "asset_count": len(assets),
            "assets": assets
        }

    except Exception as e:
        return {
            "connected": False,
            "mode": "READ_ONLY",
            "error": str(e)
        }


@app.get("/wallet/ethereum/portfolio")
def ethereum_portfolio():
    raw = ethereum_assets()

    if not raw.get("connected"):
        return raw

    filtered = []

    for asset in raw.get("assets", []):
        value_usd = asset.get("value_usd")

        if value_usd is None:
            continue

        if value_usd < 100:
            continue

        filtered.append(asset)

    filtered.sort(
        key=lambda item: item.get("value_usd") or 0,
        reverse=True
    )

    return {
        "connected": True,
        "network": "Ethereum Mainnet",
        "mode": "READ_ONLY",
        "valuation": "INDICATIVE",
        "asset_count": len(filtered[:100]),
        "assets": filtered[:100],
        "note": "Filtered view. Token prices and valuations must be verified before being treated as portfolio value."
    }


@app.get("/wallet/ethereum/approved-portfolio")
def ethereum_approved_portfolio():
    raw = ethereum_assets()

    if not raw.get("connected"):
        return raw

    approved_contracts = {
        "0xa2e3356610840701bdf5611a53974510ae27e2e1",  # WBETH
        "0xdac17f958d2ee523a2206206994597c13d831ec7",  # USDT
        "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d",  # USD1
        "0x514910771af9ca656af840dff83e8264ecf986ca",  # LINK
        "0x45804880de22913dafe09f4980848ece6ecbaf78",  # PAXG
        "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",  # UNI
        "0x57e114b691db790c35207b2e685d4a43181e6061",  # ENA
        "0xd533a949740bb3306d119cc777fa900ba034cd52",  # CRV
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",  # WBTC
        "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9"   # AAVE
    }

    approved = []

    for asset in raw.get("assets", []):
        contract = (asset.get("contract_address") or "").lower()

        if contract in approved_contracts:
            approved.append({
                "symbol": asset.get("symbol"),
                "name": asset.get("name"),
                "balance": asset.get("balance"),
                "price_usd": asset.get("price_usd"),
                "value_usd": asset.get("value_usd")
            })

    approved.sort(
        key=lambda item: item.get("value_usd") or 0,
        reverse=True
    )

    return {
        "connected": True,
        "network": "Ethereum Mainnet",
        "mode": "READ_ONLY",
        "portfolio_type": "APPROVED_CONTRACTS",
        "asset_count": len(approved),
        "assets": approved
    }

@app.get("/market/candles")
def market_candles():
    try:
        response = requests.get(
            "https://data-api.binance.vision/api/v3/klines",
            params={
                "symbol": "WBETHUSDT",
                "interval": "1h",
                "limit": 100
            },
            timeout=15
        )

        response.raise_for_status()
        data = response.json()

        candles = []

        for item in data:
            candles.append({
                "time": item[0],
                "open": float(item[1]),
                "high": float(item[2]),
                "low": float(item[3]),
                "close": float(item[4]),
                "volume": float(item[5])
            })

        return {
            "connected": True,
            "source": "Binance Spot",
            "symbol": "WBETHUSDT",
            "interval": "1h",
            "candles": candles
        }

    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }

@app.get("/wallet/ethereum/transactions")
def ethereum_transactions():
    import time

    wallet = os.getenv("ETH_WALLET_ADDRESS")
    if not wallet:
        return {"connected": False, "mode": "READ_ONLY",
                "error": "Wallet not configured"}

    now = time.monotonic()
    cache = getattr(ethereum_transactions, "_cache", {})

    if cache.get("wallet") == wallet and now - cache.get("time", 0) < 600:
        return cache["result"]

    url = f"https://eth.blockscout.com/api/v2/addresses/{wallet}/transactions"
    params = {}
    received = sent = pages = 0
    seen = set()
    complete = False
    deadline = now + 20

    try:
        while pages < 120 and time.monotonic() < deadline:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break

            response = requests.get(
                url, params=params,
                timeout=(5, max(1, remaining))
            )
            response.raise_for_status()
            data = response.json()
            pages += 1

            for tx in data.get("items", []):
                tx_hash = tx.get("hash")
                if not tx_hash or tx_hash in seen:
                    continue
                seen.add(tx_hash)

                if tx.get("status") != "ok":
                    continue

                sender = ((tx.get("from") or {}).get("hash") or "").lower()
                receiver = ((tx.get("to") or {}).get("hash") or "").lower()

                if receiver == wallet.lower():
                    received += 1
                if sender == wallet.lower():
                    sent += 1

            params = data.get("next_page_params")
            if not params:
                complete = True
                break

        result = {
            "connected": True,
            "network": "Ethereum Mainnet",
            "mode": "READ_ONLY",
            "received": received,
            "sent": sent,
            "transaction_count": len(seen),
            "pages_scanned": pages,
            "history_complete": complete
        }

        if pages:
            ethereum_transactions._cache = {
                "wallet": wallet,
                "time": time.monotonic(),
                "result": result
            }

        return result

    except requests.RequestException:
        return {"connected": False, "mode": "READ_ONLY",
                "error": "Transaction history unavailable"}


@app.get("/token-terminal/projects")
def token_terminal_projects():
    key = os.getenv("TOKEN_TERMINAL_API_KEY")

    if not key:
        return {"connected": False, "error": "API key not configured"}

    try:
        response = requests.get(
            "https://api.tokenterminal.com/v2/projects",
            headers={
                "Authorization": f"Bearer {key}",
                "Accept": "application/json"
            },
            timeout=20
        )

        if response.status_code != 200:
            return {
                "connected": False,
                "status_code": response.status_code
            }

        return {
            "connected": True,
            "source": "Token Terminal",
            "data": response.json()
        }

    except requests.RequestException:
        return {
            "connected": False,
            "error": "Token Terminal unavailable"
        }


@app.get("/market/coingecko")
def coingecko_prices():
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={
                "ids": "bitcoin,ethereum",
                "vs_currencies": "usd",
                "include_last_updated_at": "true"
            },
            timeout=20
        )
        r.raise_for_status()
        return {
            "connected": True,
            "source": "CoinGecko",
            "prices": r.json()
        }
    except requests.RequestException:
        return {
            "connected": False,
            "source": "CoinGecko",
            "error": "Market data unavailable"
        }

@app.get("/market/coinmarketcap")
def coinmarketcap_prices():
    try:
        r = requests.get(
            "https://pro-api.coinmarketcap.com/public-api/v2/simple/price",
            params={
                "id": "1,1027",
                "convert": "USD",
                "include_all": "true"
            },
            headers={"Accept": "application/json"},
            timeout=20
        )

        r.raise_for_status()
        data = r.json()

        status = data.get("status", {})
        if str(status.get("error_code", 0)) != "0":
            return {
                "connected": False,
                "source": "CoinMarketCap",
                "error": "Provider returned error"
            }

        prices = {}

        for asset in data.get("data", []):
            for quote in asset.get("quotes", []):
                if quote.get("symbol") == "USD":
                    prices[asset["slug"]] = {
                        "usd": quote.get("price"),
                        "change_24h": quote.get("percent_change_24h"),
                        "updated_at": quote.get("last_updated")
                    }

        return {
            "connected": bool(prices),
            "source": "CoinMarketCap",
            "prices": prices
        }

    except (requests.RequestException, ValueError, TypeError, KeyError):
        return {
            "connected": False,
            "source": "CoinMarketCap",
            "error": "Market data unavailable"
        }
