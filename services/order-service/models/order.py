from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from .order_item import CreatedOrderItemResponse, OrderItem

class Order(BaseModel):
    items : list[OrderItem]
    
class OrderCreate(Order):
    pass

class CreatedOrderResponse(Order):
    id: str
    status: str
    items: list[CreatedOrderItemResponse] # type: ignore
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

