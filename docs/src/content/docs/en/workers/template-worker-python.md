---
title: Python Worker Template
description: Asynchronous consumer powered by Python and aio-pika with event loop lifecycles
---

The `template-worker-python` starter kit is an asynchronous background processor built on **Python 3.10+** and **aio-pika**.

---

## ⚡ Consumer Implementation

```python title="worker.py"
import asyncio
import aio_pika
from app.pkg.logging import get_logger

logger = get_logger()

async def main():
    connection = await aio_pika.connect_robust("amqp://guest:guest@localhost:5672/")
    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=10)

        queue = await channel.declare_queue("task_queue", durable=True)

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process(requeue=False):
                    logger.info(f"Processing payload: {message.body.decode()}")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 🛠️ Development Workflow

```bash title="Terminal"
cd worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python worker.py
```
