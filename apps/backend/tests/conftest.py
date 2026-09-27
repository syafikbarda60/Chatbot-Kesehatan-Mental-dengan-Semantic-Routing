# tests/conftest.py
# Pytest configuration

import sys
import os

# Add backend root to path
backend_root = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_root)

# Set test environment variables
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("ENCRYPTION_KEY", "test-key-32-chars-long-enough!!")


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow"
    )