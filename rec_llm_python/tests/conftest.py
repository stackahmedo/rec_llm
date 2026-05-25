"""Pytest configuration — ensure test isolation for database singleton."""

import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent.parent))


def pytest_collection_modifyitems(items):
    """Run test_api.py tests last to avoid DB singleton conflicts."""
    api_tests = []
    other_tests = []
    for item in items:
        if "test_api" in item.nodeid:
            api_tests.append(item)
        else:
            other_tests.append(item)
    items[:] = other_tests + api_tests
