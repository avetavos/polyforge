from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.deps import UserContext, get_current_user, get_db
from api.services.orders import cancel_order, create_order, get_order, list_orders
from models.order import CreatedOrderResponse, Order
from models.response import BaseResponseModel

router = APIRouter()


@router.get("", response_model=BaseResponseModel[list[CreatedOrderResponse]])
def list_orders_handler(
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orders = list_orders(user.scoped_customer_id, db)
    return BaseResponseModel(
        message="Orders fetched successfully",
        data=[CreatedOrderResponse.model_validate(order) for order in orders],
    )


@router.get("/{order_id}", response_model=BaseResponseModel[CreatedOrderResponse])
def get_order_handler(
    order_id: str,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = get_order(order_id, user.scoped_customer_id, db)
    return BaseResponseModel(
        message=f"Order {order_id} fetched successfully",
        data=CreatedOrderResponse.model_validate(order),
    )


@router.post(
    "",
    response_model=BaseResponseModel[CreatedOrderResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_order_handler(
    payload: Order,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = create_order(payload, user.user_id, db)
    return BaseResponseModel(
        message="Order created successfully",
        data=CreatedOrderResponse.model_validate(order),
    )


@router.patch("/{order_id}", response_model=BaseResponseModel[CreatedOrderResponse])
def cancel_order_handler(
    order_id: str,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = cancel_order(order_id, user.user_id, db)
    return BaseResponseModel(
        message=f"Order {order_id} cancelled successfully",
        data=CreatedOrderResponse.model_validate(order),
    )
