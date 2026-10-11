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
