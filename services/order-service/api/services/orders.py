import logging
from typing import Optional

from sqlalchemy.orm import Session, selectinload

from core.exceptions import OrderNotCancellableError, OrderNotFoundError
from models.order import Order as OrderPayload
from schemas.order import Order as OrderDB
from schemas.order import OrderStatus
from schemas.order_item import OrderItem as OrderItemDB

logger = logging.getLogger(__name__)


def create_order(payload: OrderPayload, customer_id: str, db: Session) -> OrderDB:
    try:
        order = OrderDB(status=OrderStatus.PENDING, customer_id=customer_id)
        order.items = [OrderItemDB(sku=item.sku, qty=item.qty) for item in payload.items]
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    except Exception:
        db.rollback()
        logger.exception("Error creating order for customer %s", customer_id)
        raise


def get_order(order_id: str, customer_id: Optional[str], db: Session) -> OrderDB:
    query = (
        db.query(OrderDB).options(selectinload(OrderDB.items)).filter(OrderDB.id == order_id)
    )
    if customer_id is not None:
        query = query.filter(OrderDB.customer_id == customer_id)

    order = query.first()
    if order is None:
        raise OrderNotFoundError(order_id)
    return order


def list_orders(customer_id: Optional[str], db: Session) -> list[OrderDB]:
    query = db.query(OrderDB).options(selectinload(OrderDB.items))
    if customer_id is not None:
        query = query.filter(OrderDB.customer_id == customer_id)
    return query.all()


def cancel_order(order_id: str, customer_id: str, db: Session) -> OrderDB:
    try:
        order = (
            db.query(OrderDB)
            .options(selectinload(OrderDB.items))
            .filter(
                OrderDB.id == order_id,
                OrderDB.customer_id == customer_id,
                OrderDB.status == OrderStatus.PENDING,
            )
            .first()
        )
        if order is None:
            raise OrderNotCancellableError(order_id)

        order.status = OrderStatus.CANCELLED
        db.commit()
        db.refresh(order)
        return order
    except OrderNotCancellableError:
        raise
    except Exception:
        db.rollback()
        logger.exception("Error cancelling order %s for customer %s", order_id, customer_id)
        raise
