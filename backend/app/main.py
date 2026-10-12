import os
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


@app.get("/etherscan/debug")
def etherscan_debug():
    matches = [
        name for name in os.environ.keys()
        if "ETHERSCAN" in name.upper()
    ]

    return {
        "expected_key_present": "ETHERSCAN_API_KEY" in os.environ,
        "etherscan_variable_names": matches
    }
