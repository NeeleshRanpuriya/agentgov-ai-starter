import asyncio
from app.config import settings
from google import genai


async def main():
    client = genai.Client(api_key=settings.gemini_api_key)

    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents="Reply with exactly: Gemini connection working",
    )

    print(response.text)


asyncio.run(main())