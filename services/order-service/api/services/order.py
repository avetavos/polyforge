from typing import Optional
import logging
from sqlalchemy.orm import Session
from models.order import Order as OrderPayload
from schemas.order import Order as OrderDB, OrderStatus
from schemas.order_item import OrderItem as OrderItemDB

logger = logging.getLogger(__name__)

def create_order(order: OrderPayload, user_id: str, db: Session) -> OrderDB:
    try:
        db_order = OrderDB(
            status=OrderStatus.PENDING,
            customer_id=user_id
        )
        db.add(db_order)
        db.flush()
        
        items = []
        
        for item in order.items:
            db_order_item = OrderItemDB(
                order_id=db_order.id,
                sku=item.sku,
                qty=item.qty
            )
            db.add(db_order_item)
            items.append(db_order_item)
        
        db.commit()
        db.refresh(db_order)
        
        return db_order
        
    except Exception as e:
        logger.error(f"Error creating order for user {user_id}: {str(e)}")
        db.rollback()
        raise e

def get_order_by_id(order_id: str, user_id: Optional[str], db: Session) -> Optional[OrderDB]:
    try:
        if user_id:
            order = db.query(OrderDB).filter(OrderDB.id == order_id, OrderDB.customer_id == user_id).first()
            
            if order:
                order.items = db.query(OrderItemDB).filter(OrderItemDB.order_id == order.id).all()
            else:
                return None
            
            return order
        
        else:
            order = db.query(OrderDB).filter(OrderDB.id == order_id).first()
            
            if order:
                order.items = db.query(OrderItemDB).filter(OrderItemDB.order_id == order.id).all()
            else:
                return None
            
            return order

    except Exception as e:
        logger.error(f"Error getting order {order_id} for user {user_id}: {str(e)}")
        raise e

def get_all_orders(user_id: Optional[str], db: Session) -> list[OrderDB]:
    try:
        if user_id:
            orders = db.query(OrderDB).filter(OrderDB.customer_id == user_id).all()
            
            for order in orders:
                order.items = db.query(OrderItemDB).filter(OrderItemDB.order_id == order.id).all()
            
            return orders
        
        else:
            orders = db.query(OrderDB).all()
            
            for order in orders:
                order.items = db.query(OrderItemDB).filter(OrderItemDB.order_id == order.id).all()
            
            return orders
    except Exception as e:
        logger.error(f"Error getting all orders for user {user_id}: {str(e)}")
        raise e

def cancel_order(order_id: str, user_id: str, db: Session) -> Optional[OrderDB]:
    try:
        order = db.query(OrderDB).filter(
            OrderDB.id == order_id, 
            OrderDB.customer_id == user_id,
            OrderDB.status == OrderStatus.PENDING
        ).first()
        
        if order:
            order.status = OrderStatus.CANCELLED # type: ignore
            db.commit()
            db.refresh(order)
            
            order.items = db.query(OrderItemDB).filter(OrderItemDB.order_id == order.id).all()
            
            return order
        
        else:
            raise ValueError("Order not found or cannot be cancelled")
        
    except Exception as e:
        logger.error(f"Error cancelling order {order_id} for user {user_id}: {str(e)}")
        db.rollback()
        raise e