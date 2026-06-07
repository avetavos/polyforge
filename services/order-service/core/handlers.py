import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from core.exceptions import OrderNotCancellableError, OrderNotFoundError
from models.response import BaseResponseModel

logger = logging.getLogger(__name__)


def _envelope(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=BaseResponseModel(message=message, data=None).model_dump(),
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(OrderNotFoundError)
    async def _handle_not_found(request: Request, exc: OrderNotFoundError) -> JSONResponse:
        return _envelope(str(exc), status.HTTP_404_NOT_FOUND)

    @app.exception_handler(OrderNotCancellableError)
    async def _handle_not_cancellable(
        request: Request, exc: OrderNotCancellableError
    ) -> JSONResponse:
        return _envelope(str(exc), status.HTTP_400_BAD_REQUEST)

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _envelope("Internal Server Error", status.HTTP_500_INTERNAL_SERVER_ERROR)
