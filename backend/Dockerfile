FROM python:3.11-slim
WORKDIR /app
# ponytail: install deps directly; pip install . fails because there's no apiary_hive_backend/ package dir
COPY pyproject.toml .
RUN pip install --no-cache-dir \
    "fastapi>=0.111" \
    "uvicorn[standard]>=0.29" \
    "python-multipart>=0.0.9" \
    "pandas>=2.2" \
    "networkx>=3.3" \
    "rapidfuzz>=3.9" \
    "httpx>=0.27" \
    "pydantic>=2.7" \
    "pydantic-settings>=2.3"
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
