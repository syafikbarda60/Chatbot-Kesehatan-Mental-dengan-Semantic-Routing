# Pydantic conventions

Validation and request bodies use **Pydantic v2** (`pydantic[email]>=2.0.0`). Models are defined
inline in the route file that uses them (no central `schemas/` module).

## Patterns

```python
from pydantic import BaseModel
from typing import List, Optional, Literal

class AssessmentRequest(BaseModel):
    answers: List[AnswerItem]
    instrument_type: Literal["PHQ-9", "GAD-7", "SRQ", "custom"] = "PHQ-9"
    session_id: Optional[str] = None
```

- Request bodies are `BaseModel` classes named `<Thing>Request` (e.g. `ChatRequest`,
  `SaveJournalRequest`, `NotifyRiskRequest`).
- Enumerations use `Literal[...]` — roles, instrument types, moods (`"calm" | "anxious" | "focused" | "tired"`),
  never free strings.
- Optional fields default to `None`; fields with a fixed default carry it inline.
- Nested input uses a small model per item (`AnswerItem`).
- Convert models for storage with `model_dump()` (e.g. `[a.model_dump() for a in request.answers]`).
- `EmailStr` (from `pydantic[email]`) for account email fields.
- There are no `response_model=` declarations — handlers return plain dicts
  (see [fastapi-conventions.md](fastapi-conventions.md)).
- Security-sensitive bodies set `model_config = ConfigDict(extra="forbid")` (e.g.
  `InstrumentSubmission`) so unexpected fields fail loudly instead of being ignored.

## Rules

- Validation belongs in the model, not in manual `if` checks; only business validation
  (e.g. non-empty journal content) stays in the handler and raises `HTTPException(400, ...)`.
- Keep field names `snake_case` to match the JSON and DB columns directly.
