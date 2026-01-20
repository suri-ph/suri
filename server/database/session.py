from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from config.paths import DATA_DIR

DATABASE_URL = f"sqlite+aiosqlite:///{DATA_DIR}/attendance.db"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite
    pool_size=5,  # Moderate pool for desktop app concurrency
    max_overflow=10,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
