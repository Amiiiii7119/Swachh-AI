from sqlalchemy import Column, Integer, ForeignKey, Boolean, DateTime, String, Index
from sqlalchemy.sql import func
from app.db.base import Base

class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("idx_alert_bin_id", "bin_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    bin_id = Column(Integer, ForeignKey("bins.id"), nullable=False, index=True)
    message = Column(String)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)