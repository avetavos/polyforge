import uuid
from sqlalchemy import Column, ForeignKey, Integer, String
from db.session import Base
from sqlalchemy.orm import relationship


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id"), index=True)
    sku = Column(String, nullable=False, index=True)
    qty = Column(Integer, nullable=False)

    order = relationship("Order", back_populates="items")
