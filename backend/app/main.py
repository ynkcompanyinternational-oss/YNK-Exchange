import os
import requests
from fastapi import FastAPI

app = FastAPI(title="YNK & Co. Exchange API")


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
