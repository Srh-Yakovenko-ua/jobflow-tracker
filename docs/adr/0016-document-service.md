# ADR-0016: A stateless document service for resume files

- Status: accepted
- Date: 2026-11-12

## Context

Users upload resumes as a text PDF, a DOCX, a scanned PDF or a phone photo. The AI profile (AI-05) needs either the text or page images, and no model accepts a PDF, so a scan has to reach the vision model as JPEG pages. Binary parsing in the Node worker would put PDF, DOCX and image libraries next to the queue code, and the Python libraries for this are mature and permissively licensed.

## Decision

`services/documents` is a stateless FastAPI service on port 8002 with one route, `POST /documents/extract`. It takes one multipart file (at most 10 MB and 20 pages), detects the type from magic bytes and answers `{ kind, text, pages, pageCount }`. pypdfium2 reads the text layer and renders pages, Pillow resizes and re-encodes them, python-docx reads paragraphs and table cells in document order. A PDF with almost no text, or an image, is a `scan`: up to 3 pages as JPEG, each at most 180 KB, with EXIF removed. The response shape and the limits come from `@jobflow/shared` through `pnpm gen:contracts`, and errors leave in the DOC-04 shape with `requestId`.

The service makes no AI call and has no database, no storage and no auth layer: it keeps nothing and returns only what the caller sent. It listens on 127.0.0.1 and the compose network. File content and extracted text are never logged. Only the worker calls it (AI-05).

## Alternatives

- **Parsing in the Node worker**: no extra container, but the worker gets native PDF and image dependencies, and a bad file can take the queue process down.
- **PyMuPDF**: fast and complete, but AGPL, whose copyleft terms would cover the whole service; pypdfium2, Pillow and python-docx are permissive.
- **An OCR engine such as Tesseract**: text from scans without a model, but a heavy system dependency and weak results on phone photos, while the vision model already reads page images.

## Consequences

- Better: the worker stays free of binary parsing, a crash on a broken file stays inside one stateless container, and the service is easy to test with synthetic files.
- Worse: one more container in Compose, one more CI job, one network hop per resume, and local type stubs for pypdfium2.
- Watch: the 512 MB memory limit against large pages and archives, the 180 KB cap on every JPEG, and the generated contract model staying in step with the shared schema.

## Links

AI-11, AI-05, AN-01, AI-01. DOC-04, DOC-05, DOC-10. Relates to [ADR-0001](0001-modular-monolith.md) (three satellite services: analytics, documents, ai). Narrows [ADR-0009](0009-ai-provider-strategy.md): page images of a scanned CV may go to the configured vision model. Neither record is edited. Related: [ADR-0018](0018-ai-as-a-python-service.md).
