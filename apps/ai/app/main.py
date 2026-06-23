from fastapi import FastAPI

from app.config import get_settings
from app.health import health_payload


settings = get_settings()

app = FastAPI(title=settings.app_name)


@app.get("/health")
def health() -> dict[str, str]:
    return health_payload()


if __name__ == "__main__":
    print(health())
