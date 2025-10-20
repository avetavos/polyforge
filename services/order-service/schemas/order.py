from sqlalchemy import Column, String
from db.session import Base
import uuid
from enum import Enum
from sqlalchemy import Column, String, Enum as SQLEnum
from sqlalchemy import DateTime
from datetime import datetime, timezone
from sqlalchemy.orm import relationship

class OrderStatus(Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"

class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, index=True, nullable=False)
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PENDING)
    created_at = Column(DateTime, default=datetime.now(tz=timezone.utc))
    updated_at = Column(DateTime, onupdate=datetime.now(tz=timezone.utc))
    
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")