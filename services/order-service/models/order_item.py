from pydantic import BaseModel, ConfigDict


class OrderItem(BaseModel):
    sku: str
    qty: int


class CreatedOrderItemResponse(OrderItem):
    model_config = ConfigDict(from_attributes=True)

    id: str
