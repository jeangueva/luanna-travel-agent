"""
Database layer using SQLAlchemy.
Handles: users, conversation history, favorite destinations, search history.
"""

import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.pool import StaticPool

# Get database URL from environment
_raw_url = os.getenv("DATABASE_URL", "sqlite:///./luanna.db")

# Force sync drivers (this module uses sync SQLAlchemy)
if "sqlite" in _raw_url.lower():
    DATABASE_URL = "sqlite:///./luanna.db"
elif "postgres" in _raw_url.lower():
    # Railway gives postgresql://, make sure it's sync psycopg2
    DATABASE_URL = _raw_url.replace("postgresql+asyncpg", "postgresql")
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://")
else:
    DATABASE_URL = _raw_url

# Mask password in logs
_log_url = DATABASE_URL
if "@" in _log_url:
    _parts = _log_url.split("@")
    _log_url = _parts[0].split(":")[0] + ":***@" + _parts[1]
print(f"[memory] Using DATABASE_URL: {_log_url}", flush=True)

# Create engine
IS_SQLITE = DATABASE_URL.startswith("sqlite")
if IS_SQLITE:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        module=__import__("sqlite3"),
    )
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Models
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    whatsapp_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversations = relationship("ConversationHistory", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("FavoriteDestination", back_populates="user", cascade="all, delete-orphan")
    searches = relationship("SearchHistory", back_populates="user", cascade="all, delete-orphan")


class ConversationHistory(Base):
    __tablename__ = "conversation_history"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="conversations")


class FavoriteDestination(Base):
    __tablename__ = "favorite_destinations"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    destination = Column(String, nullable=False)
    iata_code = Column(String, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="favorites")


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    origin = Column(String, nullable=True)
    destination = Column(String, nullable=False)
    travel_date = Column(String, nullable=True)
    search_type = Column(String, nullable=False)  # "flight", "hotel", "package"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="searches")


# Initialize database
def init_db():
    """Create all tables. Uses raw drivers to avoid SQLAlchemy dialect issues."""
    if IS_SQLITE:
        _init_sqlite()
    else:
        _init_postgres()


def _init_sqlite():
    """Initialize SQLite using native sqlite3."""
    import sqlite3

    db_path = DATABASE_URL.split("///")[-1]
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            whatsapp_id TEXT UNIQUE NOT NULL,
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_users_whatsapp_id ON users(whatsapp_id);

        CREATE TABLE IF NOT EXISTS conversation_history (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS favorite_destinations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            destination TEXT NOT NULL,
            iata_code TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS search_history (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            origin TEXT,
            destination TEXT NOT NULL,
            travel_date TEXT,
            search_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()
    print(f"[memory] SQLite initialized at {db_path}", flush=True)


def _init_postgres():
    """Initialize PostgreSQL using psycopg2 directly."""
    import psycopg2

    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR PRIMARY KEY,
            whatsapp_id VARCHAR UNIQUE NOT NULL,
            name VARCHAR,
            preferences_token VARCHAR UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_users_whatsapp_id ON users(whatsapp_id);
        CREATE INDEX IF NOT EXISTS ix_users_pref_token ON users(preferences_token);

        CREATE TABLE IF NOT EXISTS conversation_history (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role VARCHAR NOT NULL,
            content TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS favorite_destinations (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            destination VARCHAR NOT NULL,
            iata_code VARCHAR,
            country_code VARCHAR,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS favorite_countries (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            country_name VARCHAR NOT NULL,
            country_code VARCHAR NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            budget VARCHAR,
            travel_styles TEXT,
            origin_city VARCHAR,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS search_history (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            origin VARCHAR,
            destination VARCHAR NOT NULL,
            travel_date VARCHAR,
            search_type VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    cursor.close()
    conn.close()
    print("[memory] PostgreSQL initialized", flush=True)


def get_db_connection():
    """Get raw DB connection (psycopg2 for Postgres, sqlite3 for SQLite)."""
    if IS_SQLITE:
        import sqlite3
        db_path = DATABASE_URL.split("///")[-1]
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    else:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def get_or_create_user_token(whatsapp_id: str) -> tuple:
    """Get or create user with preferences token. Returns (user_id, token)."""
    import secrets
    from uuid import uuid4

    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = "?" if IS_SQLITE else "%s"

    cursor.execute(f"SELECT id, preferences_token FROM users WHERE whatsapp_id = {placeholder}", (whatsapp_id,))
    row = cursor.fetchone()

    if row:
        user_id = row[0] if IS_SQLITE else row["id"]
        token = row[1] if IS_SQLITE else row["preferences_token"]
        if not token:
            token = secrets.token_urlsafe(16)
            cursor.execute(f"UPDATE users SET preferences_token = {placeholder} WHERE id = {placeholder}", (token, user_id))
            conn.commit()
    else:
        user_id = str(uuid4())
        token = secrets.token_urlsafe(16)
        name = f"User_{whatsapp_id[-4:]}"
        cursor.execute(
            f"INSERT INTO users (id, whatsapp_id, name, preferences_token) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})",
            (user_id, whatsapp_id, name, token)
        )
        conn.commit()

    cursor.close()
    conn.close()
    return user_id, token


def get_user_by_token(token: str) -> dict:
    """Find user by preferences token."""
    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = "?" if IS_SQLITE else "%s"

    cursor.execute(f"SELECT id, whatsapp_id, name FROM users WHERE preferences_token = {placeholder}", (token,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return None
    if IS_SQLITE:
        return {"id": row[0], "whatsapp_id": row[1], "name": row[2]}
    return dict(row)


def save_user_preferences(user_id: str, countries: list, cities: list, budget: str = None, styles: list = None, origin: str = None):
    """Replace user's countries, cities and preferences atomically."""
    from uuid import uuid4

    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = "?" if IS_SQLITE else "%s"

    # Clear existing
    cursor.execute(f"DELETE FROM favorite_countries WHERE user_id = {placeholder}", (user_id,))
    cursor.execute(f"DELETE FROM favorite_destinations WHERE user_id = {placeholder}", (user_id,))

    # Insert countries
    for c in countries:
        cursor.execute(
            f"INSERT INTO favorite_countries (id, user_id, country_name, country_code) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})",
            (str(uuid4()), user_id, c["name"], c["code"])
        )

    # Insert cities
    for city in cities:
        cursor.execute(
            f"INSERT INTO favorite_destinations (id, user_id, destination, iata_code, country_code) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})",
            (str(uuid4()), user_id, city["name"], city.get("iata"), city.get("country_code"))
        )

    # Upsert preferences
    styles_str = ",".join(styles) if styles else None
    if IS_SQLITE:
        cursor.execute(
            f"INSERT OR REPLACE INTO user_preferences (user_id, budget, travel_styles, origin_city) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})",
            (user_id, budget, styles_str, origin)
        )
    else:
        cursor.execute("""
            INSERT INTO user_preferences (user_id, budget, travel_styles, origin_city, updated_at)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                budget = EXCLUDED.budget,
                travel_styles = EXCLUDED.travel_styles,
                origin_city = EXCLUDED.origin_city,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, budget, styles_str, origin))

    conn.commit()
    cursor.close()
    conn.close()


def get_user_preferences(user_id: str) -> dict:
    """Get full user preferences (countries, cities, budget, styles)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    placeholder = "?" if IS_SQLITE else "%s"

    cursor.execute(f"SELECT country_name, country_code FROM favorite_countries WHERE user_id = {placeholder}", (user_id,))
    countries = [{"name": r[0] if IS_SQLITE else r["country_name"], "code": r[1] if IS_SQLITE else r["country_code"]} for r in cursor.fetchall()]

    cursor.execute(f"SELECT destination, iata_code, country_code FROM favorite_destinations WHERE user_id = {placeholder}", (user_id,))
    cities = [{"name": r[0] if IS_SQLITE else r["destination"], "iata": r[1] if IS_SQLITE else r["iata_code"], "country_code": r[2] if IS_SQLITE else r["country_code"]} for r in cursor.fetchall()]

    cursor.execute(f"SELECT budget, travel_styles, origin_city FROM user_preferences WHERE user_id = {placeholder}", (user_id,))
    row = cursor.fetchone()
    budget = None
    styles = []
    origin = None
    if row:
        if IS_SQLITE:
            budget, styles_str, origin = row[0], row[1], row[2]
        else:
            budget, styles_str, origin = row["budget"], row["travel_styles"], row["origin_city"]
        styles = styles_str.split(",") if styles_str else []

    cursor.close()
    conn.close()

    return {"countries": countries, "cities": cities, "budget": budget, "styles": styles, "origin": origin}


# Utility functions
def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def find_or_create_user(whatsapp_id: str, name: str = None) -> User:
    """Find user by WhatsApp ID or create if not exists."""
    from uuid import uuid4

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.whatsapp_id == whatsapp_id).first()
        if user:
            return user

        user = User(
            id=str(uuid4()),
            whatsapp_id=whatsapp_id,
            name=name or f"User_{whatsapp_id[-4:]}",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def get_conversation_history(user_id: str, limit: int = 10) -> list:
    """Get last N messages from conversation history."""
    db = SessionLocal()
    try:
        conversations = (
            db.query(ConversationHistory)
            .filter(ConversationHistory.user_id == user_id)
            .order_by(ConversationHistory.timestamp.desc())
            .limit(limit)
            .all()
        )
        return list(reversed(conversations))
    finally:
        db.close()


def save_conversation(user_id: str, role: str, content: str) -> ConversationHistory:
    """Save a message to conversation history."""
    from uuid import uuid4

    db = SessionLocal()
    try:
        conversation = ConversationHistory(
            id=str(uuid4()),
            user_id=user_id,
            role=role,
            content=content,
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        return conversation
    finally:
        db.close()


def get_favorite_destinations(user_id: str) -> list:
    """Get all favorite destinations for a user."""
    db = SessionLocal()
    try:
        favorites = (
            db.query(FavoriteDestination)
            .filter(FavoriteDestination.user_id == user_id)
            .order_by(FavoriteDestination.added_at.desc())
            .all()
        )
        return favorites
    finally:
        db.close()


def save_favorite_destination(user_id: str, destination: str, iata_code: str = None) -> FavoriteDestination:
    """Save a favorite destination for a user."""
    from uuid import uuid4

    db = SessionLocal()
    try:
        favorite = FavoriteDestination(
            id=str(uuid4()),
            user_id=user_id,
            destination=destination,
            iata_code=iata_code,
        )
        db.add(favorite)
        db.commit()
        db.refresh(favorite)
        return favorite
    finally:
        db.close()


def save_search_history(user_id: str, origin: str, destination: str, travel_date: str, search_type: str) -> SearchHistory:
    """Save search to history."""
    from uuid import uuid4

    db = SessionLocal()
    try:
        search = SearchHistory(
            id=str(uuid4()),
            user_id=user_id,
            origin=origin,
            destination=destination,
            travel_date=travel_date,
            search_type=search_type,
        )
        db.add(search)
        db.commit()
        db.refresh(search)
        return search
    finally:
        db.close()
