from pydantic import BaseModel

class FilesSchema(BaseModel):
    user_id: str
    fileName: str
    fileUrl: str
    fileSize: int
    mimeType: str
    