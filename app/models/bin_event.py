from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, Float, String, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.db.base import Base
from datetime import datetime


class BinEvent(Base):
    __tablename__ = "bin_events"
    __table_args__ = (
        Index("idx_event_bin_id", "bin_id"),
        Index("idx_event_timestamp", "timestamp"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    bin_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("bins.id"),
        nullable=False,
        index=True
    )

    fill_level: Mapped[float] = mapped_column(Float, nullable=False)

    waste_type: Mapped[str | None] = mapped_column(String, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )