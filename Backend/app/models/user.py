from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    user_id:str
    user_type:str

class UserRegisterSchema(BaseModel):
    email: EmailStr
    password: str
    role: str
    display_name: str | None = None

# Schema for incoming Login requests
class UserLoginSchema(BaseModel):
    email: EmailStr
    password: str

# Schema for the response
class UserResponse(BaseModel):
    user_id: str
    email: str
    token: str | None = None
    
