from app.architecture import cache, denylist, rate_limit
from app.architecture.redis_client import get_redis, reset_redis_for_tests


def test_redis_architecture_adapters_when_available():
    reset_redis_for_tests()
    r = get_redis()
    if not r:
        return  # graceful skip without failing CI when Redis is down
    key = cache.catalog_key("two_step", "flex")
    cache.set_json(key, [{"id": "1"}], ttl=10)
    assert cache.get_json(key) == [{"id": "1"}]
    cache.invalidate_catalog()
    assert cache.get_json(key) is None

    assert rate_limit.allow_login_attempt("pytest-ip") is True
    denylist.revoke("token-sample", None)
    assert denylist.is_revoked("token-sample") is True
