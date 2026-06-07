class OrderError(Exception):
    """Base class for order domain errors."""


class OrderNotFoundError(OrderError):
    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        super().__init__(f"Order {order_id} not found")


class OrderNotCancellableError(OrderError):
    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        super().__init__(f"Order {order_id} not found or cannot be cancelled")
