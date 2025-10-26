from sqlalchemy.orm import Session
from api.deps import get_db
from models.order import Order, CreatedOrderResponse
from fastapi import APIRouter, Depends, HTTPException, Header, status
from api.services.orders import cancel_order, create_order, get_order_by_id, get_all_orders
from models.response import BaseResponseModel
from fastapi.responses import JSONResponse

router = APIRouter()

@router.get("", response_model=BaseResponseModel[list[CreatedOrderResponse]])
def get_all_orders_handler(
    x_user_id: str = Header(),
    x_user_role: str = Header(),
    db: Session = Depends(get_db)
):
    try:
        user_id = None if x_user_role == "administrator" else x_user_id
        data = get_all_orders(user_id, db)
        return BaseResponseModel[list[CreatedOrderResponse]](
            message="Orders fetched successfully",
            data=[CreatedOrderResponse.model_validate(order) for order in data]
        )
    except:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=BaseResponseModel[list[CreatedOrderResponse]](
                message="Internal Server Error",
                data=None,
            ).model_dump()
        )

@router.get("{order_id}", response_model=BaseResponseModel[CreatedOrderResponse])
def get_order_by_id_handler(
    order_id: str,
    x_user_id: str = Header(),
    x_user_role: str = Header(),
    db: Session = Depends(get_db)
):
    try:
        user_id = None if x_user_role == "administrator" else x_user_id
        data = get_order_by_id(order_id, user_id, db)
        
        if data:
            return BaseResponseModel[CreatedOrderResponse](
                message=f"Order {order_id} fetched successfully",
                data=CreatedOrderResponse.model_validate(data)
            )
        
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=BaseResponseModel[CreatedOrderResponse](
                    message=f"Order {order_id} not found",
                    data=None
                ).model_dump()
            )
            
    except HTTPException:
        raise
    except:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=BaseResponseModel[CreatedOrderResponse](
                message="Internal Server Error",
                data=None
            ).model_dump()
        )

@router.post("", response_model=BaseResponseModel[CreatedOrderResponse], status_code=status.HTTP_201_CREATED)
def create_order_handler(
    payload: Order,
    x_user_id: str = Header(),
    db: Session = Depends(get_db)
):
    try:
        data = create_order(payload, x_user_id, db)
        return BaseResponseModel[CreatedOrderResponse](
            message="Order created successfully",
            data=CreatedOrderResponse.model_validate(data)
        )
    except:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=BaseResponseModel[CreatedOrderResponse](
                message="Internal Server Error",
                data=None
            ).model_dump()
        )

@router.patch("{order_id}")
def cancel_order_handler(
    order_id: str,
    x_user_id: str = Header(),
    db: Session = Depends(get_db)
):
    try:
        data = cancel_order(order_id, x_user_id, db)
        return BaseResponseModel[CreatedOrderResponse](
            message=f"Order {order_id} cancelled successfully",
            data=CreatedOrderResponse.model_validate(data) if data else None
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=BaseResponseModel[CreatedOrderResponse](
                message=str(ve),
                data=None
            ).model_dump()
        )
    except:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=BaseResponseModel[CreatedOrderResponse](
                message="Internal Server Error",
                data=None
            ).model_dump()
        )