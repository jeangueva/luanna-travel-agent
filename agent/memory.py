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
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./luanna.db")

# Strip async drivers since this module uses sync SQLAlchemy
DATABASE_URL = DATABASE_URL.replace("+aiosqlite", "").replace("+asyncpg", "")

# Create engine
if "sqlite" in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(DATABASE_URL)

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
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
    print("✓ Database initialized")


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
