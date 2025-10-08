from pydantic import BaseModel

class OrderItem(BaseModel):
    sku: str
    qty: int

class CreatedOrderItemResponse(OrderItem):
    id: str
    class Config:
        from_attributes = True