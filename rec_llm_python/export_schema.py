"""RecLLM Python — OpenAPI Schema Export

Generates and saves the OpenAPI schema for documentation and client generation.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.core.job_queue import JobQueue
from app.api import create_app


def export_schema():
    """Export the OpenAPI schema to a JSON file."""
    queue = JobQueue(max_concurrency=1)
    app = create_app(queue)

    schema = app.openapi()
    output_path = Path(__file__).parent / "docs" / "openapi.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

    print(f"OpenAPI schema exported to: {output_path}")
    print(f"Endpoints: {len(schema.get('paths', {}))}")
    print(f"Version: {schema.get('info', {}).get('version', 'unknown')}")


if __name__ == "__main__":
    export_schema()
