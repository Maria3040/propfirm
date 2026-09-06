"""In-process sync event bus (modular monolith integration events)."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from typing import Any


Handler = Callable[[Any], None]


class Bus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Handler) -> None:
        self._handlers[event_type].append(handler)

    def publish(self, event_type: str, event: Any) -> None:
        for handler in list(self._handlers.get(event_type, [])):
            handler(event)


bus = Bus()
