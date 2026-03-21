from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, Float, ForeignKey, DateTime, Index
from sqlalchemy.sql import func
from app.db.base import Base
from datetime import datetime


class Bin(Base):
    __tablename__ = "bins"
    __table_args__ = (
        Index("idx_bin_ward_id", "ward_id"),
        Index("idx_bin_last_updated", "last_updated"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    ward_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("wards.id"),
        nullable=False,
        index=True
    )

    fill_level: Mapped[float] = mapped_column(Float, default=0.0)

    waste_type: Mapped[str | None] = mapped_column(String, nullable=True)

    allowed_waste_type: Mapped[str] = mapped_column(String, nullable=False)

    latitude: Mapped[float] = mapped_column(Float, nullable=False)

    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )