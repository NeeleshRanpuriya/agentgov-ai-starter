from pymongo import AsyncMongoClient
from .config import settings

client = AsyncMongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
db = client[settings.mongodb_db]

async def check_database():
    await client.admin.command("ping")
    return True
