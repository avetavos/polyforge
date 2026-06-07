from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from .order_item import CreatedOrderItemResponse, OrderItem


class Order(BaseModel):
    items: list[OrderItem]


class CreatedOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    items: list[CreatedOrderItemResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None
