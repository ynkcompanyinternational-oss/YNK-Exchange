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
