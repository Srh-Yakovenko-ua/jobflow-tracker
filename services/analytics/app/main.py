from app.core.config import Settings
from app.factory import create_app

app = create_app(Settings())
