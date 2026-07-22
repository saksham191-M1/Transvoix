import pytest
from datetime import timedelta
from engine.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token

def test_password_hashing():
    plain = "SecureP@ss1"
    hashed = hash_password(plain)
    
    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("wrong_pass", hashed) is False

def test_jwt_access_token_creation():
    user_id = "test-user-id-123"
    token = create_access_token(subject=user_id)
    
    assert isinstance(token, str)
    
    payload = decode_token(token)
    assert payload is not None
    assert payload.get("sub") == user_id
    assert payload.get("type") == "access"

def test_jwt_refresh_token_creation():
    user_id = "test-user-id-123"
    token = create_refresh_token(subject=user_id)
    
    assert isinstance(token, str)
    
    payload = decode_token(token)
    assert payload is not None
    assert payload.get("sub") == user_id
    assert payload.get("type") == "refresh"

def test_invalid_token_handling():
    assert decode_token("invalid.token.string") is None
