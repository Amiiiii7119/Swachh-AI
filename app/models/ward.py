from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, Float, DateTime, Index
from sqlalchemy.sql import func
from app.db.base import Base
from datetime import datetime


class Ward(Base):
    __tablename__ = "wards"
    __table_args__ = (
        Index("idx_ward_name", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    points: Mapped[int] = mapped_column(Integer, default=0)

    segregation_score: Mapped[float] = mapped_column(Float, default=0.0)

    collection_efficiency: Mapped[float] = mapped_column(Float, default=0.0)

    optimization_score: Mapped[float] = mapped_column(Float, default=0.0)

    participation_score: Mapped[float] = mapped_column(Float, default=0.0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )