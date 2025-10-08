from typing import Generic, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar('T')

class BaseResponseModel(BaseModel, Generic[T]):
    message: str
    data: Optional[T] = None
    