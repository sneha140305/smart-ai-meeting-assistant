from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey
)

from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(150),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    meetings = relationship(
        "Meeting",
        back_populates="owner",
        cascade="all, delete-orphan"
    )


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    title = Column(
        String(200),
        nullable=False
    )

    file_name = Column(
        String(255),
        nullable=False
    )

    file_path = Column(
        String(500),
        nullable=False
    )

    audio_path = Column(
        String(500),
        nullable=True
    )

    duration = Column(
        Integer,
        nullable=True
    )

    status = Column(
        String(50),
        default="uploaded"
    )

    summary = Column(
        Text,
        nullable=True
    )

    key_points = Column(
        Text,
        nullable=True
    )

    decisions = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="meetings"
    )

    transcript = relationship(
        "Transcript",
        back_populates="meeting",
        uselist=False,
        cascade="all, delete-orphan"
    )

    action_items = relationship(
        "ActionItem",
        back_populates="meeting",
        cascade="all, delete-orphan"
    )

    total_words = Column(
        Integer,
        default=0
    )

    speaker_count = Column(
        Integer,
        default=0
    )

    positive_sentiment = Column(
        Integer,
        default=0
    )

    negative_sentiment = Column(
        Integer,
        default=0
    )

    neutral_sentiment = Column(
        Integer,
        default=0
    )

    speaker_analytics = relationship(
        "SpeakerAnalytics",
        back_populates="meeting",
        cascade="all, delete-orphan"
    )

    effectiveness_score = Column(
        Integer,
        nullable=True
    )
    effectiveness_rating = Column(
        String,
        nullable=True
    )

    meeting_insights = Column(Text, nullable=True)
    meeting_recommendations = Column(
        Text,
        nullable=True
    )


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    content = Column(
        Text,
        nullable=False
    )

    language = Column(
        String(20),
        nullable=True
    )

    segments = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    meeting_id = Column(
        Integer,
        ForeignKey("meetings.id"),
        unique=True,
        nullable=False
    )

    meeting = relationship(
        "Meeting",
        back_populates="transcript"
    )


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    task = Column(
        Text,
        nullable=False
    )

    assigned_to = Column(
        String(100),
        nullable=True
    )

    deadline = Column(
        String(100),
        nullable=True
    )

    status = Column(
        String(50),
        default="pending"
    )

    meeting_id = Column(
        Integer,
        ForeignKey("meetings.id"),
        nullable=False
    )

    meeting = relationship(
        "Meeting",
        back_populates="action_items"
    )

    priority = Column(
    String,
    default="medium",
    nullable=False
    )


class SpeakerAnalytics(Base):
    __tablename__ = "speaker_analytics"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    speaker = Column(
        String(100),
        nullable=False
    )

    speaking_time = Column(
        Integer,
        default=0
    )

    word_count = Column(
        Integer,
        default=0
    )

    meeting_id = Column(
        Integer,
        ForeignKey("meetings.id"),
        nullable=False
    )

    meeting = relationship(
        "Meeting",
        back_populates="speaker_analytics"
    )
