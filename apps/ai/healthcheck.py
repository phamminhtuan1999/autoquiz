import json

from app.health import health_payload


if __name__ == "__main__":
    print(json.dumps(health_payload()))
